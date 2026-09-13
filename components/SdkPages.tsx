'use client';

import { useEffect } from 'react';
import { animate, motionValue, stagger, type AnimationSequence } from 'motion';
import { type DotOptions } from './MarketingMotion';
import { SDK_DATA } from './sdk/data';
import { expoTour, sdkDots, type ExpoTourData } from './SdkExpoTour';
import { sdkCanvasEffects, sdkHeroDots, type SdkCanvasData } from './SdkCanvasEffects';
import { sdkReactDecorations } from './SdkReactDecorations';
import { sdkInstallCounter, type InstallCounterData } from './SdkInstallCounter';
import './sdk-pages.css';

type Cleanup = () => void;
type Entry = { title: string; description: string; html: string };
type SdkData = SdkCanvasData & {
  installationTotal: InstallCounterData;
  reactTabs: { label: string; panels: { id: string; html: string }[] }[];
  codeExamples: Entry[];
  videoId: string;
  providers: { id: string; name: string; mono: string; color: string }[];
  previews: Record<string, string>;
  quotes: { name: string; role: string; company: string; quote: string; avatar: string; logo: string }[];
  reactHero: DotOptions;
  nextHero: DotOptions;
  expoCards: Record<string, DotOptions>;
  expoTabs: ExpoTourData;
  expoShaders: { parents: string[]; config: DotOptions }[];
  expo: { normal: { sequences: unknown[][]; portal: DotOptions }; reduced: { sequences: unknown[][]; portal: DotOptions } };
};
let dataPromise: Promise<SdkData> | undefined;
function data() {
  return dataPromise ||= new Response(new Blob([Uint8Array.from(atob(SDK_DATA), value => value.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).json() as Promise<SdkData>;
}
function listen<T extends Event>(element: EventTarget, name: string, handler: (event: T) => void, cleanups: Cleanup[]) {
  element.addEventListener(name, handler as EventListener); cleanups.push(() => element.removeEventListener(name, handler as EventListener));
}
function claim(node: HTMLElement, cleanups: Cleanup[]) {
  node.dataset.sdkControl = ''; cleanups.push(() => { delete node.dataset.sdkControl; });
}
function keyboardTabs(nodes: HTMLElement[], select: (index: number) => void, cleanups: Cleanup[]) {
  nodes.forEach((node, index) => listen<KeyboardEvent>(node, 'keydown', event => {
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : direction ? (index + direction + nodes.length) % nodes.length : -1;
    if (next >= 0) { event.preventDefault(); event.stopPropagation(); select(next); nodes[next].focus(); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(index); }
  }, cleanups));
}

function carousel(root: HTMLElement): Cleanup {
  const cleanups: Cleanup[] = [], first = root.querySelector<HTMLButtonElement>('button[aria-label^="Scroll to "]');
  const track = first?.parentElement?.parentElement, container = track?.parentElement;
  if (!track || !container) return () => {};
  claim(container, cleanups);
  const items = Array.from(track.children) as HTMLElement[], buttons = items.map(item => item.querySelector('button')!), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const previous = container.querySelector<HTMLButtonElement>('button[aria-label="Previous"]'), next = container.querySelector<HTMLButtonElement>('button[aria-label="Next"]');
  let active = 0;
  const reflect = () => {
    active = items.reduce((best, item, index) => Math.abs(track.scrollLeft - (item.offsetLeft + item.offsetWidth / 2 - track.offsetWidth / 2)) < Math.abs(track.scrollLeft - (items[best].offsetLeft + items[best].offsetWidth / 2 - track.offsetWidth / 2)) ? index : best, 0);
    items.forEach((item, index) => {
      const selected = index === active, button = buttons[index];
      item.classList.toggle('pointer-events-none', selected); button.style.opacity = selected ? '1' : '.8'; button.style.filter = selected ? 'blur(0px)' : 'blur(3.5px)'; button.style.transition = reduced ? 'none' : 'opacity 300ms, filter 300ms'; button.removeAttribute('inert');
      const description = item.querySelector<HTMLElement>('[class*="pointer-events-auto mt-10"]');
      if (description) { description.style.opacity = selected ? '1' : '0'; description.style.visibility = selected ? 'visible' : 'hidden'; description.style.transition = reduced ? 'none' : `opacity 300ms ${selected ? '250ms' : '0ms'}, visibility 300ms`; }
    });
    if (previous) { previous.disabled = active === 0; previous.classList.toggle('opacity-50', active === 0); }
    if (next) { next.disabled = active === items.length - 1; next.classList.toggle('opacity-50', next.disabled); }
    track.dataset.sdkIndex = String(active);
  };
  const select = (index: number) => { const item = items[index]; if (item) track.scrollTo({ left: item.offsetLeft + item.offsetWidth / 2 - track.offsetWidth / 2, behavior: reduced ? 'instant' : 'smooth' }); };
  buttons.forEach((button, index) => listen(button, 'click', () => select(index), cleanups));
  if (previous) listen(previous, 'click', () => select(active - 1), cleanups);
  if (next) listen(next, 'click', () => select(active + 1), cleanups);
  listen(track, 'scroll', reflect, cleanups); listen(window, 'resize', reflect, cleanups);
  listen<KeyboardEvent>(track, 'keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); select(active + (event.key === 'ArrowRight' ? 1 : -1)); } }, cleanups);
  reflect();
  return () => cleanups.forEach(stop => stop());
}

function frameworkTabs(root: HTMLElement, config: SdkData): Cleanup {
  const cleanups: Cleanup[] = [];
  for (const group of config.reactTabs) {
    const list = root.querySelector<HTMLElement>(`[role="tablist"][aria-labelledby="${group.label}"]`);
    if (!list) continue;
    const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'));
    const container = list.parentElement?.parentElement, panel = container?.querySelector<HTMLElement>('[role="tabpanel"]');
    if (!container || !panel) continue;
    claim(container, cleanups);
    const original = panel.innerHTML;
    const select = (index: number) => {
      const entry = group.panels[index]; if (!entry) return;
      panel.innerHTML = entry.html + '<div class="sticky bottom-0 h-6 bg-linear-to-t from-gray-950"></div>';
      panel.setAttribute('aria-labelledby', tabs[index].id); panel.dataset.sdkPanel = entry.id;
      tabs.forEach((tab, i) => {
        const selected = i === index; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
        tab.toggleAttribute('data-selected', selected); if (selected) tab.setAttribute('aria-controls', panel.id); else tab.removeAttribute('aria-controls');
        const label = tab.firstElementChild as HTMLElement | null;
        if (label) { label.classList.toggle('bg-gray-950', selected); label.classList.toggle('text-white', selected); label.classList.toggle('text-gray-500', !selected); label.classList.toggle('sdk-tab-selected', selected); label.firstElementChild?.classList.toggle('opacity-0', !selected); }
      });
    };
    tabs.forEach((tab, index) => listen(tab, 'click', () => select(index), cleanups)); keyboardTabs(tabs, select, cleanups);
    cleanups.push(() => { panel.innerHTML = original; });
  }
  return () => cleanups.forEach(stop => stop());
}

function codeExamples(root: HTMLElement, config: SdkData): Cleanup {
  const cleanups: Cleanup[] = [], select = Array.from(root.querySelectorAll<HTMLSelectElement>('select')).find(node => node.options[0]?.textContent === 'Authentication');
  if (select) {
    const container = select.closest<HTMLElement>('[class*="rounded-2xl bg-gray-950"]');
    if (container) {
      claim(container, cleanups); const code = container.querySelector('pre'), codeHost = code?.parentElement;
      listen(select, 'change', () => { const entry = config.codeExamples.find(entry => entry.title === select.value); if (!entry || !codeHost) return; codeHost.innerHTML = entry.html;
        let description = container.querySelector<HTMLParagraphElement>(':scope > p');
        if (entry.description) { if (!description) { description = document.createElement('p'); description.className = 'px-5 pb-4 text-sm/5 text-pretty text-white'; container.insertBefore(description, container.lastElementChild); } description.textContent = entry.description; } else description?.remove();
      }, cleanups);
    }
  }
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[aria-controls]')).filter(button => config.codeExamples.some(entry => entry.title === button.textContent?.trim()));
  buttons.forEach(button => claim(button, cleanups));
  buttons.forEach(button => listen(button, 'click', event => {
    event.preventDefault(); event.stopPropagation();
    buttons.forEach(other => { const selected = other === button, panel = document.getElementById(other.getAttribute('aria-controls') || ''); other.setAttribute('aria-expanded', String(selected)); if (panel) { panel.toggleAttribute('hidden', !selected); panel.setAttribute('aria-hidden', String(!selected)); if (selected) { panel.style.setProperty('--disclosure-panel-width', 'auto'); panel.style.setProperty('--disclosure-panel-height', 'auto'); } } });
  }, cleanups));
  return () => cleanups.forEach(stop => stop());
}

function quotes(root: HTMLElement, config: SdkData): Cleanup {
  const cleanups: Cleanup[] = [], list = root.querySelector<HTMLElement>('[role="tablist"][aria-label="Testimonials"]');
  if (!list) return () => {};
  const container = list.closest<HTMLElement>('[class*="relative mt-24"]'), tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'));
  const panel = container?.querySelector<HTMLElement>('[role="tabpanel"]'); if (!container || !panel) return () => {};
  claim(container, cleanups);
  const ordered = tabs.map(tab => config.quotes.find(quote => quote.name === tab.querySelector('strong')?.textContent?.trim())!);
  const images = Array.from(container.querySelectorAll<HTMLImageElement>('[class*="relative size-12"] > img'));
  let active = 0;
  const select = (index: number) => {
    active = (index + tabs.length) % tabs.length; const quote = ordered[active]; if (!quote) return;
    panel.querySelector('blockquote p')!.textContent = quote.quote; const logo = panel.querySelector('img'); if (logo) { logo.src = quote.logo; logo.removeAttribute('srcset'); }
    panel.setAttribute('aria-labelledby', tabs[active].id); panel.dataset.sdkQuote = quote.name;
    images.forEach((image, i) => image.classList.toggle('opacity-0', i !== active));
    tabs.forEach((tab, i) => {
      let delta = (i - active + tabs.length) % tabs.length; if (delta > 3) delta -= tabs.length;
      tab.setAttribute('aria-selected', String(i === active)); tab.tabIndex = i === active ? 0 : -1; tab.toggleAttribute('data-selected', i === active);
      tab.style.setProperty('--tab-y-desktop', `${delta * 100}%`); tab.style.setProperty('--tab-y-mobile', `${delta * 100}%`); tab.style.transition = 'transform 300ms, opacity 300ms';
      tab.classList.toggle('pointer-events-none', Math.abs(delta) > 1); tab.classList.toggle('max-lg:opacity-0', Math.abs(delta) > 2); tab.classList.toggle('max-lg:opacity-100', Math.abs(delta) <= 2);
    });
  };
  tabs.forEach((tab, index) => listen(tab, 'click', () => select(index), cleanups)); keyboardTabs(tabs, select, cleanups);
  const previous = container.querySelector('[aria-label="Previous quote"]'), next = container.querySelector('[aria-label="Next quote"]');
  if (previous) listen(previous, 'click', () => select(active - 1), cleanups); if (next) listen(next, 'click', () => select(active + 1), cleanups);
  return () => cleanups.forEach(stop => stop());
}

function dialog(layer: HTMLElement, trigger: HTMLElement, closeButton: HTMLElement, onClose?: Cleanup, exit?: () => PromiseLike<unknown>): Cleanup {
  const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; document.body.append(layer); closeButton.focus();
  let closed = false, removed = false;
  const finish = () => { if (removed) return; removed = true; onClose?.(); layer.remove(); document.body.style.overflow = overflow; if (trigger.isConnected) trigger.focus(); trigger.setAttribute('aria-expanded', 'false'); };
  const close = () => { if (closed) return; closed = true; document.removeEventListener('keydown', key); layer.style.pointerEvents = 'none'; const animation = exit?.(); if (animation) void Promise.resolve(animation).then(finish); else finish(); };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') { const nodes = Array.from(layer.querySelectorAll<HTMLElement>('button, input, select, a[href], iframe')).filter(node => node.offsetWidth > 0 && !node.hasAttribute('disabled')); const i = nodes.indexOf(document.activeElement as HTMLElement); if (nodes.length && (event.shiftKey && i <= 0 || !event.shiftKey && i === nodes.length - 1)) { event.preventDefault(); nodes[event.shiftKey ? nodes.length - 1 : 0].focus(); } }
  };
  document.addEventListener('keydown', key); closeButton.addEventListener('click', close); layer.addEventListener('click', event => { if (event.target === layer) close(); });
  return () => { closed = true; document.removeEventListener('keydown', key); finish(); };
}

function configurator(root: HTMLElement, config: SdkData): Cleanup {
  const cleanups: Cleanup[] = [], input = root.querySelector<HTMLInputElement>('#sign-in-application-name');
  const container = input?.closest<HTMLElement>('[class*="relative lg:grid lg:grid-cols-2"]');
  const figure = container?.querySelector<HTMLElement>('figure'); if (!container || !figure || !input) return () => {};
  claim(container, cleanups); let identifiers = ['email_address'], providers = ['google'], name = '', closeModal: Cleanup | undefined;
  const original = figure.innerHTML;
  const sync = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-sdk-control] button[role="switch"]').forEach(button => {
      const selected = [...identifiers, ...providers].includes(button.value); button.setAttribute('aria-checked', String(selected)); button.dataset.state = selected ? 'checked' : 'unchecked';
      button.classList.toggle('justify-end', selected); button.classList.toggle('justify-start', !selected); button.classList.toggle('after:opacity-100', selected); button.classList.toggle('after:opacity-0', !selected);
      const label = button.closest('label'); label?.classList.toggle('text-gray-950', selected); label?.classList.toggle('text-gray-500', !selected);
      const provider = config.providers.find(provider => provider.id === button.value); const icon = label?.querySelector('span[aria-hidden]'); if (provider && icon) icon.innerHTML = selected ? provider.color : provider.mono;
    });
  };
  const render = () => {
    const mask = ['email_address', 'phone_number', 'username'].reduce((value, id, index) => value + (identifiers.includes(id) ? 1 << index : 0), 0);
    figure.innerHTML = config.previews[mask]; figure.dataset.sdkPreview = String(mask);
    const heading = figure.querySelector('header p'); if (heading) heading.textContent = `Sign into ${name || 'Your Application'}`;
    const group = figure.querySelector<HTMLElement>('[role="group"]');
    if (group) {
      const template = group.firstElementChild?.cloneNode(true) as HTMLElement;
      group.replaceChildren(); const count = providers.length;
      const columns = count < 1 ? 1 : count <= 6 ? count : count <= 8 ? 4 : count <= 10 ? 5 : count <= 12 ? 6 : count <= 13 ? 5 : count <= 14 ? 4 : count <= 16 ? 6 : count <= 17 ? 5 : count <= 18 ? 6 : count <= 19 ? 5 : 6;
      group.style.setProperty('--sso-cols', String(columns)); group.style.display = count ? '' : 'none';
      if (identifiers.length && group.nextElementSibling instanceof HTMLElement) group.nextElementSibling.style.display = count ? '' : 'none';
      for (const id of providers) { const provider = config.providers.find(provider => provider.id === id)!; const item = template.cloneNode(true) as HTMLElement; item.innerHTML = provider.mono; if (count <= 2) { const span = document.createElement('span'); span.textContent = count === 1 ? `Continue with ${provider.name}` : provider.name; item.append(span); } group.append(item); }
    }
    sync(); figure.dispatchEvent(new CustomEvent('aurora:demo-render', { bubbles: true }));
  };
  const toggle = (event: Event) => { const button = (event.target as Element).closest<HTMLButtonElement>('button[role="switch"]'); if (!button) return; event.preventDefault(); const id = button.value; if (['email_address', 'phone_number', 'username'].includes(id)) identifiers = identifiers.includes(id) ? identifiers.filter(value => value !== id) : [...identifiers, id]; else providers = providers.includes(id) ? providers.filter(value => value !== id) : [...providers, id]; render(); };
  listen(container, 'click', toggle, cleanups); listen(input, 'input', () => { name = input.value; render(); }, cleanups);
  const trigger = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('Sign in options'));
  if (trigger) listen(trigger, 'click', () => {
    closeModal?.(); const options = input.closest<HTMLElement>('[class*="hidden overflow-hidden rounded-"]'); if (!options) return;
    trigger.setAttribute('aria-expanded', 'true'); const layer = document.createElement('div'); layer.dataset.sdkControl = ''; layer.className = 'sdk-options-overlay fixed inset-0 z-50 flex items-end lg:hidden';
    layer.innerHTML = '<div class="w-full px-1.5 pb-2"><div role="dialog" aria-modal="true" aria-label="Sign in options" class="rounded-md bg-white pt-4 shadow-[0_5px_15px_rgba(0,0,0,0.08),0_15px_35px_-5px_rgba(25,28,33,0.2)] ring-1 ring-gray-950/5 outline-none"><button type="button" aria-label="Close sign in options" class="mr-4 ml-auto grid size-6 place-content-center rounded-full bg-gray-400/20"><svg viewBox="0 0 10 10" class="size-2.5" fill="none"><path stroke="#131316" stroke-linecap="square" stroke-linejoin="round" stroke-width="1.5" d="m2 2 6 6m0-6L2 8"/></svg></button></div></div>';
    const box = layer.querySelector('[role="dialog"]')!; box.insertAdjacentHTML('beforeend', options.innerHTML); layer.querySelectorAll('[id]').forEach(node => { const old = node.id; node.id = 'sdk-modal-' + old; layer.querySelectorAll(`label[for="${CSS.escape(old)}"]`).forEach(label => label.setAttribute('for', node.id)); });
    layer.addEventListener('click', toggle); closeModal = dialog(layer, trigger, layer.querySelector('button')!); sync();
    const sheet = layer.firstElementChild as HTMLElement; const animation = animate(sheet, { transform: ['translateY(100%)', 'translateY(0%)'], opacity: [0, 1] }, { duration: .3 }); cleanups.push(() => animation.stop());
  }, cleanups);
  cleanups.push(() => { closeModal?.(); figure.innerHTML = original; }); return () => cleanups.forEach(stop => stop());
}

