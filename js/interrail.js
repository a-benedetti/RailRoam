/* Verified 2026-11-07. Guidance, not live reservation inventory. */
const InterrailInfo=(()=>{
 const companies='https://www.interrail.com/en/plan-your-trip/tips-and-tricks/trains-europe/railway-companies';
 const international='https://www.interrail.com/en/book-reservations/reservation-fees/international-train-reservation-fees';
 const domestic='https://www.interrail.com/en/book-reservations/reservation-fees/domestic-train-reservation-fees';
 const ferries='https://www.interrail.com/en/plan-your-trip/tips-and-tricks/trains-europe/ferries';
 function describe(connection,leg){
  const id=connection.operator,kind=connection.kind,from=canonicalCityKey(connection.origin||connection.from||''),to=canonicalCityKey(connection.destination||connection.to||'');
  const pair=new Set([from,to]),brand=[leg?.agencyName,leg?.displayName,leg?.routeShortName].join(' ');
  const rule=(status,extra,source=companies)=>({status,extra,source});
  if(id==='flixtrain'||/flixtrain/i.test(brand))return rule('Not covered','Separate ticket required');
  if(kind==='ferry'){
   if(id==='tallink')return rule('Discount only','20% off eligible overnight sailings; route and cabin conditions apply','https://www.tallink.com/travelling/interrail-pass-benefit');
   if(id==='stena')return rule('Discount only','Up to 30% off passage; cabins and other charges extra',ferries);
   if(id==='viking')return rule('Discount only',pair.has('tallinn')?'Up to 20% off passage; cabin and meals extra':pair.has('turku')?'Up to 50% off morning sailings; cabin discount up to 20%':'Up to 50% off passage and cabin; meals extra','https://www.sales.vikingline.com/offers/rail/');
   if(['superfast','bluestar','grimaldi'].includes(id))return rule('Passholder benefit','Discounted ticket; route, pass type and extras vary',ferries);
   return rule('Benefit unconfirmed','Separate ticket; check operator for pass offers',ferries);
  }
  if(id==='eurostar'||/eurostar/i.test(brand))return rule('Covered with reservation',pair.has('london')?'Mandatory seat reservation from €35 (2nd class)':'Mandatory passholder reservation; route/class priced',international);
  if(pair.has('sofia')&&pair.has('istanbul'))return rule('Global Pass + reservation','Couchette from €10; 2-bed sleeper €15; single €35 (1st class)','https://www.bdz.bg/en/a/sofia-istanbul-sofia');
  if(id==='nightjet'||/nightjet|\bNJ\b/i.test(brand))return rule('Covered with reservation','Seat, couchette or sleeper supplement; date/cabin priced','https://www.nightjet.com/en/buchung/tarifinformationen/interrail-eurail-paesse');
  if(id==='sleeper')return rule('Covered with reservation','Seat/berth reservation extra; date and accommodation priced',international);
  if(/turistik|touristic/i.test(brand))return rule('Special service — verify','Tourist-train pass acceptance and supplements need checking',companies);
  if(id==='tcdd')return rule('Covered','Mainline/YHT reservation required; sleeping accommodation extra',companies);
  if(id==='cfr')return rule('Covered',kind==='night'?'Couchette/sleeper reservation required; accommodation priced separately':'InterCity/InterRegio reservations required; regional rules vary',companies);
  if(id==='bdz')return rule('Covered','Reservation depends on route and class; first-class fast trains require one',companies);
  if(id==='srb')return rule('Covered',kind==='night'?'Belgrade–Bar seat/berth reservation required; couchette and sleeper extra':'Domestic reservation depends on service',companies);
  if(id==='hz')return rule('Covered',kind==='night'?'Night-train reservation required; berth supplement extra':'Daytime seat reservation generally optional',companies);
  if(id==='zfbh')return rule('Covered','No compulsory seat reservation on listed ZFBH services',companies);
  if(id==='pkp')return rule('Covered',kind==='highspeed'?'EIP reservation and supplement required; book before boarding':['berlin','prague','vienna'].some(city=>pair.has(city))?'International EuroCity reservation required; route-specific fee':'Reservation depends on train; domestic PKP station/website seats from PLN 3','https://www.interrail.com/en/book-reservations/how-do-i-book-seats');
  if(id==='mav'&&kind==='night')return rule('Covered with reservation','EuroNight seat/berth reservation extra; accommodation priced separately',companies);
  if(id==='elron')return rule('Covered','First-class and cross-border reservation conditions vary by service',companies);
  const italy=new Set(['milan','rome','venice','florence','bologna','turin','naples','verona','bolzano','trento']);
  if(id==='oebb'&&(italy.has(from)||italy.has(to)))return rule('Covered + supplement','Italy cross-border supplement: about €10–15; class/route dependent',international);
  if(id==='trenitalia'||/frecciarossa/i.test(brand))return rule('Covered',kind==='highspeed'||/frecciarossa/i.test(brand)?'Frecciarossa seat reservation: €13':'Reservation depends on train; regional usually needs none',domestic);
  if(id==='sncf'||/\bTGV\b/i.test(brand)){
   if(pair.has('barcelona'))return rule('Covered with reservation',pair.has('paris')?'TGV seat reservation: €35':'TGV seat reservation: €25',international);
   const france=new Set(['paris','lyon','marseille','bordeaux','strasbourg','nice','montpellier','toulouse']);
   return rule('Covered',france.has(from)&&france.has(to)?'TGV reservation: €10–20; regional usually needs none':'International reservation required; fee varies',france.has(from)&&france.has(to)?domestic:international);
  }
  if(id==='db'&&pair.has('paris'))return rule('Covered with reservation','France–Germany reservation required; fee varies',international);
  if(id==='db'&&leg?.mode!=='REGIONAL_RAIL'&&leg?.mode!=='SUBURBAN')return rule('Covered','Long-distance seat: €5.50 (2nd) / €6.90 (1st) via DB; usually optional','https://int.bahn.de/en/faq/seat-reservation-in-fv-costs');
  if(id==='renfe')return rule('Covered with reservation','AVE reservation from €10; class/train dependent',domestic);
  if(kind==='night'&&['bdz','cfr','mav','srb','hz','vr','sj'].includes(id))return rule('Covered with reservation','Seat/couchette/sleeper reservation extra; price varies',international);
  if(['db','oebb','cd','sbb','dsb','sncb','sz','vy','cp','pkp','bdz','cfr','mav','hz','srb','zfbh','hellenic','vr','elron','sj','lner'].includes(id))return rule('Covered','Seat reservation may cost extra; compulsory on some services',companies);
  return rule('Coverage unconfirmed','Check the operator and train type',companies);
 }
 return {describe};
})();
