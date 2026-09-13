// @ts-nocheck
// Public route extraction. Runtime dependencies are shared with the 1to1 CLI.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from '../tooling/1to1/node_modules/node-html-parser';
import { BrowserPool, newCtx, load, reveal, stitchFullPage, LAYOUT_JS, detectSections, VIEWPORTS, closeCtx } from '../tooling/1to1/src/lib/browser.ts';
import { stitchLargePage } from './lib/stitch-large-page';
import { readOrigin, writeOrigin, scrubSource, hostBrand } from '../tooling/1to1/src/lib/anon.ts';

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const project = process.cwd();
const reference = path.join(project, 'reference');
const home = path.join(reference, 'site');
const origin = readOrigin(home)!;
if (!origin) throw new Error('The homepage origin metadata is required.');
const clean = (text: string) => scrubSource(text, origin.tokens, origin.brand, origin.host).replace(/[\u2013\u2014]/g, '-');
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex').slice(0, 16);
const arg = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const only = arg('--routes')?.split(',');
const limit = Number(arg('--limit') || Infinity);
const workers = Math.min(3, Math.max(1, Number(arg('--workers') || 3)));
const force = process.argv.includes('--force');
const paths: string[] = JSON.parse(fs.readFileSync(path.join(home, 'navigation-routes.json'), 'utf8')).paths;
const allRoutes = [...new Set(paths.map((route) => route.split('#')[0]))].filter((route) => route !== '/');
const routes = allRoutes.filter((route) => !only || only.includes(route)).slice(0, limit);
const statusFile = path.join(reference, 'routes-capture-report.json');
const statuses: Record<string, any> = fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile, 'utf8')).routes || {} : {};
const sharedDir = path.join(reference, 'route-assets');
fs.mkdirSync(sharedDir, { recursive: true });

type Asset = { file: string; sourcePath: string; target: string; mime: string; bytes: number };
const sharedAssets = new Map<string, Asset>();
const inFlightAssets = new Map<string, Promise<Asset | null>>();
const cssCache = new Map<string, string>();
const moduleDir = path.join(reference, 'route-modules');
const moduleCache = new Map<string, { file: string; bytes: number }>();
let downloading = 0;
const downloadQueue: (() => void)[] = [];

async function deadline<T>(task: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([task, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds); })]);
  } finally { clearTimeout(timer!); }
}

async function fetchSlot<T>(fn: () => Promise<T>) {
  if (downloading >= 8) await new Promise<void>((resolve) => downloadQueue.push(resolve));
  downloading++;
  try { return await fn(); }
  finally { downloading--; downloadQueue.shift()?.(); }
}

function publicRoute(route: string) {
  const name = hostBrand(origin.host);
  return route.replace(new RegExp(origin.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), name);
}

