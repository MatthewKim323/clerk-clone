'use client';

import { useEffect } from 'react';
import { animate, motionValue, stagger, type AnimationOptions, type AnimationSequence, type DOMKeyframesDefinition } from 'motion';
import './home-motion.css';

type Cleanup = () => void;
type Values = Record<string, unknown>;
type MotionBinding = { path: string; on: Values; off?: Values; txOn?: Values; txOff?: Values };
const expoOut = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const emailExpoOut = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -8 * t);
const expoInOut = (t: number) => t < .5 ? .5 * Math.pow(2, 16 * t - 8) : -.5 * Math.pow(2, -16 * t + 8) + 1;
const ease = [.7, 0, .3, 1];

function options(value: Values = {}): AnimationOptions {
  const result: Values = { ...value };
  for (const [key, entry] of Object.entries(result)) {
    if (entry === '__easeOut') result[key] = expoOut;
    else if (entry === '__emailEaseOut') result[key] = emailExpoOut;
    else if (entry === '__easeInOut') result[key] = expoInOut;
    else if (entry === '__Infinity') result[key] = Infinity;
    else if (entry && typeof entry === 'object' && !Array.isArray(entry)) result[key] = options(entry as Values);
  }
  return result as AnimationOptions;
}

function play(element: Element | null | undefined, target: Values, transition: Values = {}) {
  if (!element) return { stop() {} };
  const { transition: specific, ...values } = target;
  return animate(element, values as DOMKeyframesDefinition, options({ ...transition, ...(specific as Values || {}) }));
}

// The renderer uses SVG arc-length sampling and the same 20-segment glow as the source definition.
function meteorCanvas(canvas: HTMLCanvasElement, timing: number[][], designWidth = 403, skip = 0): Cleanup {
  const paths = Array.from(canvas.parentElement?.querySelectorAll<SVGPathElement>(':scope > svg > path') || []);
  const ctx = canvas.getContext('2d');
  if (!ctx || !paths.length) return () => {};
  const dpr = Math.max(1, Math.min(devicePixelRatio, 2));
  const width = canvas.offsetWidth, height = canvas.offsetHeight;
  canvas.width = width * dpr; canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  const scale = width / designWidth;
  const data = paths.map(path => ({ path, length: path.getTotalLength(), drawing: new Path2D(path.getAttribute('d') || '') }));
  const sprite = new Image();
  sprite.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAMAAAC67D+PAAAAAXNSR0IArs4c6QAAAEhQTFRFAAAA////AP//AAD/AP//gID/AP//AKr/AL//ANX/AKr/ALb/AN//AL//AMb/AMbjAMz/ANH/ALnoANj/AMj/AMjtANX/AMn/G8447gAAABh0Uk5TAAEBAQICAwMEBgYHCAgJCQoLCw0ODhITA3IuUQAAAEdJREFUeNoNycENwzAMBMFdkgmQ/qs1IPHi+Q4qIioMnfXQNdPfD5KJ/op+cgrHeg8rRONSI3vI7t321i7Pngh21blEDCDwB0UUHis/7NTIAAAAAElFTkSuQmCC';
  let raf = 0, start = 0, visible = false, disposed = false;
  const draw = (now: number) => {
    if (disposed || !visible || !sprite.complete) return;
    if (!start) start = now;
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    data.forEach(({ path, length, drawing }, index) => {
      const [repeat, delay] = timing[index];
      const cycle = Math.max(0, (elapsed - delay) % repeat);
      if (!cycle) return;
      const tail = skip * scale - 72.5 + cycle * .3 * scale;
      if (tail > length) return;
      ctx.beginPath();
      for (let segment = 0; segment < 20; segment++) {
        const distance = (segment + 1) * 1.25 + segment * 2.5 + tail;
        if (distance < 0 || distance > length) continue;
        const point = path.getPointAtLength(distance + .625);
        ctx.drawImage(sprite, point.x - 1.25, point.y - 1.25, 2.5, 2.5);
      }
      const from = path.getPointAtLength(tail), to = path.getPointAtLength(tail + 72.5);
      ctx.rect(Math.min(from.x, to.x) - 16, Math.min(from.y, to.y) - 16, Math.abs(from.x - to.x) + 32, Math.abs(from.y - to.y) + 32);
      const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      gradient.addColorStop(0, 'rgb(93 227 255 / 0)'); gradient.addColorStop(.5, 'rgb(93 227 255)'); gradient.addColorStop(1, 'rgb(108 71 255)');
      ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = gradient; ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      for (let segment = 0; segment < 20; segment++) {
        const distance = (segment + 1) * 1.25 + segment * 2.5 + tail;
        if (distance < 0 || distance > length) continue;
        const progress = (segment + 1) / 20;
        if (progress <= .5) ctx.strokeStyle = `rgb(93 227 255 / ${progress * 2})`;
        else { const t = (progress - .5) * 2; ctx.strokeStyle = `rgb(${93 + 15 * t} ${227 - 156 * t} 255)`; }
        ctx.lineWidth = 1.25 * scale; ctx.setLineDash([0, distance, 1.25, 999999]); ctx.stroke(drawing);
      }
      ctx.setLineDash([]);
    });
    raf = requestAnimationFrame(draw);
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) { start = 0; raf = requestAnimationFrame(draw); }
    else ctx.clearRect(0, 0, width, height);
  });
  observer.observe(canvas.closest('[data-section]') || canvas);
  sprite.onload = () => { if (visible && !disposed) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } };
  return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(raf); sprite.onload = null; ctx.clearRect(0, 0, width, height); };
}

function customerLogos(root: Element): Cleanup {
  const animations = Array.from(root.querySelectorAll<HTMLElement>('ul ul')).map((list, column) => {
    const count = list.children.length - 1, duration = count * 3300;
    list.style.transform = 'translateY(0%)';
    const frames: Keyframe[] = [];
    for (let step = 0; step < count; step++) {
      frames.push({ transform: `translateY(${-100 * step}%)`, offset: step * 3300 / duration, easing: 'cubic-bezier(.8,0,.2,1)' });
      frames.push({ transform: `translateY(${-100 * (step + 1)}%)`, offset: (step * 3300 + 1000) / duration, easing: 'linear' });
    }
    frames.push({ transform: `translateY(${-100 * count}%)`, offset: 1 });
    return list.animate(frames, { duration, delay: 2000 + column * 100, iterations: Infinity, fill: 'both' });
  });
  return () => animations.forEach(animation => animation.cancel());
}

