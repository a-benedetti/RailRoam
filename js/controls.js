
window.addEventListener("error", function(e){
  const root=document.getElementById("routeList");
  if(root){
    root.innerHTML='<div class="empty"><strong>The planner hit a startup error.</strong><br>'+String(e.message||"Unknown error")+'</div>';
  }
});
const API = "https://api.transitous.org";
const MAX_BEAM = 5;
const MAX_PER_QUERY = 6;

const SCHENGEN = new Set([
  "at","be","bg","hr","cz","dk","ee","fi","fr","de","gr","hu","is","it","lv","li",
  "lt","lu","mt","nl","no","pl","pt","ro","sk","si","es","se","ch"
]);


const CITY_COUNTRY_HINTS = {
  "copenhagen":"dk","paris":"fr","vienna":"at","munich":"de","cologne":"de","nuremberg":"de",
  "prague":"cz","warsaw":"pl","krakow":"pl","cracow":"pl","rome":"it","milan":"it","venice":"it",
  "florence":"it","turin":"it","naples":"it","genoa":"it","gothenburg":"se","malmo":"se",
  "brussels":"be","the hague":"nl","geneva":"ch","lucerne":"ch","lisbon":"pt","seville":"es",
  "cordoba":"es","basle":"ch","antwerp":"be","ghent":"be","bruges":"be","liege":"be",
  "athens":"gr","thessaloniki":"gr","stockholm":"se","oslo":"no","helsinki":"fi","zurich":"ch",
  "hamburg":"de","berlin":"de","amsterdam":"nl","madrid":"es","barcelona":"es","porto":"pt",
  "budapest":"hu","ljubljana":"si","zagreb":"hr","bratislava":"sk","sofia":"bg","bucharest":"ro"
};
const CITY_POPULARITY = {
  "paris":100,"london":100,"rome":99,"barcelona":98,"amsterdam":97,"berlin":97,"madrid":96,
  "vienna":96,"prague":95,"copenhagen":94,"munich":94,"milan":93,"venice":93,"florence":92,
  "lisbon":92,"brussels":91,"stockholm":91,"budapest":90,"zurich":89,"hamburg":89,"oslo":88,
  "warsaw":87,"krakow":87,"salzburg":86,"cologne":86,"geneva":85,"lyon":85,"naples":85,
  "porto":84,"seville":84,"nice":83,"bologna":83,"ljubljana":82,"bratislava":80,"zagreb":80,
  "antwerp":79,"strasbourg":79,"gothenburg":78,"innsbruck":78,"basel":78,"malmo":77,
  "nuremberg":76,"marseille":76,"turin":76,"verona":75,"florence":92,"trento":70
};
function popularityPrior(name){
  const k=canonicalCityKey(name||"");
  return CITY_POPULARITY[k]||0;
}

function expectedCountryForQuery(q){
  const n=norm(q);
  if(CITY_COUNTRY_HINTS[n]) return CITY_COUNTRY_HINTS[n];
  for(const [english] of Object.entries(CITY_ALIASES)){
    if((english===n || (n.length>=3 && english.startsWith(n))) && CITY_COUNTRY_HINTS[english]) return CITY_COUNTRY_HINTS[english];
  }
  return null;
}
function isMetroLikeStop(x){
  const n=String(x?.name||"");
  return /\bmetro\b|\bmétro\b|underground|u-bahn|subway/i.test(n);
}

const CITY_ALIASES = {
  "copenhagen":["København"], "vienna":["Wien"], "munich":["München"],
  "cologne":["Köln"], "nuremberg":["Nürnberg"], "prague":["Praha"],
  "warsaw":["Warszawa"], "cracow":["Kraków"], "krakow":["Kraków"],
  "rome":["Roma"], "milan":["Milano"], "venice":["Venezia"], "florence":["Firenze"],
  "turin":["Torino"], "naples":["Napoli"], "genoa":["Genova"],
  "gothenburg":["Göteborg"], "malmo":["Malmö"], "malmö":["Malmö"],
  "brussels":["Bruxelles","Brussel"], "the hague":["Den Haag"],
  "geneva":["Genève"], "lucerne":["Luzern"], "lisbon":["Lisboa"],
  "seville":["Sevilla"], "cordoba":["Córdoba"], "basle":["Basel"],
  "antwerp":["Antwerpen","Anvers"], "ghent":["Gent","Gand"],
  "bruges":["Brugge"], "liege":["Liège"], "athens":["Αθήνα"],
  "thessaloniki":["Θεσσαλονίκη"]
};
function aliasQueries(q){
  const n=norm(q), out=[q];
  for(const [english,locals] of Object.entries(CITY_ALIASES)){
    if(english===n || (n.length>=3 && english.startsWith(n))) out.push(...locals);
  }
  return [...new Set(out)];
}

function canonicalCityKey(name){
  const n=norm(name);
  if(!n) return "";
  for(const [english,locals] of Object.entries(CITY_ALIASES)){
    if(n===norm(english) || locals.some(x=>n===norm(x))) return norm(english);
  }
  return n;
}



function norm(s){return (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function cityFromMatch(x){
  if(x.type==="PLACE") return x.name;
  let n=String(x.name||"").replace(/\s*\([^)]*\)\s*/g," ").trim();
  n=n.replace(/\b(Hbf|Hauptbahnhof|Central|Centrale|Centraal|Centrál|hl\.n\.|Gare|Station)\b.*$/i,"").trim();
  if(n.includes("-")) n=n.split("-")[0].trim();
  if(n) return n;
  const a=(x.areas||[]).find(a=>a.adminLevel>=7 && a.adminLevel<=9) || (x.areas||[]).find(a=>a.default);
  return a?.name || x.name;
}
function detailFromMatch(x){
  const areas=(x.areas||[]).filter(a=>a.name && a.name!==x.name).slice(0,2).map(a=>a.name);
  const country=x.country ? x.country.toUpperCase() : "";
  return [...areas,country].filter(Boolean).join(", ");
}
function selectionFromMatch(x){
  const city=cityFromMatch(x);
  return {
    type:x.type, id:x.id, name:x.name,
    label:x.type==="PLACE" ? city : x.name,
    lat:x.lat, lon:x.lon, tz:x.tz||"Europe/Copenhagen",
    city, cityKey:norm(city), detail:detailFromMatch(x)
  };
}
function setSelection(input, sel){
  input.value=sel.label;
  input.dataset.selection=JSON.stringify(sel);
  document.dispatchEvent(new CustomEvent("railroam:selection"));
  const st=input.closest(".ac-wrap").querySelector(".status");
  st.textContent="";
  st.className="status ok";

  validateForm(false);
}
function getSelection(input){
  try{return JSON.parse(input.dataset.selection||"null")}catch(e){return null}
}


function canonicalEnglishCity(q){
  const n=norm(q);
  for(const [english,locals] of Object.entries(CITY_ALIASES)){
    if(english===n || english.startsWith(n) || locals.some(x=>norm(x)===n || norm(x).startsWith(n))){
      return english.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
    }
  }
  return null;
}
function startsLikeCity(stopName, forms){
  const n=norm(stopName);
  return forms.some(f=>{
    const x=norm(f);
    return x.length>=3 && (n===x || n.startsWith(x+" ") || n.startsWith(x+"-") || n.startsWith(x+"("));
  });
}
function synthAllStations(q, stops){
  if(stops.length<2) return null;
  const forms=aliasQueries(q);
  const matched=stops.filter(x=>startsLikeCity(x.name,forms));
  let pool=matched;
  if(pool.length<2){
    const hinted=expectedCountryForQuery(q);
    const translated=canonicalEnglishCity(q);
    if(hinted && translated && stops.length>=2) pool=stops;
  }
  if(pool.length<2) return null;

  // Pick the country with the strongest rail presence for this typed city.
  const byCountry=new Map();
  for(const x of pool){
    const c=String(x.country||"").toLowerCase();
    if(!SCHENGEN.has(c)) continue;
    const score=Number(x.score||0)+1;
    if(!byCountry.has(c)) byCountry.set(c,{score:0,stops:[]});
    byCountry.get(c).score+=score;
    byCountry.get(c).stops.push(x);
  }
  if(!byCountry.size) return null;
  const [country,group]=[...byCountry.entries()].sort((a,b)=>b[1].score-a[1].score || b[1].stops.length-a[1].stops.length)[0];
  if(group.stops.length<2) return null;

  const lat=group.stops.reduce((a,x)=>a+Number(x.lat||0),0)/group.stops.length;
  const lon=group.stops.reduce((a,x)=>a+Number(x.lon||0),0)/group.stops.length;
  const english=canonicalEnglishCity(q);
  let city=english;
  if(!city){
    const best=group.stops.slice().sort((a,b)=>(b.score||0)-(a.score||0))[0];
    const raw=best.name.replace(/\s*\([^)]*\)\s*/g," ").trim();
    const first=raw.split(/[-,]/)[0].trim();
    city=first.split(/\s+/).slice(0, Math.max(1,norm(q).split(" ").length)).join(" ");
  }
  city=city || q.trim();
  return {
    type:"PLACE", id:`CITY:${country}:${norm(city)}`, name:city,
    label:city, lat, lon, tz:group.stops[0].tz||"Europe/Copenhagen",
    city, cityKey:norm(city),
    detail:`${group.stops.length} rail stations · ${country.toUpperCase()}`,
    country, popularity:group.score
  };
}

