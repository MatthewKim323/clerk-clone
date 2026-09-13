import fs from 'node:fs';
import path from 'node:path';
import sharp from '../tooling/1to1/node_modules/sharp/lib/index.js';
import {launch,newCtx,load,reveal,stitchFullPage} from '../tooling/1to1/src/lib/browser.ts';
import {runDiff} from '../tooling/1to1/src/rig/diff.ts';
import {runLargePageDiff} from './lib/diff-large-page';
import {stitchLargePage} from './lib/stitch-large-page';

type Range = [name: string, start: number, end: number];
type ROIAdjustment = {
  name: string;
  sourceName: string;
  mode: 'clipped-to-common-page' | 'full-common-page-fallback';
  reason: string[];
  originalCss: { top: number; height: number } | null;
  comparedPixels: { left: number; top: number; width: number; height: number };
};

/** Keep the original diff algorithm, supplying explicit safe ranges only when its ROI is invalid. */
export async function runDiffWithSafeRegions(buildFile: string, refFile: string, outDir: string, reference: string, viewport: string) {
  const report = JSON.parse(fs.readFileSync(path.join(reference, 'capture', 'report.json'), 'utf8')).report;
  const sections = report.sections?.[viewport] as { slug: string; y: number; h: number }[] | undefined;
  const [build, ref] = await Promise.all([sharp(buildFile,{limitInputPixels:false}).metadata(), sharp(refFile,{limitInputPixels:false}).metadata()]);
  const width = Math.min(build.width!, ref.width!), height = Math.min(build.height!, ref.height!);
  const large = Math.max(build.width!*build.height!,ref.width!*ref.height!) > 268402689;
  const compare = large ? runLargePageDiff : runDiff;
  if (!width || !height) throw new Error('Cannot compare images without a nonempty common pixel area');
  const scale = 2;
  const adjustments: ROIAdjustment[] = [];
  const safeRanges: Range[] = (sections || []).map((section, index) => {
    const sourceName = `${String(index).padStart(2, '0')}-${section.slug}`;
    const top = Math.round(section.y * scale), rangeHeight = Math.round(section.h * scale);
    const bottom = top + rangeHeight;
    const reason: string[] = [];
    if (!Number.isFinite(top) || !Number.isFinite(rangeHeight)) reason.push('non-finite-range');
    else {
      if (top < 0) reason.push('starts-before-page');
      if (rangeHeight <= 0) reason.push('non-positive-height');
      if (bottom > build.height!) reason.push('extends-beyond-build');
      if (bottom > ref.height!) reason.push('extends-beyond-reference');
    }
    if (!reason.length) return [sourceName, section.y, section.y + section.h];
    const clippedTop = Math.max(0, Math.min(height, top));
    const clippedBottom = Math.max(0, Math.min(height, bottom));
    const overlaps = Number.isFinite(clippedTop) && Number.isFinite(clippedBottom) && clippedBottom > clippedTop;
    const comparedTop = overlaps ? clippedTop : 0, comparedHeight = overlaps ? clippedBottom - clippedTop : height;
    const name = `${sourceName}-${overlaps ? 'clipped' : 'page-fallback'}`;
    adjustments.push({
      name, sourceName, mode: overlaps ? 'clipped-to-common-page' : 'full-common-page-fallback', reason,
      originalCss: { top: section.y, height: section.h },
      comparedPixels: { left: 0, top: comparedTop, width, height: comparedHeight },
    });
    return [name, comparedTop / scale, (comparedTop + comparedHeight) / scale];
  });
  const args = [buildFile, refFile, outDir, '--ref', reference, '--vp', viewport];
  if (adjustments.length) args.push('--ranges', JSON.stringify(safeRanges));
  await compare(args);
  const diffPath = path.join(outDir, 'diff.json');
  let diff = JSON.parse(fs.readFileSync(diffPath, 'utf8')) as { name: string; differ: number; roi?: ROIAdjustment }[];
  if (!diff.length) {
    adjustments.push({
      name: 'page-fallback', sourceName: 'page', mode: 'full-common-page-fallback', reason: ['no-section-metrics'],
      originalCss: null, comparedPixels: { left: 0, top: 0, width, height },
    });
    await compare([buildFile, refFile, outDir, '--ranges', JSON.stringify([['page-fallback', 0, height / scale]])]);
    diff = JSON.parse(fs.readFileSync(diffPath, 'utf8'));
  }
  if (adjustments.length) {
    for (const result of diff) {
      const adjustment = adjustments.find(item => item.name === result.name);
      if (adjustment) result.roi = adjustment;
    }
    fs.writeFileSync(diffPath, JSON.stringify(diff, null, 2));
  }
  fs.writeFileSync(path.join(outDir, 'roi-audit.json'), JSON.stringify({
      referenceUnmodified: true, scale, threshold: 40, largeImageBands: large,
      buildPixels: { width: build.width, height: build.height },
      referencePixels: { width: ref.width, height: ref.height },
      commonPixels: { width, height },
      uncomparedPixels: {
        build: build.width! * build.height! - width * height,
        reference: ref.width! * ref.height! - width * height,
      },
      adjustments,
  }, null, 2));
  return diff;
}

