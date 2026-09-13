'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import './page-controls.css';

type Preferences = { marketingAndAnalytics: boolean; advertising: boolean };
const storageKey = 'aurora-cookie-preferences';
const categories = [
  { key: 'essential', name: 'Essential', description: 'We use browser cookies that are necessary for the site to work as intended. For example, we store your website data collection preferences so we can honor them if you return to our site. You can disable these cookies in your browser settings but if you do the site may not work as intended.' },
  { key: 'marketingAndAnalytics', name: 'Marketing and Analytics', description: 'To understand user behaviour in order to provide you with a more relevant browsing experience or personalise the content on our site. For example, we collect information about which pages you visit to help us present more relevant information.' },
  { key: 'advertising', name: 'Advertising', description: 'To personalize and measure the effectiveness of advertising on our site and other websites. For example, we may serve you a personalized ad based on the pages you visit on our site.' },
] as const;
const supportLinks = [
  { text: 'Read documentation', href: '/docs', path: 'M10 4.792 3.75 3.75v11.458L10 16.25m0-11.458V16.25m0-11.458 6.25-1.042v11.458L10 16.25' },
  { text: 'Book a sales call', href: '/contact/sales', path: 'M8.504 6.814 6.29 3.75 5.072 4.875c-1.279 1.18-1.75 3.012-.876 4.517a17.8 17.8 0 0 0 2.776 3.636 17.799 17.799 0 0 0 3.636 2.776c1.505.873 3.337.403 4.517-.876l1.125-1.219-3.32-2.213-1.568.784a1 1 0 0 1-1.155-.187L7.885 9.77a1 1 0 0 1-.206-1.116l.825-1.84Z' },
  { text: 'Contact support', href: '/contact/support', path: 'M10 15.25c3.452 0 6.25-2.574 6.25-5.75S13.452 3.75 10 3.75 3.75 6.324 3.75 9.5c0 1.108.34 2.143.931 3.021.225.334.287.762.091 1.113A16.91 16.91 0 0 1 3.75 15.25c.873 0 2.06-.119 3.223-.442.233-.065.48-.05.707.033.718.264 1.5.409 2.32.409Z' },
];

function readPreferences(): Preferences {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return JSON.parse(saved);
    const all = localStorage.getItem('aurora-cookie-choice') === 'all';
    return { marketingAndAnalytics: all, advertising: all };
  } catch { return { marketingAndAnalytics: false, advertising: false }; }
}

function cookieNotice(element: HTMLElement) {
  const standard = element.closest<HTMLElement>('.font-inter');
  if (standard?.textContent?.includes('We use cookies')) return standard;
  const publicBanner = element.closest<HTMLElement>('.rich-text-info');
  if (publicBanner?.textContent?.includes('Cookies and tracking')) return publicBanner.parentElement?.classList.contains('bg-main') ? publicBanner.parentElement : publicBanner;
  return null;
}

function hideCookieNotice() {
  document.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
    if (button.textContent?.trim() === 'Accept') {
      const notice = cookieNotice(button);
      if (notice) { notice.classList.add('pc-cookie-notice'); notice.hidden = true; }
    }
  });
}