function setupAutocomplete(input,options={}){
  const wrap=input.closest(".ac-wrap"), menu=wrap.querySelector(".ac-menu"), st=wrap.querySelector(".status");
  let timer, controller, rows=[], active=-1;

  const paintActive=()=>{
    menu.querySelectorAll(".ac-item[data-i]").forEach((el,i)=>el.classList.toggle("active",i===active));
    if(active>=0){
      const item=menu.querySelector(`.ac-item[data-i="${active}"]`);
      if(item){
        const top=item.offsetTop,bottom=top+item.offsetHeight;
        if(top<menu.scrollTop)menu.scrollTop=top;
        else if(bottom>menu.scrollTop+menu.clientHeight)menu.scrollTop=bottom-menu.clientHeight;
      }
    }
  };
  const choose=i=>{
    const sel=rows[i];
    if(!sel) return;
    clearTimeout(timer);controller?.abort();
    if(options.onChoose){options.onChoose(sel);rows=[];menu.innerHTML='';}else setSelection(input,sel);
    menu.style.display="none";
    active=-1;
  };
  const renderRows=()=>{
    rows=rows.filter(p=>window.RailRoamCoverage?.selectable(p)!==false);
    if(!rows.length){
      menu.innerHTML='<div class="ac-item"><strong>No rail place found</strong><span>Try another spelling or a nearby station.</span></div>';
    }else{
      menu.innerHTML=rows.map((x,i)=>`<div class="ac-item" data-i="${i}">
        <strong><span class="ac-kind">${x.type==="PLACE"?"CITY":"STATION"}</span>${escapeHtml(x.label)}</strong>
        <span>${escapeHtml(x.detail || x.city)}</span></div>`).join("");
      menu.querySelectorAll(".ac-item[data-i]").forEach(el=>{
        el.addEventListener("pointerdown",e=>{
          e.preventDefault();
          choose(Number(el.dataset.i));
        });
      });
    }
    active=-1; menu.style.display="block";
  };

  input.addEventListener("keydown",e=>{
    if(menu.style.display!=="block" || !rows.length) return;
    if(e.key==="ArrowDown"){e.preventDefault();active=Math.min(rows.length-1,active+1);paintActive()}
    else if(e.key==="ArrowUp"){e.preventDefault();active=active<=0?rows.length-1:active-1;paintActive()}
    else if(e.key==="Enter" && (active>=0||options.onChoose)){e.preventDefault();choose(Math.max(0,active))}
    else if(e.key==="Escape"){menu.style.display="none";active=-1}
  });

  input.addEventListener("input",()=>{
    const existing=options.onChoose?null:getSelection(input);
    if(existing && norm(input.value)===norm(existing.label)) return;
    input.dataset.selection="";
    st.textContent="Choose one of the suggestions";
    st.className="status bad";
    clearTimeout(timer);
    if(controller) controller.abort();
    const q=(options.query?options.query(input.value):input.value).trim();
    rows=[];
    if(['start','finish'].includes(input.id)&&(!q||/^anywhere$/i.test(q))){st.textContent='Anywhere';st.className='status';menu.innerHTML='';menu.style.display='none';validateForm(false);return;}
    if(q.length<2){menu.style.display="none";validateForm(false);return}
    const instant=window.RailRoamExplorer?.suggestCities(q)||[];
    if(instant.length){rows=instant;renderRows();}

    timer=setTimeout(async()=>{
      controller=new AbortController();
      try{
        const qs=aliasQueries(q);
        const responses=await Promise.all(qs.slice(0,4).map(async text=>{
          const u=new URL(API+"/api/v1/geocode");
          u.searchParams.set("text",text);
          u.searchParams.set("type","STOP");
          u.searchParams.set("mode",document.getElementById('allowFerries')?.checked?'HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,REGIONAL_RAIL,SUBURBAN,FERRY':'RAIL');
          u.searchParams.set("language","en");
          u.searchParams.set("numResults","80");
          const r=await fetch(u,{signal:controller.signal});
          if(!r.ok) throw new Error("Station search failed");
          return await r.json();
        }));
        let stops=responses.flat().filter(x=>
          x.type==="STOP" &&
          SCHENGEN.has(String(x.country||"").toLowerCase()) &&
          !isMetroLikeStop(x)
        );
        const dedup=new Map();
        for(const x of stops){
          const key=(x.id||"")+"|"+x.lat+"|"+x.lon;
          if(!dedup.has(key)) dedup.set(key,x);
        }
        stops=[...dedup.values()];

        const qn=norm(q), forms=aliasQueries(q).map(norm);
        const rank=x=>{
          const name=norm(x.name), city=norm(cityFromMatch(x));
          let v=Number(x.score||0);
          const pop=popularityPrior(cityFromMatch(x));
          // Exact textual relevance remains dominant, but famous/important rail cities
          // get a strong tie-break so "Paris" beats obscure Paris-like station names.
          if(forms.some(f=>name===f || city===f)) v+=1000000;
          else if(forms.some(f=>name.startsWith(f)||city.startsWith(f))) v+=120000;
          else if(name.includes(qn)||city.includes(qn)) v+=10000;
          v += pop*650;
          return v;
        };
        stops.sort((a,b)=>rank(b)-rank(a));

        // Choose the most plausible country for the typed city, then prefer its stations.
        const countryWeight=new Map();
        for(const x of stops.filter(x=>startsLikeCity(x.name,aliasQueries(q)))){
          const c=String(x.country||"").toLowerCase();
          countryWeight.set(c,(countryWeight.get(c)||0)+Math.max(1,rank(x)));
        }
        const hintedCountry=expectedCountryForQuery(q);
        const bestCountry=hintedCountry || [...countryWeight.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
        let localStops=bestCountry ? stops.filter(x=>String(x.country||"").toLowerCase()===bestCountry) : stops;
        if(localStops.length<2 && hintedCountry){
          localStops=stops.filter(x=>String(x.country||"").toLowerCase()===hintedCountry);
        }

        const all=synthAllStations(q,localStops);
        const seen=new Set();
        rows=[];
        if(all){rows.push(all);seen.add("PLACE|"+all.cityKey)}
        for(const x of localStops){
          const sel=selectionFromMatch(x);
          // Make station-level city labels use the translated city name when an alias was typed.
          const translated=canonicalEnglishCity(q);
          if(translated && startsLikeCity(x.name,aliasQueries(q))){
            sel.city=translated; sel.cityKey=norm(translated);
          }
          const key="STOP|"+(x.id||sel.label);
          if(seen.has(key)) continue;
          seen.add(key); rows.push(sel);
          if(rows.length>=12) break;
        }
        const known=window.RailRoamExplorer?.suggestCities(q)||[];
        rows=[...known.filter(c=>!rows.some(x=>x.type==='PLACE'&&canonicalCityKey(x.city)===canonicalCityKey(c.city))),...rows].slice(0,12);
        renderRows();
        // If there is one clear exact city match, keep it selected automatically.
        // This prevents a previously valid city from occasionally becoming "typed but unselected".
        const exact=rows.filter(x=>norm(x.label)===qn || norm(x.city)===qn);
        if(!options.manualOnly&&exact.length===1 && exact[0].type==="PLACE"){
          setSelection(input,exact[0]);
          menu.style.display="none";
        }
      }catch(e){
        if(e.name==="AbortError") return;
        const known=window.RailRoamExplorer?.suggestCities(q)||[];
        if(known.length){rows=known;renderRows();return;}
        rows=[];
        menu.innerHTML='<div class="ac-item"><strong>Station search unavailable</strong><span>Check your connection and try again.</span></div>';
        menu.style.display="block";
      }
    },220);
    validateForm(false);
  });

  input.addEventListener("focus",()=>{if(menu.innerHTML.trim())menu.style.display="block"});
  input.addEventListener("blur",()=>setTimeout(()=>menu.style.display="none",180));
}

function makeAcInput(value=""){
  const wrap=document.createElement("div");
  wrap.className="ac-wrap";
  wrap.innerHTML=`<input class="place-input" value="${escapeHtml(value)}" placeholder="Start typing city / station"><div class="ac-menu"></div><div class="status">Choose a suggestion</div>`;
  return wrap;
}

function parseTimeMinutes(raw, allowBlank=false){
  const v=String(raw??"").trim();
  if(!v && allowBlank) return null;
  if(!v) return NaN;
  let h,m;
  if(v.includes(":")){
    const parts=v.split(":");
    if(parts.length!==2) return NaN;
    h=Number(parts[0]||0); m=Number(parts[1]||0);
  }else{
    const digits=v.replace(/\D/g,"");
    if(!digits) return NaN;
    if(digits.length<=2){ h=Number(digits); m=0; }
    else{ h=Number(digits.slice(0,-2)); m=Number(digits.slice(-2)); }
  }
  if(!Number.isInteger(h)||!Number.isInteger(m)||h<0||m<0||m>59) return NaN;
  return h*60+m;
}
function formatMinutes(mins){
  mins=Math.max(0,Math.round(mins));
  return `${Math.floor(mins/60)}:${String(mins%60).padStart(2,"0")}`;
}
function autoColon(input){
  let raw=input.value.replace(/[^\d:]/g,"");
  if(raw.includes(":")){
    const [a,b=""]=raw.split(":");
    input.value=a+":"+b.slice(0,2);
    return;
  }
  const d=raw.replace(/\D/g,"");
  if(d.length<=2){ input.value=d; return; }
  input.value=d.slice(0,-2)+":"+d.slice(-2);
}
function normalizeTimeField(input){
  const m=parseTimeMinutes(input.value, input.dataset.optional==="true");
  if(m===null){
    input.classList.remove("invalid"); return true;
  }
  if(Number.isNaN(m) || m<30){
    input.classList.add("invalid"); return false;
  }
  input.value=formatMinutes(m);
  input.classList.remove("invalid"); return true;
}
function stepTime(input,dir){
  let m=parseTimeMinutes(input.value, input.dataset.optional==="true");
  if(m===null || Number.isNaN(m)) m=30;
  let next;
  if(dir>0){
    next = (Math.floor(m/30)+1)*30;
  }else{
    next = (Math.ceil(m/30)-1)*30;
  }
  next=Math.max(30,next);
  input.value=formatMinutes(next);
  input.classList.remove("invalid");
  input.dispatchEvent(new Event("change",{bubbles:true}));
}
function attachTimeStepper(wrap){
  const input=wrap.querySelector(".time-field");
  input.addEventListener("input",()=>{autoColon(input);input.classList.remove("invalid");validateForm(false)});
  input.addEventListener("blur",()=>{normalizeTimeField(input);validateForm(false)});
  wrap.querySelector(".time-up").onclick=()=>stepTime(input,1);
  wrap.querySelector(".time-down").onclick=()=>stepTime(input,-1);
}
function makeTimeStepper(cls,value="",placeholder=""){
  const wrap=document.createElement("div");
  wrap.className="stepper";
  wrap.innerHTML=`<input class="time-field ${cls}" inputmode="numeric" value="${escapeHtml(value)}" placeholder="${placeholder}" data-optional="true">
    <div class="stepper-buttons">
      <button type="button" class="stepper-btn time-up" aria-label="Increase time">▲</button>
      <button type="button" class="stepper-btn time-down" aria-label="Decrease time">▼</button>
    </div>`;
  attachTimeStepper(wrap);
  return wrap;
}
function setupIntegerStepper(){
  const fields=[...document.querySelectorAll(".city-count-field")];
  const clean=input=>{
    const raw=input.value.trim();
    if(!raw){input.value="";validateForm(false);return}
    let n=parseInt(raw,10);
    if(!Number.isFinite(n)) n=0;
    input.value=String(Math.max(0,n));
    validateForm(false);
  };
  fields.forEach(input=>{
    input.addEventListener("input",()=>{
      input.value=input.value.replace(/[^\d]/g,"");
      validateForm(false);
    });
    input.addEventListener("blur",()=>clean(input));
  });
  document.querySelectorAll(".count-up,.count-down").forEach(btn=>{
    btn.onclick=()=>{
      const input=document.getElementById(btn.dataset.target);
      let n=input.value.trim()==="" ? 0 : (parseInt(input.value,10)||0);
      n += btn.classList.contains("count-up") ? 1 : -1;
      input.value=String(Math.max(0,n));
      validateForm(false);
    };
  });
}

function visitClock(mins){
  mins=Math.max(0,Math.min(1439,Math.round(mins)));
  return `${String(Math.floor(mins/60)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`;
}
function visitWindowHtml(kind,title){
  return `<div class="visit-mini-window">
    <div class="visit-mini-title"><span>${title}</span><span class="visit-mini-value ${kind}-label">00:00 – 23:59</span></div>
    <input type="date" class="visit-date ${kind}-date" aria-label="${title} date">
    <div class="dual-range ${kind}-range">
      <div class="dual-track"></div><div class="dual-fill"></div>
      <button type="button" class="dual-handle dual-start" aria-label="Earliest ${title.toLowerCase()}"></button>
      <button type="button" class="dual-handle dual-end" aria-label="Latest ${title.toLowerCase()}"></button>
    </div>
    <div class="range-ends"><span>00:00</span><span>23:59</span></div>
  </div>`;
}
function addVisit(sel,min="",max="",arriveStart=0,arriveEnd=1439,leaveStart=0,leaveEnd=1439,arriveDate="",leaveDate=""){
  if(!sel)return;
  const row=document.createElement("div"); row.className="visit-row";
  row.dataset.selection=JSON.stringify(sel);
  row.dataset.arriveStart=arriveStart; row.dataset.arriveEnd=arriveEnd;
  row.dataset.leaveStart=leaveStart; row.dataset.leaveEnd=leaveEnd;
  row.dataset.arriveDate=arriveDate||""; row.dataset.leaveDate=leaveDate||"";
  row.innerHTML=`<div class="visit-card-top">
      <div class="visit-city-name">${escapeHtml(sel.city||sel.label)}</div>
      <button type="button" class="remove" aria-label="Remove ${escapeHtml(sel.city||sel.label)}">×</button>
    </div>
    <div class="visit-card-compat"></div>
    <div class="visit-stay-row"></div>
    <div class="visit-time-windows">
      ${visitWindowHtml("visit-arrive","Arrive")}
      ${visitWindowHtml("visit-leave","Leave")}
    </div>`;
  const stay=row.querySelector(".visit-stay-row");
  stay.append(makeTimeStepper("visit-min",min,"Min stay"),makeTimeStepper("visit-max",max,"Max stay"));
  document.getElementById("visitRows").appendChild(row);

  const arriveDateInput=row.querySelector(".visit-arrive-date");
  const leaveDateInput=row.querySelector(".visit-leave-date");
  arriveDateInput.value=arriveDate||"";
  leaveDateInput.value=leaveDate||"";
  [arriveDateInput,leaveDateInput].forEach(el=>{el.min=appState.leaveDate<localYmd(new Date())?localYmd(new Date()):appState.leaveDate;el.max=appState.arriveDate});
  arriveDateInput.onchange=()=>{row.dataset.arriveDate=arriveDateInput.value;validateForm(false)};
  leaveDateInput.onchange=()=>{row.dataset.leaveDate=leaveDateInput.value;validateForm(false)};

  const makeWindow=(kind,a,b)=>{
    const el=row.querySelector(`.${kind}-range`), label=row.querySelector(`.${kind}-label`);
    return createDualRange(el,{
      min:0,max:1439,step:30,autoGap:30,
      getStart:()=>+row.dataset[kind==="visit-arrive"?"arriveStart":"leaveStart"],
      getEnd:()=>+row.dataset[kind==="visit-arrive"?"arriveEnd":"leaveEnd"],
      set:(x,y)=>{
        if(kind==="visit-arrive"){row.dataset.arriveStart=x;row.dataset.arriveEnd=y}
        else{row.dataset.leaveStart=x;row.dataset.leaveEnd=y}
        label.textContent=`${visitClock(x)} – ${visitClock(y)}`;
        validateForm(false);
      },
      onRender:(x,y)=>label.textContent=`${visitClock(x)} – ${visitClock(y)}`
    });
  };
  makeWindow("visit-arrive",arriveStart,arriveEnd);
  makeWindow("visit-leave",leaveStart,leaveEnd);
  row.querySelector(".remove").onclick=()=>{row.remove();validateForm(false)};
  validateForm(false);
}

function addTransfer(sel=null){
  const row=document.createElement("div");row.className="transfer-row";
  const ac=makeAcInput(); row.appendChild(ac);
  const rm=document.createElement("button");rm.type="button";rm.className="remove";rm.textContent="×";row.appendChild(rm);
  document.getElementById("transferRows").appendChild(row);
  const inp=ac.querySelector("input");setupAutocomplete(inp);if(sel)setSelection(inp,sel);
  rm.onclick=()=>{row.remove();validateForm(false)};
}


function nextWeekday(day){
  const d=new Date(); d.setHours(12,0,0,0);
  let add=(day-d.getDay()+7)%7; if(add===0) add=7;
  d.setDate(d.getDate()+add); return d;
}
function ymd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function localDateParts(date,tz){
  const cache=localDateParts.formatters||(localDateParts.formatters=new Map());
  if(!cache.has(tz))cache.set(tz,new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}));
  const f=cache.get(tz);
  const p=Object.fromEntries(f.formatToParts(date).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,minutes:+p.hour*60+(+p.minute)};
}
function displayDate(iso){
  const [y,m,d]=iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(y,m-1,d,12));
}
function clock(mins){
  mins=Math.max(0,Math.min(1439,Math.round(mins)));
  return `${String(Math.floor(mins/60)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`;
}
function extendedClockHtml(mins){
  const day=mins>=1440;
  const base=((Math.round(mins)%1440)+1440)%1440;
  const t=`${String(Math.floor(base/60)).padStart(2,"0")}:${String(base%60).padStart(2,"0")}`;
  return day ? `${t}<span class="ext-next">(+1)</span>` : t;
}
function extendedClockText(mins){
  const base=((Math.round(mins)%1440)+1440)%1440;
  return `${String(Math.floor(base/60)).padStart(2,"0")}:${String(base%60).padStart(2,"0")}`;
}
function addDaysYmd(iso,days){
  const [y,m,d]=iso.split("-").map(Number);
  return localYmd(new Date(y,m-1,d+days,12));
}
function extendedLocalDate(ymd,mins,tz){
  return zonedLocalToDate(addDaysYmd(ymd,Math.floor(mins/1440)),extendedClockText(mins),tz);
}


