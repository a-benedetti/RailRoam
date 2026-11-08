/* Positive evidence only. NIGHT_RAIL, crossing midnight, or a rail company name
 * by themselves never establish sleeping accommodation. Reviewed 2026-11-07. */
const RailRoamSleeper=(()=>{
 const mav='https://www.mavcsoport.hu/en/mav-szemelyszallitas/international-travels/travel-night-trains';
 const rules=[
  [/nightjet|\bNJ\s*\d/i,'Sleeper / couchette cars','https://www.nightjet.com/en/komfortkategorien'],
  [/european sleeper/i,'Beds / couchettes','https://www.europeansleeper.eu/the-train'],
  [/caledonian sleeper/i,'Sleeper rooms','https://www.sleeper.scot/'],
  [/intercity notte/i,'Sleeping cars / couchettes','https://www.trenitalia.com/en/intercity-and-regional/intercity-notte.html'],
  [/intercit[eé]s de nuit/i,'Couchettes','https://www.sncf-connect.com/en-en/intercites/intercites-night'],
  [/k[aá]lm[aá]n imre|wiener walzer|metropol|chopin|carpatia|\bister\b|\bdacia\b/i,'Sleeping cars / couchettes',mav],
 ];
 function evidence(leg){
  if(leg.sleepingAccommodation===false||leg.hasSleepingCar===false)return {confirmed:false,label:'No sleeping car reported'};
  const amenities=[...(leg.accommodationTypes||[]),...(Array.isArray(leg.amenities)?leg.amenities:[])].map(x=>typeof x==='string'?x:x.type||x.name||'').join(' ');
  if(leg.hasSleepingCar===true||leg.sleepingAccommodation===true||/\b(SLEEPER|COUCHETTE|SLEEPING_CAR|BERTH)\b/i.test(amenities))return {confirmed:true,label:'Sleeping accommodation reported',source:leg.routeUrl||leg.agencyUrl||''};
  const name=[leg.displayName,leg.routeShortName,leg.routeLongName,leg.tripShortName,leg.agencyName].filter(Boolean).join(' ');
  for(const [test,label,source]of rules)if(test.test(name))return {confirmed:true,label,source};
  const number=String(leg.tripShortName||leg.routeShortName||leg.displayName||'').match(/\b(40462|40467|50462|50237|40476|40457|10476|10577|476|407|472|473|346|347)\b/);
  if(number&&/m[aá]v|cfr|jlv|wars|euro.?night|\bEN\b/i.test(name)&&String(leg.startTime).slice(0,10)<='2026-12-12')return {confirmed:true,label:'Sleeping car in published train composition',source:mav};
  const places=[leg.from?.name,leg.to?.name,leg.from?.city,leg.to?.city].join(' ');
  if(/sofia|софия/i.test(places)&&/istanbul|halkal/i.test(places)&&isNightLeg(leg)&&String(leg.startTime).slice(0,10)>='2026-11-02'&&String(leg.startTime).slice(0,10)<='2026-12-12')return {confirmed:true,label:'Couchettes / sleepers',source:'https://www.bdz.bg/en/a/sofia-istanbul-sofia'};
  if(/\bVR\b/i.test(name)&&(/night train|y[oö]juna/i.test(name)||leg.mode==='NIGHT_RAIL'))return {confirmed:true,label:'Sleeper cabins','source':'https://www.vr.fi/en/night-trains/sleeper-cars'};
  return {confirmed:false,label:'Sleeping accommodation unconfirmed'};
 }
 function overlaps(leg){const tz=leg.from?.tz||'UTC',last=localDateParts(new Date(leg.endTime),tz).date;for(let date=addDaysYmd(localDateParts(new Date(leg.startTime),tz).date,-1);date<=last;date=addDaysYmd(date,1)){const a=extendedLocalDate(date,appState.sleepStart,tz),b=extendedLocalDate(date,appState.sleepEnd,tz);if(new Date(leg.startTime)<b&&new Date(leg.endTime)>a)return true;}return false;}
 function itineraryAllowed(it){if(!document.getElementById('requireSleeper')?.checked)return true;return transitLegs(it).every(l=>!overlaps(l)||evidence(l).confirmed);}
 function routeAllowed(route){return itineraryAllowed({legs:route.analysis.flat.map(x=>x.leg)});}
 return {evidence,overlaps,itineraryAllowed,routeAllowed};
})();
window.RailRoamSleeper=RailRoamSleeper;
(()=>{
 const label=document.createElement('label');label.className='confirmed-sleeper-toggle';label.innerHTML='<input type="checkbox" id="requireSleeper"> Only trains with confirmed sleeping accommodation during sleep hours';document.getElementById('sleepHoursCard').appendChild(label);
 label.onchange=()=>{appState.requireSleeper=document.getElementById('requireSleeper').checked;document.dispatchEvent(new CustomEvent('railroam:constraints-change'));};
 document.getElementById('useSleepHours').addEventListener('change',e=>{if(!e.target.checked){document.getElementById('requireSleeper').checked=false;appState.requireSleeper=false;}});
})();
