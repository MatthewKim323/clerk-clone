import fs from 'node:fs';
const rows=JSON.parse(fs.readFileSync('reference/routes-layout-check.json','utf8'));
const routes=new Map<string,number[]>();
for(const row of rows)if(row.delta&&!row.route.startsWith('/components/'))routes.set(row.route,[...(routes.get(row.route)||[]),row.width]);
for(const [route,widths] of routes){
 const process=Bun.spawn(['bun','scripts/fit-route-copy.ts',route,widths.join(',')],{stdout:'inherit',stderr:'inherit'});
 if(await process.exited)throw new Error(`Copy fitting failed: ${route}`);
}
const build=Bun.spawn(['bun','scripts/build-routes.ts'],{stdout:'inherit',stderr:'inherit'});
await build.exited;