function referenceName(route: string) {
  return `site-${clean(route).replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

function writeProgress() {
  fs.writeFileSync(statusFile, JSON.stringify({ updatedAt: new Date().toISOString(), routeCount: allRoutes.length, selectedRouteCount: routes.length, workers, routes: statuses }, null, 2));
}

function repairCompletedCss() {
  let repaired = 0;
  for (const route of routes) {
    const root = path.join(reference, referenceName(route));
    const metaFile = path.join(root, 'meta.json');
    const pageFile = path.join(root, 'supplement/page.json');
    if (!fs.existsSync(metaFile) || !fs.existsSync(pageFile)) continue;
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    if (!['complete', 'partial'].includes(meta.status)) continue;
    const data = JSON.parse(fs.readFileSync(pageFile, 'utf8'));
    const active: string[] = [];
    for (const vp of VIEWPORTS) {
      const domFile = path.join(root, 'capture', vp.name, 'dom.html');
      if (!fs.existsSync(domFile)) continue;
      const html = parse(fs.readFileSync(domFile, 'utf8'));
      for (const link of html.querySelectorAll('link[rel="stylesheet"]')) {
        const href = link.getAttribute('href');
        if (href && !active.includes(href)) active.push(href);
      }
    }
    const sheets = active.map((target) => data.stylesheets.find((sheet: any) => sheet.target === target)).filter(Boolean);
    if (sheets.length === data.stylesheets.length && sheets.every((sheet: any, index: number) => sheet.target === data.stylesheets[index].target)) continue;
    const external = sheets.map((sheet: any) => fs.readFileSync(path.join(root, sheet.file), 'utf8')).join('\n\n');
    const document = parse(fs.readFileSync(path.join(root, 'dom/full.html'), 'utf8'));
    const css = [external, ...document.querySelectorAll('style').map((style) => style.innerHTML)].join('\n\n');
    data.stylesheets = sheets;
    data.css = css;
    fs.writeFileSync(pageFile, JSON.stringify(data));
    fs.writeFileSync(path.join(root, 'dom/external.css'), external);
    fs.writeFileSync(path.join(root, 'dom/styles.css'), css);
    repaired++;
    console.log(`CSS repaired ${route}: ${sheets.length} active stylesheets.`);
  }
  return repaired;
}

if (process.argv.includes('--repair-css')) {
  if (process.argv.includes('--watch')) {
    while (true) {
      repairCompletedCss();
      const current = JSON.parse(fs.readFileSync(statusFile, 'utf8')).routes || {};
      if (routes.every((route) => ['complete', 'blocked', 'partial', 'error'].includes(current[route]?.status))) break;
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
    console.log('Stylesheet repair watcher finished.');
  } else {
    const count = repairCompletedCss();
    console.log(`Repaired stylesheet order for ${count} captured routes.`);
  }
  process.exit(0);
}

if (process.argv.includes('--modules-only')) {
  const moduleDir = path.join(reference, 'route-modules');
  fs.mkdirSync(moduleDir, { recursive: true });
  const cached = new Map<string, { file: string; bytes: number }>();
  const attempted = new Set<string>();
  while (true) {
    const current = JSON.parse(fs.readFileSync(statusFile, 'utf8')).routes || {};
    for (const route of routes) {
      if (current[route]?.status !== 'complete' || attempted.has(route)) continue;
      const root = path.join(reference, referenceName(route));
      const manifestFile = path.join(root, 'supplement/modules.json');
      if (!force && fs.existsSync(manifestFile)) { attempted.add(route); continue; }
      const source = readOrigin(root);
      if (!source) continue;
      try {
        const response = await fetch(source.url, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Initial document HTTP ${response.status}`);
        const rawHtml = await response.text();
        const html = parse(rawHtml);
        const chunkPaths = [...rawHtml.matchAll(/\/_next\/[^\s"'\\<>]+?\.js/g)].map((match) => match[0]);
        const scripts = [...new Set(html.querySelectorAll('script[src]').map((script) => script.getAttribute('src')!).concat(chunkPaths).map((url) => new URL(url, response.url).href))].filter((url) => /\.(m?js)(?:\?|$)/.test(url));
        const files = (await Promise.all(scripts.map((url) => fetchSlot(async () => {
          if (cached.has(url)) return cached.get(url)!;
          try {
            const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
            if (!response.ok) return null;
            const code = clean(await response.text());
            const filename = `module-${sha(code)}.js`;
            const full = path.join(moduleDir, filename);
            if (!fs.existsSync(full)) fs.writeFileSync(full, code);
            const record = { file: path.relative(project, full), bytes: Buffer.byteLength(code) };
            cached.set(url, record);
            return record;
          } catch { return null; }
        })))).filter(Boolean);
        fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
        const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : [];
        fs.writeFileSync(manifestFile, JSON.stringify([...new Map([...previous, ...files].map((record: any) => [record.file, record])).values()], null, 2));
        attempted.add(route);
        console.log(`Modules captured ${route}: ${files.length} chunks.`);
      } catch (error: any) {
        attempted.add(route);
        console.log(`Module capture skipped ${route}: ${clean(error.message).slice(0, 100)}`);
      }
    }
    if (!process.argv.includes('--watch') || routes.every((route) => ['complete', 'blocked', 'partial', 'error'].includes(current[route]?.status))) break;
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  console.log('Route module collection finished.');
  process.exit(0);
}

