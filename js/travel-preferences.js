/* Optional preferences remain page-session state. */
(()=>{
 appState.interrailPass=false;const pass=document.createElement('label');pass.className='interrail-pass-option';pass.innerHTML='<input type="checkbox" id="interrailPass"><span>I have an Interrail pass<small>Estimates assume a valid 2nd-class Global Pass.</small></span>';document.getElementById('preferenceOptions').querySelector('.optimization-control').after(pass);pass.onchange=e=>{appState.interrailPass=e.target.checked;document.dispatchEvent(new CustomEvent('railroam:constraints-change'));};
 appState.overnightPreference='hotels';appState.maxTravelHours=null;
 const sleep=document.getElementById('sleepHoursCard'),choice=document.createElement('fieldset');choice.className='overnight-preference';choice.innerHTML='<legend>On multi-day trips</legend><div class="overnight-buttons"><label><input type="radio" name="overnightPreference" value="hotels" checked><span>I prefer sleeping in hotels</span></label><label><input type="radio" name="overnightPreference" value="trains"><span>I prefer sleeping on trains</span></label></div>';
 sleep.after(choice);choice.onchange=e=>{appState.overnightPreference=e.target.value;document.dispatchEvent(new CustomEvent('railroam:constraints-change'));};
 const group=document.createElement('section');group.className='journey-limits';group.innerHTML='<h3 class="preference-heading">Journey limits</h3>';
 const limit=document.createElement('div');limit.className='travel-time-option limit-row';limit.innerHTML='<label class="limit-toggle"><span>Limit time travelling</span><input type="checkbox" id="useTravelLimit" aria-label="Limit time travelling"><span class="preference-switch-track" aria-hidden="true"></span></label><div class="travel-time-input" hidden><input id="maxTravelHours" type="number" min="0.5" max="744" step="0.5" placeholder="6" aria-label="Maximum travel time in hours"><span>h</span></div>';
 const transfer=document.getElementById('transferControls');transfer.classList.add('limit-row');transfer.querySelector('.mini-range-label').remove();transfer.querySelectorAll('.layover-down,.layover-up').forEach(b=>b.hidden=true);
 group.append(limit,transfer);document.getElementById('preferenceOptions').append(group);
 const note=document.createElement('small');note.className='preference-note';note.textContent='Travel includes trains and waits, not city visits. Set the maximum wait between trains.';group.append(note);
 const toggle=limit.querySelector('#useTravelLimit'),hours=limit.querySelector('#maxTravelHours');toggle.className='preference-switch-input';toggle.setAttribute('role','switch');
 function changed(){const n=Number(hours.value);appState.maxTravelHours=toggle.checked&&hours.value&&Number.isFinite(n)?Math.max(.5,Math.min(744,n)):null;hours.parentElement.hidden=!toggle.checked;if(appState.maxTravelHours)hours.value=String(appState.maxTravelHours);document.dispatchEvent(new CustomEvent('railroam:constraints-change'));}
 toggle.onchange=()=>{if(toggle.checked&&!hours.value)hours.value='6';changed();};hours.onchange=changed;
 document.addEventListener('railroam:reset',()=>{toggle.checked=false;hours.value='';hours.parentElement.hidden=true;});
})();