function video(root: HTMLElement, config: SdkData): Cleanup {
  const trigger = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('fundamentals in 10 minutes'));
  if (!trigger) return () => {};
  const cleanups: Cleanup[] = []; claim(trigger, cleanups); let closeModal: Cleanup | undefined;
  listen(trigger, 'click', () => {
    closeModal?.(); trigger.setAttribute('aria-expanded', 'true');
    const layer = document.createElement('div'); layer.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 backdrop-blur'; layer.dataset.sdkControl = '';
    layer.innerHTML = '<div class="absolute inset-0 pointer-events-none"><canvas class="mm-canvas" aria-hidden="true"></canvas></div><div class="flex w-full max-w-7xl items-center"><div role="dialog" aria-modal="true" aria-label="Video" class="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-[0_15px_35px_-5px,0_5px_15px] shadow-black/8 outline-none"></div><button type="button" class="group absolute top-4 right-6 flex cursor-pointer items-center gap-x-1 text-white transition-transform active:scale-[0.98]"><svg viewBox="0 0 512 512" aria-hidden="true" class="transition-[colors,rotate] -mt-px size-[1.25rem] text-gray-400 duration-150 ease-initial group-hover:rotate-90 group-hover:text-white"><path d="m289.94 256 95-95A24 24 0 0 0 351 127l-95 95-95-95a24 24 0 0 0-34 34l95 95-95 95a24 24 0 1 0 34 34l95-95 95 95a24 24 0 0 0 34-34z" fill="currentColor"></path></svg><span class="label-3 py-1 text-white">Close video</span></button></div>';
    const frame = document.createElement('iframe'); frame.src = `https://www.youtube.com/embed/${encodeURIComponent(config.videoId)}?autoplay=1&rel=0`; frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.allowFullscreen = true; frame.title = 'Aurora fundamentals'; frame.className = 'absolute inset-0 size-full'; layer.querySelector('[role="dialog"]')!.append(frame);
    let cleanupVisuals = () => {};
    const stopDialog = dialog(layer, trigger, layer.querySelector('button')!, () => cleanupVisuals(), () => { const fadeOut = animate(layer, { opacity: 0 }, { duration: .25 }), zoomOut = animate(layer.querySelector('[role="dialog"]')!, { opacity: 0, scale: .98 }, { duration: .15 }); cleanups.push(() => { fadeOut.stop(); zoomOut.stop(); }); return fadeOut.then(() => {}); }), stopDots = sdkDots(layer.querySelector('canvas')!, { colors: [[255, 255, 255]], dotSize: 1, totalSize: 3, opacities: [.2, .2, .2, .2, .2, .3, .3, .3, .3, .3] });
    const fade = animate(layer, { opacity: [0, 1] }, { duration: .3 }), zoom = animate(layer.querySelector('[role="dialog"]')!, { opacity: [0, 1], scale: [.9, 1] }, { duration: .25 });
    cleanupVisuals = () => { fade.stop(); zoom.stop(); stopDots(); };
    closeModal = stopDialog;
  }, cleanups);
  cleanups.push(() => closeModal?.()); return () => cleanups.forEach(stop => stop());
}

