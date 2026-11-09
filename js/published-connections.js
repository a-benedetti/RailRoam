/* Operator-published, date-bounded links across gaps in aggregated feeds.
 * BDZ winter timetable checked 7 Nov 2026. Each change remains a separate leg.
 * Never extrapolate these times beyond their published validity. */
const RailRoamPublished=(()=>{
 const source='https://p.bdz.bg/www/s/f/sf-xl-ot-02112026-g-do-12122026-g-1-5518.pdf';
 const stops={Bucharest:{name:'București Nord',city:'Bucharest',lat:44.4475,lon:26.0745,tz:'Europe/Bucharest'},Ruse:{name:'Ruse',city:'Ruse',lat:43.835,lon:25.953,tz:'Europe/Sofia'},Gorna:{name:'Gorna Oryahovitsa',city:'Gorna Oryahovitsa',lat:43.128,lon:25.701,tz:'Europe/Sofia'},Dimitrovgrad:{name:'Dimitrovgrad',city:'Dimitrovgrad',lat:42.057,lon:25.593,tz:'Europe/Sofia'},Istanbul:{name:'Halkalı (Istanbul)',city:'Istanbul',lat:41.028,lon:28.767,tz:'Europe/Istanbul'},Sofia:{name:'Sofia',city:'Sofia',lat:42.712,lon:23.321,tz:'Europe/Sofia'}};
 const key=p=>canonicalCityKey(p?.city||p?.name||'');
 const day=(date,n)=>addDaysYmd(date,n);
 function leg(a,b,date,departure,arrival,offset,number,night=false){const from=stops[a],to=stops[b],startTime=zonedLocalToDate(date,departure,from.tz).toISOString(),endTime=zonedLocalToDate(day(date,offset),arrival,to.tz).toISOString();return {mode:night?'NIGHT_RAIL':'LONG_DISTANCE',from:{...from},to:{...to},startTime,endTime,displayName:night?'Sofia–Halkalı Express '+number:'BDZ / CFR '+number,tripId:'bdz-published-'+number+'-'+date,agencyName:night?'BDZ / TCDD':'BDZ / CFR',agencyUrl:'https://www.bdz.bg/en',routeUrl:source,...(night?{hasSleepingCar:true,accommodationTypes:['COUCHETTE','SLEEPER']}:{}),source};}
 function itinerary(legs){return {startTime:legs[0].startTime,endTime:legs.at(-1).endTime,legs,transfers:Math.max(0,transitLegs({legs}).length-1),source,_published:true};}
 function rows(gateway,date,reverse=false){
  if(gateway==='BucharestSofia'){if(date<'2026-10-25'||date>'2026-12-12')return null;const url='https://p.bdz.bg/www/s/o/sofia-bucuresti-ot-25102026-g-5473.pdf',legs=reverse?[leg('Sofia','Ruse',date,'07:00','13:38',0,'2611/462'),leg('Ruse','Bucharest',date,'14:15','16:56',0,'1094')]:[leg('Bucharest','Ruse',date,'10:46','13:40',0,'1095'),leg('Ruse','Sofia',date,'14:25','20:41',0,'463')];legs.forEach(l=>{l.source=url;l.routeUrl=url;});return {...itinerary(legs),source:url};}

  if(date<'2026-11-02'||date>'2026-12-12'||reverse&&gateway!=='Sofia'&&day(date,1)>'2026-12-12')return null;
  if(gateway==='Sofia')return itinerary([reverse?leg('Istanbul','Sofia',date,'23:13','10:28',1,'12503/492/1620',true):leg('Sofia','Istanbul',date,'18:45','07:21',1,'493/12504',true)]);
  if(!reverse)return itinerary([leg('Bucharest','Ruse',date,'10:46','13:40',0,'1095'),leg('Ruse','Gorna',date,'14:25','16:30',0,'463'),leg('Gorna','Dimitrovgrad',date,'17:35','21:57',0,'465'),leg('Dimitrovgrad','Istanbul',date,'23:20','07:21',1,'493/12504',true)]);
  // The same current operator table gives the northbound interchange times.
  return itinerary([leg('Istanbul','Dimitrovgrad',date,'23:13','05:20',1,'12503/492/1620',true),leg('Dimitrovgrad','Gorna',day(date,1),'07:10','11:16',0,'464'),leg('Gorna','Ruse',day(date,1),'11:40','13:38',0,'462'),leg('Ruse','Bucharest',day(date,1),'14:15','16:56',0,'1094')]);
 }
 const feed=querySegmentUncached;
 async function query(from,to,start,end,limit,arriveBy,signal){
  checkSearchSignal(signal);
  const sofiaLink=(key(from)==='sofia'&&key(to)!=='istanbul')||(key(to)==='sofia'&&key(from)!=='istanbul'),reverse=sofiaLink?key(from)==='sofia':key(from)==='istanbul',outbound=sofiaLink?key(to)==='sofia':key(to)==='istanbul';
  if(!reverse&&!outbound)return feed(from,to,start,end,limit,arriveBy,signal);
  const other=reverse?to:from;
  if(key(other)==='istanbul'||Number(other.lon)>30)return feed(from,to,start,end,limit,arriveBy,signal);
  const gateway=sofiaLink?'BucharestSofia':key(other)==='sofia'?'Sofia':'Bucharest',intermediate=Object.keys(stops).find(name=>!['Istanbul','Sofia'].includes(name)&&key(stops[name])===key(other)),terminal=stops[intermediate||(sofiaLink?'Bucharest':gateway)],direct=key(other)===key(terminal);
  // A departure-day constraint applies to the first train, not to later connections.
  const connectorEnd=!reverse&&!arriveBy?new Date(+end+6*86400000):end;
  const dates=[];for(let d=day(localDateParts(start,reverse?(sofiaLink?'Europe/Sofia':'Europe/Istanbul'):terminal.tz).date,-2);d<=localDateParts(connectorEnd,reverse?terminal.tz:(sofiaLink?'Europe/Sofia':'Europe/Istanbul')).date;d=day(d,1)){let it=rows(gateway,d,reverse);if(it&&intermediate&&intermediate!=='Bucharest'){const index=it.legs.findIndex(l=>key(reverse?l.to:l.from)===key(terminal));it=index<0?null:itinerary(reverse?it.legs.slice(0,index+1):it.legs.slice(index));}if(it)dates.push(it);}
  if(!dates.length)return feed(from,to,start,end,limit,arriveBy,signal);
  if(direct)return dates.filter(it=>new Date(arriveBy?it.endTime:it.startTime)>=start&&new Date(arriveBy?it.endTime:it.startTime)<=end).slice(0,limit);
  let candidates=[];
  if(!reverse){
   // Search both ends of a short window: earliest-arrival-only sampling misses
   // later departures which connect to the daily 10:46 from București Nord.
   const prefixStart=arriveBy?new Date(+start-6*86400000):start,stop=new Date(Math.min(+end,+prefixStart+6*86400000)),arrivalEnd=new Date(stop);arrivalEnd.setUTCHours(8,15,0,0);
   const settled=await Promise.allSettled([feed(from,{...terminal,type:'PLACE'},prefixStart,stop,Math.min(14,limit),false,signal),feed(from,{...terminal,type:'PLACE'},prefixStart,arrivalEnd,Math.min(14,limit),true,signal)]);checkSearchSignal(signal);
   const prefixes=settled.flatMap(r=>r.status==='fulfilled'?r.value:[]);
   for(const prefix of prefixes){const last=transitLegs(prefix).at(-1);if(!last)continue;for(const connector of dates){const first=connector.legs[0],gap=(new Date(first.startTime)-new Date(last.endTime))/60000;if(gap<Math.max(15,stationTransferMinutes(last.to,first.from))||gap>Math.max(appState.visitMax+90,appState.maxNonVisitLayover))continue;const it={...itinerary([...prefix.legs,...connector.legs]),...(prefix._timetablePartial?{_timetablePartial:true}:{})};if(new Date(arriveBy?it.endTime:it.startTime)>=start&&new Date(arriveBy?it.endTime:it.startTime)<=end)candidates.push(it);}}
   if(!prefixes.length&&settled.every(r=>r.status==='rejected'))throw settled[0].reason;
  }else{
   // A few dated northbound departures, followed by a feed-backed onward leg.
   for(const connector of dates.filter(it=>new Date(it.startTime)>=start).slice(0,3)){const ready=new Date(+new Date(connector.endTime)+30*60000),stop=new Date(Math.min(+end,+ready+(appState.visitMax+90)*60000));if(stop<=ready)continue;const tails=await feed({...terminal,type:'PLACE'},to,ready,stop,Math.min(8,limit),false,signal);for(const tail of tails){const first=transitLegs(tail)[0];if(!first||(new Date(first.startTime)-new Date(connector.endTime))/60000<stationTransferMinutes(connector.legs.at(-1).to,first.from))continue;candidates.push({...itinerary([...connector.legs,...tail.legs]),...(tail._timetablePartial?{_timetablePartial:true}:{})});}}
  }
  candidates=candidates.filter(it=>!hasUrbanTransit(it)&&(typeof RailRoamSleeper==='undefined'||RailRoamSleeper.itineraryAllowed(it)));
  if(candidates.length)return [...new Map(candidates.map(it=>[it.legs.map(l=>l.tripId+'|'+l.startTime).join('>'),it])).values()].sort((a,b)=>new Date(a.endTime)-new Date(b.endTime)).slice(0,limit);
  return feed(from,to,start,end,limit,arriveBy,signal);
 }
 querySegmentUncached=query;
 return {rows,stops,source};
})();
window.RailRoamPublished=RailRoamPublished;
