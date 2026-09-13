import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from '../tooling/1to1/node_modules/node-html-parser/dist/index.js';
import { readOrigin } from '../tooling/1to1/src/lib/anon.ts';

const base = 'reference/site';
const origin = readOrigin(base)!;
const file = `${base}/assets/manifest.json`;
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const known = new Set(manifest.flatMap((a: any) => {
  const u = new URL(a.originalUrl);
  return [u.href, u.searchParams.get('url')];
}));
const dom = parse(fs.readFileSync(`${base}/dom/full.html`, 'utf8'));
const missing = new Map<string, string>();
for (const image of dom.querySelectorAll('img')) {
  const src = image.getAttribute('src');
  if (!src || src.startsWith('data:')) continue;
  const u = new URL(src, origin.url);
  const original = u.searchParams.get('url');
  if (known.has(u.href) || (original && known.has(original))) continue;
  missing.set(u.href, new URL(original || u.href, origin.url).href);
}
const results = await Promise.allSettled([...missing].map(async ([requested, direct]) => {
  const response = await fetch(direct);
  if (!response.ok) throw new Error(`Image returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const mime = response.headers.get('content-type')?.split(';')[0] || 'image/png';
  const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif' }[mime] || path.extname(new URL(direct).pathname);
  const localPath = `assets/images/img-${crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 10)}${ext}`;
  fs.writeFileSync(`${base}/${localPath}`, bytes);
  manifest.push({ originalUrl: requested, localPath, type: 'images', bytes: bytes.length, mime });
  return localPath;
}));
fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
console.log(results.map(r => r.status === 'fulfilled' ? r.value : String(r.reason)));
