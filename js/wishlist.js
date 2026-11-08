/* Small bounded beam search: each saved service is mandatory, order and bridging
 * journeys may vary. Timetable rows, never synthetic departures, form the legs. */
const RailRoamWishlist=(()=>{
 const $=id=>document.getElementById(id),esc=escapeHtml,day=86400000;
 let items=[],active='plan',generation=0;

 const panel=document.createElement('section');panel.id='wishlistPanel';panel.className='workspace-panel';panel.hidden=true;
 panel.innerHTML=`<div class="card"><div class="section-title">Wishlist</div><p class="hint">Save connections from the map, or find a city below.</p><div class="ac-wrap"><input id="wishCity" class="place-input" placeholder="Find a city or port" aria-label="Find wishlist connections"><div class="ac-menu"></div><div class="status"></div></div><div id="wishConnections" class="connection-list"></div><div class="wish-dates"><label>Start date (optional)<input id="wishStart" type="date"></label><label>End date (optional)<input id="wishEnd" type="date"></label></div><p class="hint">Leave dates blank to search the next four weeks.</p><div id="wishItems"></div><div id="wishStays"></div><div id="wishError" role="alert"></div></div>`;
 $('plannerPanel').after(panel);

 let preferences={};
 const stays=preferences.stays||{};if(preferences.start)$('wishStart').value=preferences.start;if(preferences.end)$('wishEnd').value=preferences.end;
 const staySteps=[...new Set([...VISIT_STEPS,10*1440,14*1440,21*1440,28*1440,31*1440])].sort((a,b)=>a-b);
 const stayBounds=city=>typeof stays[city]==='number'?{min:stays[city],max:stays[city]}:stays[city];
 const stayTarget=city=>{const p=stayBounds(city);return p?(p.min+p.max)/2:targetHours(city);};
 const stepFor=minutes=>staySteps.reduce((best,n,i)=>Math.abs(n-minutes)<Math.abs(staySteps[best]-minutes)?i:best,0);
 function persist(){document.dispatchEvent(new CustomEvent('railroam:wishlist-change'));}
 function windowDates(){return RailRoamSchedule.bounds(window.RailRoamUnified?appState.leaveDate:$('wishStart').value,window.RailRoamUnified?appState.arriveDate:$('wishEnd').value);}
 function add(c){
  const origin=c.origin||c.from,destination=c.destination||c.to;
  if(items.some(x=>x.origin===origin&&x.destination===destination&&x.kind===c.kind&&x.operator===c.operator)){RailRoamExplorer.setPanel('wishlist');return;}
  if(items.length>=6){$('wishError').textContent='Keep up to six connections. Remove one before adding another.';RailRoamExplorer.setPanel('wishlist');return;}
  items.push({...c,origin,destination,leg:undefined,date:'',uid:Date.now()+'-'+Math.random().toString(36).slice(2)});persist();render();RailRoamExplorer.setPanel('wishlist');
 }

 function carriers(c){const variants=c.variants?.length?c.variants:EXPLORER_CONNECTIONS.filter(v=>[v.from,v.to].map(canonicalCityKey).sort().join('|')===[c.origin,c.destination].map(canonicalCityKey).sort().join('|'));return [...new Set([...(c.operator?[c.operator]:[]),...variants.map(v=>v.operator)].filter(Boolean))];}
 function allowed(c,r){return !Array.isArray(c.allowedOperators)||(r.operators||[]).some(o=>c.allowedOperators.includes(o.id));}
 function render(){
  $('wishItems').innerHTML=items.map(c=>`<article class="wish-item"><div class="wish-title"><strong>${esc(c.origin)} → ${esc(c.destination)}</strong><button type="button" data-remove-wish="${c.uid}" aria-label="Remove ${esc(c.origin)} to ${esc(c.destination)}">×</button></div><div class="hint">${esc(['any','all'].includes(c.kind)?'All services':c.kind)} · ${esc(c.variants?.length||!c.operator?'All operators':EXPLORER_OPERATORS[c.operator]?.name||'Train')}</div><details class="train-options"><summary>Options</summary><details class="train-option-section date-options"><summary><span>Travel dates</span><span>${c.date?esc(displayDate(c.date)+(c.dateEnd?' \u2013 '+displayDate(c.dateEnd):'')):'Anytime'}</span></summary><button type="button" class="wish-date-toggle" data-calendar="${c.uid}">Choose dates</button><div id="dates-${c.uid}" class="wish-calendar" hidden></div></details><details class="train-option-section carrier-options"><summary><span>Carriers</span><span>${c.allowedOperators?c.allowedOperators.length+' selected':'All'}</span></summary>${carriers(c).map(id=>`<label><input type="checkbox" data-carrier="${esc(id)}" data-train="${c.uid}" ${!c.allowedOperators||c.allowedOperators.includes(id)?'checked':''}> ${esc(EXPLORER_OPERATORS[id]?.name||id)}</label>`).join('')||'<p class="hint">Carriers are identified from the timetable.</p>'}</details></details></article>`).join('')||'<p class="empty">No trains selected.</p>';
  const cities=[...new Set(items.flatMap(c=>[c.origin,c.destination]))];
  const selected=new Set(collectSelections().visits.filter(v=>v.sel).map(v=>canonicalCityKey(v.sel.city)));
  $('wishStays').innerHTML=cities.filter(city=>!selected.has(canonicalCityKey(city))).map(city=>`<button type="button" class="add-train-city" data-add-train-city="${esc(city)}" aria-label="Add ${esc(city)} to city wishlist"><span>${esc(city)}</span><span aria-hidden="true">+</span></button>`).join('');
  $('wishlistCount').textContent='';
 }
 async function calendar(c,root){
  root.hidden=false;root.textContent='Checking available dates…';const token=generation;
  try{const b=windowDates(),data=await RailRoamSchedule.load(c,b.start,b.end);if(token!==generation||!root.isConnected)return;root.hidden=true;
   const available=new Set(data.rows.filter(r=>allowed(c,r)&&RailRoamSchedule.dateOf(r.last.endTime,r.last.to?.tz)<=b.end).map(r=>r.date));
   RailRoamCalendar.open({anchor:root.previousElementSibling,title:c.origin+' → '+c.destination,from:c.date||'',to:c.dateEnd||'',min:b.start,max:b.end,available,onPick:value=>{c.date=value.from;c.dateEnd=value.to;c.dateMode=!value.from?'any':value.to?'range':'date';persist();render();}});
  }catch(e){root.textContent=e.message;}
 }
 panel.onclick=e=>{const addCity=e.target.closest('[data-add-train-city]');if(addCity){window.RailRoamCityWishlist?.add(RailRoamExplorer.getCity(addCity.dataset.addTrainCity));render();return;}const stay=e.target.closest('[data-add-stay]');if(stay){const city=stay.dataset.addStay;if(stayBounds(city))delete stays[city];else{const n=targetHours(city);stays[city]={min:Math.max(.5,n*.5),max:Math.min(744,n*1.5)};}persist();render();return;}const remove=e.target.closest('[data-remove-wish]');if(remove){items=items.filter(c=>c.uid!==remove.dataset.removeWish);persist();render();return;}const toggle=e.target.closest('[data-calendar]');if(toggle){const c=items.find(x=>x.uid===toggle.dataset.calendar);calendar(c,$('dates-'+c.uid));return;}};
 panel.oninput=e=>{if(e.target.dataset.carrier){const c=items.find(x=>x.uid===e.target.dataset.train);const selected=new Set(c.allowedOperators||carriers(c));if(e.target.checked)selected.add(e.target.dataset.carrier);else selected.delete(e.target.dataset.carrier);c.allowedOperators=[...selected];const label=e.target.closest('.carrier-options')?.querySelector('summary span:last-child');if(label)label.textContent=c.allowedOperators.length+' selected';generation++;persist();return;}if(e.target.dataset.stay){stays[e.target.dataset.stay]=e.target.value===''?null:Number(e.target.value);persist();}};
 ['wishStart','wishEnd'].forEach(id=>$(id).onchange=()=>{generation++;const start=$('wishStart').value||localYmd(),end=$('wishEnd').value||addDaysYmd(start,27);items.forEach(c=>{if(c.date&&(c.date<start||c.date>end))c.date='';});render();persist();});
 document.addEventListener('railroam:panel',e=>{if(e.detail!=='results')active=e.detail;});
 function targetHours(city){const text=EXPLORER_CITY_GUIDES[city]?.[0]||'1 day',m=text.match(/(\d+)(?:[–-](\d+))?/);return m?((+m[1]+ +(m[2]||m[1]))/2)*(/day/i.test(text)?24:1):24;}
 function seasonalScore(city,date){const season=(EXPLORER_CITY_GUIDES[city]?.[1]||'').toLowerCase(),m=new Date(date).getUTCMonth();if((/winter/.test(season)&&[11,0,1].includes(m))||(/spring/.test(season)&&[2,3,4].includes(m))||(/summer/.test(season)&&[5,6,7].includes(m))||(/autumn|fall/.test(season)&&[8,9,10].includes(m)))return 2;const names=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];const matches=[...season.matchAll(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/g)].map(x=>names.indexOf(x[0]));if(!matches.length)return 0;return matches.some((a,i)=>i%2===0&&((a<=(matches[i+1]??a)&&m>=a&&m<=(matches[i+1]??a))||(a>(matches[i+1]??a)&&(m>=a||m<=matches[i+1]))))?2:0;}
 function stayScore(city,hours,date){const preferred=stayBounds(city),target=stayTarget(city),distance=preferred?Math.max(0,preferred.min-hours,hours-preferred.max):Math.abs(hours-target);return CityRanking.score(city)+seasonalScore(city,date)-distance/Math.max(6,target)*5;}
 async function search(signal){
  if(!items.length)throw Error('Add at least one connection to your wishlist.');
  if(items.length>4)throw Error('To keep this search manageable, plan up to four connections at a time.');
  const deadline=performance.now()+90000;const b=windowDates(),data=await Promise.all(items.map(c=>RailRoamSchedule.load(c,b.start,b.end,signal)));
  data.forEach((d,i)=>{if(d.partial)throw Error('Some dates could not be checked. Retry or narrow your trip dates.');if(!d.rows.some(r=>!items[i].date||r.date>=items[i].date&&r.date<=(items[i].dateEnd||items[i].date)))throw Error(`No published ${items[i].origin} → ${items[i].destination} service in these dates. Choose other dates or check the operator.`);});
  let states=[{mask:0,parts:[],visits:[],score:0,current:null,end:null}];const bridgeCache=new Map();
  for(let depth=0;depth<items.length;depth++){if(signal?.aborted)throw Object.assign(Error('Search cancelled'),{name:'AbortError'});
   const next=[];
   const batches=await searchMap(states,async state=>{const found=[];for(let i=0;i<items.length;i++){
    if(performance.now()>deadline)throw Error('This combination is taking too long. Choose travel dates or fewer connections.');if(state.mask&(1<<i))continue;const c=items[i],from=c.fromPlace||RailRoamExplorer.getCity(c.origin),to=c.toPlace||RailRoamExplorer.getCity(c.destination);
    const candidates=data[i].rows.filter(r=>allowed(c,r)&&(typeof RailRoamSleeper==='undefined'||RailRoamSleeper.itineraryAllowed(r.it))&&(!c.date||r.date>=c.date&&r.date<=(c.dateEnd||c.date))&&RailRoamSchedule.dateOf(r.last.endTime,r.last.to?.tz)<=b.end&&(!state.end||new Date(r.first.startTime)>state.end));
    // Prefer candidates near the desired stay while retaining different dates.
    candidates.sort((a,z)=>{const rank=r=>state.end?Math.abs((new Date(r.first.startTime)-state.end)/3600000-stayTarget(state.current.city)):0;return rank(a)-rank(z);});
    for(const row of candidates.slice(0,8)){
     let parts=[...state.parts],visits=state.visits.slice(),score=state.score,arrival=state.end;
     if(state.current&&canonicalCityKey(state.current.city)!==canonicalCityKey(from.city)){
      const key=[state.current.city,from.city,+state.end,row.first.startTime].join('|');
      if(!bridgeCache.has(key)){if(bridgeCache.size>=32)continue;bridgeCache.set(key,querySegment(state.current,from,new Date(+state.end+30*60000),new Date(row.first.startTime),6,false,signal));}
      const bridges=(await bridgeCache.get(key)).filter(it=>new Date(it.startTime)>=new Date(+state.end+30*60000)&&new Date(it.endTime)<=new Date(+new Date(row.first.startTime)-30*60000));
      bridges.sort((a,z)=>itineraryConnectionScore(z)-itineraryConnectionScore(a));if(!bridges.length)continue;
      const bridge=bridges[0],stay=(new Date(bridge.startTime)-state.end)/3600000;
      if(stay>=.5)visits[parts.length-1]={sel:state.current,arrival:state.end.toISOString(),min:30,max:stay*60,explicit:true};
      score+=stayScore(state.current.city,stay,bridge.startTime);parts.push({itinerary:bridge,to:from});arrival=new Date(bridge.endTime);
     }
     if(arrival){const previous=transitLegs(parts.at(-1).itinerary).at(-1);if((new Date(row.first.startTime)-arrival)/60000<Math.max(30,stationTransferMinutes(previous.to,row.first.from)))continue;const hours=(new Date(row.first.startTime)-arrival)/3600000;if(hours<.5)continue;visits[parts.length-1]={sel:from,arrival:arrival.toISOString(),min:30,max:hours*60,explicit:true};score+=stayScore(from.city,hours,row.first.startTime);}
     if(!arrival&&$('wishStart').value){score+=stayScore(from.city,(new Date(row.first.startTime)-zonedLocalToDate(b.start,'00:00',from.tz))/3600000,row.first.startTime);}if(depth===items.length-1&&$('wishEnd').value){score+=stayScore(to.city,(zonedLocalToDate(addDaysYmd(b.end,1),'00:00',to.tz)-new Date(row.last.endTime))/3600000,row.last.endTime);}parts.push({itinerary:row.it,to});found.push({mask:state.mask|(1<<i),parts,visits,current:to,end:new Date(row.last.endTime),score:score+itineraryConnectionScore(row.it)});
    }
   }return found;});
   next.push(...batches.flat());
   next.sort((a,z)=>z.score-a.score);states=next.slice(0,12);if(!states.length)break;
  }
  const base=collectSelections();let routes=states.filter(s=>s.mask===(1<<items.length)-1).map(s=>{const form={...base,start:items.find(c=>canonicalCityKey(c.origin)===canonicalCityKey(cleanCityFromStation(transitLegs(s.parts[0].itinerary)[0].from.name)))?.fromPlace||transitLegs(s.parts[0].itinerary)[0].from,finish:s.current,roundTrip:false,visits:s.visits.filter(Boolean).map(v=>({sel:v.sel})),transfers:[]};form.start={...form.start,city:form.start.city||cleanCityFromStation(form.start.name)};const r={...s,final:s.parts.at(-1).itinerary,_form:form};r.analysis=analyzeRoute(r,form);return r;}).filter(r=>RailRoamExplorer.routeAllowed(r)&&(!document.getElementById('allowTransfers')?.checked?r.analysis.nonVisitTransfers===0:r.analysis.maxTechnicalLayover<=appState.maxNonVisitLayover));
  routes.sort((a,z)=>a.analysis.sleepTransfers-z.analysis.sleepTransfers||a.analysis.nonVisitTransfers-z.analysis.nonVisitTransfers||z.score-a.score||compareRoutes(a,z));return {routes,form:routes[0]?._form};
 }
 document.addEventListener('railroam:city-wishlist-change',render);
 render();return {reset(){generation++;items=[];active='plan';for(const k of Object.keys(stays))delete stays[k];preferences={};$('wishStart').value='';$('wishEnd').value='';$('wishError').textContent='';render();persist();},add,search,carriers,allowed,isActive:()=>active==='wishlist',targetHours,seasonalScore,stayScore,items:()=>items,preferences:()=>({stays})};
})();
window.RailRoamWishlist=RailRoamWishlist;
