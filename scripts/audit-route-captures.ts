// @ts-nocheck
// Checks capture artifacts without opening a browser or modifying application files.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../tooling/1to1/node_modules/node-html-parser';
import sharp from '../tooling/1to1/node_modules/sharp';
import { readOrigin, hasToken } from '../tooling/1to1/src/lib/anon.ts';
import { VIEWPORTS } from '../tooling/1to1/src/lib/browser.ts';

const project = process.cwd();
const reference = path.join(project, 'reference');
const origin = readOrigin(path.join(reference, 'site'))!;
const paths = JSON.parse(fs.readFileSync(path.join(reference, 'site/navigation-routes.json'), 'utf8')).paths;
const routes = [...new Set<string>(paths.map((route: string) => route.split('#')[0]))].filter((route) => route !== '/');
const rows: any[] = [];
const nonAssetUrl = (value: string) => !value.startsWith('/assets/') && !/^(data:|blob:|#|$)/.test(value);
for (const route of routes) {
  const root = path.join(reference, `site-${route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
  const issues: string[] = [];
  const metaFile = path.join(root, 'meta.json');
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : { status: 'missing' };
  const row: any = { route, status: meta.status, widths: 0, assets: 0, modules: 0, issues };
  if (meta.status !== 'complete') { rows.push(row); continue; }
  const report = JSON.parse(fs.readFileSync(path.join(root, 'capture/report.json'), 'utf8')).report;
  for (const vp of VIEWPORTS) {
    const directory = path.join(root, 'capture', vp.name);
    const files = ['full.png', 'layout.json', 'dom.html'];
    const missing = files.filter((file) => !fs.existsSync(path.join(directory, file)));
    if (missing.length) { issues.push(`${vp.name}: missing ${missing.join(', ')}`); continue; }
    row.widths++;
    const png = await sharp(path.join(directory, 'full.png'),{limitInputPixels:false}).metadata();
    if (png.width !== vp.width * 2 || png.height !== report.viewports[vp.name].docHeight * 2) issues.push(`${vp.name}: image dimensions differ from measured layout`);
    const layout = JSON.parse(fs.readFileSync(path.join(directory, 'layout.json'), 'utf8'));
    if (!layout.length) issues.push(`${vp.name}: empty layout`);
  }
  const pageFile = path.join(root, 'supplement/page.json');
  const page = JSON.parse(fs.readFileSync(pageFile, 'utf8'));
  for (const key of ['route', 'title', 'htmlClass', 'bodyClass', 'htmlAttributes', 'bodyAttributes', 'bodyHtml', 'stylesheets', 'css']) if (!(key in page)) issues.push(`page.json: missing ${key}`);
  if (hasToken(JSON.stringify(page), origin.tokens)) issues.push('page.json: origin identifier survived');
  const html = parse(page.bodyHtml);
  if (html.querySelectorAll('script').length) issues.push('page.json: script nodes survived');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/manifest.json'), 'utf8'));
  const assets = new Map(manifest.map((asset: any) => [asset.target, asset]));
  row.assets = manifest.length;
  for (const asset of manifest) if (!fs.existsSync(path.resolve(project, asset.sourcePath))) issues.push(`asset missing: ${asset.file}`);
  const local = [...new Set((page.bodyHtml + '\n' + page.css).match(/\/assets\/[a-zA-Z0-9._-]+/g) || [])];
  for (const target of local) if (!assets.has(target)) issues.push(`unmapped local asset: ${target}`);
  const unresolved = new Set<string>();
  for (const element of html.querySelectorAll('img,video,source,svg image')) for (const attr of ['src', 'poster', 'href', 'xlink:href']) {
    const value = element.getAttribute(attr);
    if (value && nonAssetUrl(value)) unresolved.add(`${element.tagName.toLowerCase()}[${attr}]`);
  }
  for (const element of html.querySelectorAll('[srcset]')) {
    const values = element.getAttribute('srcset') || '';
    if (!values.startsWith('data:') && values.split(',').some((value) => nonAssetUrl(value.trim().split(/\s+/)[0]))) unresolved.add('srcset');
  }
  for (const match of page.css.matchAll(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g)) if (nonAssetUrl(match[2].trim())) unresolved.add('css url');
  if (unresolved.size) issues.push(`unresolved assets: ${[...unresolved].join(', ')}`);
  const moduleFile = path.join(root, 'supplement/modules.json');
  if (fs.existsSync(moduleFile)) {
    const modules = JSON.parse(fs.readFileSync(moduleFile, 'utf8'));
    row.modules = modules.length;
    for (const module of modules) if (!fs.existsSync(path.resolve(project, module.file))) issues.push(`module missing: ${path.basename(module.file)}`);
  } else issues.push('modules.json missing');
  rows.push(row);
}
const moduleDir = path.join(reference, 'route-modules');
const moduleIssues: string[] = [];
if (fs.existsSync(moduleDir)) for (const file of fs.readdirSync(moduleDir)) if (file.endsWith('.js') && hasToken(fs.readFileSync(path.join(moduleDir, file), 'utf8'), origin.tokens)) moduleIssues.push(file);
const summary = { auditedAt: new Date().toISOString(), routeCount: routes.length, complete: rows.filter((row) => row.status === 'complete').length, widths: rows.reduce((sum, row) => sum + row.widths, 0), issueCount: rows.reduce((sum, row) => sum + row.issues.length, moduleIssues.length), moduleIdentifierIssues: moduleIssues, routes: rows };
fs.writeFileSync(path.join(reference, 'routes-artifact-audit.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ routeCount: summary.routeCount, complete: summary.complete, widths: summary.widths, issueCount: summary.issueCount, moduleIdentifierIssues: moduleIssues.length }));
for (const row of rows) if (row.issues.length) console.log(`${row.route}: ${row.issues.join('; ')}`);