const fri=nextWeekday(5);

function localYmd(d=new Date()){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function nextFridayYmd(){
  const d=new Date();
  const delta=((5-d.getDay()+7)%7)||7;
  d.setDate(d.getDate()+delta);
  return localYmd(d);
}
function dayAfterYmd(iso){
  const [y,m,d]=iso.split("-").map(Number);
  return localYmd(new Date(y,m-1,d+1,12));
}
const appState={
  leaveDate:nextFridayYmd(),
  arriveDate:dayAfterYmd(nextFridayYmd()),
  leaveStart:6*60, leaveEnd:23*60,
  arriveStart:6*60, arriveEnd:23*60+55,
  visitMin:60, visitMax:8*60,
  sightStart:8*60, sightEnd:22*60, useSightHours:false,
  sleepStart:24*60, sleepEnd:31*60, useSleepHours:true,
  maxNonVisitLayover:90
};appState.maxNonVisitLayover=Math.max(30,appState.maxNonVisitLayover||30);


function createDualRange(el,opts){
  const startH=el.querySelector(".dual-start"),endH=el.querySelector(".dual-end"),fill=el.querySelector(".dual-fill");
  let active=null;
  const clamp=v=>Math.max(opts.min,Math.min(opts.max,v));
  const snap=v=>Math.round((v-opts.min)/opts.step)*opts.step+opts.min;
  const gap=opts.allowEqual?0:opts.step;
  const get=which=>which==="start"?opts.getStart():opts.getEnd();
  const pct=v=>(v-opts.min)/(opts.max-opts.min)*100;
  const render=()=>{
    const a=get("start"),b=get("end");
    startH.style.left=pct(a)+"%";endH.style.left=pct(b)+"%";
    fill.style.left=pct(a)+"%";fill.style.width=(pct(b)-pct(a))+"%";
    [startH,endH].forEach((h,i)=>{h.setAttribute("aria-valuemin",opts.min);h.setAttribute("aria-valuemax",opts.max);h.setAttribute("aria-valuenow",i?b:a)});
    opts.onRender?.(a,b);
  };
  const choose=x=>{
    const r=el.getBoundingClientRect();
    const v=clamp(snap(opts.min+(x-r.left)/r.width*(opts.max-opts.min)));
    const ds=Math.abs(v-get("start")),de=Math.abs(v-get("end"));
    return ds===de&&opts.allowEqual?(v>=get('end')?'end':'start'):ds<=de?"start":"end";
  };
  const move=(which,x)=>{
    const r=el.getBoundingClientRect();
    let v=clamp(snap(opts.min+(x-r.left)/r.width*(opts.max-opts.min)));
    let a=get("start"),b=get("end");
    if(which==="start"){
      a=Math.min(v,b-gap);
    }else{
      b=Math.max(v,a+gap);
    }
    opts.set(a,b,which);
    render();
  };
  [startH,endH].forEach((h,i)=>{
    h.setAttribute("role","slider");
    h.addEventListener("keydown",e=>{
      const which=i===0?"start":"end";
      if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))return;
      e.preventDefault();
      let v=e.key==="Home"?opts.min:e.key==="End"?opts.max:get(which)+(["ArrowRight","ArrowUp"].includes(e.key)?opts.step:-opts.step);
      let a=get("start"),b=get("end");
      if(which==="start")a=Math.max(opts.min,Math.min(v,b-gap));else b=Math.min(opts.max,Math.max(v,a+gap));
      opts.set(a,b,which);render();
    });
    h.addEventListener("pointerdown",e=>{active=i===0?"start":"end";h.setPointerCapture?.(e.pointerId);e.preventDefault()});
  });
  el.addEventListener("pointerdown",e=>{
    if(e.target===startH||e.target===endH)return;
    active=choose(e.clientX);el.setPointerCapture?.(e.pointerId);move(active,e.clientX);e.preventDefault();
  });
  el.addEventListener("pointermove",e=>{if(active){move(active,e.clientX);e.preventDefault()}});
  el.addEventListener("pointerup",()=>active=null);
  el.addEventListener("pointercancel",()=>active=null);
  render();
  return {render};
}

