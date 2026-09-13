import fs from 'node:fs';
import { chromium } from '../tooling/1to1/node_modules/playwright/index.mjs';
import { runDiff } from '../tooling/1to1/src/rig/diff';
const root='reference/sdk-install-counter-check', result:any={cases:[],errors:[]};
const origin=JSON.parse(fs.readFileSync('reference/site-nextjs-authentication/.origin.json','utf8'));
const url=origin.url;
const capture=JSON.parse(fs.readFileSync('reference/site-nextjs-authentication/capture/report.json','utf8')).report;
const browser=await chromium.launch({headless:true});
try {
 for(const viewport of ['desktop','tablet','tablet-810','mobile']) {
  const {width,height}=capture.viewports[viewport], output=`${root}/${viewport}/centered`;fs.mkdirSync(output,{recursive:true});const row:any={viewport};
  for(const side of ['source','build']) {
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,reducedMotion:'no-preference'});const page=await context.newPage();
   if(side==='build'){page.on('pageerror',e=>result.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)result.errors.push({status:r.status(),path:new URL(r.url()).pathname});});}
   await page.goto(side==='source'?url:'http://localhost:3781/nextjs-authentication',{waitUntil:'domcontentloaded',timeout:30000});
   const flow=page.locator('main header number-flow-react');await flow.waitFor({state:'attached',timeout:30000});
   const host=flow.locator('xpath=ancestor::p[1]');await host.evaluate(n=>n.scrollIntoView({block:'center'}));await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(2800);
   if(side==='build')await page.waitForSelector('[data-sdk-install-state="complete"]');
   row[side]=await host.evaluate(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,visible:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('p')===n}});
   await host.screenshot({path:`${output}/${side}.png`});await context.close();
  }
  await runDiff([`${output}/build.png`,`${output}/source.png`,output]);row.diff=JSON.parse(fs.readFileSync(`${output}/diff.json`,'utf8'));row.pass=row.source.visible&&row.build.visible&&Math.abs(row.source.w-row.build.w)<.1&&row.source.h===row.build.h;result.cases.push(row);console.log(JSON.stringify({viewport,pass:row.pass,diff:row.diff}));
 }
} catch(error){result.errors.push(String(error).replace(/https?:\/\/[^\s]+/g,'[origin]'));}
finally{await browser.close();result.pass=result.cases.length===4&&result.cases.every((r:any)=>r.pass)&&!result.errors.length;fs.writeFileSync(`${root}/visual.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({done:true,pass:result.pass,errors:result.errors}));}