function frameworkDots(root: Element): Cleanup {
  const colors: Record<string, number[][]> = {
    'Next.js': [[116, 118, 134]], React: [[97, 218, 251]], Expo: [[116, 118, 134]],
    'React Router': [[244, 66, 80]], 'TanStack React Start': [[144, 255, 87]], Astro: [[240, 65, 255]],
    Supabase: [[62, 207, 142]], Convex: [[141, 38, 118], [238, 52, 47], [243, 176, 28]], Vercel: [[255, 255, 255]],
  };
  let zIndex = 0;
  return (() => {
    const cleanups = Array.from(root.querySelectorAll<HTMLElement>('a.group')).filter(tile => colors[tile.textContent?.trim() || '']).map(tile => {
      let stop: Cleanup = () => {}, mounted = false;
      const retiring = new Map<number, Cleanup>();
      const leave = () => {
        if (!mounted) return;
        mounted = false; tile.style.zIndex = '0'; tile.classList.remove('hm-dots-active');
        const layer = tile.querySelector('.hm-dots');
        if (layer) play(layer, { opacity: 0 });
        const previousStop = stop; stop = () => {};
        const timer = window.setTimeout(() => { previousStop(); retiring.delete(timer); }, 300); retiring.set(timer, previousStop);
      };
      const enter = () => {
        if (mounted) return;
        mounted = true; stop(); tile.style.zIndex = String(++zIndex); tile.classList.add('hm-dots-active');
        const canvas = document.createElement('canvas'); canvas.className = 'hm-dots'; canvas.setAttribute('aria-hidden', 'true'); tile.prepend(canvas);
        stop = dotShader(canvas, colors[tile.textContent?.trim() || '']);
      };
      const pointerEnter = (event: PointerEvent) => { if (event.pointerType !== 'touch' && matchMedia('(hover:hover) and (pointer:fine)').matches) enter(); };
      const pointerLeave = () => { if (document.activeElement !== tile) leave(); };
      tile.addEventListener('pointerenter', pointerEnter); tile.addEventListener('pointerleave', pointerLeave);
      tile.addEventListener('focus', enter); tile.addEventListener('blur', leave);
      return () => { stop(); retiring.forEach((dispose, timer) => { clearTimeout(timer); dispose(); }); tile.removeEventListener('pointerenter', pointerEnter); tile.removeEventListener('pointerleave', pointerLeave); tile.removeEventListener('focus', enter); tile.removeEventListener('blur', leave); };
    });
    return () => cleanups.forEach(cleanup => cleanup());
  })();
}

// Dots use the captured WebGL shader, including its centered 3px grid and radial reveal.
function dotShader(canvas: HTMLCanvasElement, colors: number[][]): Cleanup {
  const gl = canvas.getContext('webgl2');
  if (!gl) return () => canvas.remove();
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader); return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
precision mediump float;
in vec2 coordinates;
uniform vec2 u_resolution;
out vec2 fragCoord;
void main(){gl_Position=vec4(coordinates,0.0,1.0);fragCoord=(coordinates+1.0)*0.5*u_resolution;fragCoord.y=u_resolution.y-fragCoord.y;}`);
  const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float;
in vec2 fragCoord;
uniform float u_time;
uniform float u_opacities[10];
uniform vec3 u_colors[6];
uniform vec2 u_resolution;
out vec4 fragColor;
float random(vec2 xy){return fract(tan(distance(xy*1.61803398874989484820459,xy)*0.5)*xy.x);}
void main(){
  vec2 st=fragCoord.xy;
  st.x-=abs(floor((mod(u_resolution.x,3.0)-1.0)*0.5));
  float opacity=step(0.0,st.x)*step(0.0,st.y);
  vec2 st2=vec2(int(st.x/3.0),int(st.y/3.0));
  float show_offset=random(st2);
  float rand=random(st2*floor((u_time/5.0)+show_offset+5.0)+1.0);
  opacity*=u_opacities[int(rand*10.0)];
  opacity*=1.0-step(1.0/3.0,fract(st.x/3.0));
  opacity*=1.0-step(1.0/3.0,fract(st.y/3.0));
  vec3 color=u_colors[int(show_offset*6.0)];
  float intro_offset=distance(u_resolution/2.0/3.0,st2)*0.01+(random(st2)*0.15);
  opacity*=step(intro_offset,u_time);
  opacity*=clamp((1.0-step(intro_offset+0.1,u_time))*1.25,1.0,1.25);
  fragColor=vec4(color,opacity);fragColor.rgb*=fragColor.a;
}`);
  const program = gl.createProgram()!; gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const coordinates = gl.getAttribLocation(program, 'coordinates'); gl.enableVertexAttribArray(coordinates); gl.vertexAttribPointer(coordinates, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'u_resolution'), time = gl.getUniformLocation(program, 'u_time');
  const palette = Array.from({ length: 6 }, (_, index) => colors[Math.floor(index / (6 / colors.length))]).flat().map(channel => channel / 255);
  gl.uniform3fv(gl.getUniformLocation(program, 'u_colors'), palette); gl.uniform1fv(gl.getUniformLocation(program, 'u_opacities'), [.3, .3, .3, .5, .5, .5, .8, .8, .8, 1]);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.disable(gl.DEPTH_TEST);
  const measure = () => { const dpr = Math.round(Math.max(1, Math.min(devicePixelRatio, 2))); canvas.width = canvas.offsetWidth * dpr; canvas.height = canvas.offsetHeight * dpr; gl.uniform2f(resolution, canvas.width / dpr, canvas.height / dpr); };
  measure(); const resize = new ResizeObserver(measure); resize.observe(canvas);
  let raf = 0, start = 0, previous = 0;
  const frame = (now: number) => {
    if (!start) start = now;
    if (now - previous >= 1000 / 30) { previous = now; gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform1f(time, (now - start) / 1000); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    raf = requestAnimationFrame(frame);
  }; raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); resize.disconnect(); gl.deleteShader(vertex); gl.deleteShader(fragment); gl.deleteProgram(program); gl.deleteBuffer(buffer); gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove(); };
}

function testimonialTicker(root: Element): Cleanup {
  const lists = Array.from(root.querySelectorAll<HTMLUListElement>('ul')).filter(list => list.querySelector(':scope > .ticker-item'));
  const cleanups: Cleanup[] = [];
  lists.forEach((list, column) => {
    const container = list.parentElement!;
    const items = Array.from(list.children) as HTMLElement[];
    const multiplier = motionValue(1);
    let length = 0, offset = 0, previous = 0, raf = 0, visible = false, focused = false;
    const measure = () => {
      items.forEach(item => { item.style.transform = 'none'; });
      const last = items.at(-1);
      length = last ? last.offsetTop + last.offsetHeight + 16 : 0;
    };
    measure(); list.style.transform = 'none';
    const resize = new ResizeObserver(measure); resize.observe(container);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '100px' });
    observer.observe(container);
    const enter = () => { animate(multiplier, 0); };
    const leave = () => { if (!focused) animate(multiplier, 1); };
    const focus = () => { focused = true; animate(multiplier, 0); };
    const blur = (event: FocusEvent) => { if (!container.contains(event.relatedTarget as Node)) { focused = false; leave(); } };
    container.addEventListener('pointerenter', enter); container.addEventListener('pointerleave', leave);
    container.addEventListener('focusin', focus); container.addEventListener('focusout', blur);
    const frame = (now: number) => {
      const dt = previous ? Math.min(now - previous, 64) : 0; previous = now;
      if (visible && !document.hidden && length > 0) {
        offset -= dt / 1000 * (column === 0 ? 25 : -35) * multiplier.get();
        const wrapped = ((offset % length) + length) % length - length;
        list.style.transform = `translateY(${wrapped}px)`;
        items.forEach(item => { item.style.transform = wrapped + item.offsetTop + item.offsetHeight <= 0 ? `translateY(${length}px)` : 'none'; });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    cleanups.push(() => { cancelAnimationFrame(raf); resize.disconnect(); observer.disconnect(); multiplier.destroy(); container.removeEventListener('pointerenter', enter); container.removeEventListener('pointerleave', leave); container.removeEventListener('focusin', focus); container.removeEventListener('focusout', blur); });
  });
  const quotes = Array.from(root.querySelectorAll<HTMLElement>('[class*="mask-size:4000px"]'));
  if (quotes.length) {
    let active = Math.max(0, quotes.findIndex(quote => quote.style.maskPosition.includes('-1200px')));
    const transition = { duration: 1.5, type: 'spring', bounce: 0 };
    const reveal = () => quotes.forEach((quote, index) => play(quote, index === active ? { opacity: 1, maskPosition: ['0px 0px', '-1200px 0px'], filter: ['blur(4px)', 'blur(0px)'], scale: [.98, 1], skewY: [1, 0], rotate: [-1, 0] } : { opacity: 1, maskPosition: ['-3200px 0px', '-4600px 0px'], filter: 'blur(4px)', scale: 1.02, skewY: -1, rotate: 1 }, transition));
    const timer = window.setInterval(() => { active = (active + 1) % quotes.length; reveal(); }, 7000);
    cleanups.push(() => { clearInterval(timer); quotes.forEach(quote => quote.getAnimations().forEach(animation => animation.cancel())); });
  }
  return () => cleanups.forEach(cleanup => cleanup());
}

