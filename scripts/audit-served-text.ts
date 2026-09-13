import fs from 'node:fs';
import path from 'node:path';
const {tokens}=JSON.parse(fs.readFileSync('reference/site/.origin.json','utf8'));
const originSubstringFiles:string[]=[],longDashFiles:string[]=[];
function walk(dir:string){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){walk(file);continue;}if(!/\.(ts|tsx|js|json|css|svg|html|md|txt)$/.test(file))continue;const text=fs.readFileSync(file,'utf8');if(tokens.some((token:string)=>text.toLowerCase().includes(token.toLowerCase())))originSubstringFiles.push(file);if(/[\u2013\u2014]/.test(text))longDashFiles.push(file);}}
for(const dir of ['app','components','lib','content','public','scripts'])walk(dir);
const report={originSubstringFiles,longDashFiles};fs.writeFileSync('reference/final-text-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(originSubstringFiles.length||longDashFiles.length)process.exitCode=1;