let leaveRangeCtl,arriveRangeCtl,visitRangeCtl,sleepRangeCtl;

const VISIT_STEPS = [
  30, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720,
  1440, 2160, 2880, 3600, 4320, 5760, 7200, 8640, 10080, 14400, 20160, 30240, 40320, 44640
];
function visitStepIndex(mins){
  let best=0,dist=Infinity;
  VISIT_STEPS.forEach((v,i)=>{const d=Math.abs(v-mins);if(d<dist){dist=d;best=i}});
  return best;
}
function formatVisitScale(mins){
  if(mins<1440) return mins===30 ? "0:30" : `${mins/60}h`;
  const d=mins/1440;
  return Number.isInteger(d) ? `${d}d` : `${d.toFixed(1)}d`;
}

function renderWindowLabels(){
  document.getElementById("leaveDateBtn").textContent=displayDate(appState.leaveDate);
  document.getElementById("arriveDateBtn").textContent=displayDate(appState.arriveDate);
  document.getElementById("leaveRangeLabel").innerHTML=`${extendedClockHtml(appState.leaveStart)} - ${extendedClockHtml(appState.leaveEnd)}`;
  document.getElementById("arriveRangeLabel").innerHTML=`${extendedClockHtml(appState.arriveStart)} - ${extendedClockHtml(appState.arriveEnd)}`;
  document.getElementById("visitRangeLabel").textContent=`${formatVisitScale(appState.visitMin)} - ${formatVisitScale(appState.visitMax)}`;
  document.getElementById("sightRangeLabel").textContent=`${clock(appState.sightStart)} - ${clock(appState.sightEnd)}`;
  const sleepClock=m=>clock(m>=1440?m-1440:m);
  document.getElementById("sleepRangeLabel").textContent=`${sleepClock(appState.sleepStart)} - ${sleepClock(appState.sleepEnd)}`;
}

