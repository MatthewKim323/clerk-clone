import fs from 'node:fs';
const routes=JSON.parse(fs.readFileSync('reference/home-link-audit.json','utf8')).links.filter((row:any)=>row.classification==='uncaptured-public-page'&&row.href!=='/components/theme-editor').map((row:any)=>row.href as string);
const results:any[]=[];
const run=async(args:string[],file:string)=>{const out=fs.openSync(file,'w');const child=Bun.spawn(args,{stdout:out,stderr:out});const code=await child.exited;fs.closeSync(out);return code};
while(results.length<routes.length) {
  const ready=routes.find((route:string)=>{
    if(results.some(row=>row.route===route))return false;
    const ref='reference/site-'+route.slice(1).replace(/[^a-z0-9]+/gi,'-');
    try {const report=JSON.parse(fs.readFileSync(`${ref}/capture/report.json`,'utf8')).report;return fs.existsSync(`${ref}/supplement/page.json`)&&Object.values(report.viewports).length===4&&Object.values(report.viewports).every((vp:any)=>vp.captureStatus==='complete')}catch{return false}
  });
  if(!ready){await new Promise(resolve=>setTimeout(resolve,5000));continue;}
  const ref='reference/site-'+ready.slice(1).replace(/[^a-z0-9]+/gi,'-');fs.mkdirSync(`${ref}/build`,{recursive:true});
  await run(['bun','scripts/build-routes.ts'],`${ref}/build/generate.log`);
  let checks:any[]=[];
  for(let attempt=0;attempt<3;attempt++) {
    const file=`${ref}/build/layout-check.jsonl`;
    await run(['bun','scripts/check-routes.ts',ready],file);
    checks=fs.readFileSync(file,'utf8').split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
    const failed=checks.filter(row=>row.delta);
    if(!failed.length||attempt===2)break;
    await run(['bun','scripts/fit-route-copy.ts',ready,failed.map(row=>row.width).join(',')],`${ref}/build/copy-fit-${attempt}.log`);
    await run(['bun','scripts/build-routes.ts'],`${ref}/build/generate.log`);
  }
  const verifyCode=await run(['bun','scripts/verify-routes.ts',`--routes=${ready}`],`${ref}/build/final-verify-summary.log`);
  const verified=fs.existsSync(`${ref}/build/verify.json`)&&JSON.parse(fs.readFileSync(`${ref}/build/verify.json`,'utf8')).pass===true;
  const result={route:ready,checks,verifyCode,verified};results.push(result);
  fs.writeFileSync('reference/additional-pages-checks.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify({route:ready,verified,geometryFailures:checks.filter(row=>row.delta||row.overflow||row.error||row.errors?.length)}));
}
