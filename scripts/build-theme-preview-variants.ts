import fs from 'node:fs';
import {createHash} from 'node:crypto';
import postcss from 'postcss';
import {parse} from '../tooling/1to1/node_modules/node-html-parser';
import {sanitizeReferenceMarkup} from './sanitize-reference';
import {wordmark,badgeWordmark} from '../lib/branding';
const base='reference/theme-editor-previews',target='public/theme-editor';
const names=['sign-up','sign-in','user-button','user-profile','waitlist','pricing-table'];
const normalize=(text:string)=>sanitizeReferenceMarkup(text).replaceAll('--Aurora-','--aurora-').replace(/[\u2013\u2014]/g,',');
const serialize=(node:postcss.ChildNode)=>node.toString()+(node.type==='atrule'&&!node.nodes?';':'');
const entries=[];
for(const theme of ['default','dark','simple','shadcn'])for(const appearance of ['light','dark'])for(const component of names){
 const directory=`${base}/variants/${theme}-${appearance}/${component}`;
 const css=normalize(fs.readFileSync(`${directory}/styles.css`,'utf8'));
 entries.push({component,theme,appearance,directory,css,nodes:postcss.parse(css).nodes.map(serialize)});
}
let common=0;
while(entries.every(entry=>entry.nodes[common]!==undefined&&entry.nodes[common]===entries[0].nodes[common]))common++;
const commonCss=entries[0].nodes.slice(0,common).join('\n');
const hash=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,16);
const commonName=`native-base-${hash(commonCss)}.css`;fs.writeFileSync(`${target}/${commonName}`,commonCss);
const styles=new Map<string,string>(),manifest:Record<string,Record<string,string>>={};
for(const entry of entries){
 const key=`${entry.theme}-${entry.appearance}`;
 manifest[entry.component]??={};
 if(key==='default-light'){manifest[entry.component][key]=`/theme-editor/${entry.component}.html`;continue;}
 const doc=parse(normalize(fs.readFileSync(`${entry.directory}/dom.html`,'utf8')),{comment:false});
 for(const node of doc.querySelectorAll('script,style,link,meta,title,next-route-announcer'))node.remove();
 for(const node of doc.querySelectorAll('*'))for(const name of Object.keys(node.attributes))if(/^on/i.test(name)||['action','formaction'].includes(name))node.removeAttribute(name);
 for(const logo of doc.querySelectorAll('svg[viewBox="0 0 50 14"]'))logo.set_content(badgeWordmark);
 for(const logo of doc.querySelectorAll('svg[viewBox="0 0 62 18"]'))logo.set_content(wordmark);
 const css=entry.nodes.slice(common).join('\n'),cssName=`native-${hash(css)}.css`;styles.set(cssName,css);
 if(postcss.parse(commonCss+'\n'+css).nodes.map(serialize).join('\n')!==entry.nodes.join('\n'))throw new Error('Native CSS split changed rules');
 const name=`${entry.component}-${key}`;
 doc.querySelector('head')!.set_content(`<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Aurora component preview</title><link rel="stylesheet" href="/theme-editor/${commonName}"><link rel="stylesheet" href="/theme-editor/${cssName}"><style id="aurora-preview-variables"></style>`);
 fs.writeFileSync(`${target}/${name}.html`,doc.toString());manifest[entry.component][key]=`/theme-editor/${name}.html`;
}
for(const [name,css]of styles)fs.writeFileSync(`${target}/${name}`,css);
for(const file of fs.readdirSync(target))if(/^native-(?:base-)?[a-f0-9]+\.css$/.test(file)&&file!==commonName&&!styles.has(file))fs.unlinkSync(`${target}/${file}`);
const report={combinations:entries.length,newDocuments:42,commonRules:common,commonCssBytes:commonCss.length,uniqueVariantStylesheets:styles.size,variantCssBytes:[...styles.values()].reduce((a,b)=>a+b.length,0),manifest};
fs.writeFileSync(`${base}/local-variants-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,manifest:undefined}));