leaveRangeCtl=createDualRange(document.getElementById("leaveRange"),{
  min:0,max:1620,step:5,autoGap:60,
  getStart:()=>appState.leaveStart,getEnd:()=>appState.leaveEnd,
  set:(a,b,which)=>{
    const oldEnd=appState.leaveEnd;
    appState.leaveStart=a; appState.leaveEnd=b;
    if(which==="start" && a>oldEnd) appState.leaveEnd=Math.min(1620,a+60);
    renderWindowLabels();validateForm(false);
  },
  onRender:()=>renderWindowLabels()
});
arriveRangeCtl=createDualRange(document.getElementById("arriveRange"),{
  min:0,max:1620,step:5,autoGap:60,
  getStart:()=>appState.arriveStart,getEnd:()=>appState.arriveEnd,
  set:(a,b,which)=>{
    const oldEnd=appState.arriveEnd;
    appState.arriveStart=a;appState.arriveEnd=b;
    if(which==="start" && a>oldEnd) appState.arriveEnd=Math.min(1620,a+60);
    renderWindowLabels();validateForm(false);
  },
  onRender:()=>renderWindowLabels()
});
visitRangeCtl=createDualRange(document.getElementById("visitRange"),{
  min:0,max:VISIT_STEPS.length-1,step:1,autoGap:1,
  getStart:()=>visitStepIndex(appState.visitMin),
  getEnd:()=>visitStepIndex(appState.visitMax),
  set:(a,b)=>{
    appState.visitDurationCustom=true;
    appState.visitMin=VISIT_STEPS[a];
    appState.visitMax=VISIT_STEPS[b];
    renderWindowLabels();validateForm(false);
  },
  onRender:()=>renderWindowLabels()
});
const sightRangeCtl=createDualRange(document.getElementById("sightRange"),{
  min:0,max:1439,step:30,autoGap:30,
  getStart:()=>appState.sightStart,getEnd:()=>appState.sightEnd,
  set:(a,b)=>{appState.sightStart=a;appState.sightEnd=b;renderWindowLabels();validateForm(false)},
  onRender:()=>renderWindowLabels()
});
sleepRangeCtl=createDualRange(document.getElementById("sleepRange"),{
  min:18*60,max:36*60,step:30,autoGap:30,
  getStart:()=>appState.sleepStart,getEnd:()=>appState.sleepEnd,
  set:(a,b)=>{appState.sleepStart=a;appState.sleepEnd=b;renderWindowLabels();validateForm(false)},
  onRender:()=>renderWindowLabels()
});
renderWindowLabels();
document.getElementById("useSightHours").onchange=e=>{
  appState.useSightHours=e.target.checked;
  document.getElementById("sightHoursCard").classList.toggle("rule-disabled",!e.target.checked);
};
document.getElementById("useSleepHours").onchange=e=>{
  appState.useSleepHours=e.target.checked;
  document.getElementById("sleepHoursCard").classList.toggle("rule-disabled",!e.target.checked);
};
document.getElementById("sightHoursCard").classList.add("rule-disabled");
document.getElementById("sleepHoursCard").classList.toggle("rule-disabled",!appState.useSleepHours);
document.getElementById("useSleepHours").checked=appState.useSleepHours;

const calendarSheet=document.getElementById("calendarSheet"),calGrid=document.getElementById("calGrid"),calTitle=document.getElementById("calTitle");
let calendarTarget="leave",calCursor=new Date(fri.getFullYear(),fri.getMonth(),1,12);
function selectedCalendarDate(){return calendarTarget==="leave"?appState.leaveDate:appState.arriveDate}
function drawCalendar(){
  const y=calCursor.getFullYear(),m=calCursor.getMonth();
  calTitle.textContent=new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric"}).format(calCursor);
  const first=new Date(y,m,1,12), mondayOffset=(first.getDay()+6)%7;
  const start=new Date(y,m,1-mondayOffset,12);
  const today=ymd(new Date());
  let html="";
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const iso=ymd(d),other=d.getMonth()!==m;
    html+=`<button type="button" class="cal-day${other?" other":""}${iso===today?" today":""}${iso===selectedCalendarDate()?" selected":""}" data-date="${iso}" ${iso<today?'disabled':''}>${d.getDate()}</button>`;
  }
  calGrid.innerHTML=html;
  calGrid.querySelectorAll(".cal-day").forEach(btn=>btn.onclick=()=>{
    const iso=btn.dataset.date;if(btn.disabled||iso<localYmd(new Date()))return;
    if(calendarTarget==="leave"){
      appState.leaveDate=iso;

    }else appState.arriveDate=iso;
    renderWindowLabels();validateForm(false);calendarSheet.classList.remove("open");
  });
}
function openCalendar(target){
  calendarTarget=target;
  const iso=target==="leave"?appState.leaveDate:appState.arriveDate;
  const [y,m]=iso.split("-").map(Number);
  calCursor=new Date(y,m-1,1,12);
  drawCalendar();calendarSheet.classList.add("open");calendarSheet.setAttribute("aria-hidden","false");
}
document.getElementById("leaveDateBtn").onclick=()=>openCalendar("leave");
document.getElementById("arriveDateBtn").onclick=()=>openCalendar("arrive");

