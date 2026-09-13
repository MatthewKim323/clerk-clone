import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../tooling/1to1/node_modules/node-html-parser/dist/index.js';
import { readOrigin, scrubSource } from '../tooling/1to1/src/lib/anon.ts';
import {wordmark,badgeWordmark,brandSymbol,phoneWordmark} from '../lib/branding';
import {sanitizeReferenceMarkup,copyReferenceAsset} from './sanitize-reference';

const base = path.resolve('reference/site');
const origin = readOrigin(base)!;
const clean = (value: string) => scrubSource(value, origin.tokens, 'Aurora', origin.host).replace(/[\u2014\u2013]/g, ',');
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'assets/manifest.json'), 'utf8'));
const assetUrls = new Map<string, string>();
const optimized = new Map<string, {path:string;width:number}>();
fs.mkdirSync('public/assets', { recursive: true });
for (const asset of manifest) {
  const filename = path.basename(asset.localPath);
  const target = `/assets/${filename}`;
  const source = path.join(base, asset.localPath);
  if (fs.existsSync(source)) copyReferenceAsset(source, `public${target}`);
  const url = new URL(asset.originalUrl);
  const originalImage = url.searchParams.get("url");
  if (originalImage) {
    const width = Number(url.searchParams.get("w")) || 0;
    for(const key of [originalImage, clean(originalImage)]) if(width >= (optimized.get(key)?.width || 0)) optimized.set(key, {path:target,width});
  }
  for (const variant of [asset.originalUrl, ...(url.hostname === origin.host ? [url.pathname + url.search, ...(url.search ? [] : [url.pathname])] : [])]) {
    assetUrls.set(variant, target);
    assetUrls.set(clean(variant), target);
  }
}
const supp = path.join(base, 'supplement/assets.json');
if (fs.existsSync(supp)) {
  const data = JSON.parse(fs.readFileSync(supp, 'utf8'));
  for (const a of Array.isArray(data) ? data : Object.values(data)) {
    const asset = a as any;
    const source = asset.sourcePath || asset.sourceFile || asset.localPath;
    const target = asset.publicPath || asset.url || asset.target;
    if (source && target?.startsWith('/assets/')) {
      const absolute = fs.existsSync(source) ? source : path.join(base, source);
      if (fs.existsSync(absolute)) copyReferenceAsset(absolute, `public${target}`);
    }
  }
}
const supplementaryAssets=path.join(base,'supplement/assets');
if(fs.existsSync(supplementaryAssets))for(const file of fs.readdirSync(supplementaryAssets)) {
  if(/^(img|font|video)-/.test(file)&&!fs.existsSync(`public/assets/${file}`))copyReferenceAsset(path.join(supplementaryAssets,file),`public/assets/${file}`);
}
const rewriteAssetUrls = (value: string) => {
  let output = value;
  for (const [from, to] of [...assetUrls].sort((a, b) => b[0].length - a[0].length)) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(`(?<=[\\s\"'(=;])${escaped}(?=[\\s\"'),;&]|$)`, "g"), to);
  }
  return output;
};
const rewrite = (value: string) => sanitizeReferenceMarkup(clean(rewriteAssetUrls(value)));
const doc = parse(fs.readFileSync(path.join(base, 'dom/full.html'), 'utf8'), { comment: false });
const annotate = (el: any, address: string) => {
  el.setAttribute('data-reference-path', address);
  el.children.forEach((child: any, index: number) => annotate(child, `${address}/${index}`));
};
annotate(doc.querySelector('body'), '0');
for (const el of doc.querySelectorAll('script, noscript, iframe, next-route-announcer, link, meta')) el.remove();
for (const el of doc.querySelectorAll('*')) {
  for (const attr of Object.keys(el.attributes)) {
    if (/^on/i.test(attr) || ['nonce', 'integrity'].includes(attr)) el.removeAttribute(attr);
  }
  if (el.tagName === 'IMG') {
    el.setAttribute('loading', 'eager');
    try { const url = new URL(el.getAttribute('src') || '', origin.url);
      const image = url.searchParams.get('url');
      const asset = image && optimized.get(image);
      if(asset) { el.setAttribute('src', asset.path); el.removeAttribute('srcset'); }
    } catch {}
  }
}

