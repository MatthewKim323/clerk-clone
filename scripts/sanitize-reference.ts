import fs from 'node:fs';

const origin=JSON.parse(fs.readFileSync('reference/site/.origin.json','utf8'));
const tokens:string[]=[...origin.tokens].sort((a:string,b:string)=>b.length-a.length);
const escaped=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function sanitizeReferenceMarkup(markup:string) {
  let output=markup.replace(/href="(https?:[^"<>]+)"/g,(attribute,raw:string)=>{
    try {
      const url=new URL(raw.replaceAll('&amp;','&'));
      const social=['x.com','twitter.com','www.linkedin.com','linkedin.com','github.com','www.youtube.com','youtube.com'];
      if(social.includes(url.hostname)&&(/aurora/i.test(url.pathname)||tokens.some(token=>url.pathname.toLowerCase().includes(token.toLowerCase()))))return `href="${url.origin}/"`;
      if(url.hostname==='chatgpt.com'&&url.searchParams.has('q')) {
        const query=url.searchParams.get('q')||'';
        if(tokens.some(token=>query.toLowerCase().includes(token.toLowerCase()))) {
          const route=query.match(/\/docs\/[^\s]+/)?.[0]||'/docs';
          url.searchParams.set('q',`Read Aurora documentation: ${route}`);
          return `href="${url.toString().replaceAll('&','&amp;')}"`;
        }
      }
    } catch {}
    return attribute;
  });
  for(const token of tokens)output=output.replace(new RegExp(escaped(token),'gi'),match=>{
    if(token.includes('.'))return 'aurora.example';
    if(match===match.toUpperCase())return 'AURORA';
    if(match===match.toLowerCase())return 'aurora';
    return 'Aurora';
  });
  return output;
}

export function copyReferenceAsset(source:string,target:string){
  if(/\.svg$/i.test(target))fs.writeFileSync(target,sanitizeReferenceMarkup(fs.readFileSync(source,'utf8')));
  else fs.copyFileSync(source,target);
}
