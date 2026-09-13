import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from '../tooling/1to1/node_modules/node-html-parser/dist/index.js';
import {wordmark,badgeWordmark,brandSymbol,phoneWordmark} from '../lib/branding';
import {sanitizeReferenceMarkup,copyReferenceAsset} from './sanitize-reference';

fs.mkdirSync('content/routes', { recursive: true });
fs.mkdirSync('public/routes', { recursive: true });
fs.mkdirSync('public/assets', { recursive: true });
const built: {route:string;reference:string;file:string}[]=[];
const correctionFile='content/routes/corrections.json';
const corrections=fs.existsSync(correctionFile)?JSON.parse(fs.readFileSync(correctionFile,'utf8')):{};
const cacheFile='reference/routes-build-cache.json';
const cache=fs.existsSync(cacheFile)?JSON.parse(fs.readFileSync(cacheFile,'utf8')):{};
const headerThemes=fs.existsSync('content/header-themes.json')?JSON.parse(fs.readFileSync('content/header-themes.json','utf8')):{};
const brandAssets=fs.existsSync('content/brand-assets.json')?JSON.parse(fs.readFileSync('content/brand-assets.json','utf8')):{};
const generatorHash=crypto.createHash('sha1').update(fs.readFileSync('scripts/build-routes.ts')).update(fs.readFileSync('scripts/sanitize-reference.ts')).update(fs.readFileSync('lib/branding.ts')).digest('hex');
function prepareMarkup(html:string,layout:any[]=[],route='',viewport='desktop') {
  const doc=parse(html,{comment:false});
  for(const {theme,match} of headerThemes[route]||[]) {
    for(const node of doc.querySelectorAll(match.tag)) {
      if(match.id&&node.getAttribute('id')!==match.id)continue;
      const actual=(node.getAttribute('class')||'').trim().replace(/\s+/g,' ');
      const expected=(match.className||'').trim().replace(/\s+/g,' ');
      if(expected&&(match.contains?!expected.split(' ').every((value:string)=>actual.split(' ').includes(value)):actual!==expected))continue;
      let target:any=node;for(let index=0;index<match.parent;index++)target=target?.parentNode;
      if(target?.tagName)target.setAttribute('data-header-theme',theme);
    }
  }
  if(route==='/brand-assets') {
    for(const link of doc.querySelectorAll('a[download]')) {
      const file=link.getAttribute('download')||'';
      const extension=(link.getAttribute('href')||file).split('?')[0].split('.').pop();
      const stem=file.replace(/\.(svg|png)$/,'').replace(/^aurora[-_]/,'');
      const asset=brandAssets[stem];
      if(asset&&(extension==='svg'||extension==='png')){link.setAttribute('href',asset[extension]);link.setAttribute('download',`${asset.downloadName}.${extension}`);}
    }
    for(const img of doc.querySelectorAll('img')) {
      const asset=Object.values(brandAssets).find((asset:any)=>asset.previewOriginal===img.getAttribute('src')) as any;
      if(asset){img.setAttribute('src',asset.svg);img.removeAttribute('srcset');}
    }
  }
  for(const blend of doc.querySelectorAll('feblend[mode="plus-lighter"]'))blend.setAttribute('mode','normal');
  function annotate(node:any,location:string) {
    node.setAttribute('data-au-reference',location);
    node.children.forEach((child:any,index:number)=>annotate(child,`${location}/${index}`));
  }
  doc.children.forEach((node:any,index:number)=>annotate(node,`0/${index}`));
  const imageSources=new Map<string,string>();
  for(const row of layout)if(row.tag==='img'&&row.media?.src&&row.media.currentSrc?.startsWith('/assets/'))imageSources.set(`${row.media.src}|${row.className||''}`,row.media.currentSrc);
  for(const image of doc.querySelectorAll('img')) {
    const captured=imageSources.get(`${image.getAttribute('src')||''}|${image.getAttribute('class')||''}`);
    if(captured){image.setAttribute('src',captured);image.removeAttribute('srcset');}
  }
  for(const node of doc.querySelectorAll('script,noscript,iframe,next-route-announcer,link,meta'))node.remove();
  for(const node of doc.querySelectorAll('*'))for(const attr of Object.keys(node.attributes))if(/^on/i.test(attr))node.removeAttribute(attr);
  for(const node of doc.querySelectorAll('*')) {
    const own=node.childNodes.filter((child:any)=>child.nodeType===3).map((child:any)=>child.text).join('').replace(/\s+/g,' ').trim();
    if(!own)continue;
    const identity=[node.tagName.toLowerCase(),node.getAttribute('class')||'',own.replace(/[\u2013\u2014]/g,'-').slice(0,120)].join('|');
    node.setAttribute('data-au-copy',crypto.createHash('sha1').update(identity).digest('hex').slice(0,12));
  }
  if(route==='/legal/standard-terms'&&viewport==='mobile') {
    const label=doc.querySelector('[data-au-copy="c2ebe29bdccd"] [data-au-copy="c99676ea4063"]');
    if(label){label.set_content('Aurora documentation');label.setAttribute('style','display:inline-block;width:155.13px;white-space:nowrap');}
  }
  for(const logo of doc.querySelectorAll('svg[viewBox="0 0 62 18"]'))logo.set_content(wordmark);
  for(const logo of doc.querySelectorAll('svg[viewBox="0 0 50 14"],svg[viewBox="0 0 49 14"]'))logo.set_content(badgeWordmark);
  for(const path of doc.querySelectorAll('svg[viewBox="0 0 32 32"] path[d^="M25.009 27.84"]'))path.closest('svg')?.set_content(brandSymbol);
  for(const logo of doc.querySelectorAll('svg[viewBox="0 0 122 41"]')){const group=logo.querySelector('g');if(group?.querySelector('path[d^="M31.863 3.452"]'))group.set_content(`<g transform="scale(1.28)" color="#131316">${brandSymbol}</g>`);}
  for(const logo of doc.querySelectorAll('svg[viewBox="0 0 33 10"]')){if(!logo.querySelector('path[d^="M5.16998"]'))continue;const fill=logo.querySelector('path')?.getAttribute('fill');logo.set_content(phoneWordmark);if(fill&&fill!=='currentColor')logo.querySelector('g')?.setAttribute('color',fill);}
  const mark='<path d="M12 2 21 7v10l-9 5-9-5V7Zm0 4.5L7 9.3v5.4l5 2.8 5-2.8V9.3Z" fill="currentColor" fill-rule="evenodd"/>';
  const cookieMark=doc.querySelector('.font-inter svg');
  if(cookieMark){cookieMark.setAttribute('viewBox','0 0 24 24');cookieMark.set_content(mark);}
  const supportMark=doc.querySelectorAll('button').find((node:any)=>node.text.trim()==='Support')?.querySelector('svg');
  if(supportMark){supportMark.setAttribute('viewBox','0 0 24 24');supportMark.set_content(mark);}
  return {bodyHtml:sanitizeReferenceMarkup(doc.toString()).replace(/[\u2014\u2013]/g,','),mainHtml:doc.querySelector('main')?sanitizeReferenceMarkup(doc.querySelector('main')!.outerHTML).replace(/[\u2014\u2013]/g,','):undefined};
}
for(const name of fs.readdirSync('reference').filter(name=>name.startsWith('site-'))) {
  const base=path.join('reference',name);
  const pageFile=path.join(base,'supplement/page.json');
  if(!fs.existsSync(pageFile)) continue;
  const page=JSON.parse(fs.readFileSync(pageFile,'utf8'));
  const key=page.route.replace(/^\//,'').split('/').join('--');
  const file=`content/routes/${key}.json`;
  const sourceFiles=[pageFile,path.join(base,'assets/manifest.json'),...['desktop','tablet','tablet-810','mobile'].flatMap(vp=>['dom.html','layout.json'].map(file=>path.join(base,'capture',vp,file)))].filter(file=>fs.existsSync(file));
  const fingerprint=crypto.createHash('sha1').update(JSON.stringify([generatorHash,sourceFiles.map(file=>[file,fs.statSync(file).mtimeMs]),corrections[page.route],headerThemes[page.route],page.route==='/brand-assets'?brandAssets:undefined])).digest('hex');
  if(cache[page.route]===fingerprint&&fs.existsSync(file)) {built.push({route:page.route,reference:name,file});continue;}
  const layout=(vp:string)=>{
    const file=path.join(base,'capture',vp,'layout.json');
    return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];
  };
  const markup=prepareMarkup(page.bodyHtml,layout('desktop'),page.route);
  const variants:Record<string,unknown>={};
  for(const vp of ['tablet','tablet-810','mobile']) {
    const domFile=path.join(base,'capture',vp,'dom.html');
    if(!fs.existsSync(domFile))continue;
    const dom=parse(fs.readFileSync(domFile,'utf8'),{comment:false});
    const html=dom.querySelector('html');
    const body=dom.querySelector('body');
    if(!body)continue;
    variants[vp]={...prepareMarkup(body.innerHTML,layout(vp),page.route,vp),htmlClass:html?.getAttribute('class')||page.htmlClass,bodyClass:body.getAttribute('class')||page.bodyClass,htmlStyle:html?.getAttribute('style')||'',bodyStyle:body.getAttribute('style')||''};
  }
  const cssPath=`/routes/${key}.css`;
  let css=page.css.replace(/[\u2014\u2013]/g,',');
  const media:Record<string,string>={'1440':'(min-width:1280px)','1024':'(min-width:1024px) and (max-width:1279.98px)','810':'(min-width:768px) and (max-width:1023.98px)','390':'(max-width:767.98px)'};
  for(const [width,entries] of Object.entries(corrections[page.route]||{})) {
    css+=`\n@media ${media[width]} {\n`;
    for(const [id,value] of Object.entries(entries as object))css+=`[data-au-copy="${id}"]{letter-spacing:${value}px!important}\n`;
    css+='}\n';
  }
  fs.writeFileSync(`public${cssPath}`,css);
  fs.writeFileSync(file,JSON.stringify({
    route:page.route,title:page.title,htmlClass:page.htmlClass,bodyClass:page.bodyClass,
    htmlStyle:page.htmlAttributes?.style||'',bodyStyle:page.bodyAttributes?.style||'',
    ...markup,variants:Object.keys(variants).length?variants:undefined,cssPath,
  }));
  const manifest=JSON.parse(fs.readFileSync(path.join(base,'assets/manifest.json'),'utf8'));
  for(const asset of manifest) {
    if(!asset.target.startsWith('/assets/'))continue;
    const source=path.resolve(asset.sourcePath);
    if(fs.existsSync(source)&&!fs.existsSync(`public${asset.target}`))copyReferenceAsset(source,`public${asset.target}`);
  }
  built.push({route:page.route,reference:name,file});
  cache[page.route]=fingerprint;
}
fs.writeFileSync(cacheFile,JSON.stringify(cache));
fs.writeFileSync('content/routes/manifest.json',JSON.stringify(built,null,2));
console.log(`Built ${built.length} routes.`);
