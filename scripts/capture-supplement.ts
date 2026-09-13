// @ts-nocheck
// Local extraction rig. Runtime dependencies live with the 1to1 CLI.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { launch, newCtx, load, LAYOUT_JS } from '../tooling/1to1/src/lib/browser.ts';
import { readOrigin, scrubSource } from '../tooling/1to1/src/lib/anon.ts';

const project = process.cwd();
const ref = path.join(project, 'reference/site');
const output = path.join(ref, 'supplement');
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
for (let n = 0; !fs.existsSync(path.join(ref, '.origin.json')); n++) {
  if (n > 600) throw new Error('Reference origin was not ready within ten minutes.');
  if (n === 0) console.log('Waiting for reference extraction metadata.');
  await pause(1000);
}
const origin = readOrigin(ref)!;
const clean = (value: string) => scrubSource(value, origin.tokens, origin.brand, origin.host);
for (const dir of [output, path.join(output, 'assets'), path.join(ref, 'modules/supplement'), path.join(ref, 'dom')]) fs.mkdirSync(dir, { recursive: true });

type Asset = { file: string; sourcePath: string; target: string; mime: string; bytes: number };
const assetMap = new Map<string, Asset>();
const assets = new Map<string, Asset>();
const cssSources = new Map<string, string>();
const initialStylesheets: string[] = [];
const modules = new Map<string, { file: string; bytes: number; route: string }>();
const requests: Promise<void>[] = [];
const errors: string[] = [];
const hash = (body: string | Buffer) => createHash('sha256').update(body).digest('hex').slice(0, 16);
const route = (url: string) => { try { const u = new URL(url, origin.url); return clean(u.pathname + u.search); } catch { return clean(url); } };
const absolute = (url: string, base = origin.url) => { try { return new URL(url, base).href; } catch { return url; } };

function register(url: string, record: Asset) {
  assetMap.set(absolute(url), record);
  assets.set(record.target, record);
}
function readAssets() {
  const saved = path.join(output, 'assets.json');
  if (fs.existsSync(saved)) for (const asset of JSON.parse(fs.readFileSync(saved, 'utf8'))) assets.set(asset.target, asset);
  const first = path.join(ref, 'assets/manifest.json');
  if (fs.existsSync(first)) for (const a of JSON.parse(fs.readFileSync(first, 'utf8'))) {
    const sourcePath = path.join(ref, a.localPath);
    if (!fs.existsSync(sourcePath)) continue;
    const file = path.basename(sourcePath);
    register(a.originalUrl, { file, sourcePath: path.relative(project, sourcePath), target: `/assets/${file}`, mime: a.mime, bytes: a.bytes });
  }
  const second = path.join(ref, 'capture/assets/manifest.json');
  if (fs.existsSync(second)) for (const [url, value] of Object.entries<any>(JSON.parse(fs.readFileSync(second, 'utf8')))) {
    const sourcePath = path.join(ref, 'capture/assets', value.file);
    if (value.bytes < 0 || !value.file || !fs.existsSync(sourcePath)) continue;
    register(url, { file: value.file, sourcePath: path.relative(project, sourcePath), target: `/assets/${value.file}`, mime: value.contentType, bytes: value.bytes });
  }
}
readAssets();

async function storeAsset(url: string, body: Buffer, mime: string) {
  let ext = path.extname(new URL(url).pathname).toLowerCase();
  if (!/^\.[a-z0-9]{2,5}$/.test(ext)) ext = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif', 'image/svg+xml': '.svg', 'font/woff2': '.woff2', 'font/woff': '.woff', 'video/mp4': '.mp4', 'video/webm': '.webm' } as Record<string, string>)[mime.split(';')[0]] || '.bin';
  const bucket = /font|woff|opentype|truetype/.test(mime) || /\.(woff2?|ttf|otf)$/.test(ext) ? 'font' : mime.startsWith('video/') ? 'vid' : 'img';
  const safeBody = mime.includes('svg') ? Buffer.from(clean(body.toString())) : body;
  const file = `${bucket}-${hash(safeBody)}${ext}`;
  const sourcePath = path.join(output, 'assets', file);
  fs.writeFileSync(sourcePath, safeBody);
  const record = { file, sourcePath: path.relative(project, sourcePath), target: `/assets/${file}`, mime, bytes: safeBody.length };
  register(url, record);
  return record;
}