document.getElementById("calPrev").onclick=()=>{calCursor.setMonth(calCursor.getMonth()-1);drawCalendar()};
document.getElementById("calNext").onclick=()=>{calCursor.setMonth(calCursor.getMonth()+1);drawCalendar()};
document.getElementById("calClose").onclick=()=>calendarSheet.classList.remove("open");
calendarSheet.addEventListener("click",e=>{if(e.target===calendarSheet)calendarSheet.classList.remove("open")});

const startInput=document.getElementById("start"), finishInput=document.getElementById("finish");
startInput.value="";finishInput.value="";startInput.placeholder="Anywhere";finishInput.placeholder="Anywhere";

setupAutocomplete(startInput);setupAutocomplete(finishInput);
const roundTripBox=document.getElementById("roundTrip");
function applyRoundTripState(){
  const on=roundTripBox.checked,wrap=document.getElementById("finishWrap");
  wrap.classList.toggle("roundtrip-disabled",on);
  finishInput.disabled=on;
  document.body.classList.toggle('is-roundtrip',on);
  if(on) syncRoundTripFinish();
  validateForm(false);
}
roundTripBox.addEventListener("change",applyRoundTripState);
roundTripBox.addEventListener("input",applyRoundTripState);
function syncRoundTripFinish(){
  if(!roundTripBox.checked)return;
  const st=getSelection(startInput);
  finishInput.value=st?.label||startInput.value;
  if(st) finishInput.dataset.selection=JSON.stringify(st);
  else delete finishInput.dataset.selection;
}
startInput.addEventListener("input",syncRoundTripFinish);
startInput.addEventListener("change",syncRoundTripFinish);
startInput.addEventListener("blur",()=>setTimeout(syncRoundTripFinish,0));
requestAnimationFrame(applyRoundTripState);

document.getElementById("swapPlacesBtn").onclick=()=>{
  const startSel=getSelection(startInput), finishSel=getSelection(finishInput);
  const startVal=startInput.value, finishVal=finishInput.value;
  const startStatus=startInput.closest(".ac-wrap").querySelector(".status").textContent;
  const finishStatus=finishInput.closest(".ac-wrap").querySelector(".status").textContent;
  if(finishSel) setSelection(startInput, finishSel); else {startInput.value=finishVal; startInput.dataset.selection=""; startInput.closest(".ac-wrap").querySelector(".status").textContent=finishStatus;}
  if(startSel) setSelection(finishInput, startSel); else {finishInput.value=startVal; finishInput.dataset.selection=""; finishInput.closest(".ac-wrap").querySelector(".status").textContent=startStatus;}
  validateForm(false);
};
const visitAddHost=document.getElementById("visitAddAc");
const visitAddAc=makeAcInput();
visitAddHost.appendChild(visitAddAc);
const visitAddInput=visitAddAc.querySelector("input");
visitAddInput.placeholder="Type a city to visit";
setupAutocomplete(visitAddInput,{manualOnly:true,onChoose:sel=>{setSelection(visitAddInput,sel);commitVisitAdd();}});
function commitVisitAdd(){
  let sel=getSelection(visitAddInput);
  if(!sel)sel=window.RailRoamExplorer?.suggestCities(visitAddInput.value).find(p=>canonicalCityKey(p.city)===canonicalCityKey(visitAddInput.value));
  if(!sel){
    visitAddInput.focus();
    const st=visitAddAc.querySelector(".status");
    if(visitAddInput.value.trim()){st.textContent="Choose a city from the suggestions.";st.className="status err"}
    return;
  }
  const exists=[...document.querySelectorAll(".visit-row")].some(r=>{
    try{return JSON.parse(r.dataset.selection||"null")?.cityKey===sel.cityKey}catch(e){return false}
  });
  if(exists){visitAddInput.value="";delete visitAddInput.dataset.selection;return}
  addVisit(sel);
  visitAddInput.value="";delete visitAddInput.dataset.selection;
  visitAddAc.querySelector(".status").textContent="";
  visitAddInput.focus();
}
document.getElementById("addVisitBtn").onclick=commitVisitAdd;
visitAddInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&getSelection(visitAddInput)){e.preventDefault();commitVisitAdd()}});

document.getElementById("addTransferBtn").onclick=()=>addTransfer();
setupIntegerStepper();

function renderLayoverField(){
  const total=Math.max(0,Math.round(appState.maxNonVisitLayover/15)*15);
  document.getElementById("layoverHours").value=String(Math.floor(total/60)).padStart(2,"0");
  document.getElementById("layoverMinutes").value=String(total%60).padStart(2,"0");
}
function readLayoverField(){
  const h=Math.max(0,parseInt(document.getElementById("layoverHours").value||"0",10)||0);
  let m=Math.max(0,parseInt(document.getElementById("layoverMinutes").value||"0",10)||0);
  m=Math.min(59,m);
  m=Math.round(m/15)*15;
  let total=h*60+m;
  if(m===60) total=(h+1)*60;
  appState.maxNonVisitLayover=Math.max(30,total);
  renderLayoverField();
  validateForm(false);
}
function stepLayover(dir){
  appState.maxNonVisitLayover=Math.max(30,appState.maxNonVisitLayover+dir*15);
  renderLayoverField();
  validateForm(false);
}
function updateTransferControl(){
  const checked=document.getElementById("allowTransfers").checked;
  document.getElementById("transferControls").classList.toggle("off",!checked);
  document.getElementById("layoverLimit").hidden=!checked;
  validateForm(false);
}
["layoverHours","layoverMinutes"].forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener("input",()=>{el.value=el.value.replace(/\D/g,"");});
  el.addEventListener("blur",readLayoverField);
  el.addEventListener("keydown",e=>{
    if(e.key==="ArrowUp"){e.preventDefault();stepLayover(1)}
    if(e.key==="ArrowDown"){e.preventDefault();stepLayover(-1)}
  });
});
document.querySelector(".layover-up").onclick=()=>stepLayover(1);
document.querySelector(".layover-down").onclick=()=>stepLayover(-1);
document.getElementById("allowTransfers").addEventListener("change",updateTransferControl);
renderLayoverField();
updateTransferControl();

