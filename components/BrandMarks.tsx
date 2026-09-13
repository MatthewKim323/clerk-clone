'use client';

import {useEffect} from 'react';
import {wordmark,badgeWordmark,brandSymbol,phoneWordmark} from '@/lib/branding';

export function BrandMarks() {
  useEffect(()=>{
    const selector='svg[viewBox="0 0 62 18"],svg[viewBox="0 0 50 14"],svg[viewBox="0 0 49 14"],svg[viewBox="0 0 32 32"],svg[viewBox="0 0 33 10"],svg[viewBox="0 0 122 41"]';
    const replace=(svg:Element)=>{
      if(svg.getAttribute('viewBox')==='0 0 122 41'){const group=svg.querySelector(':scope > g');if(group?.querySelector('path[d^="M31.863 3.452"]'))group.innerHTML=`<g transform="scale(1.28)" color="#131316">${brandSymbol}</g>`;return;}
      if(svg.getAttribute('viewBox')==='0 0 32 32'){if(svg.querySelector('path[d^="M25.009 27.84"]'))svg.innerHTML=brandSymbol;return;}
      if(svg.querySelector('[data-au-wordmark]')?.textContent==='aurora')return;
      if(svg.getAttribute('viewBox')==='0 0 33 10'){if(!svg.querySelector('path[d^="M5.16998"]'))return;const fill=svg.querySelector('path')?.getAttribute('fill');svg.innerHTML=phoneWordmark;if(fill&&fill!=='currentColor')svg.querySelector('g')?.setAttribute('color',fill);return;}
      svg.innerHTML=['0 0 50 14','0 0 49 14'].includes(svg.getAttribute('viewBox')||'')?badgeWordmark:wordmark;
    };
    document.querySelectorAll(selector).forEach(replace);
    const observer=new MutationObserver(records=>{
      const candidates=new Set<Element>();
      for(const record of records)for(const node of record.addedNodes) {
        if(!(node instanceof Element))continue;
        const parent=node.closest(selector);if(parent)candidates.add(parent);
        node.querySelectorAll(selector).forEach(svg=>candidates.add(svg));
      }
      candidates.forEach(replace);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
