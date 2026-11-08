/* Keep this section guide beside the planner layout when adding controls. */
(()=>{
 const $=id=>document.getElementById(id),help=$('workspaceHelp'),trigger=$('helpToggle');
 const sections=[
  ['Your dates','Pick a day, a range or Anytime. Use Trip length for days away, and add hours only when you need them.'],
  ['Your cities','Choose where to start and finish, or leave Anywhere. Add wishlist cities, drag them into order and set a stay for each. Round trip brings you home.'],
  ['Your trains','Found a connection you love? Save it from the desktop map or Add a train. Optional dates and carriers help pin it down.'],
  ['Your preferences','Choose your pace, overnight style and priority. Set travel or transfer limits, include ferries, or require sleeping accommodation during sleep hours.'],
  ['Your trip','Add at least one city and Search. Cancel whenever you like. Compare routes, explore more ideas or save a PDF. Check final times, fares and accessibility with the operator before booking.']
 ];
 const sources=[
  ['Transitous / MOTIS','https://transitous.org/','routing and geocoding'],
  ['Timetable feeds','https://transitous.org/sources/','individual transport data providers'],
  ['OpenStreetMap / Wheelmap','https://www.openstreetmap.org/copyright','rail geography and community accessibility tags'],
  ['Natural Earth','https://www.naturalearthdata.com/','country outlines'],
  ['Which?','https://www.which.co.uk/policy-and-insight/article/which-reveals-british-holidaymakers-favourite-european-city-breaks-aZUWt4d8dPr1','city visitor surveys'],
  ['Eurostat','https://ec.europa.eu/eurostat/databrowser/view/tour_occ_ninc/default/table','tourism nights and resident populations'],
  ['GDS Index','https://www.gds.earth/index/top-40-cities/','destination sustainability'],
  ['HappyCow','https://www.happycow.net/vegtopics/travel/top-vegan-friendly-cities','plant-based food listings'],
  ['UK DESNZ','https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026','emissions factors'],
  ['Interrail','https://www.interrail.com/en/book-reservations/reservation-fees','pass and reservation guidance'],
  ['Ecobnb','https://ecobnb.com/','accommodation searches'],
  ['Budget Your Trip','https://www.budgetyourtrip.com/europecheapest-cities','traveller-reported daily city budgets; more Price stars means cheaper'],
  ['Operators and local visitor boards',null,'train equipment, published schedules and city guides; specific sources are linked beside each item']
 ];
 help.className='help-overlay';help.innerHTML=`<section class="help-panel" role="dialog" aria-modal="true" aria-labelledby="helpHeading"><header><h2 id="helpHeading">How it works</h2><button type="button" aria-label="Close help">×</button></header><div class="help-sections">${sections.map(([title,text])=>`<section><h3>${title}</h3><p>${text}</p></section>`).join('')}<details class="help-reference"><summary>Scores &amp; sources</summary><ul class="help-sources">${sources.map(([name,url,note])=>`<li>${url?`<a href="${url}" target="_blank" rel="noopener">${name}</a>`:name} — ${note}.</li>`).join('')}</ul><p>Coverage varies. Missing scores stay unrated; community tags do not guarantee accessible boarding. Scores compare a fixed city-break reference; sustainability benchmarks emissions saved versus flying. Price priority includes train fares and time-weighted city budgets. Prices and emissions are planning estimates, not live quotes.</p></details></div></section>`;
 const close=()=>{help.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();};
 trigger.setAttribute('aria-controls','workspaceHelp');trigger.setAttribute('aria-expanded','false');
 trigger.onclick=e=>{e.preventDefault();help.hidden=false;trigger.setAttribute('aria-expanded','true');help.querySelector('button').focus();};
 help.querySelector('button').onclick=close;help.onclick=e=>{if(e.target===help)close();};
 help.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const controls=[...help.querySelectorAll('button,a[href],summary')],first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 const reset=document.createElement('button');reset.type='button';reset.className='reset-planner';reset.textContent='Reset';reset.onclick=()=>window.RailRoamPlannerReset.reset();const utilities=document.createElement('div');utilities.className='planner-utilities';utilities.append(reset);const clear=document.getElementById('clearSelection');if(clear)utilities.append(clear);document.querySelector('.workspace-tabs').after(utilities);
 const system=matchMedia('(prefers-color-scheme: dark)');let mode='system';try{mode=localStorage.getItem('railroam-theme')||'system';}catch{}if(!['system','light','dark'].includes(mode))mode='system';
 const button=document.createElement('button');button.type='button';button.id='themeToggle';
 const controls=document.querySelector('.map-controls'),mobile=document.createElement('div');mobile.className='mobile-theme-control';document.body.append(mobile);
 const compact=matchMedia('(max-width:999px)'),place=()=>{(compact.matches?mobile:controls).append(button);mobile.hidden=!compact.matches;};compact.addEventListener('change',place);place();
 function paint(){const dark=mode==='system'?system.matches:mode==='dark';document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';button.textContent=mode==='system'?'◐':dark?'☾':'☼';button.setAttribute('aria-label',`Theme: ${mode}. Change theme`);button.title=`Theme: ${mode} · click to change`;}
 button.onclick=()=>{mode=mode==='system'?(system.matches?'light':'dark'):mode===(system.matches?'light':'dark')?(system.matches?'dark':'light'):'system';try{localStorage.setItem('railroam-theme',mode);}catch{}paint();};system.addEventListener('change',paint);paint();
})();
