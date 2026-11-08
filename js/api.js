function placeParam(sel){return sel.type==="STOP" ? sel.id : `${sel.lat},${sel.lon}`}
function checkSearchSignal(signal){if(signal?.aborted)throw Object.assign(new Error('Search cancelled'),{name:'AbortError'});}
async function timetableRequest(url,signal,ms=25000){
 if(typeof RailRoamTimetables!=='undefined')return RailRoamTimetables.request(url,signal,ms);
 checkSearchSignal(signal);const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,ms);signal?.addEventListener('abort',abort,{once:true});
 try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error(`Timetable API returned ${response.status}`);return await response.json();}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}


function hasUrbanTransit(it){
  return (it.legs||[]).some(l=>
    ["SUBWAY","TRAM","BUS","TROLLEYBUS"].includes(String(l.mode||"").toUpperCase()) ||
    /\bmetro\b|\bmétro\b|underground|u-bahn|subway/i.test(String(l.displayName||"")+" "+String(l.routeLongName||""))
  );
}

// A city is a flexible boarding/alighting area, not a demand to ride a commuter
// train all the way to its map pin. Exact station selections remain exact.
function trimCityAccess(it,from,to){
 if(from?.type!=='PLACE'&&to?.type!=='PLACE')return it;
 const legs=it.legs||[],transit=legs.map((l,i)=>({l,i})).filter(x=>transitLegs({legs:[x.l]}).length),local=l=>l.mode==='SUBURBAN'||l.mode==='REGIONAL_RAIL'&&/^S\s*\d/i.test(l.displayName||l.routeShortName||'');
 if(!transit.length)return it;let a=0,b=legs.length-1;
 const near=(p,city)=>p?.lat!=null&&p?.lon!=null&&city?.lat!=null&&city?.lon!=null&&geoKm(p,city)<=12;
 if(from?.type==='PLACE'){a=transit[0].i;while(a<b&&local(legs[a])){const next=transit.find(x=>x.i>a&&!local(x.l));if(!next||!near(next.l.from,from))break;a=next.i;}}
 if(to?.type==='PLACE'){b=transit.at(-1).i;while(b>a&&local(legs[b])){const previous=transit.slice().reverse().find(x=>x.i<b&&!local(x.l));if(!previous||!near(previous.l.to,to))break;b=previous.i;}}
 if(a===0&&b===legs.length-1)return it;const kept=legs.slice(a,b+1);return {...it,legs:kept,startTime:kept[0].startTime,endTime:kept.at(-1).endTime,transfers:Math.max(0,transitLegs({legs:kept}).length-1)};
}


const timetableFailures=new WeakMap();
function noteTimetableFailure(signal,error){if(signal)timetableFailures.set(signal,error);}
function searchTimetableFailure(signal){return signal?timetableFailures.get(signal):null;}
const routeQueryCache=new Map();
const searchQueryCaches=new WeakMap();
function scopedRouteQuery(signal,key,producer){checkSearchSignal(signal);if(!signal)return cachedRouteQuery(key,producer);let cache=searchQueryCaches.get(signal);if(!cache){cache=new Map();searchQueryCaches.set(signal,cache);}if(!cache.has(key))cache.set(key,producer().catch(e=>{cache.delete(key);throw e;}));return cache.get(key);}
function placeCacheKey(p){
  return p?.type==="STOP" ? `S:${p.id}` :
    `P:${Number(p?.lat||0).toFixed(4)},${Number(p?.lon||0).toFixed(4)}`;
}
function cachedRouteQuery(key,producer){
  const saved=routeQueryCache.get(key);
  if(saved&&saved.expires>Date.now())return saved.promise;
  if(saved)routeQueryCache.delete(key);
  const promise=producer().catch(err=>{routeQueryCache.delete(key);throw err});
  routeQueryCache.set(key,{promise,expires:Date.now()+10*60*1000});
  // Keep a bounded in-memory cache for this page session.
  if(routeQueryCache.size>220){
    const first=routeQueryCache.keys().next().value;
    routeQueryCache.delete(first);
  }
  return promise;
}

