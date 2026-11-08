/* One avoidance list; the checked option permits transfers but not sightseeing. */
(()=>{
 const $=id=>document.getElementById(id);
 $('transferOptions').hidden=true;
 const refresh=()=>{RailRoamExplorer.refreshConstraints();document.dispatchEvent(new CustomEvent('railroam:constraints-change'));};
 new MutationObserver(refresh).observe($('transferRows'),{childList:true});
 function enhance(){
  $('visitRows').querySelectorAll('.visit-row:not([data-stay-slider])').forEach((row,index)=>{
   row.dataset.staySlider='true';const low=row.querySelector('.visit-min'),high=row.querySelector('.visit-max');
   const steps=[...new Set([...VISIT_STEPS,14400,20160,30240,40320,44640])].sort((a,b)=>a-b),nearest=n=>steps.reduce((a,v,i)=>Math.abs(v-n)<Math.abs(steps[a]-n)?i:a,0);
   let a=nearest(parseTimeMinutes(low.value,true)||appState.visitMin),b=nearest(parseTimeMinutes(high.value,true)||appState.visitMax);if(b<=a)b=Math.min(a+1,steps.length-1);
   const block=document.createElement('div');block.className='visit-duration';block.innerHTML='<div class="visit-duration-label"></div><div class="dual-range"><div class="dual-track"></div><div class="dual-fill"></div><button type="button" class="dual-handle dual-start" aria-label="Minimum visit length"></button><button type="button" class="dual-handle dual-end" aria-label="Maximum visit length"></button></div><div class="range-ends"><span>30 min</span><span>31 days</span></div>';
   row.querySelector('.visit-card-compat').after(block);const range=block.querySelector('.dual-range'),label=block.querySelector('.visit-duration-label');
   const clock=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
   const control=createDualRange(range,{min:0,max:steps.length-1,step:1,getStart:()=>a,getEnd:()=>b,set:(x,y)=>{a=x;b=y;low.value=clock(steps[a]);high.value=clock(steps[b]);validateForm(false);document.dispatchEvent(new CustomEvent('railroam:constraints-change'));},onRender:()=>{label.textContent='Visit length · '+formatVisitScale(steps[a])+' – '+formatVisitScale(steps[b]);range.querySelector('.dual-start').setAttribute('aria-valuetext',formatVisitScale(steps[a]));range.querySelector('.dual-end').setAttribute('aria-valuetext',formatVisitScale(steps[b]));}});
   low.value=clock(steps[a]);high.value=clock(steps[b]);
   const choices=document.createElement('div');choices.className='stay-presets';choices.innerHTML='<button type="button" data-stay-default>Default stay</button><button type="button" data-stay-recommended>Recommended stay</button>';
   block.prepend(choices);
   function setStay(min,max){a=nearest(min);b=Math.max(a+1,nearest(max));b=Math.min(b,steps.length-1);low.value=clock(steps[a]);high.value=clock(steps[b]);control.render();validateForm(false);document.dispatchEvent(new CustomEvent('railroam:constraints-change'));}
   choices.querySelector('[data-stay-default]').onclick=()=>setStay(appState.visitMin,appState.visitMax);
   const city=JSON.parse(row.dataset.selection||'{}').city,guide=EXPLORER_CITY_GUIDES[city]?.[0]||'1 day',numbers=guide.match(/\d+/g)||['1'],factor=/day/i.test(guide)?1440:60;
   choices.querySelector('[data-stay-recommended]').textContent='Recommended '+guide;
   choices.querySelector('[data-stay-recommended]').onclick=()=>setStay(+numbers[0]*factor,+numbers[numbers.length-1]*factor);
   const details=row.querySelector('.visit-options');if(details){details.querySelector('summary').textContent='Stay & timing';details.prepend(block);details.querySelector('summary')&&details.prepend(details.querySelector('summary'));}
  });
 }
 new MutationObserver(enhance).observe($('visitRows'),{childList:true});enhance();refresh();
})();
