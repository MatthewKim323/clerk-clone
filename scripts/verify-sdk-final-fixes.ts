import fs from 'node:fs';
import { chromium } from '../tooling/1to1/node_modules/playwright/index.mjs';
import sharp from '../tooling/1to1/node_modules/sharp/lib/index.js';

const output = 'reference/sdk-final-fixes';
fs.mkdirSync(output, { recursive: true });
const bindings = JSON.parse(fs.readFileSync('content/header-themes.json', 'utf8'));
const defaults = JSON.parse(fs.readFileSync('content/header-theme-defaults.json', 'utf8'));
const report: any = { header: [], effects: [], errors: [] };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) report.errors.push({ status: response.status(), path: new URL(response.url()).pathname }); });
const wait = (ms: number) => page.waitForTimeout(ms);
const check = (name: string, pass: boolean, detail: unknown = {}) => { report.effects.push({ name, pass, detail }); console.log(JSON.stringify({ name, pass, detail })); };

try {
  for (const route of ['/nextjs-authentication', '/react-authentication', '/expo-authentication']) {
    for (const width of [1440, 1024, 810, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://localhost:3781' + route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('main[data-sdk-page]', { timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      const points = await page.evaluate((native: any[]) => {
        const matches = native.map(({ theme, match }) => {
          const nodes = Array.from(document.querySelectorAll<HTMLElement>(match.tag)).filter(node => node.className === match.className);
          return { theme, nodes: nodes.map(node => ({ top: node.getBoundingClientRect().top + scrollY, bottom: node.getBoundingClientRect().bottom + scrollY, registered: node.dataset.headerTheme })) };
        });
        return { matches, positions: [...new Set([0, ...matches.flatMap(item => item.nodes.flatMap(node => [Math.max(0, node.top - 80), node.top + 4, node.bottom - 60]))])] };
      }, bindings[route]);
      const transitions = [];
      for (const position of points.positions) {
        await page.evaluate((y: number) => scrollTo(0, y), position); await wait(110);
        transitions.push(await page.evaluate(({ native, fallback }: any) => {
          let best = -Infinity, expected = fallback;
          for (const { theme, match } of native) for (const node of document.querySelectorAll<HTMLElement>(match.tag)) {
            if (node.className !== match.className) continue;
            const rect = node.getBoundingClientRect(); if (rect.top <= 64 && rect.bottom > 64 && rect.top > best) { best = rect.top; expected = theme; }
          }
          const actual = document.querySelector('#header')?.classList.contains('dark') ? 'dark' : 'light';
          return { scroll: scrollY, expected: expected === 'dark' ? 'dark' : 'light', actual, pass: actual === (expected === 'dark' ? 'dark' : 'light') };
        }, { native: bindings[route], fallback: defaults[route] }));
      }
      const pass = points.matches.every((item: any) => item.nodes.length === 1 && item.nodes[0].registered === item.theme) && transitions.every((row: any) => row.pass);
      report.header.push({ route, width, pass, matches: points.matches, transitions }); console.log(JSON.stringify({ route, width, header: pass }));
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3781/nextjs-authentication', { waitUntil: 'networkidle' });
  await page.waitForSelector('main[data-sdk-page]');
  const quickstart = page.locator('[data-sdk-quickstart]');
  await quickstart.scrollIntoViewIfNeeded(); await wait(400);
  const quickCanvas = quickstart.locator('canvas[data-sdk-shader="active"]');
  const rest = await quickCanvas.screenshot({ path: `${output}/next-quickstart-rest.png` });
  const raw = await sharp(rest).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); let bright = 0;
  for (let index = 0; index < raw.data.length; index += 4) if (raw.data[index] > 150 && raw.data[index + 1] > 150 && raw.data[index + 2] > 180) bright++;
  check('Next quickstart N renders visible white dots', bright > 100, { brightPixels: bright });
  await quickstart.hover(); await wait(560);
  const hover = await quickCanvas.screenshot({ path: `${output}/next-quickstart-hover.png` });
  await wait(900); await quickCanvas.screenshot({ path: `${output}/next-quickstart-settled.png` });
  check('Next quickstart native hover fires and changes mask', await quickstart.getAttribute('data-sdk-quickstart-events') === '1' && !rest.equals(hover));
  await page.mouse.move(0, 0); await wait(100);
  check('Next quickstart leave does not fire', await quickstart.getAttribute('data-sdk-quickstart-events') === '1');

  await page.goto('http://localhost:3781/react-authentication', { waitUntil: 'networkidle' }); await page.waitForSelector('main[data-sdk-page]');
  const key = page.locator('[data-animate="group"]'); await key.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0); await wait(300);
  const keyBefore = await key.evaluate(node => getComputedStyle(node).transform);
  await key.locator('xpath=../..').hover(); await wait(130); const keyDuring = await key.evaluate(node => getComputedStyle(node).transform); await wait(1000);
  check('React keyring hover moves and returns', keyBefore !== keyDuring && await key.evaluate(node => getComputedStyle(node).transform) === keyBefore, { before: keyBefore, during: keyDuring });
  const line = page.locator('[data-line]').first(); const before = await line.evaluate(node => getComputedStyle(node).transform); await wait(350); const during = await line.evaluate(node => getComputedStyle(node).transform);
  check('React shield lines animate', before !== during, { count: await page.locator('[data-line]').count(), before, during });
  await page.evaluate(() => scrollTo(0, 0)); await wait(250); const paused = await line.evaluate(node => getComputedStyle(node).transform); await wait(350);
  check('React shield pauses offscreen', paused === await line.evaluate(node => getComputedStyle(node).transform));
  const logo = page.locator('a[href="/docs/nextjs/getting-started/quickstart"]').filter({ has: page.locator('img') }).last();
  await logo.scrollIntoViewIfNeeded(); await logo.hover(); await wait(350);
  check('React framework hover mounts shader', await logo.locator('[data-sdk-logo-dots] canvas').count() === 1);
  await page.mouse.move(0, 0); await wait(400); check('React framework leave removes shader', await logo.locator('[data-sdk-logo-dots] canvas').count() === 0);
  const meteor = page.locator('[data-sdk-meteors]'); await meteor.scrollIntoViewIfNeeded(); await wait(900); const meteorOne = await meteor.locator('canvas').screenshot(); await wait(300); const meteorTwo = await meteor.locator('canvas').screenshot();
  check('React five native meteors draw changing frames', await meteor.getAttribute('data-sdk-meteors') === '5' && !meteorOne.equals(meteorTwo));
  await page.locator('#header a[href="/"]').first().click(); await page.waitForURL('http://localhost:3781/'); await wait(350);
  check('SDK cleanup after local navigation', await page.locator('[data-sdk-page],[data-sdk-logo-dots],[data-sdk-meteors],[data-sdk-quickstart]').count() === 0);
} catch (error) { report.errors.push(String(error)); }
finally { await browser.close(); report.pass = report.errors.length === 0 && report.header.every((row: any) => row.pass) && report.effects.every((row: any) => row.pass); fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ done: true, pass: report.pass, errors: report.errors })); }
