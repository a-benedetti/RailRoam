function crossesMidnight(leg){
  const a=new Date(leg.startTime), b=new Date(leg.endTime);
  return a.toISOString().slice(0,10)!==b.toISOString().slice(0,10);
}
function isNightLeg(l){
  const n=[l.displayName,l.routeShortName,l.routeLongName,l.tripShortName,l.agencyName].filter(Boolean).join(" ");
  if(String(l.mode||"").toUpperCase()==="NIGHT_RAIL") return true;
  const sleeperBrand=/\b(NJ|EN|Nightjet|EuroNight|European Sleeper|Caledonian Sleeper|Intercites de Nuit|Intercity Notte|Euronight|Snälltåget)\b/i.test(n)
    || /\bIntercités de Nuit\b/i.test(n);
  const dep=localMinute(l.startTime,l.from?.tz),arr=localMinute(l.endTime,l.to?.tz);
  const hours=(new Date(l.endTime)-new Date(l.startTime))/3600000;
  const crossesNight=crossesMidnight(l) && hours>=5 && (dep>=19*60 || arr<=9*60);
  const overnightLongDistance=["LONG_DISTANCE","HIGHSPEED_RAIL"].includes(String(l.mode||"").toUpperCase()) && crossesNight;
  return (sleeperBrand && (dep>=19*60 || dep<5*60 || arr<=9*60 || crossesMidnight(l))) || overnightLongDistance;
}
function transitLegs(it){
  return (it.legs||[]).filter(l=>
    l.routeShortName||l.displayName||
    ["NIGHT_RAIL","LONG_DISTANCE","HIGHSPEED_RAIL","REGIONAL_RAIL","SUBURBAN","FERRY"].includes(l.mode)
  );
}
function routeLabel(l){
  return l.displayName||l.routeShortName||l.tripShortName||l.category?.shortName||(l.mode||"TRAIN").replaceAll("_"," ");
}
function trainBrandInfo(leg){
  if(leg.mode==='FERRY')return {icon:'⛴',label:'Ferry'};
  const raw=[leg.routeShortName,leg.displayName,leg.routeLongName,leg.tripShortName,leg.agencyName].filter(Boolean).join(" ");
  const txt=String(raw);
  if(/\bNightjet\b|\bNJ\b/i.test(txt)) return {icon:"🌙",label:"Nightjet",nightBrand:true};
  if(/\bEuroNight\b|\bEN\b/i.test(txt)) return {icon:"🌙",label:"EuroNight",nightBrand:true};
  if(/\bICE\b/i.test(txt)) return {icon:"🚄",label:"ICE"};
  if(/\bTGV\b/i.test(txt)) return {icon:"🚄",label:"TGV"};
  if(/\bAVE\b/i.test(txt)) return {icon:"🚄",label:"AVE"};
  if(/\bRailjet\b|\bRJX?\b/i.test(txt)) return {icon:"🚄",label:/\bRJX\b/i.test(txt)?"Railjet Xpress":"Railjet"};
  if(/\bECE\b/i.test(txt)) return {icon:"🚄",label:"ECE"};
  if(/\bEC\b/i.test(txt)) return {icon:"🚄",label:"EC"};
  if(/\bIC\b/i.test(txt) && !/\bICE\b/i.test(txt)) return {icon:"🚆",label:"IC"};
  if(/\bSnälltåget\b/i.test(txt)) return {icon:"🚆",label:"Snälltåget"};
  if(/\bFrecciarossa\b/i.test(txt)) return {icon:"🚄",label:"Frecciarossa"};
  if(/\bItalo\b/i.test(txt)) return {icon:"🚄",label:"Italo"};
  if(/\bIntercity Notte\b/i.test(txt)) return {icon:"🌙",label:"Intercity Notte",nightBrand:true};
  if(/\bIntercités de Nuit\b/i.test(txt)) return {icon:"🌙",label:"Intercités de Nuit",nightBrand:true};
  if(/\bREG\b|\bRE\b|\bRB\b|\bS\d+\b/i.test(txt) || leg.mode==="REGIONAL_RAIL" || leg.mode==="SUBURBAN") return {icon:"🚉",label:"Regional"};
  const agency=(leg.agencyName||"").trim();
  return agency ? {icon:"🚆",label:agency} : {icon:"🚆",label:"Train"};
}
function trainTitleText(leg, badge){
  let label=routeLabel(leg);
  if(badge?.label){
    const rx=new RegExp("^"+badge.label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\s*","i");
    label=label.replace(rx,"").trim();
  }
  return label || routeLabel(leg);
}

function cleanCityFromStation(name){
  let x=String(name||"").replace(/\s*\([^)]*\)\s*/g," ").trim();
  x=x.replace(/\b(Hbf|Hauptbahnhof|Central|Centrale|Centraal|Centrál|hl\.n\.|Station|St\.|Gare)\b.*$/i,"").trim();
  if(x.includes("-")) x=x.split("-")[0].trim();
  return x||name||"Transfer city";
}
function cityKeyFromPlace(p){return norm(cleanCityFromStation(p?.name||""))}
function isSameService(a,b){
  if(!a||!b)return false;
  if(b.interlineWithPreviousLeg===true || b.interlinedWithPreviousLeg===true)return true;
  if(a.tripId&&b.tripId&&a.tripId===b.tripId)return true;
  if(a.tripShortName&&b.tripShortName&&a.tripShortName===b.tripShortName)return true;

  // Some feeds split one physical international train into route segments.
  // Only merge matching service names/numbers when the intermediate stop is very short.
  const gap=(new Date(b.startTime)-new Date(a.endTime))/60000;
  const ar=norm(a.routeShortName||a.displayName||"");
  const br=norm(b.routeShortName||b.displayName||"");
  if(gap>=0 && gap<=5 && ar && br && ar===br)return true;
  return false;
}
function localMinute(iso,tz){
  const cache=localMinute.formatters||(localMinute.formatters=new Map()),zone=tz||"UTC";
  if(!cache.has(zone))cache.set(zone,new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}));
  const f=cache.get(zone);
  const p=Object.fromEntries(f.formatToParts(new Date(iso)).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  return Number(p.hour)*60+Number(p.minute);
}
function inProtectedSleep(iso,tz){
  if(!appState.useSleepHours)return false;
  let m=localMinute(iso,tz);
  if(m<12*60)m+=1440;
  return m>=appState.sleepStart&&m<=appState.sleepEnd;
}



function sleepMinutesBetween(startIso,endIso,tz){
  if(!appState.useSleepHours)return 0;
  let mins=0;
  const start=new Date(startIso),end=new Date(endIso),step=15*60000;
  for(let t=start.getTime();t<end.getTime();t+=step){
    const sliceEnd=Math.min(end.getTime(),t+step);
    const mid=new Date((t+sliceEnd)/2);
    if(inProtectedSleep(mid.toISOString(),tz)) mins+=(sliceEnd-t)/60000;
  }
  return mins;
}
function visitSleepPenalty(startIso,endIso,tz){
  if(!appState.useSleepHours)return 0;
  const total=Math.max(1,(new Date(endIso)-new Date(startIso))/60000);
  const sleep=sleepMinutesBetween(startIso,endIso,tz);
  const awake=total-sleep;
  const share=sleep/total;
  return Math.max(0,(share-.35)*10)+(awake<180?(180-awake)/45:0);
}
function visitDurationMinutes(v,startIso,endIso,tz){return Math.max(v.min||0,v.max||0)>=1440?Math.max(0,(new Date(endIso)-new Date(startIso))/60000):sightseeingMinutesBetween(startIso,endIso,tz);}
function sightseeingMinutesBetween(startIso,endIso,tz){
  const total=Math.max(0,(new Date(endIso)-new Date(startIso))/60000);
  if(!appState.useSightHours)return total;
  // Sample in 15-minute slices. This handles multi-day stays and DST without
  // assuming that sightseeing can happen overnight.
  let mins=0;
  const start=new Date(startIso),end=new Date(endIso),step=15*60000;
  for(let t=start.getTime();t<end.getTime();t+=step){
    const sliceEnd=Math.min(end.getTime(),t+step);
    const mid=new Date((t+sliceEnd)/2);
    const m=localMinute(mid.toISOString(),tz);
    if(m>=appState.sightStart && m<=appState.sightEnd) mins+=(sliceEnd-t)/60000;
  }
  return mins;
}