function cardExtras(card: HTMLElement, active: boolean): Cleanup {
  const title = card.querySelector('h3')?.textContent || '';
  const cleanups: Cleanup[] = [];
  const timers: number[] = [];
  const later = (fn: () => void, delay: number) => { const timer = window.setTimeout(fn, delay); timers.push(timer); };
  const run = (element: Element | null, target: Values, transition: Values = {}) => { const control = play(element, target, transition); cleanups.push(() => control.stop()); };
  if (title === 'Magic Links' && active) cleanups.push(magicLinks(card));
  if (title.includes('Multifactor') && active) cleanups.push(multifactor(card));
  if (title.includes('Fraud')) {
    const spinner = card.querySelector('.w-min > div > div');
    run(spinner, { rotate: active ? 360 : 0 }, active ? { repeat: Infinity, duration: 2, ease: 'linear' } : { duration: .5, ease: '__easeOut' });
    const icons = Array.from(card.querySelectorAll<HTMLElement>('[class*="bg-red-500"]'));
    icons.forEach((icon, index) => {
      const row = icon.parentElement?.parentElement;
      run(icon, { opacity: +active, scale: active ? 1 : .8 }, { duration: .2, delay: .2 * index + .25, ease: '__easeInOut' });
      run(row?.querySelector('.font-medium') || null, { opacity: +active, filter: active ? 'blur(0px)' : 'blur(8px)' }, { duration: .5, delay: .2 * index + .25, ease: '__easeInOut' });
      run(row?.querySelector('.text-gray-600') || null, { opacity: +active, transform: active ? 'translateY(0rem)' : 'translateY(.5rem)' }, { duration: .5, delay: .2 * index + .35, ease: '__easeInOut' });
    });
  }
  if (title.includes('Session Management') || title.includes('API Keys')) {
    card.querySelectorAll<HTMLElement>('[class*="screen-off-color"]').forEach(panel => run(panel, { transform: active ? 'rotateX(20deg) translateX(-50%)' : 'rotateX(-75deg) translateX(-50%)', background: active ? 'var(--screen-off-color)' : 'var(--screen-on-color)' }, { duration: 1, ease: '__easeInOut', background: active ? { duration: .5 } : { delay: .3 } }));
  }
  if (title.includes('Social Sign-On') || title.includes('CLI')) {
    const indexed = Array.from(card.querySelectorAll<HTMLElement>('[data-logo-index]'));
    const candidates = indexed.length ? indexed : Array.from(card.querySelectorAll<HTMLElement>('[style*="transform:translate("]')).filter(element => element.classList.contains('absolute') && element.classList.contains('top-0'));
    const groups = new Map<Element, HTMLElement[]>();
    candidates.forEach(element => { const parent = element.parentElement!; groups.set(parent, [...groups.get(parent) || [], element]); });
    let groupIndex = 0;
    groups.forEach(elements => {
      const group = groupIndex++;
      const original = elements.map(element => element.style.transform); let step = 0;
      if (!active) return;
      const next = () => { step++; elements.forEach((element, index) => { const nextPosition = (index + step) % original.length; run(element, { transform: original[nextPosition] }, { duration: nextPosition === 0 ? 0 : title.includes('CLI') ? 1 : 1.2, ease }); }); later(next, title.includes('CLI') ? 1350 : 2800); };
      later(next, title.includes('CLI') ? 550 : group ? 2100 : 700);
      cleanups.push(() => elements.forEach((element, index) => play(element, { transform: original[index] }, { duration: .5, ease: '__easeOut' })));
    });
    if (title.includes('Social')) {
      const container = card.querySelector<HTMLElement>('[class*="relative mx-auto aspect-98/192"]');
      if (active && container) {
        const layer = document.createElement('div'); layer.className = 'hm-social-meteor';
        layer.innerHTML = '<canvas aria-hidden="true"></canvas><svg width="0" height="0" aria-hidden="true"><path d="M88.71 131.71L3.34314 46.3431C1.84285 44.8428 1 42.808 1 40.6863V0"/><path d="M49 292V124"/><path d="M9.29 131.71L94.6569 46.3431C96.1572 44.8428 97 42.808 97 40.6863V0"/></svg>';
        container.append(layer); const stop = meteorCanvas(layer.querySelector('canvas')!, [[2800, 700], [1400, 0], [2800, 2100]], 98, 100);
        cleanups.push(() => { stop(); layer.remove(); });
      }
      const lit = Array.from(card.querySelectorAll<HTMLElement | SVGElement>('[style*="opacity:0"], [style*="opacity: 0"]')).filter(element => element.tagName.toLowerCase() === 'svg' || element.style.backgroundImage.includes('radial-gradient'));
      lit.forEach(element => {
        if (element.tagName.toLowerCase() === 'svg' || element.style.backgroundImage.includes('radial-gradient')) run(element, { opacity: +active });
      });
      const shine = card.querySelector<HTMLElement>('[class*="absolute -inset-4"]');
      run(shine, { transform: active ? 'translate(0rem, 0rem)' : 'translate(-4rem, -4rem)' }, { duration: .5, ease: [0, .4, .2, 1] });
      if (active) cleanups.push(() => lit.forEach(element => play(element, { opacity: 0 })));
    }
  }
  if (title.includes('Custom roles')) {
    const track = Array.from(card.querySelectorAll<HTMLElement>('div')).find(element => element.className === 'flex gap-x-3');
    const roles = ['Administrator', 'Engineer', 'Product Member', 'Marketing']; let index = 0;
    const backdrop = track?.querySelector<HTMLElement>('span.absolute');
    if (active && track) {
      const next = () => {
        const pill = Array.from(track.children).find(element => element.textContent?.trim() === roles[index % roles.length]) as HTMLElement | undefined;
        if (pill) {
          const x = -(pill.offsetLeft - track.getBoundingClientRect().width / 2 + pill.offsetWidth / 2);
          run(track, { transform: `translateX(${x}px)` }, { duration: .75, ease: 'anticipate' });
          if (backdrop) { pill.prepend(backdrop); run(backdrop, { opacity: 1 }, { duration: .65, delay: .125, ease: 'anticipate' }); }
        }
        index++; later(next, 2000);
      };
      next();
    }
  }
  if (title.includes('Bot Detection') && active) cleanups.push(botDetection(card));
  return () => { timers.forEach(clearTimeout); cleanups.forEach(cleanup => cleanup()); };
}

