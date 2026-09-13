import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('content/routes/manifest.json','utf8'));
const routes=manifest.map((entry:any)=>entry.route as string).filter((route:string)=>route.startsWith('/docs')||route.startsWith('/changelog')||['/blog','/contact','/pricing','/sign-in','/sign-up'].includes(route));
await Promise.all([0,1].map(async part=>{
  const output=fs.openSync(`reference/static-pixels-${part}.log`,'w');
  const child=Bun.spawn(['bun','scripts/verify-pixels.ts',routes.filter((route:string,index:number)=>index%2===part).join(','),'1440,1024,810,390',`static-pixels-${part}`],{stdout:output,stderr:output});
  const code=await child.exited;fs.closeSync(output);
  console.log(JSON.stringify({part,code}));
}));