const TOURISM_PRIOR={
  "paris":10,"rome":10,"venice":9.9,"florence":9.7,"barcelona":9.6,"prague":9.5,
  "vienna":9.5,"amsterdam":9.4,"lisbon":9.3,"bruges":9.3,"salzburg":9.2,"budapest":9.1,
  "krakow":9.0,"kraków":9.0,"bergen":9.0,"seville":9.0,"lucerne":9.0,"interlaken":9.0,
  "madrid":8.9,"stockholm":8.9,"copenhagen":8.9,"berlin":8.8,"nice":8.8,"naples":8.8,
  "porto":8.8,"verona":8.7,"strasbourg":8.7,"ghent":8.7,"ljubljana":8.7,"split":8.7,
  "oslo":8.6,"milan":8.5,"lyon":8.5,"bologna":8.5,"innsbruck":8.5,"gdansk":8.5,
  "munich":8.4,"bordeaux":8.3,"bolzano":8.3,"wroclaw":8.2,"zurich":8.2,"brussels":8.1,
  "toulouse":8.0,"antwerp":8.0,"warsaw":8.0,"basel":7.9,"marseille":7.9,"hamburg":7.9,
  "gothenburg":7.8,"trento":7.8,"aarhus":7.7,"malmo":7.6,"malmö":7.6,"hannover":6.4
};
function tourismScore(city){return typeof RailRoamScores!=='undefined'?RailRoamScores.destinationScore(city):typeof CityRanking!=='undefined'?CityRanking.score(city):5;}
const AUTO_HUBS=[
  ["Amsterdam",52.3676,4.9041,"Europe/Amsterdam"],["Antwerp",51.2194,4.4025,"Europe/Brussels"],
  ["Basel",47.5596,7.5886,"Europe/Zurich"],["Barcelona",41.3874,2.1686,"Europe/Madrid"],
  ["Berlin",52.5200,13.4050,"Europe/Berlin"],["Bologna",44.4949,11.3426,"Europe/Rome"],
  ["Bratislava",48.1486,17.1077,"Europe/Bratislava"],["Brussels",50.8503,4.3517,"Europe/Brussels"],
  ["Budapest",47.4979,19.0402,"Europe/Budapest"],["Cologne",50.9375,6.9603,"Europe/Berlin"],
  ["Copenhagen",55.6761,12.5683,"Europe/Copenhagen"],["Dresden",51.0504,13.7373,"Europe/Berlin"],
  ["Florence",43.7696,11.2558,"Europe/Rome"],["Frankfurt",50.1109,8.6821,"Europe/Berlin"],
  ["Geneva",46.2044,6.1432,"Europe/Zurich"],["Gothenburg",57.7089,11.9746,"Europe/Stockholm"],
  ["Hamburg",53.5511,9.9937,"Europe/Berlin"],["Innsbruck",47.2692,11.4041,"Europe/Vienna"],
  ["Krakow",50.0647,19.9450,"Europe/Warsaw"],["Ljubljana",46.0569,14.5058,"Europe/Ljubljana"],
  ["Lyon",45.7640,4.8357,"Europe/Paris"],["Madrid",40.4168,-3.7038,"Europe/Madrid"],
  ["Milan",45.4642,9.1900,"Europe/Rome"],["Munich",48.1351,11.5820,"Europe/Berlin"],
  ["Naples",40.8518,14.2681,"Europe/Rome"],["Nuremberg",49.4521,11.0767,"Europe/Berlin"],
  ["Paris",48.8566,2.3522,"Europe/Paris"],["Prague",50.0755,14.4378,"Europe/Prague"],
  ["Salzburg",47.8095,13.0550,"Europe/Vienna"],["Stockholm",59.3293,18.0686,"Europe/Stockholm"],
  ["Strasbourg",48.5734,7.7521,"Europe/Paris"],["Turin",45.0703,7.6869,"Europe/Rome"],
  ["Venice",45.4408,12.3155,"Europe/Rome"],["Verona",45.4384,10.9916,"Europe/Rome"],
  ["Vienna",48.2082,16.3738,"Europe/Vienna"],["Warsaw",52.2297,21.0122,"Europe/Warsaw"],
  ["Zurich",47.3769,8.5417,"Europe/Zurich"],["Zagreb",45.8150,15.9819,"Europe/Zagreb"],
  ["Bordeaux",44.8378,-0.5792,"Europe/Paris"],["Marseille",43.2965,5.3698,"Europe/Paris"],
  ["Nice",43.7102,7.2620,"Europe/Paris"],["Malmo",55.6050,13.0038,"Europe/Stockholm"],
  ["Aarhus",56.1629,10.2039,"Europe/Copenhagen"],["Hannover",52.3759,9.7320,"Europe/Berlin"],
  ["Bolzano",46.4983,11.3548,"Europe/Rome"],["Trento",46.0748,11.1217,"Europe/Rome"]
].map(([city,lat,lon,tz])=>({
  type:"PLACE",name:city,label:city,city,cityKey:canonicalCityKey(city),lat,lon,tz
}));

