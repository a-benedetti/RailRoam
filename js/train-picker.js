/* A single input, two explicit city choices. The arrow is a separator, not
 * part of the destination's geocoding query. Editing the prefix resets it. */
function trainPickerQuery(text,origin){
 if(!origin)return {origin:null,query:text};
 const arrow=text.indexOf('→');
 if(arrow<0||norm(text.slice(0,arrow))!==norm(origin.label||origin.city))return {origin:null,query:text};
 return {origin,query:text.slice(arrow+1).trim()};
}
(()=>{
 const input=document.getElementById('wishCity'),root=document.getElementById('wishConnections'),status=input.closest('.ac-wrap').querySelector('.status');
 let origin=null,destination=null,connections=[];
 input.placeholder='From city → to city';input.setAttribute('aria-label','Find a train: departure and destination');status.setAttribute('aria-live','polite');
 const key=p=>canonicalCityKey(p?.city||p?.name||''),esc=escapeHtml;
 function show(){
  if(!origin){root.innerHTML='';return;}
  const groups=new Map();
  for(const c of EXPLORER_CONNECTIONS){if(![canonicalCityKey(c.from),canonicalCityKey(c.to)].includes(key(origin)))continue;const other=canonicalCityKey(c.from)===key(origin)?c.to:c.from;if(destination&&canonicalCityKey(other)!==key(destination))continue;const variants=groups.get(canonicalCityKey(other))||[];variants.push(c);groups.set(canonicalCityKey(other),variants);}
  connections=[...groups.values()].map(variants=>{const first=variants[0],to=canonicalCityKey(first.from)===key(origin)?first.to:first.from;return {...first,origin:origin.city,destination:to,operator:undefined,kind:variants.every(v=>v.kind==='ferry')?'ferry':'all',variants,fromPlace:origin,toPlace:destination||RailRoamExplorer.getCity(to)};});
  root.innerHTML=connections.slice(0,8).map((c,i)=>`<button type="button" data-pick-train="${i}"><span>${esc(destination?c.origin+' → '+c.destination:c.destination)}</span><span aria-hidden="true">+</span></button>`).join('')||(destination?'<p class="hint">No listed direct service between these cities.</p>':'<p class="hint">No listed connections here. Choose another departure city.</p>');
 }
 setupAutocomplete(input,{manualOnly:true,query:text=>{const parsed=trainPickerQuery(text,origin);origin=parsed.origin;destination=null;show();status.textContent=origin?'Choose an arrival city, or a connection below.':'Choose a departure city.';status.className='status';return parsed.query;},onChoose:city=>{
  if(!origin){origin=city;destination=null;input.value=(city.label||city.city)+' → ';status.textContent='Choose an arrival city, or a connection below.';}
  else {destination=city;input.value=(origin.label||origin.city)+' → '+(city.label||city.city);status.textContent='Select a connection below to add it.';}
  input.dataset.selection='';status.className='status';input.focus();input.setSelectionRange(input.value.length,input.value.length);show();
 }});
 document.addEventListener('railroam:reset',()=>{origin=null;destination=null;connections=[];input.value='';status.textContent='';show();});
 root.onclick=e=>{const button=e.target.closest('[data-pick-train]');if(!button)return;const c=connections[Number(button.dataset.pickTrain)];if(!c)return;RailRoamWishlist.add(c);origin=null;destination=null;input.value='';status.textContent='';show();const finder=input.closest('.train-finder');if(finder)finder.open=false;};
})();
