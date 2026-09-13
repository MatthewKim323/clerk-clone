'use client';

import { animate, motionValue, type AnimationSequence, type MotionValue } from 'motion';
import { sourceDots, type DotOptions } from './MarketingMotion';

type Stop = () => void;
type NativeValue = { _motion?: number; _transform?: number; initial: string | number };
type Variant = {
  tabs: { name: string; description: string; docs: string }[];
  sequences: unknown[][][];
  starts: number[]; duration: number; endFractions: number[];
  motionValues: Record<string, Record<string, NativeValue>>;
  bindings: { platform: string; page: string; style: Record<string, NativeValue | number> }[];
  shaders: DotOptions[];
  shaderBindings: { platform: string; page: string; className: string; containerClass: string; index: number; shader: number }[];
};
export type ExpoTourData = { normal: Variant; reduced: Variant };

export function sdkDots(canvas: HTMLCanvasElement, config: DotOptions): Stop {
  let current: HTMLCanvasElement | undefined, stop: Stop | undefined;
  const uniforms = new Map<string, { name: string; value: number; type?: string }>();
  const uniform = (event: Event) => { const detail = (event as CustomEvent).detail; uniforms.set(detail.name, detail); current?.dispatchEvent(new CustomEvent('aurora:shader-uniform', { detail })); };
  const change = (event: Event) => current?.dispatchEvent(new CustomEvent('aurora:marketing-slide', { detail: (event as CustomEvent).detail }));
  canvas.addEventListener('aurora:shader-uniform', uniform); canvas.addEventListener('aurora:marketing-slide', change);
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !current) {
      current = canvas.cloneNode(false) as HTMLCanvasElement; current.dataset.sdkShader = 'active'; canvas.replaceWith(current); stop = sourceDots(current, config);
      uniforms.forEach(detail => current!.dispatchEvent(new CustomEvent('aurora:shader-uniform', { detail })));
    } else if (!entry.isIntersecting && current) { stop?.(); current.replaceWith(canvas); current = undefined; stop = undefined; }
  }, { rootMargin: '100px' });
  observer.observe(canvas.parentElement || canvas);
  return () => { observer.disconnect(); stop?.(); current?.replaceWith(canvas); canvas.removeEventListener('aurora:shader-uniform', uniform); canvas.removeEventListener('aurora:marketing-slide', change); };
}

