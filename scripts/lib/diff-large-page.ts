import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pipeline} from 'node:stream/promises';
import sharp from '../../tooling/1to1/node_modules/sharp/lib/index.js';
import { Args } from '../../tooling/1to1/src/lib/args.ts';

// All full-resolution pixels use the shared rig's channel-distance metric and threshold.
// Short bands bound memory; comparison sheets are separate labeled bands for very tall pages.
export async function runLargePageDiff(argv: string[]) {
  const args = new Args(argv), [buildFile, refFile, outDir] = args.positional;
  const scale = args.num('scale', 2), threshold = args.num('threshold', 40);
  const input = {limitInputPixels:false};
  const [build, ref] = await Promise.all([sharp(buildFile,input).metadata(),sharp(refFile,input).metadata()]);
  const width = Math.min(build.width!,ref.width!), commonHeight = Math.min(build.height!,ref.height!);
  let ranges: [string,number,number][] | undefined = args.str('ranges') ? JSON.parse(args.str('ranges')!) : undefined;
  if (!ranges && args.str('ref')) {
    const report = JSON.parse(fs.readFileSync(path.join(args.str('ref')!,'capture/report.json'),'utf8')).report;
    ranges = report.sections?.[args.str('vp','desktop')]?.map((section:any,index:number)=>[`${String(index).padStart(2,'0')}-${section.slug}`,section.y,section.y+section.h]);
  }
  if (!ranges?.length) ranges = [['page',0,commonHeight/scale]];
  fs.mkdirSync(outDir,{recursive:true});
  const cache=fs.mkdtempSync(path.join(os.tmpdir(),'aurora-pixel-bands-'));
  const rawFiles=[path.join(cache,'build.rgb'),path.join(cache,'reference.rgb')];
  await Promise.all([pipeline(sharp(buildFile,{...input,sequentialRead:true}).removeAlpha().raw(),fs.createWriteStream(rawFiles[0])),pipeline(sharp(refFile,{...input,sequentialRead:true}).removeAlpha().raw(),fs.createWriteStream(rawFiles[1]))]);
  const handles=await Promise.all(rawFiles.map(file=>fs.promises.open(file,'r')));
  const readBand=async(index:number,top:number,height:number)=>{
    const sourceWidth=index===0?build.width!:ref.width!,buffer=Buffer.alloc(width*height*3);
    if(sourceWidth===width){let read=0;while(read<buffer.length){const result=await handles[index].read(buffer,read,buffer.length-read,top*width*3+read);if(!result.bytesRead)throw new Error('Incomplete comparison pixel data');read+=result.bytesRead;}}
    else for(let row=0;row<height;row++)await handles[index].read(buffer,row*width*3,width*3,((top+row)*sourceWidth)*3);
    return buffer;
  };
  const results: {name:string;differ:number;comparedPixels:number;sheets:string[]}[]=[];
  try {
  for (const [name,y0,y1] of ranges) {
    const top=Math.round(y0*scale),height=Math.round((y1-y0)*scale);
    if(top<0||height<=0||top+height>commonHeight) throw new Error(`Invalid full-resolution range ${name}`);
    let different=0; const sheets:string[]=[];
    for(let offset=0;offset<height;offset+=2048){
      const bandHeight=Math.min(2048,height-offset), region={left:0,top:top+offset,width,height:bandHeight};
      const [b,r]=await Promise.all([readBand(0,region.top,bandHeight),readBand(1,region.top,bandHeight)]);
      const mask=Buffer.alloc(width*bandHeight);
      for(let i=0,p=0;i<b.length;i+=3,p++) if(Math.max(Math.abs(b[i]-r[i]),Math.abs(b[i+1]-r[i+1]),Math.abs(b[i+2]-r[i+2]))>threshold){mask[p]=255;different++;}
      const sheet=await sharp({create:{width:width*3+40,height:bandHeight,channels:3,background:'#ff00ff'}}).composite([
        {input:await sharp(b,{raw:{width,height:bandHeight,channels:3}}).png().toBuffer(),left:0,top:0},
        {input:await sharp(r,{raw:{width,height:bandHeight,channels:3}}).png().toBuffer(),left:width+20,top:0},
        {input:await sharp(mask,{raw:{width,height:bandHeight,channels:1}}).png().toBuffer(),left:width*2+40,top:0},
      ]).png().toBuffer();
      const filename=`${name}-band-${String(offset/2048).padStart(3,'0')}.png`;
      await sharp(sheet).resize({width:Math.round((width*3+40)/scale)}).png().toFile(path.join(outDir,filename));
      sheets.push(filename);
    }
    results.push({name,differ:different/(width*height),comparedPixels:width*height,sheets});
    console.log(`${name}: ${(100*different/(width*height)).toFixed(2)}% pixels differ (${y0} to ${y1})`);
  }
  fs.writeFileSync(path.join(outDir,'diff.json'),JSON.stringify(results,null,2));
  } finally {await Promise.all(handles.map(handle=>handle.close()));for(const file of rawFiles)fs.unlinkSync(file);fs.rmdirSync(cache);}
}