async function querySegmentUncached(from,to,fromTime,toTime,limit=10,arriveBy=false,signal){
  const windows=[];
  const cap=3*24*3600;
  for(let start=fromTime.getTime(), end=toTime.getTime(); start<end; start+=cap*1000){
    windows.push([new Date(start), Math.min(cap,Math.floor((end-start)/1000))]);
  }
  const fetchWithTransfers=async ([start,win],maxTransfers=9,via)=>{
    const u=new URL(API+"/api/v6/plan");
    u.searchParams.set("fromPlace",placeParam(from));
    u.searchParams.set("toPlace",placeParam(to));
    if(from.type==="PLACE" || to.type==="PLACE") u.searchParams.set("radius","7000");
    u.searchParams.set("time",(arriveBy?new Date(start.getTime()+win*1000):start).toISOString());
    u.searchParams.set("arriveBy",arriveBy ? "true" : "false");
    u.searchParams.set("searchWindow",String(Math.max(60,win)));
    u.searchParams.set("numItineraries",String(Math.min(maxTransfers===9?40:4,limit)));
    u.searchParams.set("maxItineraries",String(Math.min(maxTransfers===9?60:12,limit+12)));
    u.searchParams.set("maxTransfers",String(maxTransfers));
    if(via){u.searchParams.set('via',via);u.searchParams.set('viaMinimumStay','1');}
    u.searchParams.set("transitModes","HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,REGIONAL_RAIL,SUBURBAN"+(document.getElementById('allowFerries')?.checked?',FERRY':''));
    u.searchParams.set("detailedLegs","false");
    u.searchParams.set("detailedTransfers","false");
    u.searchParams.set("joinInterlinedLegs","true");
    u.searchParams.set("maxPreTransitTime","3600");
    u.searchParams.set("maxPostTransitTime","3600");
    try{const j=await timetableRequest(u,signal);return j.itineraries||[];}
    catch(error){checkSearchSignal(signal);if(error.status===422&&/searchWindow/i.test(error.details||'')&&win>3600){const half=Math.floor(win/2);return [...await fetchWithTransfers([start,half],maxTransfers,via),...await fetchWithTransfers([new Date(+start+half*1000),win-half],maxTransfers,via)];}throw error;}
  };
  const fetchWindow=async window=>{
    const broad=await fetchWithTransfers(window);
    // A fastest-arrival frontier can hide a slightly slower through train.
    // Ask the provider explicitly for simpler journeys before local ranking.
    const eligible=broad.map(it=>trimCityAccess(it,from,to)).filter(it=>{const time=+new Date(arriveBy?it.endTime:it.startTime);return time>=+window[0]&&time<=+window[0]+window[1]*1000;});
    const best=eligible.length?Math.min(...eligible.map(it=>Math.max(0,typeof transitLegs==='function'?transitLegs(it).length-1:it.transfers||0))):0;
    const caps=best>=3?[1,2]:best===2?[1]:best===1?[0]:[];
    const refined=await Promise.allSettled(caps.map(cap=>fetchWithTransfers(window,cap)));
    checkSearchSignal(signal);
    for(const r of refined)if(r.status==='rejected')noteTimetableFailure(signal,r.reason);
    const all=[...broad,...refined.filter(r=>r.status==='fulfilled').flatMap(r=>r.value)].map(it=>trimCityAccess(it,from,to));
    // Equal-arrival labels can choose an early night-train change and hide
    // staying aboard to a later interchange. Probe one documented night-route
    // destination on the onward train, requiring the change there (not a visit).
    const via=stayAboardVia(all,window[0],new Date(+window[0]+window[1]*1000),to);
    if(via)try{all.push(...await fetchWithTransfers(window,2,via));}catch(error){checkSearchSignal(signal);noteTimetableFailure(signal,error);}
    return all;
  };
  const batches=[],errors=[];
  for(let i=0;i<windows.length;i+=2){checkSearchSignal(signal);const group=await Promise.allSettled(windows.slice(i,i+2).map(fetchWindow));for(const result of group){if(result.status==='fulfilled')batches.push(result.value);else{errors.push(result.reason);noteTimetableFailure(signal,result.reason);}}const direct=new Set(batches.flat().filter(it=>(it.transfers||0)===0&&!hasUrbanTransit(it)&&(typeof RailRoamSleeper==='undefined'||RailRoamSleeper.itineraryAllowed(it))).map(it=>it.startTime+'|'+it.endTime));const usable=new Set(batches.flat().filter(it=>!hasUrbanTransit(it)&&(typeof RailRoamSleeper==='undefined'||RailRoamSleeper.itineraryAllowed(it))).map(it=>it.startTime+'|'+it.endTime));if(direct.size>=limit||usable.size>=limit&&(direct.size>0||i>=2))break;}
  const all=batches.flat().map(it=>errors.length?{...it,_timetablePartial:true}:it);
  const seen=new Set();
  const matching=all.map(it=>trimCityAccess(it,from,to)).filter(it=>{const time=new Date(arriveBy?it.endTime:it.startTime);return time>=fromTime&&time<=toTime;}).filter(it=>!hasUrbanTransit(it)).filter(it=>typeof RailRoamSleeper==='undefined'||RailRoamSleeper.itineraryAllowed(it)).filter(it=>{
    const legs=(it.legs||[]).map(l=>`${l.startTime}|${l.endTime}|${l.routeShortName||l.displayName||l.mode}`).join(">");
    const k=legs||it.startTime+"|"+it.endTime+"|"+it.transfers;
    if(seen.has(k))return false;seen.add(k);return true;
  }).sort((a,b)=>(a.transfers||0)-(b.transfers||0) || new Date(a.endTime)-new Date(b.endTime)).slice(0,limit);
  if(!matching.length&&errors.length)throw errors[0];return matching;
}

