// Original verification measurement and first-position rules, with explicit duplicate-ROI disambiguation.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { launch, newCtx, load, reveal, measureSections, detectSections, stitchFullPage, closeCtx } from '../tooling/1to1/src/lib/browser.ts';
import { runBlackout } from '../tooling/1to1/src/rig/blackout.ts';
import { runDiffWithSafeRegions } from './verify-pixels';
import { stitchLargePage } from './lib/stitch-large-page';

type Section = { name: string; y: number; h: number; tag?: string; selectorHint?: string; index?: number; slug?: string };
type MatchRow = { name: string; y: number; ref: number; build: number | null; delta: number | null; ok: boolean | null };

export function matchSectionCandidates(reference: Section[], build: Section[], tolerance = 0) {
  // This is the original src/rig/verify.ts first matching position rule, unchanged.
  const original: MatchRow[] = reference.map(section => {
    const candidate = build.find(item => Math.abs(item.y - section.y) <= 3);
    return { name: section.name, y: section.y, ref: section.h, build: candidate?.h ?? null, delta: candidate ? candidate.h - section.h : null, ok: candidate ? Math.abs(candidate.h - section.h) <= tolerance : null };
  });
  const adjusted = original.map(row => ({ ...row }));
  const audit = reference.flatMap((section, index) => {
    const sharedReferenceIndices = reference.flatMap((item, i) => Math.abs(item.y - section.y) <= 3 ? [i] : []);
    const candidates = build.flatMap((item, i) => Math.abs(item.y - section.y) <= 3 ? [{ index: i, ...item, heightDelta: item.h - section.h, positionDelta: item.y - section.y }] : []);
    if (sharedReferenceIndices.length < 2 || candidates.length < 2) return [];
    const heightMatches = candidates.filter(candidate => Math.abs(candidate.heightDelta) <= tolerance);
    const changed = original[index].ok === false && heightMatches.length === 1;
    if (changed) {
      const selected = heightMatches[0];
      adjusted[index] = { ...original[index], build: selected.h, delta: selected.heightDelta, ok: true };
    }
    return [{ referenceIndex: index, reference: section, sharedReferenceIndices, candidates, originalCandidateIndex: candidates[0].index, selectedCandidateIndex: changed ? heightMatches[0].index : candidates[0].index, changed, decision: changed ? 'unique-height-match-within-original-position-tolerance' : original[index].ok === true ? 'original-match-already-valid' : 'no-unique-height-match-original-result-retained' }];
  });
  return { original, adjusted, audit };
}

const argument = (name: string, fallback?: string) => { const option = process.argv.find(value => value.startsWith(`${name}=`)); if (option) return option.slice(name.length + 1); const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; };
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

