/* Reviewed 7 Nov 2026. Proxy estimates, never operator-specific measurements.
 * UK DESNZ 2026 revised flat workbook, kg CO2e/km incl. fuel supply (WTT).
 * Source row IDs: 25_315_3147 + 26_911_3147 (rail), 4_301_3074 +
 * 26_904_3074 (car), 21_316_3164 + 22_912_3164 (economy air, with RF),
 * 23_318_3188 + 24_914_3188 (foot passenger ferry). */
const RailRoamImpact=(()=>{
 const source='https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026';
 const gdsSource='https://www.gds.earth/index/top-40-cities/',veganSource='https://www.happycow.net/vegtopics/travel/top-vegan-friendly-cities';
 const factors={rail:.03092+.00897,car:.16591+.04399,plane:.12576+.02249,ferry:.01871+.00424};
 const gds={Helsinki:92.94,Gothenburg:91.29,Copenhagen:90.35,Aarhus:90.12,Aalborg:88.24,Glasgow:87.53,Belfast:87.06,Reykjavik:86.59,Tampere:86.35,Lyon:85.88,Bilbao:85.41,Berlin:85.18,Dublin:83.76,Stockholm:83.53,Lucerne:83.06,Barcelona:83.06,Madrid:82.82,Cork:82.59,Milan:80.71,Basel:80.18,Valencia:78.35,Amsterdam:78.35};
 const vegan={London:1,Paris:2,Berlin:3,Barcelona:4,Amsterdam:8,Vienna:9,Madrid:10};
 const esc=s=>escapeHtml(s),link=(url,text)=>`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)} ↗</a>`;
 function valid(p){return p&&p.lat!=null&&p.lon!=null&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon);}
 function km(a,b){return valid(a)&&valid(b)?geoKm(a,b):null;}
 function distance(leg){if(Number(leg.distance)>0)return Number(leg.distance)/1000;const n=km(leg.from,leg.to);return n===null?null:n*1.2;}
 function estimate(legs,stops){if(!legs.length)return null;let total=0,railKm=0;for(const l of legs){const d=distance(l);if(d===null)return null;railKm+=d;total+=d*(l.mode==='FERRY'?factors.ferry:factors.rail);}let direct=0;for(let i=1;i<stops.length;i++){const d=km(stops[i-1],stops[i]);if(d===null)return null;direct+=d;}if(!direct)return null;return {kg:total,km:railKm,plane:direct*factors.plane,car:direct*1.2*factors.car};}
 const amount=n=>n<10?n.toFixed(1):String(Math.round(n));
 function comparison(value,baseline,mode){const delta=baseline-value,pct=Math.round(Math.abs(delta)/baseline*100);return `${pct}% ${delta>=0?'lower':'higher'} than ${mode}`;}
 function html(data,compact=false){if(!data)return '';return `<div class="impact-summary"><strong>≈ ${amount(data.kg)} kg CO₂e / person</strong><span>${comparison(data.kg,data.plane,'flying')} · ${comparison(data.kg,data.car,'a solo car')}</span>${compact?'':`<a class="metric-source" href="${source}" target="_blank" rel="noopener">DESNZ 2026 ↗</a>`}</div>`;}

 function routeData(route){const flat=route.analysis?.flat||[],stops=flat.length?[flat[0].leg.from]:[];for(let i=0;i<flat.length-1;i++)if(route.analysis.boundaries[i]?.type==='visit')stops.push(flat[i].leg.to);if(flat.length)stops.push(flat.at(-1).leg.to);return estimate(flat.map(x=>x.leg),stops);}
 function connection(c,leg){const legs=c.itinerary?transitLegs(c.itinerary):leg?[leg]:null,from=RailRoamExplorer.getCity(c.origin||c.from)||c.fromPlace,to=RailRoamExplorer.getCity(c.destination||c.to)||c.toPlace;const list=legs||[{from,to,mode:c.kind==='ferry'?'FERRY':'LONG_DISTANCE'}];return `<details class="popup-section" open><summary>Impact</summary>${html(estimate(list,[list[0]?.from,list.at(-1)?.to]))}</details>`;}
 function city(city){return window.RailRoamScores?RailRoamScores.cityImpactHtml(city):'';}
 function nightStay(arrival,departure,tz,window={start:appState.sleepStart,end:appState.sleepEnd}){const arr=new Date(arrival),dep=new Date(departure),nights=[];if(!(dep>arr))return null;const last=localDateParts(dep,tz).date;for(let d=addDaysYmd(localDateParts(arr,tz).date,-1);d<=last;d=addDaysYmd(d,1)){const a=extendedLocalDate(d,window.start,tz),b=extendedLocalDate(d,window.end,tz);if(arr<=a&&dep>=b){const date=localDateParts(a,tz).date,midnight=window.start%1440===0;nights.push(midnight?addDaysYmd(date,-1):date);}}return nights.length?{checkIn:nights[0],checkOut:addDaysYmd(nights.at(-1),1),nights:nights.length}:null;}
 function hotelUrl(city,stay){const u=new URL('https://ecobnb.com/s/'+encodeURIComponent(city));u.searchParams.set('checkIn',stay.checkIn);u.searchParams.set('checkOut',stay.checkOut);u.searchParams.set('adults','1');return u.href;}
 function lodging(route){if(route._lodging)return route._lodging;route._sleepWindow={start:appState.sleepStart,end:appState.sleepEnd};const flat=route.analysis.flat;route._lodging=[];for(let i=0;i<flat.length-1;i++){const b=route.analysis.boundaries[i];if(!b?.changed)continue;const stay=nightStay(flat[i].leg.endTime,flat[i+1].leg.startTime,flat[i].leg.to.tz||'Europe/Berlin',route._sleepWindow);if(stay){const place=flat[i].leg.to,endpoint=flat[i].partIndex!==flat[i+1].partIndex?route.parts?.[flat[i].partIndex]?.to:null,known=window.RailRoamExplorer?.getCity(place),nearby=typeof AUTO_HUBS==='undefined'?null:AUTO_HUBS.filter(h=>km(h,place)!==null&&km(h,place)<20).sort((a,b)=>km(a,place)-km(b,place))[0];route._lodging.push({...stay,city:endpoint?.city||known?.city||place.city||nearby?.city||b.city,boundary:i});}}return route._lodging;}
 function hotelHtml(stay){return stay?`<p class="overnight-stay">${link(hotelUrl(stay.city,stay),'Find a greener stay · '+stay.city)}<small>${displayDate(stay.checkIn)} – ${displayDate(stay.checkOut)} · ${stay.nights} night${stay.nights===1?'':'s'} · Ecobnb</small></p>`:'';}
 return {factors,estimate,html,routeData,connection,city,nightStay,hotelUrl,lodging,hotelHtml,destinationScore:name=>gds[name]};
})();
window.RailRoamImpact=RailRoamImpact;
