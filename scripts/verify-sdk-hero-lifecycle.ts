import fs from 'node:fs';
import { chromium } from '../tooling/1to1/node_modules/playwright/index.mjs';
import sharp from '../tooling/1to1/node_modules/sharp/lib/index.js';
import { runDiff } from '../tooling/1to1/src/rig/diff';

const directory = 'reference/sdk-hero-lifecycle';
fs.mkdirSync(directory, { recursive: true });
const result: any = { nativeClock: 'Pause suppresses rendering but retains the initial time origin. Resume advances by the elapsed hidden interval.', checks: [], errors: [] };
const nativeThemes = JSON.parse(fs.readFileSync('content/header-themes.json', 'utf8'));
const nativeDefaults = JSON.parse(fs.readFileSync('content/header-theme-defaults.json', 'utf8'));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ deviceScaleFactor: 2, reducedMotion: 'no-preference' });
const page = await context.newPage();
page.on('pageerror', error => result.errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) result.errors.push({ status: response.status(), path: new URL(response.url()).pathname }); });
const sample = () => page.evaluate(() => {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-sdk-hero="retained"]');
  const gl = canvas?.getContext('webgl2');
  const state = window as any;
  if (!state.__sdkHero && canvas && gl) state.__sdkHero = { canvas, gl };
  const program = gl?.getParameter(gl.CURRENT_PROGRAM);
  return { canvas: !!canvas, sameCanvas: canvas === state.__sdkHero?.canvas, sameContext: gl === state.__sdkHero?.gl, lost: gl?.isContextLost(), time: gl && program ? gl.getUniform(program, gl.getUniformLocation(program, 'u_time')) : null };
});
try {
  for (const slug of ['react', 'nextjs']) {
    const reference = `reference/site-${slug}-authentication`, route = `/${slug}-authentication`;
    const report = JSON.parse(fs.readFileSync(`${reference}/capture/report.json`, 'utf8')).report;
    for (const viewport of ['desktop', 'tablet', 'tablet-810', 'mobile']) {
      const { width, height } = report.viewports[viewport];
      const hero = report.sections[viewport][0], heroHeight = hero.y + hero.h;
      await page.setViewportSize({ width, height });
      await page.goto('http://localhost:3781' + route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('canvas[data-sdk-hero="retained"]', { timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      const initial = await sample();
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
      const hidden = await sample(); await page.waitForTimeout(4300); const paused = await sample();
      const footerHeader = await page.locator('#header').evaluate(node => node.classList.contains('dark') ? 'dark' : 'light');
      if (slug === 'react' && viewport === 'mobile') await page.screenshot({ path: `${directory}/react-mobile-footer.png` });
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(350); const resumed = await sample();
      const geometry = await page.evaluate(() => { const rect = document.querySelector('[data-sdk-hero]')!.getBoundingClientRect(); return { docHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), rect: { x: rect.x, y: rect.y + scrollY, w: rect.width, h: rect.height } }; });
      const sourceRect = JSON.parse(fs.readFileSync(`${reference}/capture/${viewport}/layout.json`, 'utf8')).find((row: any) => row.tag === 'canvas').rect;
      const geometryPass = geometry.docHeight === report.viewports[viewport].docHeight && Object.entries(sourceRect).every(([key, value]) => Math.abs(geometry.rect[key as keyof typeof geometry.rect] - Number(value)) < .06);
      const check = { route, viewport, initial, hidden, paused, resumed, footerHeader, geometry: { ...geometry, expectedHeight: report.viewports[viewport].docHeight, sourceRect, pass: geometryPass }, pass: initial.canvas && hidden.sameCanvas && paused.sameContext && !paused.lost && hidden.time === paused.time && resumed.time >= hidden.time + 4 && resumed.sameCanvas && resumed.sameContext && geometryPass && (slug !== 'react' || viewport !== 'mobile' || footerHeader === 'dark') };
      const folder = `${directory}/${slug}/${viewport}`; fs.mkdirSync(folder, { recursive: true });
      const buildFile = `${folder}/hero-build.png`, referenceFile = `${folder}/hero-reference.png`;
      await page.screenshot({ path: buildFile, clip: { x: 0, y: 0, width, height: heroHeight }, animations: 'allow' });
      await sharp(`${reference}/capture/${viewport}/full.png`).extract({ left: 0, top: 0, width: width * 2, height: Math.round(heroHeight * 2) }).png().toFile(referenceFile);
      await runDiff([buildFile, referenceFile, folder, '--ranges', JSON.stringify([['hero', 0, heroHeight]])]);
      const diff = JSON.parse(fs.readFileSync(`${folder}/diff.json`, 'utf8'));
      const positions = await page.evaluate((native: any[]) => [...new Set([0, document.body.scrollHeight, ...native.flatMap(({ match }) => Array.from(document.querySelectorAll<HTMLElement>(match.tag)).filter(node => node.className === match.className).flatMap(node => { const rect = node.getBoundingClientRect(); return [Math.max(0, rect.top + scrollY - 80), rect.top + scrollY + 4, rect.bottom + scrollY - 60]; }))])], nativeThemes[route]);
      const headers = [];
      for (const y of positions) {
        await page.evaluate((position: number) => scrollTo(0, position), y); await page.waitForTimeout(110);
        headers.push(await page.evaluate(({ native, fallback }: any) => {
          let best = -Infinity, expected = fallback, registrations = true;
          for (const { theme, match } of native) {
            const nodes = Array.from(document.querySelectorAll<HTMLElement>(match.tag)).filter(node => node.className === match.className);
            registrations &&= nodes.length === 1 && nodes[0].dataset.headerTheme === theme;
            for (const node of nodes) { const rect = node.getBoundingClientRect(); if (rect.top <= 64 && rect.bottom > 64 && rect.top > best) { best = rect.top; expected = theme; } }
          }
          const actual = document.querySelector('#header')?.classList.contains('dark') ? 'dark' : 'light';
          return { scroll: scrollY, actual, expected, pass: registrations && actual === expected };
        }, { native: nativeThemes[route], fallback: nativeDefaults[route] }));
      }
      await page.locator('#header a[href="/"]').first().click(); await page.waitForURL('http://localhost:3781/'); await page.waitForTimeout(200);
      const cleanup = await page.evaluate(() => { const saved = (window as any).__sdkHero; return { documentReplaced: !saved, disconnected: !saved?.canvas.isConnected, contextLost: saved?.gl.isContextLost() ?? null, markerCount: document.querySelectorAll('[data-sdk-hero]').length }; });
      check.pass &&= cleanup.disconnected && (cleanup.documentReplaced || cleanup.contextLost) && cleanup.markerCount === 0 && headers.every(row => row.pass);
      result.checks.push({ ...check, cleanup, headers, diff }); fs.writeFileSync(`${directory}/report.json`, JSON.stringify(result, null, 2));
      console.log(JSON.stringify({ route, viewport, pass: check.pass, initialTime: initial.time, hiddenTime: paused.time, resumedTime: resumed.time, difference: diff[0]?.differ }));
    }
  }
} catch (error) { result.errors.push(String(error)); }
finally { await browser.close(); result.pass = result.checks.length === 8 && result.checks.every((row: any) => row.pass) && !result.errors.length; fs.writeFileSync(`${directory}/report.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify({ done: true, pass: result.pass, errors: result.errors })); }