export function expoTour(root: HTMLElement, data: ExpoTourData): Stop {
  const host = root.querySelector<HTMLElement>('[aria-label="Example of app login using Expo auth UI"]'), section = host?.parentElement;
  if (!host || !section) return () => {};
  const cleanups: Stop[] = [], reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, native = reduced ? data.reduced : data.normal;
  const tabs = native.tabs.map(tab => Array.from(section.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === tab.name)!);
  if (tabs.some(tab => !tab)) return () => {};
  section.dataset.sdkControl = ''; host.dataset.sdkTour = 'expo';
  cleanups.push(() => { delete section.dataset.sdkControl; delete host.dataset.sdkTour; });
  const values = new Map<number, MotionValue<string | number>>();
  const value = (entry: NativeValue) => { const id = entry._motion ?? entry._transform!; if (!values.has(id)) values.set(id, motionValue(entry.initial)); return values.get(id)!; };
  Object.values(native.motionValues).forEach(group => Object.values(group).forEach(value));
  native.bindings.forEach(binding => {
    const layer = host.querySelector<HTMLElement>(`[data-platform="${binding.platform}"] [data-page="${binding.page}"]`); if (!layer) return;
    Object.entries(binding.style).forEach(([key, entry]) => {
      if (typeof entry === 'number') { layer.style.setProperty(key.replace(/[A-Z]/g, char => '-' + char.toLowerCase()), String(entry)); return; }
      const state = value(entry), apply = (current: string | number) => {
        if (key === 'display') layer.style.display = Number(current) > 0 ? 'flex' : 'none';
        else if (key === 'x') layer.style.transform = `translateX(${current})`;
        else layer.style.setProperty(key, String(current));
      };
      cleanups.push(state.on('change', apply)); apply(state.get());
    });
  });
  native.shaderBindings.forEach(binding => {
    const layer = host.querySelector<HTMLElement>(`[data-platform="${binding.platform}"] [data-page="${binding.page}"]`);
    let parent = layer && Array.from(layer.querySelectorAll<HTMLElement>('div')).filter(node => node.className === binding.className)[binding.index];
    if (!parent && layer) { const container = Array.from(layer.querySelectorAll<HTMLElement>('div')).find(node => node.className === binding.containerClass); if (container) { parent = document.createElement('div'); parent.className = binding.className; container.append(parent); const added = parent; cleanups.push(() => added.remove()); } }
    if (!parent) return;
    let canvas = parent.querySelector<HTMLCanvasElement>(':scope > canvas');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'mm-canvas'; parent.append(canvas); const added = canvas; cleanups.push(() => added.remove()); }
    cleanups.push(sdkDots(canvas, native.shaders[binding.shader]));
  });
  const gap = host.querySelector<HTMLElement>('[class="absolute inset-x-0 inset-y-12"]'), gapCanvas = gap?.querySelector<HTMLCanvasElement>('canvas');
  if (gapCanvas) cleanups.push(sdkDots(gapCanvas, { totalSize: 3, dotSize: 1, colors: [[255, 255, 255]], opacities: [.04, .06, .12, .12, .16, .24, .24, .32, .32, .4], maxFps: 15 }));
  const outline = host.querySelector<SVGSVGElement>(':scope > div > svg'), paths = outline?.querySelectorAll<SVGPathElement>(':scope > path'), progress = motionValue(0), initialize = motionValue(0);
  const phoneGrid = host.querySelector<HTMLElement>('[class*="grid-cols-[1fr_var(--gap)_1fr]"]');
  if (outline && paths && phoneGrid) {
    const phones = Array.from(phoneGrid.children).filter(node => node.querySelector('[data-platform]')) as HTMLElement[];
    const phoneGap = phones[0]?.nextElementSibling as HTMLElement | null;
    const measure = () => {
      if (phones.length !== 2 || !phoneGap) return;
      const padding = matchMedia('(min-width:640px)').matches ? 7.5 : 5, border = padding + 10;
      const bb = phoneGrid.getBoundingClientRect(), gapWidth = phoneGap.getBoundingClientRect().width;
      const radii = phones.map(phone => (parseFloat(getComputedStyle(phone.firstElementChild!).borderRadius) || 0) + padding);
      const [r1, r2] = radii, width = bb.width + border * 2, height = bb.height + border * 2;
      const bottom = height - 10, right = width - 10, radius = Math.max(r1, r2), leftEnd = border + (bb.width - gapWidth) / 2 + padding, rightStart = leftEnd + gapWidth - 2 * padding;
      const d = `M ${rightStart} ${10 + radius} L ${rightStart} ${10 + r2} A ${r2} ${r2} 0 0 1 ${rightStart + r2} 10 L ${right - r2} 10 A ${r2} ${r2} 0 0 1 ${right} ${10 + r2} L ${right} ${bottom - r2} A ${r2} ${r2} 0 0 1 ${right - r2} ${bottom} L ${rightStart + r2} ${bottom} A ${r2} ${r2} 0 0 1 ${rightStart} ${bottom - r2} L ${rightStart} ${bottom - radius} C ${rightStart} ${bottom - radius - 6} ${leftEnd} ${bottom - radius - 6} ${leftEnd} ${bottom - radius} L ${leftEnd} ${bottom - r1} A ${r1} ${r1} 0 0 1 ${leftEnd - r1} ${bottom} L ${10 + r1} ${bottom} A ${r1} ${r1} 0 0 1 10 ${bottom - r1} L 10 ${10 + r1} A ${r1} ${r1} 0 0 1 ${10 + r1} 10 L ${leftEnd - r1} 10 A ${r1} ${r1} 0 0 1 ${leftEnd} ${10 + r1} L ${leftEnd} ${10 + radius} C ${leftEnd} ${10 + radius + 6} ${rightStart} ${10 + radius + 6} ${rightStart} ${10 + radius}`;
      outline.setAttribute('width', String(width)); outline.setAttribute('height', String(height)); outline.setAttribute('viewBox', `0 0 ${width} ${height}`); paths.forEach(path => path.setAttribute('d', d));
      const gradient = outline.querySelector('linearGradient'); gradient?.setAttribute('x2', String(width)); gradient?.setAttribute('gradientTransform', `rotate(-33, ${width / 2}, ${height / 2})`);
    };
    const resize = new ResizeObserver(measure); resize.observe(phoneGrid); phones.forEach(phone => resize.observe(phone)); measure(); cleanups.push(() => resize.disconnect());
  }
  let active = 0, seeking = false, initialized = false, visible = false, disposed = false, raf = 0, timer = 0;
  let timeline: ReturnType<typeof animate> | undefined, seek: ReturnType<typeof animate> | undefined, intro: ReturnType<typeof animate> | undefined;
  const draw = (amount: number) => {
    if (paths?.[1]) {
      const offset = reduced || amount <= .95 ? 0 : (amount - .95) / .05;
      const length = reduced ? (native.endFractions.find(end => amount < end) ?? 1) : amount <= .95 ? amount / .95 * .9 : (1 - amount) / .05 * .9;
      paths[1].setAttribute('pathLength', '1'); paths[1].setAttribute('stroke-dashoffset', String(-offset)); paths[1].setAttribute('stroke-dasharray', `${Math.max(0, length)} 1`);
    }
    host.dataset.sdkProgress = amount.toFixed(4);
  };
  cleanups.push(progress.on('change', draw), initialize.on('change', amount => { paths?.forEach(path => path.style.opacity = String(amount)); if (gap) gap.style.opacity = String(amount); }));
  const reflect = (index: number) => {
    active = index; host.dataset.sdkTab = String(index);
    tabs.forEach((tab, i) => {
      const selected = i === index, group = tab.closest<HTMLElement>('[role="group"]'), panel = document.getElementById(tab.getAttribute('aria-controls') || '');
      tab.setAttribute('aria-expanded', String(selected)); tab.classList.toggle('opacity-40', !selected); tab.classList.toggle('after:hidden', selected);
      if (group) { group.dataset.expanded = String(selected); group.querySelectorAll<HTMLElement>('p').forEach(p => p.classList.toggle('opacity-40', !selected)); }
      if (panel) { panel.hidden = false; panel.setAttribute('aria-hidden', String(!selected)); panel.style.gridTemplateRows = selected ? '1fr' : '0fr'; panel.style.opacity = selected ? '1' : '0'; panel.style.transform = selected || reduced ? 'none' : 'scale(.96)'; }
    });
  };
  const sequence = native.sequences.flat().map(segment => {
    const [target, keyframes, options] = segment;
    return [typeof target === 'string' ? Array.from(host.querySelectorAll(target)) : value(target as NativeValue), keyframes, options];
  }) as AnimationSequence;
  const begin = () => {
    if (disposed) return;
    timeline?.cancel(); timeline = animate(sequence, { autoplay: false }); timeline.time = native.starts[active];
    if (visible && !document.hidden && !seeking) timeline.play();
  };
  const pause = () => { if (timeline && !seeking) { timeline.pause(); timeline.time = native.starts[active]; progress.set(timeline.time / native.duration); } };
  const overlayControls: ReturnType<typeof animate>[] = [], overlays: HTMLElement[] = [];
  const showSeek = (direction: number) => {
    paths?.[1]?.style.setProperty('stroke-opacity', '.6');
    host.querySelectorAll<HTMLElement>('[data-platform]').forEach((platform, index) => {
      const overlay = document.createElement('div'); overlay.className = 'sdk-expo-seek absolute inset-0 z-10 grid place-items-center bg-black/30 backdrop-blur-[5px]';
      const dots = document.createElement('div'); dots.className = 'sdk-expo-seek-dots absolute inset-0 opacity-80'; dots.style.animationDirection = direction < 0 ? 'reverse, normal' : 'normal, normal'; if (index) dots.style.animationDelay = '0s, -8s'; overlay.append(dots); platform.parentElement!.append(overlay); overlays.push(overlay); overlayControls.push(animate(overlay, { opacity: [0, 1] }, { duration: .4 }));
    });
  };
  const hideSeek = () => { paths?.[1]?.style.setProperty('stroke-opacity', '.26'); overlays.splice(0).forEach(overlay => { const animation = animate(overlay, { opacity: 0 }, { duration: .4, delay: .05 }); overlayControls.push(animation); void animation.then(() => overlay.remove()); }); };
  const select = (index: number) => {
    if (index === active && !seeking) return;
    reflect(index); if (!initialized) { clearTimeout(timer); initialized = true; initialize.set(1); } if (!timeline) begin(); if (!timeline) return;
    timeline.pause(); seek?.stop(); overlays.splice(0).forEach(overlay => overlay.remove()); seeking = true;
    const target = native.starts[index] / native.duration; showSeek(target > progress.get() ? 1 : -1);
    seek = animate(progress, target, { type: 'spring', stiffness: 800, damping: 134, mass: 5, onComplete: () => { if (disposed || !timeline) return; timeline.time = native.starts[index]; seeking = false; hideSeek(); if (visible && !document.hidden) timeline.play(); } });
  };
  tabs.forEach((tab, index) => {
    const click = (event: Event) => { event.preventDefault(); event.stopPropagation(); select(index); };
    const key = (event: KeyboardEvent) => { const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? (index + 1) % 3 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? (index + 2) % 3 : -1; if (next >= 0) { event.preventDefault(); event.stopPropagation(); select(next); tabs[next].focus(); } };
    tab.addEventListener('click', click); tab.addEventListener('keydown', key); cleanups.push(() => { tab.removeEventListener('click', click); tab.removeEventListener('keydown', key); });
  });
  const frame = () => {
    if (disposed) return;
    if (timeline && !seeking) {
      const time = timeline.time; progress.set(Math.min(1, time / native.duration));
      const index = native.starts.findLastIndex(start => time >= start); if (index >= 0 && index !== active) reflect(index);
      if (time >= native.duration - .0001 && visible && !document.hidden) { reflect(0); progress.set(0); begin(); }
    }
    raf = requestAnimationFrame(frame);
  };
  const initializeTour = () => { if (initialized || timer || root.dataset.sdkIntro !== 'complete') return; timer = window.setTimeout(() => { initialized = true; intro = animate(initialize, 1, { duration: 2.5, ease: [.785, .135, .15, .86] }); if (visible) begin(); }, 500); };
  const heroObserver = new MutationObserver(initializeTour); heroObserver.observe(root, { attributes: true, attributeFilter: ['data-sdk-intro'] }); initializeTour();
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (initialized && visible) { if (!timeline) begin(); else if (!seeking && !document.hidden) timeline.play(); } else pause(); }, { rootMargin: '-10% 0px -10% 0px' }); observer.observe(section);
  const visibility = () => { if (document.hidden) pause(); else if (initialized && visible && !seeking) timeline?.play(); }; document.addEventListener('visibilitychange', visibility);
  reflect(0); draw(0); paths?.forEach(path => path.style.opacity = '0'); if (gap) gap.style.opacity = '0'; raf = requestAnimationFrame(frame);
  return () => { disposed = true; clearTimeout(timer); cancelAnimationFrame(raf); observer.disconnect(); heroObserver.disconnect(); document.removeEventListener('visibilitychange', visibility); timeline?.cancel(); seek?.stop(); intro?.stop(); overlayControls.forEach(control => control.stop()); overlays.forEach(overlay => overlay.remove()); cleanups.forEach(stop => stop()); values.forEach(state => state.destroy()); progress.destroy(); initialize.destroy(); };
}
