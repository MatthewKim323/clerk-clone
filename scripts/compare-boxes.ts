import fs from 'node:fs';
import { chromium } from '../tooling/1to1/node_modules/playwright/index.mjs';

const width = Number(process.argv[2]) || 1440;
const vp = ({1440:'desktop',1024:'tablet',810:'tablet-810',390:'mobile'} as Record<number,string>)[width];
const ref = JSON.parse(fs.readFileSync(`reference/site/capture/${vp}/layout.json`, 'utf8'));
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width,height:width===390?844:900}});
const errors:string[]=[];
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
await page.goto('http://localhost:3781/');
await page.waitForTimeout(2000);
const boxes = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-reference-path]')].map(el => {
  const r=el.getBoundingClientRect();
  const s=getComputedStyle(el);
  return {path:el.dataset.referencePath,tag:el.tagName,text:[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.nodeValue).join('').trim().slice(0,100),rect:{x:r.x,y:r.y+scrollY,w:r.width,h:r.height},styles:{fontSize:s.fontSize,lineHeight:s.lineHeight,gap:s.gap,display:s.display,padding:s.padding}};
}));
const refs = new Map(ref.map((r:any)=>[r.path,r]));
const diffs = boxes.flatMap(b=>{
  const r=refs.get(b.path) as any;
  if(!r || Math.abs(b.rect.h-r.rect.h)<0.1 || b.rect.h===0)return [];
  return [{...b,ref:r.rect,dh:Math.round((b.rect.h-r.rect.h)*100)/100}];
});
console.log(JSON.stringify(diffs.filter(b=>b.text || (b.rect.h<600&&Math.abs(b.dh)>10)).map(b=>({path:b.path,text:b.text,dh:b.dh,h:b.rect.h,ref:b.ref.h,w:b.rect.w,refw:b.ref.w,y:b.rect.y,styles:b.styles})),null,2));
fs.writeFileSync(`reference/site/build/boxes-${width}.json`,JSON.stringify(boxes));
fs.writeFileSync(`reference/site/build/errors-${width}.json`,JSON.stringify(errors,null,2));
await browser.close();
