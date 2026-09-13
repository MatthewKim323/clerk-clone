import fs from 'node:fs';
import { chromium } from '../tooling/1to1/node_modules/playwright/index.mjs';
import sharp from '../tooling/1to1/node_modules/sharp/lib/index.js';
import { runDiff } from '../tooling/1to1/src/rig/diff';

const folder = 'reference/sdk-install-counter-check'; fs.mkdirSync(folder, { recursive: true });
const report: any = { source: 'reference/sdk-installation-total.json', cases: [], errors: [] };
const capture = JSON.parse(fs.readFileSync('reference/site-nextjs-authentication/capture/report.json', 'utf8')).report;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ deviceScaleFactor: 2, reducedMotion: 'no-preference' });
page.on('pageerror', error => report.errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) report.errors.push({ status: response.status(), path: new URL(response.url()).pathname }); });
await page.addInitScript(() => {
  const state = window as any; state.__counterStates = [];
  const observer = new MutationObserver(() => {
    const node = document.querySelector<HTMLElement>('[data-sdk-install-state]'), next = node?.dataset.sdkInstallState;
    if (next && state.__counterStates.at(-1)?.state !== next) state.__counterStates.push({ state: next, time: performance.now() });
  }); observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-sdk-install-state'] });
});
try {
  for (const viewport of ['desktop', 'tablet', 'tablet-810', 'mobile']) {
    const { width, height, docHeight } = capture.viewports[viewport]; await page.setViewportSize({ width, height });
    await page.goto('http://localhost:3781/nextjs-authentication', { waitUntil: 'domcontentloaded' });
    const counter = page.locator('[data-sdk-install-state]'); await counter.waitFor({ state: 'attached', timeout: 30000 }); await counter.scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-sdk-install-state="spinning"]', { timeout: 10000 });
    const moving = await counter.evaluate(node => ({ value: node.querySelector('number-flow-react')?.getAttribute('aria-label'), animations: node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length }));
    await page.waitForSelector('[data-sdk-install-state="complete"]', { timeout: 10000 }); await page.evaluate(() => document.fonts.ready);
    const settled = await counter.evaluate(node => { const rect = node.getBoundingClientRect(); return { label: node.firstElementChild?.textContent, text: node.querySelector('number-flow-react')?.textContent, accessible: node.querySelector('number-flow-react')?.getAttribute('aria-label'), docHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), rect: { x: rect.x, y: rect.y + scrollY, w: rect.width, h: rect.height }, states: (window as any).__counterStates }; });
    const typing = settled.states.find((row: any) => row.state === 'typing'), spinning = settled.states.find((row: any) => row.state === 'spinning'), complete = settled.states.find((row: any) => row.state === 'complete');
    const times = { delay: spinning.time - typing.time, digits: complete.time - spinning.time };
    const sourceRect = JSON.parse(fs.readFileSync(`reference/site-nextjs-authentication/capture/${viewport}/layout.json`, 'utf8')).find((row: any) => row.tag === 'p' && row.className === 'relative isolate mt-8 flex-none sm:mt-0').rect;
    const sizeMatches = ['w', 'h'].every(key => Math.abs(settled.rect[key as 'w' | 'h'] - sourceRect[key]) < .1);
    const output = `${folder}/${viewport}`; fs.mkdirSync(output, { recursive: true });
    await counter.screenshot({ path: `${output}/build.png` });
    await sharp(`reference/site-nextjs-authentication/capture/${viewport}/full.png`).extract({ left: Math.round(sourceRect.x * 2), top: Math.round(sourceRect.y * 2), width: Math.round(sourceRect.w * 2), height: Math.round(sourceRect.h * 2) }).png().toFile(`${output}/reference.png`);
    if (sizeMatches) await runDiff([`${output}/build.png`, `${output}/reference.png`, output]);
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(200); await counter.scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
    const once = await counter.getAttribute('data-sdk-install-state') === 'complete';
    const pass = moving.value === '9,030,790' && moving.animations > 0 && settled.text === '9,030,790' && settled.label === 'npm installs last month' && settled.docHeight === docHeight && Math.abs(times.delay - 1250) < 150 && Math.abs(times.digits - 900) < 150 && sizeMatches && once;
    report.cases.push({ viewport, pass, moving, settled, expectedHeight: docHeight, sourceRect, sizeMatches, once, times }); console.log(JSON.stringify({ viewport, pass, times, height: settled.docHeight, sizeMatches }));
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(350);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForSelector('[data-sdk-hero="retained"]');
  await page.evaluate(() => { const canvas = document.querySelector<HTMLCanvasElement>('[data-sdk-hero]')!; (window as any).__oldSdkHero = { canvas, gl: canvas.getContext('webgl2') }; });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(500); await page.waitForSelector('[data-sdk-hero="retained"]');
  report.resizeCleanup = await page.evaluate(() => { const old = (window as any).__oldSdkHero; return { oldDisconnected: !old.canvas.isConnected, oldContextLost: old.gl.isContextLost(), newCanvas: document.querySelector('[data-sdk-hero]') !== old.canvas, markers: document.querySelectorAll('[data-sdk-hero]').length }; });
  report.resizeCleanup.pass = report.resizeCleanup.oldDisconnected && report.resizeCleanup.oldContextLost && report.resizeCleanup.newCanvas && report.resizeCleanup.markers === 1;
} catch (error) { report.errors.push(String(error)); }
finally { await browser.close(); report.pass = report.cases.length === 4 && report.cases.every((row: any) => row.pass) && report.resizeCleanup?.pass && !report.errors.length; fs.writeFileSync(`${folder}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ done: true, pass: report.pass, errors: report.errors })); }
