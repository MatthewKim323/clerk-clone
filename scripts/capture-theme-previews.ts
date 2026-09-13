// @ts-nocheck
// Read-only extraction of public editor previews. Run after the route batch closes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from '../tooling/1to1/node_modules/node-html-parser';
import {launch,newCtx,load,closeCtx} from '../tooling/1to1/src/lib/browser.ts';
import {readOrigin,writeOrigin} from '../tooling/1to1/src/lib/anon.ts';
import {sanitizeReferenceMarkup} from './sanitize-reference';
const origin=readOrigin('reference/site-components-theme-editor')!;
const root='reference/theme-editor-previews';
fs.mkdirSync(`${root}/assets`,{recursive:true});
writeOrigin(root,origin);
const sourceLabel=new URL(origin.url).hostname.replace(/^www\./,'').split('.')[0];
const tokens=[...origin.tokens,sourceLabel].filter(value=>typeof value==='string'&&value.toLowerCase()!=='aurora').sort((a,b)=>b.length-a.length);
const clean=(value:string)=>{
 let text=value;
 for(const token of tokens)text=text.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),token.includes('.')?'source.invalid':'Aurora');
 return sanitizeReferenceMarkup(text).replace(/[\u2013\u2014]/g,'-');
};
const assets=new Map<string,any>(),sheets=new Map<string,string>(),pending:Promise<any>[]=[];
const store=(url:string,bytes:Buffer,mime:string)=>{
 if(assets.has(url))return assets.get(url);
 if(mime.includes('svg'))bytes=Buffer.from(clean(bytes.toString()));
 const rawExtension=path.extname(new URL(url).pathname);
 const ext=/^\.[a-zA-Z0-9]{2,5}$/.test(rawExtension)?rawExtension:({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/svg+xml':'.svg','font/woff2':'.woff2','font/woff':'.woff'}[mime]||'.bin');
 const prefix=/font|woff/.test(mime)||/woff/.test(ext)?'font':'img';
 const file=`${prefix}-${createHash('sha256').update(bytes).digest('hex').slice(0,16)}${ext}`;
 fs.writeFileSync(`${root}/assets/${file}`,bytes);
 if(!fs.existsSync(`public/assets/${file}`))fs.writeFileSync(`public/assets/${file}`,bytes);
 const record={file,target:`/assets/${file}`,mime,bytes:bytes.length};assets.set(url,record);return record;
};
const fetchAsset=async(url:string)=>{
 if(assets.has(url))return assets.get(url);
 try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)}),mime=(r.headers.get('content-type')||'').split(';')[0];if(r.ok&&/^(image|font)\//.test(mime)||r.ok&&/woff/.test(url))return store(url,Buffer.from(await r.arrayBuffer()),mime);}catch{}
 return null;
};
const rewrite=async(text:string,base:string)=>{
 const cssUrls=[...text.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)];
 for(const match of cssUrls){if(/^(data:|blob:|#)/.test(match[2]))continue;try{const asset=await fetchAsset(new URL(match[2],base).href);if(asset)text=text.replaceAll(match[0],`url("${asset.target}")`);}catch{}}
 for(const [url,asset] of [...assets].sort((a,b)=>b[0].length-a[0].length))text=text.replaceAll(url,asset.target).replaceAll(url.replaceAll('&','&amp;'),asset.target);
 return clean(text);
};
const browser=await launch(true),context=await newCtx(browser,{width:1440,height:900},2);
context.on('response',response=>{
 const mime=(response.headers()['content-type']||'').split(';')[0],url=response.url();
 if(response.status()<200||response.status()>299)return;
 if(!/^(image|font)\//.test(mime)&&mime!=='text/css'&&!/woff/.test(url))return;
 pending.push((async()=>{try{const body=await response.body();if(mime==='text/css')sheets.set(url,body.toString());else store(url,body,mime);}catch{}})());
});
const page=await context.newPage();
const results:any[]=[];
const serialize=()=>{
 const clone=document.documentElement.cloneNode(true) as HTMLElement;
 const original=[...document.querySelectorAll('style')],copied=[...clone.querySelectorAll('style')];
 original.forEach((style,index)=>{try{if(style.sheet&&copied[index])copied[index].textContent=[...style.sheet.cssRules].map(rule=>rule.cssText).join('\n');}catch{}});
 clone.querySelectorAll('script').forEach(script=>script.remove());
 clone.querySelectorAll('iframe').forEach(frame=>frame.removeAttribute('src'));
 const inputs=[...document.querySelectorAll('input')],copiedInputs=[...clone.querySelectorAll('input')];
 inputs.forEach((input,index)=>{if(copiedInputs[index])copiedInputs[index].setAttribute('value',input.value);});
 return{html:'<!DOCTYPE html>'+clone.outerHTML,width:innerWidth,height:innerHeight,docHeight:document.documentElement.scrollHeight,inputs:inputs.length,buttons:document.querySelectorAll('button').length,assets:[...new Set([...document.images].flatMap(image=>[image.currentSrc,image.src]).filter(Boolean))]};
};
const saveDocument=async(frame:any,directory:string,name:string)=>{
 await frame.evaluate(()=>document.fonts.ready.then(()=>null)).catch(()=>{});
 const data=await frame.evaluate(serialize);
 await Promise.all(data.assets.map(fetchAsset));await Promise.allSettled(pending);
 fs.mkdirSync(directory,{recursive:true});
 const parsed=parse(data.html),css:string[]=[];
 for(const node of parsed.querySelectorAll('style,link[rel="stylesheet"]')){
  const href=node.getAttribute('href');
  if(href){const url=new URL(href,frame.url()).href;let text=sheets.get(url);if(!text){try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(r.ok)text=await r.text();}catch{}}if(text)css.push(await rewrite(text,url));}
  else css.push(await rewrite(node.innerHTML,frame.url()));
  node.remove();
 }
 parsed.querySelectorAll('link[rel="preload"],link[rel="modulepreload"]').forEach(link=>link.remove());
 fs.writeFileSync(`${directory}/dom.html`,await rewrite(parsed.toString(),frame.url()));
 fs.writeFileSync(`${directory}/styles.css`,css.join('\n\n'));
 const meta={component:name,width:data.width,height:data.height,docHeight:data.docHeight,inputs:data.inputs,buttons:data.buttons,stylesheets:css.length,assetCount:assets.size};
 fs.writeFileSync(`${directory}/meta.json`,JSON.stringify(meta,null,2));return meta;
};
const componentFrame=(name:string)=>page.frames().find(frame=>{try{return new URL(frame.url()).pathname.split('/').filter(Boolean).at(-1)===name;}catch{return false;}});
const saveSignUpVariant=async(name:string)=>{
 await page.waitForTimeout(1200);
 const frame=componentFrame('sign-up');if(!frame)throw new Error(`Missing sign-up frame for ${name}`);
 await frame.locator('input:visible,button:visible').first().waitFor({timeout:20000});
 const meta=await saveDocument(frame,`${root}/variants/${name}`,name);results.push(meta);console.log(`Captured ${name}: ${meta.inputs} inputs, ${meta.buttons} buttons`);
};
try{
 await load(page,origin.url,1200);
 await page.waitForSelector('iframe');
 await page.waitForTimeout(3500);
 for(const frame of page.frames().slice(1)){
  const name=new URL(frame.url()).pathname.split('/').filter(Boolean).at(-1);
  if(!['sign-up','sign-in','user-button','user-profile','waitlist','pricing-table'].includes(name))continue;
  await frame.locator('input:visible,button:visible').first().waitFor({timeout:20000});
  const meta=await saveDocument(frame,`${root}/${name}`,name);results.push(meta);
  console.log(`Captured ${name}: ${meta.width}x${meta.height}, ${meta.inputs} inputs, ${meta.buttons} buttons`);
 }
 await page.screenshot({path:`${root}/editor-desktop.png`});
 await saveDocument(page,`${root}/editor-desktop`,'editor-desktop');
 // Popovers are captured by normal UI activation after the preview documents are saved.
 const swatch=page.locator('main [role="tabpanel"] .react-aria-ColorField button');
 if(await swatch.count()){await swatch.first().click();await page.waitForTimeout(300);await page.screenshot({path:`${root}/color-popover.png`});await saveDocument(page,`${root}/color-popover`,'color-popover');await page.keyboard.press('Escape');}
 await page.locator('main [role="tab"][data-key="dark"]').click();await saveSignUpVariant('default-dark');
 await page.locator('main [role="tab"][data-key="light"]').click();
 for(const [key,label] of [['simple','Simple'],['shadcn','shadcn']]){
  await page.locator('main button[data-slot="select-trigger"]').nth(1).click();
  await page.getByRole('option',{name:label,exact:true}).click();await saveSignUpVariant(key);
 }
 await page.locator('main button[data-slot="select-trigger"]').nth(1).click();await page.getByRole('option',{name:'Default',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
 const mobile=page.getByRole('button',{name:'Edit theme'});
 if(await mobile.count()){await mobile.click();await page.waitForTimeout(500);await page.screenshot({path:`${root}/mobile-sheet.png`});await saveDocument(page,`${root}/mobile-sheet`,'mobile-sheet');}
 await Promise.allSettled(pending);
 fs.writeFileSync(`${root}/assets/manifest.json`,JSON.stringify([...assets.values()],null,2));
 fs.writeFileSync(`${root}/report.json`,JSON.stringify({capturedAt:new Date().toISOString(),frames:results},null,2));
 console.log(`Saved ${results.length} preview documents.`);
}finally{await closeCtx(context);await browser.close();}