function geoKm(a,b){
  if(!a||!b||!Number.isFinite(+a.lat)||!Number.isFinite(+a.lon)||!Number.isFinite(+b.lat)||!Number.isFinite(+b.lon))return 99999;
  const R=6371, rad=x=>x*Math.PI/180;
  const dLat=rad(+b.lat-+a.lat),dLon=rad(+b.lon-+a.lon);
  const q=Math.sin(dLat/2)**2+Math.cos(rad(+a.lat))*Math.cos(rad(+b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}
function baseLegEstimatedFare(leg){
  const km=geoKm(leg.from,leg.to);
  if(!Number.isFinite(km)||km>5000)return 0;
  const mode=String(leg.mode||"").toUpperCase();
  let rate=0.095,base=2.5;
  if(mode==="HIGHSPEED_RAIL"){rate=.145;base=5}
  else if(mode==="LONG_DISTANCE"){rate=.115;base=4}
  else if(mode==="NIGHT_RAIL"){rate=.12;base=24}
  else if(mode==="FERRY"){rate=.08;base=20}
  else if(mode==="REGIONAL_RAIL"||mode==="SUBURBAN"){rate=.075;base=2}
  if(isNightLeg(leg) && mode!=="NIGHT_RAIL")base+=12;
  return Math.max(base+km*rate,mode==="NIGHT_RAIL"?29:3);
}
function legEstimatedFare(leg){return typeof window!=='undefined'&&window.RailRoamFares?RailRoamFares.leg(leg).estimate:baseLegEstimatedFare(leg);}
function itineraryEstimatedFare(it){return transitLegs(it).reduce((n,l)=>n+legEstimatedFare(l),0)}
function routeEstimatedFare(flat){return flat.reduce((n,x)=>n+legEstimatedFare(x.leg),0)}

function itineraryConnectionScore(it){
  const legs=transitLegs(it), transfers=Math.max(0,legs.length-1);
  const night=legs.filter(isNightLeg).length;
  const hours=(new Date(it.endTime)-new Date(it.startTime))/3600000;
  return 10 - transfers*2.2 + Math.min(3,night*1.8) - Math.max(0,hours-12)*0.08 - Math.min(4,itineraryEstimatedFare(it)/90);
}
function hubGeometryScore(from,hub,finish,roundTrip){
  const d1=geoKm(from,hub),d2=geoKm(hub,finish),direct=geoKm(from,finish);
  if(roundTrip){
    // Prefer a meaningful excursion, but not an absurd one-day jump across the continent.
    const excursion=Math.min(1,d1/450)*3 - Math.max(0,d1-1300)/300;
    return excursion + tourismScore(hub.city)*0.45;
  }
  const detour=(d1+d2)/Math.max(150,direct);
  const progress=(direct-d2)/Math.max(150,direct);
  return tourismScore(hub.city)*0.55 + progress*3.2 - Math.max(0,detour-1)*4.5;
}
function catalogueConnectionBonus(a,b){
 if(typeof EXPLORER_CONNECTIONS==='undefined')return 0;
 const edges=catalogueConnectionBonus.edges||(catalogueConnectionBonus.edges=new Set(EXPLORER_CONNECTIONS.flatMap(c=>{const x=canonicalCityKey(c.from),y=canonicalCityKey(c.to);return [x+'|'+y,y+'|'+x];})));
 return edges.has(canonicalCityKey(a.city||a.name)+'|'+canonicalCityKey(b.city||b.name))?1.5:0;
}
function candidateHubs(state,form,depth=0){
  const roundTrip=canonicalCityKey(form.start.city)===canonicalCityKey(form.finish.city);
  const banned=new Set([
    canonicalCityKey(state.current.city||state.current.name),
    ...state.visits.map(v=>canonicalCityKey(v.sel.city||v.sel.name)),
    ...form.transfers.filter(x=>x.sel).map(x=>canonicalCityKey(x.sel.city||x.sel.name))
  ]);
  // Start/finish are never sightseeing candidates. This also prevents A→B→A→B ping-pong loops.
  banned.add(canonicalCityKey(form.start.city||form.start.name));
  banned.add(canonicalCityKey(form.finish.city||form.finish.name));

  const shortRoundTrip=roundTrip&&(new Date(appState.arriveDate)-new Date(appState.leaveDate))/86400000<=4;
  const ranked=AUTO_HUBS
    .filter(h=>!banned.has(h.cityKey)&&!window.RailRoamExplorer?.cityAvoided?.(h))
    .map(h=>({h,score:(shortRoundTrip?tourismScore(h.city)*.45-geoKm(form.start,h)/200:hubGeometryScore(state.current,h,form.finish,roundTrip))+catalogueConnectionBonus(state.current,h)+catalogueConnectionBonus(h,form.finish)}))
    .sort((a,b)=>b.score-a.score);

  // Adaptive rather than user-facing N: deeper "More routes" searches widen the candidate frontier.
  return ranked.slice(0,shortRoundTrip?4+depth*2:Math.min(18,8+depth*3)).map(x=>x.h);
}
function stateVisitedKeys(state){
  return new Set(state.visits.map(v=>canonicalCityKey(v.sel.city||v.sel.name)));
}
function autoStateScore(st,finish){
  const last=st.parts[st.parts.length-1]?.itinerary;
  const visitAvg=st.visits.length?st.visits.reduce((n,v)=>n+tourismScore(v.sel.city),0)/st.visits.length:0;
  const progress=-geoKm(st.current,finish)/350;
  const connection=last?itineraryConnectionScore(last):0;
  const repeats=st.visits.length-stateVisitedKeys(st).size;
  return visitAvg*1.2 + connection + progress - repeats*20 - partialTransferCount(st)*0.6;
}

function transferOnlyMatch(name,form){
  const k=canonicalCityKey(cleanCityFromStation(name||""));
  return form.transfers.some(x=>{
    if(!x.sel) return false;
    const selected=canonicalCityKey(x.sel.city||x.sel.name||"");
    return k && selected && k===selected;
  });
}
function mergeServiceLegs(a,b){
  return {
    ...a,
    endTime:b.endTime,
    to:b.to||a.to,
    duration:(new Date(b.endTime)-new Date(a.startTime))/1000,
    _mergedThrough:true,
    _mergedLabels:[...(a._mergedLabels||[routeLabel(a)]),routeLabel(b)]
  };
}
function flattenRoute(route){
  const flat=[];
  route.parts.forEach((p,partIndex)=>{
    transitLegs(p.itinerary).forEach((leg,localIndex)=>{
      const prev=flat[flat.length-1];
      // Never merge across an explicitly requested sightseeing segment boundary.
      if(prev && prev.partIndex===partIndex && isSameService(prev.leg,leg)){
        prev.leg=mergeServiceLegs(prev.leg,leg);
        return;
      }
      flat.push({leg:{...leg},partIndex,localIndex});
    });
  });
  return flat;
}

function stationTransferMinutes(a,b){
  if(!a||!b)return 0;
  const an=norm(a.name||""),bn=norm(b.name||"");
  if(an && bn && an===bn)return 0;
  const alat=Number(a.lat),alon=Number(a.lon),blat=Number(b.lat),blon=Number(b.lon);
  if([alat,alon,blat,blon].every(Number.isFinite)){
    const km=geoKm({lat:alat,lon:alon},{lat:blat,lon:blon});
    // Conservative city-transfer estimate: walking/urban movement plus a small navigation buffer.
    return Math.max(12,Math.min(90,Math.ceil(km/4.5*60+8)));
  }
  return 25;
}
function effectiveVisitMinutes(arrivalLeg,departureLeg,gapMin){
  return Math.max(0,gapMin-stationTransferMinutes(arrivalLeg?.to,departureLeg?.from));
}
function explicitVisitForBoundary(route,partIndex){
  return route.visits?.[partIndex]||null;
}

function analyzeRoute(route,form){
  const flat=flattenRoute(route), boundaries=[], visits=[];
  const explicitByPart=new Map();
  route.visits.forEach((v,i)=>explicitByPart.set(i,v));
  let nonVisitTransfers=0,sleepTransfers=0,maxTechnicalLayover=0;
  for(let i=0;i<flat.length-1;i++){
    const cur=flat[i],nxt=flat[i+1],a=cur.leg,b=nxt.leg;
    const gapMs=new Date(b.startTime)-new Date(a.endTime);
    const gapMin=gapMs/60000;
    const changed=!isSameService(a,b);
    let type="through",city=typeof RailRoamCityIdentity==='undefined'?cleanCityFromStation(a.to?.name||""):RailRoamCityIdentity.name(a.to),explicit=false;
    const transferMin=changed?stationTransferMinutes(a.to,b.from):0;
    const availableStart=new Date(new Date(a.endTime).getTime()+transferMin*60000);
    const exploreMin=changed?sightseeingMinutesBetween(availableStart.toISOString(),b.startTime,a.to?.tz||b.from?.tz):0;
    if(changed){
      const explicitVisit=cur.partIndex!==nxt.partIndex ? explicitByPart.get(cur.partIndex) : null;
      if(explicitVisit && visitDurationMinutes(explicitVisit,availableStart.toISOString(),b.startTime,a.to?.tz||b.from?.tz)>=explicitVisit.min && visitDurationMinutes(explicitVisit,availableStart.toISOString(),b.startTime,a.to?.tz||b.from?.tz)<=explicitVisit.max){
        type="visit";explicit=explicitVisit.explicit!==false;city=explicitVisit.sel.city;
      }else if(!explicitVisit && (!['journey','discover'].includes(form._strategy)||form._flexibleDates) && gapMin>appState.maxNonVisitLayover && exploreMin>=appState.visitMin&&exploreMin<=appState.visitMax&&!transferOnlyMatch(city,form)){
        type="visit";
      }else{
        type="transfer";
      }
      if(type==="transfer"){
        nonVisitTransfers++;
        maxTechnicalLayover=Math.max(maxTechnicalLayover,gapMin);
      }
      if(inProtectedSleep(a.endTime,a.to?.tz)||inProtectedSleep(b.startTime,b.from?.tz))sleepTransfers++;
      if(type==="visit")visits.push({city,mins:explicitVisit?visitDurationMinutes(explicitVisit,availableStart.toISOString(),b.startTime,a.to?.tz||b.from?.tz):exploreMin,transferMin,arriveStation:a.to?.name||city,leaveStation:b.from?.name||city,explicit});
    }
    const sleepVisitPenalty=type==="visit"?visitSleepPenalty(availableStart.toISOString(),b.startTime,a.to?.tz||b.from?.tz):0;
    boundaries.push({type,city,gapMin,exploreMin,stayMin:explicitByPart.get(cur.partIndex)&&Math.max(explicitByPart.get(cur.partIndex).min||0,explicitByPart.get(cur.partIndex).max||0)>=1440?Math.max(0,(new Date(b.startTime)-availableStart)/60000):undefined,transferMin,sleepVisitPenalty,arriveStation:a.to?.name||city,leaveStation:b.from?.name||city,changed,explicit,sleep:
      changed&&(inProtectedSleep(a.endTime,a.to?.tz)||inProtectedSleep(b.startTime,b.from?.tz))});
  }
  const nightLegs=flat.filter(x=>isNightLeg(x.leg)).length;
  const tourismAverage=visits.length?visits.reduce((a,v)=>a+tourismScore(v.city),0)/visits.length:0;
  const totalMs=flat.length?new Date(flat[flat.length-1].leg.endTime)-new Date(flat[0].leg.startTime):0;
  const fareInfo=window.RailRoamFares?RailRoamFares.summary(flat.map(x=>x.leg),form.interrailPass??!!appState.interrailPass):null;
  const estimatedPrice=fareInfo?fareInfo.estimate:routeEstimatedFare(flat);
  const sleepHeavyVisitPenalty=boundaries.reduce((sum,b)=>sum+(b.sleepVisitPenalty||0),0);
  return {flat,boundaries,visits,nonVisitTransfers,sleepTransfers,maxTechnicalLayover,nightLegs,tourismAverage,totalMs,trainCount:flat.length,estimatedPrice,fareInfo,sleepHeavyVisitPenalty};
}
function visitDurationText(mins){if(mins<1440)return durationText(mins*60000);const days=mins/1440,rounded=days<5?Math.round(days*2)/2:Math.round(days);return '≈ '+rounded+' '+(rounded===1?'day':'days');}
function compareRoutes(a,b){
  const A=a.analysis,B=b.analysis;
  return A.nonVisitTransfers-B.nonVisitTransfers ||
         A.sleepTransfers-B.sleepTransfers ||
         A.trainCount-B.trainCount ||
         A.estimatedPrice-B.estimatedPrice ||
         A.sleepHeavyVisitPenalty-B.sleepHeavyVisitPenalty ||
         B.nightLegs-A.nightLegs ||
         B.tourismAverage-A.tourismAverage ||
         A.trainCount-B.trainCount ||
         new Date(a.final.endTime)-new Date(b.final.endTime) ||
         new Date(b.parts[0].itinerary.startTime)-new Date(a.parts[0].itinerary.startTime);
}
function routeSignature(r){
  return flattenRoute(r).map(x=>[
    x.leg.startTime,x.leg.endTime,x.leg.tripId||x.leg.tripShortName||"",
    x.leg.routeShortName||x.leg.displayName||"",x.leg.from?.name||"",x.leg.to?.name||""
  ].join("|")).join(">");
}
function partialTransferCount(state){
  return state.parts.reduce((n,p)=>n+(p.itinerary.transfers||0),0);
}

async function querySegmentWithin(from,to,depStart,depEnd,arrStart,arrEnd,limit=16,signal){
  const key=["within",document.getElementById('allowFerries')?.checked?1:0,placeCacheKey(from),placeCacheKey(to),depStart.toISOString(),depEnd.toISOString(),
    arrStart?arrStart.toISOString():"",arrEnd?arrEnd.toISOString():"",limit].join("|");
  return scopedRouteQuery(signal,key,()=>querySegmentWithinUncached(from,to,depStart,depEnd,arrStart,arrEnd,limit,signal));
}


function minuteInDailyWindow(iso,tz,start,end){
  const m=localMinute(iso,tz);
  return m>=start && m<=end;
}
function localDateMatches(iso,tz,ymd,endYmd=ymd){
  const date=localYmd(new Date(iso),tz);return !ymd || date>=ymd&&date<=(endYmd||ymd);
}
function firstDailyWindowWithin(startDate,endDate,tz,startMin,endMin,targetYmd="",targetEnd=targetYmd){
  // Envelope of matching daily windows. Final validation rejects departures in gaps.
  // 15-minute stepping is deliberate: precise enough for planning, much cheaper than
  // creating extra routing requests for every possible departure minute.
  const step=15*60000;
  let first=null,last=null;
  for(let t=startDate.getTime();t<=endDate.getTime();t+=step){
    const iso=new Date(t).toISOString();
    if(localDateMatches(iso,tz,targetYmd,targetEnd) && minuteInDailyWindow(iso,tz,startMin,endMin)){
      if(first===null)first=t;
      last=t;
    }
  }
  if(first===null)return null;
  return [new Date(first),new Date(Math.min(endDate.getTime(),last+step))];
}
// Limit branch construction as well as HTTP concurrency; yield between batches.
async function searchMap(items,task,concurrency=4,ctx){
 const results=new Array(items.length);let cursor=0;
 await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
  for(;;){const i=cursor++;if(i>=items.length)return;if(ctx&&!searchTimeLeft(ctx))return;
   results[i]=await task(items[i],i);await new Promise(resolve=>setTimeout(resolve,0));
  }
 }));return results.filter(x=>x!==undefined);
}
function visitArrivalBounds(v){
 if(v.arriveDate)return [extendedLocalDate(v.arriveDate,v.arriveStart??0,v.sel.tz),extendedLocalDate(v.arriveDateEnd||v.arriveDate,v.arriveEnd??1439,v.sel.tz)];
 if(v.leaveDate)return [new Date(+extendedLocalDate(v.leaveDate,v.leaveStart??0,v.sel.tz)-(v.max+90)*60000),new Date(+extendedLocalDate(v.leaveDateEnd||v.leaveDate,v.leaveEnd??1439,v.sel.tz)-v.min*60000)];
 return null;
}
async function expandExplicitVisits(states,visitTargets,perQuery,beam,onProfile){
  let stage=0;
  for(const target of visitTargets){
    const next=[];
    const batches=await searchMap(states,async state=>{
      const found=[];
      const bound=visitArrivalBounds(target),its=bound?await querySegmentWithin(state.current,target.sel,state.windowStart,state.windowEnd,bound[0],bound[1],perQuery,state.signal):await querySegment(state.current,target.sel,state.windowStart,state.windowEnd,perQuery,false,state.signal);
      for(const it of its){
        const end=new Date(it.endTime);
        if(!localDateMatches(it.endTime,target.sel.tz,target.arriveDate,target.arriveDateEnd))continue;
        if(!minuteInDailyWindow(it.endTime,target.sel.tz,target.arriveStart,target.arriveEnd))continue;
        const earliest=new Date(end.getTime()+target.min*60000);
        const latest=new Date(end.getTime()+(target.max+90)*60000);
        const depWindow=firstDailyWindowWithin(earliest,latest,target.sel.tz,target.leaveStart,target.leaveEnd,target.leaveDate,target.leaveDateEnd);
        if(!depWindow)continue;
        found.push({
          ...state,current:target.sel,
          windowStart:depWindow[0],
          windowEnd:depWindow[1],
          parts:[...state.parts,{itinerary:it,to:target.sel}],
          visits:[...state.visits,{sel:target.sel,arrival:it.endTime,min:target.min,max:target.max,explicit:true,
            arriveStart:target.arriveStart,arriveEnd:target.arriveEnd,leaveStart:target.leaveStart,leaveEnd:target.leaveEnd,
            arriveDate:target.arriveDate,leaveDate:target.leaveDate,arriveDateEnd:target.arriveDateEnd,leaveDateEnd:target.leaveDateEnd}]
        });
      }
      return found;
    });
    next.push(...batches.flat());
    onProfile?.("visitStage"+(++stage)+"States",next.length);
    if(!next.length)return [];
    next.sort((a,b)=>autoStateScore(b,target.sel)-autoStateScore(a,target.sel));
    const dedup=new Map();
    for(const st of next){
      const key=canonicalCityKey(st.current.city)+"|"+st.parts.map(p=>p.itinerary.startTime+"|"+p.itinerary.endTime).join(">");
      if(!dedup.has(key))dedup.set(key,st);
    }
    states=[...dedup.values()].slice(0,beam);
  }
  return states;
}