function zonedLocalToDate(dateStr,timeStr,tz){
  const [y,m,d]=dateStr.split("-").map(Number), [hh,mm]=timeStr.split(":").map(Number);
  let guess=Date.UTC(y,m-1,d,hh,mm,0);
  const cache=zonedLocalToDate.formatters||(zonedLocalToDate.formatters=new Map());
  if(!cache.has(tz))cache.set(tz,new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}));
  const fmt=cache.get(tz);
  for(let i=0;i<3;i++){
    const p=Object.fromEntries(fmt.formatToParts(new Date(guess)).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
    const represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);
    guess += Date.UTC(y,m-1,d,hh,mm)-represented;
  }
  return new Date(guess);
}
function readDateTime(dayId,timeId,tz){
  const d=document.getElementById(dayId).value,t=document.getElementById(timeId).value;
  return d&&t ? zonedLocalToDate(d,t,tz) : null;
}
function durationText(ms){
  const mins=Math.round(ms/60000), h=Math.floor(mins/60), m=mins%60;
  if(mins>=1440){const days=mins/1440,n=days<5?Math.round(days*2)/2:Math.round(days);return `≈ ${n} ${n===1?'day':'days'}`;}
  return h ? `${h}h ${m?m+"m":""}`.trim() : `${m}m`;
}
function fmt(iso,tz){
  const d=new Date(iso);
  return new Intl.DateTimeFormat("en-GB",{timeZone:tz||"UTC",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(d);
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function collectSelections(includeDisabled=false){
  return {
    interrailPass:!!appState.interrailPass,overnightPreference:appState.overnightPreference||'hotels',maxTravelHours:appState.maxTravelHours||null,maximumVisitCount:document.getElementById('visitCountMax')?.value===''?Infinity:Number(document.getElementById('visitCountMax')?.value||Infinity),optimize:appState.optimize||'balanced',requiredVisitCount:Number(document.getElementById('visitCountMin')?.value||0),
    start:!includeDisabled&&document.getElementById('useEndpoints')?.checked===false?null:getSelection(startInput), finish:!includeDisabled&&document.getElementById('useEndpoints')?.checked===false?null:document.getElementById('roundTrip')?.checked?getSelection(startInput):getSelection(finishInput),
    roundTrip:document.getElementById('useEndpoints')?.checked!==false&&!!document.getElementById('roundTrip')?.checked,
    useCityWishlist:document.getElementById('useCityWishlist')?.checked!==false,useEndpoints:document.getElementById('useEndpoints')?.checked!==false,
    strictOrder:document.getElementById('useCityWishlist')?.checked!==false&&!!document.getElementById('strictCityOrder')?.checked,
    visits:[...document.querySelectorAll(".visit-row")].map(row=>({
      sel:(()=>{try{return JSON.parse(row.dataset.selection||"null")}catch(e){return null}})(),
      typed:"",
      min:row.querySelector(".visit-min").value,
      max:row.querySelector(".visit-max").value,
      arriveStart:+row.dataset.arriveStart, arriveEnd:+row.dataset.arriveEnd,
      leaveStart:+row.dataset.leaveStart, leaveEnd:+row.dataset.leaveEnd,
      arriveDate:row.dataset.arriveDate||"", leaveDate:row.dataset.leaveDate||"",arriveDateEnd:row.dataset.arriveDateEnd||"",leaveDateEnd:row.dataset.leaveDateEnd||"",arriveDateMode:row.dataset.arriveDateMode,leaveDateMode:row.dataset.leaveDateMode
    })).filter(()=>includeDisabled||document.getElementById('useCityWishlist')?.checked!==false),
    transfers:[...document.querySelectorAll(".transfer-row")].map(row=>({
      sel:getSelection(row.querySelector(".place-input")),
      typed:row.querySelector(".place-input").value.trim()
    }))
  }
}

function clearCompatibility(){
  document.querySelectorAll(".compat-msg").forEach(el=>{el.textContent="";el.classList.remove("show")});
  document.querySelectorAll(".compat-bad").forEach(el=>el.classList.remove("compat-bad"));
  document.querySelectorAll(".visit-card-compat").forEach(el=>{el.textContent="";el.classList.remove("show")});
}
function markCompat(id,text,container){
  const el=document.getElementById(id);
  if(el){el.textContent=text;el.classList.add("show")}
  const box=container || el?.closest(".full,.date-time-block");
  box?.classList.add("compat-bad");
}
function compatibilityCheck(c){
  clearCompatibility();
  const issues=[];
  const minRaw=document.getElementById("visitCountMin").value.trim();
  const maxRaw=document.getElementById("visitCountMax").value.trim();
  const countMin=minRaw===""?null:parseInt(minRaw,10);
  const countMax=maxRaw===""?null:parseInt(maxRaw,10);
  const required=c.visits.filter(v=>v.sel).length;

  if(Number.isInteger(countMin)&&Number.isInteger(countMax)&&countMin>countMax){
    markCompat("compatCount","Incompatible: minimum is above maximum");
    issues.push("Minimum and maximum cities to see are incompatible.");
  }
  if(Number.isInteger(countMax)&&required>countMax){
    markCompat("compatCount","Incompatible with Places you want to visit");
    markCompat("compatPlaces","Incompatible with Cities to see");
    issues.push("Places you want to visit and Cities to see are incompatible.");
  }

  c.visits.forEach((v,i)=>{
    const lo=parseTimeMinutes(v.min,true), hi=parseTimeMinutes(v.max,true);
    if(lo!==null&&hi!==null&&!Number.isNaN(lo)&&!Number.isNaN(hi)&&lo>hi){
      const row=document.querySelectorAll(".visit-row")[i];
      row?.classList.add("compat-bad");
      const msg=row?.querySelector(".visit-card-compat");
      if(msg){msg.textContent="Incompatible: minimum stay is above maximum stay";msg.classList.add("show")}
      issues.push(`${v.sel?.city||"A required city"} has incompatible minimum and maximum stay times.`);
    }
    const row=document.querySelectorAll(".visit-row")[i];
    const msg=row?.querySelector(".visit-card-compat");
    for(const kind of ['arrive','leave'])if(v[kind+'DateMode']==='range'&&(!v[kind+'Date']||!v[kind+'DateEnd']||v[kind+'DateEnd']<v[kind+'Date'])){issues.push(`${v.sel?.city||'A city'} needs a valid ${kind} date range.`);row?.classList.add('compat-bad');}
    if(v.arriveDate && v.leaveDate && v.sel){
      const earliestArrival=extendedLocalDate(v.arriveDate,v.arriveStart,v.sel.tz);
      const latestArrival=extendedLocalDate(v.arriveDateEnd||v.arriveDate,v.arriveEnd,v.sel.tz);
      const earliestLeave=extendedLocalDate(v.leaveDate,v.leaveStart,v.sel.tz);
      const latestLeave=extendedLocalDate(v.leaveDateEnd||v.leaveDate,v.leaveEnd,v.sel.tz);
      if(latestLeave<earliestArrival){
        row?.classList.add("compat-bad");
        if(msg){msg.textContent="Incompatible: leave is before arrival";msg.classList.add("show")}
        issues.push(`${v.sel.city} arrival and leave dates are incompatible.`);
      }else if(lo!==null&&!Number.isNaN(lo) && (latestLeave-earliestArrival)/60000<lo){
        row?.classList.add("compat-bad");
        if(msg){msg.textContent="Incompatible with minimum stay";msg.classList.add("show")}
        issues.push(`${v.sel.city} dates are incompatible with its minimum stay.`);
      }else if(hi!==null&&!Number.isNaN(hi) && (earliestLeave-latestArrival)/60000>hi){
        row?.classList.add("compat-bad");
        if(msg){msg.textContent="Incompatible with maximum stay";msg.classList.add("show")}
        issues.push(`${v.sel.city} dates are incompatible with its maximum stay.`);
      }
    }
    if((v.arriveDate && ((v.arriveDateEnd||v.arriveDate)<appState.leaveDate || v.arriveDate>appState.arriveDate)) ||
       (v.leaveDate && ((v.leaveDateEnd||v.leaveDate)<appState.leaveDate || v.leaveDate>appState.arriveDate))){
      row?.classList.add("compat-bad");
      if(msg){msg.textContent="Incompatible with overall trip dates";msg.classList.add("show")}
      issues.push(`${v.sel?.city||"A required city"} has a date outside the overall trip.`);
    }
  });

  // Necessary feasibility check only: if even the required sightseeing time cannot
  // physically fit between the outer trip windows, the parameters contradict.
  if(c.start&&c.finish){
    const depEarliest=extendedLocalDate(appState.leaveDate,appState.leaveStart,c.start.tz);
    const arrLatest=extendedLocalDate(appState.arriveDate,appState.arriveEnd,c.finish.tz);
    const available=Math.max(0,(arrLatest-depEarliest)/60000);
    let requiredMin=0;
    for(const v of c.visits.filter(v=>v.sel)){
      const m=parseTimeMinutes(v.min,true);
      requiredMin += (m!==null&&!Number.isNaN(m)) ? m : appState.visitMin;
    }
    const autoNeeded=Math.max(0,(Number.isInteger(countMin)?countMin:required)-required);
    requiredMin += autoNeeded*appState.visitMin;
    if(requiredMin>available){
      markCompat("compatDuration","Incompatible with trip time");
      markCompat("compatDeparture","Incompatible with Visit duration");
      markCompat("compatArrival","Incompatible with Visit duration");
      issues.push("Visit duration and the departure/arrival windows are incompatible.");
    }

    const depLatest=extendedLocalDate(appState.leaveDateEnd||appState.leaveDate,appState.leaveEnd,c.start.tz);
    if(arrLatest<depEarliest){
      markCompat("compatDeparture","Incompatible with Arrival window");
      markCompat("compatArrival","Incompatible with Departure window");
      issues.push("Departure and arrival windows are incompatible.");
    }
  }

  const used=new Map();
  if(c.start)used.set(c.start.cityKey,"Starting city");
  if(c.finish&&!c.roundTrip)used.set(c.finish.cityKey,"Finishing city");
  c.visits.filter(v=>v.sel).forEach(v=>used.set(v.sel.cityKey,"Places you want to visit"));
  for(const v of c.transfers.filter(v=>v.sel)){
    if(used.has(v.sel.cityKey)){
      markCompat("compatTransfers",`Incompatible with ${used.get(v.sel.cityKey)}`);
      if(used.get(v.sel.cityKey)==="Places you want to visit")markCompat("compatPlaces","Incompatible with transfer-only cities");
      issues.push("A city cannot be both a destination/visit and transfer-only.");
      break;
    }
  }
  return [...new Set(issues)];
}
function hasCityAnchor(form,items=window.RailRoamWishlist?.items()||[]){return !!(form.start||form.finish||(form.visits||[]).some(v=>v.sel)||items.length);}
function validateForm(show=true){
  document.querySelectorAll(".visit-row").forEach(row=>{
    row.querySelectorAll(".visit-date").forEach(el=>{el.min=appState.leaveDate<localYmd(new Date())?localYmd(new Date()):appState.leaveDate;el.max=appState.arriveDate});
  });
  const c=collectSelections(), errors=[];
  const noAnchor=!hasCityAnchor(c);
  const today=localYmd(new Date());
  if(appState.dateChoices?.leave?.mode!=='any'&&appState.leaveDate<today)errors.push('Departure dates must be today or later.');
  if(appState.arriveDate<today)errors.push('Arrival dates must be today or later.');
  for(const v of c.visits.filter(v=>v.sel))if([v.arriveDate,v.leaveDate].some(d=>d&&d<today))errors.push(`${v.sel.city}: choose today or later for stay dates.`);
  if((window.RailRoamWishlist?.items()||[]).some(t=>t.date&&t.date<today))errors.push('Selected train dates must be today or later.');
  const anchorMessage='Add at least one city to start.';
  if(noAnchor)errors.push(anchorMessage);
  const startStatus=startInput.closest('.ac-wrap').querySelector('.status');
  if(noAnchor&&show){startStatus.textContent=anchorMessage;startStatus.className='status err';startInput.focus();}
  else if(startStatus.textContent===anchorMessage){startStatus.textContent='';startStatus.className='status';}
  const incompatibilities=compatibilityCheck(c);
  window.RailRoamExplorer?.validateAvoidance(c, incompatibilities);
  if(!c.start&&startInput.value.trim()&&!/^anywhere$/i.test(startInput.value.trim())) errors.push("Choose the starting place from the autocomplete, or leave it blank for Anywhere.");
  if(!c.finish&&!c.roundTrip&&finishInput.value.trim()&&!/^anywhere$/i.test(finishInput.value.trim())) errors.push("Choose the finishing place from the autocomplete, or leave it blank for Anywhere.");
  c.visits.forEach((v,i)=>{
    if(v.typed && !v.sel) errors.push(`Choose sightseeing city ${i+1} from the autocomplete.`);
    const minM=parseTimeMinutes(v.min,true), maxM=parseTimeMinutes(v.max,true);
    if(v.min && (Number.isNaN(minM)||minM<30)) errors.push(`Sightseeing city ${i+1}: minimum stay must be at least 0:30 and use H:MM.`);
    if(v.max && (Number.isNaN(maxM)||maxM<30)) errors.push(`Sightseeing city ${i+1}: maximum stay must be at least 0:30 and use H:MM.`);
    if(minM!==null&&maxM!==null&&!Number.isNaN(minM)&&!Number.isNaN(maxM)&&minM>maxM) errors.push(`Sightseeing city ${i+1}: minimum stay cannot exceed maximum stay.`);
  });
  c.transfers.forEach((v,i)=>{if(v.typed&&!v.sel)errors.push(`Choose transfer-only city ${i+1} from the autocomplete.`)});

  const used=new Map();
  if(c.start)used.set(c.start.cityKey,"the starting place");
  if(c.finish && (!c.start || c.finish.cityKey!==c.start.cityKey)){
    used.set(c.finish.cityKey,"the finishing place");
  }
  c.visits.filter(v=>v.sel).forEach(v=>{
    if(used.has(v.sel.cityKey)&&used.get(v.sel.cityKey)==="a city to sightsee") errors.push(`${v.sel.city} is already in the city wishlist.`);
    else used.set(v.sel.cityKey,"a city to sightsee");
  });
  const transferSeen=new Set();
  c.transfers.filter(v=>v.sel).forEach(v=>{
    if(used.has(v.sel.cityKey)) errors.push(`${v.sel.city} is already ${used.get(v.sel.cityKey)}, so it can't also be transfer-only.`);
    if(transferSeen.has(v.sel.cityKey)) errors.push(`${v.sel.city} is already in the transfer-only list.`);
    transferSeen.add(v.sel.cityKey);
  });

  const minRaw=document.getElementById("visitCountMin").value.trim();
  const maxRaw=document.getElementById("visitCountMax").value.trim();
  const requestedMin=minRaw==="" ? null : parseInt(minRaw,10);
  const requestedMax=maxRaw==="" ? null : parseInt(maxRaw,10);
  if(requestedMin!==null && (!Number.isInteger(requestedMin)||requestedMin<0)) errors.push("Minimum cities to see must be a whole number of 0 or more.");
  if(requestedMax!==null && (!Number.isInteger(requestedMax)||requestedMax<0)) errors.push("Maximum cities to see must be a whole number of 0 or more.");
  if(requestedMin!==null && requestedMax!==null && requestedMin>requestedMax) errors.push("Minimum cities to see cannot be greater than maximum.");
  const globalMin=appState.visitMin, globalMax=appState.visitMax;
  if(globalMin<30) errors.push("Minimum visit must be at least 0:30.");
  if(globalMax<globalMin) errors.push("Minimum visit cannot exceed maximum visit.");
  const required=c.visits.filter(v=>v.sel).length;
  if(requestedMax!==null && required>requestedMax) errors.push(`You added ${required} required sightseeing ${required===1?"city":"cities"}, so the maximum cities to see cannot be lower than ${required}.`);

  if(c.start&&c.finish){
    const lf=extendedLocalDate(appState.leaveDate,appState.leaveStart,c.start.tz);
    const lt=extendedLocalDate(appState.leaveDateEnd||appState.leaveDate,appState.leaveEnd,c.start.tz);
    const af=extendedLocalDate(appState.arriveDate,appState.arriveStart,c.finish.tz);
    const at=extendedLocalDate(appState.arriveDate,appState.arriveEnd,c.finish.tz);
    if(lt<=lf) errors.push("Departure window must have a positive width.");
    if(at<=af) errors.push("Arrival window must have a positive width.");
    if(at<lf) errors.push("Arrival cannot be before departure.");
  }
  const box=document.getElementById("formError");
  if(incompatibilities.length){
    box.style.display="block";
    box.innerHTML="<strong>"+escapeHtml(incompatibilities[0])+"</strong>"+
      (incompatibilities.length>1?"<br>"+incompatibilities.slice(1).map(e=>"• "+escapeHtml(e)).join("<br>"):"");
  }else if(errors.length && show){
    box.style.display="block";box.innerHTML=errors.map(e=>"• "+escapeHtml(e)).join("<br>");
  }else{
    box.style.display="none";box.innerHTML="";
  }
  return {ok:!errors.length && !incompatibilities.length, errors:[...errors,...incompatibilities], data:c};
}