function hero(root: HTMLElement, route: string, config: SdkData): Cleanup {
  const cleanups: Cleanup[] = [];
  if (route !== '/expo-authentication') { const canvas = root.querySelector<HTMLCanvasElement>('canvas'); if (canvas) cleanups.push(sdkHeroDots(canvas, route === '/react-authentication' ? config.reactHero : config.nextHero)); }
  else {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, native = reduced ? config.expo.reduced : config.expo.normal;
    const intro = motionValue(0), canvas = root.querySelector<HTMLCanvasElement>('canvas');
    if (canvas) { cleanups.push(sdkDots(canvas, { ...native.portal, uniforms: { ...native.portal.uniforms, u_intro_progress: { type: 'uniform1f', value: 0 } } })); cleanups.push(intro.on('change', value => canvas.dispatchEvent(new CustomEvent('aurora:shader-uniform', { detail: { name: 'u_intro_progress', value } })))); }
    const scope = (selector: string) => Array.from(root.querySelectorAll(selector));
    const sequence = (native.sequences[0][0] as unknown[]).map(segment => {
      if (!Array.isArray(segment)) return segment;
      const [target, values, rawOptions] = segment, options = { ...(rawOptions || {}) };
      if (options.delay && typeof options.delay === 'object' && 'stagger' in options.delay) options.delay = stagger(options.delay.stagger);
      return [typeof target === 'string' ? scope(target) : intro, values, options];
    }).filter(segment => !Array.isArray(segment) || !Array.isArray(segment[0]) || segment[0].length) as AnimationSequence;
    let animation: ReturnType<typeof animate> | undefined, rays: ReturnType<typeof animate> | undefined;
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting || animation) return; animation = animate(sequence); rays = animate(scope('[data-light-rays]'), { opacity: 1 }, { duration: reduced ? 0 : 9, ease: [.4, 0, .2, 1] }); void animation.then(() => { root.querySelectorAll<HTMLElement>('[style*="will-change"]').forEach(node => { node.style.willChange = 'auto'; }); root.dataset.sdkIntro = 'complete'; }); }, { threshold: 0 }); observer.observe(root);
    cleanups.push(() => { observer.disconnect(); animation?.stop(); rays?.stop(); intro.destroy(); });
  }
  return () => cleanups.forEach(stop => stop());
}

