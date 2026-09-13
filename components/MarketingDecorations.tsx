'use client';

import {useEffect} from 'react';
import {animate,motionValue} from 'motion';
import {sourceDots} from './MarketingMotion';

type Cleanup=()=>void;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const random=(seed:number)=>{const value=10000*Math.sin(seed);return value-Math.floor(value);};
const svgNS='http://www.w3.org/2000/svg';

function compliance(root:Element):Cleanup {
  const heading=[...root.querySelectorAll('h3')].find(node=>node.textContent?.trim()==='Compliance');
  const card=heading?.parentElement?.parentElement?.parentElement;
  if(!card)return()=>{};
  const paths=[...card.querySelectorAll<SVGPathElement>('path[stroke="#5DE3FF"]')];
  const old=paths.map(path=>path.getAttribute('style'));
  const progress=motionValue(0);let control:ReturnType<typeof animate>|undefined;
  const render=(length:number)=>paths.forEach(path=>{
    path.setAttribute('pathLength','1');
    const split=path.getAttribute('d')?.startsWith('M28.088 40.25');
    const part=length/3,gap=(1-length)/2;
    path.style.strokeDasharray=split?`${part} ${gap} ${part} ${gap} 2`:`${length} 2`;
    path.style.opacity=String(+(length>0));
  });
  render(0);const off=progress.on('change',render);
  const change=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.name!=='Compliance')return;control?.stop();control=animate(progress,detail.active?1:0,detail.active?{duration:.75,ease:[.25,.75,0,1]}:{});};
  card.addEventListener('aurora:marketing-card-state',change);
  return()=>{control?.stop();off();progress.destroy();card.removeEventListener('aurora:marketing-card-state',change);paths.forEach((path,index)=>old[index]===null?path.removeAttribute('style'):path.setAttribute('style',old[index]!));};
}

function platform(root:Element,reduceMotion=false):Cleanup {
  const host=[...root.querySelectorAll<HTMLElement>('div')].find(node=>node.className.includes('size-[calc(120/16*1rem)]'));
  if(!host)return()=>{};
  const nodes:Element[]=[],controls:{play:()=>void;pause:()=>void;stop:()=>void}[]=[],stops:Cleanup[]=[];
  let active=false,disposed=false,created=false,generation=0;
  const create=()=>{
    if(created)return;created=true;const currentGeneration=generation;
    for(let index=0;index<(reduceMotion?0:9);index++){
      const wrapper=document.createElement('div'),line=document.createElement('div');
      wrapper.style.cssText=`position:absolute;top:50%;left:50%;margin-top:-.5px;width:18.75rem;transform-origin:left;overflow:hidden;transform:rotate(${index*40}deg)`;
      line.style.cssText='height:1px;width:6.25rem;background-image:linear-gradient(to right,#545454,transparent);transform:translateX(12.5rem);opacity:0';wrapper.append(line);host.insertBefore(wrapper,host.children[1]);nodes.push(wrapper);
      const duration=5+2*random(985.23*index),delay=10*random(3834.56*index);
      const movement=animate(line,{transform:['translateX(12.5rem)','translateX(-12.5rem)']},{duration,delay,ease:'linear',repeat:Infinity});
      const opacity=animate(line,{opacity:[0,1,1]},{duration,delay,times:[0,.1,1],ease:'linear',repeat:Infinity});controls.push(movement,opacity);
    }
    const seeds=[183.9,212.1,87.8,224.2,98.3],rotations=[1,8,16,23,5];
    seeds.slice(0,reduceMotion?3:5).forEach((seed,index)=>{
      const glow=document.createElement('div'),svg=document.createElementNS(svgNS,'svg');
      glow.style.cssText=`position:absolute;inset:0;overflow:hidden;border-radius:50%;transform:rotate(${360/27*rotations[index]}deg);background-image:radial-gradient(20% 30% at 100% 50%,rgb(240 0 17 / .15),rgb(240 0 17 / 0));opacity:0`;
      svg.setAttribute('viewBox','0 0 120 120');svg.setAttribute('aria-hidden','true');svg.style.cssText=`position:absolute;inset:0;width:100%;height:100%;overflow:visible;transform:rotate(${360/27*rotations[index]}deg)`;
      const id=`aurora-security-${index}`;
      svg.innerHTML=`<defs><linearGradient id="${id}-v" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="10%" stop-color="rgb(220 38 38 / 0)"/><stop offset="50%" stop-color="rgb(220 38 38)"/><stop offset="90%" stop-color="rgb(220 38 38 / 0)"/></linearGradient><linearGradient id="${id}-h" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="rgb(220 38 38)"/><stop offset="100%" stop-color="rgb(220 38 38 / 0)"/></linearGradient><clipPath id="${id}-clip"><rect width="999" height="999" x="120.5"/></clipPath></defs><path fill="none" stroke="url(#${id}-v)"/><g clip-path="url(#${id}-clip)"><rect width="125" height="1" x="300" y="59.5" fill="url(#${id}-h)"/></g>`;
      const path=svg.querySelector('path')!,rect=svg.querySelector('g rect')!;
      host.append(glow,svg);nodes.push(glow,svg);
      const initialX=reduceMotion?[65,140,160][index]:300;
      const position=motionValue(initialX);let iteration=0;
      const render=(x:number)=>{const angle=clamp((120-x)/120)*48*Math.PI/180;path.setAttribute('d',`M ${60+60*Math.cos(-angle)} ${60+60*Math.sin(-angle)} A 60 60 0 0 ${+(angle>0)} ${60+60*Math.cos(angle)} ${60+60*Math.sin(angle)}`);path.style.opacity=String(clamp(x/60));rect.setAttribute('x',String(x));(rect as SVGElement).style.opacity=String(clamp((300-x)/30));glow.style.opacity=String(x>40?clamp((80-x)/40):clamp(x/40));};
      render(initialX);const off=position.on('change',render);
      const next=()=>{if(disposed||currentGeneration!==generation)return;iteration++;rect.setAttribute('width',String(80+60*random(90.1*seed+iteration)));const control=animate(position,[300,0],{duration:.8+.4*random(12*seed+iteration),delay:1+3*random(78.3*seed+iteration)});controls.push(control);if(!active)control.pause();control.then(()=>{const index=controls.indexOf(control);if(index>=0)controls.splice(index,1);if(!disposed&&currentGeneration===generation)next();});};
      if(!reduceMotion)next();stops.push(()=>{off();position.destroy();});
    });
  };
  const clear=()=>{generation++;controls.splice(0).forEach(control=>control.stop());stops.splice(0).forEach(stop=>stop());nodes.splice(0).forEach(node=>node.remove());created=false;};
  const visibility=()=>{active=inView&&!document.hidden;if(!inView){clear();return;}if(active)create();controls.forEach(control=>active?control.play():control.pause());};
  let inView=false;const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;visibility();},{rootMargin:'232px 0px 232px 0px'});observer.observe(host);document.addEventListener('visibilitychange',visibility);
  return()=>{disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',visibility);clear();};
}

