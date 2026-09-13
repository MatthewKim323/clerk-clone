import fs from 'node:fs';
import path from 'node:path';
import sharp from '../tooling/1to1/node_modules/sharp/lib/index.js';
import {fileURLToPath} from 'node:url';
import {launch,newCtx,load,reveal} from '../tooling/1to1/src/lib/browser.ts';

const root=`reference/site/build/frames/${process.argv[3] || 'final'}`;
const source='reference/site/capture/frames';
const browser=await launch(true);
const scenarios=process.argv[2]?.split(',') || ['load','scroll-b2b-saas','scroll-footer','click-3-products','hover-5-signup'];
for(const scenario of scenarios) {
  const out=path.join(root,scenario);fs.mkdirSync(out,{recursive:true});
  const reference=JSON.parse(fs.readFileSync(path.join(source,scenario,'frames.json'),'utf8'));
  const context=await newCtx(browser,{width:1440,height:900},1), page=await context.newPage();
  const cdp=await context.newCDPSession(page);
  const frames:any[]=[],writes:Promise<void>[]=[],marks:Record<string,number>={},errors:string[]=[];
  let zero=0;
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  page.on('response',response=>{if(response.status()>=400){const url=new URL(response.url());errors.push(`HTTP ${response.status()} ${url.pathname}`)}});
  cdp.on('Page.screencastFrame',(event:any)=>{
    const file=`${String(frames.length).padStart(5,'0')}.png`;
    frames.push({i:frames.length,t:Math.round((event.metadata.timestamp-zero)*1000),file});
    writes.push(fs.promises.writeFile(path.join(out,file),Buffer.from(event.data,'base64')));
    cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
  });
  const start=async()=>{zero=Date.now()/1000;await cdp.send('Page.startScreencast',{format:'png',everyNthFrame:1,maxWidth:1440,maxHeight:900})};
  const mark=(name:string)=>{marks[name]=frames.at(-1)?.t||0};
  if(scenario==='load') {
    await start();page.goto('http://localhost:3781/',{waitUntil:'domcontentloaded'}).catch(error=>errors.push(error.message));await page.waitForTimeout(6000);
  } else {
    await load(page,'http://localhost:3781/',2500);
    if(scenario.startsWith('scroll-')) {
      await start();await page.evaluate(y=>scrollTo(0,y),Math.max(0,reference.scrollFrom));await page.waitForTimeout(400);mark('scrollStart');
      await page.evaluate(({from,to})=>{const zero=performance.now();const step=()=>{const t=Math.min(1,(performance.now()-zero)/1500),p=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;scrollTo(0,from+(to-from)*p);if(t<1)requestAnimationFrame(step)};requestAnimationFrame(step)},{from:Math.max(0,reference.scrollFrom),to:Math.max(0,reference.scrollTo)});await page.waitForTimeout(4000);
    } else {
      await reveal(page);await page.mouse.move(5,5);
      const target=page.locator(reference.selector).filter({hasText:reference.text}).filter({visible:true}).first();await target.scrollIntoViewIfNeeded();
      const first=await target.boundingBox();if(!first)throw new Error(`Missing ${scenario}`);
      await page.evaluate(y=>scrollBy(0,y-innerHeight/2),first.y+first.height/2);await page.waitForTimeout(900);
      const box=(await target.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
      await start();await page.waitForTimeout(300);mark('moveOnStart');await page.mouse.move(x,y,{steps:10});mark('moveOnEnd');await page.waitForTimeout(1500);
      if(scenario.startsWith('click-')){mark('click1');await page.mouse.click(x,y);await page.waitForTimeout(1800);mark('click2');await page.mouse.click(x,y);await page.waitForTimeout(1800)}
      mark('moveOffStart');await page.mouse.move(Math.max(10,Math.min(1430,x)),Math.max(10,Math.min(890,box.y>200?box.y-150:box.y+box.height+150)),{steps:10});mark('moveOffEnd');await page.waitForTimeout(1000);
    }
  }
  await cdp.send('Page.stopScreencast');await Promise.all(writes);
  let previous:Buffer|undefined;const timeline:any[]=[];
  for(const frame of [...frames].sort((a,b)=>a.t-b.t)) {
    const raw=await sharp(path.join(out,frame.file)).resize({width:480}).removeAlpha().raw().toBuffer();let changed=0;
    if(previous?.length===raw.length){for(let index=0;index<raw.length;index+=3)if(Math.abs(raw[index]-previous[index])>20||Math.abs(raw[index+1]-previous[index+1])>20||Math.abs(raw[index+2]-previous[index+2])>20)changed++;changed/=raw.length/3;}
    timeline.push({...frame,changed,motion:changed>.0003});previous=raw;
  }
  const moving=timeline.filter(frame=>frame.motion);const summary={firstMotionMs:moving[0]?.t,lastMotionMs:moving.at(-1)?.t,motionFrames:moving.length,totalFrames:frames.length};
  fs.writeFileSync(path.join(out,'frames.json'),JSON.stringify({scenario,frameCount:frames.length,marksMs:marks,errors,frames},null,2));
  fs.writeFileSync(path.join(out,'motion-timeline.json'),JSON.stringify({summary,frames:timeline},null,2));
  console.log(JSON.stringify({scenario,...summary,errors}));await context.close();
  for(const [directory,suffix] of [[out,'build'],[path.join(source,scenario),'reference']]) {
    const child=Bun.spawn([fileURLToPath(new URL('../tooling/1to1/bin/1to1',import.meta.url)),'sheet',directory,path.join(root,`${scenario}-${suffix}.png`),'--step','500','--count','12','--width','240'],{stdout:'ignore',stderr:'inherit'});await child.exited;
  }
}
await browser.close();
