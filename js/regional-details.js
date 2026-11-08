/* Reviewed operator guidance, 7 November 2026. No invented service calendars. */
const REGIONAL_DETAILS={
 cfr:{accommodation:'Regio seats; InterRegio/InterCity first and second class; couchettes and sleeping cars on selected night trains.',notes:'CFR reservations are separate from your pass. Use the operator or an international ticket office for berth reservations.',timetable:'https://bilete.cfrcalatori.ro/en-GB/Itineraries'},
 bdz:{accommodation:'Daytime seats; Turkish couchettes and sleeping cars on Sofia–Halkalı.',notes:'Istanbul trains use Halkalı, outside the historic centre. Allow time for the Marmaray connection and border formalities.',timetable:'https://razpisanie.bdz.bg/en'},
 srb:{accommodation:'Seated domestic services; seats, couchettes and sleeping cars on the Bar overnight service.',notes:'Belgrade–Bar is the main year-round international route. Other international corridors may be suspended; check the operator.',timetable:'https://srbijavoz.rs/en/'},
 hz:{accommodation:'First/second-class seats; night trains may offer couchettes or sleepers.',notes:'Some international coastal trains run only in summer. Night accommodation needs a reservation.',timetable:'https://www.hzpp.hr/en'},
 zfbh:{accommodation:'Talgo seated trains; first and second class where offered.',notes:'Sarajevo–Mostar is a seated journey. Ploče extensions have a separate operating pattern.',timetable:'https://www.zfbh.ba/en/'},
 mav:{accommodation:'InterCity first/second class; couchettes and sleepers on selected EuroNight services.',notes:'InterCity reservations and night accommodation are separate from the pass.',timetable:'https://jegy.mav.hu/'},
 tcdd:{accommodation:'YHT Economy/Business; seated mainline trains; couchettes and sleeping compartments on selected overnight services.',notes:'Doğu Ekspresi and Turistik Doğu Ekspresi are different products. Check the selected train before booking with a pass.',timetable:'https://ebilet.tcddtasimacilik.gov.tr/'},
 pkp:{accommodation:'EIP Pendolino, EIC, IC and TLK: first/second-class seats; selected night trains have couchettes and sleepers.',notes:'EIP requires a reservation and supplement; other PKP reservation rules depend on the selected service.',timetable:'https://ebilet.intercity.pl/'},
 hellenic:{accommodation:'First/second-class seats on InterCity trains; local services vary.',notes:'Check service changes and replacement transport in the official journey planner.',timetable:'https://tickets.hellenictrain.gr/dromologia/'},
 sz:{accommodation:'Regional seats; InterCity/EuroCity first and second class where available.',notes:'Reservations depend on the train; couchette and sleeper accommodation is charged separately.',timetable:'https://potniski.sz.si/en/'},
 vr:{accommodation:'Seated InterCity/Pendolino; private sleeper cabins on overnight services.',notes:'Sleeper cabins require a separate reservation; a pass covers the underlying journey.',timetable:'https://www.vr.fi/en'},
 elron:{accommodation:'Standard class; first class on selected services.',notes:'Check first-class and cross-border reservation conditions with Elron.',timetable:'https://elron.ee/en/soiduinfo/soiduplaanid'}
};
for(const[id,detail]of Object.entries(REGIONAL_DETAILS)){if(EXPLORER_OPERATORS[id])Object.assign(EXPLORER_OPERATORS[id],detail);}
// Current official BDZ timetable. Both directions use local station times.
const sofiaHalkali=EXPLORER_CONNECTIONS.find(c=>c.from==='Sofia'&&c.to==='Istanbul'&&c.kind==='night');
if(sofiaHalkali){sofiaHalkali.serviceUrl='https://www.bdz.bg/en/a/sofia-istanbul-sofia';sofiaHalkali.serviceName='Sofia–Halkalı Express';sofiaHalkali.frequency='Daily';sofiaHalkali.accommodation='Couchettes · 2-bed sleepers · single sleepers (1st class)';sofiaHalkali.calendar={label:'Daily',validFrom:'2026-11-02',validTo:'2026-12-12',weekdays:[0,1,2,3,4,5,6],source:'https://p.bdz.bg/www/s/f/sf-xl-ot-02112026-g-do-12122026-g-1-5518.pdf',directions:{Sofia:{departure:'18:45',arrival:'07:21',arrivalDays:1},Istanbul:{departure:'23:13',arrival:'10:28',arrivalDays:1}}};}
// Joint operation and distinct product families share a single map corridor.
for(const[from,to,kind,operator,name]of [['Berlin','Warsaw','day','pkp','EuroCity'],['Warsaw','Krakow','highspeed','pkp','EIP Pendolino'],['Berlin','Prague','day','cd','EuroCity']]){
 if(!EXPLORER_CONNECTIONS.some(c=>c.from===from&&c.to===to&&c.kind===kind&&c.operator===operator))EXPLORER_CONNECTIONS.push({id:'regional-'+EXPLORER_CONNECTIONS.length,from,to,kind,operator,serviceLabel:name,local:true});
}
EXPLORER_OPERATORS.tallink={name:'Tallink Silja Line',url:'https://www.tallink.com/',timetable:'https://experience.tallinksilja.fi/web/int/routes-and-timetables',source:'https://www.tallink.com/travelling/interrail-pass-benefit',frequency:'See sailing dates',accommodation:'Foot passengers · seats and cabins; cabin rules depend on the sailing.'};
for(const c of [...EXPLORER_CONNECTIONS].filter(c=>c.kind==='ferry'&&c.operator==='viking'))EXPLORER_CONNECTIONS.push({...c,id:'tallink-'+c.id,operator:'tallink',frequency:'See sailing dates'});

for(const c of EXPLORER_CONNECTIONS.filter(c=>[c.from,c.to].includes('Berlin')&&[c.from,c.to].includes('Warsaw')&&['db','pkp'].includes(c.operator))){c.jointGroup='berlin-warsaw-ec';c.serviceLabel='EuroCity';c.accommodation='First and second-class seats.';}

for(const c of EXPLORER_CONNECTIONS.filter(c=>[c.from,c.to].includes('Berlin')&&[c.from,c.to].includes('Prague')&&['db','cd'].includes(c.operator))){c.jointGroup='berlin-prague-ec';c.serviceLabel='EuroCity / ComfortJet';}