async function discoverOneVisitLayer(states,form,arrMin,arrMax,depth,beam,searchCtx){
  const visitMin=appState.visitMin, visitMax=appState.visitMax;
  const tasks=[];
  const controller=!searchCtx.required?new AbortController():null,parent=form.signal;
  if(controller)window.RailRoamTimetables?.prioritize(controller.signal,1);
  const stop=()=>controller?.abort();parent?.addEventListener('abort',stop,{once:true});
  const timer=controller?setTimeout(stop,Math.max(0,searchCtx.deadline-performance.now())):null;
  const branchSignal=controller?.signal||parent;
  for(const state of states){
    if(!searchCtx.required && !searchTimeLeft(searchCtx) && tasks.length) break;
    const seeds=searchCtx.onRouteSeeds;
    let hubs=seeds?.length?seeds.map(x=>x.hub):candidateHubs(state,form,depth);
    // As the first-search budget is consumed, narrow the remaining fan-out rather
    // than making the user wait for near-duplicate alternatives.
    const elapsed=performance.now()-searchCtx.started;
    if(searchCtx.depth===0 && elapsed>searchBudgetMs(0)*0.55) hubs=hubs.slice(0,Math.max(4,Math.ceil(hubs.length/2)));
    for(const hub of hubs){
      tasks.push(async()=>{
        let incoming=[];
        try{ incoming=seeds?.find(x=>canonicalCityKey(x.hub.city)===canonicalCityKey(hub.city))?.incoming||await querySegment(state.current,hub,state.windowStart,state.windowEnd,4,false,branchSignal) }
        catch(e){checkSearchSignal(state.signal);return [] }

        const out=[];
        for(const it of incoming.slice(0,3)){
          const arrival=new Date(it.endTime);
          // Probe from the earliest plausible departure. Actual station-to-station
          // transfer time is checked against each returned onward itinerary below.
          const stayStart=new Date(arrival.getTime()+visitMin*60000);
          const stayEnd=new Date(Math.min(arrival.getTime()+(visitMax+90)*60000,arrMax.getTime()));
          if(stayEnd<=stayStart)continue;

          let bridge=[];
          const firstDeparture=transitLegs(state.parts[0]?.itinerary||it)[0]?.startTime,bounds=tripArrivalBounds(form,firstDeparture,arrMin,arrMax);
          try{ bridge=await querySegmentWithin(hub,form.finish,stayStart,stayEnd,bounds[0],bounds[1],4,branchSignal) }
          catch(e){checkSearchSignal(state.signal);bridge=[] }

          const feasible=bridge.filter(next=>{
            const gap=(new Date(next.startTime)-arrival)/60000;
            const arrLeg=transitLegs(it).at(-1), depLeg=transitLegs(next)[0];
            const transferMin=stationTransferMinutes(arrLeg?.to,depLeg?.from);
            const visitStart=new Date(arrival.getTime()+transferMin*60000);
            const tz=arrLeg?.to?.tz||depLeg?.from?.tz;
            const explore=visitDurationMinutes({min:visitMin,max:visitMax},visitStart.toISOString(),next.startTime,tz);
            const rawGap=Math.max(0,(new Date(next.startTime)-visitStart)/60000);
            const sleep=sleepMinutesBetween(visitStart.toISOString(),next.startTime,tz);
            const awake=Math.max(0,rawGap-sleep);
            const sensibleVisit=!appState.useSleepHours || (awake>=120 && awake>=sleep*.75);
            return sensibleVisit && explore>=visitMin && explore<=visitMax;
          });
          if(!feasible.length&&!searchCtx.moreLayers)continue;

          const bestBridge=feasible[0];
          const cityScore=tourismScore(hub.city);
          const incomingScore=itineraryConnectionScore(it);
          const onwardScore=bestBridge?itineraryConnectionScore(bestBridge):0;
          const roundTrip=canonicalCityKey(form.start.city)===canonicalCityKey(form.finish.city);
          const geometry=hubGeometryScore(state.current,hub,form.finish,roundTrip);
          const arrScoreLeg=transitLegs(it).at(-1),depScoreLeg=bestBridge?transitLegs(bestBridge)[0]:null;
          const transferForScore=stationTransferMinutes(arrScoreLeg?.to,depScoreLeg?.from);
          const visitStartForScore=new Date(arrival.getTime()+transferForScore*60000);
          const sleepPenalty=bestBridge?visitSleepPenalty(visitStartForScore.toISOString(),bestBridge.startTime,arrScoreLeg?.to?.tz||depScoreLeg?.from?.tz):0;
          const score=cityScore*1.25+incomingScore*0.9+onwardScore*1.1+geometry-sleepPenalty;

          out.push({
            ...state,current:hub,
            windowStart:stayStart,windowEnd:stayEnd,
            parts:[...state.parts,{itinerary:it,to:hub}],
            visits:[...state.visits,{sel:hub,arrival:it.endTime,min:visitMin,max:visitMax,explicit:false}],
            _exploreScore:score,
            _finishProbe:bestBridge,_finishChecked:true
          });
          searchCtx.onCandidate?.(out.at(-1));
        }
        return out;
      });
    }
  }

  // Admit optional branches progressively instead of queuing the entire search tree.
  let expanded;
  try{expanded=(await searchMap(tasks,task=>task(),4,searchCtx.required?null:searchCtx)).flat();}
  finally{clearTimeout(timer);parent?.removeEventListener('abort',stop);}
  checkSearchSignal(parent);
  expanded.sort((a,b)=>(b._exploreScore||0)-(a._exploreScore||0) || autoStateScore(b,form.finish)-autoStateScore(a,form.finish));

  // Optimistic beam pruning: after the competitive frontier is full, branches far below
  // its weakest score cannot recover enough from another city bonus to matter.
  const competitive=expanded.slice(0,Math.max(beam*3,beam));
  const cutoff=competitive[Math.min(beam-1,competitive.length-1)]?._exploreScore ?? -Infinity;
  const pruned=competitive.filter((st,i)=>i<beam || (st._exploreScore||0)>=cutoff-3.5);

  const dedup=new Map();
  for(const st of pruned){
    const keys=st.visits.map(v=>canonicalCityKey(v.sel.city));
    if(new Set(keys).size!==keys.length)continue;
    const key=keys.join(">")+"|"+Math.round(st.windowStart.getTime()/3600000);
    if(!dedup.has(key))dedup.set(key,st);
  }
  return [...dedup.values()].slice(0,beam);
}