function stayAboardVia(itineraries,start,end,destination){
 if(typeof EXPLORER_CONNECTIONS==='undefined'||typeof RailRoamExplorer==='undefined'||typeof geoKm!=='function')return null;
 const targets=EXPLORER_CONNECTIONS.filter(c=>c.kind==='night').flatMap(c=>[c.from,c.to]).map(name=>RailRoamExplorer.getCity(name)).filter(Boolean);
 for(const it of itineraries){if(new Date(it.startTime)<start||new Date(it.startTime)>end)continue;const legs=transitLegs(it);if(legs.length>3)continue;
  for(let i=0;i<legs.length-1;i++){const a=legs[i],b=legs[i+1];if(a.mode!=='NIGHT_RAIL'||(new Date(b.startTime)-new Date(a.endTime))/60000<=90)continue;
   const stop=(b.intermediateStops||[]).find(s=>s.stopId&&!s.cancelled&&s.lat!=null&&s.lon!=null&&geoKm(s,destination)<geoKm(a.to,destination)&&targets.some(t=>geoKm(s,t)<12));
   if(stop)return stop.stopId;
  }
 }
 return null;
}


async function querySegment(from,to,fromTime,toTime,limit=10,arriveBy=false,signal){
  const key=["seg",document.getElementById('allowFerries')?.checked?1:0,placeCacheKey(from),placeCacheKey(to),fromTime.toISOString(),toTime.toISOString(),limit,arriveBy?1:0].join("|");
  return scopedRouteQuery(signal,key,()=>querySegmentUncached(from,to,fromTime,toTime,limit,arriveBy,signal));
}

async function querySegmentWithinUncached(from,to,depStart,depEnd,arrStart,arrEnd,limit=16,signal){
  if(arrEnd&&depEnd>arrEnd)depEnd=new Date(arrEnd);
  if(arrStart&&arrStart<depStart)arrStart=new Date(depStart);
  if(depEnd<depStart||arrStart&&arrEnd&&arrEnd<arrStart)return [];
  // Search forward from the allowed departure interval...
  const broad=arrStart&&arrEnd&&arrStart<=depStart&&arrEnd>=depEnd;
  const tasks=[querySegment(from,to,depStart,depEnd,limit,false,signal)];
  if(arrStart&&arrEnd&&!broad)tasks.push(querySegment(from,to,arrStart,arrEnd,limit,true,signal));
  const settled=await Promise.allSettled(tasks);checkSearchSignal(signal);
  let forward=settled[0].status==='fulfilled'?settled[0].value:[],backward=settled[1]?.status==='fulfilled'?settled[1].value:[];
  const failures=settled.filter(r=>r.status==='rejected').map(r=>r.reason);failures.forEach(e=>noteTimetableFailure(signal,e));
  const fits=it=>new Date(it.startTime)>=depStart&&new Date(it.startTime)<=depEnd&&(!arrStart||new Date(it.endTime)>=arrStart)&&(!arrEnd||new Date(it.endTime)<=arrEnd);
  if(broad&&!forward.some(fits)){try{backward=await querySegment(from,to,arrStart,arrEnd,limit,true,signal);}catch(error){checkSearchSignal(signal);failures.push(error);noteTimetableFailure(signal,error);}}
  if(![...forward,...backward].some(fits)&&failures.length)throw failures[0];
  if(failures.length){forward=forward.map(it=>({...it,_timetablePartial:true}));backward=backward.map(it=>({...it,_timetablePartial:true}));}
  const all=[...forward,...backward];
  const dedup=new Map();
  for(const it of all){
    const key=(it.legs||[]).map(l=>
      `${l.startTime}|${l.endTime}|${l.tripId||l.tripShortName||""}|${l.routeShortName||l.displayName||l.mode}`
    ).join(">");
    if(!dedup.has(key)) dedup.set(key,it);
  }

  return [...dedup.values()].filter(it=>{
    const start=new Date(it.startTime), end=new Date(it.endTime);
    return start>=depStart && start<=depEnd &&
      (!arrStart || end>=arrStart) &&
      (!arrEnd || end<=arrEnd);
  }).sort((a,b)=>
    (a.transfers||0)-(b.transfers||0) ||
    new Date(a.endTime)-new Date(b.endTime) ||
    new Date(b.startTime)-new Date(a.startTime)
  ).slice(0,limit);
}

