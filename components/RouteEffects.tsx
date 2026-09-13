'use client';

import { useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import {usePathname} from 'next/navigation';
import { Navigation } from './Navigation';
import { PageControls } from './PageControls';
import { RouteInteractions } from './RouteInteractions';
import { PublicForms } from './PublicForms';

const ComponentPages=dynamic(()=>import('./ComponentPages').then(module=>module.ComponentPages),{ssr:false});
const MarketingMotion=dynamic(()=>import('./MarketingMotion'),{ssr:false});
const MarketingDecorations=dynamic(()=>import('./MarketingDecorations'),{ssr:false});
const SdkPages=dynamic(()=>import('./SdkPages'),{ssr:false});
const ComponentDemos=dynamic(()=>import('./ComponentDemos').then(module=>module.ComponentDemos),{ssr:false});
const ThemeEditor=dynamic(()=>import('./ThemeEditor'),{ssr:false});

export function RouteEffects({ htmlClass, bodyClass, htmlStyle = '', bodyStyle = '' }: { htmlClass: string; bodyClass: string; htmlStyle?: string; bodyStyle?: string }) {
  const pathname=usePathname();
  useLayoutEffect(() => {
    const old = { htmlClass: document.documentElement.className, bodyClass: document.body.className, htmlStyle: document.documentElement.style.cssText, bodyStyle: document.body.style.cssText };
    document.documentElement.className = htmlClass;
    document.body.className = bodyClass;
    document.documentElement.style.cssText = htmlStyle;
    document.body.style.cssText = bodyStyle;
    return () => {
      document.documentElement.className = old.htmlClass;
      document.body.className = old.bodyClass;
      document.documentElement.style.cssText = old.htmlStyle;
      document.body.style.cssText = old.bodyStyle;
    };
  }, [htmlClass, bodyClass, htmlStyle, bodyStyle]);
  return <><Navigation /><PageControls /><RouteInteractions />{pathname==='/components/theme-editor'?<ThemeEditor />:pathname.startsWith('/components/')&&<ComponentPages />}<MarketingMotion route={pathname} />{['/react-authentication','/nextjs-authentication','/expo-authentication'].includes(pathname)&&<SdkPages route={pathname} />}{['/user-authentication','/platform','/billing'].includes(pathname)&&<MarketingDecorations route={pathname} />}{pathname==='/github-student-developer-pack'&&<ComponentDemos />}<PublicForms /></>;
}
