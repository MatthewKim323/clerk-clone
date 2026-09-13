import fs from 'node:fs';
import { chromium } from '../tooling/1to1/node_modules/playwright/index.mjs';
import { LAYOUT_JS } from '../tooling/1to1/src/lib/browser.ts';

const route=process.argv[2]||'/docs';
const width=Number(process.argv[3])||810;
const refName='site-'+route.replace(/^\//,'').replace(/[^a-z0-9]+/gi,'-');
const vp=({1440:'desktop',1024:'tablet',810:'tablet-810',390:'mobile'} as Record<number,string>)[width];
const ref=JSON.parse(fs.readFileSync(`reference/${refName}/capture/${vp}/layout.json`,'utf8'));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:2});
const errors:string[]=[];
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
await page.goto('http://localhost:3781'+route);
await page.waitForTimeout(1800);
const actual=await page.evaluate(LAYOUT_JS) as any[];
const key=(row:any)=>[row.tag,row.className,(row.text||'').replace(/[\u2013\u2014]/g,'-').slice(0,120)].join('|');
const byKey=new Map<string,any[]>();
for(const row of actual){const k=key(row);byKey.set(k,[...(byKey.get(k)||[]),row]);}
const differences=ref.filter((r:any)=>r.text).flatMap((r:any)=>{
  const b=byKey.get(key(r))?.shift();
  if(!b)return [{text:r.text,missing:true,path:r.path}];
  const dh=b.rect.h-r.rect.h;
  if(Math.abs(dh)<.15)return [];
  return [{text:r.text,ref:r.rect,actual:b.rect,dh,font:b.style.fontFamily,fs:b.style.fontSize,lh:b.style.lineHeight,className:b.className,path:b.path}];
});
console.log(JSON.stringify({route,width,refHeight:ref[0].rect.h,buildHeight:await page.evaluate(()=>document.documentElement.scrollHeight),errors,differences},null,2));
fs.mkdirSync(`reference/${refName}/build`,{recursive:true});
fs.writeFileSync(`reference/${refName}/build/actual-${width}.json`,JSON.stringify(actual));
await browser.close();