function expoSecurity(root: HTMLElement, config: SdkData): Cleanup {
  const cleanups: Cleanup[] = [], reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const claimed = new Set<HTMLElement>();
  const canvasAt = (parent: HTMLElement, options: DotOptions) => {
    const existing = parent.querySelector<HTMLCanvasElement>(':scope > canvas'), canvas = existing || document.createElement('canvas');
    if (!existing) { canvas.className = 'mm-canvas'; canvas.setAttribute('aria-hidden', 'true'); parent.append(canvas); cleanups.push(() => canvas.remove()); }
    cleanups.push(sdkDots(canvas, options)); return canvas;
  };
  for (const entry of config.expoShaders) {
    const parent = Array.from(root.querySelectorAll<HTMLElement>('div')).find(node => !claimed.has(node) && node.className === entry.parents.at(-1) && (!entry.parents.at(-2) || node.parentElement?.className === entry.parents.at(-2)));
    if (parent) { claimed.add(parent); canvasAt(parent, entry.config); }
  }
  root.querySelectorAll<HTMLCanvasElement>('span[class*="relative mr-1 ml-0.5"] > canvas').forEach(canvas => cleanups.push(sdkDots(canvas, { totalSize: 2, dotSize: 1, colors: [[255, 255, 255]], opacities: [.45, .45, .5, .5, .55, .6, .6, .7, .8, .85], maxFps: 15 })));
  const fire = (canvas: HTMLCanvasElement) => canvas.dispatchEvent(new CustomEvent('aurora:marketing-slide', { detail: { index: 0, direction: 1 } }));
  const uniform = (canvas: HTMLCanvasElement, name: string, value: number) => canvas.dispatchEvent(new CustomEvent('aurora:shader-uniform', { detail: { name, value } }));
  const cards: { card: HTMLElement; set: (active: boolean) => void; duration: number }[] = [];
  const bind = (card: HTMLElement, name: string, set: (active: boolean) => void, duration: number) => {
    card.dataset.sdkCard = name;
    listen(card, 'pointerenter', () => { if (matchMedia('(hover:hover)').matches) set(true); }, cleanups);
    listen(card, 'pointerleave', () => { if (matchMedia('(hover:hover)').matches) set(false); }, cleanups);
    listen(card, 'focusin', () => set(true), cleanups); listen<FocusEvent>(card, 'focusout', event => { if (!card.contains(event.relatedTarget as Node)) set(false); }, cleanups);
    cards.push({ card, set, duration }); cleanups.push(() => { set(false); delete card.dataset.sdkCard; });
  };
  const sso = Array.from(root.querySelectorAll<HTMLElement>('div')).find(node => node.className === 'relative flex size-24 flex-none');
  if (sso) {
    const parent = sso.querySelector<HTMLElement>(':scope > .absolute'), card = sso.parentElement?.parentElement;
    if (parent && card) {
      const canvas = canvasAt(parent, config.expoCards.SSO), items = Array.from(sso.children).filter(node => node.className.startsWith('flex-none')) as HTMLElement[];
      let active = 4, timer = 0;
      const advance = () => {
        const previous = active; active = active + 1 === 14 ? 4 : active + 1;
        uniform(canvas, 'u_from_index', previous % 9); uniform(canvas, 'u_to_index', active % 9); fire(canvas);
        items.forEach((item, index) => { item.style.transform = `translateX(${index === active ? -6 * active : -6 * active - (index - active + (index > active ? -1 : 1)) * 1.5}rem)`; item.style.opacity = String([1, 1, .8, .6, .3][Math.abs(index - active)] || 0); const circle = item.firstElementChild as HTMLElement; if (circle) { circle.style.transform = `scale(${index === active ? 1 : .5})`; const glow = Array.from(circle.children).find(node => node.className === 'absolute inset-0 -z-10 transition duration-500 ease-[cubic-bezier(0.7,0,0.3,1)] motion-reduce:transition-none') as HTMLElement | undefined; if (glow) glow.style.opacity = index === active ? '1' : '0'; circle.querySelector('svg')?.classList.toggle('fill-white', index === active); circle.querySelector('svg')?.classList.toggle('fill-gray-400', index !== active); } });
        card.dataset.sdkStep = String(active);
      };
      bind(card, 'sso', value => { clearInterval(timer); if (value) { advance(); timer = window.setInterval(advance, reduced ? 2400 : 1200); } }, reduced ? 4800 : 2400);
      cleanups.push(() => clearInterval(timer));
    }
  }
  const passkeys = Array.from(root.querySelectorAll<HTMLElement>('div')).find(node => node.className === 'relative size-[11rem]');
  if (passkeys?.parentElement?.parentElement) {
    const canvas = canvasAt(passkeys, config.expoCards.Passkeys); let timer = 0;
    bind(passkeys.parentElement.parentElement, 'passkeys', value => { clearInterval(timer); if (reduced) uniform(canvas, 'u_reduced_motion', Number(value)); else if (value) { fire(canvas); timer = window.setInterval(() => fire(canvas), 6000); } }, 5000);
    cleanups.push(() => clearInterval(timer));
  }
  const mfa = Array.from(root.querySelectorAll<HTMLElement>('div')).find(node => node.className.includes('h-[21.75rem] overflow-hidden pt-14'));
  if (mfa?.parentElement) {
    const rows = Array.from(mfa.querySelectorAll<HTMLElement>('div')).filter(node => node.className === 'flex items-center justify-between gap-6');
    const digitControls: ReturnType<typeof animate>[] = [];
    const digits = rows.map(row => Array.from(row.querySelectorAll('span')).map(span => { const digit = motionValue(Number(span.textContent) || 0); cleanups.push(digit.on('change', current => { span.textContent = String(Math.round(current)); })); return digit; }));
    cleanups.push(() => { digitControls.forEach(control => control.stop()); digits.flat().forEach(digit => digit.destroy()); });
    const initial = [.35, .7, .2, 0], duration = reduced ? 7000 : 3500;
    let raf = 0, elapsed = 0, started = 0, active = false; const cycles = rows.map(() => 0);
    const draw = (time: number) => { if (!active) return; const clock = elapsed + time - started;
      rows.forEach((row, index) => { const value = initial[index] + clock / duration, cycle = Math.floor(value), progress = value % 1; const ring = row.lastElementChild as HTMLElement; ring.style.background = `conic-gradient(rgb(93 227 255 / 0.6) ${progress * 360}deg,rgb(93 227 255 / 0.3) ${progress * 360}deg)`; if (cycle !== cycles[index]) { cycles[index] = cycle; digitControls.push(animate(digits[index].map(digit => [digit, [null, ...Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))], { at: '-0.3', ease: [.4, 0, .2, 1], duration: .4 }]) as AnimationSequence)); } }); raf = requestAnimationFrame(draw);
    };
    bind(mfa.parentElement, 'mfa', value => { if (value === active) return; active = value; mfa.classList.toggle('opacity-50', !value); if (value) { started = performance.now(); raf = requestAnimationFrame(draw); } else { elapsed += performance.now() - started; cancelAnimationFrame(raf); } }, 3000);
    cleanups.push(() => cancelAnimationFrame(raf));
  }
  const face = root.querySelector<SVGElement>('[data-face]'), faceRoot = face?.parentElement;
  if (faceRoot?.parentElement?.parentElement) {
    const card = faceRoot.parentElement.parentElement, parent = faceRoot.parentElement.querySelector<HTMLElement>('[class*="absolute top-1/2 left-1/2 -mt-24"]');
    const canvas = parent ? canvasAt(parent, config.expoCards.LocalCredentials) : null;
    const offset = motionValue(16), radius = motionValue(20), x = motionValue(0), y = motionValue(0), controls: ReturnType<typeof animate>[] = [];
    const circles = Array.from(faceRoot.querySelectorAll('circle')), faces = Array.from(faceRoot.querySelectorAll<SVGElement>('[data-face]')), length = Math.sqrt(208) + Math.sqrt(832);
    let active = false, running = false, disposed = false, timer = 0;
    const reflect = () => { circles.forEach((circle, index) => { circle.setAttribute('cx', String(48 + ([1, -1, -1, 1][index] * offset.get()))); circle.setAttribute('cy', String(48 + ([1, 1, -1, -1][index] * offset.get()))); circle.setAttribute('r', String(radius.get())); circle.setAttribute('stroke-dasharray', `${2 * Math.PI * radius.get() / 4} 999`); }); const outline = faceRoot.firstElementChild as SVGElement; outline.style.transform = `translateX(${x.get()}rem) translateY(${y.get()}rem)`; faces.forEach((node, index) => { node.style.transform = `translateZ(${(index + 1) * .5}rem) translateX(${x.get()}rem) translateY(${y.get()}rem) scale(${index ? .5 : .75})`; }); };
    [offset, radius, x, y].forEach(value => cleanups.push(value.on('change', reflect)));
    const run = async () => { if (running || disposed) return; running = true; if (canvas) fire(canvas);
      const control = animate([[x, .25, { at: '<' }], [x, -.25, { at: '+0.2', duration: .6 }], [y, [0, .2, 0], { at: '<', duration: .6 }], [x, 0, { at: '+0.2', duration: .6 }], [faces, { opacity: [1, 0] }, { at: '-0.3' }], [offset, [16, 0], { at: '<' }], [radius, [20, 32], { at: '<' }], [faceRoot, { color: '#3AD4FD' }, { at: '<' }], [faceRoot.querySelector('[data-check]')!, { strokeDashoffset: [length, 0] }], [faceRoot.querySelector('[data-check]')!, { strokeDashoffset: -length }, { at: '+1' }], [offset, 16, {}], [radius, 20, { at: '<' }], [faceRoot, { color: '#2f3037' }, { at: '<' }], [faces, { opacity: 1 }, { at: '-0.2' }]] as AnimationSequence); controls.push(control); await control;
      if (disposed) return; timer = window.setTimeout(() => { running = false; if (active) void run(); }, 1500);
    };
    bind(card, 'local-credentials', value => { active = value; if (reduced) { offset.set(value ? 0 : 16); radius.set(value ? 32 : 20); faces.forEach(node => { node.style.opacity = value ? '0' : '1'; }); (faceRoot.querySelector('[data-check]') as SVGElement).style.strokeDashoffset = String(value ? 0 : length); } else if (value) void run(); }, 5000);
    cleanups.push(() => { disposed = true; clearTimeout(timer); controls.forEach(control => control.stop()); [offset, radius, x, y].forEach(value => value.destroy()); });
  }
  const security = Array.from(root.querySelectorAll<HTMLElement>('ul')).find(node => node.textContent?.includes('SOC2 Type II') && node.textContent.includes('HIPAA'));
  if (security) {
    let timer = 0, index = 0;
    const observer = new IntersectionObserver(([entry]) => { clearInterval(timer); if (entry.isIntersecting) timer = window.setInterval(() => { index = (index + 1) % 3; Array.from(security.children).forEach((item, i) => { const spans = item.querySelectorAll<HTMLElement>('p > span'); spans.forEach((span, j) => { span.style.opacity = Number(i === index) === 1 - j ? '1' : '0'; }); }); }, 3000); }); observer.observe(security); cleanups.push(() => { clearInterval(timer); observer.disconnect(); });
  }
  if (matchMedia('(hover:none)').matches && cards.length) {
    const visible = new Set<number>(); let index = -1, timer = 0;
    const next = () => { if (index >= 0) cards[index].set(false); const choices = [...visible].sort((a, b) => a - b); index = choices.find(value => value > index) ?? choices[0] ?? -1; if (index >= 0) { cards[index].set(true); timer = window.setTimeout(next, cards[index].duration); } };
    const observer = new IntersectionObserver(entries => { entries.forEach(entry => { const i = cards.findIndex(card => card.card === entry.target); if (entry.isIntersecting) visible.add(i); else visible.delete(i); }); if (index < 0 || !visible.has(index)) { clearTimeout(timer); next(); } }, { threshold: .9 }); cards.forEach(({ card }) => observer.observe(card)); cleanups.push(() => { clearTimeout(timer); observer.disconnect(); });
  }
  return () => cleanups.forEach(stop => stop());
}

export default function SdkPages({ route }: { route: string }) {
  useEffect(() => {
    const cleanups: Cleanup[] = []; let disposed = false;
    void data().then(config => {
      if (disposed) return; const root = document.querySelector<HTMLElement>('main'); if (!root) return;
      cleanups.push(hero(root, route, config), carousel(root));
      if (route === '/react-authentication') cleanups.push(frameworkTabs(root, config), sdkCanvasEffects(root, route, config), sdkReactDecorations(root));
      if (route === '/nextjs-authentication') cleanups.push(configurator(root, config), codeExamples(root, config), quotes(root, config), video(root, config), sdkCanvasEffects(root, route, config), sdkInstallCounter(root, config.installationTotal));
      if (route === '/expo-authentication') cleanups.push(expoSecurity(root, config), expoTour(root, config.expoTabs));
      root.dataset.sdkPage = route; cleanups.push(() => { delete root.dataset.sdkPage; });
    });
    return () => { disposed = true; cleanups.forEach(stop => stop()); };
  }, [route]);
  return null;
}
