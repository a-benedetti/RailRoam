/* Editorial exploration data, independent of the planner's tourism scoring.
 * Frequency is a typical published pattern, not a guarantee for a travel date.
 * Source links are exposed in the UI; live departures are always queried separately.
 */
const EXPLORER_OPERATORS = {
 eurostar:{name:'Eurostar',url:'https://www.eurostar.com/',source:'https://www.eurostar.com/uk-en/destinations/routemap',frequency:'Daily · several departures',accommodation:'Standard, Plus and Premier; check the selected service.'},
 db:{name:'Deutsche Bahn',url:'https://int.bahn.de/en',source:'https://www.bahn.de/angebot/urlaub/staedtereisen/direktverbindung-europa',frequency:'Typically daily · times vary',accommodation:'First and second class; reservations depend on service.'},
 sncf:{name:'SNCF',url:'https://www.sncf-connect.com/en-en/',source:'https://www.sncf-connect.com/en-en/train/tgv-inoui',frequency:'Typically daily · times vary',accommodation:'First and second class; reservation required on high-speed services.'},
 trenitalia:{name:'Trenitalia',url:'https://www.trenitalia.com/en.html',source:'https://www.trenitalia.com/en/connections/frecce/frecciarossa.html',frequency:'Daily · several departures',accommodation:'Frecciarossa offers Standard, Premium, Business and Executive; availability varies.'},
 nightjet:{name:'ÖBB Nightjet',url:'https://www.nightjet.com/en/',source:'https://www.nightjet.com/en/reiseziele.html',frequency:'Typically nightly · check operating dates',accommodation:'Seats, couchettes and sleepers, depending on the train. Confirm the carriage type with ÖBB.'},
 sleeper:{name:'European Sleeper',url:'https://www.europeansleeper.eu/',source:'https://www.europeansleeper.eu/modal/train-lines',frequency:'3 nights per week · operating days vary by direction',accommodation:'Seats, couchettes and sleepers; check the selected departure.'},
 oebb:{name:'ÖBB',url:'https://www.oebb.at/en/',source:'https://www.oebb.at/en/fahrplan',frequency:'Typically daily · times vary',accommodation:'Class and reservations vary by service; check with ÖBB.'},
 sj:{name:'SJ',url:'https://www.sj.se/en',source:'https://www.sj.se/en',frequency:'Check operating days with SJ',accommodation:'Seat and sleeping options depend on the service.'},
 renfe:{name:'Renfe',url:'https://www.renfe.com/es/en',source:'https://www.renfe.com/es/en',frequency:'Typically daily · times vary',accommodation:'Class and fare conditions vary by departure.'},
 flixtrain:{name:'FlixTrain',url:'https://www.flixtrain.com/',source:'https://www.flixtrain.com/',frequency:'Check operating days with FlixTrain',accommodation:'Seating and reservation conditions are shown by FlixTrain.'},
 cd:{name:'České dráhy',url:'https://www.cd.cz/en/',source:'https://www.cd.cz/en/',frequency:'Check operating days with České dráhy',accommodation:'Classes and accommodation vary by train.'},
 sbb:{name:'SBB',url:'https://www.sbb.ch/en',source:'https://www.sbb.ch/en',frequency:'Check operating days with SBB',accommodation:'First and second class on many services; verify the selected train.'}
};
const EXPLORER_CONNECTIONS = [
 ['London','Paris','highspeed','eurostar'],['London','Brussels','highspeed','eurostar'],['London','Amsterdam','highspeed','eurostar'],['Paris','Brussels','highspeed','eurostar'],['Paris','Amsterdam','highspeed','eurostar'],['Brussels','Amsterdam','highspeed','eurostar'],['Paris','Cologne','highspeed','eurostar'],
 ['Berlin','Paris','highspeed','db'],['Berlin','Amsterdam','day','db'],['Berlin','Prague','day','db'],['Berlin','Warsaw','day','db'],['Berlin','Vienna','day','db'],['Berlin','Hamburg','highspeed','db'],['Berlin','Munich','highspeed','db'],['Berlin','Frankfurt','highspeed','db'],['Hamburg','Copenhagen','day','db'],['Hamburg','Munich','highspeed','db'],['Frankfurt','Paris','highspeed','db'],['Frankfurt','Amsterdam','highspeed','db'],['Munich','Vienna','day','oebb'],['Munich','Salzburg','day','oebb'],['Prague','Vienna','day','oebb'],['Vienna','Budapest','day','oebb'],['Vienna','Zurich','day','oebb'],['Vienna','Venice','day','oebb'],
 ['Paris','Lyon','highspeed','sncf'],['Paris','Marseille','highspeed','sncf'],['Paris','Bordeaux','highspeed','sncf'],['Paris','Strasbourg','highspeed','sncf'],['Paris','Barcelona','highspeed','sncf'],['Paris','Nice','highspeed','sncf'],['Madrid','Barcelona','highspeed','renfe'],
 ['Milan','Rome','highspeed','trenitalia'],['Milan','Venice','highspeed','trenitalia'],['Milan','Florence','highspeed','trenitalia'],['Rome','Florence','highspeed','trenitalia'],['Rome','Naples','highspeed','trenitalia'],['Venice','Rome','highspeed','trenitalia'],['Turin','Rome','highspeed','trenitalia'],
 ['Hamburg','Vienna','night','nightjet'],['Hamburg','Zurich','night','nightjet'],['Hamburg','Innsbruck','night','nightjet'],['Amsterdam','Vienna','night','nightjet'],['Amsterdam','Zurich','night','nightjet'],['Munich','Rome','night','nightjet'],['Munich','Venice','night','nightjet'],
 ['Brussels','Prague','night','sleeper'],['Amsterdam','Prague','night','sleeper'],['Amsterdam','Berlin','night','sleeper'],['Brussels','Berlin','night','sleeper'],['Stockholm','Copenhagen','day','sj'],['Stockholm','Gothenburg','day','sj']
].map(([from,to,kind,operator],i)=>({id:'connection-'+i,from,to,kind,operator}));
const EXPLORER_CITY_GUIDES = {
 Berlin:['3–4 days','May–September','Creative · history · nightlife',['Museum Island','Reichstag and the government district','East Side Gallery'],'https://www.visitberlin.de/en'],
 Paris:['3–5 days','April–June · September–October','Art · neighbourhoods · cafés',['Louvre and the Seine','Montmartre','Musée d’Orsay'],'https://parisjetaime.com/eng/'],
 London:['3–5 days','April–June · September','Museums · theatre · neighbourhoods',['British Museum','South Bank','West End and Covent Garden'],'https://www.visitlondon.com/'],
 Amsterdam:['2–3 days','April–May · September','Canals · art · cycling',['Rijksmuseum','Canal belt','Jordaan'],'https://www.iamsterdam.com/en'],
 Brussels:['1–2 days','April–June · September','Architecture · food · comics',['Grand-Place','Art Nouveau neighbourhoods','Royal Museums of Fine Arts'],'https://www.visit.brussels/en/visitors'],
 Vienna:['2–4 days','April–June · September–October','Imperial · music · coffeehouses',['Schönbrunn Palace','Kunsthistorisches Museum','Historic centre and coffeehouses'],'https://www.wien.info/en'],
 Prague:['2–3 days','April–June · September','Historic · walkable · atmospheric',['Old Town Square','Prague Castle','Charles Bridge'],'https://prague.eu/en/'],
 Rome:['3–5 days','April–May · September–October','Ancient · lively · food',['Colosseum and Roman Forum','Vatican Museums','Trastevere'],'https://www.turismoroma.it/en'],
 Florence:['2–3 days','April–June · September–October','Renaissance · art · walkable',['Uffizi Gallery','Duomo','Oltrarno'],'https://www.feelflorence.it/en'],
 Venice:['2–3 days','April–May · September–October','Canals · art · slow wandering',['St Mark’s Square','Doge’s Palace','Cannaregio'],'https://www.veneziaunica.it/en'],
 Milan:['1–2 days','April–June · September','Design · fashion · aperitivo',['Duomo','Brera','Navigli'],'https://www.yesmilano.it/en'],
 Barcelona:['3–4 days','April–June · September–October','Architecture · coast · food',['Sagrada Família','Gothic Quarter','Park Güell'],'https://www.barcelonaturisme.com/wv3/en/'],
 Madrid:['2–4 days','April–June · September–October','Art · late nights · plazas',['Prado Museum','Retiro Park','Royal Palace'],'https://www.esmadrid.com/en'],
 Copenhagen:['2–3 days','May–September','Design · harbour · cycling',['Nyhavn and the harbour','Rosenborg Castle','Tivoli Gardens'],'https://www.visitcopenhagen.com/'],
 Stockholm:['2–4 days','May–September','Islands · design · museums',['Gamla Stan','Vasa Museum','Djurgården'],'https://www.visitstockholm.com/'],
 Hamburg:['2–3 days','May–September','Maritime · music · neighbourhoods',['Speicherstadt','Elbphilharmonie','Harbour waterfront'],'https://www.hamburg-travel.com/'],
 Munich:['2–3 days','May–September','Museums · parks · Bavarian culture',['Kunstareal museums','Englischer Garten','Marienplatz'],'https://www.munich.travel/en'],
 Budapest:['2–3 days','April–June · September','Thermal baths · grand avenues · nightlife',['Castle District','Danube riverfront','Thermal baths'],'https://visithungary.com/'],
 Zurich:['1–2 days','May–September','Lake · old town · art',['Lake promenade','Altstadt','Kunsthaus'],'https://www.zuerich.com/en'],
 Warsaw:['2–3 days','May–September','History · parks · contemporary culture',['Old Town','Łazienki Park','POLIN Museum'],'https://warsawtour.pl/en/']
};
const EXPLORER_IMPORTANCE = {London:100,Paris:100,Berlin:100,Rome:99,Madrid:97,Barcelona:97,Vienna:96,Amsterdam:96,Prague:95,Copenhagen:94,Stockholm:93,Brussels:90,Milan:90,Munich:90,Budapest:89,Warsaw:88,Zurich:87,Hamburg:87,Venice:86,Florence:85};
Object.assign(EXPLORER_IMPORTANCE,{Aarhus:80,Gothenburg:81,Bratislava:78,Lyon:82,Marseille:80,Nice:77,Salzburg:77,Krakow:80,Bologna:77,Antwerp:76});

