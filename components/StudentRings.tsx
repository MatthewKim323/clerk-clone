'use client';

import { useEffect } from 'react';
import { useScroll, useSpring, useTransform } from 'motion/react';

// Rings canvas geometry and radial gradients: module-03a30fa3c3b693f3.js.
const rings = [
  { width:2606,height:7759,bottom:159,blur:30,alpha:.52,to:[5376,4736,526],from:[534,11348,3460] },
  { width:2892,height:7774,bottom:152,blur:45,alpha:.55,to:[6558,4744,385],from:[594,11375,3041] },
  { width:3233,height:7791,bottom:143,blur:52,alpha:.59,to:[8476,4756,301],from:[664,11395,2602] },
  { width:3656,height:7813,bottom:132,blur:60,alpha:.64,to:[11860,4768,226],from:[750,11428,2130] },
  { width:4216,height:7841,bottom:118,blur:70,alpha:.71,to:[15754,4786,173],from:[866,11467,1619] },
  { width:5041,height:7884,bottom:96,blur:80,alpha:.81,to:[21100,4812,129],from:[1036,11534,1041] },
  { width:6652,height:7966,bottom:55,blur:80,alpha:1,to:[29552,4862,95],from:[1366,11653,344] },
];
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

export default function StudentRings() {
  const { scrollY } = useScroll();
  const progress = useSpring(useTransform(scrollY, [0, 600], [0, 1]), { bounce: 0 });
  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('main > header > canvas');
    const content = canvas?.parentElement?.firstElementChild as HTMLElement | null;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !content) return;
    const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const originalTransform = content.style.transform;
    let width = 0, height = 0, raf = 0, start = 0, visible = false, disposed = false;
    const dpr = devicePixelRatio || 1;
    const draw = (now: number) => {
      if (disposed || !visible) return;
      if (!start) start = now;
      const elapsed = (now - start) / 1000;
      const introProgress = elapsed / 1.5;
      const intro = reduced ? 1 : Math.min(1, .9 + .1 * (introProgress === 1 ? 1 : 1 - 2 ** (-10 * introProgress)));
      const value = reduced ? 0 : progress.get();
      context.clearRect(0, 0, width, height);
      context.globalAlpha = reduced ? 1 : Math.min(1, elapsed);
      for (const ring of rings) {
        const bottom = mix(ring.from[2], mix(ring.bottom, ring.to[2], value), intro);
        const ellipseWidth = mix(ring.from[0], mix(ring.width, ring.to[0], value), intro);
        const ellipseHeight = mix(ring.from[1], mix(ring.height, ring.to[1], value), intro);
        const x = width / 2, y = height - bottom - ellipseHeight / 2, scale = ellipseWidth / ellipseHeight;
        context.save(); context.translate(width / 2, 0); context.scale(scale, 1); context.translate(-width / 2, 0);
        const gradient = context.createRadialGradient(x, y, 0, x, y, ellipseHeight / 2 + ring.blur);
        const inner = 1 - ring.blur / (ellipseHeight / 2 + ring.blur);
        gradient.addColorStop(inner, 'rgba(100,48,247,0)');
        for (let index = 0; index <= 5; index++) {
          const position = index / 5, eased = (position - 1) ** 3 + 1;
          gradient.addColorStop(inner + (1 - inner) * position, `rgba(100,48,247,${ring.alpha * (1 - eased)})`);
        }
        context.fillStyle = gradient; context.fillRect(x - width / scale / 2, 0, width / scale, height);
        context.beginPath(); context.arc(x, y, ellipseHeight / 2 - dpr / 4, 0, 2 * Math.PI, false);
        context.lineWidth = dpr; context.strokeStyle = '#F7F7F8'; context.stroke(); context.restore();
      }
      content.style.transform = `translate3d(0, ${value * (rings[0].bottom - rings[0].to[2])}px, 0)`;
      canvas.dataset.studentRings = 'ready';
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    const measure = () => {
      width = canvas.offsetWidth; height = canvas.offsetHeight;
      canvas.width = width * dpr; canvas.height = height * dpr; context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (visible) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
    };
    const resize = new ResizeObserver(measure); resize.observe(canvas); measure();
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; cancelAnimationFrame(raf); if (visible) raf = requestAnimationFrame(draw); }); observer.observe(canvas);
    return () => { disposed = true; cancelAnimationFrame(raf); resize.disconnect(); observer.disconnect(); content.style.transform = originalTransform; context.clearRect(0, 0, width, height); delete canvas.dataset.studentRings; };
  }, [progress]);
  return null;
}
