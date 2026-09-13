// Same capture algorithm as the shared rig, with the input limit disabled for trusted full-page image data.
import sharp from '../../tooling/1to1/node_modules/sharp/lib/index.js';
import {HIDE_FIXED_JS, RESTORE_FIXED_JS} from '../../tooling/1to1/src/lib/browser.ts';

export async function stitchLargePage(page: any, vpW: number, vpH: number, file: string, dsf: number, opts: { chunkWaitMs?: number; wheelNudge?: boolean; background?: string } = {}) {
  const docH = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const parts: { buf: Buffer; top: number }[] = [];
  let hiddenFixed = 0;
  const wait = opts.chunkWaitMs ?? 250;
  for (let y = 0; y < docH; y += vpH) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    if (opts.wheelNudge) {
      await page.mouse.move(vpW / 2, 10);
      await page.mouse.wheel(0, 1);
    }
    await page.waitForTimeout(y === 0 ? Math.max(400, wait) : wait);
    const actual = await page.evaluate(() => scrollY);
    if (y > 0 && !hiddenFixed) {
      hiddenFixed = (await page.evaluate(HIDE_FIXED_JS)) as number;
      await page.waitForTimeout(50);
    }
    const buf = await page.screenshot({ type: 'png', animations: 'allow', caret: 'hide' });
    parts.push({ buf, top: Math.round(actual * dsf) });
  }
  await page.evaluate(RESTORE_FIXED_JS);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const W = Math.round(vpW * dsf);
  const H = Math.round(docH * dsf);
  const comps: sharp.OverlayOptions[] = [];
  for (const p of parts) {
    const ph = Math.round(vpH * dsf);
    if (p.top + ph > H) {
      const keep = H - p.top;
      if (keep <= 0) continue;
      comps.push({ input: await sharp(p.buf, { limitInputPixels: false }).extract({ left: 0, top: 0, width: W, height: keep }).png().toBuffer(), top: p.top, left: 0 });
    } else comps.push({ input: p.buf, top: p.top, left: 0 });
  }
  await sharp({ limitInputPixels: false, create: { width: W, height: H, channels: 4, background: opts.background ?? '#ffffff' } })
    .composite(comps)
    .png()
    .toFile(file);
  return { docH, chunks: parts.length, hiddenFixed };
}