const spriteSource='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAMAAAC67D+PAAAAAXNSR0IArs4c6QAAAEhQTFRFAAAA////AP//AAD/AP//gID/AP//AKr/AL//ANX/AKr/ALb/AN//AL//AMb/AMbjAMz/ANH/ALnoANj/AMj/AMjtANX/AMn/G8447gAAABh0Uk5TAAEBAQICAwMEBgYHCAgJCQoLCw0ODhITA3IuUQAAAEdJREFUeNoNycENwzAMBMFdkgmQ/qs1IPHi+Q4qIioMnfXQNdPfD5KJ/op+cgrHeg8rRONSI3vI7t321i7Pngh21blEDCDwB0UUHis/7NTIAAAAAElFTkSuQmCC';
function billing(root:Element):Cleanup {
  if(innerWidth<768)return()=>{};
  const plan=root.querySelector<HTMLElement>('[data-plan]'),host=plan?.parentElement;
  const mid=host?.querySelector<HTMLElement>('[class*="relative isolate z-20 mx-auto flex size-16"]'),user=host?.querySelector<HTMLElement>('[data-user]'),sub=host?.querySelector<HTMLElement>('[data-sub] > .rounded-lg'),meteor=host?.querySelector<HTMLElement>('[data-meteor]'),dots=host?.querySelector<HTMLElement>('[data-dots]');
  if(!plan||!host||!mid||!user||!sub||!meteor||!dots)return()=>{};
  const canvas=document.createElement('canvas'),wave=document.createElement('canvas'),svg=document.createElementNS(svgNS,'svg');
  canvas.style.cssText=wave.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';canvas.setAttribute('aria-hidden','true');wave.setAttribute('aria-hidden','true');
  svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;visibility:hidden;pointer-events:none';svg.setAttribute('aria-hidden','true');meteor.append(canvas,svg);dots.append(wave);
  const stopDots=sourceDots(wave,{colors:[[1,97,254]],totalSize:3,dotSize:1,opacities:[.32,.32,.48,.48,.48,.8,.8,.8,.96,.96],init:'uniform float u_event_time;',shader:'if(u_event_time>0.0){float offset=u_event_time+map(distance(vec2(u_resolution.x/2.0/u_total_size,0.0),st2),0.0,u_resolution.x/2.0/u_total_size,0.0,2.2)+random(st2)*0.25+1.4;opacity*=step(offset,u_time);}else{opacity=0.0;}'});
  const context=canvas.getContext('2d');if(!context){stopDots();canvas.remove();wave.remove();svg.remove();return()=>{};}
  let width=0,height=0,start=0,raf=0,disposed=false,visible=false;const sprite=new Image();sprite.src=spriteSource;
  let paths:{path:SVGPathElement;drawing:Path2D;length:number;delay:number}[]=[];
  const measure=()=>{
    const t=host.getBoundingClientRect(),r=plan.getBoundingClientRect(),a=mid.getBoundingClientRect(),s=user.getBoundingClientRect(),l=sub.getBoundingClientRect();
    width=t.width-r.width+8;height=t.height;meteor.style.width=`${width}px`;meteor.style.height=`${height}px`;
    const dpr=Math.max(1,Math.min(devicePixelRatio,2));canvas.width=width*dpr;canvas.height=height*dpr;context.setTransform(dpr,0,0,dpr,0,0);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();
    paths=[1,-1].map((direction,index)=>{
      const points:number[][]=[];
      if(innerWidth>=1024){points.push([a.left-t.left+a.width/2,a.top-t.top+a.height/2-17*direction],[a.left-t.left-22,a.top-t.top+a.height/2-17*direction]);const last=points.at(-1)!;points.push([r.right-t.left,last[1]-direction*(last[0]-(r.right-t.left))]);points.reverse();points.push([a.left-t.left+a.width/2,a.top-t.top+a.height/2+17*direction],[a.right-t.left+22,a.top-t.top+a.height/2+17*direction]);const lastRight=points.at(-1)!;points.push([s.left-t.left,lastRight[1]-direction*(lastRight[0]-(s.left-t.left))]);}
      else points.push([r.right-t.left,direction===1?96:176],[r.right-t.left+12,direction===1?96:176],[s.left-t.left-12,direction===1?176:96],[s.left-t.left,direction===1?176:96]);
      points.push([s.left-t.left+s.width/2,s.bottom-t.top],[s.left-t.left+s.width/2,s.bottom+36-t.top],[direction===1?l.left-t.left+8:l.right-t.left-8,s.bottom+36-t.top]);
      const d=`M ${points.map(([x,y])=>`${x-r.width} ${y}`).join(' L ')} a 8 8 45 0 ${direction===1?0:1} ${direction===1?-8:8} 8 v ${l.height-16}`;
      const path=document.createElementNS(svgNS,'path');path.setAttribute('d',d);svg.append(path);return{path,drawing:new Path2D(d),length:path.getTotalLength(),delay:index===0?500:0};
    });
  };
  const cumulative=(count:number)=>{let value=0;for(let index=0;index<count;index++)value+=1.5+index/23*.5;return value;};
  const total=cumulative(24);
  const draw=(now:number)=>{
    if(disposed||!visible||document.hidden||!start)return;context.clearRect(0,0,width,height);let playing=false;
    paths.forEach(({path,drawing,length,delay})=>{
      const elapsed=Math.max(0,now-start-delay),tail=-total+elapsed*.4;if(!elapsed||tail>length)return;playing=true;
      context.beginPath();
      for(let index=0;index<24;index++){const distance=cumulative(index+1)+tail;if(distance<0||distance>length)continue;const size=1.5+(index+1)/24*.5,point=path.getPointAtLength(distance+size/2);if(sprite.complete)context.drawImage(sprite,point.x-size,point.y-size,size*2,size*2);}
      const from=path.getPointAtLength(tail),to=path.getPointAtLength(tail+total);context.rect(Math.min(from.x,to.x)-16,Math.min(from.y,to.y)-16,Math.abs(to.x-from.x)+32,Math.abs(to.y-from.y)+32);
      const gradient=context.createLinearGradient(from.x,from.y,to.x,to.y);gradient.addColorStop(0,'rgb(1 97 254 / 0)');gradient.addColorStop(.5,'rgb(1 97 254 / .2)');gradient.addColorStop(1,'rgb(1 97 254)');context.globalCompositeOperation='source-atop';context.fillStyle=gradient;context.fill();context.globalCompositeOperation='source-over';
      for(let index=0;index<24;index++){const distance=cumulative(index+1)+tail;if(distance<0||distance>length)continue;const p=(index+1)/24,size=1.5+p*.5;context.lineWidth=size;context.strokeStyle=`rgb(1 97 254 / ${p<=.5?p*.4:.2+(p-.5)*1.6})`;context.setLineDash([0,distance,size,999999]);context.stroke(drawing);}context.setLineDash([]);
    });
    if(playing||now-start<500)raf=requestAnimationFrame(draw);
  };
  const trigger=(event:Event)=>{if((event as CustomEvent).detail?.stage!=='subscription')return;start=performance.now();wave.dispatchEvent(new CustomEvent('aurora:marketing-slide',{detail:{index:0,direction:1}}));cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);};
  const resize=new ResizeObserver(measure);resize.observe(host);measure();
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;cancelAnimationFrame(raf);if(visible&&start)raf=requestAnimationFrame(draw);});observer.observe(host);
  const visibility=()=>{cancelAnimationFrame(raf);if(!document.hidden&&visible&&start)raf=requestAnimationFrame(draw);};
  host.addEventListener('aurora:billing-stage',trigger);document.addEventListener('visibilitychange',visibility);
  return()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();resize.disconnect();host.removeEventListener('aurora:billing-stage',trigger);document.removeEventListener('visibilitychange',visibility);stopDots();canvas.remove();wave.remove();svg.remove();};
}

export default function MarketingDecorations({route}:{route:string}) {
  useEffect(()=>{const root=document.querySelector('main');if(!root)return;const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;if(reduced&&route!=='/platform')return;const cleanup=route==='/user-authentication'?compliance(root):route==='/platform'?platform(root,reduced):route==='/billing'?billing(root):()=>{};return cleanup;},[route]);
  return null;
}
