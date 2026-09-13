// @ts-nocheck
// Harvests dormant picture sources from captured DOM without using a browser.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from '../tooling/1to1/node_modules/node-html-parser';
import { readOrigin, scrubSource, hostBrand } from '../tooling/1to1/src/lib/anon.ts';
const project = process.cwd();
const reference = path.join(project, 'reference');
const cache = new Map<string, any>();
let count = 0;
for (const name of fs.readdirSync(reference).filter((name) => name.startsWith('site-'))) {
  const root = path.join(reference, name);
  const origin = readOrigin(root);
  const pageFile = path.join(root, 'supplement/page.json');
  if (!origin || !fs.existsSync(pageFile)) continue;
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'meta.json'), 'utf8'));
  if (!['complete', 'partial'].includes(meta.status)) continue;
  const files = ['dom/full.html', 'supplement/page.json', ...['desktop', 'tablet', 'tablet-810', 'mobile'].flatMap((vp) => [`capture/${vp}/dom.html`, `capture/${vp}/layout.json`])].filter((file) => fs.existsSync(path.join(root, file)));
  const missing = new Set<string>();
  for (const file of files.filter((file) => file.endsWith('.html'))) {
    const html = parse(fs.readFileSync(path.join(root, file), 'utf8'));
    for (const node of html.querySelectorAll('source[srcset]')) {
      const set = node.getAttribute('srcset') || '';
      if (set.startsWith('data:')) continue;
      for (const entry of set.split(',')) {
        const value = entry.trim().split(/\s+/)[0];
        if (value && !value.startsWith('/assets/') && !/^(data:|blob:|#)/.test(value)) missing.add(value);
      }
    }
  }
  const replacements: [string, string][] = [];
  const manifestFile = path.join(root, 'assets/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  for (const value of missing) {
    const originalPath = value.replace(new RegExp(origin.brand, 'gi'), hostBrand(origin.host));
    const url = new URL(originalPath, origin.url).href;
    let asset = cache.get(url);
    if (!asset) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const mime = (response.headers.get('content-type') || '').split(';')[0];
        if (!response.ok || !mime.startsWith('image/')) continue;
        let body = Buffer.from(await response.arrayBuffer());
        if (mime.includes('svg')) body = Buffer.from(scrubSource(body.toString(), origin.tokens, origin.brand, origin.host));
        const extension = path.extname(new URL(url).pathname) || '.bin';
        const file = `img-${createHash('sha256').update(body).digest('hex').slice(0, 16)}${extension}`;
        const shared = path.join(reference, 'route-assets', file);
        if (!fs.existsSync(shared)) fs.writeFileSync(shared, body);
        asset = { file, target: `/assets/${file}`, mime, bytes: body.length, shared };
        cache.set(url, asset);
      } catch { continue; }
    }
    const destination = path.join(root, 'assets', asset.file);
    if (!fs.existsSync(destination)) { try { fs.linkSync(asset.shared, destination); } catch { fs.copyFileSync(asset.shared, destination); } }
    if (!manifest.some((item) => item.target === asset.target)) manifest.push({ file: asset.file, sourcePath: path.relative(project, destination), target: asset.target, mime: asset.mime, bytes: asset.bytes });
    replacements.push([value, asset.target]);
  }
  if (!replacements.length) continue;
  for (const file of files) {
    const filename = path.join(root, file);
    let text = fs.readFileSync(filename, 'utf8');
    for (const [before, after] of replacements) text = text.replaceAll(before, after).replaceAll(before.replaceAll('&', '&amp;'), after);
    fs.writeFileSync(filename, text);
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  meta.assetCount = manifest.length;
  fs.writeFileSync(path.join(root, 'meta.json'), JSON.stringify(meta, null, 2));
  const reportFile = path.join(root, 'capture/report.json');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  report.report.assets = manifest.length;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  count++;
  console.log(`${meta.route}: localized ${replacements.length} dormant picture sources.`);
}
console.log(`Asset repair finished for ${count} routes.`);
