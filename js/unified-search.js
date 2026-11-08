/* Event-labelled timetable search. Required city visits and saved services share
 * one state space; catalogue lines are never substituted for dated trains. */
const RailRoamUnified=(()=>{
 const key=p=>typeof RailRoamCityIdentity!=='undefined'?RailRoamCityIdentity.key(p):canonicalCityKey(p?.city||cleanCityFromStation(p?.name||''));
 const same=(a,b)=>a&&b&&key(a)===key(b);
 const target=v=>({...v,min:v.min?parseTimeMinutes(v.min,false):appState.visitMin,max:v.max?parseTimeMinutes(v.max,false):appState.visitMax,arriveStart:v.arriveStart??0,arriveEnd:v.arriveEnd??1439,leaveStart:v.leaveStart??0,leaveEnd:v.leaveEnd??1439});
 function prune(states,limit){
  const groups=new Map();
  const utility=s=>window.RailRoamScores?.stateUtility(s)??s.score;states.sort((a,b)=>utility(b)-utility(a));
  for(const s of states){const signature=[key(s.current),s.cities,s.trains,(s.autos||[]).join(','),s.parts.at(-1)?.itinerary.legs?.at(-1)?.to?.name||''].join('|');const group=groups.get(signature)||[];
   // Earlier arrival alone cannot dominate a later arrival with a maximum stay.
   const dominates=(a,b)=>a.windowStart<=b.windowStart&&a.windowEnd>=b.windowEnd&&a.score>=b.score&&a.changes<=b.changes&&a.fare<=b.fare;
   if(group.some(a=>dominates(a,s)))continue;const kept=group.filter(a=>!dominates(s,a));kept.push(s);if(kept.length>4){const ordered=kept.slice().sort((a,b)=>a.windowStart-b.windowStart),selected=[kept[0],ordered[0],ordered.at(-1),ordered[Math.floor(ordered.length/2)]];groups.set(signature,[...new Set(selected)]);}else groups.set(signature,kept);
  }
  return [...groups.values()].flat().sort((a,b)=>utility(b)-utility(a)).slice(0,limit);
 }
 function canLeave(s,it){if(!s.parts.length){const t=new Date(it.startTime),lo=tripDepartureStart(s.start.tz),hi=extendedLocalDate(appState.leaveDateEnd||appState.leaveDate,appState.leaveEnd,s.start.tz);if(t<lo||t>hi)return false;}const v=s.parts.length?s.visits[s.parts.length-1]:s.startVisit;if(!v)return true;const first=transitLegs(it)[0],last=s.parts.length?transitLegs(s.parts.at(-1).itinerary).at(-1):null;if(!first)return false;const transfer=last?stationTransferMinutes(last.to,first.from):0,start=new Date(+new Date(v.arrival)+transfer*60000),minutes=visitDurationMinutes(v,start.toISOString(),it.startTime,v.sel.tz);return minutes>=v.min&&minutes<=v.max&&localDateMatches(it.startTime,v.sel.tz,v.leaveDate,v.leaveDateEnd)&&minuteInDailyWindow(it.startTime,v.sel.tz,v.leaveStart??0,v.leaveEnd??1439);}
 function append(s,it,to){const legs=transitLegs(it),previous=s.parts.at(-1),gap=previous?(new Date(it.startTime)-new Date(previous.itinerary.endTime))/3600000:0,stayBonus=gap>=.5?RailRoamWishlist.stayScore?.(s.current.city,gap,it.startTime)||0:0;return {...s,current:to,parts:[...s.parts,{itinerary:it,to}],visits:s.visits.slice(),changes:s.changes+(it.transfers||0),fare:s.fare+itineraryEstimatedFare(it),score:s.score+itineraryConnectionScore(it)-10+stayBonus};}
 function visitState(s,v,index,arrival,deadline){
  if(!localDateMatches(arrival.toISOString(),v.sel.tz,v.arriveDate,v.arriveDateEnd)||!minuteInDailyWindow(arrival.toISOString(),v.sel.tz,v.arriveStart,v.arriveEnd))return null;
  const window=firstDailyWindowWithin(new Date(+arrival+v.min*60000),new Date(Math.min(+deadline,+arrival+(v.max+90)*60000)),v.sel.tz,v.leaveStart,v.leaveEnd,v.leaveDate||'',v.leaveDateEnd||v.leaveDate||'');if(!window)return null;
  const descriptor={...v,arrival:arrival.toISOString(),explicit:v.explicit!==false};
  const next={...s,cities:index<0?s.cities:s.cities|(1<<index),windowStart:window[0],windowEnd:window[1],visits:s.visits.slice(),score:s.score+tourismScore(v.sel.city)+RailRoamWishlist.seasonalScore(v.sel.city,arrival)};
  if(next.parts.length)next.visits[next.parts.length-1]=descriptor;else next.startVisit=descriptor;
  return next;
 }
 function validate(route,form,targets,items){
  route.analysis=analyzeRoute(route,form);const A=route.analysis;
  const endpoints=[route.startVisit,route.visits[route.parts.length-1]].filter(Boolean);
  for(const v of endpoints)if(!A.visits.some(x=>x.explicit&&canonicalCityKey(x.city)===key(v.sel))){const end=v===route.startVisit?new Date(route.parts[0].itinerary.startTime):route.windowStart;
   const usable=visitDurationMinutes(v,v.arrival,end.toISOString(),v.sel.tz);if(usable<v.min||usable>v.max)return false;
   const entry={city:v.sel.city,mins:usable,explicit:true,endpoint:true};if(v===route.startVisit)A.visits.unshift(entry);else A.visits.push(entry);}
  for(let i=0;i<route.visits.length;i++){const v=route.visits[i],next=route.parts[i+1];if(!v||v.explicit===false||!next)continue;const iso=next.itinerary.startTime;if(!localDateMatches(iso,v.sel.tz,v.leaveDate,v.leaveDateEnd)||!minuteInDailyWindow(iso,v.sel.tz,v.leaveStart??0,v.leaveEnd??1439))return false;}
  if(route.startVisit){const v=route.startVisit,iso=route.parts[0].itinerary.startTime;if(!localDateMatches(iso,v.sel.tz,v.leaveDate,v.leaveDateEnd)||!minuteInDailyWindow(iso,v.sel.tz,v.leaveStart??0,v.leaveEnd??1439))return false;}
  if(!targets.every(v=>A.visits.some(x=>x.explicit&&canonicalCityKey(x.city)===key(v.sel))))return false;
  if(form.strictOrder){const actual=A.visits.filter(v=>targets.some(t=>key(t.sel)===canonicalCityKey(v.city))).map(v=>canonicalCityKey(v.city));const expected=targets.map(v=>key(v.sel));if(actual.some((v,i)=>i&&expected.indexOf(v)<expected.indexOf(actual[i-1])))return false;}
  const lo=document.getElementById('visitCountMin').value,hi=document.getElementById('visitCountMax').value;
  if(A.visits.length<Math.max(form.roundTrip?1:0,Number(lo||0))||hi!==''&&A.visits.length>+hi)return false;
  if(!document.getElementById('allowTransfers').checked&&A.nonVisitTransfers||A.maxTechnicalLayover>appState.maxNonVisitLayover)return false;
  return (!window.RailRoamStrategy||RailRoamStrategy.allowed(route,form))&&tripDatesAllowed(route,form)&&RailRoamExplorer.routeAllowed(route,form);
 }
 function seedPlans(form,requiredExtra){
  const requested=form.visits.filter(v=>v.sel),ordered=[];let current=form.start;
  if(form.strictOrder)ordered.push(...requested);
  else {const left=requested.slice();while(left.length){left.sort((a,b)=>geoKm(current,a.sel)-geoKm(current,b.sel));const next=left.shift();ordered.push(next);current=next.sel;}}
  const excluded=new Set([form.start,form.finish,...requested.map(v=>v.sel),...form.transfers.map(v=>v.sel)].filter(Boolean).map(key));
  const duration=n=>Math.floor(n/60)+':'+String(n%60).padStart(2,'0'),plans=[];
  for(let variant=0;variant<2;variant++){
   const visits=ordered.slice(),used=new Set(excluded);
   for(let extra=0;extra<requiredExtra;extra++){
    const proposals=[];for(const hub of AUTO_HUBS){if(used.has(key(hub))||RailRoamExplorer.cityAvoided?.(hub))continue;for(let slot=0;slot<=visits.length;slot++){const a=slot?visits[slot-1].sel:form.start,b=visits[slot]?.sel||form.finish,detour=geoKm(a,hub)+geoKm(hub,b)-geoKm(a,b),score=detour/150-tourismScore(hub.city)*.35-(catalogueConnectionBonus(a,hub)+catalogueConnectionBonus(hub,b))*.25+(geoKm(form.start,hub)<80?1.5:0);proposals.push({hub,slot,score});}}
    proposals.sort((a,b)=>a.score-b.score);const distinct=[...new Map(proposals.map(p=>[key(p.hub),proposals.find(x=>same(x.hub,p.hub))])).values()],pick=distinct[extra===0?variant:0];if(!pick)break;
    visits.splice(pick.slot,0,{sel:pick.hub,min:duration(appState.visitMin),max:duration(appState.visitMax),_automatic:true});used.add(key(pick.hub));
   }
   if(visits.length===requested.length+requiredExtra)plans.push(visits);
  }
  return plans;
 }
 async function quickSeeds(form,targets,extra,depth,providedPlans){
  if(!form.start||!form.finish||RailRoamWishlist.items().length||!providedPlans&&!appState.tripLength&&!extra)return [];
  const plans=[];if(providedPlans)plans.push(...providedPlans);else for(const visits of seedPlans(form,extra)){
   const preferred=visits.map(v=>{const guide=typeof EXPLORER_CITY_GUIDES==='undefined'?null:EXPLORER_CITY_GUIDES[v.sel.city]?.[0],match=guide?.match(/(\d+)(?:\D+(\d+))?\s*days?/),min=parseTimeMinutes(v.min||'',false)||appState.visitMin,max=parseTimeMinutes(v.max||'',false)||appState.visitMax,lo=match?Math.max(min,+match[1]*1440):min,hi=match?Math.min(max,+(match[2]||match[1])*1440):max;return lo<=hi?{...v,min:Math.floor(lo/60)+':'+String(lo%60).padStart(2,'0'),max:Math.floor(hi/60)+':'+String(hi%60).padStart(2,'0')}:v;});
   const minimum=preferred.reduce((n,v)=>n+parseTimeMinutes(v.min,false),0);if(appState.tripLength&&minimum<appState.tripLength.max*1440)plans.push(preferred);plans.push(visits);
  }
  // Broad departure intervals need weekday diversity: the provider's earliest
  // labels can all use the same slow interchange. Probe another day without
  // changing the original departure or relative-arrival constraints.
  const probes=[];if(providedPlans){for(const date of RailRoamStrategy.dates())for(const visits of plans)probes.push({visits,date});}else for(const visits of plans){probes.push({visits});const date=addDaysYmd(appState.leaveDate,5);if(date<=(appState.leaveDateEnd||appState.leaveDate))probes.push({visits,date});}
  const desiredIdeas=providedPlans?Math.min(4,new Set(plans.map(v=>v.map(x=>key(x.sel)).join('|'))).size):1;
  if(depth&&probes.length>1)probes.push(...probes.splice(0,depth%probes.length));
  const seen=new Set(),all=[];let repairs=0;for(let probeIndex=0;probeIndex<probes.length;probeIndex++){const {visits,date}=probes[probeIndex];
   const signature=(date||'')+'|'+visits.map(v=>[key(v.sel),v.min,v.max].join(':')).join('|');if(seen.has(signature))continue;seen.add(signature);
   const autos=new Set(visits.filter(v=>v._automatic).map(v=>key(v.sel))),normalize=routes=>routes.map(r=>{const copy={...r,visits:r.visits.map(v=>v?{...v,...(autos.has(key(v.sel))?{explicit:false}:{})}:v),_form:form};return validate(copy,form,targets,[])?copy:null;}).filter(Boolean);
   let repair;
   const onCandidates=routes=>{if(repairs>=2||repair)return;for(const r of routes){for(let i=0;i<r.analysis.boundaries.length;i++){const b=r.analysis.boundaries[i];if(b.type!=='transfer'||b.gapMin<=appState.maxNonVisitLayover)continue;const hub=RailRoamExplorer.getCity?.(b.city);if(!hub||[form.start,form.finish,...visits.filter(v=>!v._automatic).map(v=>v.sel)].some(p=>same(p,hub))||RailRoamExplorer.cityAvoided?.(hub))continue;
    // Replace a speculative extra city with a deliberate stay at the actual
    // blocking interchange, then re-query its onward service after that stay.
    const part=r.analysis.flat[i].partIndex,base=(providedPlans?visits:visits.filter(v=>!v._automatic)).map(v=>form.visits.find(original=>same(original.sel,v.sel))||v),before=providedPlans?part:visits.slice(0,part).filter(v=>!v._automatic).length,duration=n=>Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
    const candidate={sel:hub,min:duration(appState.visitMin),max:duration(appState.visitMax),_automatic:true};base.splice(before,providedPlans&&base[before]?._automatic?1:0,candidate);if(base.length<targets.length+extra)continue;repair=base;return;
   }}};
   let found;try{found=await liveSearch({...form,visits,_onCandidates:onCandidates,_departureProbe:date,_seedNoDiscovery:true,_searchBeam:providedPlans?1:2+Math.min(depth,1),_searchPerQuery:providedPlans?3:6,onProgress:routes=>{const valid=normalize(routes);if(valid.length)form.onProgress?.([...all,...valid]);}},depth);}catch(error){checkSearchSignal(form.signal);if(repair){repairs++;probes.splice(probeIndex+1,0,{visits:repair,date});}continue;}const valid=normalize(found);all.push(...valid);if(repair&&!valid.length){repairs++;probes.splice(probeIndex+1,0,{visits:repair,date});}
   if(valid.length&&!depth&&(new Set(all.map(r=>typeof routeIdeaKey==='function'?routeIdeaKey(r):r.analysis.visits.map(v=>v.city).join('|'))).size>=desiredIdeas))return [...new Map(all.map(r=>[routeSignature(r),r])).values()];
  }return [...new Map(all.map(r=>[routeSignature(r),r])).values()];
 }
 async function runSearch(form,depth=0){
  const items=RailRoamWishlist.items(),targets=form.visits.filter(v=>v.sel).map(target);
  form._strategy=window.RailRoamStrategy?.classify(form)||form._strategy;
  if(form._strategy==='tour'&&!items.length){
   for(const resolved of RailRoamStrategy.resolve(form,AUTO_HUBS)){
    const seedForm={...resolved,...(RailRoamStrategy.lengths()?.soft?{_preferredArrivalStart:appState.arriveDateStart||appState.arriveDate}:{})},plans=RailRoamStrategy.sequences(seedForm,AUTO_HUBS),seeded=plans.length?await quickSeeds(seedForm,targets,Math.max(0,plans[0].length-targets.length),depth,plans):[];
    if(seeded.length)return seeded;
   }
  }
  if(['stops','excursion'].includes(form._strategy)&&!items.length&&!targets.length&&form.start&&form.finish){
   const resolved={...form,...(form._strategy==='excursion'?{_preferReturnLastDay:true}:{})},plans=RailRoamStrategy.sequences(resolved,AUTO_HUBS),seeded=plans.length?await quickSeeds(resolved,targets,plans[0].length,depth,plans):[];
   if(seeded.length)return seeded;
  }
  if(form._strategy==='journey'&&!items.length&&!targets.length){
   const normal=await liveSearch({...form,_seedNoDiscovery:true},depth);
   if(form.overnightPreference!=='trains'||appState.leaveEnd<1140)return normal;
   const evening=await liveSearch({...form,_seedNoDiscovery:true,_departureProbe:appState.leaveDate,_departureMinute:Math.max(1140,appState.leaveStart)},depth);
   const merged=[...new Map([...normal,...evening].map(r=>[routeSignature(r),r])).values()];if(merged.length)form.onProgress?.(merged);return merged;
  }
  if(!items.length&&!targets.length)return liveSearch(form,depth);
  if(items.some(c=>c.dateMode==='range'&&(!c.date||!c.dateEnd)))throw Error('Choose both ends of each selected-train date range.');
  const requiredExtra=Math.max(0,Math.max(form.roundTrip?1:0,Number(document.getElementById('visitCountMin').value||0))-targets.length);
  const seeded=await quickSeeds(form,targets,requiredExtra,depth);if(seeded.length)return seeded;
  const startDate=appState.leaveDate,endDate=appState.arriveDate;
  const schedules=await Promise.all(items.map(c=>RailRoamSchedule.load(c,startDate,endDate,form.signal)));
  const rows=schedules.map((data,i)=>{if(data.partial)throw Error('Some selected-train dates could not be checked. Retry or narrow the dates.');return data.rows.filter(r=>RailRoamWishlist.allowed?.(items[i],r)!==false&&(!items[i].date||r.date>=items[i].date&&r.date<=(items[i].dateEnd||items[i].date))&&(typeof RailRoamSleeper==='undefined'||RailRoamSleeper.itineraryAllowed(r.it)));});
  rows.forEach((r,i)=>{if(!r.length)throw Error(`No published ${items[i].origin} → ${items[i].destination} service in the chosen dates.`);});
  const anchors=[...targets.map(v=>v.sel),...items.map(c=>c.fromPlace||RailRoamExplorer.getCity(c.origin))].filter(Boolean);
  const nearby=AUTO_HUBS.filter(h=>!anchors.some(a=>same(h,a))&&anchors.some(a=>geoKm(a,h)>50&&geoKm(a,h)<1400)).sort((a,b)=>{const rank=h=>tourismScore(h.city)-Math.min(...anchors.map(x=>geoKm(x,h)))/250;return rank(b)-rank(a);}).slice(0,3);
  const starts=form.start?[form.start]:[...items.map(c=>c.fromPlace||RailRoamExplorer.getCity(c.origin)),...nearby,...anchors].filter(Boolean).filter((p,i,all)=>all.findIndex(x=>same(x,p))===i).slice(0,6);
  if(!starts.length)throw Error('Choose a city to narrow the trip.');
  const finish=form.finish,deadline=extendedLocalDate(endDate,appState.arriveEnd,finish?.tz||starts[0].tz),allCities=(1<<targets.length)-1,allTrains=(1<<items.length)-1;
  let frontier=starts.map(current=>({current,start:current,windowStart:tripDepartureStart(current.tz),windowEnd:extendedLocalDate(appState.leaveDateEnd||startDate,appState.leaveEnd,current.tz),parts:[],visits:[],autos:[],cities:0,trains:0,score:0,changes:0,fare:0}));
  const completed=[];
  for(let round=0;round<targets.length+items.length+requiredExtra;round++){
   checkSearchSignal(form.signal);const batches=await searchMap(frontier,async s=>{
    const next=[];
    for(let i=0;i<targets.length;i++){
     if(s.cities&(1<<i)||form.strictOrder&&i>0&&(s.cities&((1<<i)-1))!==((1<<i)-1))continue;
     const v=targets[i];if(window.RailRoamExplorer?.cityAvoided?.(v.sel))continue;
     if(same(s.current,v.sel)){const arrival=s.parts.length?new Date(s.parts.at(-1).itinerary.endTime):s.windowStart;const n=visitState(s,v,i,arrival,deadline);if(n)next.push(n);continue;}
     const bound=visitArrivalBounds(v),its=bound?await querySegmentWithin(s.current,v.sel,s.windowStart,s.windowEnd,bound[0],bound[1],Math.min(18,10+depth*3),form.signal):await querySegment(s.current,v.sel,s.windowStart,s.windowEnd,Math.min(18,10+depth*3),false,form.signal);
     for(const it of its){if(!canLeave(s,it))continue;if(new Date(it.startTime)<s.windowStart||new Date(it.startTime)>s.windowEnd||new Date(it.endTime)>=deadline)continue;const n=visitState(append(s,it,v.sel),v,i,new Date(it.endTime),deadline);if(n)next.push(n);}
    }
    if((s.autos||[]).length<requiredExtra){
     const banned=new Set([key(s.start),key(finish),...targets.map(v=>key(v.sel)),...(s.autos||[]),...form.transfers.filter(v=>v.sel).map(v=>key(v.sel))]);
     const hubs=AUTO_HUBS.filter(h=>!banned.has(key(h))&&!RailRoamExplorer.cityAvoided?.(h)).sort((a,b)=>hubGeometryScore(s.current,b,finish||s.start,!finish)-hubGeometryScore(s.current,a,finish||s.start,!finish)).slice(0,4+depth*2);
     for(const hub of hubs){const found=await querySegment(s.current,hub,s.windowStart,s.windowEnd,6,false,form.signal);for(const it of found){if(!canLeave(s,it))continue;if(new Date(it.startTime)<s.windowStart||new Date(it.startTime)>s.windowEnd)continue;const n=visitState(append(s,it,hub),{sel:hub,min:appState.visitMin,max:appState.visitMax,arriveStart:0,arriveEnd:1439,leaveStart:0,leaveEnd:1439,explicit:false},-1,new Date(it.endTime),deadline);if(n){n.autos=[...(s.autos||[]),key(hub)];next.push(n);}}}
    }
    for(let i=0;i<items.length;i++){
     if(s.trains&(1<<i))continue;const c=items[i],from=c.fromPlace||RailRoamExplorer.getCity(c.origin),to=c.toPlace||RailRoamExplorer.getCity(c.destination);
     const candidates=rows[i].filter(r=>new Date(r.first.startTime)>=s.windowStart&&new Date(r.last.endTime)<=deadline).sort((a,b)=>new Date(a.first.startTime)-new Date(b.first.startTime)).slice(0,12+depth*4);
     for(const row of candidates){const departure=new Date(row.first.startTime);let connections;
      if(same(s.current,from))connections=[s];
      else {const end=new Date(Math.min(+s.windowEnd,+departure-30*60000));if(end<s.windowStart)continue;const bridge=await querySegmentWithin(s.current,from,s.windowStart,end,null,new Date(+departure-30*60000),6,form.signal);connections=bridge.filter(it=>canLeave(s,it)).map(it=>append(s,it,from));}
      for(const base of connections){const arrival=base.parts.length?new Date(base.parts.at(-1).itinerary.endTime):null;
       if(same(s.current,from)&&departure>s.windowEnd)continue;
       if(arrival&&(departure-arrival)/60000<Math.max(5,stationTransferMinutes(transitLegs(base.parts.at(-1).itinerary).at(-1).to,row.first.from)))continue;
       if(!canLeave(base,row.it))continue;const n=append(base,row.it,to);n.trains|=1<<i;n.windowStart=new Date(+new Date(row.last.endTime)+5*60000);const pending=targets.find((v,j)=>same(v.sel,to)&&!(n.cities&(1<<j)));n.windowEnd=pending?new Date(Math.min(+deadline,+new Date(row.last.endTime)+(pending.max+90)*60000)):deadline;next.push(n);
      }
     }
    }
    return next;
   },3);
   frontier=prune(batches.flat(),24+depth*12);
   const complete=frontier.filter(s=>s.cities===allCities&&s.trains===allTrains);
   for(const s of complete){const finish=form.roundTrip?s.start:form.finish;const last=s.parts.at(-1);if(!last)continue;let endings;
    if(!finish||same(s.current,finish))endings=[s];
    else {const bounds=tripArrivalBounds({...form,start:s.start,finish},transitLegs(s.parts[0].itinerary)[0]?.startTime,(appState.arriveHasTime||appState.arriveIsRange)?extendedLocalDate(appState.arriveDateStart||endDate,appState.arriveStart,finish.tz):null,deadline);endings=(await querySegmentWithin(s.current,finish,s.windowStart,s.windowEnd,bounds[0],bounds[1],12,form.signal)).filter(it=>canLeave(s,it)).map(it=>append(s,it,finish));}
    for(const n of endings){const final=n.parts.at(-1).itinerary;if(new Date(final.endTime)>deadline||n.windowStart>deadline||(appState.arriveHasTime||appState.arriveIsRange)&&new Date(final.endTime)<extendedLocalDate(appState.arriveDateStart||endDate,appState.arriveStart,(finish||n.current).tz))continue;
     const resolved={...form,start:n.start,finish:finish||n.current},r={...n,final,_form:resolved,...(items.length?{_wishlistScore:n.score}:{})};if(validate(r,resolved,targets,items))completed.push(r);
    }
   }
   if(completed.length)form.onProgress?.([...new Map(completed.map(r=>[routeSignature(r),r])).values()].sort(compare));
  }
  checkSearchSignal(form.signal);if(!completed.length&&typeof searchTimetableFailure==='function'&&searchTimetableFailure(form.signal))throw searchTimetableFailure(form.signal);return [...new Map(completed.map(r=>[routeSignature(r),r])).values()].sort(compare);
 }
 async function search(form,depth=0){
  const controller=new AbortController(),parent=form.signal,abort=()=>controller.abort();let timedOut=false,best=[];
  parent?.addEventListener('abort',abort,{once:true});if(parent?.aborted)abort();
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},depth?65000:45000);
  try{return await runSearch({...form,signal:controller.signal,onProgress:routes=>{best=routes;form.onProgress?.(routes);}},depth);}
  catch(error){if(parent?.aborted)throw error;if(timedOut){return best;}throw error;}
  finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);controller.abort();}
 }
 function compare(a,b){return Number.isFinite(a._wishlistScore)&&Number.isFinite(b._wishlistScore)?a.analysis.nonVisitTransfers-b.analysis.nonVisitTransfers||a.analysis.sleepTransfers-b.analysis.sleepTransfers||b._wishlistScore-a._wishlistScore||compareRoutes(a,b):compareRoutes(a,b);}
 return {search,prune,validate,compare,seedPlans};
})();

window.RailRoamUnified=RailRoamUnified;
