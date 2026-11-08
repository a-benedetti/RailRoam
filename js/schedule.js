/* Dated timetable evidence is never promoted to a recurring calendar. A future
 * operator adapter may supply calendar={label,weekdays,dates,validFrom,validTo}. */
const RailRoamSchedule=(()=>{
 const cache=new Map(),day=86400000;
 const dateOf=(iso,tz)=>localDateParts(new Date(iso),tz||'Europe/Berlin').date;
 const timeOf=(iso,tz)=>new Intl.DateTimeFormat('en-GB',{timeZone:tz||'Europe/Berlin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso));
 function bounds(start,end){start=start||localYmd();end=end||addDaysYmd(start,27);if(end<start||new Date(end)-new Date(start)>62*day)throw Error('Choose a trip window of up to 62 days.');return {start,end};}
 function matches(it,c){return RailRoamExplorer.directService(it,c.kind,c.operator)&&(!c.serviceName||transitLegs(it).some(l=>routeLabel(l)===c.serviceName));}
 function operatorLinks(c,leg){const detected=RailRoamExplorer.operatorFor?.(leg),actual=Object.keys(EXPLORER_OPERATORS).find(id=>EXPLORER_OPERATORS[id]===detected);const ids=c.jointGroup?[...new Set(EXPLORER_CONNECTIONS.filter(x=>x.jointGroup===c.jointGroup).map(x=>x.operator))]:[c.operator||actual];return ids.map(id=>{const op=EXPLORER_OPERATORS[id];if(!op)return /^https?:\/\//i.test(leg?.agencyUrl||'')?{id:leg.agencyName,label:leg.agencyName||'Operator',url:leg.agencyUrl}:null;const specific=[leg?.tripUrl,leg?.routeUrl,c.serviceUrl].find(url=>/^https?:\/\//i.test(url||''));return {id,label:op.acronym||({db:'DB',pkp:'PKP IC',tcdd:'TCDD',sleeper:'ES',nightjet:'ÖBB NJ',viking:'Viking',tallink:'Tallink'}[id])||op.name,url:specific||op.trainUrl||op.timetable||op.url};}).filter(Boolean);}
 async function load(c,start,end,signal){
  if(signal?.aborted)throw Object.assign(Error('Search cancelled'),{name:'AbortError'});
  if(c.variants?.length){const results=await Promise.all(c.variants.map(v=>load({...v,origin:c.origin||c.from,destination:c.destination||c.to,fromPlace:c.fromPlace,toPlace:c.toPlace},start,end,signal)));const merged=new Map();for(let i=0;i<results.length;i++){for(const row of results[i].rows){const number=(routeLabel(row.first).match(/\d+/g)||[]).join('-'),key=[row.first.startTime,row.last.endTime,number].join('|'),carrier=EXPLORER_OPERATORS[c.variants[i].operator]?.name||row.first.agencyName||'';if(merged.has(key)){const old=merged.get(key);old.carriers=[...new Set([...old.carriers,carrier])];old.operators=[...new Map([...(old.operators||[]),...(row.operators||[])].map(o=>[o.id,o])).values()];}else merged.set(key,{...row,carriers:[carrier]});}}return {...results[0],calendar:null,rows:[...merged.values()].sort((a,b)=>new Date(a.first.startTime)-new Date(b.first.startTime)),partial:results.some(x=>x.partial)};}
  const b=bounds(start,end),from=c.fromPlace||RailRoamExplorer.getCity(c.origin||c.from),to=c.toPlace||RailRoamExplorer.getCity(c.destination||c.to);
  if(!from||!to)throw Error('Choose a connection with known stations.');
  const key=[Math.floor(Date.now()/600000),document.getElementById('allowFerries')?.checked?1:0,from.lat,from.lon,to.lat,to.lon,c.kind,c.operator,c.serviceName,b.start,b.end].join('|');if(!signal&&cache.has(key))return cache.get(key);
  const task=(async()=>{
   const calendar=c.calendar,direction=calendar?.directions?.[c.origin||c.from];
   if(direction&&b.start<=calendar.validTo&&b.end>=calendar.validFrom){
    const rows=[];for(let d=b.start;d<=b.end;d=addDaysYmd(d,1)){
     if(d<calendar.validFrom||d>calendar.validTo||!(calendar.dates?calendar.dates.includes(d):calendar.weekdays?.includes(new Date(d+'T12:00:00Z').getUTCDay())))continue;
     const startTime=zonedLocalToDate(d,direction.departure,from.tz).toISOString(),endTime=zonedLocalToDate(addDaysYmd(d,direction.arrivalDays),direction.arrival,to.tz).toISOString();if(new Date(startTime)<new Date())continue;
     const leg={mode:c.kind==='night'?'NIGHT_RAIL':'LONG_DISTANCE',from:{...from,name:(c.origin||c.from)==='Istanbul'?'Halkalı (Istanbul)':'Sofia'},to:{...to,name:(c.destination||c.to)==='Istanbul'?'Halkalı (Istanbul)':'Sofia'},startTime,endTime,displayName:c.serviceName,agencyName:EXPLORER_OPERATORS[c.operator]?.name,tripId:'published-'+c.id+'-'+d};
     const it={startTime,endTime,legs:[leg],transfers:0,source:calendar.source};rows.push({it,first:leg,last:leg,fare:itineraryEstimatedFare(it),date:d,operators:operatorLinks(c,leg)});
    }
    return {rows,...b,partial:false,calendar,source:calendar.source};
   }
   const chunks=[];for(let d=b.start;d<=b.end;d=addDaysYmd(d,3))chunks.push(d);
   const rows=[],errors=[];let capped=false;
   for(let n=0;n<chunks.length;n+=3){if(signal?.aborted)throw Object.assign(Error('Search cancelled'),{name:'AbortError'});await Promise.all(chunks.slice(n,n+3).map(async d=>{
    const stop=zonedLocalToDate(addDaysYmd(d,3),'00:00',from.tz),outer=zonedLocalToDate(addDaysYmd(b.end,1),'00:00',from.tz);if(stop>outer)stop.setTime(outer.getTime());
    let cursor=zonedLocalToDate(d,'00:00',from.tz);if(cursor<new Date())cursor=new Date();
    try{for(let page=0;page<4&&cursor<stop;page++){
     const found=await queryDirectDepartures(from,to,cursor,stop,c.kind,signal);
     found.filter(it=>matches(it,c)).forEach(it=>{const legs=transitLegs(it),first=legs[0],last=legs.at(-1);if(new Date(first.startTime)>=cursor&&new Date(first.startTime)<stop)rows.push({it,first,last,fare:itineraryEstimatedFare(it),date:dateOf(first.startTime,first.from?.tz||from.tz),operators:operatorLinks(c,first)});});
     if(found.length<40)break;const latest=Math.max(...found.map(it=>+new Date(it.startTime)));if(!Number.isFinite(latest)||latest<+cursor)break;cursor=new Date(latest+1000);if(page===3&&cursor<stop)capped=true;
    }}catch(e){if(signal?.aborted)throw e;errors.push(e.message);}
   }));}
   if(errors.length===chunks.length)throw Error('Timetable unavailable. Retry later.');
   const unique=new Map();for(const r of rows){const number=(routeLabel(r.first).match(/\d+/g)||[r.first.mode]).join('-'),key=[r.first.startTime,r.last.endTime,number].join('|');if(unique.has(key)){const old=unique.get(key);old.operators=[...new Map([...(old.operators||[]),...(r.operators||[])].map(o=>[o.id,o])).values()];}else unique.set(key,r);}
   return {rows:[...unique.values()].sort((a,b)=>new Date(a.first.startTime)-new Date(b.first.startTime)),...b,partial:!!errors.length||capped,calendar:null};
  })();if(!signal){cache.set(key,task);if(cache.size>80)cache.delete(cache.keys().next().value);task.catch(()=>{if(cache.get(key)===task)cache.delete(key);});}return task;
 }
 function patternKey(r){return [routeLabel(r.first),timeOf(r.first.startTime,r.first.from?.tz),timeOf(r.last.endTime,r.last.to?.tz),(new Date(dateOf(r.last.endTime,r.last.to?.tz))-new Date(r.date))/day,(r.operators||[]).map(o=>o.id).sort().join('|')].join('|');}
 function entries(data){
  const groups=new Map();for(const r of data.rows){const k=patternKey(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  const dates=[];const begin=data.start===localYmd()?addDaysYmd(data.start,1):data.start;for(let d=begin;d<=data.end;d=addDaysYmd(d,1))dates.push(d);
  const result=[];for(const group of groups.values()){
   const present=new Set(group.map(r=>r.date)),weekdays=[...new Set([...present].map(d=>new Date(d+'T12:00:00Z').getUTCDay()))].sort();
   let pattern=data.calendar&&!data.calendar.dates?data.calendar.label:null;
   if(!pattern&&!data.partial&&dates.length>=14){const expected=dates.filter(d=>weekdays.includes(new Date(d+'T12:00:00Z').getUTCDay()));if(expected.length>=2&&expected.every(d=>present.has(d))){pattern=weekdays.length===7?'Daily':weekdays.map(d=>['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'][d]).join(' · ');}}
   if(pattern)result.push({...group[0],pattern});else result.push(...group.slice(0,5));
  }
  return result.sort((a,b)=>timeOf(a.first.startTime,a.first.from?.tz).localeCompare(timeOf(b.first.startTime,b.first.from?.tz))||a.date.localeCompare(b.date));
 }
 function html(data,frequency=''){
  const calendar=data.calendar,rows=entries(data),esc=escapeHtml;
  return `<ul class="departures-list">${rows.map(r=>{const offset=Math.round((new Date(dateOf(r.last.endTime,r.last.to?.tz))-new Date(r.date))/day);return `<li><div class="schedule-service"><strong>${esc(r.label||routeLabel(r.first))}</strong> ${(r.operators||[]).map(o=>`<a class="schedule-operator" href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.label)} ↗</a>`).join(' / ')}</div><div class="schedule-pattern">${esc(r.pattern||displayDate(r.date))}</div><div class="departure-time"><span>${timeOf(r.first.startTime,r.first.from?.tz)}</span><span>→ ${timeOf(r.last.endTime,r.last.to?.tz)}${offset>0?' (+'+offset+')':''}</span></div>${window.RailRoamAccess?.legHtml(r.first)||''}<div class="departure-meta"><span></span><span>${window.RailRoamFares?esc(RailRoamFares.label(RailRoamFares.summary(transitLegs(r.it||{legs:[r.first]})))):'≈ €'+Math.round(r.fare)+' est.'}</span></div></li>`;}).join('')}</ul>${!rows.length?'<p>No published departures in this window.</p>':''}<p class="schedule-note">${calendar?'Valid '+esc(displayDate(calendar.validFrom))+' – '+esc(displayDate(calendar.validTo)):'Timetable window · '+esc(displayDate(data.start))+' – '+esc(displayDate(data.end))}${data.partial?' · some dates unavailable':''}</p>`;
 }

 return {load,html,bounds,dateOf,timeOf,matches,operatorLinks,entries};
})();
