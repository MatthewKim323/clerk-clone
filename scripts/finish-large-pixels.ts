import fs from 'node:fs';
const previous=JSON.parse(fs.readFileSync('reference/additional-static-pixels-0-before-large-optimization.json','utf8'));
for(const [route,widths,name]of [['/glossary','1024,810,390','additional-glossary-remaining'],['/legal/standard-terms','1440,1024,810,390','additional-legal-standard']]){
 const log=fs.openSync(`reference/${name}.log`,'w');const child=Bun.spawn(['bun','scripts/verify-pixels.ts',route,widths,name],{stdout:log,stderr:log});await child.exited;fs.closeSync(log);
 if(fs.existsSync(`reference/${name}.json`))previous.push(...JSON.parse(fs.readFileSync(`reference/${name}.json`,'utf8')));
 fs.writeFileSync('reference/additional-static-pixels-0.json',JSON.stringify(previous,null,2));console.log(JSON.stringify({route,complete:previous.length}));
}
