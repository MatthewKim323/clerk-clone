import { animate, type AnimationPlaybackControls } from 'motion';

type Cleanup = () => void;

const seeded = (seed: number) => {
  const value = 1e4 * Math.sin(seed);
  return value - Math.floor(value);
};

/** Attach the native keyring, shield, and security label motion to captured markup. */
export function sdkReactDecorations(root: HTMLElement): Cleanup {
  const cleanups: Cleanup[] = [];
  const originals = new Map<HTMLElement, { style: string | null; className: string | null }>();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const remember = (element: HTMLElement) => {
    if (!originals.has(element)) originals.set(element, {
      style: element.getAttribute('style'), className: element.getAttribute('class'),
    });
  };

  const visibility = (host: HTMLElement, change: (active: boolean) => void) => {
    const box = host.getBoundingClientRect();
    let visible = box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth;
    let active: boolean | undefined;
    const update = () => {
      const next = visible && !document.hidden && !reduced.matches;
      if (next !== active) { active = next; change(next); }
    };
    const observer = new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting;
      update();
    });
    observer.observe(host);
    document.addEventListener('visibilitychange', update);
    reduced.addEventListener('change', update);
    cleanups.push(() => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      reduced.removeEventListener('change', update);
    });
    update();
  };

  for (const group of root.querySelectorAll<HTMLElement>('[data-animate="group"]')) {
    const keys = Array.from(group.querySelectorAll<HTMLElement>('[data-animate="key"]'));
    const host = group.parentElement?.parentElement;
    if (!host || keys.length !== 2 || !keys.every(key => key.querySelector('img'))) continue;
    [group, ...keys].forEach(remember);
    let active = false;
    let control: AnimationPlaybackControls | undefined;
    visibility(host, next => {
      active = next;
      if (next && control?.state === 'paused') control.play();
      else if (!next && control?.state === 'running') control.pause();
    });
    const hover = (event: PointerEvent) => {
      if (!active || event.pointerType === 'touch') return;
      control?.stop();
      control = animate([
        [group, { transform: 'rotate(5deg) translateY(-0.5rem)' }, { duration: .2, ease: 'easeOut' }],
        [keys, { transform: 'rotate(-8deg)' }, { at: '<', duration: .2, ease: 'easeOut' }],
        [group, { transform: 'rotate(0deg) translateY(0rem)' }, { type: 'spring', duration: .5, bounce: .5 }],
        [keys, { transform: 'rotate(0deg)' }, { at: '<', type: 'spring', duration: .7, bounce: .7 }],
      ]);
    };
    host.addEventListener('pointerenter', hover);
    cleanups.push(() => { host.removeEventListener('pointerenter', hover); control?.stop(); });
  }

  const shieldHosts = new Set<HTMLElement>();
  for (const line of root.querySelectorAll<HTMLElement>('[data-line]')) {
    const host = line.parentElement?.parentElement?.parentElement;
    if (host?.classList.contains('h-[7.625rem]')) shieldHosts.add(host);
  }
  for (const host of shieldHosts) {
    const lines = Array.from(host.querySelectorAll<HTMLElement>('[data-line]'));
    const rays = Array.from(host.querySelectorAll<HTMLElement>('[class~="from-[#545454]"]'));
    if (lines.length !== 27 || rays.length !== 9) continue;
    [...lines, ...rays].forEach(remember);
    const controls: AnimationPlaybackControls[] = [];
    let started = false;
    visibility(host, active => {
      if (active && !started) {
        started = true;
        lines.forEach((line, index) => controls.push(animate(line, {
          transform: ['translateX(0%)', 'translateX(50%)'],
        }, { duration: 4, repeat: Infinity, ease: 'linear', delay: -.2 * index })));
        rays.forEach((ray, index) => {
          const timing = {
            duration: 5 + 2 * seeded(985.23 * index),
            repeat: Infinity,
            ease: 'linear' as const,
            delay: 10 * seeded(3834.56 * index),
          };
          controls.push(animate(ray, {
            transform: ['translateX(12.5rem)', 'translateX(-12.5rem)'],
            opacity: [0, 1],
          }, { ...timing, opacity: { ...timing, times: [0, .1] } }));
        });
      }
      for (const control of controls) { if (active) control.play(); else control.pause(); }
    });
    cleanups.push(() => controls.forEach(control => control.stop()));
  }

  for (const list of root.querySelectorAll<HTMLElement>('ul[role="list"]')) {
    const items = Array.from(list.querySelectorAll<HTMLElement>(':scope > li > p'));
    if (items.length !== 3 || items.map(item => item.firstElementChild?.textContent?.trim()).join('|') !== 'SOC2 Type II|HIPAA|CCPA') continue;
    const labels = items.map(item => Array.from(item.querySelectorAll<HTMLElement>(':scope > span')));
    if (labels.some(pair => pair.length !== 2)) continue;
    labels.flat().forEach(remember);
    let index = Math.max(0, labels.findIndex(pair => pair[0].classList.contains('opacity-100')));
    let timer: number | undefined;
    let active = false;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (!active) return;
        index = (index + 1) % labels.length;
        labels.forEach(([fill, outline], item) => {
          fill.classList.toggle('opacity-100', item === index);
          fill.classList.toggle('opacity-0', item !== index);
          outline.classList.toggle('opacity-100', item !== index);
          outline.classList.toggle('opacity-0', item === index);
        });
        schedule();
      }, 3000);
    };
    visibility(list, next => {
      active = next;
      window.clearTimeout(timer);
      for (const label of labels.flat()) {
        for (const transition of label.getAnimations()) {
          if (next) transition.play(); else transition.pause();
        }
      }
      if (next) schedule();
    });
    cleanups.push(() => {
      window.clearTimeout(timer);
      labels.flat().forEach(label => label.getAnimations().forEach(transition => transition.cancel()));
    });
  }

  return () => {
    cleanups.reverse().forEach(cleanup => cleanup());
    originals.forEach(({ style, className }, element) => {
      if (style === null) element.removeAttribute('style'); else element.setAttribute('style', style);
      if (className === null) element.removeAttribute('class'); else element.setAttribute('class', className);
    });
  };
}
