'use client';

import { useEffect } from 'react';
import { animate } from 'motion';
import menus from './navigation/menus.json';
import headerThemeDefaults from '../content/header-theme-defaults.json';
import './navigation.css';

type MenuName = keyof typeof menus.desktop;
const EASE_OUT = [0.33, 1, 0.68, 1] as const;

/** Adds behavior to the server-rendered header without changing its resting layout. */
export function Navigation() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('#header');
    if (!header) return;
    const abort = new AbortController();
    const options = { signal: abort.signal };
    const triggers = new Map<HTMLButtonElement, MenuName>();
    const originalAttributes = new Map<HTMLButtonElement, { id: string; controls: string | null }>();
    const retired = new Set<HTMLElement>();
    let active: { name: MenuName; panel: HTMLElement; trigger: HTMLButtonElement } | null = null;
    let mobile: HTMLElement | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let bodyOverflow = '';
    let rootOverflow = '';
    let themeFrame = 0;
    let productHref = '';
    const initialHeaderClass = header.className;
    const initialHeaderMargin = header.style.getPropertyValue('--header-mt-mobile');
    const initialHeaderZ = header.style.zIndex;
    const blurMask = header.querySelector<HTMLElement>('[style*="--mask-opacity"]');
    const initialMaskOpacity = blurMask?.style.getPropertyValue('--mask-opacity') || '';
    let inertElements: { element: HTMLElement; inert: boolean }[] = [];
    const mobileToggle = header.querySelector<HTMLButtonElement>('button[aria-controls="mobile-navigation"]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = (value: number) => reducedMotion ? 0 : value;

    for (const button of header.querySelectorAll<HTMLButtonElement>('nav[aria-label="Main"] button[aria-controls]')) {
      const name = button.textContent?.trim() as MenuName;
      if (!(name in menus.desktop)) continue;
      originalAttributes.set(button, { id: button.id, controls: button.getAttribute('aria-controls') });
      button.id = `aurora-nav-${name.toLowerCase()}-trigger`;
      button.setAttribute('aria-controls', `aurora-nav-${name.toLowerCase()}-panel`);
      triggers.set(button, name);
    }

    function elementFromHtml(html: string) {
      const template = document.createElement('template');
      template.innerHTML = html;
      return template.content.firstElementChild as HTMLElement;
    }

    function cancelClose() {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = undefined;
    }

    function retire(element: HTMLElement, seconds: number) {
      element.style.pointerEvents = 'none';
      element.setAttribute('aria-hidden', 'true');
      retired.add(element);
      const animation = animate(element, { opacity: 0 }, { duration: duration(seconds), ease: EASE_OUT });
      void animation.then(() => { element.remove(); retired.delete(element); });
    }

    function closeDesktop(restoreFocus = false) {
      cancelClose();
      if (!active) return;
      const previous = active;
      active = null;
      productHref = '';
      previous.trigger.setAttribute('aria-expanded', 'false');
      previous.trigger.dataset.state = 'closed';
      retire(previous.panel, 0.2);
      if (restoreFocus) previous.trigger.focus();
    }

    function showDesktop(trigger: HTMLButtonElement, focusFirst = false) {
      const name = triggers.get(trigger);
      if (!name || window.innerWidth < 768) return;
      cancelClose();
      if (active?.name === name) {
        if (focusFirst) active.panel.querySelector<HTMLElement>('a,button')?.focus();
        return;
      }
      closeDesktop();
      for (const old of retired) { old.remove(); retired.delete(old); }
      const panel = elementFromHtml(menus.desktop[name]);
      panel.style.opacity = '0';
      panel.style.transform = 'scale(0.97)';
      trigger.parentElement!.append(panel);
      trigger.dataset.state = 'open';
      trigger.setAttribute('aria-expanded', 'true');
      active = { name, panel, trigger };
      animate(panel, { opacity: 1, transform: 'scale(1)' }, reducedMotion ? { duration: 0 } : {
        transform: { type: 'spring', stiffness: 400, damping: 50 },
      });
      if (focusFirst) panel.querySelector<HTMLElement>('a,button')?.focus();
    }

    function showProductDetails(link: HTMLAnchorElement) {
      if (active?.name !== 'Products') return;
      const href = link.getAttribute('href') as keyof typeof menus.products;
      if (!href || !(href in menus.products) || productHref === href) return;
      productHref = href;
      const details = menus.products[href];
      const grid = active.panel.firstElementChild as HTMLElement;
      const aside = grid.children[1] as HTMLElement;
      if (!aside) return;
      grid.style.gridTemplateColumns = details.columns;
      aside.innerHTML = details.aside;
      for (const item of details.links) {
        const anchor = [...grid.children[0].querySelectorAll<HTMLAnchorElement>('a')].find((candidate) => candidate.getAttribute('href') === item.href);
        if (anchor) anchor.className = item.className;
      }
      if (aside.firstElementChild) animate(aside.firstElementChild, { opacity: [0, 1] }, { duration: duration(0.2), ease: EASE_OUT });
    }

    function updateHeaderTheme() {
      themeFrame = 0;
      let current: HTMLElement | null = null;
      let nearest = -Infinity;
      for (const section of document.querySelectorAll<HTMLElement>('[data-section],[data-header-theme]')) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 64 && rect.bottom > 64 && rect.top > nearest) {
          current = section;
          nearest = rect.top;
        }
      }
      const nativeDefault=(headerThemeDefaults as Record<string,string>)[location.pathname.replace(/\/$/,'')||'/'];
      const defaultDark=nativeDefault ? nativeDefault==='dark' : ['/agents','/company','/creators','/expo-authentication','/nextjs-authentication','/pricing','/react-authentication','/llm-leaderboard'].some(route=>location.pathname.startsWith(route));
      const dark = current
        ? current.dataset.headerTheme ? current.dataset.headerTheme==='dark' : current.dataset.section === 'authentication' || current.dataset.section === 'integrations'
        : defaultDark || (location.pathname.startsWith('/docs')&&document.documentElement.classList.contains('dark'));
      header!.classList.toggle('dark', dark);
      header!.classList.toggle('light', !dark);
      blurMask?.style.setProperty('--mask-opacity', String(mobile ? 1 : Math.min(Math.max(window.scrollY / 300, 0), 1)));
    }

    function scheduleTheme() {
      if (!themeFrame) themeFrame = requestAnimationFrame(updateHeaderTheme);
    }

    function scheduleClose() {
      cancelClose();
      closeTimer = setTimeout(() => closeDesktop(), 150);
    }

    function setToggleIcon(open: boolean) {
      const paths = mobileToggle?.querySelectorAll('svg path');
      if (!paths || paths.length < 2) return;
      paths[0].setAttribute('d', open ? 'M4 4L12 12' : 'M4 4.667L12 4.667');
      paths[1].setAttribute('d', open ? 'M12 4L4 12' : 'M4 11.333L12 11.333');
    }

    function closeMobile(restoreFocus = false, immediate = false) {
      if (!mobile) return;
      const previous = mobile;
      mobile = null;
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      for (const item of inertElements) item.element.inert = item.inert;
      inertElements = [];
      mobileToggle?.setAttribute('aria-expanded', 'false');
      mobileToggle?.setAttribute('aria-label', 'Open navigation');
      header!.style.setProperty('--header-mt-mobile', initialHeaderMargin);
      header!.style.zIndex = initialHeaderZ;
      setToggleIcon(false);
      if (immediate) previous.remove();
      else retire(previous, 0.25);
      if (restoreFocus) mobileToggle?.focus();
      scheduleTheme();
    }

    function openMobile() {
      closeDesktop();
      for (const old of retired) { old.remove(); retired.delete(old); }
      mobile = elementFromHtml(menus.mobile);
      mobile.dataset.auroraMobile = 'true';
      header!.append(mobile);
      mobileToggle?.setAttribute('aria-expanded', 'true');
      mobileToggle?.setAttribute('aria-label', 'Close navigation');
      header!.style.setProperty('--header-mt-mobile', '0');
      header!.style.zIndex = '100';
      setToggleIcon(true);
      bodyOverflow = document.body.style.overflow;
      rootOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      inertElements = [...document.querySelectorAll<HTMLElement>('main,footer')].filter((element) => !header!.contains(element)).map((element) => ({ element, inert: element.inert }));
      for (const item of inertElements) item.element.inert = true;
      animate(mobile, { opacity: [0, 1] }, { duration: duration(0.25), ease: EASE_OUT });
      mobile.querySelector<HTMLElement>('button,a')?.focus({ preventScroll: true });
      scheduleTheme();
    }

    function toggleMobileSection(button: HTMLButtonElement) {
      if (!mobile) return;
      const id = button.getAttribute('aria-controls');
      const panel = id ? document.getElementById(id) : null;
      if (!panel || !mobile.contains(panel)) return;
      const opening = button.getAttribute('aria-expanded') !== 'true';
      for (const other of mobile.querySelectorAll<HTMLButtonElement>('button[aria-controls]')) {
        other.setAttribute('aria-expanded', 'false');
        const section = document.getElementById(other.getAttribute('aria-controls')!);
        if (section) section.hidden = true;
      }
      button.setAttribute('aria-expanded', String(opening));
      panel.hidden = !opening;
    }

    header.addEventListener('pointerover', (event) => {
      if (event.pointerType === 'touch') return;
      const target = event.target as Element;
      const button = target.closest<HTMLButtonElement>('button');
      if (button && triggers.has(button)) showDesktop(button);
      else if (active?.panel.contains(target)) {
        cancelClose();
        const link = target.closest<HTMLAnchorElement>('a');
        if (link) showProductDetails(link);
      }
      else if (active && target.closest('[data-navitem]')) scheduleClose();
    }, options);
    header.addEventListener('pointerout', (event) => {
      if (!active || event.pointerType === 'touch') return;
      const next = event.relatedTarget as Node | null;
      if (!next || !active.trigger.parentElement?.contains(next)) scheduleClose();
    }, options);
    header.addEventListener('click', (event) => {
      const target = event.target as Element;
      const button = target.closest<HTMLButtonElement>('button');
      if (button === mobileToggle) {
        event.preventDefault();
        if (mobile) closeMobile(true);
        else openMobile();
      } else if (button && mobile?.contains(button) && button.hasAttribute('aria-controls')) {
        event.preventDefault();
        toggleMobileSection(button);
      } else if (button && triggers.has(button)) {
        event.preventDefault();
        if (active?.trigger === button) closeDesktop();
        else showDesktop(button);
      } else if (button && /^Sign in(?:Sign in)?$/.test(button.textContent?.trim() || '')) {
        event.preventDefault();
        window.location.assign('/sign-in');
      } else if (target.closest('a')) {
        closeDesktop();
        closeMobile();
      }
    }, options);
    header.addEventListener('focusout', (event) => {
      if (!mobile && !header.contains(event.relatedTarget as Node | null)) closeDesktop();
    }, options);
    header.addEventListener('focusin', (event) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('a');
      if (link) showProductDetails(link);
    }, options);
    document.addEventListener('pointerdown', (event) => {
      const target = event.target as Node;
      if (active && !active.trigger.parentElement?.contains(target)) closeDesktop();
      if (!header.contains(target)) closeMobile();
    }, options);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (mobile) { event.preventDefault(); closeMobile(true); }
        else if (active) { event.preventDefault(); closeDesktop(true); }
        return;
      }
      const focused = document.activeElement as HTMLButtonElement;
      if (triggers.has(focused) && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') showDesktop(focused, true);
        else {
          const buttons = [...triggers.keys()];
          const index = buttons.indexOf(focused);
          const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
          next.focus();
          if (active) showDesktop(next);
        }
      }
      if (mobile && event.key === 'Tab') {
        const controls = [mobileToggle, ...mobile.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),[tabindex="0"]')].filter((element): element is HTMLElement => !!element && element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !header.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }, options);
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768) closeMobile(false, true);
      else closeDesktop();
      scheduleTheme();
    }, options);
    window.addEventListener('scroll', scheduleTheme, { ...options, passive: true });
    const themeObserver=new MutationObserver(scheduleTheme);
    themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
    updateHeaderTheme();

    return () => {
      abort.abort();
      themeObserver.disconnect();
      cancelClose();
      active?.panel.remove();
      closeMobile(false, true);
      cancelAnimationFrame(themeFrame);
      header.className = initialHeaderClass;
      header.style.setProperty('--header-mt-mobile', initialHeaderMargin);
      header.style.zIndex = initialHeaderZ;
      blurMask?.style.setProperty('--mask-opacity', initialMaskOpacity);
      for (const element of retired) element.remove();
      for (const [button, attributes] of originalAttributes) {
        button.id = attributes.id;
        if (attributes.controls) button.setAttribute('aria-controls', attributes.controls);
        button.setAttribute('aria-expanded', 'false');
        button.dataset.state = 'closed';
      }
    };
  }, []);

  return null;
}

export default Navigation;