const fetching = new Map<string, Promise<Asset | null>>();
async function assetFor(raw: string, base: string): Promise<Asset | null> {
  if (!raw || /^(data:|#|blob:)/.test(raw)) return null;
  const url = absolute(raw, base);
  if (assetMap.has(url)) return assetMap.get(url)!;
  if (fetching.has(url)) return fetching.get(url)!;
  const task = (async () => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const mime = response.headers.get('content-type') || '';
      if (!response.ok || /text\/html/.test(mime)) { errors.push(`Asset unavailable: ${route(url)}`); return null; }
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length > 30_000_000) { errors.push(`Asset too large: ${route(url)}`); return null; }
      return await storeAsset(url, body, mime);
    } catch { errors.push(`Asset fetch failed: ${route(url)}`); return null; }
  })();
  fetching.set(url, task);
  return task;
}

async function rewriteCss(css: string, base: string) {
  const matches = [...css.matchAll(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g)];
  const rewritten = await Promise.all(matches.map(async (match) => {
    const raw = match[2].trim();
    const asset = await assetFor(raw, base);
    return [match[0], asset ? `url("${asset.target}")` : match[0]] as const;
  }));
  let text = css;
  for (const [before, after] of rewritten) text = text.replaceAll(before, after);
  return clean(text);
}

function rewriteKnown(text: string) {
  const sorted = [...assetMap.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [url, record] of sorted) {
    text = text.replaceAll(url, record.target).replaceAll(url.replaceAll('&', '&amp;'), record.target);
    const parsed = new URL(url);
    if (parsed.host === new URL(origin.url).host) {
      const local = parsed.pathname + parsed.search;
      text = text.replaceAll(local, record.target).replaceAll(local.replaceAll('&', '&amp;'), record.target);
    }
  }
  return clean(text);
}

async function publishStyles(baseOnly = false) {
  readAssets();
  const order = [...initialStylesheets.filter((url) => cssSources.has(url)), ...[...cssSources.keys()].filter((url) => !initialStylesheets.includes(url))];
  const styleDir = path.join(ref, 'dom/styles');
  fs.mkdirSync(styleDir, { recursive: true });
  const styles = await Promise.all(order.map(async (url) => {
    const text = cssSources.get(url)!;
    const rewritten = await rewriteCss(text, url);
    const file = `stylesheet-${hash(text)}.css`;
    fs.writeFileSync(path.join(styleDir, file), rewritten);
    return { url, file, text: `/* Captured stylesheet ${hash(text)} */\n${rewritten}` };
  }));
  if (!baseOnly || !fs.existsSync(path.join(ref, 'dom/external.css'))) fs.writeFileSync(path.join(ref, 'dom/external.css'), styles.map((s) => s.text).join('\n\n'));
  fs.writeFileSync(path.join(ref, 'dom/external-base.css'), styles.filter((s) => initialStylesheets.includes(s.url)).map((s) => s.text).join('\n\n'));
  fs.writeFileSync(path.join(output, 'stylesheets.json'), JSON.stringify(styles.map((s) => ({ file: `dom/styles/${s.file}`, route: route(s.url), initial: initialStylesheets.includes(s.url) })), null, 2));
  fs.writeFileSync(path.join(output, 'assets.json'), JSON.stringify([...assets.values()], null, 2));
  if (modules.size) fs.writeFileSync(path.join(output, 'modules.json'), JSON.stringify([...modules.values()], null, 2));
  console.log(`Published ${styles.length} stylesheets and ${assets.size} asset mappings.`);
}

