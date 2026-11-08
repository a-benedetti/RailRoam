/* Inclusive date intervals. Empty dates mean flexible within a bounded feed horizon. */

const RailRoamDates=(()=>{

 const $=id=>document.getElementById(id),choices={leave:{mode:'any',from:appState.leaveDate,to:appState.leaveDate},arrive:{mode:'any',from:appState.arriveDate,to:appState.arriveDate}};

 function label(c){if(c.mode==='length')return c.min+(c.max!==c.min?'–'+c.max:'')+' days away';if(c.mode==='any')return 'Anytime';return displayDate(c.from)+(c.mode==='range'?' – '+displayDate(c.to):'');}



 function bounds(c,today){

  const a=c.leave,b=c.arrive,first=a.mode==='any'?today:a.from,last=b.mode==='any'?addDaysYmd(first,27):(b.mode==='range'?b.to:b.from);

  if(b.mode==='length'){const end=a.mode==='any'?addDaysYmd(first,27):a.mode==='range'?a.to:a.from;return {leaveDate:first,leaveDateEnd:end,arriveDate:addDaysYmd(end,b.max),arriveDateStart:addDaysYmd(first,b.min),arriveIsRange:true,tripLength:{min:b.min,max:b.max},dateChoices:JSON.parse(JSON.stringify(c))};}

  return {leaveDate:first,leaveDateEnd:a.mode==='any'?last:a.mode==='range'?a.to:a.from,arriveDate:last,arriveDateStart:b.mode==='range'?b.from:b.mode==='any'?first:last,arriveIsRange:b.mode==='range',tripLength:null,dateChoices:JSON.parse(JSON.stringify(c))};

 }

 function apply(){

  Object.assign(appState,bounds(choices,localYmd(new Date())));
  if(!appState.visitDurationCustom&&!appState.tripLength&&choices.leave.mode!=='any'&&choices.arrive.mode!=='any'){
   const days=Math.round((Date.parse(appState.arriveDate)-Date.parse(appState.leaveDate))/86400000);
   if(days>=1){appState.visitMax=Math.max(480,Math.min(31*1440,days*1440));visitRangeCtl.render();}
  }

  renderWindowLabels();for(const kind of ['leave','arrive'])$(kind+'DateBtn').textContent=label(choices[kind]);

  document.dispatchEvent(new CustomEvent('railroam:constraints-change'));validateForm(false);

 }

 for(const kind of ['leave','arrive']){

  const button=$(kind+'DateBtn');button.onclick=()=>RailRoamCalendar.open({anchor:button,title:kind==='leave'?'Departure dates':'Arrival dates',from:choices[kind].mode==='any'?'':choices[kind].from,to:choices[kind].mode==='range'?choices[kind].to:'',allowLength:kind==='arrive',length:choices[kind].mode==='length'?choices[kind]:null,onPick:value=>{
   if(kind==='arrive'&&!appState.visitDurationCustom){if(value.length){appState.tripLengthOriginalMax??=appState.visitMax;appState.visitMax=Math.max(appState.visitMin,value.length.max*1440);}else if(appState.tripLengthOriginalMax){appState.visitMax=appState.tripLengthOriginalMax;delete appState.tripLengthOriginalMax;}visitRangeCtl.render();}
   choices[kind]=value.length?{mode:'length',...value.length}:{mode:!value.from?'any':value.to?'range':'date',from:value.from||localYmd(new Date()),to:value.to||value.from};apply();}});

 }

 function enhanceCities(){document.querySelectorAll('.visit-row').forEach(row=>{for(const kind of ['arrive','leave']){

  const start=row.querySelector('.visit-'+kind+'-date');if(!start||start.dataset.intervalReady)continue;start.dataset.intervalReady='true';start.type='hidden';

  const button=document.createElement('button');button.type='button';button.className='city-date-button';button.textContent='Anytime';start.before(button);

  button.onclick=()=>RailRoamCalendar.open({anchor:button,title:(kind==='arrive'?'Arrival in ':'Departure from ')+JSON.parse(row.dataset.selection).city,from:row.dataset[kind+'Date']||'',to:row.dataset[kind+'DateEnd']||'',min:appState.leaveDate,max:appState.arriveDate,onPick:value=>{row.dataset[kind+'Date']=value.from;row.dataset[kind+'DateEnd']=value.to;row.dataset[kind+'DateMode']=!value.from?'any':value.to?'range':'date';start.value=value.from;button.textContent=value.from?label({mode:value.to?'range':'date',from:value.from,to:value.to}):'Anytime';start.dispatchEvent(new Event('change',{bubbles:true}));document.dispatchEvent(new CustomEvent('railroam:constraints-change'));validateForm(false);}});

 }});}

 const originalLabels=renderWindowLabels;renderWindowLabels=()=>{originalLabels();for(const kind of ['leave','arrive'])$(kind+'DateBtn').textContent=label(choices[kind]);};


 new MutationObserver(enhanceCities).observe($('visitRows'),{childList:true});enhanceCities();apply();

 return {label,choices,bounds,reset(){const today=localYmd(new Date());choices.leave={mode:'any',from:today,to:today};choices.arrive={mode:'any',from:today,to:today};apply();}};

})();

window.RailRoamDates=RailRoamDates;