// Explorer requests stay independent of itinerary ranking: request only through
// services, so a large number of faster connecting journeys cannot hide them.
async function queryDirectDepartures(from,to,start,end,kind,signal){
  const u=new URL(API+'/api/v6/plan');
  const modes=kind==='all'?'HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,REGIONAL_RAIL'+(document.getElementById('allowFerries')?.checked?',FERRY':''):kind==='ferry'?'FERRY':kind==='night'?'NIGHT_RAIL,LONG_DISTANCE,HIGHSPEED_RAIL':kind==='highspeed'?'HIGHSPEED_RAIL,LONG_DISTANCE':'HIGHSPEED_RAIL,LONG_DISTANCE,REGIONAL_RAIL';
  const params={fromPlace:placeParam(from),toPlace:placeParam(to),radius:'7000',time:start.toISOString(),arriveBy:'false',searchWindow:String(Math.floor((end-start)/1000)),numItineraries:'40',maxItineraries:'50',maxTransfers:'0',transitModes:modes,detailedLegs:'true',detailedTransfers:'false',joinInterlinedLegs:'true',maxPreTransitTime:'3600',maxPostTransitTime:'3600'};
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  const data=await timetableRequest(u,signal,30000);return (data.itineraries||[]).filter(it=>!hasUrbanTransit(it));
}

function explorerRequest(url){return timetableRequest(url,undefined,20000);}
function queryCityConnections(city,date){
 const u=new URL(API+'/api/v6/stoptimes');
 Object.entries({center:`${city.lat},${city.lon}`,radius:'3500',time:zonedLocalToDate(date,'06:00',city.tz||'Europe/Berlin').toISOString(),n:'60',mode:'HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,REGIONAL_RAIL,FERRY',fetchStops:'true'}).forEach(([k,v])=>u.searchParams.set(k,v));
 return explorerRequest(u);
}
function queryTripShape(tripId){const u=new URL(API+'/api/v6/trip');u.searchParams.set('tripId',tripId);u.searchParams.set('detailedLegs','true');return explorerRequest(u);}

async function queryMapOverview(box,date,tz,signal){
 const params={min:box.south+','+box.west,max:box.north+','+box.east},stops=new URL(API+'/api/v6/map/stops'),trips=new URL(API+'/api/v6/map/trips');
 for(const [key,value]of Object.entries(params)){stops.searchParams.set(key,value);trips.searchParams.set(key,value);}
 stops.searchParams.set('grouped','true');stops.searchParams.set('modes','HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,REGIONAL_RAIL,SUBURBAN,FERRY');
 trips.searchParams.set('zoom',String(Math.max(5,Math.min(14,Math.floor(Math.log2(1152/Math.max(.001,box.east-box.west)))))));trips.searchParams.set('precision','5');trips.searchParams.set('startTime',zonedLocalToDate(date,'09:00',tz).toISOString());trips.searchParams.set('endTime',zonedLocalToDate(date,'09:01',tz).toISOString());
 const result=await Promise.allSettled([timetableRequest(stops,signal,20000),timetableRequest(trips,signal,20000)]);checkSearchSignal(signal);
 if(result.every(r=>r.status==='rejected'))throw result[0].reason;
 return {errors:result.filter(r=>r.status==='rejected').map(r=>({message:r.reason?.message,details:r.reason?.details})),stops:result[0].status==='fulfilled'&&Array.isArray(result[0].value)?result[0].value:[],segments:result[1].status==='fulfilled'&&Array.isArray(result[1].value)?result[1].value:[]};
}


// One coarse reachability request helps open-destination searches shortlist
// cities. Actual itineraries and every user rule are still checked afterwards.
async function queryReachableCities(from,time,hours,signal){const u=new URL(API+'/api/v6/one-to-all');Object.entries({one:placeParam(from),time:time.toISOString(),maxTravelTime:String(Math.round(hours*60)),maxTransfers:'6',transitModes:'HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,REGIONAL_RAIL,SUBURBAN'+(document.getElementById('allowFerries')?.checked?',FERRY':''),maxPreTransitTime:'3600'}).forEach(([k,v])=>u.searchParams.set(k,v));return timetableRequest(u,signal,10000);}