Object.assign(EXPLORER_OPERATORS,{
 dsb:{name:'DSB',url:'https://www.dsb.dk/en/',source:'https://www.dsb.dk/en/',frequency:'Daily',accommodation:'Standard and first class, depending on service.'},
 vy:{name:'Vy',url:'https://www.vy.no/en',source:'https://www.vy.no/en',frequency:'Daily',accommodation:'Seats; sleeper cabins on selected overnight services.'},
 cp:{name:'CP',url:'https://www.cp.pt/passageiros/en',source:'https://www.cp.pt/passageiros/en',frequency:'Daily',accommodation:'Classes vary by service.'},
 lner:{name:'LNER',url:'https://www.lner.co.uk/',source:'https://www.lner.co.uk/',frequency:'Daily',accommodation:'Standard and first class.'},
 pkp:{name:'PKP Intercity',url:'https://www.intercity.pl/en/',source:'https://www.intercity.pl/en/',frequency:'Daily',accommodation:'First and second class on most services.'},
 sz:{name:'Slovenian Railways',url:'https://potniski.sz.si/en/',source:'https://potniski.sz.si/en/',frequency:'Check dates',accommodation:'Classes vary by service.'},
 sncb:{name:'SNCB',url:'https://www.belgiantrain.be/en',source:'https://www.belgiantrain.be/en',frequency:'Daily',accommodation:'First and second class.'}
});
const EXPLORER_EXTRA_CITIES=[
 ['Aalborg',57.0488,9.9217,'Europe/Copenhagen',70],['Randers',56.4607,10.0364,'Europe/Copenhagen',50],['Horsens',55.8607,9.8503,'Europe/Copenhagen',49],['Fredericia',55.5657,9.7526,'Europe/Copenhagen',58],['Odense',55.4038,10.4024,'Europe/Copenhagen',71],['Kolding',55.4904,9.4722,'Europe/Copenhagen',53],['Skanderborg',56.0343,9.9318,'Europe/Copenhagen',46],
 ['Leipzig',51.3397,12.3731,'Europe/Berlin',74],['Bremen',53.0793,8.8017,'Europe/Berlin',72],['Dortmund',51.5136,7.4653,'Europe/Berlin',68],['Stuttgart',48.7758,9.1829,'Europe/Berlin',73],['Freiburg',47.999,7.8421,'Europe/Berlin',68],['Linz',48.3069,14.2858,'Europe/Vienna',65],['Graz',47.0707,15.4395,'Europe/Vienna',70],['Genoa',44.4056,8.9463,'Europe/Rome',73],['Pisa',43.7228,10.4017,'Europe/Rome',72],['Padua',45.4064,11.8768,'Europe/Rome',66],['Rotterdam',51.9244,4.4777,'Europe/Amsterdam',78],['Utrecht',52.0907,5.1214,'Europe/Amsterdam',72],['Ghent',51.0543,3.7174,'Europe/Brussels',73],['Bruges',51.2093,3.2247,'Europe/Brussels',73],['Montpellier',43.6119,3.8772,'Europe/Paris',70],['Toulouse',43.6047,1.4442,'Europe/Paris',75],['Zaragoza',41.6488,-.8891,'Europe/Madrid',68],['Coimbra',40.2033,-8.4103,'Europe/Lisbon',60],['Trondheim',63.4305,10.3951,'Europe/Oslo',72],['Uppsala',59.8586,17.6389,'Europe/Stockholm',64]
];
const EXPLORER_LOCAL_CONNECTIONS=[
 ['Aarhus','Copenhagen','dsb'],['Aarhus','Aalborg','dsb'],['Aarhus','Fredericia','dsb'],['Aarhus','Randers','dsb'],['Aarhus','Horsens','dsb'],['Aarhus','Skanderborg','dsb'],['Aarhus','Odense','dsb'],['Copenhagen','Odense','dsb'],['Copenhagen','Fredericia','dsb'],['Copenhagen','Kolding','dsb'],['Fredericia','Kolding','dsb'],['Fredericia','Horsens','dsb'],['Aalborg','Randers','dsb'],
 ['Lisbon','Porto','cp'],['Lisbon','Coimbra','cp'],['Porto','Coimbra','cp'],['Oslo','Bergen','vy'],['Oslo','Trondheim','vy'],['Edinburgh','London','lner'],['Seville','Madrid','renfe'],['Valencia','Madrid','renfe'],['Zaragoza','Madrid','renfe'],['Zaragoza','Barcelona','renfe'],
 ['Antwerp','Brussels','sncb'],['Ghent','Brussels','sncb'],['Bruges','Brussels','sncb'],['Bruges','Ghent','sncb'],['Rotterdam','Amsterdam','eurostar'],['Utrecht','Amsterdam','db'],['Basel','Zurich','sbb'],['Basel','Paris','sncf'],['Basel','Freiburg','db'],['Geneva','Lyon','sncf'],['Geneva','Zurich','sbb'],
 ['Cologne','Frankfurt','db'],['Cologne','Dortmund','db'],['Dresden','Berlin','db'],['Dresden','Prague','cd'],['Hannover','Berlin','db'],['Hannover','Hamburg','db'],['Bremen','Hamburg','db'],['Leipzig','Berlin','db'],['Nuremberg','Munich','db'],['Stuttgart','Munich','db'],['Stuttgart','Frankfurt','db'],
 ['Bratislava','Vienna','oebb'],['Bratislava','Budapest','oebb'],['Linz','Vienna','oebb'],['Graz','Vienna','oebb'],['Salzburg','Vienna','oebb'],['Innsbruck','Vienna','oebb'],['Innsbruck','Munich','oebb'],['Innsbruck','Salzburg','oebb'],['Krakow','Warsaw','pkp'],['Ljubljana','Vienna','sz'],['Ljubljana','Zagreb','sz'],
 ['Malmo','Copenhagen','sj'],['Malmo','Stockholm','sj'],['Gothenburg','Copenhagen','sj'],['Uppsala','Stockholm','sj'],['Strasbourg','Paris','sncf'],['Strasbourg','Frankfurt','db'],['Bordeaux','Toulouse','sncf'],['Lyon','Marseille','sncf'],['Nice','Marseille','sncf'],['Montpellier','Marseille','sncf'],
 ['Turin','Milan','trenitalia'],['Verona','Venice','trenitalia'],['Verona','Milan','trenitalia'],['Bolzano','Munich','oebb'],['Bolzano','Verona','trenitalia'],['Trento','Bolzano','trenitalia'],['Trento','Verona','trenitalia'],['Bologna','Florence','trenitalia'],['Bologna','Milan','trenitalia'],['Genoa','Milan','trenitalia'],['Pisa','Florence','trenitalia'],['Padua','Venice','trenitalia']
];
for(const [from,to,operator]of EXPLORER_LOCAL_CONNECTIONS){
 if(EXPLORER_CONNECTIONS.some(c=>(c.from===from&&c.to===to)||(c.from===to&&c.to===from)))continue;
 EXPLORER_CONNECTIONS.push({id:'connection-'+EXPLORER_CONNECTIONS.length,from,to,kind:'day',operator,local:true});
}
EXPLORER_CITY_GUIDES.Aarhus=['1–2 days','May–September','Art · waterfront · student life',['ARoS','Den Gamle By','Latin Quarter'],'https://www.visitaarhus.com/'];
// Junction corridors distinguish the railway a service uses from the shortest
// geometric path in the rail graph. Dated itinerary shapes take precedence.
const EXPLORER_ROUTE_VIA={
 'London|Paris':['London',{lat:51.078,lon:1.16},{lat:50.929,lon:1.81},{lat:50.63,lon:3.06},'Paris'],
 'London|Brussels':['London',{lat:51.078,lon:1.16},{lat:50.929,lon:1.81},{lat:50.63,lon:3.06},'Brussels'],
 'London|Amsterdam':['London',{lat:51.078,lon:1.16},{lat:50.929,lon:1.81},'Brussels','Rotterdam','Amsterdam'],
 'Paris|Barcelona':['Paris','Lyon','Montpellier',{lat:42.697,lon:2.895},'Barcelona'],
 'Paris|Nice':['Paris','Lyon','Marseille','Nice'],
 'Berlin|Paris':['Berlin','Frankfurt','Strasbourg','Paris'],
 'Berlin|Munich':['Berlin','Leipzig','Nuremberg','Munich'],
 'Hamburg|Copenhagen':['Hamburg','Kolding','Odense','Copenhagen'],
 'Berlin|Copenhagen':['Berlin','Hamburg','Kolding','Odense','Copenhagen'],
 'Copenhagen|Prague':['Copenhagen','Odense','Kolding','Hamburg','Berlin','Dresden','Prague'],
 'Copenhagen|Bratislava':['Copenhagen','Odense','Kolding','Hamburg','Berlin','Prague',{lat:49.195,lon:16.607},'Bratislava'],
 'Stockholm|Copenhagen':['Stockholm','Malmo','Copenhagen'],
 'Vienna|Zurich':['Vienna','Salzburg','Innsbruck','Zurich'],
 'Vienna|Venice':['Vienna',{lat:46.625,lon:14.307},{lat:46.616,lon:13.847},{lat:46.069,lon:13.234},'Venice'],
 'Milan|Rome':['Milan','Bologna','Florence','Rome'],
 'Venice|Rome':['Venice','Bologna','Florence','Rome'],
 'Turin|Rome':['Turin','Milan','Bologna','Florence','Rome'],
 'Madrid|Barcelona':['Madrid','Zaragoza','Barcelona'],
 'Hamburg|Vienna|night':['Hamburg','Hannover','Nuremberg','Linz','Vienna'],
 'Hamburg|Zurich|night':['Hamburg','Hannover','Frankfurt','Basel','Zurich'],
 'Hamburg|Innsbruck|night':['Hamburg','Hannover','Nuremberg','Munich','Innsbruck'],
 'Amsterdam|Vienna|night':['Amsterdam','Cologne','Frankfurt','Nuremberg','Linz','Vienna'],
 'Amsterdam|Zurich|night':['Amsterdam','Cologne','Basel','Zurich'],
 'Munich|Rome|night':['Munich','Innsbruck','Verona','Bologna','Florence','Rome'],
 'Munich|Venice|night':['Munich','Innsbruck','Verona','Venice'],
 'Brussels|Prague|night':['Brussels','Antwerp','Rotterdam','Amsterdam','Berlin','Dresden','Prague'],
 'Brussels|Berlin|night':['Brussels','Antwerp','Rotterdam','Amsterdam','Berlin'],
 'Amsterdam|Prague|night':['Amsterdam','Berlin','Dresden','Prague']
};
