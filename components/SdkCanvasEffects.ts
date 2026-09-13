'use client';

import { animate } from 'motion';
import { sdkDots } from './SdkExpoTour';
import { sourceDots, type DotOptions } from './MarketingMotion';

type Stop = () => void;
type Shader = { parents: string[]; config: DotOptions };
type Meteor = { width: number; height: number; path: string; repeat: number; delay?: number };
export type SdkCanvasData = {
  nextQuickstart: DotOptions;
  nextShaders: Shader[];
  reactShaders: Shader[];
  reactLogos: { name: string; href: string; colors: number[][] }[];
  reactLogoDots: DotOptions;
  reactMeteors: { parents: string[]; meteors: Meteor[] };
};

// Native HeroDots keeps the renderer mounted. Pausing skips draws while its wall clock advances.
export function sdkHeroDots(canvas: HTMLCanvasElement, config: DotOptions): Stop {
  let stop: Stop | undefined, cancelIdle: Stop | undefined, disposed = false;
  const observer = new IntersectionObserver(([entry]) => {
    cancelIdle?.(); cancelIdle = undefined;
    if (!entry.isIntersecting || stop) return;
    const mount = () => { if (disposed) return; stop = sourceDots(canvas, config); canvas.dataset.sdkHero = 'retained'; };
    if ('requestIdleCallback' in globalThis) { const idle = requestIdleCallback(mount); cancelIdle = () => cancelIdleCallback(idle); }
    else { const timer = window.setTimeout(mount, 0); cancelIdle = () => clearTimeout(timer); }
  });
  observer.observe(canvas.parentElement || canvas);
  return () => { disposed = true; cancelIdle?.(); observer.disconnect(); stop?.(); delete canvas.dataset.sdkHero; };
}

function mountCanvas(parent: HTMLElement, options: DotOptions): [HTMLCanvasElement, Stop] {
  const existing = parent.querySelector<HTMLCanvasElement>(':scope > canvas'), canvas = existing || document.createElement('canvas');
  if (!existing) { canvas.className = 'mm-canvas'; canvas.setAttribute('aria-hidden', 'true'); parent.append(canvas); }
  const stop = sdkDots(canvas, options);
  return [canvas, () => { stop(); if (!existing) canvas.remove(); }];
}

function serverShaders(root: HTMLElement, entries: Shader[]): Stop {
  const cleanups: Stop[] = [], claimed = new Set<HTMLElement>();
  for (const entry of entries) {
    const parent = Array.from(root.querySelectorAll<HTMLElement>('div')).find(node => !claimed.has(node) && node.className === entry.parents.at(-1) && (!entry.parents.at(-2) || node.parentElement?.className === entry.parents.at(-2)));
    if (!parent) continue;
    claimed.add(parent); parent.dataset.sdkDivider = ''; cleanups.push(mountCanvas(parent, entry.config)[1], () => { delete parent.dataset.sdkDivider; });
  }
  return () => cleanups.forEach(stop => stop());
}

function quickstart(root: HTMLElement, config: DotOptions): Stop {
  const card = Array.from(root.querySelectorAll<HTMLElement>('div')).find(node => node.className === 'relative isolate overflow-hidden rounded-xl bg-blue-700 px-6 pt-1 pb-6');
  const parent = card && Array.from(card.querySelectorAll<HTMLElement>('div')).find(node => node.className === 'relative size-[8.75rem]');
  if (!card || !parent) return () => {};
  const [canvas, stop] = mountCanvas(parent, config);
  const enter = () => { if (matchMedia('(hover: hover) and (pointer: fine)').matches) { canvas.dispatchEvent(new CustomEvent('aurora:marketing-slide', { detail: { index: 0, direction: 1 } })); card.dataset.sdkQuickstartEvents = String(Number(card.dataset.sdkQuickstartEvents || 0) + 1); } };
  card.dataset.sdkQuickstart = ''; card.addEventListener('pointerenter', enter);
  return () => { card.removeEventListener('pointerenter', enter); stop(); delete card.dataset.sdkQuickstart; delete card.dataset.sdkQuickstartEvents; };
}

function logoDots(root: HTMLElement, config: SdkCanvasData): Stop {
  const cleanups: Stop[] = []; let zIndex = 0;
  for (const entry of config.reactLogos) {
    const link = Array.from(root.querySelectorAll<HTMLAnchorElement>('a')).find(node => node.getAttribute('href') === entry.href && node.className.includes('--dots-border'));
    if (!link) continue;
    let layer: HTMLDivElement | undefined, stop: Stop | undefined, exit: ReturnType<typeof animate> | undefined;
    const initial = link.getAttribute('style'), remove = () => { exit?.stop(); stop?.(); layer?.remove(); layer = undefined; stop = undefined; };
    const show = () => {
      remove(); layer = document.createElement('div'); layer.className = 'absolute inset-0.5'; layer.dataset.sdkLogoDots = entry.name;
      const canvas = document.createElement('canvas'); canvas.className = 'mm-canvas'; canvas.setAttribute('aria-hidden', 'true'); layer.append(canvas); link.prepend(layer);
      link.style.zIndex = String(++zIndex); link.style.setProperty('--focus-z', String(zIndex + 1)); link.style.borderColor = 'var(--dots-border-active,var(--color-gray-700))';
      stop = sourceDots(canvas, { ...config.reactLogoDots, colors: entry.colors });
    };
    const hide = () => {
      link.style.zIndex = '0'; link.style.borderColor = 'var(--dots-border,var(--color-gray-800))';
      if (!layer) return; const leaving = layer, cleanup = stop;
      exit = animate(leaving, { opacity: 0 }, { duration: .3 }); void exit.then(() => { cleanup?.(); leaving.remove(); if (layer === leaving) { layer = undefined; stop = undefined; } });
    };
    const hover = () => { if (matchMedia('(hover: hover) and (pointer: fine)').matches) show(); };
    link.addEventListener('pointerenter', hover); link.addEventListener('pointerleave', hide); link.addEventListener('focus', show); link.addEventListener('blur', hide);
    cleanups.push(() => { remove(); link.removeEventListener('pointerenter', hover); link.removeEventListener('pointerleave', hide); link.removeEventListener('focus', show); link.removeEventListener('blur', hide); if (initial === null) link.removeAttribute('style'); else link.setAttribute('style', initial); });
  }
  return () => cleanups.forEach(stop => stop());
}

