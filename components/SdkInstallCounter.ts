'use client';

import { animate, motionValue } from 'motion';

export type InstallCounterData = { number: number; label: string; typingDuration: number; delay: number; transformTiming: { duration: number; easing: string }; opacityTiming: { duration: number; easing: string }; continuous: boolean };

export function sdkInstallCounter(root: HTMLElement, data: InstallCounterData) {
  const flow = root.querySelector<HTMLElement>('header number-flow-react'), number = flow?.querySelector<HTMLElement>(':scope > span'), host = flow?.closest('p'), label = host?.querySelector<HTMLElement>(':scope > span'), fade = flow?.parentElement;
  if (!flow || !number || !host || !label || !fade) return () => {};
  const original = { html: number.innerHTML, label: label.textContent, numberStyle: number.getAttribute('style'), opacity: fade.style.opacity, role: flow.getAttribute('role'), aria: flow.getAttribute('aria-label') };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, text = motionValue(0), animations: Animation[] = [];
  let timer = 0, settle = 0, started = false, typing: ReturnType<typeof animate> | undefined;
  const stopText = text.on('change', value => { label.textContent = data.label.slice(0, Math.round(value)); });
  const formatted = new Intl.NumberFormat('en-US').format(data.number);
  label.textContent = ''; fade.style.opacity = '0'; flow.setAttribute('role', 'img'); flow.setAttribute('aria-label', '0'); host.dataset.sdkInstallState = 'waiting';
  for (const [name, syntax] of [['--sdk-counter-delta', '<number>'], ['--sdk-counter-dx', '<length>'], ['--sdk-counter-width-delta', '<number>']]) {
    try { CSS.registerProperty({ name, syntax, inherits: true, initialValue: syntax === '<length>' ? '0px' : '0' }); } catch { /* The property is shared by subsequent mounts. */ }
  }
  const finish = () => { number.textContent = formatted; if (original.numberStyle === null) number.removeAttribute('style'); else number.setAttribute('style', original.numberStyle); host.dataset.sdkInstallState = 'complete'; };
  const update = () => {
    host.dataset.sdkInstallState = 'spinning'; flow.setAttribute('aria-label', formatted);
    animations.push(fade.animate({ opacity: [0, 1] }, { duration: 300, easing: 'ease-out', fill: 'forwards' }));
    if (reduced) { finish(); return; }
    const oldRect = number.getBoundingClientRect(); number.replaceChildren(); number.style.padding = '0';
    const wrapper = document.createElement('span'), inner = document.createElement('span'); wrapper.append(inner); number.append(wrapper);
    Object.assign(wrapper.style, { display: 'inline-block', position: 'relative', transformOrigin: 'left top', margin: '0 -.5em', transform: 'translateX(var(--sdk-counter-dx)) scaleX(calc(1 + var(--sdk-counter-width-delta) / var(--sdk-counter-width)))', maskImage: 'linear-gradient(to bottom,transparent 0,#000 .25em,#000 calc(100% - .25em),transparent 100%)' });
    Object.assign(inner.style, { display: 'inline-block', padding: '.125em .5em', transformOrigin: 'left top', transform: 'scaleX(calc(1 / (1 + var(--sdk-counter-width-delta) / var(--sdk-counter-width)))) translateX(calc(-1 * var(--sdk-counter-dx)))' });
    [...formatted].forEach((char, index) => {
      const digit = document.createElement('span'); digit.style.display = 'inline-block'; digit.style.position = 'relative'; digit.setAttribute('aria-hidden', 'true'); inner.append(digit);
      if (!/\d/.test(char)) { digit.textContent = char; animations.push(digit.animate({ opacity: [0, 1] }, data.opacityTiming)); return; }
      const value = Number(char), delta = value || (data.continuous ? 10 : 0);
      digit.style.setProperty('--sdk-counter-current', String(value)); digit.style.setProperty('--sdk-counter-delta', '0');
      for (let n = 0; n < 10; n++) {
        const glyph = document.createElement('span'); glyph.textContent = String(n); glyph.style.display = 'inline-block'; glyph.style.padding = '.125em 0';
        glyph.style.setProperty('--sdk-counter-offset', `mod(10 + ${n} - mod(var(--sdk-counter-current) + var(--sdk-counter-delta),10),10)`);
        glyph.style.setProperty('--sdk-counter-wrap', 'calc(var(--sdk-counter-offset) - 10 * round(down,var(--sdk-counter-offset) / 5,1))');
        glyph.style.transform = `${n === value ? '' : 'translateX(-50%) '}translateY(clamp(-100%,calc(var(--sdk-counter-wrap) * 100%),100%))`;
        if (n !== value) { glyph.style.position = 'absolute'; glyph.style.top = '0'; glyph.style.left = '50%'; }
        digit.append(glyph);
      }
      animations.push(digit.animate({ '--sdk-counter-delta': [String(-delta), '0'] }, data.transformTiming));
      if (index < formatted.length - 1) animations.push(digit.animate({ opacity: [0, 1] }, data.opacityTiming));
    });
    const rect = number.getBoundingClientRect(), width = wrapper.offsetWidth;
    wrapper.style.setProperty('--sdk-counter-width', String(width)); wrapper.style.setProperty('--sdk-counter-dx', '0px'); wrapper.style.setProperty('--sdk-counter-width-delta', '0');
    animations.push(wrapper.animate({ '--sdk-counter-dx': [`${oldRect.left - rect.left}px`, '0px'], '--sdk-counter-width-delta': [String(oldRect.width - rect.width), '0'] }, data.transformTiming));
    settle = window.setTimeout(finish, data.transformTiming.duration);
  };
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting || entry.intersectionRatio < 1 || started) return;
    started = true; observer.disconnect(); host.dataset.sdkInstallState = 'typing';
    typing = animate(text, data.label.length, { duration: reduced ? 0 : data.typingDuration, ease: 'easeInOut' });
    timer = window.setTimeout(update, data.delay);
  }, { threshold: 1 }); observer.observe(host);
  return () => {
    observer.disconnect(); clearTimeout(timer); clearTimeout(settle); typing?.stop(); stopText(); text.destroy(); animations.forEach(animation => animation.cancel());
    number.innerHTML = original.html; label.textContent = original.label; fade.style.opacity = original.opacity;
    if (original.numberStyle === null) number.removeAttribute('style'); else number.setAttribute('style', original.numberStyle);
    for (const [name, value] of [['role', original.role], ['aria-label', original.aria]]) { if (value === null) flow.removeAttribute(name!); else flow.setAttribute(name!, value!); }
    delete host.dataset.sdkInstallState;
  };
}