async function verifyPixels() {
  const manifest = JSON.parse(fs.readFileSync('content/routes/manifest.json', 'utf8'));
  const routes = process.argv[2]?.split(',');
  const widths = process.argv[3]?.split(',').map(Number) || [1440, 1024, 810, 390];
  const reportFile = `reference/${process.argv[4] || 'routes-pixel-verification'}.json`;
  const reuseCaptures = process.argv.includes('--reuse-captures');
  const browser = reuseCaptures ? null : await launch(true);
  const results: any[] = [];
  try {
    for (const entry of manifest) {
      if (routes && !routes.includes(entry.route)) continue;
      const reference = `reference/${entry.reference}`;
      const report = JSON.parse(fs.readFileSync(`${reference}/capture/report.json`, 'utf8')).report;
      fs.mkdirSync(`${reference}/build`, { recursive: true });
      for (const [name, vp] of Object.entries(report.viewports) as [string, any][]) {
        if (!widths.includes(vp.width)) continue;
        const context = browser ? await newCtx(browser, { width: vp.width, height: vp.height }, 2) : null;
        const page = context ? await context.newPage() : null;
        const errors: string[] = [];
        page?.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page?.on('pageerror', error => errors.push(error.message));
        try {
          const image = `${reference}/build/${name}-full.png`;
          if (page) {
            await load(page, 'http://localhost:3781' + entry.route, 350);
            if (/^\/components\/[^/]+\/?$/.test(entry.route)) await page.waitForSelector(entry.route==='/components/theme-editor'?'main[data-theme-editor="ready"]':'main[data-component-page]', { state: 'attached' });
            if(['/react-authentication','/nextjs-authentication','/expo-authentication'].includes(entry.route))await page.waitForSelector('main[data-sdk-page]',{state:'attached'});
            await reveal(page);
            const pageHeight=await page.evaluate(()=>Math.max(document.documentElement.scrollHeight,document.body.scrollHeight));
            await (vp.width*pageHeight*4>268402689?stitchLargePage:stitchFullPage)(page, vp.width, vp.height, image, 2, { chunkWaitMs: 250 });
          }
          const output = `${reference}/build/diff/${name}`;
          const diff = await runDiffWithSafeRegions(image, `${reference}/capture/${name}/full.png`, output, reference, name);
          results.push({ route: entry.route, width: vp.width, errors, diff, ...(reuseCaptures ? { reusedCapture: true, consoleChecked: false } : {}) });
        } catch (error) { results.push({ route: entry.route, width: vp.width, errors, error: String(error) }); }
        finally { await context?.close(); }
        fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
      }
    }
  } finally { await browser?.close(); }
}

if (import.meta.main) await verifyPixels();