for (const file of [path.join(home, 'assets/manifest.json'), path.join(home, 'capture/assets/manifest.json')]) {
  if (!fs.existsSync(file)) continue;
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(manifest) ? manifest.map((item) => [item.originalUrl, { ...item, source: path.join(home, item.localPath) }]) : Object.entries<any>(manifest).map(([url, item]) => [url, { ...item, mime: item.contentType, source: path.join(path.dirname(file), item.file) }]);
  for (const [url, item] of rows) if (item.bytes >= 0 && fs.existsSync(item.source)) {
    const filename = path.basename(item.source);
    sharedAssets.set(url, { file: filename, sourcePath: item.source, target: `/assets/${filename}`, mime: item.mime, bytes: item.bytes });
  }
}

function extension(url: string, mime: string) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  if (/^\.[a-z0-9]{2,5}$/.test(ext)) return ext;
  return ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif', 'image/svg+xml': '.svg', 'image/gif': '.gif', 'font/woff2': '.woff2', 'font/woff': '.woff', 'application/font-woff': '.woff', 'video/mp4': '.mp4', 'video/webm': '.webm', 'audio/mpeg': '.mp3' } as Record<string, string>)[mime] || '.bin';
}

async function storeAsset(url: string, raw: Buffer, mime: string): Promise<Asset> {
  if (sharedAssets.has(url)) return sharedAssets.get(url)!;
  const body = mime.includes('svg') ? Buffer.from(clean(raw.toString())) : raw;
  const prefix = /font|woff|opentype|truetype/.test(mime) || /\.(woff2?|otf|ttf)(?:\?|$)/.test(url) ? 'font' : mime.startsWith('video/') ? 'vid' : mime.startsWith('audio/') ? 'audio' : 'img';
  const file = `${prefix}-${sha(body)}${extension(url, mime)}`;
  const sourcePath = path.join(sharedDir, file);
  if (!fs.existsSync(sourcePath)) fs.writeFileSync(sourcePath, body);
  const asset = { file, sourcePath, target: `/assets/${file}`, mime, bytes: body.length };
  sharedAssets.set(url, asset);
  return asset;
}

async function fetchAsset(url: string): Promise<Asset | null> {
  if (/^(data:|blob:|#)/.test(url)) return null;
  if (sharedAssets.has(url)) return sharedAssets.get(url)!;
  if (inFlightAssets.has(url)) return inFlightAssets.get(url)!;
  const request = fetchSlot(async () => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const mime = (response.headers.get('content-type') || '').split(';')[0];
      if (!response.ok || /html|javascript|json/.test(mime)) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 40_000_000) return null;
      return await storeAsset(url, buffer, mime);
    } catch { return null; }
  });
  inFlightAssets.set(url, request);
  return request;
}

