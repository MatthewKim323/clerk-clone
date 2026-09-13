'use client';

import { Fragment, useLayoutEffect, useState } from 'react';
import type { CapturedRoute } from '@/lib/routes';
import { RouteEffects } from './RouteEffects';

export function RouteContent({ route, only = false }: { route: CapturedRoute; only?: boolean }) {
  const [viewport,setViewport]=useState('desktop');
  useLayoutEffect(()=>{
    if(!route.variants)return;
    const queries=[window.matchMedia('(min-width:1280px)'),window.matchMedia('(min-width:1024px)'),window.matchMedia('(min-width:768px)')];
    const update=()=>setViewport(queries[0].matches?'desktop':queries[1].matches?'tablet':queries[2].matches?'tablet-810':'mobile');
    update();
    queries.forEach(query=>query.addEventListener('change',update));
    return()=>queries.forEach(query=>query.removeEventListener('change',update));
  },[route.variants]);
  const markup=route.variants?.[viewport]||route;
  return <Fragment key={viewport}>
    <div style={{display:'contents'}} dangerouslySetInnerHTML={{__html:only?markup.mainHtml||markup.bodyHtml:markup.bodyHtml}} />
    <RouteEffects htmlClass={markup.htmlClass} bodyClass={markup.bodyClass} htmlStyle={markup.htmlStyle} bodyStyle={markup.bodyStyle} />
  </Fragment>;
}
