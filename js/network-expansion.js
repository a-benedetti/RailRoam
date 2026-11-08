/* Regional rail and passenger-ferry catalogue. Dates remain live-feed dependent. */
Object.assign(EXPLORER_OPERATORS,{
 tcdd:{name:'TCDD Taşımacılık',url:'https://ebilet.tcddtasimacilik.gov.tr/',source:'https://www.tcddtasimacilik.gov.tr/',frequency:'Check dates',accommodation:'Seats; couchettes and sleepers on selected overnight trains.'},
 bdz:{name:'BDZ',url:'https://www.bdz.bg/en',source:'https://www.bdz.bg/en/a/sofia-istanbul-sofia',frequency:'Daily',accommodation:'Seats on daytime trains; couchettes and sleepers on Sofia–Istanbul.'},
 cfr:{name:'CFR Călători',url:'https://www.cfrcalatori.ro/en/',source:'https://www.cfrcalatori.ro/en/',frequency:'Check dates',accommodation:'Seats and overnight accommodation depend on service.'},
 mav:{name:'MÁV',url:'https://www.mavcsoport.hu/en',source:'https://www.mavcsoport.hu/en',frequency:'Check dates',accommodation:'Seats; couchettes and sleepers on overnight services.'},
 hz:{name:'HŽPP',url:'https://www.hzpp.hr/en',source:'https://www.hzpp.hr/en',frequency:'Check dates',accommodation:'Seats and overnight accommodation depend on service.'},
 srb:{name:'Srbija Voz',url:'https://srbijavoz.rs/en/',source:'https://srbijavoz.rs/7100-2/',frequency:'Check dates',accommodation:'Seats; couchettes and sleepers on the Bar night train.'},
 zfbh:{name:'ŽFBH',url:'https://www.zfbh.ba/en/',source:'https://www.zfbh.ba/en/',frequency:'Check dates',accommodation:'Seated trains.'},
 hellenic:{name:'Hellenic Train',url:'https://www.hellenictrain.gr/en',source:'https://www.hellenictrain.gr/en',frequency:'Check dates',accommodation:'First and second class, depending on service.'},
 stena:{name:'Stena Line',url:'https://www.stenalinetravel.com/',source:'https://www.stenalinetravel.com/routes',frequency:'Check sailing dates',accommodation:'Foot passengers · seats and cabins; cabin rules vary by sailing.'},
 viking:{name:'Viking Line',url:'https://www.sales.vikingline.com/',source:'https://www.sales.vikingline.com/timetable',frequency:'Check sailing dates',accommodation:'Foot passengers · cabins; mandatory on some sailings.'},
 superfast:{name:'Superfast Ferries',url:'https://www.superfast.com/',source:'https://www.superfast.com/en-gb/special-offers/sail-rail',frequency:'Check sailing dates',accommodation:'Foot passengers · deck, reserved seats and cabins.'},
 bluestar:{name:'Blue Star Ferries',url:'https://www.bluestarferries.com/en-gb',source:'https://www.bluestarferries.com/en-gb',frequency:'Check sailing dates',accommodation:'Foot passengers · seats and cabins, depending on vessel.'},
 grimaldi:{name:'Grimaldi Lines',url:'https://www.grimaldi-lines.com/en/',source:'https://www.grimaldi-lines.com/en/',frequency:'Check sailing dates',accommodation:'Foot passengers · seats and cabins.'},
 turyol:{name:'Turyol',url:'https://www.turyolonline.com/en/ferry-ticket-search',source:'https://www.turyolonline.com/en/ferry-ticket-search',frequency:'Seasonal timetable',accommodation:'Foot passengers; check vessel and luggage rules.'}
});
const EASTERN_CITIES=[
 ['Istanbul',41.0082,28.9784,'Europe/Istanbul',99],['Ankara',39.9334,32.8597,'Europe/Istanbul',88],['Izmir',38.4237,27.1428,'Europe/Istanbul',85],['Eskisehir',39.7667,30.5256,'Europe/Istanbul',73],['Konya',37.8746,32.4932,'Europe/Istanbul',80],['Sivas',39.7477,37.0179,'Europe/Istanbul',67],['Kayseri',38.7225,35.4875,'Europe/Istanbul',72],['Erzincan',39.75,39.5,'Europe/Istanbul',62],['Erzurum',39.9043,41.2679,'Europe/Istanbul',73],['Kars',40.6013,43.0975,'Europe/Istanbul',75],['Denizli',37.7765,29.0864,'Europe/Istanbul',74],['Selcuk',37.9514,27.3685,'Europe/Istanbul',73],['Karaman',37.1811,33.215,'Europe/Istanbul',62],
 ['Sofia',42.6977,23.3219,'Europe/Sofia',86],['Plovdiv',42.1354,24.7453,'Europe/Sofia',80],['Ruse',43.8356,25.9657,'Europe/Sofia',66],['Bucharest',44.4268,26.1025,'Europe/Bucharest',87],['Brasov',45.6579,25.6012,'Europe/Bucharest',79],['Constanta',44.1598,28.6348,'Europe/Bucharest',74],['Sibiu',45.7983,24.1256,'Europe/Bucharest',75],['Belgrade',44.7866,20.4489,'Europe/Belgrade',85],['Novi Sad',45.2671,19.8335,'Europe/Belgrade',73],['Bar',42.0931,19.1003,'Europe/Podgorica',67],['Podgorica',42.4304,19.2594,'Europe/Podgorica',68],['Sarajevo',43.8563,18.4131,'Europe/Sarajevo',81],['Mostar',43.3438,17.8078,'Europe/Sarajevo',78],['Athens',37.9838,23.7275,'Europe/Athens',95],['Thessaloniki',40.6401,22.9444,'Europe/Athens',84],['Split',43.5081,16.4402,'Europe/Zagreb',81],
 ['Helsinki',60.1699,24.9384,'Europe/Helsinki',88],['Turku',60.4518,22.2666,'Europe/Helsinki',76],['Tampere',61.4978,23.761,'Europe/Helsinki',74],['Tallinn',59.437,24.7536,'Europe/Tallinn',85],['Tartu',58.378,26.729,'Europe/Tallinn',70],
 ['Harwich',51.946,1.255,'Europe/London',63],['Hoek van Holland',51.976,4.127,'Europe/Amsterdam',62],['Kiel',54.3233,10.1228,'Europe/Berlin',70],['Ancona',43.6158,13.5189,'Europe/Rome',70],['Bari',41.1171,16.8719,'Europe/Rome',77],['Patras',38.2466,21.7346,'Europe/Athens',72],['Igoumenitsa',39.5034,20.2673,'Europe/Athens',64],['Piraeus',37.9429,23.6469,'Europe/Athens',74],['Rhodes',36.4341,28.2176,'Europe/Athens',80],['Chios',38.3682,26.1367,'Europe/Athens',70],['Cesme',38.3229,26.3057,'Europe/Istanbul',70],['Kos',36.8939,27.288,'Europe/Athens',73],['Bodrum',37.0344,27.4305,'Europe/Istanbul',78],['Samos',37.7548,26.9778,'Europe/Athens',69],['Kusadasi',37.8608,27.2578,'Europe/Istanbul',73],['Civitavecchia',42.0938,11.793,'Europe/Rome',63]
];
EXPLORER_EXTRA_CITIES.push(...EASTERN_CITIES);
EASTERN_CITIES.forEach(([city,,,,importance])=>EXPLORER_IMPORTANCE[city]=importance);
const EASTERN_RAIL_CONNECTIONS=[
 ['Istanbul','Ankara','highspeed','tcdd'],['Istanbul','Eskisehir','highspeed','tcdd'],['Istanbul','Konya','highspeed','tcdd'],['Ankara','Konya','highspeed','tcdd'],['Ankara','Sivas','highspeed','tcdd'],['Konya','Karaman','highspeed','tcdd'],
 ['Ankara','Kars','night','tcdd'],['Ankara','Izmir','night','tcdd'],['Ankara','Kayseri','night','tcdd'],['Sivas','Erzincan','day','tcdd'],['Erzincan','Erzurum','day','tcdd'],['Erzurum','Kars','day','tcdd'],['Izmir','Denizli','day','tcdd'],['Izmir','Selcuk','day','tcdd'],
 ['Sofia','Istanbul','night','bdz'],['Sofia','Plovdiv','day','bdz'],['Sofia','Ruse','day','bdz'],['Bucharest','Ruse','day','cfr'],['Bucharest','Brasov','day','cfr'],['Bucharest','Constanta','day','cfr'],['Bucharest','Sibiu','day','cfr'],['Budapest','Bucharest','night','mav'],['Vienna','Bucharest','night','cfr'],
 ['Belgrade','Novi Sad','day','srb'],['Belgrade','Bar','night','srb'],['Podgorica','Bar','day','srb'],['Sarajevo','Mostar','day','zfbh'],['Athens','Thessaloniki','day','hellenic'],['Zagreb','Split','night','hz'],
 ['Helsinki','Turku','day','vr'],['Helsinki','Tampere','day','vr'],['Tallinn','Tartu','day','elron']
];
Object.assign(EXPLORER_OPERATORS,{vr:{name:'VR',url:'https://www.vr.fi/en',source:'https://www.vr.fi/en',frequency:'Daily',accommodation:'Seats and cabins on selected overnight trains.'},elron:{name:'Elron',url:'https://elron.ee/en',source:'https://elron.ee/en',frequency:'Daily',accommodation:'Seated trains.'}});
for(const [from,to,kind,operator]of EASTERN_RAIL_CONNECTIONS)EXPLORER_CONNECTIONS.push({id:'connection-'+EXPLORER_CONNECTIONS.length,from,to,kind,operator,local:true,...(operator==='tcdd'&&kind==='highspeed'?{frequency:'Typically daily · several departures'}:{})});
const FERRY_CONNECTIONS=[
 ['Harwich','Hoek van Holland','stena',[[1.255,51.946],[1.5,51.94],[2.3,51.95],[3.2,51.98],[4.127,51.976]]],
 ['Kiel','Gothenburg','stena',[[10.1228,54.3233],[10.25,54.5],[11.2,54.7],[11.2,55.1],[11.0,55.7],[11.6,56.3],[11.8,57.5],[11.9,57.68],[11.97,57.7]]],
 ['Stockholm','Helsinki','viking',[[18.07,59.33],[18.4,59.4],[18.9,59.5],[19.35,59.7],[19.94,60.04],[20.5,59.75],[22.5,59.7],[24.5,59.9],[24.96,60.16]]],
 ['Stockholm','Turku','viking',[[18.07,59.33],[18.4,59.4],[18.9,59.5],[19.35,59.7],[19.94,60.04],[20.5,60.05],[21.0,60.1],[21.6,60.3],[22.22,60.43]]],
 ['Helsinki','Tallinn','viking',[[24.96,60.16],[24.98,60.05],[24.85,59.75],[24.76,59.45]]],
 ['Ancona','Patras','superfast',[[13.51,43.62],[14.0,43.5],[16.0,42.5],[18.6,40.5],[19.6,39.6],[20.2,38.3],[21.0,38.2],[21.73,38.23]]],
 ['Bari','Patras','superfast',[[16.87,41.13],[17.6,40.9],[18.6,40.4],[19.6,39.6],[20.2,38.3],[21.0,38.2],[21.73,38.23]]],
 ['Ancona','Igoumenitsa','superfast',[[13.51,43.62],[14.0,43.5],[16.0,42.5],[18.6,40.5],[19.9,39.5],[20.267,39.503]]],
 ['Piraeus','Rhodes','bluestar',[[23.64,37.94],[23.4,37.7],[24.0,37.4],[25.2,37.1],[26.2,36.9],[27.4,36.6],[28.22,36.44]]],
 ['Piraeus','Chios','bluestar',[[23.64,37.94],[23.4,37.7],[23.95,37.5],[24.8,37.7],[25.7,38.0],[26.1,38.05],[26.14,38.37]]],
 ['Chios','Cesme','turyol',[[26.14,38.37],[26.2,38.32],[26.3057,38.3229]]],
 ['Kos','Bodrum','turyol',[[27.288,36.894],[27.35,36.95],[27.4305,37.0344]]],
 ['Samos','Kusadasi','turyol',[[26.98,37.75],[27.05,37.78],[27.16,37.82],[27.2578,37.8608]]],
 ['Barcelona','Civitavecchia','grimaldi',[[2.18,41.35],[3.0,41.0],[6.0,40.9],[8.0,41.15],[9.1,41.32],[9.45,41.30],[10.5,41.5],[11.793,42.094]]]
];
for(const [from,to,operator,geometry]of FERRY_CONNECTIONS)EXPLORER_CONNECTIONS.push({id:'ferry-'+EXPLORER_CONNECTIONS.length,from,to,kind:'ferry',operator,geometry,...(['stena','viking'].includes(operator)?{frequency:'Typically daily'}:{})});
Object.assign(EXPLORER_ROUTE_VIA,{
 'Sofia|Istanbul':['Sofia','Plovdiv',{lat:41.72,lon:26.36},{lat:41.67,lon:26.56},'Istanbul'],
 'Istanbul|Ankara':['Istanbul',{lat:40.76,lon:29.94},'Eskisehir','Ankara'],
 'Istanbul|Konya':['Istanbul',{lat:40.76,lon:29.94},'Eskisehir','Konya'],
 'Ankara|Kars|night':['Ankara','Kayseri','Sivas','Erzincan','Erzurum','Kars'],
 'Ankara|Izmir|night':['Ankara','Eskisehir',{lat:39.65,lon:27.89},'Izmir'],
 'Vienna|Bucharest|night':['Vienna','Budapest',{lat:46.17,lon:21.31},'Brasov','Bucharest']
});
Object.assign(EXPLORER_CITY_GUIDES,{
 Istanbul:['3–5 days','April–June · September–October','History · food · Bosphorus',['Historic peninsula','Bosphorus waterfront','Beyoğlu and Karaköy'],'https://istanbul.goturkiye.com/'],
 Ankara:['1–2 days','April–June · September–October','Museums · capital · history',['Museum of Anatolian Civilizations','Anıtkabir','Ankara Castle'],'https://ankara.goturkiye.com/'],
 Izmir:['2–3 days','April–June · September–October','Coast · food · lively neighbourhoods',['Kordon waterfront','Kemeraltı bazaar','Agora'],'https://izmir.goturkiye.com/'],
 Sofia:['1–2 days','May–September','History · parks · mountain access',['Alexander Nevsky Cathedral','Serdica ruins','Vitosha Boulevard'],'https://www.visitsofia.bg/en/'],
 Athens:['2–4 days','April–June · September–October','Ancient history · food · neighbourhoods',['Acropolis','Acropolis Museum','Plaka and Monastiraki'],'https://www.thisisathens.org/'],
 Bucharest:['2–3 days','April–June · September','Architecture · cafés · museums',['Palace of Parliament','Old Town','Village Museum'],'https://romania.travel/'],
 Kars:['1–2 days','May–September · winter scenery','Rail journey · heritage · landscape',['Kars Castle','Historic streets','Ani archaeological site'],'https://kars.goturkiye.com/']
});
// Additional countries are selectable; the historical SCHENGEN variable is a
// supported-geocoding-country list, not a border or visa-policy assertion.
['gb','ie','rs','ba','me','mk','al','tr','md','ua'].forEach(c=>SCHENGEN.add(c));
Object.assign(CITY_COUNTRY_HINTS,{istanbul:'tr',ankara:'tr',izmir:'tr',konya:'tr',kars:'tr',sofia:'bg',plovdiv:'bg',bucharest:'ro',belgrade:'rs',sarajevo:'ba',podgorica:'me'});
Object.assign(CITY_ALIASES,{istanbul:['İstanbul','Halkalı','Halkali','Istanbul Halkali'],izmir:['İzmir'],eskisehir:['Eskişehir'],cesme:['Çeşme'],selcuk:['Selçuk'],belgrade:['Beograd','Београд'],bucharest:['București','Bucuresti'],sofia:['София'],kars:['Kars']});
const ferryPreference=document.createElement('label');ferryPreference.className='transfer-toggle full';ferryPreference.innerHTML='<input type="checkbox" id="allowFerries" checked><span>Include ferries</span>';document.querySelector('#preferenceOptions .grid').appendChild(ferryPreference);
for(const [city,lat,lon,tz]of EASTERN_CITIES){
 if(!EASTERN_RAIL_CONNECTIONS.some(c=>c[0]===city||c[1]===city)||AUTO_HUBS.some(c=>canonicalCityKey(c.city)===canonicalCityKey(city)))continue;
 AUTO_HUBS.push({type:'PLACE',name:city,label:city,city,cityKey:canonicalCityKey(city),lat,lon,tz});
}
const ferryLegend=document.createElement('span');ferryLegend.innerHTML='<i class="legend-line ferry"></i>Ferry';document.querySelector('.map-legend').appendChild(ferryLegend);
