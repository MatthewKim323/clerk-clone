import fs from 'node:fs';
import { chromium } from '../tooling/1to1/node_modules/playwright/index.mjs';
import { LAYOUT_JS } from '../tooling/1to1/src/lib/browser.ts';

const manifest=JSON.parse(fs.readFileSync('content/routes/manifest.json','utf8'));
const filter=process.argv[2]?.split(',');
const browser=await chromium.launch({headless:true});
const results:any[]=[];
for(const entry of manifest) {
  if(filter&&!filter.includes(entry.route))continue;
  const reportPath=`reference/${entry.reference}/capture/report.json`;
  if(!fs.existsSync(reportPath))continue;
  const reference=JSON.parse(fs.readFileSync(reportPath,'utf8')).report;
  for(const [vp,expected] of Object.entries(reference.viewports) as [string,any][]) {
    if(expected.captureStatus!=='complete')continue;
    const page=await browser.newPage({viewport:{width:expected.width,height:expected.height},deviceScaleFactor:2});
    const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
    try {
      await page.goto('http://localhost:3781'+entry.route,{waitUntil:'load',timeout:60000});
      await page.evaluate(()=>document.fonts.ready);
      if(entry.route.startsWith('/components/'))await page.waitForSelector(entry.route==='/components/theme-editor'?'main[data-theme-editor="ready"]':'main[data-component-page]',{timeout:15000});
      await page.waitForTimeout(650);
      const actual=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth}));
      const row={route:entry.route,reference:entry.reference,width:expected.width,expected:expected.docHeight,actual:actual.height,delta:actual.height-expected.docHeight,overflow:actual.width-expected.width,errors};
      results.push(row);console.log(JSON.stringify(row));
      if(row.delta) {
        const layout=await page.evaluate(LAYOUT_JS);
        fs.mkdirSync(`reference/${entry.reference}/build`,{recursive:true});
        fs.writeFileSync(`reference/${entry.reference}/build/actual-${expected.width}.json`,JSON.stringify(layout));
      }
      fs.writeFileSync('reference/routes-layout-check.json',JSON.stringify(results,null,2));
    } catch(error) {results.push({route:entry.route,width:expected.width,error:String(error)});console.log(String(error));}
    finally {await page.close();}
  }
}
await browser.close();
fs.writeFileSync('reference/routes-layout-check.json',JSON.stringify(results,null,2));
