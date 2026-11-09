function fmtNode(iso,tz){
  return new Intl.DateTimeFormat("en-GB",{timeZone:tz||"UTC",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(iso));
}
function nodeHtml(timeHtml,station,sub=""){
  return `<div class="j-node"><div class="j-time">${timeHtml}</div><div class="j-axis"><div class="j-dot"></div></div>
    <div><div class="j-station">${escapeHtml(station||"")}</div>${sub?`<div class="j-sub">${sub}</div>`:""}</div></div>`;
}

function visitNodeHtml(arrIso,depIso,arrTz,depTz,arrStation,depStation,city,exploreMin,transferMin){
  const query=city+" attractions";
  const url="https://www.tripadvisor.com/Search?q="+encodeURIComponent(query);
  const times=`<div>Arr ${escapeHtml(fmtNode(arrIso,arrTz))}</div><div>Dep ${escapeHtml(fmtNode(depIso,depTz))}</div>`;
  const same=norm(arrStation||"")===norm(depStation||"");
  const stationLine=same
    ? escapeHtml(arrStation||city)
    : `Arrive: ${escapeHtml(arrStation||city)} · Leave: ${escapeHtml(depStation||city)}`;
  const transferNote=transferMin>0 && !same ? ` · ~${escapeHtml(durationText(transferMin*60000))} between stations` : "";
  const sub=`<div class="visit-stations">${stationLine}${transferNote}</div>
    <div class="visit-inline">Visit · ${escapeHtml(visitDurationText(exploreMin))}
    <a href="${url}" target="_blank" rel="noopener">What to see ↗</a> ${window.RailRoamScores?.localGuide(city)||''}</div>`;
  return `<div class="j-node">
    <div class="j-time">${times}</div>
    <div class="j-axis"><div class="j-dot" style="border-color:var(--visit)"></div></div>
    <div><div class="j-station visit-station">${escapeHtml(city)}</div>${sub}</div>
  </div>`;
}

function trainHtml(leg,form){
  const night=isNightLeg(leg);
  const dur=new Date(leg.endTime)-new Date(leg.startTime);
  const badge=trainBrandInfo(leg);
  const badgeHtml=`<span class="train-pill ${badge.nightBrand?"night-brand":""}">${badge.icon} ${escapeHtml(badge.label)}</span>`;
  const title=escapeHtml(trainTitleText(leg,badge)),sleeper=typeof RailRoamSleeper==='undefined'?null:RailRoamSleeper.evidence(leg);
  return `<div class="j-train"><div></div><div class="j-axis"></div>
    <div class="j-train-label ${night?"night-text":""}">${badgeHtml}${night?'<span class="train-moon">🌙</span>':""}${title} · ${escapeHtml(durationText(dur))}${form?.interrailPass&&window.RailRoamFares?'<div class="train-pass-fare">'+escapeHtml(RailRoamFares.legLabel(leg,true))+'</div>':''}${sleeper?.confirmed?`<div class="sleeper-evidence">Sleeping accommodation confirmed${sleeper.source?` · <a href="${escapeHtml(sleeper.source)}" target="_blank" rel="noopener">Details ↗</a>`:''}</div>`:''}</div></div>`;
}
function visitHtml(boundary){
  const url="https://www.tripadvisor.com/Search?q="+encodeURIComponent(boundary.city+" attractions");
  return `<div class="visit-break">
    <div class="visit-title"><span class="visit-icon">🏛️</span><span>${escapeHtml(boundary.city)}</span></div>
    <div class="visit-details">${escapeHtml(visitDurationText(boundary.gapMin))} to explore</div>
    <a class="visit-link" href="${url}" target="_blank" rel="noopener">What to see ↗</a>
  </div>`;
}

function safeCoord(v){const n=Number(v);return Number.isFinite(n)?n:null}

const COUNTRY_GEOJSON_URL="data/countries.geojson?v=20261107g";
let countryGeoPromise=null;
function getCountryGeo(){
  if(!countryGeoPromise){
    countryGeoPromise=(typeof RailRoamAssets==='undefined'?fetch(COUNTRY_GEOJSON_URL).then(r=>{if(!r.ok)throw new Error('Country outlines unavailable');return r.json()}):RailRoamAssets.load('data/countries.geojson','RailRoamCountryData')).then(data=>{if(!Array.isArray(data.features)||!data.features.length)throw new Error('Invalid country outlines');return data;})
      .catch(()=>null);
  }
  return countryGeoPromise;
}
function featureIntersectsBounds(feature,b){
  const bb=feature.bbox;
  if(!bb || bb.length<4) return true;
  return !(bb[2]<b.lon0 || bb[0]>b.lon1 || bb[3]<b.lat0 || bb[1]>b.lat1);
}
function geometryToPath(geometry,project){
  if(!geometry)return "";
  const polys=geometry.type==="Polygon" ? [geometry.coordinates] :
    geometry.type==="MultiPolygon" ? geometry.coordinates : [];
  let d="";
  for(const poly of polys){
    for(const ring of poly){
      ring.forEach(([lon,lat],i)=>{
        const q=project(lon,lat);
        d+=`${i?"L":"M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
      });
      d+="Z";
    }
  }
  return d;
}
async function hydrateRouteMaps(root=document){
  const data=await getCountryGeo();
  if(!data?.features)return;
  root.querySelectorAll("svg.route-map").forEach(svg=>{
    const layer=svg.querySelector(".country-layer");
    if(!layer || layer.dataset.ready==="1")return;
    const b={
      lon0:Number(svg.dataset.lon0),lon1:Number(svg.dataset.lon1),
      lat0:Number(svg.dataset.lat0),lat1:Number(svg.dataset.lat1)
    };
    const [, , W,H]=svg.getAttribute("viewBox").split(/\s+/).map(Number),pad=Number(svg.dataset.pad||12);
    const project=(lon,lat)=>({
      x:pad+(lon-b.lon0)/(b.lon1-b.lon0)*(W-2*pad),
      y:H-pad-(lat-b.lat0)/(b.lat1-b.lat0)*(H-2*pad)
    });
    const paths=data.features
      .filter(f=>featureIntersectsBounds(f,b))
      .map(f=>`<path class="map-country" fill-rule="evenodd" d="${geometryToPath(f.geometry,project)}"/>`)
      .join("");
    layer.innerHTML=paths;
    layer.dataset.ready="1";
  });
}

function routeMapHtml(r,form){
  const A=r.analysis, flat=A.flat;
  const raw=[];
  if(!flat.length)return "";

  const first=flat[0].leg.from||{};
  raw.push({lat:safeCoord(first.lat),lon:safeCoord(first.lon),name:first.name||form.start.city||form.start.label,type:"start"});
  flat.forEach((x,i)=>{
    const p=x.leg.to||{}, b=A.boundaries[i];
    raw.push({
      lat:safeCoord(p.lat), lon:safeCoord(p.lon),
      name:b?.type==="visit" ? b.city : (p.name||""),
      type:b?.type==="visit" ? "visit" : (i===flat.length-1?"end":"transfer")
    });
  });

  const pts=[];
  for(const p of raw){
    const prev=pts[pts.length-1];
    if(prev && ((p.lat!==null&&prev.lat!==null&&Math.abs(p.lat-prev.lat)<1e-5&&Math.abs(p.lon-prev.lon)<1e-5) || norm(p.name)===norm(prev.name))){
      if(p.type==="visit")prev.type="visit";
      if(p.type==="end")prev.type="end";
      continue;
    }
    pts.push(p);
  }

  const W=360,H=220,pad=12;
  const valid=pts.filter(p=>p.lat!==null&&p.lon!==null);

  let LON0=-11,LON1=32,LAT0=35,LAT1=71;
  if(valid.length){
    let minLon=Math.min(...valid.map(p=>p.lon)), maxLon=Math.max(...valid.map(p=>p.lon));
    let minLat=Math.min(...valid.map(p=>p.lat)), maxLat=Math.max(...valid.map(p=>p.lat));

    let lonSpan=Math.max(2.8,maxLon-minLon);
    let latSpan=Math.max(2.8,maxLat-minLat);
    lonSpan*=1.24; latSpan*=1.24;

    const midLat=(minLat+maxLat)/2;
    const cos=Math.max(.45,Math.cos(midLat*Math.PI/180));
    const visualLon=lonSpan*cos;
    const aspect=(W-2*pad)/(H-2*pad);
    if(visualLon<latSpan*aspect) lonSpan=latSpan*aspect/cos;
    else latSpan=visualLon/aspect;

    const midLon=(minLon+maxLon)/2;
    const midY=(minLat+maxLat)/2;
    LON0=midLon-lonSpan/2; LON1=midLon+lonSpan/2;
    LAT0=midY-latSpan/2; LAT1=midY+latSpan/2;
  }

  const project=(lon,lat)=>({
    x:pad+(lon-LON0)/(LON1-LON0)*(W-2*pad),
    y:H-pad-(lat-LAT0)/(LAT1-LAT0)*(H-2*pad)
  });

  const coords=pts.map((p,i)=>{
    if(p.lat===null||p.lon===null){
      return {x:W/2,y:25+(H-50)*(i/Math.max(1,pts.length-1)),...p};
    }
    return {...project(p.lon,p.lat),...p};
  });

  const path=coords.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ");
  const labelPts=coords.filter(p=>p.type==="start"||p.type==="end"||p.type==="visit");

  const dots=coords.map(p=>{
    const cls=p.type==="visit"?"visit":(p.type==="start"||p.type==="end"?"endpoint":"");
    const rr=p.type==="visit"?5.2:(p.type==="start"||p.type==="end"?4.2:3.0);
    return `<circle class="map-dot ${cls}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rr}"/>`;
  }).join("");

  const labels=labelPts.map(p=>{
    const right=p.x<W*0.62, dx=right?7:-7, anchor=right?"start":"end";
    const dy=p.type==="visit"?-7:11;
    const cls=p.type==="visit"?"visit":"endpoint";
    let label=cleanCityFromStation(p.name||"");
    if(label.length>16)label=label.slice(0,15)+"…";
    return `<text class="map-label map-halo ${cls}" x="${(p.x+dx).toFixed(1)}" y="${(p.y+dy).toFixed(1)}" text-anchor="${anchor}">${escapeHtml(label)}</text>`;
  }).join("");

  return `<div class="route-map-wrap">
    <svg class="route-map" viewBox="0 0 ${W} ${H}" data-pad="${pad}" data-lon0="${LON0}" data-lon1="${LON1}" data-lat0="${LAT0}" data-lat1="${LAT1}" role="img" aria-label="Simplified route map">
      <g class="country-layer"></g>
      <path class="map-route" d="${path}"/>
      ${dots}${labels}
    </svg>
  </div>`;
}

function renderOneRoute(r,form,idx){
  const A=r.analysis,flat=A.flat;
  const lodging=window.RailRoamImpact?.lodging(r)||[];
  if(!flat.length)return "";
  const chips=[
    `<span class="chip">${A.nonVisitTransfers} technical transfer${A.nonVisitTransfers===1?"":"s"}</span>`,
    `<span class="chip">${durationText(A.totalMs)} total</span>`,
    A.sleepTransfers?`<span class="chip sleep-warning">🌙 ${A.sleepTransfers} sleep-hour change${A.sleepTransfers===1?"":"s"}</span>`:`<span class="chip night">✓ no sleep-hour changes</span>`,
    A.nightLegs?`<span class="chip night">🌙 ${A.nightLegs} night-train leg${A.nightLegs===1?"":"s"}</span>`:"",
    A.visits.length?`<span class="chip visit">🏛️ ${A.visits.length} visit${A.visits.length===1?"":"s"}</span>`:""
  ].join("");

  let body=nodeHtml(escapeHtml(fmtNode(flat[0].leg.startTime,flat[0].leg.from?.tz)),flat[0].leg.from?.name||form.start.label,"Depart");
  for(let i=0;i<flat.length;i++){
    const leg=flat[i].leg;
    body+=trainHtml(leg,form)+(window.RailRoamScenery?.html(leg)||'');
    if(i===flat.length-1){
      body+=nodeHtml(escapeHtml(fmtNode(leg.endTime,leg.to?.tz)),leg.to?.name||form.finish.label,"Arrive");
      continue;
    }
    const b=A.boundaries[i],next=flat[i+1].leg;
    if(!b.changed){
      // Same-service legs are merged in flattenRoute(), so this is only a defensive fallback.
      continue;
    }else if(b.type==="visit"){
      body+=visitNodeHtml(
        leg.endTime,next.startTime,leg.to?.tz,next.from?.tz,
        leg.to?.name||b.city,next.from?.name||b.city,b.city,
        b.stayMin??b.exploreMin??b.gapMin,b.transferMin||0
      );
    }else{
      const arr=escapeHtml(fmtNode(leg.endTime,leg.to?.tz));
      const dep=escapeHtml(fmtNode(next.startTime,next.from?.tz));
      const station=(leg.to?.name===next.from?.name)?(leg.to?.name||"Connection"):`${leg.to?.name||""} → ${next.from?.name||""}`;
      const warning=b.sleep?`<span class="sleep-warning">Change during sleep hours</span>`:`Change · ${escapeHtml(durationText(b.gapMin*60000))}`;
      body+=nodeHtml(`<div>Arr ${arr}</div><div>Dep ${dep}</div>`,station,warning);
    }
    body+=window.RailRoamImpact?.hotelHtml(lodging.find(s=>s.boundary===i))||'';
  }
  const map=routeMapHtml(r,form);
  const fare=window.RailRoamFares&&(A.fareInfo||RailRoamFares.summary(flat.map(x=>x.leg),!!form.interrailPass));
  const relaxNote="";
  return `<div data-route-index="${idx}" class="route ${r._relaxed?.length?"relaxed-route":""}">
    ${map}
    <div class="route-title"><div><div class="route-heading"><strong>Option ${idx+1}</strong><span class="route-price ${form.interrailPass?'pass-price':''}">${fare?escapeHtml(RailRoamFares.headline(fare)):'≈ €'+Math.round(A.estimatedPrice)}</span></div>
      <div class="route-meta">${escapeHtml(fmtNode(flat[0].leg.startTime,form.start.tz))} → ${escapeHtml(fmtNode(flat[flat.length-1].leg.endTime,form.finish.tz))}</div>${fare?.pass?'<p class="route-fare-note">'+escapeHtml(RailRoamFares.detail(fare))+'</p>':''}</div></div>
    ${window.RailRoamScores?.routeHtml(r)||''}
    ${window.RailRoamImpact?RailRoamImpact.html(RailRoamImpact.routeData(r)):""}
    ${window.RailRoamAccess?.routeHtml(r)||''}
    <div class="chips">${chips}${r._relaxed?.map(x=>`<span class="chip relax-chip">! ${escapeHtml(x)}</span>`).join("")||""}</div>
    ${A.visits.filter(v=>v.endpoint).map(v=>`<p class="endpoint-stay">Stay in ${escapeHtml(v.city)} · ${visitDurationText(v.mins)}</p>`).join('')}
    <div class="route-content"><div class="journey">${body}</div></div>
  </div>`;
}

const resultState={form:null,routes:[],shown:0,depth:0,noMore:false,loadingMore:false};
function mergeRoutes(existing,incoming){
  const map=new Map(existing.map(r=>[routeSignature(r),r]));
  incoming.forEach(r=>{const k=routeSignature(r);if(!map.has(k))map.set(k,r)});
  return [...map.values()].sort(window.RailRoamUnified?.compare||compareRoutes);
}


function optionalVisitCities(route){
 const form=route._form||resultState.form||{},identify=p=>window.RailRoamCityIdentity?RailRoamCityIdentity.key(p):canonicalCityKey(typeof p==='string'?p:p?.city||p?.name||''),excluded=new Set([!form._openEndpoints||form._specifiedStart?form.start:null,!form._openEndpoints||form._specifiedFinish?form.finish:null,...(form.visits||[]).map(v=>v.sel)].filter(Boolean).map(identify));
 const places=[...(route.analysis?.visits||[]).filter(v=>!v.explicit&&!v.endpoint).map(v=>v.city),...(route.analysis?.flat||[]).flatMap(x=>[x.leg.from,x.leg.to])];
 return [...new Set(places.filter(Boolean).map(identify).filter(c=>c&&!excluded.has(c)))];
}
function routeDiversityTokens(route){return new Set(optionalVisitCities(route).map(c=>'c:'+c));}

function routeSimilarity(a,b){const A=routeDiversityTokens(a),B=routeDiversityTokens(b);if(!A.size&&!B.size)return 1;return [...A].filter(x=>B.has(x)).length/Math.max(1,new Set([...A,...B]).size);}
function diverseRoutes(routes,limit){
 if(!routes.length||limit<1)return [];
 const chosen=[routes[0]],remaining=routes.slice(1).map((route,i)=>({route,rank:i+1})),counts=new Map(),mode=resultState.form?.optimize||'balanced';
 const remember=r=>optionalVisitCities(r).forEach(c=>counts.set(c,(counts.get(c)||0)+1));remember(routes[0]);
 while(chosen.length<limit&&remaining.length){let best=0,score=-Infinity;const lowestRank=Math.min(...remaining.map(x=>x.rank)),metric=window.RailRoamScores?.metric,bestMetric=metric&&['sightseeing','impact'].includes(mode)?Math.max(...remaining.map(x=>metric(x.route,mode))):null;
  for(let i=0;i<remaining.length;i++){const {route,rank}=remaining[i];if(rank>lowestRank+24||bestMetric!==null&&metric(route,mode)<bestMetric-.20)continue;
   const first=remaining.find(x=>x.rank===lowestRank).route,A=route.analysis||{},B=first.analysis||{};
   if(mode==='transfers'&&A.trainCount>B.trainCount||mode==='fastest'&&A.totalMs>B.totalMs*1.25||mode==='price'&&metric&&-metric(route,'price')>Math.max(1,-metric(first,'price'))*1.25)continue;
   if(Number.isFinite(A.nonVisitTransfers)&&Number.isFinite(B.nonVisitTransfers)&&A.nonVisitTransfers>B.nonVisitTransfers+1)continue;
   const novelty=1-Math.max(...chosen.map(c=>routeSimilarity(c,route))),repeat=optionalVisitCities(route).reduce((n,c)=>n+Math.pow(counts.get(c)||0,1.7),0),value=novelty*2.5-rank*.02-repeat*.65*(1+.35*(chosen.length-1));if(value>score){score=value;best=i;}}
  const selected=remaining.splice(best,1)[0].route;chosen.push(selected);remember(selected);
 }return chosen;
}

function routeIdeaKey(route){const identify=p=>window.RailRoamCityIdentity?RailRoamCityIdentity.key(p):canonicalCityKey(typeof p==='string'?p:p?.city||cleanCityFromStation(p?.name||'')),path=[];for(const {leg}of route.analysis.flat){for(const p of [leg.from,leg.to]){const k=identify(p);if(path.at(-1)!==k)path.push(k);}}return path.join('>')+'|'+route.analysis.visits.map(v=>identify(v.city)).join('>');}
function orderedIdeas(routes,form){const ranked=window.RailRoamScores?RailRoamScores.rank(routes,form?.optimize||'balanced'):routes;if(form?._strategy==='journey'&&form?.overnightPreference!=='trains')return ranked;const seen=new Set();return ranked.filter(r=>{const key=routeIdeaKey(r);if(seen.has(key))return false;seen.add(key);return true;});}

function renderResults(){
  const root=document.getElementById("routeList"),form=resultState.form;
  if(!resultState.routes.length){
    document.dispatchEvent(new CustomEvent("railroam:results", {detail: []}));
    if(resultState.wishlist){root.innerHTML='<div class="empty"><strong>No complete wishlist trip found.</strong><p>Widen your dates, change a preferred travel date, or remove a connection.</p></div>';return;}
    if(window.RailRoamWishlist?.items().length){root.innerHTML='<div class="empty"><strong>No trip fits these cities and selected trains.</strong><p>Change travel dates, reorder the cities, or turn off strict city order.</p></div>';return;}
    root.innerHTML='<div class="empty"><strong>No matching trip found.</strong><p>Widen your dates, choose an endpoint, or adjust your required stops.</p></div>';
    return;
  }
  const ranked=orderedIdeas(resultState.routes,form),count=Math.min(resultState.shown,ranked.length);resultState.availableCount=ranked.length;
  const selected=form?._strategy==='journey'&&form?.overnightPreference!=='trains'?ranked.slice(0,count):diverseRoutes(ranked,count);
  let html=selected.map((r,i)=>renderOneRoute(r,r._form||form,i)).join("");
  if(resultState.routes.some(r=>r.parts.some(p=>p.itinerary._timetablePartial)))html+='<p class="partial-timetable">Some timetable dates could not be checked.</p>';
  html+=`<div class="more-wrap"><button type="button" id="moreRoutesBtn" class="more-btn">${resultState.noMore&&count>=ranked.length?"No more distinct routes found":"Find more"}</button></div>`;
  root.innerHTML=html;
  document.dispatchEvent(new CustomEvent("railroam:results", {detail: selected}));
  hydrateRouteMaps(root);
  const btn=document.getElementById("moreRoutesBtn");
  if(resultState.noMore&&count>=ranked.length){btn.disabled=true;return}
  btn.onclick=showOneMoreRoute;
}
async function showOneMoreRoute(){
  if(resultState.loadingMore)return;
  if(window.RailRoamWorkflow&&!window.RailRoamWorkflow.canFindMore()){RailRoamExplorer.setPanel('plan');return;}
  if(resultState.shown<(resultState.availableCount??resultState.routes.length)){
    resultState.shown++;
    renderResults();
    return;
  }
  const session=RailRoamSearch.start(resultState.wishlist?'wishlist':'plan');planBtn.disabled=true;
  resultState.loadingMore=true;
  const btn=document.getElementById("moreRoutesBtn");
  if(btn){btn.disabled=true;btn.textContent="Finding another route…"}
  try{
    if(resultState.wishlist){resultState.noMore=true;renderResults();return;}
    resultState.depth++;
    const before=orderedIdeas(resultState.routes,resultState.form).length;
    const previousCityCounts={};for(const r of diverseRoutes(orderedIdeas(resultState.routes,resultState.form),resultState.shown))for(const city of optionalVisitCities(r))previousCityCounts[city]=(previousCityCounts[city]||0)+1;
    const extra=await RailRoamSearch.run((window.RailRoamUnified?.search||liveSearch)({...resultState.form,_previousCityCounts:previousCityCounts,initialPass:false,onProgress:undefined,onProfile:undefined,signal:session.controller.signal},resultState.depth),session);
    if(!RailRoamSearch.isCurrent(session))return;
    resultState.routes=mergeRoutes(resultState.routes,extra);
    if(orderedIdeas(resultState.routes,resultState.form).length>before){
      resultState.shown++;
    }else{
      resultState.noMore=true;
    }
    renderResults();
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent="Try more routes again"}
  }finally{if(RailRoamSearch.finish(session)){resultState.loadingMore=false;planBtn.disabled=false;}}
}

function routeSearchLoaderHtml(){
  const cars=(cls,n)=>`<span class="train-car ${cls}"></span>`.repeat(n);
  return `<div class="route-search-loader">
    <h3>Finding journeys…</h3>
    <p>Checking published timetables.</p>
    <div class="inline-rail-scene" aria-label="Animated trains while routes are loading">
      <div class="inline-track"></div>
      <div class="inline-train t1">${cars("car-bullet",7)}<span class="loco-bullet"></span></div>
      <div class="inline-train t2">${cars("car-industrial",9)}<span class="loco-industrial"></span></div>
      <div class="inline-train t3">${cars("car-steam",8)}<span class="loco-steam"></span></div>
      <div class="inline-train t4">${cars("car-normal",10)}<span class="loco-normal"></span></div>
    </div>
    <p class="loading-tip">${escapeHtml(window.RailRoamTips?.pick()||"A night train can save you a hotel night. Check whether a berth reservation is required.")}</p>
  </div>`;
}
const planBtn=document.getElementById("planBtn");
planBtn.onclick=async()=>{
  const wishlist=false;
  const v=wishlist?{ok:true,data:collectSelections()}:validateForm(true);
  if(!v.ok)return;
  const form=v.data;form._strategy=window.RailRoamStrategy?.classify(form);const session=RailRoamSearch.start(wishlist?'wishlist':'plan');form.signal=session.controller.signal;form.initialPass=true;form.rulesSummary=window.RailRoamRules?.capture(form);resultState.rulesSummary=form.rulesSummary;
  form.onProfile=(phase,ms)=>{session.phases=session.phases||{};session.phases[phase]=Math.round(ms);document.documentElement.dataset.searchPhases=JSON.stringify(session.phases);};
  form.onProgress=routes=>{
    if(!RailRoamSearch.isCurrent(session)||!routes.length)return;
    if(session.relaxedBase)routes.forEach(r=>r._relaxed=routeConstraintViolations(r,session.relaxedBase,r._form||form));
    routes.forEach(r=>r._rulesSummary=form.rulesSummary);
    resultState.form=form;resultState.routes=routes;resultState.shown=Math.min(4,routes.length);
    resultState.depth=0;resultState.wishlist=false;resultState.noMore=false;resultState.loadingMore=true;
    renderResults();const more=document.getElementById('moreRoutesBtn');if(more){more.disabled=true;more.textContent='Looking for more options…';}
    RailRoamSearch.progress?.(session,routes.length);
    if(!session.relaxedBase)planBtn.disabled=false;
  };
  document.dispatchEvent(new CustomEvent("railroam:search"));
  planBtn.disabled=true;planBtn.classList.add("loading");planBtn.classList.remove("success");planBtn.textContent="Searching live trains…";
  document.getElementById("routeList").innerHTML=routeSearchLoaderHtml();window.RailRoamRules?.attach();
  try{
    let routes;
    routes=await RailRoamSearch.run(window.RailRoamUnified?RailRoamUnified.search(form,0):liveSearch(form,0),session);resultState.wishlist=false;
    const strictConstraints=snapshotConstraints();
    if(!routes.length&&!wishlist&&form.start&&form.finish){
      const relaxed=relaxedConstraints(strictConstraints);
      const labels=relaxationLabels(strictConstraints,relaxed);
      document.getElementById("routeList").innerHTML=routeSearchLoaderHtml().replace(
        "Finding journeys…",
        "No exact match — trying a little more flexibility..."
      );window.RailRoamRules?.attach();
      try{
        session.relaxedBase=strictConstraints;
        session.restore=()=>{applyConstraintSnapshot(strictConstraints);renderWindowLabels();};
        applyConstraintSnapshot(relaxed);
        routes=await RailRoamSearch.run((window.RailRoamUnified?RailRoamUnified.search(form,1):liveSearch(form,1)),session);
        routes.forEach(r=>r._relaxed=routeConstraintViolations(r,strictConstraints,form));
      }finally{
        session.restore?.();session.restore=null;session.relaxedBase=null;
      }
    }
    if(!RailRoamSearch.isCurrent(session))return;
    resultState.form=form;
    routes.forEach(r=>r._rulesSummary=form.rulesSummary);
    resultState.routes=routes;
    resultState.shown=Math.min(4,routes.length);
    resultState.depth=0;
    resultState.noMore=!!wishlist;
    resultState.loadingMore=false;
    renderResults();
    planBtn.classList.remove("loading");planBtn.classList.add("success");planBtn.textContent="Routes ready ✓";
    setTimeout(()=>{planBtn.classList.remove("success");planBtn.textContent="Plan trip"},1300);
  }catch(e){
    if(!RailRoamSearch.isCurrent(session))return;
    const message=e.name==='AbortError'?'The timetable request timed out. Retry or narrow your dates.':e.status===422?'The timetable service could not accept these places or dates. Try a different station or narrower dates.':/NetworkError|Failed to fetch|fetch resource|Load failed/i.test(e.message||'')?'The timetable service could not be reached. Please retry.':e.message||String(e);
    document.getElementById("routeList").innerHTML=`<div class="empty"><strong>${/choose|add |window|combination|no published|up to|at most/i.test(message)?'Adjust trip details':'Timetable unavailable'}</strong><p>${escapeHtml(message)}</p></div>`;
    document.dispatchEvent(new CustomEvent('railroam:error',{detail:message}));window.RailRoamRules?.attach();
    planBtn.classList.remove("loading");planBtn.textContent="Try again";
  }finally{if(RailRoamSearch.finish(session))planBtn.disabled=false}
};

["visitCountMin","visitCountMax"].forEach(id=>{
  document.getElementById(id)?.addEventListener("change",()=>validateForm(false));
});

document.addEventListener('railroam:cancel',e=>{resultState.loadingMore=false;document.getElementById('routeList').innerHTML='<div class="empty">Search cancelled.</div>';window.RailRoamExplorer?.setPanel(e.detail);});