async function finishStates(states,form,arrMin,arrMax,perQuery){
  const finished=[];
  const jobs=states.map(async state=>{
    let its=[];
    const probe=state._finishProbe;
    if(state._finishChecked&&!probe)return [];
    if(probe){
      const ps=new Date(probe.startTime),pe=new Date(probe.endTime);
      if(ps>=state.windowStart && ps<=state.windowEnd && pe>=arrMin && pe<=arrMax) its=[probe];
    }
    if(!its.length){
      const firstDeparture=state.parts.length?transitLegs(state.parts[0].itinerary)[0]?.startTime:null,bounds=tripArrivalBounds(form,firstDeparture,arrMin,arrMax);
      its=await querySegmentWithin(state.current,form.finish,state.windowStart,state.windowEnd,bounds[0],bounds[1],perQuery,state.signal);
    }
    return its.map(it=>({...state,current:form.finish,parts:[...state.parts,{itinerary:it,to:form.finish}],final:it}));
  });
  for(const batch of await Promise.all(jobs)) finished.push(...batch);
  return finished;
}


function searchBudgetMs(depth){
  // Keep the first click responsive. "More routes" explicitly opts into a deeper pass.
  return depth===0 ? 14000 : Math.min(32000,20000+depth*4000);
}
function searchTimeLeft(ctx){return !ctx || performance.now()<ctx.deadline}