async function captureRoute(route: string, pool: BrowserPool, worker: number) {
  const name = referenceName(route);
  const root = path.join(reference, name);
  const metaFile = path.join(root, 'meta.json');
  const previousMeta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : null;
  if (!force && fs.existsSync(metaFile)) {
    const prior = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    if (prior.status === 'complete' || prior.status === 'blocked') {
      statuses[route] = { status: prior.status, reference: name, resumed: true };
      writeProgress();
      console.log(`[${worker}] skip ${route}: ${prior.status}`);
      return;
    }
  }
  for (const dir of ['dom', 'capture', 'assets', 'supplement']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  const sourceUrl = new URL(publicRoute(route), origin.url).href;
  const pageHosts = new Set([new URL(sourceUrl).hostname]);
  const capturedAt = new Date().toISOString();
  writeOrigin(root, { ...origin, url: sourceUrl, capturedAt });
  const resumePartial = !force && previousMeta?.status === 'partial';
  const savedReportFile = path.join(root, 'capture/report.json');
  const report: any = resumePartial && fs.existsSync(savedReportFile) ? JSON.parse(fs.readFileSync(savedReportFile, 'utf8')).report : { viewports: {}, sections: {}, scenarios: {}, assets: 0 };
  const meta: any = { name, route, brand: origin.brand, capturedAt, stack: { framework: 'next', framer: false }, status: 'capturing', viewports: VIEWPORTS, docHeights: {}, errors: [] };
  const errors: string[] = [];
  const routeAssets = new Map<string, Asset>();
  const responseTasks: Promise<void>[] = [];
  const linkedCss = new Map<string, string>();
  const routeModules = new Map<string, { file: string; bytes: number }>();
  const snapshots = new Map<string, { html: string; layout: any[]; cssOrder: string[] }>();
  let title = resumePartial ? previousMeta.title || '' : '';
  let context: any;
  let page: any;
  let documentStatus = 0;

  if (resumePartial) {
    meta.docHeights = previousMeta.docHeights || {};
    const manifestFile = path.join(root, 'assets/manifest.json');
    if (fs.existsSync(manifestFile)) for (const asset of JSON.parse(fs.readFileSync(manifestFile, 'utf8'))) {
      const sourcePath = path.resolve(project, asset.sourcePath);
      if (!fs.existsSync(sourcePath)) continue;
      const url = new URL(asset.target, sourceUrl).href;
      if (asset.mime === 'text/css') linkedCss.set(url, fs.readFileSync(sourcePath, 'utf8'));
      else { const record = { ...asset, sourcePath }; routeAssets.set(url, record); sharedAssets.set(url, record); }
    }
    for (const vp of VIEWPORTS) {
      const dir = path.join(root, 'capture', vp.name);
      if (!report.viewports[vp.name]?.captureStatus || !fs.existsSync(path.join(dir, 'dom.html')) || !fs.existsSync(path.join(dir, 'layout.json')) || !fs.existsSync(path.join(dir, 'full.png'))) continue;
      const html = fs.readFileSync(path.join(dir, 'dom.html'), 'utf8');
      const cssOrder = parse(html).querySelectorAll('link[rel="stylesheet"]').map((link) => new URL(link.getAttribute('href')!, sourceUrl).href);
      snapshots.set(vp.name, { html, layout: JSON.parse(fs.readFileSync(path.join(dir, 'layout.json'), 'utf8')), cssOrder });
    }
  }

  function saveStatus(status: string, extra = {}) {
    meta.status = status;
    meta.errors = errors;
    Object.assign(meta, extra);
    fs.writeFileSync(metaFile, clean(JSON.stringify(meta, null, 2)));
    fs.writeFileSync(path.join(root, 'capture/report.json'), clean(JSON.stringify({ report, errors }, null, 2)));
    statuses[route] = { status, reference: name, widths: Object.keys(report.viewports), errors: [...errors], ...extra };
    writeProgress();
  }

  saveStatus('capturing');
  console.log(`[${worker}] start ${route}`);

  function useAsset(url: string, asset: Asset) {
    routeAssets.set(url, asset);
  }

  async function makePage(vp: any) {
    if (context) await deadline(closeCtx(context, 3000), 4000, 'context cleanup').catch(() => {});
    const browser = await pool.get();
    context = await newCtx(browser, vp, 2);
    context.setDefaultTimeout(12000);
    context.on('response', (response: any) => {
      const url = response.url();
      const request = response.request();
      const mime = (response.headers()['content-type'] || '').split(';')[0];
      if (request.resourceType() === 'document' && request.isNavigationRequest() && page && request.frame() === page.mainFrame()) documentStatus = response.status();
      const isCss = request.resourceType() === 'stylesheet' || mime === 'text/css';
      const isAsset = /^(image|font|video|audio)\//.test(mime) || /\.(woff2?|ttf|otf)(?:\?|$)/.test(url);
      const isModule = request.resourceType() === 'script' || mime.includes('javascript');
      if (response.status() < 200 || response.status() >= 300 || (!isCss && !isAsset && !isModule)) return;
      if (isModule && moduleCache.has(url)) { routeModules.set(url, moduleCache.get(url)!); return; }
      if (isAsset && sharedAssets.has(url)) { useAsset(url, sharedAssets.get(url)!); return; }
      responseTasks.push((async () => {
        try {
          const body = await deadline(response.body(), 15000, 'response body');
          if (isModule) {
            const code = clean(body.toString());
            const full = path.join(moduleDir, `module-${sha(code)}.js`);
            fs.mkdirSync(moduleDir, { recursive: true });
            if (!fs.existsSync(full)) fs.writeFileSync(full, code);
            const record = { file: path.relative(project, full), bytes: Buffer.byteLength(code) };
            moduleCache.set(url, record);
            routeModules.set(url, record);
          }
          else if (isCss) { const css = body.toString(); linkedCss.set(url, css); cssCache.set(url, css); }
          else if (body.length < 40_000_000) useAsset(url, await storeAsset(url, body, mime));
        } catch {}
      })());
    });
    page = await context.newPage();
    page.setDefaultTimeout(12000);
    const screenshot = page.screenshot.bind(page);
    page.screenshot = (options: any = {}) => screenshot({ ...options, timeout: 30000 });
  }

  async function detectGate() {
    return page.evaluate((publicAuth: boolean) => {
      const text = (document.body.innerText || '').trim();
      const title = document.title || '';
      const heading = document.querySelector('h1')?.textContent?.trim() || '';
      const publicMarketing = Boolean(document.querySelector('header nav[aria-label="Main"]') && heading && !/^(sign in|log in|log into|authenticate|access denied)/i.test(heading));
      const auth = /^\/(sign-in|login|auth\/|oauth\/authorize)(?:\/|$)/i.test(location.pathname) || (!publicMarketing && text.length < 5000 && /sign in to (continue|access)|log in to (continue|access)/i.test(text));
      const paywall = text.length < 5000 && /subscribe to (continue reading|read this)|purchase (a subscription|access) to continue/i.test(text);
      const challenge = /just a moment|attention required|verify you are human/i.test(title) || (text.length < 1500 && /verify you are human|checking your browser|access denied/i.test(text));
      return auth && !publicAuth ? 'Authentication gate' : paywall ? 'Subscription gate' : challenge ? 'Browser access challenge' : null;
    }, /^\/(sign-in|sign-up|login|register)(?:\/|$)/.test(route));
  }

  async function viewport(vp: any, attempt = 0): Promise<boolean> {
    try {
      if (!page || page.isClosed() || attempt > 0) await makePage(vp);
      else await page.setViewportSize({ width: vp.width, height: vp.height });
      await deadline(load(page, sourceUrl, 900), 65000, 'page load');
      const finalUrl = page.url();
      pageHosts.add(new URL(finalUrl).hostname);
      meta.redirected = finalUrl !== sourceUrl;
      meta.crossOriginRedirect = new URL(finalUrl).hostname !== new URL(sourceUrl).hostname;
      meta.finalRoute = clean(new URL(finalUrl).pathname + new URL(finalUrl).search);
      meta.stack = await page.evaluate(() => ({ framework: [...document.scripts].some((script) => /\/_next\//.test(script.src)) || '__next_f' in window ? 'next' : 'client-rendered', framer: !!document.querySelector('[data-framer-name]') }));
      writeOrigin(root, { ...origin, url: sourceUrl, capturedAt, finalUrl });
      const gate = await deadline(detectGate(), 10000, 'gate detection');
      if (gate) { meta.blockedReason = gate; return false; }
      if (documentStatus >= 400) throw new Error(`HTTP ${documentStatus}`);
      title ||= clean(await page.title());
      await deadline(reveal(page), 90000, 'reveal pass');
      await deadline(page.evaluate(() => document.fonts.ready.then(() => null)), 3000, 'font readiness').catch(() => {});
      const dir = path.join(root, 'capture', vp.name);
      fs.mkdirSync(dir, { recursive: true });
      const full = path.join(dir, 'full.png');
      const docHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      const stitchBudget = Math.max(45000, Math.ceil(docHeight / vp.height) * 10000);
      const stitch = vp.width * docHeight * 4 > 268402689 ? stitchLargePage : stitchFullPage;
      const result = await deadline(stitch(page, vp.width, vp.height, full, 2, { chunkWaitMs: attempt ? 100 : 250 }), stitchBudget, 'stitched screenshot');
      const layout = await deadline(page.evaluate(LAYOUT_JS), 15000, 'layout collection');
      const sections = await deadline(detectSections(page), 10000, 'section detection');
      const html = await deadline(page.evaluate(() => {
        const documentCopy = document.documentElement.cloneNode(true) as HTMLElement;
        const sourceStyles = [...document.querySelectorAll<HTMLStyleElement>('style')];
        const copiedStyles = [...documentCopy.querySelectorAll<HTMLStyleElement>('style')];
        sourceStyles.forEach((style, index) => {
          try {
            const rules = style.sheet ? [...style.sheet.cssRules].map((rule) => rule.cssText).join('\n') : '';
            if (rules && copiedStyles[index]) copiedStyles[index].textContent = rules;
          } catch {}
        });
        return '<!DOCTYPE html>' + documentCopy.outerHTML;
      }), 10000, 'DOM collection');
      const cssOrder = await page.locator('link[rel="stylesheet"]').evaluateAll((links: HTMLLinkElement[]) => links.map((link) => link.href));
      const domAssets: string[] = await page.evaluate(() => {
        const assets = new Set<string>();
        for (const image of document.images) {
          if (image.currentSrc) assets.add(image.currentSrc);
          if (image.src) assets.add(image.src);
          if (image.srcset && !image.srcset.startsWith('data:')) for (const entry of image.srcset.split(',')) { const value = entry.trim().split(/\s+/)[0]; if (value) assets.add(new URL(value, location.href).href); }
        }
        for (const node of document.querySelectorAll<HTMLVideoElement>('video')) { if (node.currentSrc) assets.add(node.currentSrc); if (node.poster) assets.add(node.poster); }
        for (const node of document.querySelectorAll<HTMLSourceElement>('source')) {
          if (node.src) assets.add(node.src);
          if (node.srcset && !node.srcset.startsWith('data:')) for (const entry of node.srcset.split(',')) { const value = entry.trim().split(/\s+/)[0]; if (value) assets.add(new URL(value, location.href).href); }
        }
        for (const node of document.querySelectorAll('svg image')) { const value = node.getAttribute('href') || node.getAttribute('xlink:href'); if (value && !value.startsWith('#')) assets.add(new URL(value, location.href).href); }
        return [...assets].filter((url) => /^https?:/.test(url));
      });
      await Promise.all(domAssets.map(async (url) => { const asset = await fetchAsset(url); if (asset) useAsset(url, asset); }));
      for (const cssUrl of cssOrder) if (!linkedCss.has(cssUrl)) {
        if (cssCache.has(cssUrl)) linkedCss.set(cssUrl, cssCache.get(cssUrl)!);
        else try { const response = await fetch(cssUrl, { signal: AbortSignal.timeout(15000) }); if (response.ok) { const text = await response.text(); linkedCss.set(cssUrl, text); cssCache.set(cssUrl, text); } } catch {}
      }
      snapshots.set(vp.name, { html, layout, cssOrder });
      report.viewports[vp.name] = { width: vp.width, height: vp.height, docHeight: result.docH, stitchChunks: result.chunks, hiddenFixedElements: result.hiddenFixed, layoutElements: layout.length, captureStatus: 'complete' };
      report.sections[vp.name] = sections.sections.map((section: any) => ({ ...section, name: clean(section.name), slug: clean(section.slug), selectorHint: clean(section.selectorHint) }));
      meta.docHeights[vp.name] = result.docH;
      saveStatus('capturing', { title });
      console.log(`[${worker}] ${route} ${vp.width}: ${result.docH}px`);
      return true;
    } catch (error: any) {
      if (attempt === 0) {
        console.log(`[${worker}] retry ${route} ${vp.width}: ${clean(error.message).slice(0, 100)}`);
        return viewport(vp, 1);
      }
      errors.push(`${vp.name}: ${clean(error.message).slice(0, 200)}`);
      await deadline(closeCtx(context, 3000), 4000, 'failed viewport cleanup').catch(() => {});
      context = null; page = null;
      return true;
    }
  }

  try {
    for (const vp of VIEWPORTS) {
      if (snapshots.has(vp.name) && report.viewports[vp.name]?.captureStatus === 'complete') { console.log(`[${worker}] reuse ${route} ${vp.width}`); continue; }
      const continueCapture = await viewport(vp);
      if (!continueCapture) break;
    }
  } finally {
    if (context) await deadline(closeCtx(context, 3000), 4000, 'route cleanup').catch(() => {});
    await Promise.allSettled(responseTasks);
  }

  if (meta.blockedReason) {
    saveStatus('blocked', { reason: meta.blockedReason });
    fs.writeFileSync(path.join(root, 'REBUILD.md'), `# ${origin.brand}: ${route}\n\nCapture stopped at: ${meta.blockedReason}. No login or form submission was attempted.\n`);
    console.log(`[${worker}] blocked ${route}: ${meta.blockedReason}`);
    return;
  }

  async function rewriteCss(text: string, base: string) {
    const matches = [...text.matchAll(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g)];
    const replacements = await Promise.all(matches.map(async (match) => {
      const raw = match[2].trim();
      if (/^(data:|blob:|#)/.test(raw)) return [match[0], match[0]];
      try { const url = new URL(raw, base).href; const asset = await fetchAsset(url); if (asset) { useAsset(url, asset); return [match[0], `url("${asset.target}")`]; } } catch {}
      return [match[0], match[0]];
    }));
    let result = text;
    for (const [before, after] of replacements) result = result.replaceAll(before, after);
    return clean(result);
  }

  const orderedSnapshots = VIEWPORTS.filter((vp) => snapshots.has(vp.name)).map((vp) => [vp.name, snapshots.get(vp.name)!] as const);
  const cssOrder = [...new Set(orderedSnapshots.flatMap(([, snapshot]) => snapshot.cssOrder))];
  const stylesheetMap = new Map<string, { file: string; target: string; css: string }>();
  for (const url of cssOrder) {
    const css = await rewriteCss(linkedCss.get(url) || '', url);
    if (!css) continue;
    const file = `css-${sha(css)}.css`;
    fs.writeFileSync(path.join(root, 'assets', file), css);
    stylesheetMap.set(url, { file, target: `/assets/${file}`, css });
  }
  const uniqueStylesheets = () => [...new Map([...stylesheetMap.values()].map((sheet) => [sheet.target, sheet])).values()];

  function rewriteKnown(text: string) {
    const replacements = [...routeAssets].map(([url, asset]) => [url, asset.target]).concat([...stylesheetMap].map(([url, asset]) => [url, asset.target]));
    replacements.sort((a, b) => b[0].length - a[0].length);
    for (const [url, local] of replacements) {
      const u = new URL(url);
      text = text.replaceAll(url, local).replaceAll(url.replaceAll('&', '&amp;'), local);
      if (pageHosts.has(u.hostname)) {
        const relative = u.pathname + u.search;
        text = text.replaceAll(relative, local).replaceAll(relative.replaceAll('&', '&amp;'), local);
      }
    }
    return clean(text);
  }

  const inlineStyles: string[] = [];
  let pageData: any = null;
  for (const [vp, snapshot] of orderedSnapshots) {
    const parsed = parse(snapshot.html);
    parsed.querySelectorAll('script').forEach((node) => node.remove());
    for (const style of parsed.querySelectorAll('style')) style.set_content(await rewriteCss(style.innerHTML, sourceUrl));
    const html = rewriteKnown(parsed.toString());
    const layout = rewriteKnown(JSON.stringify(snapshot.layout));
    fs.writeFileSync(path.join(root, 'capture', vp, 'layout.json'), layout);
    fs.writeFileSync(path.join(root, 'capture', vp, 'dom.html'), html);
    if (vp === 'desktop' || !pageData) {
      const document = parse(html);
      const htmlElement = document.querySelector('html');
      const body = document.querySelector('body');
      inlineStyles.push(...document.querySelectorAll('style').map((style) => style.innerHTML));
      const css = uniqueStylesheets().map((sheet) => sheet.css).concat(inlineStyles).join('\n\n');
      pageData = { route, title, htmlClass: htmlElement?.getAttribute('class') || '', bodyClass: body?.getAttribute('class') || '', htmlAttributes: htmlElement?.attributes || {}, bodyAttributes: body?.attributes || {}, bodyHtml: body?.innerHTML || html, stylesheets: uniqueStylesheets().map(({ file, target }) => ({ file: `assets/${file}`, target })), css };
      fs.writeFileSync(path.join(root, 'dom/full.html'), html);
      fs.writeFileSync(path.join(root, 'dom/external.css'), uniqueStylesheets().map((sheet) => sheet.css).join('\n\n'));
      fs.writeFileSync(path.join(root, 'dom/styles.css'), css);
    }
  }

  const assetManifest: Asset[] = [];
  for (const asset of new Map([...routeAssets.values()].map((asset) => [asset.target, asset])).values()) {
    const destination = path.join(root, 'assets', asset.file);
    if (!fs.existsSync(destination)) { try { fs.linkSync(asset.sourcePath, destination); } catch { fs.copyFileSync(asset.sourcePath, destination); } }
    assetManifest.push({ ...asset, sourcePath: path.relative(project, destination) });
  }
  for (const sheet of uniqueStylesheets()) assetManifest.push({ file: sheet.file, sourcePath: path.relative(project, path.join(root, 'assets', sheet.file)), target: sheet.target, mime: 'text/css', bytes: Buffer.byteLength(sheet.css) });
  fs.writeFileSync(path.join(root, 'assets/manifest.json'), JSON.stringify(assetManifest, null, 2));
  if (routeModules.size) {
    const file = path.join(root, 'supplement/modules.json');
    const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    fs.writeFileSync(file, JSON.stringify([...new Map([...existing, ...routeModules.values()].map((record) => [record.file, record])).values()], null, 2));
  }
  if (pageData) fs.writeFileSync(path.join(root, 'supplement/page.json'), rewriteKnown(JSON.stringify(pageData)));
  report.assets = assetManifest.length;
  const complete = VIEWPORTS.every((vp) => report.viewports[vp.name]?.captureStatus === 'complete');
  saveStatus(complete ? 'complete' : 'partial', { title, assetCount: assetManifest.length });
  const heights = VIEWPORTS.map((vp) => `| ${vp.name} | ${vp.width} | ${report.viewports[vp.name]?.docHeight ?? 'missing'} |`).join('\n');
  fs.writeFileSync(path.join(root, 'REBUILD.md'), `# ${origin.brand}: ${route}\n\nStatus: ${meta.status}.\n\nUse supplement/page.json for sanitized HTML attributes, body markup, and page-specific CSS. Assets are listed in assets/manifest.json with their public /assets/ destinations. Do not combine this page's CSS globally with other routes.\n\n| Viewport | Width | Document height |\n|---|---|---|\n${heights}\n\nPer-width evidence: capture/<viewport>/full.png, layout.json, and dom.html. The capture/report.json schema is compatible with 1to1 verify. Screenshots use 2x device scale and scroll-and-stitch.\n\nVerify: 1to1 verify http://localhost:3781${route} reference/${name} --diff\n\nVisual logos remain captured placeholders and require replacement. No login, authentication, payment, or form submission was performed.\n${errors.length ? `\nCapture errors:\n${errors.map((error) => `- ${error}`).join('\n')}\n` : ''}`);
  console.log(`[${worker}] ${meta.status} ${route}: ${Object.keys(report.viewports).length}/4 widths, ${assetManifest.length} assets`);
}

let cursor = 0;
async function worker(id: number) {
  const pool = new BrowserPool(true);
  try {
    while (cursor < routes.length) {
      const route = routes[cursor++];
      try { await captureRoute(route, pool, id); }
      catch (error: any) {
        statuses[route] = { status: 'error', reference: referenceName(route), error: clean(error.message).slice(0, 250) };
        writeProgress();
        console.log(`[${id}] error ${route}: ${clean(error.message).slice(0, 120)}`);
        await pool.reset();
      }
    }
  } finally { await pool.close(); }
}

console.log(`Capturing ${routes.length} navigation routes with ${workers} workers.`);
await Promise.all(Array.from({ length: workers }, (_, index) => worker(index + 1)));
writeProgress();
const counts = Object.values(statuses).reduce<Record<string, number>>((out, status: any) => { out[status.status] = (out[status.status] || 0) + 1; return out; }, {});
console.log(`Route capture finished: ${JSON.stringify(counts)}`);