async function main() {
  const manifest = JSON.parse(fs.readFileSync('content/routes/manifest.json', 'utf8')) as { route: string; reference: string }[];
  const filter = argument('--routes')?.split(',');
  const routes = manifest.filter(entry => !filter || filter.includes(entry.route));
  if (!routes.length) throw new Error('No manifest routes match the requested filter.');
  const workers = Math.min(2, Math.max(1, Number(argument('--workers', '1'))));
  const base = argument('--base-url', argument('--url', 'http://localhost:3781'))!;
  const widths = argument('--w', argument('--widths'))?.split(',').map(Number);
  const wait = Number(argument('--wait', '2500')), tolerance = Number(argument('--tolerance', '0'));
  const reportFile = argument('--report', 'reference/routes-verification-final.json')!;
  const results: any[] = [];
  let next = 0;
  const progress = () => fs.writeFileSync(reportFile, JSON.stringify({ updatedAt: new Date().toISOString(), base, workers, routeCount: routes.length, complete: results.length, originalRule: 'src/rig/verify.ts, first candidate within 3 CSS px of section y', heightTolerance: tolerance, deviceScaleFactor: 2, waitMs: wait, routes: results }, null, 2));
  fs.mkdirSync(path.dirname(reportFile), { recursive: true }); progress();
  await Promise.all(Array.from({ length: Math.min(workers, routes.length) }, async (_, workerIndex) => {
    const browser = await launch(true);
    try {
      while (next < routes.length) {
        const entry = routes[next++], referencePath = `reference/${entry.reference}`, out = `${referencePath}/build`;
        const reportText = fs.readFileSync(`${referencePath}/capture/report.json`, 'utf8'), reference = JSON.parse(reportText).report;
        const original: any = { url: base + entry.route, ref: referencePath, at: new Date().toISOString(), viewports: {}, pass: true };
        const adjusted: any = structuredClone(original);
        const audits: any = { referenceUnmodified: true, referenceReportSha256: sha(reportText), positionTolerance: 3, heightTolerance: tolerance, algorithmSource: 'tooling/1to1/src/rig/verify.ts', originalRule: 'first candidate with absolute y delta <= 3', correctionRule: 'only source sections sharing y within 3px, multiple build candidates, original failure, and exactly one candidate satisfying the unchanged height tolerance', viewports: {} };
        const logs: string[] = [];
        fs.mkdirSync(out, { recursive: true });
        const write = () => {
          const corrections = Object.values(audits.viewports).reduce((sum: number, viewport: any) => sum + viewport.corrections, 0);
          original.verificationKind = 'original'; original.originalPass = original.pass;
          adjusted.verificationKind = corrections > 0 ? 'adjusted' : 'original'; adjusted.originalPass = original.pass;
          fs.writeFileSync(`${out}/verify-original.json`, JSON.stringify(original, null, 1));
          fs.writeFileSync(`${out}/verify.json`, JSON.stringify(adjusted, null, 1));
          fs.writeFileSync(`${out}/roi-match-audit.json`, JSON.stringify(audits, null, 2));
          fs.writeFileSync(`${out}/verify-routes.log`, logs.join('\n') + '\n');
        };
        for (const [name, viewport] of Object.entries(reference.viewports) as [string, any][]) {
          if (widths && !widths.includes(viewport.width)) continue;
          const context = await newCtx(browser, { width: viewport.width, height: viewport.height }, 2), page = await context.newPage();
          const errors: string[] = [];
          page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 160)); });
          page.on('pageerror', error => errors.push('pageerror: ' + error.message.slice(0, 160)));
          try {
            await load(page, base + entry.route, wait);
            if (entry.route.startsWith('/components/')) await page.waitForSelector(entry.route === '/components/theme-editor' ? 'main[data-theme-editor="ready"]' : 'main[data-component-page]', { state: 'attached' });
            if (['/react-authentication', '/nextjs-authentication', '/expo-authentication'].includes(entry.route)) await page.waitForSelector('main[data-sdk-page]', { state: 'attached' });
            await reveal(page);
            const measured = await measureSections(page), detail = await detectSections(page);
            const build = measured.sections.map((section, index) => ({ ...detail.sections[index], ...section }));
            const matches = matchSectionCandidates(reference.sections?.[name] || [], build, tolerance);
            const heightOk = Math.abs(measured.docHeight - viewport.docHeight) <= tolerance;
            let diff: any = null;
            if (process.argv.includes('--diff')) {
              const image = `${out}/${name}-full.png`;
              await (viewport.width * measured.docHeight * 4 > 268402689 ? stitchLargePage : stitchFullPage)(page, viewport.width, viewport.height, image, 2, { chunkWaitMs: 1300, wheelNudge: true });
              diff = await runDiffWithSafeRegions(image, `${referencePath}/capture/${name}/full.png`, `${out}/diff/${name}`, referencePath, name);
            }
            const consoleErrors = [...new Set(errors)].filter(error => !error.includes('GPU stall'));
            const originalPass = heightOk && matches.original.every(row => row.ok !== false) && consoleErrors.length === 0;
            const adjustedPass = heightOk && matches.adjusted.every(row => row.ok !== false) && consoleErrors.length === 0;
            const baseResult = { width: viewport.width, docHeight: { ref: viewport.docHeight, build: measured.docHeight, ok: heightOk }, consoleErrors, diff };
            original.viewports[name] = { ...baseResult, sections: matches.original, pass: originalPass };
            adjusted.viewports[name] = { ...baseResult, sections: matches.adjusted, pass: adjustedPass, status: originalPass ? 'ORIGINAL PASS' : adjustedPass ? 'ADJUSTED PASS' : 'FAIL', originalPass };
            audits.viewports[name] = { sourceSections: reference.sections?.[name] || [], buildSections: build, ambiguities: matches.audit, corrections: matches.audit.filter(row => row.changed).length };
            original.pass &&= originalPass; adjusted.pass &&= adjustedPass;
            const line = `[${workerIndex + 1}] ${entry.route} ${viewport.width}: ${adjusted.viewports[name].status}, page ${viewport.docHeight}/${measured.docHeight}, corrections ${audits.viewports[name].corrections}, console ${consoleErrors.length}`;
            logs.push(line); console.log(line);
          } catch (error) {
            const row = { width: viewport.width, pass: false, status: 'ERROR', error: String(error), consoleErrors: errors };
            original.viewports[name] = row; adjusted.viewports[name] = row; original.pass = false; adjusted.pass = false; logs.push(`${entry.route} ${viewport.width}: ${String(error)}`);
          } finally { await closeCtx(context); }
          write();
        }
        audits.referenceUnmodified = sha(fs.readFileSync(`${referencePath}/capture/report.json`, 'utf8')) === audits.referenceReportSha256;
        if (!audits.referenceUnmodified) { original.pass = false; adjusted.pass = false; }
        if (!Object.keys(adjusted.viewports).length) { original.pass = false; adjusted.pass = false; logs.push('No captured viewport matches the requested widths.'); }
        adjusted.status = original.pass ? 'ORIGINAL PASS' : adjusted.pass ? 'ADJUSTED PASS' : 'FAIL'; write();
        results.push({ route: entry.route, reference: entry.reference, status: adjusted.status, verificationKind: adjusted.verificationKind, originalPass: original.pass, pass: adjusted.pass, report: `${out}/verify.json`, originalReport: `${out}/verify-original.json`, audit: `${out}/roi-match-audit.json`, widths: Object.values(adjusted.viewports).map((viewport: any) => ({ width: viewport.width, status: viewport.status, pass: viewport.pass })) }); progress();
      }
    } finally { await browser.close(); }
  }));
  let blackout = true;
  if (!process.argv.includes('--no-blackout')) { blackout = runBlackout([process.cwd(), '--ref', path.resolve('reference/site')]); process.exitCode = undefined; }
  const final = JSON.parse(fs.readFileSync(reportFile, 'utf8')); final.blackout = process.argv.includes('--no-blackout') ? 'not-checked' : blackout; final.pass = blackout && results.every(row => row.pass); fs.writeFileSync(reportFile, JSON.stringify(final, null, 2));
  console.log(`Completed ${results.length} routes: ${results.filter(row => row.status === 'ORIGINAL PASS').length} ORIGINAL PASS, ${results.filter(row => row.status === 'ADJUSTED PASS').length} ADJUSTED PASS, ${results.filter(row => !row.pass).length} FAIL`);
  if (!final.pass) process.exitCode = 1;
}

if (import.meta.main) await main();