function snapshotConstraints(){
  return {
    leaveStart:appState.leaveStart,leaveEnd:appState.leaveEnd,
    arriveStart:appState.arriveStart,arriveEnd:appState.arriveEnd,
    visitMin:appState.visitMin,visitMax:appState.visitMax,
    sightStart:appState.sightStart,sightEnd:appState.sightEnd,useSightHours:appState.useSightHours,
    sleepStart:appState.sleepStart,sleepEnd:appState.sleepEnd,useSleepHours:appState.useSleepHours,
    maxNonVisitLayover:appState.maxNonVisitLayover
  };
}
function applyConstraintSnapshot(x){Object.assign(appState,x)}
function relaxedConstraints(base){
  const r={...base};
  r.leaveStart=Math.max(0,base.leaveStart-60);
  r.leaveEnd=Math.min(1620,base.leaveEnd+90);
  r.arriveStart=Math.max(0,base.arriveStart-90);
  r.arriveEnd=Math.min(1620,base.arriveEnd+120);
  r.visitMin=Math.max(30,Math.floor(base.visitMin*.75/30)*30);
  r.visitMax=Math.min(7*1440,Math.max(base.visitMax+120,Math.ceil(base.visitMax*1.25/30)*30));
  r.maxNonVisitLayover=Math.max(30,Math.min(240,base.maxNonVisitLayover+45));
  if(base.useSightHours){r.sightStart=Math.max(0,base.sightStart-60);r.sightEnd=Math.min(1439,base.sightEnd+60)}
  // Protected sleep remains a preference, but on fallback it may be broken if necessary.
  r.useSleepHours=false;
  return r;
}
function relaxationLabels(base,r){
  const x=[];
  if(base.leaveStart!==r.leaveStart||base.leaveEnd!==r.leaveEnd)x.push("departure window");
  if(base.arriveStart!==r.arriveStart||base.arriveEnd!==r.arriveEnd)x.push("arrival window");
  if(base.visitMin!==r.visitMin||base.visitMax!==r.visitMax)x.push("sightseeing duration");
  if(base.maxNonVisitLayover!==r.maxNonVisitLayover)x.push("transfer limit");
  if(base.useSightHours&&(base.sightStart!==r.sightStart||base.sightEnd!==r.sightEnd))x.push("sightseeing hours");
  if(base.useSleepHours&&!r.useSleepHours)x.push("sleep hours");
  return x;
}

