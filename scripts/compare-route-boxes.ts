import fs from 'node:fs';
import {chromium} from '../tooling/1to1/node_modules/playwright/index.mjs';
const route=process.argv[2]||'/careers';
const width=Number(process.argv[3])||390;
const name='site-'+route.replace(/^\//,'').replace(/[^a-z0-9]+/gi,'-');
const vp=({1440:'desktop',1024:'tablet',810:'tablet-810',390:'mobile'} as Record<number,string>)[width];
const ref=JSON.parse(fs.readFileSync(`reference/${name}/capture/${vp}/layout.json`,'utf8'));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:2});
await page.goto('http://localhost:3781'+route);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);
const actual=await page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('[data-au-reference]')].map(el=>{
  const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
  return {path:el.dataset.auReference,tag:el.tagName.toLowerCase(),rect:{x:rect.x,y:rect.y+scrollY,w:rect.width,h:rect.height},style:{height:style.height,paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,marginTop:style.marginTop,marginBottom:style.marginBottom,transform:style.transform},className:el.getAttribute('class')||''};
}));
const byPath=new Map(actual.map(row=>[row.path,row]));
const deltas=ref.flatMap((row:any)=>{
 const current=byPath.get(row.path);if(!current||current.tag!==row.tag||!current.rect.h)return [];
 const dh=current.rect.h-row.rect.h;const dy=current.rect.y-row.rect.y;
 if(Math.abs(dh)<.1&&Math.abs(dy)<.5)return [];
 return [{path:row.path,tag:row.tag,text:row.text,className:row.className,ref:row.rect,actual:current.rect,dh,dy,style:current.style,refStyle:{height:row.style.height,paddingTop:row.style.paddingTop,paddingBottom:row.style.paddingBottom,marginTop:row.style.marginTop,marginBottom:row.style.marginBottom,transform:row.style.transform}}];
});
fs.mkdirSync(`reference/${name}/build`,{recursive:true});fs.writeFileSync(`reference/${name}/build/box-deltas-${width}.json`,JSON.stringify(deltas,null,2));
console.log(JSON.stringify(deltas.filter((row:any)=>Math.abs(row.dh)>.1).map((row:any)=>({path:row.path,tag:row.tag,text:row.text,dh:row.dh,ref:row.ref,actual:row.actual,className:row.className})),null,2));
await browser.close();
