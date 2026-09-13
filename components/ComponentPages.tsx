"use client";

import { useEffect, useState } from "react";
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from "motion";
import "./component-pages.css";

type PageMotion = Record<string, unknown>;
type TimelineFrame = { at: number; state: string; template: number; animations: Record<string, { initial: PageMotion; animate: PageMotion; transition: PageMotion }> };
type PageTimeline = { duration: number; frames: TimelineFrame[]; events: { at: number; duration: number; target: string | { _value?: string | number }; values: unknown; options: PageMotion }[] };

type LegacyFrame = TimelineFrame & { background: PageMotion };
type LegacyTimeline = { duration: number; loop: boolean; presets?: boolean; frames: LegacyFrame[] };

type Preset = { id: string; label: string; html: string };
type PackedMarkup = string | { base: number; parts: (string | [number, number])[] };
export type ComponentPageData = {
  pagePresets: Record<string, Preset[]>;
  pageTimelines: Record<string, Record<string, PageTimeline>>;
  pageTimelineMarkup: PackedMarkup[];
  pageTimelineSvgs: Record<string, string>;
  legacyPageTimelines: Record<string, Record<string, LegacyTimeline>>;
  legacyPageMarkup: PackedMarkup[];
  legacyPageSvgs: Record<string, string>;
  pageCursorMarkup: Record<string, string>;
};
const loadPageData: Record<string, () => Promise<{ default: string }>> = {
  "checkout-button": () => import("./component-pages-data/checkout-button"),
  "create-organization": () => import("./component-pages-data/create-organization"),
  "organization-list": () => import("./component-pages-data/organization-list"),
  "organization-profile": () => import("./component-pages-data/organization-profile"),
  "organization-switcher": () => import("./component-pages-data/organization-switcher"),
  "pricing-table": () => import("./component-pages-data/pricing-table"),
  "sign-in": () => import("./component-pages-data/sign-in"),
  "sign-up": () => import("./component-pages-data/sign-up"),
  "user-button": () => import("./component-pages-data/user-button"),
  "user-profile": () => import("./component-pages-data/user-profile"),
  "waitlist": () => import("./component-pages-data/waitlist"),
};

function unpackMarkup(index: number, entries: PackedMarkup[], cache: Map<number, string>): string {
  const cached = cache.get(index);
  if (cached !== undefined) return cached;
  const entry = entries[index];
  const previous = typeof entry === "string" ? "" : unpackMarkup(entry.base, entries, cache);
  const html = typeof entry === "string" ? entry : entry.parts.map(part => typeof part === "string" ? part : previous.slice(part[0], part[1])).join("");
  cache.set(index, html);
  return html;
}

const anticipate: [number, number, number, number] = [1, -0.4, 0.35, 0.95];