function meteors(root: HTMLElement, config: SdkCanvasData['reactMeteors']): Stop {
  const parent = Array.from(root.querySelectorAll<HTMLElement>('div')).find(node => node.className === config.parents.at(-1) && node.parentElement?.className === config.parents.at(-2));
  if (!parent || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const previous = parent.querySelector<HTMLCanvasElement>(':scope > canvas'), canvas = previous || document.createElement('canvas');
  if (!previous) { canvas.className = 'mm-canvas'; canvas.setAttribute('aria-hidden', 'true'); parent.append(canvas); }
  const ctx = canvas.getContext('2d'); if (!ctx) return () => { if (!previous) canvas.remove(); };
  const paths = config.meteors.map(entry => { const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', entry.path); return path; });
  const sprite = new Image(); sprite.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAMAAAC67D+PAAAAAXNSR0IArs4c6QAAAEhQTFRFAAAA////AP//AAD/AP//gID/AP//AKr/AL//ANX/AKr/ALb/AN//AL//AMb/AMbjAMz/ANH/ALnoANj/AMj/AMjtANX/AMn/G8447gAAABh0Uk5TAAEBAQICAwMEBgYHCAgJCQoLCw0ODhITA3IuUQAAAEdJREFUeNoNycENwzAMBMFdkgmQ/qs1IPHi+Q4qIioMnfXQNdPfD5KJ/op+cgrHeg8rRONSI3vI7t321i7Pngh21blEDCDwB0UUHis/7NTIAAAAAElFTkSuQmCC';
  let raf = 0, elapsed = 0, started = 0, visible = false, width = 0, height = 0;
  const measure = () => { const dpr = Math.max(1, Math.min(devicePixelRatio, 2)); width = canvas.offsetWidth; height = canvas.offsetHeight; canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const color = (p: number) => { const t = p <= .5 ? 0 : (p - .5) * 2; return `rgba(${Math.round(Math.sqrt((1 - t) * 108 ** 2 + t * 93 ** 2))},${Math.round(Math.sqrt((1 - t) * 71 ** 2 + t * 227 ** 2))},255,${Math.min(p * 2, 1)})`; };
  const draw = (now: number) => {
    if (!visible) return;
    const clock = elapsed + now - started; ctx.clearRect(0, 0, width, height);
    if (sprite.complete) config.meteors.forEach((entry, index) => {
      const path = paths[index], scale = width / entry.width, length = path.getTotalLength(), cycle = Math.max(0, (clock - (entry.delay || 0)) % entry.repeat);
      if (!cycle) return; const tail = -72.5 + cycle * .3 * scale; if (tail > length) return;
      ctx.save(); ctx.scale(scale, height / entry.height); ctx.beginPath();
      for (let i = 0; i < 20; i++) { const distance = (i + 1) * 1.25 + i * 2.5 + tail; if (distance < 0 || distance > length) continue; const point = path.getPointAtLength(distance + .625); ctx.drawImage(sprite, point.x - 1.25, point.y - 1.25, 2.5, 2.5); }
      const from = path.getPointAtLength(Math.max(0, tail)), to = path.getPointAtLength(Math.min(length, tail + 72.5));
      ctx.rect(Math.min(from.x, to.x) - 16, Math.min(from.y, to.y) - 16, Math.abs(from.x - to.x) + 32, Math.abs(from.y - to.y) + 32);
      const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y); gradient.addColorStop(0, 'rgb(108 71 255 / 0)'); gradient.addColorStop(.5, 'rgb(108 71 255)'); gradient.addColorStop(1, 'rgb(93 227 255)');
      ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = gradient; ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      const drawing = new Path2D(entry.path);
      for (let i = 0; i < 20; i++) { const distance = (i + 1) * 1.25 + i * 2.5 + tail; if (distance < 0 || distance > length) continue; ctx.strokeStyle = color((i + 1) / 20); ctx.lineWidth = 1.25; ctx.setLineDash([0, distance, 1.25, 999999]); ctx.stroke(drawing); }
      ctx.restore();
    });
    raf = requestAnimationFrame(draw);
  };
  const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting === visible) return; if (visible) elapsed += performance.now() - started; visible = entry.isIntersecting; cancelAnimationFrame(raf); if (visible) { started = performance.now(); raf = requestAnimationFrame(draw); } });
  const resize = new ResizeObserver(measure); resize.observe(parent); measure(); observer.observe(parent); parent.dataset.sdkMeteors = String(config.meteors.length);
  return () => { cancelAnimationFrame(raf); observer.disconnect(); resize.disconnect(); ctx.clearRect(0, 0, width, height); if (!previous) canvas.remove(); delete parent.dataset.sdkMeteors; };
}

export function sdkCanvasEffects(root: HTMLElement, route: string, data: SdkCanvasData): Stop {
  const stops = route === '/nextjs-authentication' ? [quickstart(root, data.nextQuickstart), serverShaders(root, data.nextShaders)] : [logoDots(root, data), meteors(root, data.reactMeteors), serverShaders(root, data.reactShaders)];
  return () => stops.forEach(stop => stop());
}