for (const logo of doc.querySelectorAll('svg[viewBox="0 0 62 18"]')) {
  logo.set_content(wordmark);
}
for(const logo of doc.querySelectorAll('svg[viewBox="0 0 50 14"],svg[viewBox="0 0 49 14"]'))logo.set_content(badgeWordmark);
  for(const path of doc.querySelectorAll('svg[viewBox="0 0 32 32"] path[d^="M25.009 27.84"]'))path.closest('svg')?.set_content(brandSymbol);
  for(const logo of doc.querySelectorAll('svg[viewBox="0 0 122 41"]')){const group=logo.querySelector('g');if(group?.querySelector('path[d^="M31.863 3.452"]'))group.set_content(`<g transform="scale(1.28)" color="#131316">${brandSymbol}</g>`);}
  for(const logo of doc.querySelectorAll('svg[viewBox="0 0 33 10"]')){if(!logo.querySelector('path[d^="M5.16998"]'))continue;const fill=logo.querySelector('path')?.getAttribute('fill');logo.set_content(phoneWordmark);if(fill&&fill!=='currentColor')logo.querySelector('g')?.setAttribute('color',fill);}

const mark = '<path d="M12 2 21 7v10l-9 5-9-5V7Zm0 4.5L7 9.3v5.4l5 2.8 5-2.8V9.3Z" fill="currentColor" fill-rule="evenodd"/>';
const cookieMark = doc.querySelector('.font-inter svg');
if(cookieMark) { cookieMark.setAttribute('viewBox', '0 0 24 24'); cookieMark.set_content(mark); }
const supportButton = doc.querySelectorAll('button').find((el:any) => el.text.trim() === 'Support');
const supportMark = supportButton?.querySelector('svg');
if(supportMark) { supportMark.setAttribute('viewBox', '0 0 24 24'); supportMark.set_content(mark); }

const security = doc.querySelector('[data-reference-path="0/1/3/5/3/1/0/2/0/1/0"]');
security?.classList.add('au-security-copy');
const sdk = doc.querySelector('[data-reference-path="0/1/3/9/1/0/0/2"]');
sdk?.classList.add('au-sdk-copy');

const shell = doc.querySelector('body')!.children.find((el: any) => el.classList.contains('isolate'))!;
const main = shell.querySelector('main')!;
const names = ['announcement', 'hero', 'customers', 'components', 'authentication', 'notch-auth', 'organizations', 'billing', 'integrations', 'notch-integrations', 'testimonials'];
fs.mkdirSync('components/sections/markup', { recursive: true });
const sections: { name: string; html: string }[] = [];
let i = 0;
for (const child of main.children) {
  if (child.tagName === 'STYLE') continue;
  const name = names[i++] || `block-${i}`;
  child.setAttribute('data-section', name);
  sections.push({ name, html: child.outerHTML });
}
const header = shell.querySelector('header')!;
const footer = shell.querySelector('footer')!;
const overlays = shell.children.filter((e: any) => !['MAIN', 'HEADER', 'FOOTER', 'STYLE'].includes(e.tagName) && !e.classList.contains('sr-only')).map((e: any) => e.outerHTML).join('');
for (const section of [...sections, { name: 'header', html: header.outerHTML }, { name: 'footer', html: footer.outerHTML }, { name: 'overlays', html: overlays }]) {
  const markup=rewrite(section.html);
  fs.writeFileSync(`components/sections/markup/${section.name}.json`, JSON.stringify(section.name==='hero'?markup.replace('user management ,','user management,'):markup));
}
fs.writeFileSync('components/sections/markup/document.json', JSON.stringify({htmlClass:doc.querySelector('html')!.getAttribute('class'),bodyClass:doc.querySelector('body')!.getAttribute('class'),shellClass:shell.getAttribute('class'),sections:names}, null, 2));
let css = rewrite(fs.readFileSync(path.join(base, 'dom/styles.css'), 'utf8'));
const external = path.join(base, fs.existsSync(path.join(base, 'dom/external-base.css')) ? 'dom/external-base.css' : 'dom/external.css');
if (fs.existsSync(external)) {
  const baseCss = rewrite(fs.readFileSync(external, 'utf8'));
  fs.writeFileSync('public/base.css', baseCss);
  css = baseCss + '\n' + css;
}
fs.writeFileSync('public/site.css', css);
const menuFile = 'components/navigation/menus.json';
if (fs.existsSync(menuFile)) {
  const rewriteMenuAssets = (value: unknown): unknown => typeof value === 'string'
    ? rewriteAssetUrls(value)
    : Array.isArray(value) ? value.map(rewriteMenuAssets)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rewriteMenuAssets(entry)]))
    : value;
  fs.writeFileSync(menuFile, JSON.stringify(rewriteMenuAssets(JSON.parse(fs.readFileSync(menuFile, 'utf8'))), null, 2));
}
console.log(`Built ${sections.length} sections and ${assetUrls.size} asset URL mappings.`);
