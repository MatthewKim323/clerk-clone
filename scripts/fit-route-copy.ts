import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from '../tooling/1to1/node_modules/playwright/index.mjs';
import { LAYOUT_JS } from '../tooling/1to1/src/lib/browser.ts';

const route=process.argv[2]||'/docs';
const widths=(process.argv[3]||'1440,1024,810,390').split(',').map(Number);
const refName='site-'+route.replace(/^\//,'').replace(/[^a-z0-9]+/gi,'-');
const correctionFile='content/routes/corrections.json';
const corrections=fs.existsSync(correctionFile)?JSON.parse(fs.readFileSync(correctionFile,'utf8')):{};
corrections[route]||={};
const key=(row:any)=>[row.tag,row.className,(row.text||'').replace(/[\u2013\u2014]/g,'-').slice(0,120)].join('|');
const hash=(value:string)=>crypto.createHash('sha1').update(value).digest('hex').slice(0,12);
const browser=await chromium.launch({headless:true});
for(const width of widths) {
  const vp=({1440:'desktop',1024:'tablet',810:'tablet-810',390:'mobile'} as Record<number,string>)[width];
  const ref=JSON.parse(fs.readFileSync(`reference/${refName}/capture/${vp}/layout.json`,'utf8'));
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:2});
  await page.goto('http://localhost:3781'+route);
  await page.waitForTimeout(1600);
  const actual=await page.evaluate(LAYOUT_JS) as any[];
  const byKey=new Map<string,any[]>();
  for(const row of actual){const k=key(row);byKey.set(k,[...(byKey.get(k)||[]),row]);}
  const changes:Record<string,number>={...corrections[route][width]};
  const fixed:any[]=[];
  const processed=new Set<string>();
  for(const row of ref.filter((r:any)=>r.text)) {
    const matches=byKey.get(key(row));
    if(!matches?.length||processed.has(key(row)))continue;
    const current=matches[0];
    if(matches.some((match:any)=>Math.abs(match.rect.w-current.rect.w)>.1||Math.abs(match.rect.h-current.rect.h)>.1))continue;
    const lh=Number.parseFloat(current.style.lineHeight);
    const inline=current.style.display==='inline';
    if(!lh || (!inline&&Math.abs(current.rect.w-row.rect.w)>.15) || Math.abs(current.rect.h-row.rect.h)<.5)continue;
    const heightDelta=current.rect.h-row.rect.h;
    if(Math.abs(heightDelta-Math.round(heightDelta/lh)*lh)>1.05)continue;
    const id=hash(key(row));
    processed.add(key(row));
    const result=await page.evaluate(({id,target})=>{
      const nodes=document.querySelectorAll<HTMLElement>(`[data-au-copy="${id}"]`);
      if(!nodes.length||[...nodes].some(node=>node.textContent!==nodes[0].textContent))return null;
      const node=nodes[0];
      const originals=[...nodes].map(node=>node.style.letterSpacing);
      const base=parseFloat(getComputedStyle(node).letterSpacing)||0;
      const before=node.getBoundingClientRect().height;
      const direction=before>target?-1:1;
      const directions=Math.abs(before-target)<=1.05?[direction,-direction]:[direction];
      for(const direction of directions)for(let step=1;step<=200;step++) {
        const spacing=Math.round((base+direction*step*.005)*1000)/1000;
        nodes.forEach(node=>node.style.setProperty('letter-spacing',`${spacing}px`,'important'));
        const after=node.getBoundingClientRect().height;
        if(Math.abs(after-target)<.15)return {spacing,before,after};
        if((direction<0&&after<target)||(direction>0&&after>target))break;
      }
      nodes.forEach((node,index)=>node.style.letterSpacing=originals[index]);
      return null;
    },{id,target:row.rect.h});
    if(result){changes[id]=result.spacing;fixed.push({id,text:row.text.slice(0,80),...result});}
  }
  corrections[route][width]=changes;
  console.log(JSON.stringify({route,width,fixed,after:await page.evaluate(()=>document.documentElement.scrollHeight)}));
  await page.close();
}
fs.writeFileSync(correctionFile,JSON.stringify(corrections,null,2));
await browser.close();
