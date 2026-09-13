import fs from 'node:fs';
const groups=[
  {name:'final-nextjs-pixels',route:'/nextjs-authentication'},
  {name:'final-react-pixels',route:'/react-authentication'},
  {name:'final-theme-pixels',route:'/components/theme-editor'},
];
await Promise.all(groups.map(async group=>{
  const log=fs.openSync(`reference/${group.name}.log`,'w');
  const child=Bun.spawn(['bun','scripts/verify-pixels.ts',group.route,'1440,1024,810,390',group.name],{stdout:log,stderr:log});
  const code=await child.exited;fs.closeSync(log);console.log(JSON.stringify({name:group.name,code}));
}));
