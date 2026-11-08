/* Indicative 2nd-class Global Pass extras, reviewed 8 November 2026.
 * Never infer that an unpriced reservation is free. Booking fees and the pass
 * purchase price are excluded; dynamic availability is not a live quote. */
const RailRoamFares=(()=>{
 const international='https://www.interrail.com/en/book-reservations/reservation-fees/international-train-reservation-fees',domestic='https://www.interrail.com/en/book-reservations/reservation-fees/domestic-train-reservation-fees',nightSource='https://www.interrail.com/en/book-reservations/reservation-fees/night-train-reservation-fees';
 const countries=new Map();for(const [code,names]of Object.entries({fr:['Lyon','Marseille','Bordeaux','Strasbourg','Nice','Lille','Perpignan','Montpellier','Toulouse','Avignon','Nantes','Rennes'],it:['Bologna','Verona','Bolzano','Trento','Trieste','Bari','Genoa'],de:['Dresden','Frankfurt','Hannover','Leipzig','Stuttgart','Heidelberg','Bremen','Bad Schandau','Dusseldorf','Freiburg','Nuremberg'],at:['Salzburg','Innsbruck','Linz','Graz','Villach'],ch:['Basel','Lucerne','Bern','Lausanne'],gb:['London','Edinburgh','Glasgow'],dk:['Aarhus','Odense','Aalborg'],se:['Gothenburg','Malmo'],es:['Barcelona','Madrid','Seville','Valencia']}))for(const n of names)countries.set(canonicalCityKey(n),code);
 const key=p=>window.RailRoamCityIdentity?RailRoamCityIdentity.key(p):canonicalCityKey(p?.city||cleanCityFromStation(p?.name||'')),country=p=>{const raw=String(p?.country||'').toLowerCase();return /^[a-z]{2}$/.test(raw)?raw:(typeof CITY_COUNTRY_HINTS!=='undefined'?CITY_COUNTRY_HINTS[key(p)]:'')||countries.get(key(p))||'';};

 function rule(leg,connection={}){const name=[leg.agencyName,leg.displayName,leg.routeShortName].filter(Boolean).join(' '),op=window.RailRoamExplorer?.operatorFor?.(leg),id=connection.operator||(typeof EXPLORER_OPERATORS==='undefined'?null:Object.keys(EXPLORER_OPERATORS).find(k=>EXPLORER_OPERATORS[k]===op)),a=country(leg.from),b=country(leg.to),pair=new Set([key(leg.from),key(leg.to)]),kind=leg.mode==='FERRY'?'ferry':isNightLeg(leg)?'night':leg.mode==='HIGHSPEED_RAIL'?'highspeed':'day',guidance=typeof InterrailInfo==='undefined'?{status:'Coverage unconfirmed'}:InterrailInfo.describe({...connection,operator:id,kind,from:key(leg.from),to:key(leg.to)},leg),known=(low,high=low,source=international,basis='Reservation / supplement')=>({known:true,low,high,source,basis}),free=()=>known(0,0,international,'Included; optional seat reservation excluded');
  if(/flixtrain|\bFLX/i.test(name)||id==='flixtrain')return {ticket:true,source:guidance.source,basis:'Separate ticket; not covered'};
  if(kind==='ferry')return {known:false,source:guidance.source,basis:'Ferry discount and extras vary'};
  if(pair.has('sofia')&&pair.has('istanbul'))return known(10,null,nightSource,'Couchette, from');
  if(kind==='night'&&/nightjet|euro.?night|european sleeper|sn[aä]llt[aå]get|\bNJ\b|\bEN\b/i.test(name))return {known:false,source:nightSource,basis:'Night-train reservation not priced'};
  if(/eurostar/i.test(name)||id==='eurostar'){if(pair.has('london'))return known(35);if(pair.has('paris')&&pair.has('brussels'))return known(27);if(pair.has('paris')&&['amsterdam','rotterdam','cologne','dortmund'].some(x=>pair.has(x)))return known(32);if(pair.has('brussels')&&pair.has('amsterdam'))return known(22);return {known:false,source:international,basis:'Passholder fare not priced'};}
  if(/frecciarossa|frecciargento|\bFR\b|\bFA\b/i.test(name)&&id!=='sncf')return known(13,13,domestic);
  if(/frecciabianca|\bFB\b/i.test(name))return known(10,10,domestic);
  if((id==='trenitalia'||/trenitalia/i.test(name))&&a==='it'&&b==='it'&&/\bIC\b|intercity/i.test(name))return known(3,3,domestic);
  if(/\bTGV\b/i.test(name)||id==='sncf'){
   if(/\bTGV\b/i.test(name)&&a==='fr'&&b==='fr')return known(10,20,domestic);
   if(/\bTGV\b/i.test(name)&&pair.has('barcelona'))return known(pair.has('paris')?35:25);
   if(/\bTGV\b/i.test(name)&&pair.has('paris')&&['milan','turin'].some(x=>pair.has(x)))return known(31);
   if(/lyria/i.test(name))return known(29);
  }
  if(pair.has('paris')&&(a==='de'||b==='de')&&/\bICE\b|\bTGV\b/i.test(name))return known(19);
  if(/\bEIP\b/i.test(name)&&a==='pl'&&b==='pl')return known(10,10,domestic);
  if(id==='mav'&&a==='hu'&&b==='hu'&&/\bIC\b|intercity/i.test(name))return known(1.7,2.6,domestic);
  if(id==='cfr'&&a==='ro'&&b==='ro'&&/intercity|interregio|\bIC\b|\bIR\b/i.test(name))return known(1.2,1.2,domestic);
  if((id==='sj'||/\bSJ\b/i.test(name))&&a==='se'&&b==='se'&&(leg.mode==='HIGHSPEED_RAIL'||/X2000|X2\b|SJ 3000/i.test(name)))return known(6.5,6.5,domestic);
  if(/\bAVE\b/i.test(name)&&a==='es'&&b==='es')return known(10,null,domestic,'Reservation, from');
  const local=['REGIONAL_RAIL','SUBURBAN'].includes(leg.mode),ordinaryLocal=['db','oebb','cd','sbb','dsb','sncb','sz'].includes(id);
  if(local&&ordinaryLocal)return free();
  if((/\bICE\b/i.test(name)||id==='db')&&a&&b&&[a,b].every(c=>['de','at','ch','be','nl'].includes(c))){const date=String(leg.startTime).slice(0,10);if((a==='nl'||b==='nl')&&date.slice(0,4)!=='2026'&&date.slice(5)>='06-01'&&date.slice(5)<='08-31')return {known:false,source:international,basis:'Seasonal reservation not confirmed'};if((a==='nl'||b==='nl')&&date>='2026-06-26'&&date<='2026-08-31')return known(5.5);return free();}
  if(/railjet|\bRJX?\b|eurocity express|\bECE\b/i.test(name)){if(a==='it'||b==='it')return {known:false,source:international,basis:'Italy cross-border supplement not priced'};if(a&&b&&[a,b].every(c=>['de','at','ch','cz','hu','dk'].includes(c))){const date=String(leg.startTime).slice(0,10);if(a!==b&&(a==='dk'||b==='dk')&&date.slice(0,4)!=='2026'&&date.slice(5)>='06-01'&&date.slice(5)<='08-31')return {known:false,source:international,basis:'Seasonal reservation not confirmed'};if(a!==b&&(a==='dk'||b==='dk')&&date>='2026-06-26'&&date<='2026-08-31')return known(5.5);return free();}}
  if(id==='sbb'&&a==='ch'&&b==='ch'&&!/glacier|bernina|panoram/i.test(name))return free();
  return {known:false,source:guidance.source||international,basis:/unconfirmed/i.test(guidance.status)?'Pass coverage not confirmed':'Reservation / supplement not priced'};
 }
 function leg(leg,pass=!!appState.interrailPass,connection){const base=baseLegEstimatedFare(leg);if(!pass)return {pass:false,known:true,low:base,high:base,estimate:base,basis:'Ticket estimate'};const r=rule(leg,connection);if(r.ticket)return {...r,pass:true,known:true,low:base,high:base,estimate:base};return {...r,pass:true,estimate:r.known?r.low:base};}
 function summary(legs,pass=!!appState.interrailPass){const rows=legs.map(l=>leg(l,pass)),low=rows.reduce((n,r)=>n+(r.known?r.low:0),0),unknown=rows.filter(r=>!r.known).length,from=rows.some(r=>r.known&&r.high===null),high=from?null:rows.reduce((n,r)=>n+(r.known?r.high:0),0);return {pass,low,high,from,unknown,estimate:rows.reduce((n,r)=>n+r.estimate,0),rows};}
 const money=n=>(Math.round(n*100)/100).toLocaleString('en-GB',{maximumFractionDigits:2});
 function label(info){if(!info.pass)return '≈ €'+Math.round(info.estimate);if(info.unknown)return info.low?'€'+money(info.low)+' + unpriced extras':'Pass extras unpriced';if(info.from)return 'From €'+money(info.low)+' extra';if(info.high>info.low)return '€'+money(info.low)+'–'+money(info.high)+' extra';return (info.low?'≈ €':'€')+money(info.low)+' extra';}
 function legLabel(l,pass=!!appState.interrailPass){const r=leg(l,pass);return r.known?label(summary([l],pass))+' · '+r.basis:r.basis;}
 function headline(info){if(!info.pass)return label(info);if(info.unknown&&!info.low)return '—';if(info.high>info.low&&!info.unknown)return '€'+money(info.low)+'–'+money(info.high);return (info.from?'From €':'≈ €')+money(info.low);}
 function detail(info){if(!info.pass)return '';if(info.unknown)return (info.low?'Known pass fees only. ':'')+'Reservation / supplement prices to confirm for '+info.unknown+' '+(info.unknown===1?'train.':'trains.');return 'With Interrail · '+(info.low?'reservation / supplement estimate; pass cost excluded.':'no mandatory extras identified; pass cost excluded.');}
 return {rule,leg,summary,label,headline,detail,legLabel};
})();
window.RailRoamFares=RailRoamFares;