if (process.argv.includes('--styles-only')) {
  const html = fs.readFileSync(path.join(ref, 'dom/full.html'), 'utf8');
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((tag) => /\brel=["']stylesheet["']/i.test(tag)).map((tag) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1]).filter(Boolean) as string[];
  initialStylesheets.push(...links.map((href) => absolute(href.replaceAll('&amp;', '&'))));
  await Promise.all(links.map(async (href) => {
    const url = absolute(href.replaceAll('&amp;', '&'));
    try { const response = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (response.ok) cssSources.set(url, await response.text()); } catch { errors.push(`Stylesheet fetch failed: ${route(url)}`); }
  }));
  await publishStyles(true);
  process.exit(0);
}

const browser = await launch(true);
function listen(context: any) {
  context.on('response', (response: any) => {
    const url = response.url();
    const type = response.request().resourceType();
    const mime = response.headers()['content-type'] || '';
    const css = type === 'stylesheet' || mime.includes('text/css');
    const chunk = /\/_next\/static\/.+\.js(?:\?|$)/.test(url);
    const asset = /^(image|video|font|audio)\//.test(mime) || /\.(woff2?|ttf|otf)(?:\?|$)/.test(url);
    if ((!css && !chunk && !asset) || response.status() < 200 || response.status() >= 300) return;
    requests.push((async () => {
      try {
        const body = await Promise.race([response.body(), pause(20000).then(() => null)]);
        if (!body) return;
        if (css) cssSources.set(url, body.toString());
        else if (chunk && body.length < 5_000_000) {
          const text = clean(body.toString());
          const file = `module-${hash(text)}.js`;
          fs.writeFileSync(path.join(ref, 'modules/supplement', file), text);
          modules.set(url, { file, bytes: Buffer.byteLength(text), route: route(url) });
        } else if (asset && !assetMap.has(url)) await storeAsset(url, body, mime);
      } catch { errors.push(`Response read failed: ${route(url)}`); }
    })());
  });
}

async function captureState(page: any, name: string) {
  const html = await page.evaluate(() => {
    const root = document.body.cloneNode(true) as HTMLElement;
    root.querySelectorAll('script').forEach((el) => el.remove());
    return root.outerHTML;
  });
  fs.writeFileSync(path.join(output, `${name}.html`), rewriteKnown(html));
  fs.writeFileSync(path.join(output, `${name}.layout.json`), rewriteKnown(JSON.stringify(await page.evaluate(LAYOUT_JS))));
  await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'allow', caret: 'hide' });
}

if (process.argv.includes('--overlays-only')) {
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
  const states: Record<string, any> = {};
  const context = await newCtx(browser, { width: 1440, height: 900 }, 2);
  listen(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    for (const [name, label] of [['preferences', 'Cookie manager'], ['support', 'Support']]) {
      await load(page, origin.url, 1200);
      await page.getByRole('button', { name: label, exact: true }).first().evaluate((button: HTMLElement) => button.click());
      await page.waitForTimeout(1000);
      const html = await page.evaluate(() => {
        const root = document.body.cloneNode(true) as HTMLElement;
        root.querySelectorAll('script').forEach((element) => element.remove());
        return root.innerHTML;
      });
      const dialogs = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-overlay-container]')].filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width && rect.height && getComputedStyle(node).visibility !== 'hidden';
      }).map((node) => ({ html: node.outerHTML, rect: node.getBoundingClientRect().toJSON() })));
      const links: string[] = await page.locator('link[rel="stylesheet"]').evaluateAll((links: HTMLLinkElement[]) => links.map((link) => link.href));
      const inline = await page.locator('style').evaluateAll((styles: HTMLStyleElement[]) => styles.map((style) => style.innerHTML));
      const external: string[] = [];
      for (const url of links) {
        if (!cssSources.has(url)) {
          const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
          if (response.ok) cssSources.set(url, await response.text());
        }
        if (cssSources.has(url)) external.push(await rewriteCss(cssSources.get(url)!, url));
      }
      await Promise.allSettled(requests);
      const css = external.concat(await Promise.all(inline.map((text) => rewriteCss(text, origin.url)))).join('\n\n');
      const safeHtml = rewriteKnown(html).replace(/[\u2013\u2014]/g, '-');
      const screenshot = `overlays-${name}.png`;
      await page.screenshot({ path: path.join(output, screenshot), animations: 'allow', caret: 'hide', timeout: 30000 });
      states[name] = { html: safeHtml, dialogs: JSON.parse(rewriteKnown(JSON.stringify(dialogs))), css: css.replace(/[\u2013\u2014]/g, '-'), screenshot: `reference/site/supplement/${screenshot}`, viewport: { width: 1440, height: 900, deviceScaleFactor: 2 } };
      fs.writeFileSync(path.join(output, `overlays-${name}.html`), safeHtml);
      fs.writeFileSync(path.join(output, 'overlays.json'), JSON.stringify({ capturedAt: new Date().toISOString(), states, assets: [...assets.values()] }, null, 2));
      console.log(`Captured ${name} overlay: ${dialogs.length} dialog containers.`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
  process.exit(0);
}

