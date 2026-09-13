// @ts-nocheck
// Expands public documentation controls through the extraction browser.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { BrowserPool, newCtx, load, closeCtx, VIEWPORTS } from '../tooling/1to1/src/lib/browser.ts';
import { readOrigin, scrubSource } from '../tooling/1to1/src/lib/anon.ts';

const project = process.cwd();
const root = path.join(project, 'reference/site-docs');
const origin = readOrigin(root)!;
if (!origin) throw new Error('The documentation origin metadata is required.');
const clean = (value: string) => scrubSource(value, origin.tokens, origin.brand, origin.host).replace(/[\u2013\u2014]/g, '-');
const directory = path.join(root, 'supplement');
fs.mkdirSync(directory, { recursive: true });
const pool = new BrowserPool(true);
const context = await newCtx(await pool.get(), VIEWPORTS[0], 1);
const page = await context.newPage();
page.setDefaultTimeout(10000);
const modules: { file: string; bytes: number }[] = [];
const pending: Promise<void>[] = [];
context.on('response', (response: any) => {
  if (response.status() !== 200 || !/\/_next\/.*\.js(?:\?|$)/.test(response.url())) return;
  pending.push((async () => {
    try {
      const code = clean((await response.body()).toString());
      const filename = `module-${createHash('sha256').update(code).digest('hex').slice(0, 16)}.js`;
      const full = path.join(project, 'reference/route-modules', filename);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      if (!fs.existsSync(full)) fs.writeFileSync(full, code);
      modules.push({ file: path.relative(project, full), bytes: Buffer.byteLength(code) });
    } catch {}
  })());
});

try {
  await load(page, origin.url, 900);
  await page.locator('nav[aria-label="Documentation"]').waitFor();
  const props = await page.locator('script:not([src])').evaluateAll((scripts: HTMLScriptElement[]) => scripts.map((script) => script.textContent || '').filter((value) => value.includes('__next_f')));
  fs.writeFileSync(path.join(directory, 'page-props.js'), clean(props.join('\n')));
  const opened: string[] = [];
  for (let iteration = 0; iteration < 250; iteration++) {
    const button = page.locator('nav[aria-label="Documentation"] button[aria-controls^="nav-"][aria-expanded="false"]').first();
    if (!await button.count()) break;
    const label = (await button.innerText()).trim();
    await button.click();
    await page.waitForTimeout(130);
    opened.push(clean(label));
    if (iteration % 25 === 24) console.log(`Documentation sidebar expanded ${opened.length} groups.`);
  }
  const result = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Documentation"]')!;
    const labelOf = (node: Element) => (node.textContent || '').trim().replace(/\s+/g, ' ');
    const groups = [...nav.querySelectorAll<HTMLButtonElement>('button[aria-controls^="nav-"]')].map((button) => {
      const parents: string[] = [];
      let ancestor = button.parentElement?.parentElement?.closest('li');
      while (ancestor) {
        const control = [...ancestor.children].find((child) => child.tagName === 'BUTTON');
        if (control) parents.unshift(labelOf(control));
        ancestor = ancestor.parentElement?.closest('li');
      }
      const controlId = button.getAttribute('aria-controls')!;
      const target = document.getElementById(controlId);
      return { key: [...parents, labelOf(button)].join(' / '), parents, label: labelOf(button), controlId, html: target?.outerHTML || '', links: [...(target?.querySelectorAll<HTMLAnchorElement>('a[href]') || [])].map((a) => ({ text: labelOf(a), href: a.getAttribute('href') })) };
    });
    return { html: nav.outerHTML, groups, links: [...nav.querySelectorAll<HTMLAnchorElement>('a[href]')].map((a) => ({ text: labelOf(a), href: a.getAttribute('href') })), remainingCollapsed: nav.querySelectorAll('button[aria-controls^="nav-"][aria-expanded="false"]').length };
  });
  fs.writeFileSync(path.join(directory, 'sidebar-expanded.html'), clean(result.html));
  fs.writeFileSync(path.join(directory, 'sidebar-expanded.json'), clean(JSON.stringify({ capturedAt: new Date().toISOString(), route: '/docs', opened, ...result }, null, 2)));
  console.log(`Documentation sidebar: ${result.groups.length} groups, ${result.links.length} links, ${result.remainingCollapsed} collapsed.`);
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page, origin.url, 900);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.waitForTimeout(350);
  const mobile = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Close navigation"]') || document.querySelector<HTMLButtonElement>('button[aria-label="Open navigation"]');
    const target = button && document.getElementById(button.getAttribute('aria-controls') || '');
    return { button: button?.outerHTML || '', html: target?.outerHTML || '', nav: document.querySelector('nav[aria-label="Documentation"]')?.outerHTML || '' };
  });
  fs.writeFileSync(path.join(directory, 'sidebar-mobile.json'), clean(JSON.stringify(mobile, null, 2)));
  await Promise.allSettled(pending);
  const manifestFile = path.join(directory, 'modules.json');
  const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : [];
  fs.writeFileSync(manifestFile, JSON.stringify([...new Map([...previous, ...modules].map((record) => [record.file, record])).values()], null, 2));
} finally {
  await closeCtx(context, 3000);
  await pool.close();
}
