/* Rank a bounded shortlist when one or both endpoints are open. */
const concreteLiveSearch=liveSearch;
liveSearch=async function(form,depth=0){
 if(form.start&&form.finish)return concreteLiveSearch(form,depth);
 form={...form,_openEndpoints:true,_specifiedStart:!!form.start,_specifiedFinish:!!form.finish};
 const anchors=[form.start,form.finish,...form.visits.map(v=>v.sel)].filter(Boolean);

 const span=(new Date(appState.arriveDate)-new Date(appState.leaveDate))/86400000;
 const banned=new Set(form.visits.filter(v=>v.sel).map(v=>canonicalCityKey(v.sel.city)));
 let pool=AUTO_HUBS.filter(h=>!banned.has(canonicalCityKey(h.city))&&(!anchors.length||anchors.some(a=>geoKm(a,h)>50&&geoKm(a,h)<Math.max(500,Math.min(1600,(span+1)*250)))));
 pool.sort((a,b)=>{
  const score=h=>(window.RailRoamScores?.destinationScore(h)??CityRanking.score(h.city))+RailRoamWishlist.seasonalScore(h.city,appState.leaveDate)-(anchors.length?Math.min(...anchors.map(a=>geoKm(a,h)))/700:0);
  return score(b)-score(a);
 });
 if(form.maxTravelHours&&form.start){
  try{const date=appState.leaveDate,time=extendedLocalDate(date,appState.leaveHasTime?appState.leaveStart:540,form.start.tz),data=await queryReachableCities(form.start,new Date(Math.max(+tripDepartureStart(form.start.tz),+time)),form.maxTravelHours,form.signal),places=(data.all||[]).map(r=>r.place).filter(Boolean);
   if(places.length)pool.sort((a,b)=>Number(places.some(p=>geoKm(b,p)<10))-Number(places.some(p=>geoKm(a,p)<10)));
  }catch(error){checkSearchSignal(form.signal);}
  // A single-time overview is only a hint: later departures may reach further.
  pool=pool.filter(h=>geoKm(form.start,h)<form.maxTravelHours*220);
 }
 if(!pool.length)return [];
 const pairs=[];if(form.start||form.finish){pool.slice(0,form.maxTravelHours?6:4).forEach(h=>pairs.push({...form,start:form.start||h,finish:form.finish||(form.roundTrip?form.start||h:h)}));}
 else {for(const a of pool.slice(0,4)){const peers=EXPLORER_CONNECTIONS.filter(c=>[c.from,c.to].some(n=>canonicalCityKey(n)===canonicalCityKey(a.city))).map(c=>RailRoamExplorer.getCity(canonicalCityKey(c.from)===canonicalCityKey(a.city)?c.to:c.from)).filter(Boolean).filter(p=>!RailRoamExplorer.cityAvoided?.(p)).sort((x,y)=>CityRanking.score(y.city)-CityRanking.score(x.city));const b=peers[0]||pool.find(p=>canonicalCityKey(p.city)!==canonicalCityKey(a.city));if(b)pairs.push({...form,start:a,finish:form.roundTrip?a:b});}}
 const routes=[];let lastFailure;
 const controller=new AbortController(),abort=()=>controller.abort();form.signal?.addEventListener('abort',abort,{once:true});if(form.signal?.aborted)abort();
 const deadline=performance.now()+45000;
 try{
 for(const resolved of pairs){
  if(performance.now()>=deadline){break;}
  let timer;let found;
  try{found=await Promise.race([concreteLiveSearch({...resolved,_seedNoDiscovery:!form.visits.some(v=>v.sel)&&!form.requiredVisitCount&&!form.roundTrip&&!appState.tripLength,signal:controller.signal,onProgress:found=>{found.forEach(r=>r._form=resolved);form.onProgress?.([...routes,...found]);}},depth),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('Exploration finished'),{name:'ExplorationLimit'}));},Math.max(1000,deadline-performance.now()));})]);}
  catch(e){if(form.signal?.aborted)throw e;if(e.name==='ExplorationLimit')break;lastFailure=e;continue;}finally{clearTimeout(timer);}
  found.forEach(r=>{r._form=resolved;r._destinationScore=CityRanking.score(resolved.start.city)+CityRanking.score(resolved.finish.city)+RailRoamWishlist.seasonalScore(resolved.finish.city,appState.arriveDate);});routes.push(...found);
 }
 }finally{controller.abort();form.signal?.removeEventListener('abort',abort);}
 if(!routes.length&&lastFailure)throw lastFailure;
 const unique=new Map(routes.map(r=>[routeSignature(r),r]));
 return [...unique.values()].sort((a,b)=>compareRoutes(a,b)||b._destinationScore-a._destinationScore);
};