function magicLinks(card: HTMLElement): Cleanup {
  const reference = card.dataset.referencePath!;
  const at = (suffix: string) => card.querySelector<HTMLElement>(`[data-reference-path="${reference}${suffix}"]`)!;
  const code = at('/1/0/0/3'), topText = at('/1/0/0/0/0'), bottomText = at('/1/0/0/1');
  const deck = at('/1/0/1/2'), name = at('/1/0/1/2/1/0'), email = at('/1/0/1/2/2');
  if (!code || !deck) return () => {};
  const original = [code, topText, bottomText, name, email].map(element => element.textContent);
  const originalStyles = [deck, name, topText, bottomText].map(element => element.getAttribute('style'));
  const nodes = new Set<Element>(), controls: Array<{ stop: () => void }> = [], timers: number[] = [];
  let disposed = false;
  const later = (fn: () => void, delay: number) => timers.push(window.setTimeout(() => { if (!disposed) fn(); }, delay));
  const run = (element: Element | null, values: Values, tx: Values = {}) => { const control = play(element, values, tx); controls.push(control); return control; };
  const token = (length: number) => Array.from({ length }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
  const pool = token(1200);
  const scramble = () => {
    [topText, bottomText].forEach(element => { const offset = Math.floor(Math.random() * 1200); element.textContent = pool.slice(offset, offset + 600) + pool.slice(0, Math.max(0, offset - 600)); });
    code.textContent = topText.textContent!.slice(0, 14); later(scramble, 200);
  }; scramble();
  const people = ['Marina Schroeder', 'Izaiah Manning', 'Jennifer Ochoa', 'Winston Brennan', 'Elodie Carroll', 'Oscar Wong', 'Adelaide Sloan', 'Ocean Haley', 'Addilynn Harvey', 'Cayden Ball', 'Abby Rangel', 'Saint Harmon', 'Maren Dudley', 'Colter Marshall', 'Adalyn Gutierrez', 'Luca Hoover', 'Virginia Malone', 'Ruben Hodge', 'Coraline Sampson', 'Cain Pollard', 'Marisol Jaramillo', 'Riggs Weiss', 'Lennox Norton', 'Callen Harmon', 'Maren Robbins', 'Finnegan Shepard', 'Noor Aguilar', 'Milo Branch', 'Luisa Combs', 'Ahmad Rollins', 'Araceli McCullough', 'Briar Owen', 'Mikayla Ayers', 'Ulises Norris', 'Arielle Harding', 'Brodie Chambers', 'Makayla Spencer', 'Ace Kline', 'Sevyn McKee', 'Bjorn Daniel', 'Joy Swanson', 'Hugo Moss', 'Bianca Waller', 'Marley Sloan', 'Selene Carey', 'Watson Zamora', 'Sierra Bonilla', 'Aden Herman', 'Paulina Peterson', 'Santiago Payne'];
  const sweep = (delay: number) => {
    [topText, bottomText].forEach(element => {
      Object.assign(element.style, { color: 'transparent', backgroundClip: 'text', backgroundImage: 'linear-gradient(to right, rgb(55 55 60) calc(50% - 2.5rem), rgb(100 100 103) 50%, rgb(55 55 60) calc(50% + 2.5rem))', backgroundSize: 'calc(200% + 5rem) 100%' });
      run(element, { backgroundPosition: ['calc(-100% - 5rem) 0%', 'calc(-200% - 5rem) 0%'] }, { delay: delay + .5, duration: 3, ease: 'linear' });
    });
    const highlight = document.createElement('div'); highlight.className = 'hm-magic-code'; highlight.textContent = token(14); code.parentElement!.append(highlight); nodes.add(highlight);
    run(highlight, { clipPath: ['polygon(-10% 0,-10% 0,-10% 110%,-10% 110%)', 'polygon(-10% 0,110% 0,110% 100%,-10% 100%)'] }, { delay, duration: 3, ease: 'linear' });
    const scan = document.createElement('div'); scan.className = 'hm-magic-scan'; highlight.append(scan);
    run(scan, { transform: ['translateX(-110%)', 'translateX(10%)'] }, { delay, duration: 3, ease: 'linear' });
    const beam = document.createElement('span'); beam.className = 'hm-magic-beam'; scan.append(beam);
    run(beam, { opacity: [0, 1, 1, 0], scaleY: [.5, 1, 1, .5] }, { delay, duration: 3, times: [0, .2 / 3, 2.6 / 3, 1], ease: 'linear' });
    const glow = document.createElement('span'); glow.className = 'hm-magic-glow'; scan.append(glow);
    run(glow, { x: ['1.75rem', '0rem', '0rem', '1.75rem'] }, { delay, duration: 3, times: [0, .8 / 3, 2.6 / 3, 1], ease: 'linear' });
    for (let i = 0; i < 16; i++) {
      const particle = document.createElement('span'); particle.className = 'hm-magic-particle'; particle.style.top = `${Math.random() * 100}%`; scan.append(particle);
      const particleDelay = delay + Math.random(), duration = 1 + Math.random();
      run(particle, { opacity: [0, 1, 0], x: ['0rem', '-1rem'] }, { delay: particleDelay, duration, repeat: Infinity, opacity: { times: [0, .1, 1] } });
    }
    const outline = deck.querySelector('svg')?.cloneNode(true) as SVGSVGElement | undefined;
    if (outline) {
      outline.removeAttribute('data-reference-path'); outline.classList.add('hm-magic-face');
      Array.from(outline.children).slice(0, 2).forEach(element => element.remove());
      outline.querySelectorAll<SVGPathElement>('path').forEach((path, index) => {
        path.removeAttribute('class'); path.removeAttribute('data-reference-path'); path.setAttribute('stroke', '#5de3ff');
        const length = path.getTotalLength(); path.style.strokeDasharray = String(length);
        run(path, { strokeDashoffset: [length, 0], opacity: [0, 1] }, { delay: delay + index * .2, duration: index ? 2.7 : 3, opacity: { delay: delay + index * .2 + .01, duration: 0 } });
      });
      deck.firstElementChild!.append(outline); nodes.add(outline);
    }
    const check = document.createElement('span'); check.className = 'hm-magic-check';
    check.innerHTML = '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path stroke="#131316" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.25" d="M3.75 6.563 5.438 8.25l2.812-4.5"/></svg>';
    name.parentElement!.append(check); nodes.add(check);
    run(check, { opacity: [0, 1], scale: [.5, 1] }, { delay: delay + 3.1 });
    const checkPath = check.querySelector('path')!; checkPath.style.strokeDasharray = '8';
    run(checkPath, { strokeDashoffset: [8, 0], opacity: [0, 1] }, { delay: delay + 3.4, duration: .2, opacity: { delay: delay + 3.4, duration: 0 } });
    run(name, { transform: 'translate(-0.5625rem, 0rem)' }, { delay: delay + 3 });
    later(() => {
      const old = deck.cloneNode(true) as HTMLElement;
      old.querySelectorAll('[data-reference-path]').forEach(element => element.removeAttribute('data-reference-path')); old.removeAttribute('data-reference-path');
      Object.assign(old.style, { position: 'absolute', top: '0', left: '0' }); deck.parentElement!.append(old); nodes.add(old);
      run(old, { transform: 'rotate(45deg)', opacity: 0 }, { delay: .5, duration: 1, ease });
      check.remove(); outline?.remove(); nodes.delete(check); if (outline) nodes.delete(outline);
      const person = people[Math.floor(Math.random() * people.length)]; name.textContent = person; email.textContent = `${person.toLowerCase().replace(' ', '.').replace(/^(\S)\S+\./, '$1.')}@\u2060example.com`;
      name.style.transform = 'translate(0rem, 0rem)';
      run(deck, { transform: ['rotate(-45deg)', 'rotate(0deg)'], opacity: [0, 1] }, { delay: .5, duration: 1, ease });
      run(highlight, { clipPath: 'polygon(110% 0,110% 0,110% 100%,110% 100%)' }, { delay: .5, duration: 1, ease });
      later(() => { old.remove(); highlight.remove(); nodes.delete(old); nodes.delete(highlight); }, 1500);
      sweep(1.6);
    }, (delay + 3.6) * 1000);
  }; sweep(0);
  return () => {
    disposed = true; timers.forEach(clearTimeout); controls.forEach(control => control.stop()); nodes.forEach(node => node.remove());
    [code, topText, bottomText, name, email].forEach((element, index) => { element.textContent = original[index]; });
    [deck, name, topText, bottomText].forEach((element, index) => { const style = originalStyles[index]; if (style) element.setAttribute('style', style); else element.removeAttribute('style'); });
  };
}

function multifactor(card: HTMLElement): Cleanup {
  const cells = Array.from(card.querySelectorAll<HTMLElement>('[data-num]'));
  const wrapper = cells[0]?.parentElement?.parentElement;
  if (!wrapper) return () => {};
  let disposed = false, timer = 0, overlay: HTMLElement | null = null;
  let control: { cancel: () => void } | null = null;
  const cycle = async (delay: number) => {
    overlay?.remove(); overlay = document.createElement('div'); overlay.className = 'hm-mfa-overlay'; wrapper.append(overlay);
    overlay.innerHTML = `<div class="hm-mfa-numbers">${Array.from({ length: 6 }, () => `<div class="hm-mfa-cell"><span data-hm-digit>${Math.floor(Math.random() * 9 + 1)}</span></div>`).join('')}</div><div class="hm-mfa-bg"></div><div class="hm-mfa-cursor"></div><div class="hm-mfa-border"></div>${Array.from({ length: 5 }, (_, i) => `<div class="hm-mfa-border hm-mfa-finale" style="left:${44 * i}px"></div>`).join('')}`;
    const border = overlay.querySelector('.hm-mfa-border')!, background = overlay.querySelector('.hm-mfa-bg')!, cursor = overlay.querySelector('.hm-mfa-cursor')!;
    const digits = Array.from(overlay.querySelectorAll('[data-hm-digit]'));
    const first = animate([
      [border, { opacity: 1, transform: ['scale(1.5)', 'scale(.9)', 'scale(1)'] }, { duration: .3, opacity: { duration: .1 } }],
      [background, { opacity: 1 }, { at: '<' }],
      [cursor, { opacity: 1, transform: ['scale(1.75)', 'scale(1)'] }, { at: '<' }],
      [digits[0], { opacity: 1, transform: 'scale(1)' }, { duration: .1 }],
    ], { delay, defaultTransition: { duration: .3, ease: [.7, 0, .3, 1] } }); control = first; await first;
    if (disposed) return;
    const sequence: AnimationSequence = [];
    for (let i = 0; i < 5; i++) {
      const x = 44 * (i + 1) / 16;
      sequence.push([cursor, { transform: `translateX(${x}rem)` }, {}], [[background, border], { transform: `translateX(${x}rem)` }, { at: '<' }], [digits[i + 1], { opacity: 1, transform: 'scale(1)' }, { duration: .1, at: '+.1' }], [border, { transform: [`translateX(${x}rem) scale(.9)`, `translateX(${x}rem) scale(1)`] }, { at: '<' }]);
    }
    const steps = animate(sequence, { defaultTransition: { duration: .15 } }); control = steps; await steps;
    if (disposed) return;
    const finale = animate([
      [border, { opacity: 0, transform: 'translateX(13.75rem) scale(1.5)' }],
      [digits, { opacity: 0, transform: ['scale(1)', 'scale(1.5)'] }, { at: '<' }],
      [Array.from(overlay.querySelectorAll('.hm-mfa-finale')), { opacity: [1, 0], transform: ['scale(1)', 'scale(1.5)'] }, { at: '<' }],
      [background, { opacity: 0 }, { at: '<' }],
      [cursor, { opacity: 0, transform: 'translateX(13.75rem) scale(1.5)' }, { at: '<' }],
    ]); control = finale; await finale;
    if (!disposed) timer = window.setTimeout(() => cycle(.7), 0);
  }; void cycle(0);
  return () => { disposed = true; clearTimeout(timer); control?.cancel(); overlay?.remove(); };
}

function botDetection(card: HTMLElement): Cleanup {
  const positions = [[[-2, 64, 0], [52, 81, .1], [-68, 68, .1], [102, 79, .2], [39, 122, .2], [-52, 117, .2], [-20, 159, .3], [-105, 121, .3]], [[-42, 48, 0], [30, 57, 0], [70, 66, .1], [-21, 94, .1], [-78, 102, .2], [71, 107, .2], [-54, 151, .3], [43, 154, .3]]];
  const dots = Array.from(card.querySelectorAll<HTMLElement>('[data-dot]')), radar = Array.from(card.querySelectorAll('[data-radar]'));
  const transforms = Array.from(card.querySelectorAll('[data-transform]')), spotlight = card.querySelector('[data-spotlight]'), dot = card.querySelector('[data-active-dot]');
  const container = dots[0]?.parentElement, circle = card.querySelector('[data-crosshair] circle');
  if (!container || !spotlight || !dot || !circle) return () => {};
  const radius = motionValue(7), gap = motionValue(2), controls: Array<{ stop: () => void }> = [];
  const redraw = () => { const segment = 2 * Math.PI * radius.get() / 4 - gap.get(); circle.setAttribute('r', String(radius.get())); circle.setAttribute('stroke-dasharray', Array(4).fill(`${segment} ${gap.get()}`).join(' ')); circle.setAttribute('stroke-dashoffset', String(-gap.get() / 2)); };
  const offRadius = radius.on('change', redraw), offGap = gap.on('change', redraw);
  let disposed = false, position = 0;
  const cycle = async () => {
    position = (position + 1) % positions.length;
    const points = positions[position], point = points[Math.floor(Math.random() * 8)];
    controls.push(play(container, { '--color': '#5DE3FF' }));
    const dim = animate([[radar, { opacity: .2 }, { duration: 1 }], [dots, { opacity: 0 }, { duration: 1, at: '<' }]]); controls.push(dim); await dim;
    if (disposed) return;
    const sequence: AnimationSequence = dots.map((element, index) => [element, { top: `${points[index][1] / 16}rem`, left: `calc(50% + ${points[index][0] / 16}rem)`, opacity: 1 }, { top: { duration: 0 }, left: { duration: 0 }, duration: 1, at: '<', delay: points[index][2] }]);
    sequence.push([radar, { opacity: 1 }, { at: '<', duration: 1, delay: stagger(.1) }], [transforms, { transform: `translate(${point[0] / 16}rem, ${point[1] / 16}rem)` }, { at: '<', duration: .8, ease: [.7, 0, .3, 1] }], [spotlight, { transform: `rotate(${-Math.atan(point[0] / (point[1] + 76))}rad)` }, { at: '<', duration: .8, ease: [.7, 0, .3, 1] }], [dot, { opacity: 0 }, { at: '-0.6', duration: .15 }], [dot, { transform: `translate(${point[0] / 16}rem, ${point[1] / 16}rem)` }, { duration: .01 }], [dot, { opacity: 1 }, { at: '+0.2', duration: .15 }]);
    const scan = animate(sequence); controls.push(scan);
    controls.push(animate([[radius, 10.5], [gap, 0, { at: '<' }], [radius, 7, { at: '+0.4' }], [gap, 2, { at: '<' }]], { delay: 1 }));
    await scan; if (!disposed) void cycle();
  }; void cycle();
  return () => { disposed = true; controls.forEach(control => control.stop()); offRadius(); offGap(); radius.destroy(); gap.destroy(); play(container, { '--color': '#747686' }); };
}

function featureCards(root: Element): Cleanup {
  const cards = Array.from(root.querySelectorAll<HTMLHeadingElement>('h3')).map(heading => heading.closest<HTMLElement>('.group')).filter((card): card is HTMLElement => !!card);
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;
  let manuallyHovered = finePointer, current: HTMLElement | null = null, activeCleanup: Cleanup = () => {}, complete = 0;
  const inView = new Set<HTMLElement>();
  const cleaners: Cleanup[] = [];
  const setActive = (card: HTMLElement | null) => {
    if (card === current) return;
    clearTimeout(complete); activeCleanup();
    if (current) {
      current.removeAttribute('data-hm-active');
      for (const binding of MOTION_BINDINGS) if (current.querySelector(`[data-reference-path="${binding.path}"]`)) {
        if (binding.off) play(current.querySelector(`[data-reference-path="${binding.path}"]`), binding.off, binding.txOff);
      }
      cardExtras(current, false);
    }
    current = card;
    if (!card) return;
    card.dataset.hmActive = 'true';
    const controls: Array<{ stop: () => void }> = [];
    for (const binding of MOTION_BINDINGS) {
      const element = card.querySelector(`[data-reference-path="${binding.path}"]`);
      if (element) controls.push(play(element, binding.on, binding.txOn));
    }
    const stopExtras = cardExtras(card, true);
    activeCleanup = () => { controls.forEach(control => control.stop()); stopExtras(); };
    if (!manuallyHovered) {
      const title = card.querySelector('h3')?.textContent || '';
      const duration = title.includes('Multifactor') ? 2700 : title.includes('Social') ? 3000 : title.includes('Magic Links') ? 5100 : title.includes('Invitations') ? 5000 : title.includes('Custom roles') ? 4000 : title.includes('Password') ? 3800 : title.includes('Bot') ? 4000 : title.includes('UI Components') ? 3000 : 2000;
      complete = window.setTimeout(() => { const available = [...inView]; setActive(available[(available.indexOf(card) + 1) % available.length] || null); }, duration);
    }
  };
  cards.forEach(card => {
    const enter = (event: PointerEvent) => { if (event.pointerType === 'touch') return; manuallyHovered = true; setActive(card); };
    const leave = (event: PointerEvent) => { if (event.pointerType !== 'touch' && current === card) setActive(null); };
    card.addEventListener('pointerenter', enter); card.addEventListener('pointerleave', leave);
    cleaners.push(() => { card.removeEventListener('pointerenter', enter); card.removeEventListener('pointerleave', leave); });
  });
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { const card = entry.target as HTMLElement; if (entry.intersectionRatio >= .999) inView.add(card); else inView.delete(card); });
    if (!manuallyHovered && (!current || !inView.has(current))) setActive([...inView][0] || null);
  }, { threshold: [0, 1] });
  cards.forEach(card => observer.observe(card));
  return () => { clearTimeout(complete); activeCleanup(); observer.disconnect(); cleaners.forEach(cleanup => cleanup()); };
}