export function ComponentPages() {
  const [data, setData] = useState<ComponentPageData | null>(null);
  useEffect(() => {
    const route = location.pathname.match(/^\/components\/([^/]+)\/?$/)?.[1];
    let active = true;
    if (route && loadPageData[route]) void loadPageData[route]().then(async module => {
      const bytes = Uint8Array.from(atob(module.default), character => character.charCodeAt(0));
      const decoded = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
      if (active) setData(JSON.parse(decoded) as ComponentPageData);
    });
    else setData({ pagePresets: {}, pageTimelines: {}, pageTimelineMarkup: [], pageTimelineSvgs: {}, legacyPageTimelines: {}, legacyPageMarkup: [], legacyPageSvgs: {}, pageCursorMarkup: {} });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!data) return;
    const { pagePresets, pageTimelines, pageTimelineMarkup, pageTimelineSvgs, legacyPageTimelines, legacyPageMarkup, legacyPageSvgs, pageCursorMarkup } = data;
    const route = location.pathname.match(/^\/components\/([^/]+)\/?$/)?.[1];
    const root = document.querySelector<HTMLElement>("main");
    if (!route || !root) return;
    const cleanups: (() => void)[] = [];
    const attributes = new Map<Element, [string, string][]>();
    const contents = new Map<Element, string>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const animations = new Set<ReturnType<typeof animate>>();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    const remember = (element: Element) => {
      if (!attributes.has(element)) attributes.set(element, Array.from(element.attributes, ({ name, value }) => [name, value]));
    };
    const rememberContent = (element: Element) => {
      remember(element);
      if (!contents.has(element)) contents.set(element, element.innerHTML);
    };
    const listen = (target: EventTarget, type: string, callback: EventListener) => {
      target.addEventListener(type, callback);
      cleanups.push(() => target.removeEventListener(type, callback));
    };
    const later = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => { timers.delete(timer); if (!disposed) callback(); }, delay);
      timers.add(timer);
      return timer;
    };
    const cancelTimer = (timer: ReturnType<typeof setTimeout> | undefined) => {
      if (timer !== undefined) { clearTimeout(timer); timers.delete(timer); }
    };
    const move = (element: Element, values: DOMKeyframesDefinition, options: AnimationOptions = {}) => {
      remember(element);
      const control = animate(element, values, reduced.matches ? { duration: 0 } : options);
      if (reduced.matches) control.complete();
      animations.add(control);
      control.finished.then(() => animations.delete(control)).catch(() => {});
      return control;
    };
    remember(root);
    root.setAttribute("data-component-page", route);

    for (const container of root.querySelectorAll<HTMLElement>('[style*="content-visibility"]')) {
      remember(container);
      const child = container.firstElementChild;
      if (child instanceof HTMLElement && child.style.height) {
        const height = parseFloat(child.style.height);
        if (height > 0) container.style.containIntrinsicHeight = `auto ${height}px`;
      }
      const observer = new IntersectionObserver(entries => {
        const visible = entries[0].isIntersecting;
        container.style.contentVisibility = visible ? "visible" : "hidden";
        container.style.opacity = visible ? "1" : "0";
      }, { rootMargin: "40px 0px" });
      observer.observe(container);
      cleanups.push(() => observer.disconnect());
    }

    for (const button of root.querySelectorAll<HTMLButtonElement>('button[aria-label="Copy code to clipboard"], button[aria-label="Copy agent prompt"]')) {
      let reset: ReturnType<typeof setTimeout> | undefined;
      const agent = button.getAttribute("aria-label") === "Copy agent prompt";
      const label = button.getAttribute("aria-label")!;
      rememberContent(button);
      listen(button, "click", (async () => {
        const codeRoot = button.closest('[class~="group/code-root"]') || button.parentElement?.parentElement;
        const code = codeRoot?.querySelector("pre code") || codeRoot?.querySelector("pre");
        const value = agent ? "Add Aurora auth to my app: aurora.com/SKILL.md" : code?.textContent || "";
        if (!value) return;
        try { await navigator.clipboard.writeText(value); } catch { return; }
        if (disposed) return;
        cancelTimer(reset);
        button.setAttribute("aria-label", agent ? "Copied agent prompt" : "Copied to clipboard");
        button.setAttribute("data-component-copied", "true");
        if (agent) {
          button.classList.remove("grid-cols-[auto_auto_1fr_auto]");
          button.classList.add("grid-cols-[auto_auto_0fr_auto]");
        } else {
          button.setAttribute("aria-expanded", "true");
          let tooltip = button.parentElement?.querySelector<HTMLElement>(".aurora-component-copy-tooltip");
          if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.className = "aurora-component-copy-tooltip";
            tooltip.setAttribute("role", "status");
            tooltip.innerHTML = 'Copied<svg aria-hidden="true" viewBox="0 0 20 20"><path d="M14 6L8.41379 14L5 11.12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            button.parentElement?.append(tooltip);
            cleanups.push(() => tooltip?.remove());
          }
          move(tooltip, { opacity: [0, 1], y: [8, 0], scale: [0.98, 1] }, { duration: 0.2 });
        }
        reset = later(() => {
          button.setAttribute("aria-label", label);
          button.removeAttribute("data-component-copied");
          button.setAttribute("aria-expanded", "false");
          if (agent) {
            button.classList.add("grid-cols-[auto_auto_1fr_auto]");
            button.classList.remove("grid-cols-[auto_auto_0fr_auto]");
          }
          button.parentElement?.querySelector(".aurora-component-copy-tooltip")?.remove();
        }, agent ? 2000 : 1500);
      }) as EventListener);
    }

    for (const wrapper of root.querySelectorAll<HTMLElement>("[data-collapsed]")) {
      const button = Array.from(wrapper.querySelectorAll("button")).find(item => /^(Expand|Collapse) code$/.test(item.textContent?.trim() || ""));
      if (!button) continue;
      remember(wrapper);
      rememberContent(button);
      listen(button, "click", () => {
        const previousTop = button.getBoundingClientRect().top;
        const wasCollapsed = wrapper.getAttribute("data-collapsed") !== "false";
        wrapper.setAttribute("data-collapsed", String(!wasCollapsed));
        button.setAttribute("aria-expanded", String(wasCollapsed));
        for (const node of Array.from(button.childNodes)) if (node.nodeType === Node.TEXT_NODE) node.textContent = wasCollapsed ? "Collapse code" : "Expand code";
        if (!wasCollapsed) window.scrollBy(0, button.getBoundingClientRect().top - previousTop);
      });
    }

    const presets = pagePresets[route];
    if (presets) {
      for (const radios of root.querySelectorAll<HTMLElement>('[role="radiogroup"][aria-label="Customization style"]')) {
        const group = radios.closest<HTMLElement>('[role="group"]');
        const preview = group?.lastElementChild?.firstElementChild;
        if (!group || !(preview instanceof HTMLElement)) continue;
        const buttons = Array.from(radios.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
        if (!buttons.length) continue;
        let index = Math.max(0, presets.findIndex(preset => preset.label === buttons.find(button => button.getAttribute("aria-checked") === "true")?.textContent?.trim()));
        let hovered = false, focused = false, visible = false, first = true;
        let tick: ReturnType<typeof setTimeout> | undefined;
        let transition: ReturnType<typeof setTimeout> | undefined;
        rememberContent(preview);
        buttons.forEach(rememberContent);
        const schedule = () => {
          cancelTimer(tick);
          if (!visible || hovered || focused || document.hidden || reduced.matches || innerWidth < 768) return;
          tick = later(() => { select(1, true); }, first ? 500 : 2200);
          first = false;
        };
        const select = (offset: number, autoplay = false) => {
          if (!offset) return;
          cancelTimer(transition);
          index = (index + offset + presets.length) % presets.length;
          const spring: AnimationOptions = autoplay ? { duration: 0.7, ease: anticipate } : { type: "spring", stiffness: 300, damping: 30, mass: 0.8 };
          const center = Math.floor(buttons.length / 2);
          buttons.forEach((button, slot) => {
            const relative = slot - center;
            const preset = presets[(index + relative + presets.length) % presets.length];
            button.textContent = preset.label;
            button.setAttribute("aria-checked", String(relative === 0));
            button.tabIndex = relative === 0 ? 0 : -1;
            button.inert = Math.abs(relative) > 1;
            move(button, {
              x: [`${5.825 + 7.35 * (relative + offset)}rem`, `${5.825 + 7.35 * relative}rem`],
              boxShadow: relative === 0 ? "0 2px 4px 0 rgba(47,48,55,0.30), 0 0 0 1px #2F3037, 0 2px 13px 0 rgba(0,0,0,0.20)" : "0 0 0 1px rgba(47,48,55,0.10)",
              backgroundColor: relative === 0 ? "#2F3037" : "#FAFAFB",
              color: relative === 0 ? "#FFF" : "#5E5F6E",
              opacity: Math.abs(relative) > 1 ? 0 : 1,
              zIndex: relative === 0 ? 10 : 10 - Math.abs(relative),
            }, spring);
          });
          const outgoing = preview.cloneNode(true) as HTMLElement;
          outgoing.removeAttribute("data-reference-path");
          outgoing.style.position = "absolute";
          outgoing.style.inset = "0 auto auto 50%";
          outgoing.style.pointerEvents = "none";
          outgoing.setAttribute("aria-hidden", "true");
          preview.parentElement?.append(outgoing);
          cleanups.push(() => outgoing.remove());
          preview.innerHTML = presets[index].html;
          group.setAttribute("data-component-preset", presets[index].id);
          move(outgoing, { opacity: 0, scale: 0.94, x: `calc(-50% - ${2.4 * Math.sign(offset)}rem)`, filter: "blur(6px)" }, spring);
          move(preview, { opacity: [0, 1], scale: [0.94, 1], x: [`calc(-50% + ${2.4 * Math.sign(offset)}rem)`, "-50%"], filter: ["blur(6px)", "blur(0px)"] }, { ...spring, delay: 0.1 });
          transition = later(() => outgoing.remove(), reduced.matches ? 0 : 900);
          schedule();
        };
        listen(radios, "click", event => {
          const button = (event.target as Element).closest("button");
          const slot = buttons.indexOf(button as HTMLButtonElement);
          if (slot >= 0) select(slot - Math.floor(buttons.length / 2));
        });
        listen(radios, "keydown", event => {
          const keyboard = event as KeyboardEvent;
          if (keyboard.key !== "ArrowLeft" && keyboard.key !== "ArrowRight") return;
          keyboard.preventDefault();
          select(keyboard.key === "ArrowLeft" ? -1 : 1);
          buttons[Math.floor(buttons.length / 2)].focus({ preventScroll: true });
        });
        listen(group, "pointerenter", () => { hovered = true; schedule(); });
        listen(group, "pointerleave", () => { hovered = false; schedule(); });
        listen(group, "focusin", event => { focused = (event.target as Element).matches(":focus-visible"); schedule(); });
        listen(group, "focusout", () => { focused = false; schedule(); });
        listen(document, "visibilitychange", schedule);
        listen(reduced, "change", schedule);
        const observer = new IntersectionObserver(entries => {
          visible = entries[0].isIntersecting && entries[0].intersectionRatio > 0;
          if (!visible) first = true;
          schedule();
        }, { threshold: 0.2 });
        observer.observe(group);
        cleanups.push(() => observer.disconnect());
      }
    }

    const tours = pageTimelines[route];
    if (tours) {
      const templateCache = new Map<number, HTMLTemplateElement>();
      const markupCache = new Map<number, string>();
      const templateFor = (index: number) => {
        let template = templateCache.get(index);
        if (!template) {
          template = document.createElement("template");
          template.innerHTML = unpackMarkup(index, pageTimelineMarkup, markupCache);
          template.content.querySelectorAll<SVGElement>("[data-page-svg]").forEach(svg => {
            svg.innerHTML = pageTimelineSvgs[svg.getAttribute("data-page-svg") || ""] || "";
          });
          templateCache.set(index, template);
        }
        return template;
      };
      const morph = (current: Element, next: Element) => {
        const oldStyle = current.getAttribute("style");
        const preserveStyle = (current.hasAttribute("data-page-motion") && current.getAttribute("data-page-motion") === next.getAttribute("data-page-motion")) || current.hasAttribute("data-reveal") || current.hasAttribute("data-click-shadow");
        Array.from(current.attributes).forEach(attribute => { if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name); });
        Array.from(next.attributes).forEach(attribute => current.setAttribute(attribute.name, attribute.value));
        if (preserveStyle && oldStyle) current.setAttribute("style", oldStyle);
        const incoming = Array.from(next.childNodes);
        for (let index = 0; index < incoming.length; index++) {
          const child = incoming[index];
          let old = current.childNodes[index];
          if (child instanceof Element) {
            const key = child.getAttribute("data-page-motion");
            const candidate = Array.from(current.childNodes).slice(index).find((element): element is Element => element instanceof Element && element.tagName === child.tagName && (key ? element.getAttribute("data-page-motion") === key : element.getAttribute("class") === child.getAttribute("class")));
            if (candidate && candidate !== old) { current.insertBefore(candidate, old || null); old = candidate; }
          }
          if (old instanceof Element && child instanceof Element && old.tagName === child.tagName) morph(old, child);
          else if (old?.nodeType === Node.TEXT_NODE && child.nodeType === Node.TEXT_NODE) old.textContent = child.textContent;
          else if (old) current.replaceChild(child.cloneNode(true), old);
          else current.append(child.cloneNode(true));
        }
        while (current.childNodes.length > incoming.length) current.lastChild?.remove();
      };
      const previews = Array.from(root.querySelectorAll<HTMLElement>('[role="img"][aria-label]')).filter(preview => !preview.closest('[role="group"]'));
      const animatedPreviews = previews.filter(preview => preview.getAttribute("aria-label")?.startsWith("Animation:"));
      const desktopPreview = previews.filter(preview => preview.getAttribute("aria-label")?.startsWith("Preview" )).at(-1);
      const controllers: { preview: HTMLElement; setPanel: (panel: string | null) => void; sync: () => void }[] = [];
      const targetSelector = route === "pricing-table" ? ".contents" : route === "create-organization" ? ".px-5.py-4" : route === "organization-list" ? ".overflow-clip.rounded-xl" : '[class~="h-166.5"]';
      for (const preview of [...animatedPreviews, ...(desktopPreview ? [desktopPreview] : [])]) {
        const target = preview.querySelector<HTMLElement>(targetSelector) || preview.querySelector<HTMLElement>(".contents");
        if (!target) continue;
        const isDesktop = preview === desktopPreview;
        let panel: string | null = isDesktop ? null : `panel-${animatedPreviews.indexOf(preview) + 1}`;
        let visible = false;
        let running = false;
        let previousAnimations: TimelineFrame["animations"] = {};
        let generation = 0;
        const scheduled = new Set<ReturnType<typeof setTimeout>>();
        const activeAnimations = new Set<ReturnType<typeof animate>>();
        const card = Array.from(preview.querySelectorAll<HTMLElement>("div.relative")).find(element => element.classList.contains("bg-gray-50")) || preview;
        const cursor = document.createElement("div");
        cursor.className = "aurora-page-cursor";
        cursor.setAttribute("aria-hidden", "true");
        cursor.innerHTML = pageCursorMarkup.default;
        card.append(cursor);
        const toast = document.createElement("div");
        toast.className = "aurora-page-toast";
        toast.innerHTML = '<div><span class="mosaic-caption px-4 py-1.5 block">Organization recognized</span></div>';
        card.append(toast);
        let toastVisible = false;
        cleanups.push(() => { cursor.remove(); toast.remove(); });
        rememberContent(target);
        remember(preview);
        const runMotion = (element: Element, values: DOMKeyframesDefinition, options: AnimationOptions = {}) => {
          const control = move(element, values, options);
          activeAnimations.add(control);
          control.finished.then(() => activeAnimations.delete(control)).catch(() => {});
          return control;
        };
        const delay = (callback: () => void, seconds: number) => {
          const current = generation;
          const timer = later(() => { scheduled.delete(timer); if (current === generation) callback(); }, Math.max(0, seconds * 1000));
          scheduled.add(timer);
        };
        const stop = () => {
          running = false;
          generation++;
          previousAnimations = {};
          scheduled.forEach(cancelTimer);
          scheduled.clear();
          activeAnimations.forEach(animation => animation.stop());
          activeAnimations.clear();
          cursor.style.opacity = "0";
          (toast.firstElementChild as HTMLElement).style.opacity = "0";
          toastVisible = false;
        };
        const showFrame = (frame: TimelineFrame) => {
          const template = templateFor(frame.template);
          const oldElements = new Map(Array.from(target.querySelectorAll("[data-page-motion]"), node => [node.getAttribute("data-page-motion"), node]));
          const next = document.createElement("div");
          next.className = "contents";
          next.append(template.content.cloneNode(true));
          if (!target.hasAttribute("data-page-tour-content")) {
            target.className = "contents";
            target.style.cssText = "";
            target.replaceChildren(next.cloneNode(true));
            target.setAttribute("data-page-tour-content", "true");
          } else morph(target.firstElementChild!, next);
          preview.setAttribute("data-component-tour", `${panel}:${frame.state}`);
          const recognized = route === "create-organization" && panel === "panel-1" && frame.state === "recognized";
          if (recognized !== toastVisible) {
            toastVisible = recognized;
            runMotion(toast.firstElementChild!, { y: recognized ? 0 : -18 }, { type: "spring", visualDuration: 0.34, bounce: 0.5 });
            runMotion(toast.firstElementChild!, { opacity: recognized ? 1 : 0, filter: recognized ? "blur(0px)" : "blur(2px)" }, { duration: recognized ? 0.34 : 0.2, ease: "linear" });
          }
          target.querySelectorAll<HTMLElement>("[data-page-motion]").forEach(element => {
            const id = element.getAttribute("data-page-motion")!;
            const state = frame.animations[id];
            if (!state) return;
            const old = previousAnimations[id];
            if ((oldElements.get(id) === element) && JSON.stringify(old?.animate) === JSON.stringify(state.animate)) return;
            const values = { ...state.animate } as Record<string, unknown>;
            const nested = values.transition as Record<string, unknown> | undefined;
            delete values.transition;
            const options = { ...state.transition, ...nested } as AnimationOptions;
            if (!(oldElements.get(id) === element)) {
              for (const key of Object.keys(values)) if (key in state.initial && !Array.isArray(values[key])) values[key] = [state.initial[key], values[key]];
            }
            runMotion(element, values as DOMKeyframesDefinition, options);
          });
          previousAnimations = frame.animations;
          let ancestor = target.parentElement;
          while (ancestor && ancestor !== preview) {
            if (ancestor.style.height && ancestor.firstElementChild?.classList.contains("absolute")) {
              const inner = ancestor.firstElementChild as HTMLElement;
              remember(ancestor);
              ancestor.style.height = `${inner.scrollHeight}px`;
              break;
            }
            ancestor = ancestor.parentElement;
          }
        };
        const cycle = () => {
          if (!panel || !tours[panel]) return;
          const tour = tours[panel];
          previousAnimations = {};
          tour.frames.forEach(frame => delay(() => showFrame(frame), frame.at));
          tour.events.forEach(event => delay(() => {
            const options = { ...event.options, duration: event.duration } as AnimationOptions & { at?: unknown };
            delete options.at;
            const key = typeof event.target === "object" ? event.target._value : null;
            if (typeof event.target === "string") {
              target.querySelectorAll(event.target).forEach(element => runMotion(element, event.values as DOMKeyframesDefinition, options));
            } else if (typeof key === "string" && key.startsWith("cursor")) {
              if (key === "cursorKind") cursor.innerHTML = pageCursorMarkup[String(event.values)] || pageCursorMarkup.default;
              const property = ({ cursorX: "x", cursorY: "y", cursorScale: "scale", cursorOpacity: "opacity" } as Record<string, string>)[key];
              if (property) runMotion(cursor, { [property]: event.values } as DOMKeyframesDefinition, options);
            } else if (key === "swipe") {
              const swipe = Array.from(preview.querySelectorAll<HTMLElement>("div")).find(element => element.className.includes("linear-gradient(105deg"));
              if (swipe) {
                const input = Array.isArray(event.values) ? event.values : [event.values];
                runMotion(swipe, { x: input.map(value => `${Number(value) * 200 - 100}%`) }, options);
              }
            }
          }, event.at));
          const progress = preview.querySelector<SVGRectElement>('rect[stroke-dasharray]');
          if (progress) {
            const length = progress.getTotalLength();
            if (length > 0) {
              runMotion(progress, { strokeDasharray: [`0 ${length}`, `${length} 0`], strokeDashoffset: [length / 4, -length / 4] }, { duration: tour.duration, ease: "linear" });
              runMotion(progress, { strokeWidth: [0, 1, 1, 0] }, { duration: tour.duration, times: [0, 0.06, 0.94, 1], ease: "linear" });
            }
          }
          delay(cycle, tour.duration);
        };
        const sync = () => {
          const shouldRun = visible && !document.hidden && !reduced.matches && Boolean(panel) && (!isDesktop || innerWidth >= 1024);
          if (shouldRun && !running) { running = true; cycle(); }
          else if (!shouldRun && running) stop();
        };
        const setPanel = (next: string | null) => {
          if (next === panel) return;
          stop();
          panel = next;
          if (next && tours[next] && reduced.matches) showFrame(tours[next].frames[0]);
          if (!next) {
            target.innerHTML = contents.get(target) || "";
            const saved = attributes.get(target) || [];
            Array.from(target.attributes).forEach(attribute => target.removeAttribute(attribute.name));
            saved.forEach(([name, value]) => target.setAttribute(name, value));
          }
          sync();
        };
        const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.15 });
        observer.observe(preview);
        cleanups.push(() => { stop(); observer.disconnect(); });
        listen(document, "visibilitychange", sync);
        listen(reduced, "change", sync);
        controllers.push({ preview, setPanel, sync });
      }
      if (desktopPreview) {
        const controller = controllers.find(item => item.preview === desktopPreview);
        const panels = animatedPreviews.map(preview => {
          let element: HTMLElement | null = preview;
          while (element && !element.querySelector("h2")) element = element.parentElement;
          return element;
        });
        const updatePanel = () => {
          if (innerWidth < 1024) return;
          let selected: string | null = null;
          panels.forEach((element, index) => {
            if (!element) return;
            const box = element.getBoundingClientRect();
            if (box.top <= innerHeight * 0.4 && box.bottom >= innerHeight * 0.4) selected = `panel-${index + 1}`;
          });
          controller?.setPanel(selected);
        };
        listen(window, "scroll", updatePanel);
        listen(window, "resize", updatePanel);
        updatePanel();
      }
    }

    const legacyTours = legacyPageTimelines[route];
    if (legacyTours) {
      const templateCache = new Map<number, HTMLTemplateElement>();
      const markupCache = new Map<number, string>();
      const templateFor = (index: number) => {
        let template = templateCache.get(index);
        if (!template) {
          template = document.createElement("template");
          template.innerHTML = unpackMarkup(index, legacyPageMarkup, markupCache);
          template.content.querySelectorAll<SVGElement>("[data-legacy-svg]").forEach(svg => {
            svg.innerHTML = legacyPageSvgs[svg.getAttribute("data-legacy-svg") || ""] || "";
          });
          templateCache.set(index, template);
        }
        return template;
      };
      const morph = (current: Element, next: Element) => {
        const oldStyle = current.getAttribute("style");
        const preserve = current.getAttribute("data-legacy-motion") && current.getAttribute("data-legacy-motion") === next.getAttribute("data-legacy-motion");
        for (const attribute of Array.from(current.attributes)) if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
        for (const attribute of Array.from(next.attributes)) current.setAttribute(attribute.name, attribute.value);
        if (preserve && oldStyle) current.setAttribute("style", oldStyle);
        const incoming = Array.from(next.childNodes);
        incoming.forEach((child, index) => {
          let old = current.childNodes[index];
          if (child instanceof Element) {
            const key = child.getAttribute("data-legacy-motion");
            const candidate = Array.from(current.childNodes).slice(index).find((element): element is Element => element instanceof Element && element.tagName === child.tagName && (key ? element.getAttribute("data-legacy-motion") === key : element.getAttribute("class") === child.getAttribute("class")));
            if (candidate && candidate !== old) { current.insertBefore(candidate, old || null); old = candidate; }
          }
          if (old instanceof Element && child instanceof Element && old.tagName === child.tagName) morph(old, child);
          else if (old?.nodeType === Node.TEXT_NODE && child.nodeType === Node.TEXT_NODE) old.textContent = child.textContent;
          else if (old) current.replaceChild(child.cloneNode(true), old);
          else current.append(child.cloneNode(true));
        });
        while (current.childNodes.length > incoming.length) current.lastChild?.remove();
      };
      const anchors = Array.from(root.querySelectorAll<HTMLElement>('div.scroll-mt-8[id]')).filter(anchor => legacyTours[anchor.id]);
      const narratives = anchors.map(anchor => ({ anchor, content: anchor.querySelector<HTMLElement>(".origin-left.flex-col.justify-center") })).filter((item): item is { anchor: HTMLElement; content: HTMLElement } => Boolean(item.content));
      narratives.forEach(({ content }) => remember(content));
      const updateNarratives = () => {
        if (innerWidth < 768) return;
        for (const { anchor, content } of narratives) {
          if (anchor.id === "header" || anchor.id === "hero-header") continue;
          const section = content.parentElement?.parentElement || anchor;
          const box = section.getBoundingClientRect();
          const progress = (innerHeight - box.top) / (innerHeight + box.height);
          const opacity = progress <= 0.5 ? Math.max(0, (progress - 0.05) / 0.45) : Math.max(0.2, 1 - (progress - 0.5) / 0.45 * 0.8);
          content.style.opacity = reduced.matches ? "1" : String(Math.min(1, opacity));
          content.style.filter = reduced.matches ? "none" : `blur(${Math.max(0, Math.min(2, 2 - (progress - 0.1) / 0.3 * 2))}px)`;
        }
      };
      listen(window, "scroll", updateNarratives);
      listen(window, "resize", updateNarratives);
      listen(reduced, "change", updateNarratives);
      updateNarratives();
      const sticky = root.querySelector<HTMLElement>("div.sticky.h-screen");
      const desktopTarget = sticky?.querySelector<HTMLElement>("div.absolute.flex.h-full.w-full.items-center.justify-center");
      type LegacyController = { setPanel: (panel: string | null) => void; jump: (state: string) => void };
      const controllers = new Map<string, LegacyController>();
      const signInHeader = route === "sign-in" ? anchors.find(anchor => anchor.id === "header") : null;
      const signInSteps = Array.from(signInHeader?.querySelectorAll<HTMLButtonElement>("button.label-3") || []);
      const stepOutline = signInSteps[0]?.querySelector("svg")?.cloneNode(true) as SVGElement | undefined;
      signInSteps.forEach(rememberContent);
      const createController = (target: HTMLElement, observed: HTMLElement, firstPanel: string | null, desktop: boolean) => {
        let panel = firstPanel;
        let visible = false, running = false, hovered = false, focused = false;
        let presetIndex = 0;
        let currentStep = -1;
        const countdowns = new Map<HTMLElement, { remaining: number }>();
        let previousAnimations: TimelineFrame["animations"] = {};
        let generation = 0;
        const scheduled = new Set<ReturnType<typeof setTimeout>>();
        const activeAnimations = new Set<ReturnType<typeof animate>>();
        const mat = target.previousElementSibling instanceof HTMLElement ? target.previousElementSibling : null;
        const inertParents: HTMLElement[] = [];
        let ancestor = target.parentElement;
        while (ancestor && ancestor !== root) {
          if (ancestor.hasAttribute("inert")) { remember(ancestor); inertParents.push(ancestor); }
          ancestor = ancestor.parentElement;
        }
        rememberContent(target);
        const settle = (element: Element, values: DOMKeyframesDefinition) => {
          if (!(element instanceof HTMLElement || element instanceof SVGElement)) return;
          const transform: string[] = [];
          for (const [key, input] of Object.entries(values)) {
            const value = Array.isArray(input) ? input.at(-1) : input;
            if (value == null || key === "transition" || typeof value === "object") continue;
            if (key === "x" || key === "y") transform.push(`translate${key.toUpperCase()}(${value}${typeof value === "number" ? "px" : ""})`);
            else if (key === "scale" || key === "scaleX" || key === "scaleY") transform.push(`${key}(${value})`);
            else if (key === "rotate") transform.push(`rotate(${value}${typeof value === "number" ? "deg" : ""})`);
            else element.style.setProperty(key.startsWith("--") ? key : key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), String(value));
          }
          if (transform.length) element.style.transform = transform.join(" ");
        };
        const runMotion = (element: Element, values: DOMKeyframesDefinition, options: AnimationOptions = {}) => {
          if (!Object.keys(values).length) return;
          if (options.duration === 0 || reduced.matches) { remember(element); settle(element, values); return; }
          const animation = move(element, values, options);
          if (options.duration === 0 || reduced.matches) animation.complete();
          activeAnimations.add(animation);
          animation.finished.then(() => activeAnimations.delete(animation)).catch(() => {});
        };
        const delay = (callback: () => void, seconds: number) => {
          const current = generation;
          const timer = later(() => { scheduled.delete(timer); if (current === generation) callback(); }, Math.max(0, seconds * 1000));
          scheduled.add(timer);
        };
        const stop = () => {
          running = false;
          generation++;
          countdowns.clear();
          previousAnimations = {};
          scheduled.forEach(cancelTimer);
          scheduled.clear();
          activeAnimations.forEach(animation => animation.stop());
          activeAnimations.clear();
        };
        const showFrame = (frame: LegacyFrame, immediate = false) => {
          const next = document.createElement("div");
          next.className = "contents";
          next.append(templateFor(frame.template).content.cloneNode(true));
          const oldElements = new Map(Array.from(target.querySelectorAll("[data-legacy-motion]"), element => [element.getAttribute("data-legacy-motion"), element]));
          if (!target.hasAttribute("data-legacy-tour")) {
            if (!desktop) { target.className = "contents"; target.style.cssText = ""; }
            target.replaceChildren(next);
          } else morph(target.firstElementChild!, next);
          target.setAttribute("data-legacy-tour", `${panel}:${frame.state}`);
          target.inert = !(panel && legacyTours[panel]?.presets) && (attributes.get(target)?.some(([name]) => name === "inert") || false);
          inertParents.forEach(element => { element.inert = !(panel && legacyTours[panel]?.presets); });
          target.querySelectorAll<HTMLElement | SVGElement>("[data-legacy-motion]").forEach(element => {
            const id = element.getAttribute("data-legacy-motion")!;
            const state = frame.animations[id];
            if (!state || typeof state.animate !== "object") return;
            if (!immediate && (oldElements.get(id) === element) && JSON.stringify(previousAnimations[id]?.animate) === JSON.stringify(state.animate)) return;
            const values = { ...state.animate } as Record<string, unknown>;
            const nested = values.transition as Record<string, unknown> | undefined;
            delete values.transition;
            const options = immediate ? { duration: 0, delay: 0 } : { ...state.transition, ...nested } as AnimationOptions;
            if (!immediate && !(oldElements.get(id) === element)) {
              for (const key of Object.keys(values)) if (key in state.initial && !Array.isArray(values[key])) values[key] = [state.initial[key], values[key]];
            }
            runMotion(element, values as DOMKeyframesDefinition, options);
          });
          if (mat && Object.keys(frame.background).length) {
            const values = { ...frame.background } as Record<string, unknown>;
            const transition = values.transition as AnimationOptions | undefined;
            delete values.transition;
            runMotion(mat, values as DOMKeyframesDefinition, immediate ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1], ...transition });
          }
          previousAnimations = frame.animations;
          for (const counter of target.querySelectorAll<HTMLElement>("span")) {
            if (!/^\d+$/.test(counter.textContent || "") || !counter.parentElement?.textContent?.includes("Resend (")) continue;
            let active = true;
            let ancestor: Element | null = counter;
            while (ancestor && ancestor !== target) {
              const id = ancestor.getAttribute("data-legacy-motion");
              if (id && frame.animations[id]?.animate?.opacity === 0) active = false;
              ancestor = ancestor.parentElement;
            }
            if (!active) { countdowns.delete(counter); continue; }
            let state = countdowns.get(counter);
            if (!state) {
              state = { remaining: 20 };
              countdowns.set(counter, state);
              const tick = () => {
                if (!counter.isConnected || countdowns.get(counter) !== state || !running) return;
                state!.remaining = Math.max(0, state!.remaining - 1);
                counter.textContent = String(state!.remaining);
                if (state!.remaining) delay(tick, 1);
              };
              delay(tick, 1);
            }
            counter.textContent = String(state.remaining);
          }
          if (route === "sign-in" && panel === "header") {
            const step = Number(frame.state.match(/^step(\d+)_/)?.[1] || 0);
            if (step !== currentStep) {
              currentStep = step;
              signInSteps.forEach((button, index) => {
                button.setAttribute("aria-pressed", String(index === step));
                button.style.color = index === step ? "#373840" : "#9394A1";
                button.style.border = index === step ? "1px solid rgba(0,0,0,0)" : "1px dashed rgba(0,0,0,0.10)";
                button.style.background = index === step ? "#FFF" : "#FAFAFB";
                button.style.boxShadow = index === step ? "0 1px 3px -1px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.09)" : "none";
                button.querySelector("svg")?.remove();
                if (index !== step || !stepOutline) return;
                const svg = stepOutline.cloneNode(true) as SVGElement;
                const box = button.getBoundingClientRect();
                svg.setAttribute("width", String(box.width + 8));
                svg.setAttribute("height", String(box.height + 8));
                svg.setAttribute("viewBox", `0 0 ${box.width + 8} ${box.height + 8}`);
                const rect = svg.querySelector("rect")!;
                rect.setAttribute("width", String(box.width)); rect.setAttribute("height", String(box.height));
                rect.setAttribute("rx", String(box.height / 2)); rect.setAttribute("ry", String(box.height / 2));
                const perimeter = Math.PI * box.height + 2 * (box.width - box.height);
                rect.setAttribute("stroke-dashoffset", String(-((box.width - box.height) / 2) / perimeter * 100));
                button.append(svg);
                const frames = legacyTours.header.frames;
                const start = frames.find(item => item.state.startsWith(`step${step}_`))?.at || 0;
                const end = frames.find(item => item.state.startsWith(`step${step + 1}_`))?.at || legacyTours.header.duration;
                runMotion(rect, { strokeDasharray: ["0 100", "100 0"] }, { duration: end - start, ease: "linear" });
                runMotion(rect, { strokeWidth: [0, 1, 1, 0] }, { duration: end - start, times: [0, 0.02, 0.98, 1], ease: "linear" });
              });
            }
          }
          if (panel === "enumeration") {
            const step = ["hideEmailBox", "reset"].includes(frame.state) ? 2 : ["showVerifyEmail", "showEmailBox"].includes(frame.state) ? 1 : 0;
            const section = anchors.find(anchor => anchor.id === panel);
            const buttons = Array.from(section?.querySelectorAll<HTMLButtonElement>("button") || []).filter(button => (button.textContent?.length || 0) > 60);
            buttons.forEach((button, index) => {
              remember(button);
              button.setAttribute("aria-pressed", String(index === step));
              Array.from(button.children).forEach(child => runMotion(child, { opacity: index === step ? 1 : 0.4 }, { duration: 0.4, ease: [0.33, 1, 0.68, 1] }));
            });
          }
          if (panel && legacyTours[panel]?.presets) {
            const choices = Array.from(target.querySelectorAll<HTMLElement>('[class*="cursor-pointer"]')).filter(element => (element.textContent?.trim().length || 0) < 30);
            choices.forEach((choice, index) => {
              choice.setAttribute("role", "button");
              choice.setAttribute("aria-pressed", String(index === 3));
              choice.setAttribute("data-legacy-choice", String(index - 3));
              choice.tabIndex = index === 3 ? 0 : -1;
              choice.inert = Math.abs(index - 3) > 1;
            });
          }
        };
        const cycle = (fromState?: string) => {
          if (!panel) return;
          const tour = legacyTours[panel];
          if (tour.presets) {
            showFrame(tour.frames[presetIndex]);
            delay(() => { presetIndex = (presetIndex + 1) % tour.frames.length; cycle(); }, tour.duration);
            return;
          }
          const from = tour.frames.find(frame => frame.state === fromState)?.at || 0;
          tour.frames.filter(frame => frame.at >= from).forEach(frame => delay(() => showFrame(frame), frame.at - from));
          if (tour.loop && tour.frames.length > 1) delay(() => { previousAnimations = {}; cycle(); }, tour.duration - from);
        };
        const sync = () => {
          const tour = panel ? legacyTours[panel] : null;
          const shouldRun = visible && Boolean(tour) && !document.hidden && !reduced.matches && !(tour?.presets && (hovered || focused)) && (desktop ? innerWidth >= 768 : innerWidth < 768);
          if (shouldRun && !running) { running = true; cycle(); }
          else if (!shouldRun && running) stop();
          if (visible && panel && tour && reduced.matches && !target.hasAttribute("data-legacy-tour")) showFrame(tour.frames[presetIndex], true);
        };
        const setPanel = (next: string | null) => {
          if (next === panel) return;
          stop();
          panel = next;
          previousAnimations = {};
          presetIndex = 0;
          if (next) showFrame(legacyTours[next].frames[0], true);
          sync();
        };
        const selectPreset = (offset: number) => {
          if (!panel || !legacyTours[panel]?.presets || !offset) return;
          stop();
          const tour = legacyTours[panel];
          presetIndex = (presetIndex + offset + tour.frames.length) % tour.frames.length;
          showFrame(tour.frames[presetIndex]);
          sync();
        };
        listen(target, "click", event => {
          const choice = (event.target as Element).closest<HTMLElement>("[data-legacy-choice]");
          if (choice) { event.preventDefault(); selectPreset(Number(choice.dataset.legacyChoice)); }
        });
        listen(target, "keydown", event => {
          const keyboard = event as KeyboardEvent;
          const choice = (event.target as Element).closest<HTMLElement>("[data-legacy-choice]");
          if (!choice) return;
          if (["ArrowLeft", "ArrowRight", "Enter", " "].includes(keyboard.key)) {
            keyboard.preventDefault();
            selectPreset(keyboard.key === "ArrowLeft" ? -1 : keyboard.key === "ArrowRight" ? 1 : Number(choice.dataset.legacyChoice));
            target.querySelector<HTMLElement>('[data-legacy-choice="0"]')?.focus({ preventScroll: true });
          }
        });
        listen(target, "pointerenter", () => { hovered = true; sync(); });
        listen(target, "pointerleave", () => { hovered = false; sync(); });
        listen(target, "focusin", event => { focused = (event.target as Element).matches(":focus-visible"); sync(); });
        listen(target, "focusout", () => { focused = false; sync(); });
        listen(document, "visibilitychange", sync);
        listen(reduced, "change", sync);
        const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.15 });
        observer.observe(observed);
        cleanups.push(() => { observer.disconnect(); stop(); });
        return { setPanel, jump: (state: string) => { stop(); if (panel) { running = true; cycle(state); } } };
      };
      if (desktopTarget && sticky) {
        const controller = createController(desktopTarget, sticky, null, true);
        controllers.set("desktop", controller);
        const update = () => {
          if (innerWidth < 768) return;
          const center = innerHeight * 0.4;
          let selected: string | null = null;
          for (const anchor of anchors) {
            const box = anchor.getBoundingClientRect();
            if (box.width && box.top <= center && box.bottom >= center) selected = anchor.id;
          }
          controller.setPanel(selected);
        };
        listen(window, "scroll", update);
        listen(window, "resize", update);
        update();
      }
      for (const anchor of anchors) {
        const slots = Array.from(anchor.querySelectorAll<HTMLElement>('[style*="--scale"]')).filter(element => !element.closest(".sticky"));
        for (const scaler of slots) {
          const stage = scaler.querySelector<HTMLElement>(".origin-top-left")?.firstElementChild;
          const target = stage?.lastElementChild;
          if (!(target instanceof HTMLElement) || stage?.children.length !== 2) continue;
          controllers.set(anchor.id, createController(target, scaler, anchor.id, false));
        }
      }
      signInSteps.forEach((button, step) => listen(button, "click", () => {
        const frame = legacyTours.header.frames.find(frame => frame.state.startsWith(`step${step}_`));
        if (frame) controllers.get(innerWidth >= 768 ? "desktop" : "header")?.jump(frame.state);
      }));
      const enumeration = anchors.find(anchor => anchor.id === "enumeration");
      if (enumeration) {
        const buttons = Array.from(enumeration.querySelectorAll<HTMLButtonElement>("button")).filter(button => (button.textContent?.length || 0) > 60);
        buttons.forEach((button, index) => {
          remember(button);
          listen(button, "click", () => {
            const state = ["idle", "showVerifyEmail", "hideEmailBox"][index];
            if (!state) return;
            controllers.get(innerWidth >= 768 ? "desktop" : "enumeration")?.jump(state);
            buttons.forEach((item, step) => item.setAttribute("aria-pressed", String(step === index)));
          });
        });
      }
    }

    return () => {
      disposed = true;
      cleanups.forEach(cleanup => cleanup());
      timers.forEach(timer => clearTimeout(timer));
      animations.forEach(animation => animation.stop());
      contents.forEach((html, element) => { element.innerHTML = html; });
      attributes.forEach((saved, element) => {
        Array.from(element.attributes).forEach(attribute => element.removeAttribute(attribute.name));
        saved.forEach(([name, value]) => element.setAttribute(name, value));
      });
    };
  }, [data]);
  return null;
}

export default ComponentPages;






