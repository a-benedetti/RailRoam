/* MOTIS v6 wheelchairAccessible reports carriage only, not end-to-end access.
 * Reviewed 7 Nov 2026. Fleet claims require an explicit sourced family match;
 * they never establish exact-service availability or station access. */
const RailRoamAccess=(()=>{
 const esc=escapeHtml,source='https://github.com/motis-project/motis/blob/master/openapi.yaml';
 const assistance={
  db:['DB','https://www.bahn.de/service/individuelle-reise/barrierefrei'],
  oebb:['ÖBB','https://www.oebb.at/en/reiseplanung-services/barrierefrei-reisen'],
  nightjet:['ÖBB','https://www.oebb.at/en/reiseplanung-services/barrierefrei-reisen'],
  eurostar:['Eurostar','https://www.eurostar.com/uk-en/travel-info/travel-planning/accessibility'],
  sncf:['SNCF','https://www.sncf-connect.com/en-en/accessibility/preparation-trip-services'],
  dsb:['DSB','https://www.dsb.dk/hjaelp-og-kontakt/handicapservice/'],
  mav:['MÁV','https://www.mavcsoport.hu/en/mav-szemelyszallitas/introduction/domestic-travels/transport-passengers-reduced-mobility'],
  cd:['ČD','https://www.cd.cz/en/cestovani-zdravotne-hendikepovanych/-41346/'],
  sbb:['SBB','https://www.sbb.ch/en/travel-information/individual-needs/travelling-reduced-mobility/contact-center-handicap.html'],
  cfr:['CFR','https://www.cfrcalatori.ro/en/prm-assistance/','Assistance on selected trains and stations; request the exact journey'],
  bdz:['BDZ','https://www.bdz.bg/en/a/disabled-passengers','A special coach must be requested; confirm the exact service'],
  renfe:['Renfe','https://www.renfe.com/es/en/normativa'],
  trenitalia:['Trenitalia','https://www.trenitalia.com/en/information/passengers-with-disabilities-or-reduced-mobility.html'],
  vr:['VR','https://www.vr.fi/en/facilities-and-services/accessible-train-travel'],
  tallink:['Tallink','https://www.tallink.com/accessibility','Accessible cabins and boarding assistance; confirm the assigned ship'],
  stena:['Stena Line','https://www.stenaline.ie/guides/accessible-travel/onboard-accessibility','Onboard access varies by ship; request assistance when booking'],
  snalltaget:['Snälltåget','https://www.snalltaget.se/en/faq'],
  sj:['SJ','https://www.sj.se/disability','Wheelchair space and assistance can be booked; facilities depend on the train'],
  sleeper:['European Sleeper','https://europeansleeper.freshdesk.com/en/support/solutions/articles/103000052232-can-i-travel-with-a-wheelchair-or-aid-of-assistance-dog-']
 };
 function status(leg){return leg?.wheelchairAccessible==='ACCESSIBLE'?'reported':leg?.wheelchairAccessible==='NOT_ACCESSIBLE'?'unavailable':'unknown';}
 const label=s=>s==='reported'?'Wheelchair carriage reported':s==='unavailable'?'Wheelchair carriage reported unavailable':'Wheelchair carriage not reported';
 function operatorId(leg,id){if(id)return id;const agency=(leg?.agencyUrl||'')+' '+(leg?.agencyName||'');for(const [key,re] of [['snalltaget',/snalltaget|snälltåget/i],['sj',/sj\.se|^SJ$/i],['bdz',/bdz\./i],['cfr',/cfrcalatori/i],['mav',/mavcsoport|m[aá]v/i],['dsb',/\bdsb\b/i],['sbb',/sbb\.ch|\bSBB\b/i],['vr',/vr\.fi/i],['sleeper',/europeansleeper/i]])if(re.test(agency))return key;const op=leg?window.RailRoamExplorer?.operatorFor?.(leg):null;return Object.keys(EXPLORER_OPERATORS).find(k=>EXPLORER_OPERATORS[k]===op);}
 function operator(leg,id){const detected=operatorId(leg,id);if(assistance[detected])return {name:assistance[detected][0],url:assistance[detected][1],note:assistance[detected][2],assistance:true};const catalogue=EXPLORER_OPERATORS[detected],url=catalogue?.url||leg?.agencyUrl;return /^https:\/\//i.test(url||'')?{name:catalogue?.name||leg?.agencyName||'Operator',url,assistance:false}:null;}
 function link(op){return op?`<a href="${esc(op.url)}" target="_blank" rel="noopener">${esc(op.name)} · ${op.assistance?'access & assistance':'contact'} ↗</a>`:'';}
 const families=(window.RailRoamTrainAccess||[]).map(row=>({...row,re:new RegExp(row.match,'i')}));
 function evidence(leg,id){const detected=operatorId(leg,id),text=[leg?.displayName,leg?.routeShortName,leg?.routeLongName,leg?.tripShortName,...(['eurostar','nightjet','sleeper'].includes(detected)?[detected]:[])].filter(Boolean).join(' '),family=families.find(row=>(!row.operators||row.operators.includes(detected))&&row.re.test(text)),feed=status(leg),op=operator(leg,id);return {family,feed,operator:op,documented:!!family&&!family.conditional&&!family.negative,conflict:!!family&&!family.conditional&&(family.negative?feed==='reported':feed==='unavailable')};}
 function legHtml(leg,id){const e=evidence(leg,id),f=e.family,headline=f?f.features:e.feed==='unknown'?'Train-specific facilities: check before booking':label(e.feed);return `<div class="access-leg access-${e.documented?'documented':e.feed}"><span>${esc(headline)}</span>${f?`<small>${esc(f.family)} · <a href="${esc(f.url)}" target="_blank" rel="noopener">Operator documentation ↗</a></small><small>${esc(f.boarding)}</small>`:e.operator?.note?`<small>${esc(e.operator.note)}</small>`:''}${e.conflict?'<small class="access-conflict">Timetable and fleet documentation differ: confirm the exact service.</small>':''}${link(e.operator)}</div>`;}
 function routeHtml(route){const legs=(route.analysis?.flat||[]).map(x=>x.leg),info=legs.map(l=>evidence(l)),documented=info.filter(e=>e.documented||e.feed==='reported'&&!e.family?.negative).length,unavailable=info.filter(e=>e.family?.negative||e.feed==='unavailable'&&!e.documented).length;
  return `<details class="access-section"><summary>Accessibility · ${documented}/${legs.length} trains with wheelchair facilities documented${unavailable?' · '+unavailable+' reported unavailable':''}</summary><ul class="access-trains">${legs.map(l=>`<li><strong>${esc(routeLabel(l))}</strong>${legHtml(l)}</li>`).join('')}</ul><p>Reserve the wheelchair space and assistance required. Station access and transfers remain unverified.</p></details>`;
 }
 function connectionHtml(connection,leg){const legs=leg?[leg]:connection.itinerary?transitLegs(connection.itinerary):[],description={displayName:[connection.serviceName,connection.serviceLabel].filter(Boolean).join(' ')};return `<details class="popup-section access-section"><summary>Accessibility</summary>${legs.length?legs.map(l=>legHtml(l,connection.operator)).join(''):legHtml(description,connection.operator)}<p>Confirm the assigned train, wheelchair space and station assistance.</p></details>`;}
 function cityScore(place){const name=typeof RailRoamCityIdentity==='undefined'?(typeof place==='string'?place:place?.city||place?.name):RailRoamCityIdentity.name(place);return window.RailRoamCityAccessData?.cities?.[name]||null;}
 function cityHtml(place){const c=cityScore(place),p=c||typeof place==='object'&&place,url=p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon)?`https://wheelmap.org/?lat=${Number(p.lat)}&lon=${Number(p.lon)}&zoom=13`:'https://wheelmap.org/',rated=c&&Number.isFinite(c.score),s=c?.stations;return `<details class="popup-section city-access-score"><summary>Accessibility</summary><a href="${esc(url)}" target="_blank" rel="noopener" title="Percentage of rated venues marked fully wheelchair accessible within 5 km · OSM community data${c?' · '+c.fetched.slice(0,10):''}"><span>Wheelchair venue score</span><strong>${rated?c.score.toFixed(0)+'/100':'Unrated'}</strong></a><small>${rated?c.rated.toLocaleString('en-GB')+' rated places · OSM · city centre':'Not enough community ratings'}</small>${s?`<a class="city-score-row station-score" href="${esc(url)}" target="_blank" rel="noopener" title="OSM rail station/halt records within 5 km; not a guarantee of platforms, lifts or boarding assistance"><span>Stations marked accessible</span><strong>${s.yes}<small> / ${s.total}</small></strong></a><small>${s.limited} limited · ${s.no} marked no · ${s.unknown} unreported</small>`:'<small>Station accessibility counts unavailable</small>'}</details>`;}

 return {status,evidence,legHtml,routeHtml,connectionHtml,cityScore,cityHtml,source};
})();
window.RailRoamAccess=RailRoamAccess;
