import fs from 'node:fs';
import path from 'node:path';
import sharp from '../tooling/1to1/node_modules/sharp/lib/index.js';
import {launch,newCtx,load} from '../tooling/1to1/src/lib/browser.ts';
import {runDiff} from '../tooling/1to1/src/rig/diff.ts';
const manifest=JSON.parse(fs.readFileSync('content/routes/manifest.json','utf8'));
const entries=manifest.filter((entry:any)=>entry.route.startsWith('/docs/guides/development/integrations/'));
const root='reference/docs-sidebar-final-pixels';fs.mkdirSync(root,{recursive:true});
const browser=await launch(true),results:any[]=[];
try{
  for(const entry of entries)for(const [viewport,width] of [['desktop',1440],['tablet',1024]] as const){
    const reference=`reference/${entry.reference}`;
    const layout=JSON.parse(fs.readFileSync(`${reference}/capture/${viewport}/layout.json`,'utf8'));
    const expected=layout.find((row:any)=>row.id==='docs-navigation-element').rect;
    const out=path.join(root,entry.reference,viewport);fs.mkdirSync(out,{recursive:true});
    const context=await newCtx(browser,{width,height:900},2),page=await context.newPage(),errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    try{
      await load(page,'http://localhost:3781'+entry.route,350);
      await page.waitForFunction(()=>{
        const link=document.querySelector('nav[aria-label="Documentation"] a[href="/docs/guides/development/override-aurora-types-interfaces"]');
        if(!link)return false;
        const range=document.createRange();range.selectNodeContents(link);
        return range.getBoundingClientRect().height<=20.01&&Math.abs(link.getBoundingClientRect().height-34)<0.02;
      });
      const actual=await page.locator('#docs-navigation-element').boundingBox();
      if(!actual)throw new Error('Missing sidebar');
      const clip={left:Math.round(expected.x*2),top:Math.round(expected.y*2),width:Math.round(expected.w*2),height:Math.round(expected.h*2)};
      await sharp(await page.screenshot()).extract(clip).toFile(`${out}/build.png`);
      await sharp(`${reference}/capture/${viewport}/full.png`).extract(clip).toFile(`${out}/reference.png`);
      await runDiff([`${out}/build.png`,`${out}/reference.png`,out,'--ranges',JSON.stringify([['sidebar',0,clip.height/2]])]);
      results.push({route:entry.route,width,coverage:'sidebar-only',referenceUnmodified:true,expected,actual,geometryExact:Math.abs(actual.x-expected.x)<0.02&&Math.abs(actual.y-expected.y)<0.02&&Math.abs(actual.width-expected.w)<0.02&&Math.abs(actual.height-expected.h)<0.02,errors,diff:JSON.parse(fs.readFileSync(`${out}/diff.json`,'utf8'))});
    }catch(error){results.push({route:entry.route,width,coverage:'sidebar-only',errors,error:String(error)});}
    finally{await context.close();fs.writeFileSync(`${root}/report.json`,JSON.stringify(results,null,2));}
  }
}finally{await browser.close();}
console.log(JSON.stringify({checks:results.length,errors:results.filter(row=>row.error||row.errors.length).length,geometryExact:results.filter(row=>row.geometryExact).length}));
