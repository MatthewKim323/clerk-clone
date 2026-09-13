import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readOrigin } from '../tooling/1to1/src/lib/anon.ts';
const base='reference/site', origin=readOrigin(base)!;
const outputs=['components/navigation/menus.json','components/sections/markup/hero.json','components/sections/markup/authentication.json'];
const paths=[...new Set(outputs.flatMap(file=>[...fs.readFileSync(file,'utf8').matchAll(/\/_next\/static\/[^\s"&\\)<>;]+/g)].map(match=>match[0])))];
const manifest=JSON.parse(fs.readFileSync(`${base}/assets/manifest.json`,'utf8'));
const captured=JSON.parse(fs.readFileSync(`${base}/capture/assets/manifest.json`,'utf8'));
const mappings:Record<string,string>={};
for(const assetPath of paths){
  const existing=manifest.find((asset:any)=>new URL(asset.originalUrl).pathname===assetPath);
  let localPath=existing?.localPath;
  if(!localPath){
    const cached=Object.entries(captured).find(([url])=>new URL(url).pathname===assetPath)?.[1] as {file:string}|undefined;
    let bytes:Buffer;
    if(cached&&fs.existsSync(`${base}/capture/assets/${cached.file}`))bytes=fs.readFileSync(`${base}/capture/assets/${cached.file}`);
    else {const response=await fetch(new URL(assetPath,origin.url));if(!response.ok)throw Error(`Asset request returned ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());}
    const file=cached?.file||`img-${crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16)}${path.extname(assetPath)}`;
    localPath=`assets/images/${file}`;fs.writeFileSync(`${base}/${localPath}`,bytes);
    manifest.push({originalUrl:new URL(assetPath,origin.url).href,localPath,type:'images',bytes:bytes.length,mime:'image/png'});
  }
  const target=`/assets/${path.basename(localPath)}`;fs.copyFileSync(`${base}/${localPath}`,`public${target}`);mappings[assetPath]=target;
}
fs.writeFileSync(`${base}/assets/manifest.json`,JSON.stringify(manifest,null,2));
for(const file of outputs){let text=fs.readFileSync(file,'utf8');for(const[from,to]of Object.entries(mappings))text=text.split(from).join(to);fs.writeFileSync(file,text);}
fs.writeFileSync(`${base}/supplement/final-asset-repairs.json`,JSON.stringify(mappings,null,2));
console.log(JSON.stringify(mappings,null,2));
