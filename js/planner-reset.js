/* Clear the trip in place; keep map assets, theme and expiring raw-data cache. */
(()=>{
 const initial=JSON.parse(JSON.stringify(appState)),$=id=>document.getElementById(id);
 function reset(){
  RailRoamSearch.cancel();window.RailRoamCalendar?.close();
  for(const k of Object.keys(appState))delete appState[k];Object.assign(appState,JSON.parse(JSON.stringify(initial)));
  $('visitRows').replaceChildren();$('transferRows').replaceChildren();
  document.querySelectorAll('.place-input').forEach(input=>{input.value='';delete input.dataset.selection;input.classList.remove('compat-bad');input.dispatchEvent(new Event('input',{bubbles:true}));});
  document.querySelectorAll('.ac-menu').forEach(menu=>menu.replaceChildren());document.querySelectorAll('.ac-wrap .status').forEach(s=>{s.textContent='';s.className='status';});
  for(const [id,on]of Object.entries({interrailPass:false,roundTrip:false,strictCityOrder:false,useSightHours:false,useSleepHours:true,requireSleeper:false,allowTransfers:true,allowFerries:true})){if($(id))$(id).checked=on;}
  $('visitCountMin').value='';$('visitCountMax').value='';$('maxTravelHours').value='';$('optimizeFor').value='balanced';document.querySelectorAll('[name=overnightPreference]').forEach(r=>r.checked=r.value==='hotels');
  applyRoundTripState();$('sleepHoursCard').classList.remove('rule-disabled');$('sightHoursCard')?.classList.add('rule-disabled');
  RailRoamWishlist.reset();RailRoamDates.reset();
  for(const c of [leaveRangeCtl,arriveRangeCtl,visitRangeCtl,sightRangeCtl,sleepRangeCtl])c.render();renderLayoverField();updateTransferControl();
  Object.assign(resultState,{form:null,routes:[],shown:0,availableCount:0,depth:0,noMore:false,loadingMore:false,rulesSummary:null});$('routeList').innerHTML='<div class="empty">Plan a trip to see routes.</div>';
  const button=$('planBtn');button.disabled=false;button.classList.remove('loading','success');
  document.dispatchEvent(new CustomEvent('railroam:reset'));document.dispatchEvent(new CustomEvent('railroam:results',{detail:[]}));RailRoamExplorer.reset();
  $('preferenceOptions').open=false;document.querySelectorAll('.train-finder,.travel-time-option,#avoidOptions').forEach(d=>d.open=false);
  RailRoamWorkflow.reset();renderWindowLabels();validateForm(false);$('formError').style.display='none';$('formError').textContent='';
 }
 window.RailRoamPlannerReset={reset};
})();