export function HomeMotion() {
  useEffect(() => {
    const cleanup: Cleanup[] = [];
    const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (reduced) return;
    const hero = document.querySelector('[data-section="hero"]');
    hero?.querySelectorAll<HTMLCanvasElement>('canvas').forEach((canvas, index) => cleanup.push(meteorCanvas(canvas, index ? [[1500, 250], [1200, 300], [1000, 4000], [2000, 500]] : [[2000, 0], [1500, 400], [2300, 500], [1700, 600]])));
    const customers = document.querySelector('[data-section="customers"]'); if (customers) cleanup.push(customerLogos(customers));
    const integrations = document.querySelector('[data-section="integrations"]'); if (integrations) cleanup.push(frameworkDots(integrations));
    const testimonials = document.querySelector('[data-section="testimonials"]'); if (testimonials) cleanup.push(testimonialTicker(testimonials));
    for (const section of ['authentication', 'organizations']) { const root = document.querySelector(`[data-section="${section}"]`); if (root) cleanup.push(featureCards(root)); }
    document.documentElement.dataset.homeMotion = 'ready';
    return () => { cleanup.forEach(fn => fn()); delete document.documentElement.dataset.homeMotion; };
  }, []);
  return null;
}

const MOTION_BINDINGS: MotionBinding[] = [
  {
    "path": "0/1/3/5/3/1/0/2/1/2/0/0",
    "on": {
      "x": "0rem",
      "transition": {
        "delay": 0.8,
        "ease": "__easeOut",
        "duration": 0.8
      }
    },
    "off": {
      "x": "5.1875rem",
      "transition": {
        "ease": "__easeOut",
        "duration": 0.6
      }
    }
  },
  {
    "path": "0/1/3/5/3/1/0/2/1/2/0/1",
    "on": {
      "x": "0rem",
      "transition": {
        "delay": 0.8,
        "ease": "__easeOut",
        "duration": 0.8
      }
    },
    "off": {
      "x": "-5.1875rem",
      "transition": {
        "ease": "__easeOut",
        "duration": 0.6
      }
    }
  },
  {
    "path": "0/1/3/5/3/1/0/2/1/2/0/4",
    "on": {
      "opacity": 1
    },
    "off": {
      "opacity": 0
    }
  },
  {
    "path": "0/1/3/5/3/1/0/2/1/2/0/7/0",
    "on": {
      "transform": "translate(0rem, 0rem)",
      "transition": {
        "duration": 0.5,
        "ease": [
          0,
          0.4,
          0.2,
          1
        ]
      }
    },
    "off": {
      "transform": "translate(-2.75rem, -2.75rem)"
    }
  },
  {
    "path": "0/1/3/5/3/1/0/3/1/0/0/0/0/0/0/0",
    "on": {
      "rotateX": "0deg",
      "opacity": 0
    },
    "off": {
      "rotateX": "90deg"
    },
    "txOn": {
      "duration": 1
    },
    "txOff": {
      "duration": 2,
      "ease": "__easeOut",
      "delay": 0.4
    }
  },
  {
    "path": "0/1/3/5/3/1/0/3/1/0/0/0/0/0/0/2",
    "on": {
      "opacity": 1,
      "transition": {
        "duration": 2,
        "ease": "__easeOut",
        "delay": 0.5
      }
    },
    "off": {
      "opacity": 0,
      "transition": {
        "duration": 0.5,
        "ease": "__easeOut",
        "delay": 0.25
      }
    }
  },
  {
    "path": "0/1/3/5/3/1/0/3/1/0/0/0/1/0",
    "on": {
      "transform": "translateX(0rem)"
    },
    "off": {
      "transform": "translateX(5.45rem)"
    },
    "txOn": {
      "duration": 0.6,
      "ease": "__easeInOut",
      "delay": 0
    },
    "txOff": {
      "duration": 0.6,
      "ease": "__easeInOut",
      "delay": 0
    }
  },
  {
    "path": "0/1/3/5/3/1/0/3/1/0/0/0/2/0",
    "on": {
      "transform": "translateX(0rem)"
    },
    "off": {
      "transform": "translateX(5.45rem)"
    },
    "txOn": {
      "duration": 0.6,
      "ease": "__easeInOut",
      "delay": 0
    },
    "txOff": {
      "duration": 0.6,
      "ease": "__easeInOut",
      "delay": 0
    }
  },
  {
    "path": "0/1/3/5/3/1/0/3/1/0/0/0/3/0",
    "on": {
      "transform": "translateX(0rem)"
    },
    "off": {
      "transform": "translateX(5.45rem)"
    },
    "txOn": {
      "duration": 0.6,
      "ease": "__easeInOut",
      "delay": 0
    },
    "txOff": {
      "duration": 0.6,
      "ease": "__easeInOut",
      "delay": 0
    }
  },
  {
    "path": "0/1/3/5/3/1/0/3/1/0/0/0/1/1",
    "on": {
      "filter": "blur(0px)",
      "opacity": 1,
      "transition": {
        "delay": 0.2,
        "duration": 0.6
      }
    },
    "off": {
      "filter": "blur(8px)",
      "opacity": 0
    },
    "txOn": {
      "duration": 1,
      "ease": "__easeOut"
    },
    "txOff": {
      "duration": 1,
      "ease": "__easeOut"
    }
  },
  {
    "path": "0/1/3/5/3/1/0/3/1/0/0/0/2/1",
    "on": {
      "filter": "blur(0px)",
      "opacity": 1,
      "transition": {
        "delay": 0.2,
        "duration": 0.6
      }
    },
    "off": {
      "filter": "blur(8px)",
      "opacity": 0
    },
    "txOn": {
      "duration": 1,
      "ease": "__easeOut"
    },
    "txOff": {
      "duration": 1,
      "ease": "__easeOut"
    }
  },
  {
    "path": "0/1/3/5/3/1/0/3/1/0/0/0/3/1",
    "on": {
      "filter": "blur(0px)",
      "opacity": 1,
      "transition": {
        "delay": 0.2,
        "duration": 0.6
      }
    },
    "off": {
      "filter": "blur(8px)",
      "opacity": 0
    },
    "txOn": {
      "duration": 1,
      "ease": "__easeOut"
    },
    "txOff": {
      "duration": 1,
      "ease": "__easeOut"
    }
  },
  {
    "path": "0/1/3/5/3/1/0/6/1/0",
    "on": {
      "transform": "translateY(-2rem) scale(1)"
    },
    "off": {
      "transform": "translateY(0rem) scale(0.98)"
    },
    "txOn": {
      "duration": 0.5,
      "ease": "__emailEaseOut"
    },
    "txOff": {
      "duration": 0.5,
      "ease": "__emailEaseOut"
    }
  },
  {
    "path": "0/1/3/5/3/1/0/6/1/0/0/0/0",
    "on": {
      "backgroundColor": "#5DE3FF",
      "boxShadow": "0 0 8px 1px rgb(107 231 255 / 0.3), 0 1px rgb(255 255 255 / 0.2) inset"
    },
    "off": {
      "backgroundColor": "#131316",
      "boxShadow": "0 1px rgb(255 255 255 / 0.05)"
    }
  },
  {
    "path": "0/1/3/5/3/1/0/6/1/0/0/0/1/0",
    "on": {
      "transform": "translateY(0rem) scale(1)",
      "opacity": 1,
      "filter": "blur(0px)",
      "transition": {
        "type": "spring",
        "bounce": 0.2,
        "duration": 0.6,
        "delay": 0.2,
        "filter": {
          "duration": 0.6,
          "delay": 0.2
        }
      }
    },
    "off": {
      "transform": "translateY(-6.5rem) scale(.9)",
      "filter": "blur(2px)",
      "opacity": 0.5
    }
  },
  {
    "path": "0/1/3/5/3/1/0/6/1/0/0/0/2/1/0/1",
    "on": {
      "transform": "scale(1)",
      "background": "#5DE3FF",
      "boxShadow": "0 0 8px 1px rgb(107 231 255 / 0.3), 0 1px rgb(255 255 255 / 0.2) inset"
    },
    "off": {
      "transform": "scale(0.75)",
      "background": "#FFFFFF40"
    },
    "txOn": {
      "duration": 0.5,
      "ease": "__emailEaseOut"
    },
    "txOff": {
      "duration": 0.5,
      "ease": "__emailEaseOut"
    }
  },
  {
    "path": "0/1/3/5/3/1/0/6/1/0/1",
    "on": {
      "transform": "translateY(2rem)"
    },
    "off": {
      "transform": "translateY(0rem)"
    }
  },
  {
    "path": "0/1/3/5/3/1/0/8/1/0",
    "on": {
      "transform": "translateY(-2rem)"
    },
    "off": {
      "transform": "translateY(0rem)"
    },
    "txOn": {
      "ease": "__easeOut",
      "duration": 1
    },
    "txOff": {
      "ease": "__easeOut",
      "duration": 1
    }
  },
  {
    "path": "0/1/3/5/3/1/0/8/1/0/1/0/2",
    "on": {
      "transform": "rotate(0deg)",
      "opacity": 1
    },
    "off": {
      "transform": "rotate(90deg)",
      "opacity": 0
    },
    "txOn": {
      "ease": "__easeInOut",
      "duration": 1,
      "delay": 2
    },
    "txOff": {
      "ease": "__easeOut",
      "duration": 0.5
    }
  },
  {
    "path": "0/1/3/5/3/1/0/8/1/0/1/0/3",
    "on": {
      "transform": "rotate(0deg)",
      "opacity": 1
    },
    "off": {
      "transform": "rotate(-90deg)",
      "opacity": 0
    },
    "txOn": {
      "ease": "__easeInOut",
      "duration": 1,
      "delay": 2
    },
    "txOff": {
      "ease": "__easeOut",
      "duration": 0.5
    }
  },
  {
    "path": "0/1/3/5/3/1/0/8/1/0/1/0/4",
    "on": {
      "transform": "translateX(-50%) translateY(0%) rotate(45deg) scaleY(1.2)"
    },
    "off": {
      "transform": "translateX(-125%) translateY(-75%) rotate(45deg) scaleY(1.2)"
    },
    "txOn": {
      "ease": "__easeInOut",
      "duration": 1,
      "delay": 2
    },
    "txOff": {
      "ease": "__easeOut",
      "duration": 0.5
    }
  },
  {
    "path": "0/1/3/5/3/1/0/8/1/0/2",
    "on": {
      "transform": "translateY(1rem)",
      "opacity": 1
    },
    "off": {
      "transform": "translateY(0rem)",
      "opacity": 0.5
    },
    "txOn": {
      "ease": "__easeOut",
      "duration": 1
    },
    "txOff": {
      "ease": "__easeOut",
      "duration": 1
    }
  },
  {
    "path": "0/1/3/5/3/1/0/8/1/0/2/0",
    "on": {
      "opacity": 1
    },
    "off": {
      "opacity": 0
    },
    "txOn": {
      "ease": "__easeOut",
      "duration": 1
    },
    "txOff": {
      "ease": "__easeOut",
      "duration": 1
    }
  },
  {
    "path": "0/1/3/5/3/1/1/0/0/1/0/0/0/5/0/0/0/2",
    "on": {
      "opacity": 1,
      "transition": {
        "duration": 0.7,
        "ease": "__easeOut",
        "delay": 0.45
      }
    },
    "off": {
      "opacity": 0,
      "transition": {
        "duration": 0.25,
        "ease": "__easeOut"
      }
    }
  },
  {
    "path": "0/1/3/5/3/1/1/0/0/1/0/0/0/5/0/0/0/2/1/0",
    "on": {
      "width": "0.95rem"
    },
    "off": {
      "width": "0rem"
    },
    "txOn": {
      "duration": 2.2,
      "ease": "__easeInOut"
    },
    "txOff": {
      "duration": 0.2
    }
  },
  {
    "path": "0/1/3/5/3/1/1/0/0/1/0/0/0/5/0/0/0/0",
    "on": {
      "rotateX": "0deg",
      "opacity": 0
    },
    "off": {
      "rotateX": "90deg"
    },
    "txOn": {
      "duration": 1
    },
    "txOff": {
      "duration": 2,
      "ease": "__easeOut",
      "delay": 0.4
    }
  },
  {
    "path": "0/1/3/5/3/1/1/0/0/1/0/0/0/6/0/0",
    "on": {
      "rotate": 360
    },
    "off": {
      "rotate": 0
    },
    "txOn": {
      "repeat": "__Infinity",
      "ease": "linear",
      "duration": 2
    },
    "txOff": {
      "ease": "__easeOut",
      "duration": 0.5
    }
  },
  {
    "path": "0/1/3/5/3/1/1/0/0/1/0/0/0/5/0",
    "on": {
      "y": -30
    },
    "off": {
      "y": -50
    },
    "txOn": {
      "duration": 0.4,
      "ease": "__easeOut"
    },
    "txOff": {
      "duration": 0.4,
      "ease": "__easeOut"
    }
  },
  {
    "path": "0/1/3/5/3/1/1/1/0/1/0/5/0/1/0",
    "on": {
      "opacity": 1
    },
    "off": {
      "opacity": 0
    }
  },
  {
    "path": "0/1/3/5/3/1/1/1/0/1/0/5/0/1/1",
    "on": {
      "transform": "translate(0rem, 0rem)",
      "transition": {
        "duration": 0.5,
        "ease": [
          0,
          0.4,
          0.2,
          1
        ]
      }
    },
    "off": {
      "transform": "translate(-4rem, -4rem)"
    }
  },
  {
    "path": "0/1/3/7/1/1/1/0/0/0",
    "on": {
      "transform": [
        "scale(1)",
        "scale(1.1)",
        "scale(1)"
      ]
    },
    "off": {
      "transform": "scale(1)"
    },
    "txOn": {
      "duration": 3,
      "repeat": "__Infinity",
      "ease": "__easeInOut",
      "delay": 0
    },
    "txOff": {
      "duration": 1.5,
      "ease": "__easeOut"
    }
  },
  {
    "path": "0/1/3/7/1/1/1/0/0/1",
    "on": {
      "transform": [
        "scale(1)",
        "scale(1.1)",
        "scale(1)"
      ]
    },
    "off": {
      "transform": "scale(1)"
    },
    "txOn": {
      "duration": 3,
      "repeat": "__Infinity",
      "ease": "__easeInOut",
      "delay": 0.2
    },
    "txOff": {
      "duration": 1.5,
      "ease": "__easeOut"
    }
  },
  {
    "path": "0/1/3/7/1/1/1/0/0/2",
    "on": {
      "transform": [
        "scale(1)",
        "scale(1.1)",
        "scale(1)"
      ]
    },
    "off": {
      "transform": "scale(1)"
    },
    "txOn": {
      "duration": 3,
      "repeat": "__Infinity",
      "ease": "__easeInOut",
      "delay": 0.4
    },
    "txOff": {
      "duration": 1.5,
      "ease": "__easeOut"
    }
  },
  {
    "path": "0/1/3/7/1/1/1/0/0/3",
    "on": {
      "transform": [
        "scale(1)",
        "scale(1.1)",
        "scale(1)"
      ]
    },
    "off": {
      "transform": "scale(1)"
    },
    "txOn": {
      "duration": 3,
      "repeat": "__Infinity",
      "ease": "__easeInOut",
      "delay": 0.6
    },
    "txOff": {
      "duration": 1.5,
      "ease": "__easeOut"
    }
  },
  {
    "path": "0/1/3/7/1/2/1/0/0/1",
    "on": {
      "transform": [
        "scaleX(1) scaleY(1)",
        "scaleX(2) scaleY(2.5)"
      ],
      "opacity": [
        1,
        0
      ]
    },
    "off": {
      "transform": "scaleX(1) scaleY(1)",
      "opacity": 0
    },
    "txOn": {
      "repeat": "__Infinity",
      "duration": 5,
      "delay": 3.3333333333333335
    },
    "txOff": {
      "duration": 0.25
    }
  },
  {
    "path": "0/1/3/7/1/2/1/0/0/2",
    "on": {
      "transform": [
        "scaleX(1) scaleY(1)",
        "scaleX(2) scaleY(2.5)"
      ],
      "opacity": [
        1,
        0
      ]
    },
    "off": {
      "transform": "scaleX(1) scaleY(1)",
      "opacity": 0
    },
    "txOn": {
      "repeat": "__Infinity",
      "duration": 5,
      "delay": 3.3333333333333335
    },
    "txOff": {
      "duration": 0.25
    }
  },
  {
    "path": "0/1/3/7/1/2/1/0/0/3",
    "on": {
      "transform": [
        "scaleX(1) scaleY(1)",
        "scaleX(2) scaleY(2.5)"
      ],
      "opacity": [
        1,
        0
      ]
    },
    "off": {
      "transform": "scaleX(1) scaleY(1)",
      "opacity": 0
    },
    "txOn": {
      "repeat": "__Infinity",
      "duration": 5,
      "delay": 3.3333333333333335
    },
    "txOff": {
      "duration": 0.25
    }
  },
  {
    "path": "0/1/3/7/1/3/1/0/1/1",
    "on": {
      "opacity": 1,
      "transform": "scale(1)",
      "filter": "blur(0px)"
    },
    "off": {
      "opacity": 0,
      "transform": "scale(0.95)",
      "filter": "blur(8px)"
    },
    "txOn": {
      "duration": 1,
      "ease": "__easeOut"
    },
    "txOff": {
      "duration": 0.5,
      "ease": "__easeOut"
    }
  }
];
