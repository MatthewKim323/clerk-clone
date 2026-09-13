import fs from 'node:fs';
import sharp from '../tooling/1to1/node_modules/sharp/lib/index.js';
import {parse} from '../tooling/1to1/node_modules/node-html-parser/dist/index.js';
const page=JSON.parse(fs.readFileSync('content/routes/brand-assets.json','utf8'));
const variants=Object.entries(page).filter(([key,value])=>/html/i.test(key)&&typeof value==='string');const rows:any[]=[];
for(const [variant,html] of variants){const doc=parse(html as string);for(const link of doc.querySelectorAll('a[download]')){const href=link.getAttribute('href')||'',file='public'+href;rows.push({variant,href,name:link.getAttribute('download'),exists:fs.existsSync(file),local:href.startsWith('/assets/')});}}
const assets=JSON.parse(fs.readFileSync('content/brand-assets.json','utf8'));const dimensions=[];for(const [name,asset]of Object.entries(assets)as any){const png=await sharp('public'+asset.png).metadata();dimensions.push({name,width:png.width,height:png.height,expected:asset.pngSize,svgHasAurora:fs.readFileSync('public'+asset.svg,'utf8').includes('Aurora')});}
const report={links:rows,dimensions};fs.writeFileSync('reference/brand-download-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({links:rows.length,allLocal:rows.every(row=>row.local&&row.exists),variants:dimensions.length}));