function routeConstraintViolations(route,base,form){
  const A=route.analysis||analyzeRoute(route,form);
  const flat=A.flat||[];
  if(!flat.length)return [];
  const tags=[];
  const first=flat[0].leg,last=flat[flat.length-1].leg;
  const dep=new Date(first.startTime),arr=new Date(last.endTime);
  const depMin=extendedLocalDate(appState.leaveDate,base.leaveStart,form.start.tz);
  const depMax=extendedLocalDate(appState.leaveDateEnd||appState.leaveDate,base.leaveEnd,form.start.tz);
  const arrMin=form._preferredArrivalStart?extendedLocalDate(form._preferredArrivalStart,0,form.finish.tz):form._preferReturnLastDay?extendedLocalDate(appState.arriveDate,0,form.finish.tz):(appState.arriveHasTime||appState.arriveIsRange)?extendedLocalDate(appState.arriveDateStart||appState.arriveDate,base.arriveStart,form.finish.tz):depMin;
  const arrMax=extendedLocalDate(appState.arriveDate,base.arriveEnd,form.finish.tz);
  if(dep<depMin || dep>depMax)tags.push("departure window");
  if(arr<arrMin || arr>arrMax)tags.push("arrival window");

  // Check deliberate sightseeing stops against the original global duration rule.
  // Per-city explicit overrides remain hard constraints in the underlying search.
  if((A.visits||[]).some(v=>{
    if(v.explicit)return false;
    const mins=Number(v.mins ?? v.exploreMin ?? v.minutes ?? v.durationMin);
    return Number.isFinite(mins) && (mins<base.visitMin || mins>base.visitMax);
  })) tags.push("sightseeing duration");

  if((A.nonVisitTransfers||0)>0 && (A.maxTechnicalLayover||0)>base.maxNonVisitLayover)
    tags.push("transfer limit");

  if(base.useSleepHours){
    const protectedAt=(iso,tz)=>{if(!iso)return false;let m=localMinute(iso,tz);if(m<720)m+=1440;return m>=base.sleepStart&&m<=base.sleepEnd;};
    const sleepBroken=(A.boundaries||[]).some((b,i)=>b.changed&&(protectedAt(A.flat[i]?.leg.endTime,A.flat[i]?.leg.to?.tz)||protectedAt(A.flat[i+1]?.leg.startTime,A.flat[i+1]?.leg.from?.tz)));
    if(sleepBroken)tags.push("sleep hours");
  }
  return [...new Set(tags)];
}
function onRouteVisitSeeds(routes,form,limit=2){
  if(typeof RailRoamCityIdentity==='undefined')return [];
  const excluded=new Set([form.start,form.finish,...form.visits.map(v=>v.sel),...form.transfers.map(v=>v.sel)].filter(Boolean).map(RailRoamCityIdentity.key)),groups=new Map();
  for(const route of routes.slice(0,4)){
    // Reuse a dated prefix: adding a visit never requires re-querying its inbound trains.
    if(route.parts.length!==1)continue;
    const it=route.parts[0].itinerary;
    for(let i=0;i<it.legs.length-1;i++){
      const leg=it.legs[i];if(!transitLegs({legs:[leg]}).length)continue;
      const key=RailRoamCityIdentity.key(leg.to),hub=AUTO_HUBS.find(h=>canonicalCityKey(h.city)===key);
      if(!hub||excluded.has(key)||window.RailRoamExplorer?.cityAvoided?.(hub)||typeof CityRanking!=='undefined'&&CityRanking.importance(hub.city)<78)continue;
      if(!groups.has(key))groups.set(key,{hub,incoming:[],score:tourismScore(hub.city)*2-geoKm(hub,form.finish)/2000});
      const legs=it.legs.slice(0,i+1),prefix={...it,legs,endTime:leg.endTime,transfers:Math.max(0,transitLegs({legs}).length-1)};
      const group=groups.get(key);if(!group.incoming.some(p=>p.startTime===prefix.startTime&&p.endTime===prefix.endTime))group.incoming.push(prefix);
    }
  }
  return [...groups.values()].sort((a,b)=>b.score-a.score).slice(0,limit);
}
async function liveSearch(form,depth=0){
  checkSearchSignal(form.signal);
  const searchCtx={started:performance.now(),deadline:performance.now()+(form.initialPass?10000:searchBudgetMs(depth)),depth};
  const globalMin=appState.visitMin,globalMax=appState.visitMax;
  const visitTargets=form.visits.filter(v=>v.sel).map(v=>({
    sel:v.sel,
    min:(v.min ? parseTimeMinutes(v.min,false) : globalMin),
    max:(v.max ? parseTimeMinutes(v.max,false) : globalMax),
    arriveStart:Number.isFinite(v.arriveStart)?v.arriveStart:0,
    arriveEnd:Number.isFinite(v.arriveEnd)?v.arriveEnd:1439,
    leaveStart:Number.isFinite(v.leaveStart)?v.leaveStart:0,
    leaveEnd:Number.isFinite(v.leaveEnd)?v.leaveEnd:1439,
    arriveDate:v.arriveDate||"",
    leaveDate:v.leaveDate||"",arriveDateEnd:v.arriveDateEnd||"",leaveDateEnd:v.leaveDateEnd||""
  }));

  const floor=tripDepartureStart(form.start.tz),probeStart=form._departureProbe?extendedLocalDate(form._departureProbe,form._departureMinute??appState.leaveStart,form.start.tz):floor;
  const depMin=new Date(Math.max(+floor,+probeStart));
  const depMax=form._departureProbe?extendedLocalDate(form._departureProbe,appState.leaveEnd,form.start.tz):extendedLocalDate(appState.leaveDateEnd||appState.leaveDate,appState.leaveEnd,form.start.tz);
  const arrMin=form._preferredArrivalStart?extendedLocalDate(form._preferredArrivalStart,0,form.finish.tz):form._preferReturnLastDay?extendedLocalDate(appState.arriveDate,0,form.finish.tz):(appState.arriveHasTime||appState.arriveIsRange)?extendedLocalDate(appState.arriveDateStart||appState.arriveDate,appState.arriveStart,form.finish.tz):depMin;
  const arrMax=extendedLocalDate(appState.arriveDate,appState.arriveEnd,form.finish.tz);

  const minRaw=document.getElementById("visitCountMin").value.trim();
  const maxRaw=document.getElementById("visitCountMax").value.trim();
  const requestedMin=Math.max(form.roundTrip?1:0,minRaw==="" ? 0 : (parseInt(minRaw,10)||0));
  const requestedMax=maxRaw==="" ? Infinity : Math.max(0,parseInt(maxRaw,10)||0);

  const perQuery=form._searchPerQuery||Math.min(42,14+depth*7);
  const beam=form._searchBeam||Math.min(18,7+depth*3);
  let states=[{current:form.start,windowStart:depMin,windowEnd:depMax,parts:[],visits:[],signal:form.signal}];

  // Explicit requested cities remain hard constraints and are handled first.
  states=await expandExplicitVisits(states,visitTargets,perQuery,beam,form.onProfile);
  form.onProfile?.("requiredVisitsMs",performance.now()-searchCtx.started);
  checkSearchSignal(form.signal);if(!states.length)return [];

  const explicitCount=visitTargets.length;
  const needAuto=Math.max(0,requestedMin-explicitCount);
  let maxAuto=Number.isFinite(requestedMax)
    ? Math.max(0,requestedMax-explicitCount)
    : form._openEndpoints?Math.max(needAuto,1):needAuto;

  // Build deliberate sightseeing stops one layer at a time. The frontier is adaptive:
  // each layer keeps only connection+city combinations that remain competitive.
  // Finalize the required sequence first. Optional sightseeing must not delay it.
  let baseFinished=[];
  if(explicitCount>=requestedMin && explicitCount<=requestedMax){
    baseFinished=await finishStates(states,form,appState.tripLength&&!visitTargets.length?depMin:arrMin,arrMax,perQuery);
    form.onProfile?.("baseJourneysMs",performance.now()-searchCtx.started);
    form.onProfile?.("finishedStates",baseFinished.length);
    const early=finalizeSearchRoutes(baseFinished,form,visitTargets,requestedMin,requestedMax);
    form.onProfile?.("validFinished",early.length);
    if(early.length)form.onProgress?.(early);
  }
  const allowDiscovery=(!['fastest','transfers'].includes(form.optimize||appState.optimize)||appState.tripLength)&&explicitCount<requestedMax;
  const onRouteSeeds=allowDiscovery&&needAuto===0?onRouteVisitSeeds(baseFinished,form,2+Math.min(depth,1)):[];
  if(onRouteSeeds.length){maxAuto=Math.max(maxAuto,1);searchCtx.deadline=Math.max(searchCtx.deadline,performance.now()+8000);}
  // A long trip with short per-city limits needs several visit layers before a
  // return can be feasible. An unfinished first city must not prune that branch.
  const lengthLayers=appState.tripLength?Math.min(6,Math.max(1,Math.ceil(appState.tripLength.min*1440/(globalMax+720)))):0;
  maxAuto=Math.min(Math.max(0,requestedMax-explicitCount),Math.max(maxAuto,lengthLayers));
  if(form._seedNoDiscovery)maxAuto=0;
  const plannedLayers=Math.max(needAuto,lengthLayers);
  const progressive=[];
  searchCtx.onCandidate=state=>{
    if(state.visits.length<requestedMin||state.visits.length>requestedMax)return;
    const it=state._finishProbe;if(!it)return;
    progressive.push({...state,current:form.finish,parts:[...state.parts,{itinerary:it,to:form.finish}],final:it});
    const valid=finalizeSearchRoutes(progressive,form,visitTargets,requestedMin,requestedMax);
    if(valid.length)form.onProgress?.(valid);
  };
  const layers=[states];
  let frontier=states;
  for(let n=1;n<=maxAuto;n++){
    // Required visit layers are always attempted. Optional extra layers wait for
    // "More routes" if the initial search has already consumed its time budget.
    if(n>plannedLayers && !searchTimeLeft(searchCtx)) break;
    frontier=await discoverOneVisitLayer(frontier,form,arrMin,arrMax,depth,beam,{...searchCtx,required:n<=plannedLayers,moreLayers:n<maxAuto,onRouteSeeds:n===1&&onRouteSeeds.length?onRouteSeeds:null});
    if(!frontier.length)break;
    layers.push(frontier);
    if(explicitCount+n>=requestedMin && explicitCount+n<=requestedMax && form.onProgress){
      const ready=await finishStates(frontier,form,arrMin,arrMax,perQuery);
      const valid=finalizeSearchRoutes([...baseFinished,...ready],form,visitTargets,requestedMin,requestedMax);
      if(valid.length)form.onProgress(valid);
    }
  }

  form.onProfile?.("explorationMs",performance.now()-searchCtx.started);
  // If minimum is blank/zero, direct routes are still valid. Otherwise only layers
  // with enough deliberate visits are finalized.
  const candidates=[];
  for(let autoCount=0;autoCount<layers.length;autoCount++){
    const totalVisits=explicitCount+autoCount;
    if(totalVisits<requestedMin || totalVisits>requestedMax)continue;
    if(autoCount>0 || !baseFinished.length)candidates.push(...layers[autoCount]);
  }
  if(!candidates.length)return finalizeSearchRoutes(baseFinished,form,visitTargets,requestedMin,requestedMax);

  let finished=[...baseFinished,...await finishStates(candidates,form,arrMin,arrMax,perQuery)];

  return finalizeSearchRoutes(finished,form,visitTargets,requestedMin,requestedMax);
}
function tripDepartureStart(tz){
 const date=extendedLocalDate(appState.leaveDate,appState.leaveStart,tz);return appState.dateChoices?.leave.mode==='any'?new Date(Math.max(+date,Math.ceil(Date.now()/60000)*60000)):date;
}
function tripArrivalBounds(form,departureIso,low,high){
 if(!appState.tripLength||!departureIso)return [low,high];
 const fromTZ=form.start?.tz||'UTC',toTZ=form.finish?.tz||fromTZ,date=localYmd(new Date(departureIso),fromTZ),length=appState.tripLength;
 const min=extendedLocalDate(addDaysYmd(date,length.min),appState.arriveHasTime?appState.arriveStart:0,toTZ),max=extendedLocalDate(addDaysYmd(date,length.max),appState.arriveEnd,toTZ);
 return [low&&low>min?low:min,high&&high<max?high:max];
}
function tripDatesAllowed(route,form){
 const flat=route.analysis?.flat||flattenRoute(route);if(!flat.length)return false;
 const first=flat[0].leg,last=flat.at(-1).leg,dep=new Date(first.startTime),arr=new Date(last.endTime),fromTZ=form.start?.tz||first.from?.tz||'UTC',toTZ=form.finish?.tz||last.to?.tz||'UTC';
 const lower=tripDepartureStart(fromTZ),upper=extendedLocalDate(appState.leaveDateEnd||appState.leaveDate,appState.leaveEnd,fromTZ),end=extendedLocalDate(appState.arriveDate,appState.arriveEnd,toTZ);
 const arrivalStart=(appState.arriveHasTime||appState.arriveIsRange)?extendedLocalDate(appState.arriveDateStart||appState.arriveDate,appState.arriveStart,toTZ):lower;
 const clock=(iso,tz,a,b)=>{const m=localMinute(iso,tz);return m>=a&&m<=b||m+1440>=a&&m+1440<=b;};
 const bounds=tripArrivalBounds(form,first.startTime,arrivalStart,end);
 if(appState.tripLength){const days=(Date.parse(localYmd(arr,toTZ))-Date.parse(localYmd(dep,fromTZ)))/86400000;if(days<appState.tripLength.min||days>appState.tripLength.max)return false;}
 return dep>=lower&&dep<=upper&&arr>=bounds[0]&&arr<=bounds[1]&&(!appState.leaveHasTime||clock(first.startTime,fromTZ,appState.leaveStart,appState.leaveEnd))&&(!appState.arriveHasTime||clock(last.endTime,toTZ,appState.arriveStart,appState.arriveEnd));
}
function finalizeSearchRoutes(finished,form,visitTargets,requestedMin,requestedMax){
  const allowTransfers=document.getElementById("allowTransfers").checked;
  const maxTechnical=appState.maxNonVisitLayover;
  checkSearchSignal(form.signal);finished=finished.map(r=>({...r,_form:r._form||form,analysis:analyzeRoute(r,form)}));
  form._onCandidates?.(finished);
  form.onProfile?.("candidateDatesValid",finished.filter(r=>tripDatesAllowed(r,form)).length);
  form.onProfile?.("candidateTechnicalValid",finished.filter(r=>r.analysis.maxTechnicalLayover<=maxTechnical).length);
  form.onProfile?.("candidateExplicitValid",finished.filter(r=>visitTargets.every(v=>r.analysis.visits.some(x=>x.explicit&&canonicalCityKey(x.city)===canonicalCityKey(v.sel.city)))).length);
  form.onProfile?.("candidateVisitCountValid",finished.filter(r=>r.analysis.visits.length>=requestedMin&&r.analysis.visits.length<=requestedMax).length);
  form.onProfile?.("candidateSmallestTechnicalGap",finished.length?Math.min(...finished.map(r=>r.analysis.maxTechnicalLayover)):0);
  finished=finished.filter(r=>{
      const unique=new Set(r.visits.map(v=>canonicalCityKey(v.sel.city)));
      const noRepeat=unique.size===r.visits.length;
      const explicitSatisfied=visitTargets.every(v=>r.analysis.visits.some(x=>x.explicit && canonicalCityKey(x.city)===canonicalCityKey(v.sel.city)));
      const timing=r.visits.every((v,i)=>v?.explicit===false||!r.parts[i+1]||(localDateMatches(r.parts[i+1].itinerary.startTime,v.sel.tz,v.leaveDate,v.leaveDateEnd)&&minuteInDailyWindow(r.parts[i+1].itinerary.startTime,v.sel.tz,v.leaveStart??0,v.leaveEnd??1439)));
      return (!window.RailRoamStrategy||RailRoamStrategy.allowed(r,form)) && timing && tripDatesAllowed(r,form) && (!window.RailRoamExplorer || window.RailRoamExplorer.routeAllowed(r,form)) && noRepeat && explicitSatisfied &&
        (!allowTransfers ? r.analysis.nonVisitTransfers===0 : r.analysis.maxTechnicalLayover<=maxTechnical) &&
        r.analysis.visits.length>=requestedMin &&
        r.analysis.visits.length<=requestedMax;
    })
    .sort(compareRoutes);

  const dedup=new Map();
  for(const r of finished){
    const k=routeSignature(r);
    if(!dedup.has(k))dedup.set(k,r);
  }
  const answer=[...dedup.values()];if(!answer.length&&typeof searchTimetableFailure==='function'&&searchTimetableFailure(form.signal))throw searchTimetableFailure(form.signal);return answer;
}
