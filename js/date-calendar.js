/* One click selects a day; a second selects the inclusive interval. */
const RailRoamCalendar=(()=>{
 let closeCurrent;
 function choose(value,date){if(!value.from||value.to)return {from:date,to:''};const [from,to]=[value.from,date].sort();return {from,to:from===to?'':to};}
 function selectable(date,min='',max='',available,today=localYmd(new Date())){return date>=today&&(!min||date>=min)&&(!max||date<=max)&&(!available||available.has(date));}
 function open({anchor,title='Travel dates',from='',to='',min='',max='',available,allowLength=false,length=null,onPick}){
  const today=localYmd(new Date());if(!min||min<today)min=today;
  closeCurrent?.();const overlay=document.createElement('div');overlay.className='calendar-overlay calendar-anchored';let value={from,to},clicked=false;
  let month=(from&&from>=min?from:min).slice(0,7)+'-01';
  overlay.innerHTML=`<section class="date-calendar" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" tabindex="-1"><header><strong>${escapeHtml(title)}</strong><button type="button" data-close aria-label="Close calendar">×</button></header><div class="calendar-month"><button type="button" data-month="-1" aria-label="Previous month">‹</button><strong></strong><button type="button" data-month="1" aria-label="Next month">›</button></div><div class="calendar-weekdays">${['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=>'<span>'+d+'</span>').join('')}</div><div class="calendar-days"></div><p class="calendar-choice"></p><footer><button type="button" data-any>Anytime</button><button type="button" data-done>Done</button></footer></section>`;
  const panel=overlay.querySelector('.date-calendar'),days=panel.querySelector('.calendar-days'),status=panel.querySelector('.calendar-choice');
  let lengthMode=allowLength&&!!length,lengthMin=Number(length?.min)||7,lengthMax=Number(length?.max)||7,lengthControl;
  if(allowLength){
   const fields=document.createElement('div');fields.className='trip-length-fields window-card duration-range';fields.innerHTML='<div class="window-top"><span class="hint" style="margin:0">Minimum - maximum</span><div class="range-value" data-length-value></div></div><div class="dual-range trip-length-range" aria-label="Trip length range"><div class="dual-track"></div><div class="dual-fill"></div><button type="button" class="dual-handle dual-start" aria-label="Minimum trip length in days"></button><button type="button" class="dual-handle dual-end" aria-label="Maximum trip length in days"></button></div><div class="range-ends"><span>1 day</span><span>31 days</span></div>';status.before(fields);
   const toggle=document.createElement('button');toggle.type='button';toggle.dataset.length='';panel.querySelector('footer [data-done]').before(toggle);
   lengthControl=createDualRange(fields.querySelector('.dual-range'),{min:1,max:31,step:1,allowEqual:true,getStart:()=>lengthMin,getEnd:()=>lengthMax,set:(a,b)=>{lengthMin=a;lengthMax=b;},onRender:()=>{fields.querySelector('[data-length-value]').textContent=lengthMin+(lengthMax===lengthMin?'':'–'+lengthMax)+' days';fields.querySelectorAll('[role=slider]').forEach((h,i)=>h.setAttribute('aria-valuetext',(i?lengthMax:lengthMin)+' days'));}});
  }
  function position(){if(!overlay.isConnected||!anchor)return;const r=anchor.getBoundingClientRect();panel.style.width=Math.min(360,innerWidth-16)+'px';const width=panel.getBoundingClientRect().width,height=Math.min(panel.scrollHeight,innerHeight-16),below=innerHeight-r.bottom-14,above=r.top-14;const top=below>=height||below>=above?r.bottom+6:Math.max(8,r.top-height-6);panel.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';panel.style.top=Math.max(8,top)+'px';panel.style.maxHeight=Math.max(150,innerHeight-top-8)+'px';}
  const onScroll=e=>{if(!panel.contains(e.target))position();};
  function paintMode(){if(!allowLength)return;panel.querySelector('header strong').textContent=lengthMode?'Trip length':title;for(const selector of ['.calendar-month','.calendar-weekdays','.calendar-days'])panel.querySelector(selector).hidden=lengthMode;panel.querySelector('.trip-length-fields').hidden=!lengthMode;panel.querySelector('[data-length]').textContent=lengthMode?'Use dates':'Trip length';if(lengthMode)status.textContent='Calendar days after departure.';}
  function paint(){const first=new Date(month+'T12:00:00'),year=first.getFullYear(),m=first.getMonth(),count=new Date(year,m+1,0).getDate(),offset=(first.getDay()+6)%7;panel.querySelector('.calendar-month strong').textContent=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(first);
   days.innerHTML='<span></span>'.repeat(offset)+Array.from({length:count},(_,i)=>{const date=`${year}-${String(m+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`,disabled=!selectable(date,min,max,available),selected=value.from&&date>=value.from&&date<=(value.to||value.from);return `<button type="button" data-day="${date}" aria-label="${escapeHtml(displayDate(date))}" aria-pressed="${!!selected}" ${disabled?'disabled':''} class="${selected?'in-range':''} ${date===value.from?'range-start':''} ${date===(value.to||value.from)?'range-end':''}">${i+1}</button>`;}).join('');
   status.textContent=value.from?displayDate(value.from)+(value.to?' – '+displayDate(value.to):''):'Choose a day, or two dates for a range.';paintMode();position();
  }
  const close=()=>{overlay.remove();document.removeEventListener('keydown',key);window.removeEventListener('resize',position);document.removeEventListener('scroll',onScroll,true);if(anchor?.isConnected)anchor.focus();if(closeCurrent===close)closeCurrent=null;},key=e=>{if(e.key==='Escape')close();};closeCurrent=close;
  overlay.onclick=e=>{if(e.target===overlay||e.target.closest('[data-close]')){close();return;}
   if(e.target.closest('[data-length]')){lengthMode=!lengthMode;paint();panel.focus();return;}
   const day=e.target.closest('[data-day]');if(day&&!day.disabled){value=choose(clicked?value:{from:'',to:''},day.dataset.day);clicked=true;paint();return;}const nav=e.target.closest('[data-month]');if(nav){const d=new Date(month+'T12:00:00');d.setMonth(d.getMonth()+Number(nav.dataset.month));month=localYmd(d).slice(0,7)+'-01';paint();return;}if(e.target.closest('[data-any]')){onPick({from:'',to:''});close();return;}if(e.target.closest('[data-done]')){
    if(!lengthMode&&value.from&&!selectable(value.from,min,max,available)){status.textContent='Choose today or a later available date.';return;}
    if(lengthMode){onPick({length:{min:lengthMin,max:lengthMax}})}else onPick(value);close();}};
  document.body.append(overlay);document.addEventListener('keydown',key);window.addEventListener('resize',position);document.addEventListener('scroll',onScroll,true);paint();panel.focus();
 }
 return {open,choose,selectable,close:()=>closeCurrent?.()};
})();
window.RailRoamCalendar=RailRoamCalendar;
