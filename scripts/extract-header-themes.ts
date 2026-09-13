import fs from 'node:fs';
import {sanitizeReferenceMarkup} from './sanitize-reference';
import {nativeHeaderThemes,nativeHeaderFallback} from './lib/header-theme-records';
const requested=process.argv.find(value=>value.startsWith('--routes='))?.slice(9).split(',');
const manifest=JSON.parse(fs.readFileSync('content/routes/manifest.json','utf8')).filter((entry:any)=>!requested||requested.includes(entry.route));
const output:Record<string,unknown[]>=requested&&fs.existsSync('content/header-themes.json')?JSON.parse(fs.readFileSync('content/header-themes.json','utf8')):{};
const defaults:Record<string,string>=fs.existsSync('content/header-theme-defaults.json')?JSON.parse(fs.readFileSync('content/header-theme-defaults.json','utf8')):{};
const clientHeaderSource=fs.existsSync('reference/sdk-sources/145937.js')?fs.readFileSync('reference/sdk-sources/145937.js','utf8'):'';
let cursor=0;
await Promise.all(Array.from({length:6},async()=>{
  while(cursor<manifest.length){const entry=manifest[cursor++];try {
    const captured=`reference/${entry.reference}/supplement/rsc-data.json`;
    if(fs.existsSync(captured)){const result=nativeHeaderThemes(JSON.parse(fs.readFileSync(captured,'utf8'))),fallback=nativeHeaderFallback(clientHeaderSource,entry.route);output[entry.route]=result.bindings;if(fallback)defaults[entry.route]=fallback;console.log(JSON.stringify({route:entry.route,bindings:result.bindings.length,pageTheme:result.pageTheme,fallback,source:'captured-rsc-and-client-header'}));continue;}
    if(process.argv.includes('--offline'))continue;
    const origin=JSON.parse(fs.readFileSync(`reference/${entry.reference}/.origin.json`,'utf8'));
    const html=await (await fetch(origin.url,{signal:AbortSignal.timeout(20000)})).text();let flight='';
    for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){const match=script[1].match(/self\.__next_f\.push\((\[1,[\s\S]*\])\)/);if(match)try{flight+=JSON.parse(match[1])[1]}catch{}}
    const records=new Map<string,any>(),clients=new Map<string,string>();
    for(const line of flight.split('\n')){const match=line.match(/^([a-f\d]+):(.*)$/);if(!match)continue;try{if(match[2].startsWith('I'))clients.set('$L'+match[1],JSON.parse(match[2].slice(1)).at(-1));else records.set(match[1],JSON.parse(match[2]))}catch{}}
    const found:any[]=[];
    function firstElement(value:any,seen=new Set<string>()):any {
      if(typeof value==='string'&&/^\$L?[a-f\d]+$/.test(value)){const key=value.replace(/^\$L?/,'');if(seen.has(key))return null;seen.add(key);return firstElement(records.get(key),seen)}
      if(!Array.isArray(value))return null;if(value[0]==='$')return value;
      for(const child of value){const node=firstElement(child,seen);if(node)return node;}return null;
    }
    function target(props:any,kind:string){
      if(props.className||props.id)return{tag:props.as||'div',className:props.className||'',id:props.id,parent:0,contains:kind==='ThemeContainer'};
      let child=firstElement(props.children),depth=1;
      while(child&&depth<8){const kind=clients.get(child[1]),p=child[3]||{};
        if((typeof child[1]==='string'&&!child[1].startsWith('$')||kind==='SectionTheme'||kind==='ThemeContainer')&&(p.className||p.id))return{tag:child[1].startsWith('$')?p.as||'div':child[1],className:p.className||'',id:p.id,parent:depth,contains:kind==='ThemeContainer'};
        if(child[1].startsWith('$')&&!kind)return null;
        child=firstElement(p.children);depth++;
      }return null;
    }
    function walk(value:any){if(!value||typeof value!=='object')return;if(Array.isArray(value)&&value[0]==='$'){const kind=clients.get(value[1]);if(kind==='SectionTheme'||kind==='ThemeContainer'){const p=value[3]||{},match=target(p,kind);if(match)found.push({theme:p.theme,match})}}for(const item of Object.values(value))walk(item)}
    records.forEach(walk);output[entry.route]=[...new Map(found.map(row=>[JSON.stringify(row),row])).values()];
    console.log(JSON.stringify({route:entry.route,bindings:output[entry.route].length}));
  }catch(error){console.log(JSON.stringify({route:entry.route,error:String(error)}));}}
}));
fs.writeFileSync('content/header-themes.json',sanitizeReferenceMarkup(JSON.stringify(output,null,2)));
fs.writeFileSync('content/header-theme-defaults.json',JSON.stringify(defaults,null,2));
const full='reference/section-theme-props.json';if(fs.existsSync(full))fs.writeFileSync(full,sanitizeReferenceMarkup(fs.readFileSync(full,'utf8')));
