/* Desktop exploration UI. The itinerary engine remains in planner.js. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), esc=escapeHtml;
 const desktop=matchMedia('(min-width:1000px)'), mobile=matchMedia('(max-width:620px)');
 const colors={highspeed:'#008d91',day:'#315de4',night:'#963ac4',ferry:'#527c8e'};
 const kinds={highspeed:'High-speed',day:'Day train',night:'Night train',ferry:'Ferry'};
 const state={city:null,connection:null,route:null,routes:[],avoided:new Map(),zoom:1.15,cx:330,cy:435,geo:null,request:0,departures:new Map(),view:'plan',unseenResults:false};
 const keyCache=new Map(),stationCache=new Map();
 const cityKey=p=>{
  const raw=typeof p==='string'?p:p?.city||p?.name||'';
  let key=keyCache.get(raw);if(!key){key=canonicalCityKey(cleanCityFromStation(String(raw).replace(/^S\+U\s+/i,'')));keyCache.set(raw,key);}
  // Timetable station names often use a local name or an unrecognized suffix.
  // Match stations to curated city centres only over a small urban radius.
  if(p&&typeof p==='object'&&!p.city&&p.lat!=null&&p.lon!=null){
   const station=raw+'|'+p.lat+'|'+p.lon;if(stationCache.has(station))return stationCache.get(station);
   const nearby=[...cities.values()].map(c=>({c,km:geoKm(p,c)})).filter(x=>x.km<12).sort((a,b)=>a.km-b.km)[0];
   if(nearby){const result=canonicalCityKey(nearby.c.city);stationCache.set(station,result);return result;}
  }
  return key;
 };
 const cities=new Map(AUTO_HUBS.map(c=>[cityKey(c),{...c,importance:CityRanking.importance(c.city)}]));
 const london={type:'PLACE',name:'London',label:'London',city:'London',cityKey:'london',lat:51.5074,lon:-.1278,tz:'Europe/London',importance:100};cities.set('london',london);
 EXPLORER_EXTRA_CITIES.forEach(([city,lat,lon,tz,importance])=>cities.set(cityKey(city),{type:'PLACE',name:city,label:city,city,cityKey:cityKey(city),lat,lon,tz,importance:CityRanking.importance(city)}));
 [['Rome',41.9028,12.4964,'Europe/Rome',99],['Lisbon',38.7223,-9.1393,'Europe/Lisbon',90],['Oslo',59.9139,10.7522,'Europe/Oslo',89],['Porto',41.1579,-8.6291,'Europe/Lisbon',76],['Seville',37.3891,-5.9845,'Europe/Madrid',78],['Bergen',60.3913,5.3221,'Europe/Oslo',74],['Edinburgh',55.9533,-3.1883,'Europe/London',81],['Valencia',39.4699,-.3763,'Europe/Madrid',75]].forEach(([city,lat,lon,tz,score])=>cities.set(cityKey(city),{type:'PLACE',name:city,label:city,city,cityKey:cityKey(city),lat,lon,tz,importance:score}));
 const getCity=name=>cities.get(cityKey(name));
 const mercatorY=lat=>Math.log(Math.tan(Math.PI/4+Math.max(-80,Math.min(80,Number(lat)))*Math.PI/360));
 const project=(lon,lat)=>({x:(Number(lon)+13)*Math.PI/180*800,y:(mercatorY(67)-mercatorY(lat))*800});
 const point=p=>project(p.lon,p.lat);
 const importance=name=>getCity(name)?.importance||55;
 const corridorKey=c=>[cityKey(c.from),cityKey(c.to)].sort().join('|');
 const servicePriority=c=>({night:4,highspeed:3,day:2,ferry:1}[c.kind]||0);
 const lookupGroups=new Map();
 function corridorOptions(connection){return (connection.queryGroup?lookupGroups.get(connection.queryGroup)||[]:EXPLORER_CONNECTIONS.filter(c=>corridorKey(c)===corridorKey(connection))).sort((a,b)=>servicePriority(b)-servicePriority(a));}
 function corridors(connections){const groups=new Map();connections.forEach(c=>{const key=corridorKey(c),old=groups.get(key);if(!old||servicePriority(c)>servicePriority(old))groups.set(key,c);});return [...groups.values()];}
 const selectedKeys=()=>new Set([collectSelections().start,collectSelections().finish,...collectSelections().visits.map(v=>v.sel)].filter(Boolean).map(cityKey));
 const activeConnections=()=>state.city?EXPLORER_CONNECTIONS.filter(c=>cityKey(c.from)===cityKey(state.city)||cityKey(c.to)===cityKey(state.city)).sort((a,b)=>{
  const rank=c=>{const destination=cityKey(c.from)===cityKey(state.city)?c.to:c.from;return importance(destination)+(c.kind==='night'?9:c.kind==='highspeed'?5:0)-(state.previousCity&&cityKey(destination)===cityKey(state.previousCity)?20:0);};
  return rank(b)-rank(a);
 }).filter((c,i,all)=>{
  const destination=x=>cityKey(x.from)===cityKey(state.city)?cityKey(x.to):cityKey(x.from);
  return !all.slice(0,i).some(x=>destination(x)===destination(c));
 }).slice(0,state.cityLimit||8):[];
 function viewBox(){
  const box=$('explorer').getBoundingClientRect(),aspect=(box.width||1000)/(box.height||800),h=900/state.zoom,w=h*aspect;
  return {x:state.cx-w/2,y:state.cy-h/2,w,h};
 }
 function updateView(){
  const b=viewBox();$('explorerMap').setAttribute('viewBox',`${b.x} ${b.y} ${b.w} ${b.h}`);paint();scheduleMapDetail();
 }
 const shapes=new Map(),discovered=new Set();
 let detailTimer,detailController,detailKey='';
 function scheduleMapDetail(){
  clearTimeout(detailTimer);if(!desktop.matches||state.zoom<4||!window.RailRoamMapDetail)return;
  const frame=RailRoamMapDetail.frame(viewBox());if(frame.east-frame.west>16||frame.north-frame.south>12)return;
  if(!$('cancelSearch').hidden)return;
  const key=JSON.stringify([RailRoamMapDetail.snapped(frame),appState.leaveDate]);if(key===detailKey)return;
  detailTimer=setTimeout(async()=>{
   detailController?.abort();const controller=detailController=new AbortController();window.RailRoamTimetables?.prioritize(controller.signal,3);detailKey=key;$('explorer').dataset.detailState='loading';
   const centre=[...cities.values()].filter(c=>c.tz).sort((a,b)=>geoKm(a,{lat:(frame.north+frame.south)/2,lon:(frame.east+frame.west)/2})-geoKm(b,{lat:(frame.north+frame.south)/2,lon:(frame.east+frame.west)/2}))[0];
   try{const data=await RailRoamMapDetail.load(frame,appState.leaveDate,centre?.tz||'Europe/Berlin',controller.signal);if(controller.signal.aborted)return;
    const keep=selectedKeys();if(state.city)keep.add(cityKey(state.city));routeStops().forEach(s=>keep.add(cityKey(s.place)));
    for(let i=EXPLORER_CONNECTIONS.length-1;i>=0;i--)if(EXPLORER_CONNECTIONS[i].mapDetail&&EXPLORER_CONNECTIONS[i].id!==state.connection?.id)EXPLORER_CONNECTIONS.splice(i,1);
    for(const [k,c]of cities)if(c.mapDetail&&!keep.has(k))cities.delete(k);
    const add=p=>{if(p?.lat==null||p?.lon==null||!p.name)return null;const name=p.name.replace(/,?\s+(?:Bahnhof|Hauptbahnhof|Hbf|station)$/i,'').trim(),nearby=[...cities.values()].find(c=>!c.mapDetail&&geoKm(c,p)<5),k=nearby?cityKey(nearby):canonicalCityKey(name);if(!cities.has(k)){keyCache.set(name,k);cities.set(k,{...p,type:p.id?'STOP':'PLACE',name:p.name,label:name,city:name,cityKey:k,tz:p.tz||centre?.tz||'Europe/Berlin',importance:/haupt|central|centrale|hbf/i.test(p.name)?49:36,mapDetail:true});}return cities.get(k);};
    const cells=new Map();for(const p of data.stops){if(p.lat==null||p.lon==null)continue;const cell=Math.floor((p.lon-frame.west)/Math.max(.001,frame.east-frame.west)*25)+'|'+Math.floor((p.lat-frame.south)/Math.max(.001,frame.north-frame.south)*16);if(!cells.has(cell))cells.set(cell,p);}for(const p of cells.values())add(p);
    const ordered=data.segments.slice().sort((a,b)=>({NIGHT_RAIL:4,HIGHSPEED_RAIL:3,LONG_DISTANCE:2}[b.mode]||1)-({NIGHT_RAIL:4,HIGHSPEED_RAIL:3,LONG_DISTANCE:2}[a.mode]||1)),seen=new Set();
    for(const segment of ordered){if(seen.size>=900)break;const from=add(segment.from),to=add(segment.to);if(!from||!to||cityKey(from)===cityKey(to))continue;const corridor=[cityKey(from),cityKey(to)].sort().join('|');if(seen.has(corridor))continue;seen.add(corridor);
     const trip=segment.trips?.[0];if(!trip?.tripId)continue;const leg={mode:segment.mode,from:segment.from,to:segment.to,startTime:segment.departure,endTime:segment.arrival,tripId:trip.tripId,displayName:trip.displayName||trip.routeShortName,legGeometry:{points:segment.polyline,precision:5},distance:segment.distance},itinerary={startTime:leg.startTime,endTime:leg.endTime,legs:[leg],transfers:0},op=resolveOperator(leg);
     EXPLORER_CONNECTIONS.push({id:'map-detail-'+corridor,from:from.city,to:to.city,fromPlace:from,toPlace:to,kind:segment.mode==='FERRY'?'ferry':segment.mode==='NIGHT_RAIL'?'night':segment.mode==='HIGHSPEED_RAIL'?'highspeed':'day',operator:Object.keys(EXPLORER_OPERATORS).find(id=>EXPLORER_OPERATORS[id]===op),local:true,mapDetail:true,itinerary,serviceLabel:routeLabel(leg)});
    }
    $('explorer').dataset.detailState=data.errors?.length?'partial':'ready';$('explorer').dataset.detailErrors=JSON.stringify(data.errors||[]);$('explorer').dataset.detailSegments=String(data.segments.length);$('explorer').dataset.detailStops=String(data.stops.length);$('explorer').dataset.detailRoutes=String(seen.size);paint();
   }catch(error){if(!controller.signal.aborted){detailKey='';$('explorer').dataset.detailState='unavailable';}}
  },650);
 }
 document.addEventListener('railroam:search',()=>{clearTimeout(detailTimer);detailController?.abort();detailKey='';});
 document.addEventListener('railroam:constraints-change',()=>{const root=$('departureResults');if(root&&!root.hidden&&state.scheduleData?.connectionId===state.connection?.id)root.innerHTML=RailRoamSchedule.html(state.scheduleData.data,state.connection.frequency||'');});
 function coordinatePath(coords){const rect=$('explorer').getBoundingClientRect(),unit=viewBox().w/(rect.width||1000);return RailGeometry.displayPath(coords,project,unit);}
 function connectionShape(c){
  if(c.itinerary)return transitLegs(c.itinerary).flatMap(legShape);
  if(shapes.has(c.id))return shapes.get(c.id);
  if(c.kind==='ferry')return c.geometry||[];
  const forward=[`${c.from}|${c.to}|${c.kind}`,`${c.from}|${c.to}`],backward=[`${c.to}|${c.from}|${c.kind}`,`${c.to}|${c.from}`];
  let via=forward.map(k=>EXPLORER_ROUTE_VIA[k]).find(Boolean);if(!via){const reverse=backward.map(k=>EXPLORER_ROUTE_VIA[k]).find(Boolean);if(reverse)via=[...reverse].reverse();}
  const places=(via||[c.from,c.to]).map(p=>typeof p==='string'?getCity(p):p).filter(Boolean);
  const coords=[];for(let i=1;i<places.length;i++)coords.push(...RailGeometry.path(places[i-1],places[i]));
  if(coords.length)shapes.set(c.id,coords);return coords;
 }
 function legShape(leg){
  if(shapes.has(leg))return shapes.get(leg);
  if(leg.mode!=='FERRY')return RailGeometry.legPath(leg);
  if(leg.legGeometry?.points)return RailGeometry.decode(leg.legGeometry.points,leg.legGeometry.precision||6);
  const from=cityKey(leg.from),to=cityKey(leg.to),c=EXPLORER_CONNECTIONS.find(c=>c.kind==='ferry'&&((cityKey(c.from)===from&&cityKey(c.to)===to)||(cityKey(c.to)===from&&cityKey(c.from)===to)));
  return c?.geometry||[];
 }
 function routeStops(){
  const result=[];
  if(!state.route)return result;
  const A=state.route.analysis;
  A.flat.forEach(({leg},i)=>{
   if(i===0)result.push({place:leg.from,departure:leg.startTime,type:'Start'});
   const b=A.boundaries[i],next=A.flat[i+1]?.leg;
   result.push({place:leg.to,arrival:leg.endTime,departure:next?.startTime,type:next?(b?.type==='visit'?'Visit':b?.changed?'Transfer':'Through'):'Finish',boundary:b,nextPlace:next?.from});
  });return result;
 }
 function visibleCities(){
  const all=new Map(cities), keys=selectedKeys();
  [getSelection(startInput),getSelection(finishInput),...collectSelections().visits.map(v=>v.sel),...state.avoided.values(),...routeStops().map(s=>s.place)].filter(Boolean).forEach(p=>{
   const k=cityKey(p);if(!all.has(k)&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon))all.set(k,{...p,city:p.city||cleanCityFromStation(p.name),importance:60});
  });
  const active=activeConnections(),focused=new Set(active.flatMap(c=>[cityKey(c.from),cityKey(c.to)]));
  if(state.city)focused.add(cityKey(state.city));
  if(state.connection){focused.add(cityKey(state.connection.from));focused.add(cityKey(state.connection.to));}
  const stops=new Set(routeStops().map(s=>cityKey(s.place))), b=viewBox(), rect=$('explorer').getBoundingClientRect(),scale=(rect.width||1000)/b.w,placed=[];
  const result=[];
  [...all.values()].sort((a,b)=>{
   const pinned=c=>keys.has(cityKey(c))||focused.has(cityKey(c))||stops.has(cityKey(c))||state.avoided.has(cityKey(c));
   return Number(pinned(b))-Number(pinned(a))||b.importance-a.importance;
  }).forEach(c=>{
   const p=point(c),k=cityKey(c),pinned=keys.has(k)||focused.has(k)||stops.has(k)||state.avoided.has(k);
   if(p.x<b.x-20||p.x>b.x+b.w+20||p.y<b.y-20||p.y>b.y+b.h+20)return;
   const threshold=state.zoom<1.35?93:state.zoom<2?84:state.zoom<3?72:state.zoom<5?60:state.zoom<8?50:0;
   if(!pinned&&c.importance<threshold&&state.zoom<2.5)return;
   const budget=state.zoom<2.5?(state.city||state.connection||state.route?10:18):RailRoamMapDetail.budget(rect.width,rect.height,!!state.city||!!state.connection||!!state.route);
   if(!pinned&&result.filter(x=>!x.pinned).length>=budget)return;
   const distance=state.zoom>5?82:state.zoom>3?94:state.zoom>2?108:c.importance>=98?75:110;
   if(!pinned&&placed.some(q=>Math.hypot(q.x-p.x,q.y-p.y)*scale<distance))return;
   placed.push(p);result.push({c,p,k,pinned,focused:focused.has(k),stop:stops.has(k)});
  });return result;
 }
 function paint(){
  if(!desktop.matches)return;
  const active=new Set(activeConnections().map(c=>c.id)),focus=!!state.city||!!state.route||!!state.connection;
  if(state.connection?.id)active.add(state.connection.id);
  $('itinerary').style.opacity=state.city?'.2':'1';
  const b=viewBox(),rect=$('explorer').getBoundingClientRect(),unit=b.w/(rect.width||1000);
  const shown=visibleCities(),visible=new Set(shown.map(c=>c.k));
  let network=corridors(EXPLORER_CONNECTIONS.filter(c=>active.has(c.id)||(state.zoom<2.5?visible.has(cityKey(c.from))&&visible.has(cityKey(c.to))&&(!c.local||state.zoom>1.6):RailRoamMapDetail.intersects(connectionShape(c),b,project))));
  if(state.zoom>=2.5)network.sort((a,z)=>Number(active.has(z.id))-Number(active.has(a.id))||servicePriority(z)-servicePriority(a));
  network=network.filter((c,i)=>active.has(c.id)||i<Math.max(18,RailRoamMapDetail.budget(rect.width,rect.height)*2));
  $('network').innerHTML=network.map(c=>{
   const a=getCity(c.from),z=getCity(c.to);if(!a||!z)return '';
   const focused=corridorOptions(c).some(x=>active.has(x.id)),dim=focus&&!focused,d=coordinatePath(connectionShape(c));if(!d)return '';
   return `<g class="network-edge"><path class="network-line ${focused?'focused':''} ${dim?'dimmed':''}" d="${d}" stroke="${colors[c.kind]}" ${c.kind==='ferry'?'stroke-dasharray="1 6" stroke-linecap="round"':''} vector-effect="non-scaling-stroke"/><path role="button" tabindex="-1" aria-label="${esc(c.from+' to '+c.to+' · '+kinds[c.kind])}" class="network-hit" data-connection="${c.id}" d="${d}" vector-effect="non-scaling-stroke"/></g>`;
  }).join('');
  const displayLegs=state.connection?.leg?[{leg:state.connection.leg}]:state.connection?.itinerary?transitLegs(state.connection.itinerary).map(leg=>({leg})):state.connection?null:state.route?.analysis.flat;
  $('itinerary').innerHTML=displayLegs?displayLegs.map(({leg},i)=>{
   if(![leg.from?.lat,leg.from?.lon,leg.to?.lat,leg.to?.lon].every(v=>v!=null&&Number.isFinite(+v)))return '';
   const kind=leg.mode==='FERRY'?'ferry':isNightLeg(leg)?'night':leg.mode==='HIGHSPEED_RAIL'?'highspeed':'day';
   const d=coordinatePath(legShape(leg));if(!d)return '';
   return `<g class="network-edge"><path class="itinerary-line network-line" d="${d}" stroke="${colors[kind]}" ${kind==='ferry'?'stroke-dasharray="1 7" stroke-linecap="round"':''} vector-effect="non-scaling-stroke"/><path class="network-hit" data-leg="${i}" d="${d}" vector-effect="non-scaling-stroke"/></g>`;
  }).join(''):'';
  if(state.connection&&!displayLegs){const d=coordinatePath(connectionShape(state.connection));if(d)$('itinerary').innerHTML=`<path class="selected-connection itinerary-line" fill="none" stroke="${colors[state.connection.kind]}" stroke-width="4" vector-effect="non-scaling-stroke" ${state.connection.kind==='ferry'?'stroke-dasharray="1 7" stroke-linecap="round"':''} d="${d}"/>`;}
  const selected=selectedKeys();
  $('cities').innerHTML=shown.map(({c,p,k,focused,stop})=>{
   const activeCity=state.city&&cityKey(state.city)===k,cls=[selected.has(k)||stop?'selected':'',state.avoided.has(k)?'avoided':'',focus&&!focused&&!stop?'dimmed':'',activeCity?'active':''].join(' ');
   const name=c.city||c.name,major=c.importance>=90,minor=c.importance<72,r=(activeCity?6.5:major?5:minor?3.5:4)*unit;
   return `<g role="button" tabindex="0" aria-label="Explore ${esc(name)}" data-city="${esc(k)}" class="city-marker ${cls}" transform="translate(${p.x} ${p.y})"><circle r="${r}" vector-effect="non-scaling-stroke"/><circle r="${13*unit}" fill="transparent" style="fill:transparent;stroke:none"/><rect x="${8*unit}" y="${-14*unit}" width="${(name.length*(major?7.5:minor?5.8:6.4)+12)*unit}" height="${25*unit}" style="fill:transparent;stroke:none;pointer-events:all"/><text x="${10*unit}" y="${3*unit}" style="font-size:${(major?13:minor?10:11)*unit}px;font-weight:${major?700:minor?400:550};fill:${minor?'#7c8a94':'#3b5263'};stroke-width:${4*unit}px">${esc(name)}</text></g>`;
  }).join('');
 }
 const popupHistory=[];let popupCurrent=null,popping=false;
 function rememberPopup(next){if(!popping&&popupCurrent&&JSON.stringify(popupCurrent)!==JSON.stringify(next)){popupHistory.push(popupCurrent);if(popupHistory.length>20)popupHistory.shift();}popupCurrent=next;}
 function showPopup(html){$('mapPopup').hidden=false;$('mapPopup').innerHTML='<div class="popup-nav">'+(popupHistory.length?'<button type="button" class="popup-back" data-action="back" aria-label="Back to previous details">← Back</button>':'')+'<button type="button" class="popup-close" data-action="close" aria-label="Close details">×</button></div>'+html;$('mapPopup').scrollTop=0;}
 function closePopup(){popupHistory.length=0;popupCurrent=null;state.request++;$('mapPopup').hidden=true;state.city=null;state.connection=null;paint();status();}
 function status(text){$('mapStatus').textContent=text||'';if($('clearSelection'))$('clearSelection').hidden=!state.city&&!state.connection;}
 function cityDetails(city){
  rememberPopup({type:'city',city});if(!state.city||cityKey(state.city)!==cityKey(city))state.cityLimit=8;
  state.previousCity=state.connection&&cityKey(state.connection.destination)===cityKey(city)?state.connection.origin:state.city&&cityKey(state.city)===cityKey(city)?state.previousCity:null;
  state.request++;state.city=city;state.connection=null;
  const connections=activeConnections(),guide=EXPLORER_CITY_GUIDES[city.city],k=cityKey(city),stops=routeStops().filter(s=>cityKey(s.place)===k);
  const guideHtml=guide?`<div class="popup-metrics"><div><small>Suggested stay</small>${esc(guide[0])}</div><div><small>Best season</small>${esc(guide[1])}</div></div><div class="popup-tags">${esc(guide[2])}</div><p class="top-attractions"><strong>Top attractions</strong><br>${guide[3].map(esc).join(' · ')}</p><a class="popup-source" href="${guide[4]}" target="_blank" rel="noopener">Visitor guide ↗</a>`:`<a class="popup-source" href="https://en.wikivoyage.org/wiki/${encodeURIComponent(city.city)}" target="_blank" rel="noopener">Visitor guide ↗</a>`;
  const timing=stops.map(s=>`<div class="stop-timing"><div class="popup-kicker">${esc(s.type)} · selected itinerary</div>${s.arrival?`<div><strong>Arrive</strong> ${esc(fmtNode(s.arrival,s.place.tz))}</div>`:''}${s.departure?`<div><strong>Depart</strong> ${esc(fmtNode(s.departure,s.nextPlace?.tz||s.place.tz))}</div>`:''}${s.boundary?.changed?`<div><strong>Scheduled layover</strong> ${durationText(s.boundary.gapMin*60000)}</div>${s.boundary.type==='visit'?`<div>Usable visit: ${visitDurationText(s.boundary.stayMin??s.boundary.exploreMin)}</div>`:''}${s.boundary.transferMin?`<div>Station transfer: ≈ ${s.boundary.transferMin} min</div>`:''}`:''}<div class="hint">${esc(s.place.name||'')}${s.nextPlace&&s.nextPlace.name!==s.place.name?' → '+esc(s.nextPlace.name):''}</div></div>`).join('');
  showPopup(`<div class="popup-kicker">${city.mapDetail?'Rail stop':'Destination'}</div><h3>${esc(city.city)}</h3>${timing}<details class="popup-section"><summary>Visit</summary>${RailRoamScores.cityVisitHtml(city)}${guideHtml}</details>${RailRoamImpact.city(city)}${window.RailRoamAccess?.cityHtml(city)||''}<div class="popup-actions"><button data-action="start">Start here</button><button data-action="finish">Finish here</button><button data-action="visit">+ Add to city wishlist</button><button class="avoid-action" data-action="avoid">${state.avoided.has(k)?'Remove exclusion':'Avoid city'}</button></div><div class="popup-kicker" style="margin-top:20px">Connections</div><div class="connection-list">${connections.map(c=>{
   const destination=cityKey(c.from)===k?c.to:c.from;
   return `<button data-connection="${c.id}"><i style="background:${colors[c.kind]}"></i>${esc(destination)}<span>${kinds[c.kind]} →</span></button>`;
  }).join('')||'<p class="map-empty">Finding connections…</p>'}</div><button type="button" class="more-connections" data-action="more-connections">More connections ↓</button><form id="cityConnectionSearch" class="city-connection-search"><label for="cityDestination">Find a connection to</label><div class="ac-wrap"><input class="place-input" id="cityDestination" placeholder="City or station"><div class="ac-menu"></div><div class="status"></div></div><button type="submit">Find connections →</button><p id="cityConnectionStatus" aria-live="polite"></p></form>`);
  setupAutocomplete($('cityDestination'));$('cityConnectionSearch').onsubmit=e=>{e.preventDefault();findCityConnection(city);};
  const more=$('mapPopup').querySelector('[data-action="more-connections"]');if(more){const total=new Set(EXPLORER_CONNECTIONS.filter(c=>[cityKey(c.from),cityKey(c.to)].includes(k)).map(c=>cityKey(c.from)===k?cityKey(c.to):cityKey(c.from))).size;more.hidden=connections.length>=total;}
  status(city.city);fitConnections(connections,city);discoverConnections(city);
 }
 function resolveOperator(leg){
  const name=[leg.agencyName,leg.displayName,leg.routeShortName].join(' ');
  const extra=/pkp|intercity\s*s\.?a/i.test(name)?'pkp':/srbija|srbijavoz/i.test(name)?'srb':/zfbh|žfbh/i.test(name)?'zfbh':/hzpp|hžpp/i.test(name)?'hz':/máv|mav.start|mav-start/i.test(name)?'mav':/elron/i.test(name)?'elron':/\bVR\b/i.test(name)?'vr':/tcdd|yht|doğu|dogu/i.test(name)?'tcdd':/\bbdz\b/i.test(name)?'bdz':/stena/i.test(name)?'stena':/tallink|silja/i.test(name)?'tallink':/viking/i.test(name)?'viking':/superfast|anek/i.test(name)?'superfast':/blue star/i.test(name)?'bluestar':/grimaldi/i.test(name)?'grimaldi':/turyol/i.test(name)?'turyol':/cfr/i.test(name)?'cfr':/hellenic/i.test(name)?'hellenic':null;
  if(extra)return EXPLORER_OPERATORS[extra]||null;
  const id=/nightjet|\bNJ\b/i.test(name)?'nightjet':/european sleeper|\bES\b/i.test(name)?'sleeper':/eurostar/i.test(name)?'eurostar':/flixtrain|\bFLX/i.test(name)?'flixtrain':/freccia|trenitalia/i.test(name)?'trenitalia':/sncf|tgv/i.test(name)?'sncf':/renfe|\bAVE\b/i.test(name)?'renfe':/\bSJ\b/i.test(name)?'sj':/české|ceske|\bČD\b|\bCD\b/i.test(name)?'cd':/\bSBB\b/i.test(name)?'sbb':/öbb|oebb|railjet|\bRJX?\b/i.test(name)?'oebb':/deutsche bahn|\bICE\b|\bDB\b/i.test(name)?'db':null;
  return id?EXPLORER_OPERATORS[id]:null;
 }
 function serviceOverview(options,origin,destination){
  const groups=new Map();for(const c of options){const key=c.jointGroup||[c.operator,c.kind,c.serviceLabel||''].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}
  return [...groups.values()].map(group=>{const c=group.find(x=>x.operator==='pkp')||group[0],ops=[...new Set(group.map(x=>x.operator))].map(id=>EXPLORER_OPERATORS[id]).filter(Boolean),pass=InterrailInfo.describe({...c,origin,destination}),op=EXPLORER_OPERATORS[c.operator];return `<section class="service-overview"><h4><i style="background:${colors[c.kind]}"></i>${esc(c.serviceLabel||kinds[c.kind])}</h4><div class="service-carriers">${esc(ops.map(o=>o.name).join(' / '))}</div>${c.itinerary?journeyDetails(c.itinerary):''}<p><strong>${/^see timetable$/i.test(c.frequency||op?.frequency||'')?'':esc(c.frequency||op?.frequency||'')}</strong><br>${esc(c.accommodation||op?.accommodation||'Accommodation varies by service.')}</p>${op?.notes&&!c.jointGroup?`<p>${esc(op.notes)}</p>`:''}${!c.itinerary||transitLegs(c.itinerary).length===1?`<p><strong>Interrail · ${esc(pass.status)}</strong><br>${esc(pass.extra)}</p><a class="popup-source" href="${esc(pass.source)}" target="_blank" rel="noopener">Pass rules ↗</a>`:''}</section>`;}).join('');
 }
 function journeyDetails(it){const legs=transitLegs(it);return legs.map((l,i)=>{const op=resolveOperator(l),operator=Object.keys(EXPLORER_OPERATORS).find(id=>EXPLORER_OPERATORS[id]===op),kind=l.mode==='FERRY'?'ferry':isNightLeg(l)?'night':l.mode==='HIGHSPEED_RAIL'?'highspeed':'day',pass=InterrailInfo.describe({operator,kind,from:cleanCityFromStation(l.from.name),to:cleanCityFromStation(l.to.name)},l);return `<div class="lookup-leg"><strong>${esc(routeLabel(l))}${op?' · '+esc(op.name):''}</strong><div>${esc(fmtNode(l.startTime,l.from.tz))} · ${esc(l.from.name)}</div><div>→ ${esc(fmtNode(l.endTime,l.to.tz))} · ${esc(l.to.name)}</div><small>Interrail · ${esc(pass.status)} · ${esc(pass.extra)}</small>${legs[i+1]?`<small>Layover ${durationText(new Date(legs[i+1].startTime)-new Date(l.endTime))}</small>`:''}</div>`;}).join('');}

 async function findCityConnection(city){
  const destination=getSelection($('cityDestination')),message=$('cityConnectionStatus');if(!destination){message.textContent='Choose a city or station from the suggestions.';return;}if(cityKey(city)===cityKey(destination)){message.textContent='Choose another city.';return;}
  const known=corridors(EXPLORER_CONNECTIONS.filter(c=>corridorKey(c)===corridorKey({from:city.city,to:destination.city}))).sort((a,b)=>servicePriority(b)-servicePriority(a));
  if(known.length){connectionDetails(known[0]);return;}
  const token=++state.request;message.textContent='Checking direct trains…';
  try{const from=city,to={...destination,city:destination.city||cleanCityFromStation(destination.name)};if(!getCity(to.city))cities.set(cityKey(to),{...to,importance:CityRanking.importance(to.city)});
   const start=extendedLocalDate(appState.leaveDate,0,from.tz),end=extendedLocalDate(addDaysYmd(appState.leaveDate,2),0,from.tz);
   let found=(await queryDirectDepartures(from,to,start,end,'all')).filter(it=>{const legs=transitLegs(it);return legs.length&&legs.every((l,i)=>i===0||isSameService(legs[i-1],l));});
   if(token!==state.request)return;if(!found.length){message.textContent='Checking connecting trains…';found=await querySegment(from,to,start,end,8,false);}
   if(token!==state.request)return;if(!found.length){message.textContent='No published connection found in these dates.';return;}
   const unique=new Map();for(const it of found){const legs=transitLegs(it);if(!legs.length)continue;const key=[legs[0].startTime,legs.at(-1).endTime,legs.map(l=>(routeLabel(l).match(/\d+/g)||[l.mode]).join('-')).join('|')].join('|');if(!unique.has(key))unique.set(key,it);}const key='lookup-'+token,options=[...unique.values()].slice(0,6).map((it,i)=>{const legs=transitLegs(it),first=legs[0],op=resolveOperator(first),operator=Object.keys(EXPLORER_OPERATORS).find(id=>EXPLORER_OPERATORS[id]===op);return {id:key+'-'+i,queryGroup:key,from:from.city,to:to.city,origin:from.city,destination:to.city,fromPlace:from,toPlace:to,kind:legs.some(isNightLeg)?'night':legs.some(l=>l.mode==='HIGHSPEED_RAIL')?'highspeed':legs.every(l=>l.mode==='FERRY')?'ferry':'day',operator,itinerary:it,serviceLabel:legs.map(routeLabel).join(' + ')};});
   lookupGroups.set(key,options);if(lookupGroups.size>8)lookupGroups.delete(lookupGroups.keys().next().value);connectionDetails(options[0]);
  }catch(e){if(token===state.request)message.textContent='Connection search unavailable. Retry later.';}
 }
 function connectionDetails(connection,leg=null){
  state.request++;state.connection={...connection,leg};
  const origin=connection.origin||(state.city&&cityKey(state.city)===cityKey(connection.to)?connection.to:connection.from);
  const destination=connection.destination||(cityKey(origin)===cityKey(connection.from)?connection.to:connection.from);
  rememberPopup({type:'connection',connection:{...connection,origin,destination},leg});
  state.connection.origin=origin;state.connection.destination=destination;
  state.city=null;
  const op=leg?resolveOperator(leg):EXPLORER_OPERATORS[connection.operator],kind=connection.kind;
  const operator=leg?Object.keys(EXPLORER_OPERATORS).find(id=>EXPLORER_OPERATORS[id]===op):connection.operator;
  const pass=InterrailInfo.describe({...state.connection,operator},leg);
  const accommodation=operator==='tcdd'&&kind==='highspeed'?'Economy · Business seats':operator==='bdz'&&kind==='night'?'Couchettes · sleepers':op?.accommodation;
  const date=appState.leaveDate;
  const options=corridorOptions(connection);
  showPopup(`<div class="popup-kicker" style="color:${colors[kind]}">${kinds[kind]}</div><h3>${esc(origin)} → ${esc(destination)}</h3>
   <button type="button" class="continue-route" data-action="continue">Continue from ${esc(destination)} →</button>
   ${options.length?serviceOverview(options,origin,destination):''}
   ${leg?`<div class="popup-metrics"><div><small>Departure</small>${esc(fmtNode(leg.startTime,leg.from?.tz))}</div><div><small>Arrival</small>${esc(fmtNode(leg.endTime,leg.to?.tz))}</div></div><p>${esc(leg.from?.name)} → ${esc(leg.to?.name)}<br>${durationText(new Date(leg.endTime)-new Date(leg.startTime))} · ${esc(routeLabel(leg))}</p>`:''}
   ${!options.length&&op?`<div class="popup-metrics"><div style="grid-column:1/-1"><small>Frequency</small>${esc(connection.frequency||op.frequency)}</div></div><p>${esc(accommodation)}</p>${op.notes?`<p>${esc(op.notes)}</p>`:''}`:''}
   ${!options.length?`<div class="pass-info"><div><strong>Interrail · Global Pass</strong><span>${esc(pass.status)}</span></div><p>${esc(pass.extra)}</p><a href="${esc(pass.source)}" target="_blank" rel="noopener">Pass rules ↗</a></div>`:''}
   ${RailRoamImpact.connection(state.connection,leg)}
   ${window.RailRoamScenery?.html(leg,state.connection)||''}
   ${window.RailRoamAccess?.connectionHtml(state.connection,leg)||''}
   <button class="popup-see-more" id="wishlistAdd"><span>+ Add to wishlist</span><span>♡</span></button>
   <button class="popup-see-more" id="seeDepartures" aria-expanded="false" aria-controls="departureResults"><span>Timetable</span><span>⌄</span></button><div id="departureResults" hidden aria-live="polite"></div>
`);
  const allServices={...state.connection,operator:leg||connection.calendar?operator:undefined,kind:leg||connection.calendar?connection.kind:connection.kind==='ferry'?'ferry':'all',serviceName:leg?routeLabel(leg):connection.calendar?connection.serviceName:undefined,variants:undefined,fromPlace:getCity(origin)||connection.fromPlace||leg?.from,toPlace:getCity(destination)||connection.toPlace||leg?.to};
  $('wishlistAdd').onclick=()=>{if(connection.itinerary&&transitLegs(connection.itinerary).length>1){for(const l of transitLegs(connection.itinerary)){const from=getCity(l.from)||{...l.from,city:cleanCityFromStation(l.from.name)},to=getCity(l.to)||{...l.to,city:cleanCityFromStation(l.to.name)},op=resolveOperator(l);RailRoamWishlist.add({from:from.city,to:to.city,origin:from.city,destination:to.city,fromPlace:from,toPlace:to,kind:l.mode==='FERRY'?'ferry':isNightLeg(l)?'night':l.mode==='HIGHSPEED_RAIL'?'highspeed':'day',operator:Object.keys(EXPLORER_OPERATORS).find(id=>EXPLORER_OPERATORS[id]===op),serviceName:routeLabel(l)});}}else window.RailRoamWishlist.add(allServices);$('wishlistAdd').firstElementChild.textContent='Saved to wishlist ✓';};
  $('seeDepartures').onclick=async()=>{const root=$('departureResults'),button=$('seeDepartures');root.hidden=!root.hidden;button.setAttribute('aria-expanded',String(!root.hidden));if(root.hidden)return;root.textContent='Loading schedule…';const selected=state.connection;try{const data=connection.itinerary?{rows:options.map(c=>{const legs=transitLegs(c.itinerary);return {first:legs[0],last:legs.at(-1),date:RailRoamSchedule.dateOf(legs[0].startTime,legs[0].from.tz),fare:itineraryEstimatedFare(c.itinerary),operators:RailRoamSchedule.operatorLinks(c,legs[0])};}),start:appState.leaveDate,end:addDaysYmd(appState.leaveDate,2)}:await RailRoamSchedule.load(allServices);if(state.connection!==selected)return;state.scheduleData={data,connectionId:state.connection?.id};root.innerHTML=RailRoamSchedule.html(data,connection.frequency||'');}catch(e){root.textContent='Schedule unavailable. Check the operator timetable.';}};
  status(origin+' → '+destination);fitPoints((leg?legShape(leg):connectionShape(connection)).map(([lon,lat])=>({lon,lat})),[getCity(origin)||leg?.from,getCity(destination)||leg?.to]);
  if(!leg)hydrateConnectionShape(connection);
 }
 function directService(it,kind,operator){
  const legs=transitLegs(it);if(!legs.length)return false;
  if(legs.some((l,i)=>i>0&&!isSameService(legs[i-1],l)))return false;
  if(kind==='all'||kind==='any')return true;
  const first=legs[0],last=legs.at(-1),combined={...first,endTime:last.endTime,to:last.to};
  if(kind==='ferry'&&!legs.every(l=>l.mode==='FERRY'))return false;
  if(kind!=='ferry'&&legs.some(l=>l.mode==='FERRY'))return false;
  if(kind==='night'&&!isNightLeg(combined))return false;
  if(kind!=='night'&&isNightLeg(combined))return false;
  if(kind==='highspeed'&&!legs.some(l=>l.mode==='HIGHSPEED_RAIL'||/TGV|ICE|Eurostar|Freccia|AVE/i.test(routeLabel(l))))return false;
  if(operator){const actual=resolveOperator(first);if(actual&&actual.name!==EXPLORER_OPERATORS[operator]?.name)return false;}
  return true;
 }
 function updateResultBadge(){const count=state.routes.length,badge=$('resultCount'),show=count>0&&state.unseenResults&&state.view!=='results';badge.textContent=show?String(count):'';badge.hidden=!show;badge.setAttribute('aria-label',count+' routes available');}
 function setPanel(name){if(name==='wishlist')name='plan';state.view=name;if(name==='results')state.unseenResults=false;updateResultBadge();document.querySelectorAll('[data-panel]').forEach(b=>{b.classList.toggle('active',b.dataset.panel===name);b.setAttribute('aria-pressed',b.dataset.panel===name)});$('plannerPanel').hidden=name!=='plan';if($('wishlistPanel'))$('wishlistPanel').hidden=name!=='wishlist';$('resultsPanel').hidden=name!=='results';document.dispatchEvent(new CustomEvent('railroam:panel',{detail:name}));}
 function fitPoints(places,fallback=[]){
  const points=(places.length?places:fallback).filter(p=>p&&p.lat!=null&&p.lon!=null).map(point);if(!points.length)return;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),rect=$('explorer').getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const popup=$('mapPopup'),panelWidth=popup.hidden?0:Math.min(popup.getBoundingClientRect().width+40,rect.width*.48),availableW=Math.max(160,rect.width-panelWidth-90),availableH=Math.max(160,rect.height-190);
  const spanX=Math.max(12,Math.max(...xs)-Math.min(...xs)),spanY=Math.max(12,Math.max(...ys)-Math.min(...ys));
  const pixelsPerUnit=Math.min(availableW/spanX,availableH/spanY);
  state.zoom=Math.max(.65,Math.min(14,pixelsPerUnit*900/rect.height));
  const unit=900/state.zoom/rect.height;
  state.cx=(Math.min(...xs)+Math.max(...xs))/2+(panelWidth/2)*unit;state.cy=(Math.min(...ys)+Math.max(...ys))/2;updateView();
 }
 function fitConnections(connections,city){
  const places=[city];connections.forEach(c=>{const coords=connectionShape(c);if(coords.length)places.push(...coords.map(([lon,lat])=>({lon,lat})));else places.push(getCity(c.from),getCity(c.to));});fitPoints(places);
 }
 function fitRoute(){
  if(!state.route){resetView();return;}
  const coords=state.route.analysis.flat.flatMap(({leg})=>legShape(leg));
  fitPoints(coords.map(([lon,lat])=>({lon,lat})),routeStops().map(s=>s.place));
 }
 async function discoverConnections(city){
  const code=cityKey(city)+'|'+appState.leaveDate;if(discovered.has(code))return;discovered.add(code);
  try{
   const data=await queryCityConnections(city,appState.leaveDate);
   for(const service of data.stopTimes||[]){
    if(service.cancelled||service.tripCancelled)continue;
    const destinations=[...(service.nextStops||[]),service.tripTo].filter(p=>p&&p.lat!=null&&p.lon!=null&&geoKm(city,p)>15).filter((p,i)=>i<2||p===service.tripTo||cities.has(cityKey(p)));
    const kind=service.mode==='FERRY'?'ferry':service.mode==='NIGHT_RAIL'?'night':service.mode==='HIGHSPEED_RAIL'?'highspeed':'day';
    let operator=Object.keys(EXPLORER_OPERATORS).find(id=>EXPLORER_OPERATORS[id].name===resolveOperator(service)?.name);
    if(!operator&&service.agencyUrl&&/^https?:\/\//i.test(service.agencyUrl)){operator='live-'+norm(service.agencyName);EXPLORER_OPERATORS[operator]={name:service.agencyName||'Operator',url:service.agencyUrl,frequency:'',accommodation:''};}
    for(const stop of destinations){
     const k=cityKey(stop);if(k===cityKey(city))continue;
     if(!cities.has(k)){const name=cleanCityFromStation(stop.name);cities.set(k,{...stop,type:'PLACE',name,label:name,city:name,cityKey:k,tz:stop.tz||city.tz,importance:48});}
     const target=cities.get(k);
     if(EXPLORER_CONNECTIONS.some(c=>c.kind===kind&&c.operator===operator&&((cityKey(c.from)===cityKey(city)&&cityKey(c.to)===k)||(cityKey(c.to)===cityKey(city)&&cityKey(c.from)===k))))continue;
     EXPLORER_CONNECTIONS.push({id:'live-'+EXPLORER_CONNECTIONS.length,from:city.city,to:target.city,kind,operator,local:true,frequency:'',tripId:service.tripId,fromPlace:data.place||city,toPlace:stop});
    }
   }
   if(state.city&&cityKey(state.city)===cityKey(city)&&!state.connection&&!$('cityDestination')?.value)cityDetails(city);else paint();
  }catch(e){discovered.delete(code);if(state.city&&cityKey(state.city)===cityKey(city)&&!activeConnections().length){const list=$('mapPopup').querySelector('.connection-list');if(list)list.innerHTML='<p>Connections unavailable. Retry later.</p>';}}
 }
 async function hydrateItineraryShapes(route){
  const legs=route.analysis.flat.map(x=>x.leg).filter(l=>l.tripId&&!l.legGeometry?.points&&!shapes.has(l));
  for(let i=0;i<Math.min(legs.length,12);i+=2){
   if(state.route!==route)return;
   await Promise.allSettled(legs.slice(i,i+2).map(async leg=>{
    const data=await queryTripShape(leg.tripId),it=data.itinerary||data;
    const coords=(it.legs||[]).flatMap(l=>RailGeometry.decode(l.legGeometry?.points,l.legGeometry?.precision||6));if(coords.length<3)return;
    const closest=p=>{let best=Infinity,index=0;coords.forEach(([lon,lat],i)=>{const d=geoKm(p,{lon,lat});if(d<best){best=d;index=i;}});return index;};
    const a=closest(leg.from),b=closest(leg.to);const piece=a<=b?coords.slice(a,b+1):coords.slice(b,a+1).reverse();if(piece.length>2)shapes.set(leg,piece);
   }));
   if(state.route===route)paint();
  }
 }
 async function hydrateConnectionShape(connection){
  if(!connection.tripId)return;
  try{
   const data=await queryTripShape(connection.tripId),coords=(data.itinerary||data).legs?.flatMap(l=>RailGeometry.decode(l.legGeometry?.points,l.legGeometry?.precision||6))||[];
   if(coords.length<3)return;
   const closest=p=>{let best=Infinity,index=0;coords.forEach(([lon,lat],i)=>{const d=geoKm(p,{lon,lat});if(d<best){best=d;index=i;}});return index;};
   const a=closest(connection.fromPlace),b=closest(connection.toPlace),piece=a<b?coords.slice(a,b+1):coords.slice(b,a+1).reverse();
   if(piece.length>2){shapes.set(connection.id,piece);if(state.connection?.id===connection.id){fitPoints(piece.map(([lon,lat])=>({lon,lat})));}}
  }catch(e){}
 }
 function selectRoute(index,{fit=true}={}){
  const r=state.routes[index];if(!r)return;const changed=state.route!==r||!!state.city||!!state.connection;state.route=r;state.city=null;state.connection=null;state.request++;popupHistory.length=0;popupCurrent=null;$('mapPopup').hidden=true;
  document.querySelectorAll('[data-route-index]').forEach(el=>{const on=+el.dataset.routeIndex===index;el.classList.toggle('selected',on);const btn=el.querySelector('.route-select');if(btn){btn.setAttribute('aria-pressed',on);btn.textContent=on?'Showing on map ✓':'Show this route on map →'}});
  status(`Option ${index+1}`);if(fit&&changed)fitRoute();else paint();if(changed)hydrateItineraryShapes(r);
 }
 function resetView(){popupHistory.length=0;popupCurrent=null;state.zoom=1.15;state.cx=330;state.cy=435;state.route=null;state.city=null;state.connection=null;state.request++;$('mapPopup').hidden=true;document.querySelectorAll('.route.selected').forEach(el=>{el.classList.remove('selected');const b=el.querySelector('.route-select');if(b){b.textContent='Show this route on map →';b.setAttribute('aria-pressed','false')}});status();updateView();}
 function renderAvoidance(){
  document.dispatchEvent(new CustomEvent('railroam:constraints-change'));
  const restrictions=[...[...state.avoided].map(([key,city])=>({key,city,transfer:false})),...collectSelections().transfers.filter(v=>v.sel).map(v=>({key:cityKey(v.sel),city:v.sel,transfer:true}))];
  $('avoidChips').innerHTML=restrictions.map(({key,city,transfer})=>`<div class="restriction-row"><div><strong>${esc(city.city||city.label)}</strong><button type="button" data-remove-restriction="${esc(key)}" aria-label="Remove restriction for ${esc(city.city||city.label)}">×</button></div><label><input type="checkbox" data-transfer-allowed="${esc(key)}" ${transfer?'checked':''}> Allow a transfer stop</label></div>`).join('');validateForm(false);paint();

 }
 window.RailRoamExplorer={
  reset(){clearTimeout(detailTimer);detailController?.abort();detailKey='';state.routes=[];state.unseenResults=false;state.avoided.clear();state.previousCity=null;state.cityLimit=8;renderAvoidance();resetView();setPanel('plan');updateResultBadge();},
  restrictions:()=>[...[...state.avoided.values()].map(city=>({city,transfer:false})),...collectSelections().transfers.filter(v=>v.sel).map(v=>({city:v.sel,transfer:true}))],
  refreshConstraints:()=>renderAvoidance(),
  setRestriction(city,transfer){const key=cityKey(city);state.avoided.delete(key);document.querySelectorAll('#transferRows .transfer-row').forEach(row=>{if(cityKey(getSelection(row.querySelector('input')))===key)row.remove();});if(transfer)addTransfer(city);else state.avoided.set(key,city);renderAvoidance();},
  setPanel,getCity,operatorFor:resolveOperator,connections:()=>EXPLORER_CONNECTIONS,
  validateAvoidance(form,errors){
   const conflict=[form.start,form.finish,...form.visits.map(v=>v.sel),...form.transfers.map(v=>v.sel)].filter(p=>p&&state.avoided.has(cityKey(p)));
   $('compatAvoid').textContent=conflict.length?'Incompatible with selected cities':'';
   $('compatAvoid').classList.toggle('show',!!conflict.length);
   $('avoidChips').classList.toggle('compat-bad',!!conflict.length);
   conflict.forEach(p=>errors.push(`${p.city||p.label} cannot be selected and avoided. Remove its exclusion or its planner selection.`));
   if(conflict.length){if(form.start&&state.avoided.has(cityKey(form.start)))startInput.classList.add('compat-bad');if(form.finish&&state.avoided.has(cityKey(form.finish)))finishInput.classList.add('compat-bad');document.querySelectorAll('.visit-row,.transfer-row').forEach(row=>{const sel=getSelection(row.querySelector('input'));if(sel&&state.avoided.has(cityKey(sel)))row.classList.add('compat-bad');});}
  },
  cityAvoided(city){return state.avoided.has(cityKey(city));},
  routeAllowed(route){return (!window.RailRoamSleeper||window.RailRoamSleeper.routeAllowed(route))&&!route.analysis.flat.some(({leg})=>[leg.from,leg.to].some(p=>p&&state.avoided.has(cityKey(p))));},
  // Pure predicate exposed for regression checks and future data adapters.
  directService,
  suggestCities(query){const q=norm(query);if(q.length<2)return [];return [...cities.values()].filter(c=>norm(c.city).includes(q)||(CITY_ALIASES[canonicalCityKey(c.city)]||[]).some(a=>norm(a).startsWith(q))).sort((a,b)=>b.importance-a.importance).slice(0,8).map(c=>({...c,type:'PLACE',cityKey:canonicalCityKey(c.city)}));}
 };
 const avoidAc=makeAcInput();$('avoidAddAc').appendChild(avoidAc);const avoidInput=avoidAc.querySelector('input');avoidInput.placeholder='Type a city to avoid';setupAutocomplete(avoidInput);
 function addAvoid(){const sel=getSelection(avoidInput);if(!sel){avoidInput.focus();return;}RailRoamExplorer.setRestriction(sel,false);avoidInput.value='';delete avoidInput.dataset.selection;renderAvoidance();}
 $('addAvoidBtn').onclick=addAvoid;avoidInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&getSelection(avoidInput)){e.preventDefault();addAvoid();}});
 $('avoidChips').onclick=e=>{const b=e.target.closest('[data-remove-restriction]');if(b){state.avoided.delete(b.dataset.removeRestriction);document.querySelectorAll('#transferRows .transfer-row').forEach(row=>{if(cityKey(getSelection(row.querySelector('input')))===b.dataset.removeRestriction)row.remove();});renderAvoidance();}};
 $('avoidChips').onchange=e=>{const input=e.target.closest('[data-transfer-allowed]');if(!input)return;const key=input.dataset.transferAllowed,city=state.avoided.get(key)||collectSelections().transfers.find(v=>v.sel&&cityKey(v.sel)===key)?.sel;if(city)RailRoamExplorer.setRestriction(city,input.checked);};

 // One round-trip control, moved for mobile rather than duplicated.
 const roundTripLabel=$('roundTrip').closest('label'),originalRoundTripHost=roundTripLabel.parentElement,host=document.createElement('div');host.className='roundtrip-mobile-host';host.innerHTML='<label for="roundTrip">Round trip</label>';$('start').closest('.trip-places').before(host);
 function responsive(){host.hidden=false;host.appendChild(roundTripLabel);setPanel(state.view);if(desktop.matches)loadGeography();updateView();}
 document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>setPanel(b.dataset.panel));
 $('helpToggle').onclick=e=>{e.preventDefault();$('workspaceHelp').hidden=!$('workspaceHelp').hidden;};
 document.addEventListener('railroam:selection',()=>requestAnimationFrame(()=>{syncRoundTripFinish();paint();}));
 document.addEventListener('input',()=>requestAnimationFrame(paint));document.addEventListener('change',()=>requestAnimationFrame(paint));
 new MutationObserver(()=>paint()).observe($('visitRows'),{childList:true});
 document.addEventListener('railroam:search',()=>{state.routes=[];state.route=null;state.city=null;state.request++;$('mapPopup').hidden=true;$('resultCount').textContent='';setPanel('results');status('Finding a journey that fits your plans…');paint();});
 document.addEventListener('railroam:error',e=>status(e.detail||'Check your trip details in Results.'));
 document.addEventListener('railroam:results',e=>{
  const previous=state.route,previousKey=previous&&routeSignature(previous);state.routes=e.detail;state.unseenResults=e.detail.length>0&&state.view!=='results';updateResultBadge();
  document.querySelectorAll('[data-route-index]').forEach(el=>{const button=document.createElement('button');button.type='button';button.className='route-select';button.textContent='Show this route on map →';button.setAttribute('aria-pressed','false');el.appendChild(button);});
  if(e.detail.length){const kept=previousKey?e.detail.findIndex(r=>routeSignature(r)===previousKey):-1;selectRoute(kept<0?0:kept,{fit:!previous});}else{state.route=null;paint();status('No itinerary returned. Adjust your trip in the planner.');}
 });
 $('routeList').addEventListener('click',e=>{if(e.target.closest('a,summary,input,select')||e.target.closest('button:not(.route-select)'))return;const card=e.target.closest('[data-route-index]');if(card)selectRoute(+card.dataset.routeIndex);});
 $('mapPopup').onclick=e=>{
  const con=e.target.closest('[data-connection]');if(con){const c=EXPLORER_CONNECTIONS.find(x=>x.id===con.dataset.connection);if(c)connectionDetails(c);return;}
  const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
  if(action==='more-connections'){state.cityLimit=(state.cityLimit||8)+8;cityDetails(state.city);return;}
  if(action==='continue'){const connection=state.connection;if(!connection)return;const city=getCity(connection.destination)||connection.toPlace||connection.leg?.to;if(city)cityDetails({...city,city:city.city||cleanCityFromStation(city.name)});return;}
  if(action==='back'){const previous=popupHistory.pop();if(previous){popping=true;try{if(previous.type==='city')cityDetails(previous.city);else connectionDetails(previous.connection,previous.leg);}finally{popping=false;}}return;}
  if(action==='close'){popupHistory.length=0;popupCurrent=null;closePopup();return;}const c=state.city;if(!c)return;
  if(action==='start'){setSelection(startInput,c);syncRoundTripFinish();}
  if(action==='finish'){if(roundTripBox.checked){roundTripBox.checked=false;applyRoundTripState();}setSelection(finishInput,c);}
  if(action==='visit'&&window.RailRoamCityWishlist){RailRoamCityWishlist.add(c);return;}
  if(action==='visit'&&!collectSelections().visits.some(v=>v.sel&&cityKey(v.sel)===cityKey(c))){addVisit(c);$('visitOptions').open=true;}
  if(action==='avoid'){const k=cityKey(c);if(state.avoided.has(k))state.avoided.delete(k);else RailRoamExplorer.setRestriction(c,false);renderAvoidance();$('avoidOptions').open=true;}
  validateForm(false);cityDetails(c);
 };
 function mapClick(e){
  if(dragMoved)return;
  const city=e.target.closest('[data-city]');if(city){const c=getCity(city.dataset.city)||visibleCities().find(v=>v.k===city.dataset.city)?.c;if(c){if(state.city&&cityKey(state.city)===cityKey(c))closePopup();else cityDetails(c);}return;}
  const l=e.target.closest('[data-leg]');if(l){const leg=state.connection?.itinerary?transitLegs(state.connection.itinerary)[+l.dataset.leg]:state.route?.analysis.flat[+l.dataset.leg]?.leg;if(leg){state.city=null;connectionDetails({from:cleanCityFromStation(leg.from.name),to:cleanCityFromStation(leg.to.name),kind:leg.mode==='FERRY'?'ferry':isNightLeg(leg)?'night':leg.mode==='HIGHSPEED_RAIL'?'highspeed':'day'},leg);}return;}
  const con=e.target.closest('[data-connection]');if(con){const c=EXPLORER_CONNECTIONS.find(x=>x.id===con.dataset.connection);if(c)connectionDetails(c);return;}
  closePopup();
 }
 $('explorerMap').addEventListener('click',mapClick);
 $('explorerMap').addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Escape'){closePopup();return;}
  if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-city]')){e.preventDefault();mapClick(e);return;}
  if(e.key==='+'||e.key==='='){zoom(1.3);e.preventDefault();}if(e.key==='-'){zoom(1/1.3);e.preventDefault();}
  const moves={ArrowLeft:[-50,0],ArrowRight:[50,0],ArrowUp:[0,-50],ArrowDown:[0,50]};if(moves[e.key]){e.preventDefault();state.cx+=moves[e.key][0]/state.zoom;state.cy+=moves[e.key][1]/state.zoom;updateView();}
 });
 function zoom(factor){state.zoom=Math.max(.65,Math.min(256,state.zoom*factor));updateView();}
 $('zoomIn').onclick=()=>zoom(1.3);$('zoomOut').onclick=()=>zoom(1/1.3);$('fitRoute').onclick=fitRoute;if($('clearMap'))$('clearMap').onclick=resetView;
 if($('clearSelection'))$('clearSelection').onclick=closePopup;
 $('explorerMap').addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12);},{passive:false});
 let drag=null,dragMoved=false;
 $('explorerMap').addEventListener('pointerdown',e=>{if(e.button!==0)return;dragMoved=false;drag={x:e.clientX,y:e.clientY,cx:state.cx,cy:state.cy};if(!e.target.closest('[data-city],[data-connection],[data-leg]'))$('explorerMap').setPointerCapture(e.pointerId);});
 $('explorerMap').addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)<5)return;dragMoved=true;$('explorerMap').classList.add('dragging');const b=viewBox(),r=$('explorerMap').getBoundingClientRect();state.cx=drag.cx-dx*b.w/r.width;state.cy=drag.cy-dy*b.h/r.height;updateView();});
 const endDrag=()=>{drag=null;$('explorerMap').classList.remove('dragging');};$('explorerMap').addEventListener('pointerup',endDrag);$('explorerMap').addEventListener('pointercancel',endDrag);window.addEventListener('pointerup',endDrag);
 new MutationObserver(()=>{$('calendarSheet').setAttribute('aria-hidden',String(!$('calendarSheet').classList.contains('open')));}).observe($('calendarSheet'),{attributes:true,attributeFilter:['class']});
 async function loadGeography(){
  if(state.geo)return;state.geo=true;$('geoStatus').textContent='Loading map…';
  const rail=RailGeometry.load().then(()=>true,()=>false);
  const data=await getCountryGeo();
  if(data)$('geography').innerHTML=data.features.filter(f=>f.geometry).map(f=>`<path class="map-country geo-land ${window.RailRoamCoverage?.muted(f)?'coverage-muted':''}" fill="#f5f7f2" stroke="#8198a6" stroke-width="1.25" d="${geometryToPath(f.geometry,(lon,lat)=>project(lon,lat))}" fill-rule="evenodd" vector-effect="non-scaling-stroke" data-country="${esc(f.properties.ADMIN||f.properties.name||'')}"/>`).join('');
  const tracks=await rail;paint();
  if(!data||!tracks){state.geo=false;if(!data)countryGeoPromise=null;$('geoStatus').innerHTML='<button type="button" class="retry-map">Retry map</button>';}else $('geoStatus').textContent='';
 }
 $('geoStatus').onclick=e=>{if(e.target.closest('.retry-map'))loadGeography();};
 desktop.addEventListener('change',responsive);mobile.addEventListener('change',responsive);window.addEventListener('resize',()=>requestAnimationFrame(updateView));responsive();
})();
