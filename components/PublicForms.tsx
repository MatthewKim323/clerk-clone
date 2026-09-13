'use client';

import {useEffect} from 'react';

export function PublicForms() {
  useEffect(()=>{
    if(!/^\/(sign-in|sign-up|contact|waitlist|startups|github-student-developer-pack)\/?$/.test(location.pathname))return;
    const abort=new AbortController();
    const added:HTMLElement[]=[];
    const notify=(form:HTMLElement,message:string)=>{
      let status=form.querySelector<HTMLElement>('[data-preview-status]');
      if(!status){status=document.createElement('p');status.dataset.previewStatus='true';status.setAttribute('role','status');status.style.cssText='margin-top:16px;font-size:13px;line-height:20px;color:inherit';form.append(status);added.push(status);}
      status.textContent=message;
    };
    for(const form of document.querySelectorAll<HTMLFormElement>('form')) {
      form.addEventListener('submit',event=>{
        event.preventDefault();
        if(form.reportValidity())notify(form,'This is a local preview. No information was sent.');
      },{signal:abort.signal});
    }
    const passwordButtons=[...document.querySelectorAll<HTMLButtonElement>('button[aria-label="Show password"]')];
    for(const button of passwordButtons) {
      button.type='button';
      button.addEventListener('click',()=>{
        const input=button.parentElement?.querySelector<HTMLInputElement>('input')||button.closest('form')?.querySelector<HTMLInputElement>('input[autocomplete*="password"]');
        if(!input)return;
        const show=input.type==='password';input.type=show?'text':'password';
        button.setAttribute('aria-label',show?'Hide password':'Show password');
      },{signal:abort.signal});
    }
    for(const button of document.querySelectorAll<HTMLButtonElement>('button[class*="socialButtonsBlockButton"]'))button.addEventListener('click',()=>{
      const card=button.closest<HTMLElement>('[class*="cardBox"]')||button.parentElement;
      if(card)notify(card,'Account sign-in is not connected in this preview.');
    },{signal:abort.signal});
    return()=>{abort.abort();added.forEach(node=>node.remove());};
  },[]);
  return null;
}
