import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const projectRoot=fileURLToPath(new URL('../',import.meta.url));
process.chdir(projectRoot);
const {sanitizeReferenceMarkup}=await import('./sanitize-reference');
const executable=fileURLToPath(new URL('../tooling/1to1/bin/1to1',import.meta.url));
const child=Bun.spawn([executable,'blackout',projectRoot],{cwd:projectRoot,stdout:'pipe',stderr:'pipe'});
const [out,error,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
const log=sanitizeReferenceMarkup(out+error);fs.writeFileSync('reference/final-blackout.log',log);console.log(code===0?'Blackout CLEAN':log);if(code)process.exitCode=code;
