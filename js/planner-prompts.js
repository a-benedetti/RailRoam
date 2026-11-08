/* One always-active trip form; selections last only for the current page. */
(()=>{
 const $=id=>document.getElementById(id),cities=$('visitOptions'),summary=cities.querySelector('summary');summary.hidden=true;summary.style.display='none';cities.open=true;
 for(const key of ['railroam-wishlist-v1','railroam-wishlist-preferences','railroam-city-wishlist-v1','railroam-planner-prompts-v1'])try{localStorage.removeItem(key);}catch{}
 document.querySelectorAll('input').forEach(input=>input.autocomplete='off');
 const cityBody=document.createElement('div');cityBody.id='cityWishlistPrompt';cityBody.className='planner-prompt-body';[...cities.children].filter(el=>el!==summary).forEach(el=>cityBody.append(el));cities.append(cityBody);const title=document.createElement('h2');title.className='planner-prompt-heading';title.textContent='City wishlist';cities.prepend(title);cities.classList.add('planner-prompt');
 const places=$('plannerPanel').querySelector('.trip-places'),trip=document.createElement('section');trip.className='planner-prompt endpoint-prompt full';places.before(trip);const tripBody=document.createElement('div');tripBody.id='endpointPrompt';tripBody.className='planner-prompt-body';tripBody.append(places);const heading=document.createElement('h2');heading.className='planner-prompt-heading';heading.textContent='From A to B';trip.append(heading,tripBody);trip.after(cities);
 const round=$('roundTrip').closest('.roundtrip-mobile-host');if(round)tripBody.prepend(round);$('roundTrip').setAttribute('role','switch');const knob=$('roundTrip').nextElementSibling;knob.className='prompt-switch';knob.textContent='';knob.setAttribute('aria-hidden','true');
 const order=cities.querySelector('.strict-order');cityBody.append(order);
 function compact(){const rows=$('visitRows');order.hidden=rows.children.length<2;[...rows.children].forEach((row,index)=>{
  row.draggable=true;row.classList.add('compact-city');const details=row.querySelector('.visit-options'),duration=row.querySelector('.visit-duration');if(details&&duration&&!details.contains(duration)){details.querySelector('summary').textContent='Stay & timing';details.querySelector('summary').after(duration);const tag=document.createElement('span');tag.className='city-stay-summary';row.querySelector('.visit-card-top').after(tag);const label=duration.querySelector('.visit-duration-label'),update=()=>tag.textContent=label.textContent.replace('Visit length · ','');update();new MutationObserver(update).observe(label,{childList:true});}
  row.ondragstart=e=>{if(e.target.closest('input,select,button,.dual-range')){e.preventDefault();return;}e.dataTransfer.setData('text/plain',String([...rows.children].indexOf(row)));};
  const up=row.querySelector('[data-move="-1"]'),down=row.querySelector('[data-move="1"]');if(up)up.disabled=index===0;if(down)down.disabled=index===rows.children.length-1;
 });}
 new MutationObserver(compact).observe($('visitRows'),{childList:true});compact();
 const clear=$('clearSelection');if(clear){const actions=document.createElement('div');actions.className='panel-actions';document.querySelector('.workspace-tabs').after(actions);clear.className='clear-selection';actions.append(clear);}
})();