const interactionResults: { name: string; status: string }[] = [];
try {
  const context = await newCtx(browser, { width: 1440, height: 1000 }, 2);
  listen(context);
  const page = await context.newPage();
  await load(page, origin.url, 2500);
  await captureState(page, 'desktop-initial');
  const stylesheetLinks: string[] = await page.locator('link[rel="stylesheet"]').evaluateAll((links: HTMLLinkElement[]) => links.map((link) => link.href));
  initialStylesheets.push(...stylesheetLinks);
  for (const url of stylesheetLinks) if (!cssSources.has(url)) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (response.ok) cssSources.set(url, await response.text()); } catch { errors.push(`Stylesheet fetch failed: ${route(url)}`); }
  }
  await publishStyles();
  for (const label of ['Products', 'Docs', 'Changelog', 'Company', 'AI']) {
    const name = `desktop-${label.toLowerCase()}`;
    await page.mouse.move(1430, 980);
    await page.waitForTimeout(250);
    let target: any = null;
    for (const candidate of await page.getByText(label, { exact: true }).all()) {
      const box = await candidate.boundingBox();
      if (box && box.y < 180 && box.width > 0 && box.height > 0) { target = candidate; break; }
    }
    if (!target) { interactionResults.push({ name, status: 'No visible navigation label matched.' }); continue; }
    await target.hover();
    await page.waitForTimeout(900);
    await captureState(page, name);
    interactionResults.push({ name, status: 'Captured hover.' });
  }
  await context.close();

  const mobile = await newCtx(browser, { width: 390, height: 844 }, 2);
  listen(mobile);
  const phone = await mobile.newPage();
  await load(phone, origin.url, 2500);
  await captureState(phone, 'mobile-initial');
  const controls = await phone.locator('button,[role="button"]').evaluateAll((buttons: HTMLElement[]) => buttons.map((button, index) => {
    const box = button.getBoundingClientRect();
    return { index, text: button.textContent?.trim(), label: button.getAttribute('aria-label'), title: button.getAttribute('title'), expanded: button.getAttribute('aria-expanded'), controls: button.getAttribute('aria-controls'), x: box.x, y: box.y, w: box.width, h: box.height, html: button.outerHTML };
  }).filter((button) => button.y >= 0 && button.y < 130 && button.w > 0 && button.h > 0));
  fs.writeFileSync(path.join(output, 'mobile-controls.json'), clean(JSON.stringify(controls, null, 2)));
  const toggle = controls.find((c: any) => /menu|navigation/i.test([c.text, c.label, c.title, c.controls].join(' '))) || controls.find((c: any) => c.expanded !== null && c.x > 195) || controls.find((c: any) => !c.text && c.x > 290 && c.w < 80 && /<svg/.test(c.html));
  if (toggle) {
    await phone.locator('button,[role="button"]').nth(toggle.index).click();
    await phone.waitForTimeout(1000);
    await captureState(phone, 'mobile-menu');
    interactionResults.push({ name: 'mobile-menu', status: 'Captured toggle.' });
  } else interactionResults.push({ name: 'mobile-menu', status: 'No suitable top navigation toggle found. Inspect mobile-controls.json.' });
  await mobile.close();
} finally {
  await Promise.allSettled(requests);
  await browser.close();
}

await publishStyles();
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ stylesheets: cssSources.size, modules: modules.size, assets: assets.size, interactions: interactionResults, errors }, null, 2));
for (const file of fs.readdirSync(output)) if (/\.(html|layout\.json)$/.test(file)) {
  const target = path.join(output, file);
  fs.writeFileSync(target, rewriteKnown(fs.readFileSync(target, 'utf8')));
}
console.log(`Supplement complete: ${cssSources.size} stylesheets, ${modules.size} modules, ${assets.size} assets, ${interactionResults.length} interaction results, ${errors.length} errors.`);