// Captured overlays and module-166e971b54c74fc5.js / module-b2a34c2cb5e1ef92.js.
export function PageControls() {
  const [ready, setReady] = useState(false);
  const [preferences, setPreferences] = useState(false);
  const [support, setSupport] = useState(false);
  const [values, setValues] = useState<Preferences>({ marketingAndAnalytics: false, advertising: false });
  const [initialValues, setInitialValues] = useState(values);
  const [advertisingFocus, setAdvertisingFocus] = useState(false);
  const [privacySignal, setPrivacySignal] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const preferenceRef = useRef<HTMLElement>(null), supportRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    setReady(true);
    const timers = new Set<number>();
    if (localStorage.getItem('aurora-cookie-choice')) hideCookieNotice();
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element).closest<HTMLElement>('button, a');
      if (!target) return;
      const text = target.textContent?.trim() || '';
      const cookie = cookieNotice(target);
      if (cookie && ['Accept', 'Decline'].includes(text)) {
        const enabled = text === 'Accept' && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
        localStorage.setItem('aurora-cookie-choice', enabled ? 'all' : 'essential');
        localStorage.setItem(storageKey, JSON.stringify({ marketingAndAnalytics: enabled, advertising: enabled }));
        hideCookieNotice();
      } else if (/change your preferences|Cookie manager|Do Not Sell or Share My Personal Information/i.test(text) || text === 'choose which' && cookie) {
        event.preventDefault(); triggerRef.current = target;
        const gpc = Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
        const next = gpc ? { marketingAndAnalytics: false, advertising: false } : readPreferences();
        setPrivacySignal(gpc); setValues(next); setInitialValues(next);
        setHasSaved(Boolean(localStorage.getItem(storageKey)));
        setAdvertisingFocus(/Do Not Sell/i.test(text)); setSupport(false); setPreferences(true);
      } else if (text === 'Support') {
        event.preventDefault(); triggerRef.current = target; setSupport(current => !current);
      } else if (target.closest('[data-section="hero"]') && text.includes('Add Aurora auth')) {
        event.preventDefault();
        void navigator.clipboard.writeText('Add Aurora auth to my app: aurora.com/SKILL.md').then(() => {
          const before = target.getAttribute('aria-label');
          target.setAttribute('aria-label', 'Copied to clipboard'); target.dataset.copied = 'true';
          const timer = window.setTimeout(() => { timers.delete(timer); target.removeAttribute('data-copied'); if (before) target.setAttribute('aria-label', before); else target.removeAttribute('aria-label'); }, 2000);
          timers.add(timer);
        }).catch(() => {});
      }
    };
    document.addEventListener('click', onClick);
    return () => { document.removeEventListener('click', onClick); timers.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    if (!preferences && !support) return;
    const dialog = preferences ? preferenceRef.current : supportRef.current;
    const trigger = triggerRef.current;
    trigger?.setAttribute('aria-expanded', 'true');
    const oldOverflow = document.body.style.overflow;
    const inertNodes: HTMLElement[] = [];
    if (preferences) {
      document.body.style.overflow = 'hidden';
      [...document.body.children].forEach(node => { if (node instanceof HTMLElement && !node.contains(dialog) && !node.inert) { node.inert = true; inertNodes.push(node); } });
    }
    const focusTarget = advertisingFocus && preferences ? dialog?.querySelector<HTMLElement>('[data-pc-advertising-focus]') : dialog;
    focusTarget?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setPreferences(false); setSupport(false); trigger?.focus({ preventScroll: true }); }
      if (preferences && event.key === 'Tab' && dialog) {
        const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')];
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const onPointer = (event: PointerEvent) => { if (support && !dialog?.contains(event.target as Node) && !trigger?.contains(event.target as Node)) setSupport(false); };
    document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer);
      inertNodes.forEach(node => { node.inert = false; });
      if (preferences) document.body.style.overflow = oldOverflow;
      trigger?.setAttribute('aria-expanded', 'false');
      if (preferences && trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [preferences, support, advertisingFocus]);

  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify(values));
    localStorage.setItem('aurora-cookie-choice', values.marketingAndAnalytics && values.advertising ? 'all' : values.marketingAndAnalytics || values.advertising ? 'custom' : 'essential');
    hideCookieNotice(); setPreferences(false);
  };
  let optOutNotice = 'To opt out of the sale or sharing of your personal information, turn off Advertising below and save your settings.';
  if (privacySignal) optOutNotice = 'You are already opted out of the sale or sharing of your personal information.';
  else if (values.advertising !== initialValues.advertising) optOutNotice = values.advertising ? 'Saving these settings will turn on Advertising and allow the sale or sharing of your personal information.' : 'Save your settings to opt out of the sale or sharing of your personal information.';
  else if (!initialValues.advertising) optOutNotice = hasSaved ? 'You are already opted out of the sale or sharing of your personal information.' : 'Advertising is currently off. Save your settings to record your opt-out of the sale or sharing of your personal information.';

  return <>
    {preferences && createPortal(<div className="pc-backdrop" style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} onClick={event => { if (event.target === event.currentTarget) setPreferences(false); }}>
      <section className="pc-preferences" ref={preferenceRef} role="dialog" aria-modal="true" aria-labelledby="pc-preferences-title" tabIndex={-1}>
        <div className="pc-preferences-header">
          <div className="pc-preferences-heading"><div><h2 id="pc-preferences-title">Website Data Collection Preferences</h2><p>We use data collected by cookies and JavaScript libraries to improve your browsing experience, analyze site traffic, deliver personalized advertisements, and increase the overall performance of our site.</p></div><button className="pc-close" aria-label="Close preferences" onClick={() => setPreferences(false)}><svg viewBox="0 0 512 512" aria-hidden="true"><path d="m289.94 256 95-95A24 24 0 0 0 351 127l-95 95-95-95a24 24 0 0 0-34 34l95 95-95 95a24 24 0 1 0 34 34l95-95 95 95a24 24 0 0 0 34-34z" fill="currentColor" /></svg></button></div>
          {advertisingFocus && <div className="pc-notice" data-pc-advertising-focus tabIndex={-1} aria-live="polite">{optOutNotice}</div>}
          {privacySignal && <div className="pc-notice" id="pc-gpc-notice">Global Privacy Control is enabled in your browser, so optional data collection is turned off and cannot be changed here. <a href="https://globalprivacycontrol.org/" target="_blank" rel="noopener noreferrer">Learn more</a>.</div>}
        </div>
        <div className="pc-preference-list">{categories.map(category => {
          const essential = category.key === 'essential';
          const selected = essential || values[category.key as keyof Preferences];
          return <div className="pc-preference-row" key={category.key}><label data-selected={selected || undefined} data-disabled={essential || privacySignal || undefined}>
            <span className="pc-visually-hidden"><input type="checkbox" role="switch" aria-label={category.name} aria-describedby={`pc-${category.key}-description${privacySignal && !essential ? ' pc-gpc-notice' : ''}`} checked={selected} disabled={essential || privacySignal} onChange={() => { if (!essential) setValues(previous => ({ ...previous, [category.key]: !previous[category.key as keyof Preferences] })); }} /></span>
            <span className="pc-preference-label">{category.name}</span>{!essential && <span className="pc-switch" aria-hidden="true"><span /></span>}
          </label><p id={`pc-${category.key}-description`} className={essential ? '' : 'pc-optional-description'}>{category.description}</p></div>;
        })}</div>
        <div className="pc-preferences-footer"><div><button onClick={() => setPreferences(false)}>Cancel</button><button className="pc-save" disabled={privacySignal} onClick={save}>Save settings</button></div></div>
      </section>
    </div>, document.body)}
    {ready && createPortal(<AnimatePresence>{support && <motion.aside ref={supportRef} className="pc-support" role="dialog" aria-labelledby="pc-support-title" tabIndex={-1} initial={{ opacity: 0, transform: 'translateY(4px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} exit={{ opacity: 0, transform: 'translateY(4px)' }} transition={reduced ? { duration: 0 } : undefined}>
      <h2 id="pc-support-title">Need help?</h2><p>Get help with setting up and using Aurora for your application</p>
      <ul>{supportLinks.map(link => <li key={link.href}><a href={link.href} onClick={() => setSupport(false)}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d={link.path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" /></svg>{link.text}</a></li>)}
        <li className="pc-quickstarts-row"><a className="pc-quickstarts" href="/docs/getting-started/quickstart/overview" onClick={() => setSupport(false)}>Quickstarts{[0, 1].map(index => <svg key={index} viewBox="0 0 10 10" aria-hidden="true"><path fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m7.25 5-3.5-2.25v4.5L7.25 5Z" /></svg>)}</a></li>
      </ul>
    </motion.aside>}</AnimatePresence>, document.body)}
  </>;
}
