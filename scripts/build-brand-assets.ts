import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from '../tooling/1to1/node_modules/sharp/lib/index.js';
import {parse} from '../tooling/1to1/node_modules/node-html-parser';
import {wordmark} from '../lib/branding';
import outline from '../content/brand-wordmark-outline.json';

// Keep captured viewboxes, export sizes, backgrounds, and palette around Aurora's mark.
const doc=parse(JSON.parse(fs.readFileSync('reference/site-brand-assets/supplement/page.json','utf8')).bodyHtml);
const hex=wordmark.match(/<path d="([^"]+)"/)![1];
const definitions='<defs><linearGradient id="au-primary" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#BAB1FF"/><stop offset="1" stop-color="#6C47FF"/></linearGradient></defs>';
const glyphs=outline.paths.map(d=>`<path d="${d}"/>`).join('');
const symbol=(fill:string,size:number,x=0,y=0)=>`<g transform="translate(${x+size/30} ${y-size/10}) scale(${size/15})"><path d="${hex}" fill="${fill}" fill-rule="evenodd"/></g>`;
const manifest:Record<string,{svg:string;png:string;previewOriginal:string;downloadName:string;svgSize:[number,number];pngSize:[number,number]}>={};
const save=(buffer:Buffer,extension:string)=>{
 const file=`img-${createHash('sha256').update(buffer).digest('hex').slice(0,16)}.${extension}`;
 const target=`/assets/${file}`;fs.writeFileSync(`public${target}`,buffer);return target;
};
for(const anchor of doc.querySelectorAll('a[download]')){
 const name=anchor.getAttribute('download')!;
 if(!anchor.getAttribute('href')?.endsWith('.svg')||manifest[name])continue;
 const previewOriginal=anchor.parentNode.parentNode.parentNode.querySelector('img')!.getAttribute('src')!;
 const source=parse(fs.readFileSync(path.join('public',previewOriginal),'utf8')).querySelector('svg')!;
 const width=Number(source.getAttribute('width')),height=Number(source.getAttribute('height'));
 let content='';
 if(name.startsWith('logotype')){
  const fill=name.endsWith('-light')?'#FFFFFF':'#131316';
  const mark=name==='logotype-full-primary'?'url(#au-primary)':fill;
  content=`<g transform="scale(${width/62} ${height/18})"><path d="${hex}" fill="${mark}" fill-rule="evenodd"/><g fill="${fill}">${glyphs}</g></g>`;
 }else if(name.startsWith('symbol')){
  content=symbol(name==='symbol-primary'?'url(#au-primary)':name.endsWith('-light')?'#FFFFFF':'#131316',128);
 }else{
  const light=name.endsWith('-light'),primary=name.includes('-primary-');
  const background=light?(primary?'#6C47FF':'#131316'):'#FFFFFF';
  const fill=light?'#FFFFFF':primary?'url(#au-primary)':'#131316';
  const radius=name.includes('-circle-')?80:0;
  content=`<rect width="160" height="160" rx="${radius}" fill="${background}"/>${symbol(fill,80,40,40)}`;
 }
 const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Aurora">${definitions}${content}</svg>`);
 const svgPath=save(svg,'svg');
 const pngSize:[number,number]=name.startsWith('logotype')?[3301,960]:[960,960];
 const png=await sharp(svg).resize({width:pngSize[0],height:pngSize[1],fit:'fill'}).png().toBuffer();
 manifest[name]={svg:svgPath,png:save(png,'png'),previewOriginal,downloadName:`aurora-${name}`,svgSize:[width,height],pngSize};
}
fs.writeFileSync('content/brand-assets.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Built ${Object.keys(manifest).length} Aurora variants in SVG and PNG.`);
