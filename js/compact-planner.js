/* Progressive disclosure without duplicating any planner controls. */
(() => {
 const $=id=>document.getElementById(id);
 const card=$('plannerPanel').querySelector('.card'),grid=card.querySelector('.grid');
 const dates=document.createElement('div');dates.className='trip-dates full';
 const blocks=[...grid.querySelectorAll('.date-time-block')];blocks[0].before(dates);blocks.forEach(b=>dates.appendChild(b));
 function timeOption(block,kind){
  const range=$(kind+'Range'),window=block.querySelector('.window-card'),top=window.querySelector('.window-top'),label=$(kind+'RangeLabel');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='add-time';toggle.textContent='+ Time';toggle.setAttribute('aria-expanded','false');top.after(toggle);
  const details=document.createElement('div');details.className='optional-time';details.hidden=true;toggle.after(details);
  details.append(label,range,window.querySelector('.range-ends'));
  const shortcuts=document.createElement('div');shortcuts.className='optional-shortcuts';top.querySelectorAll('.date-shortcut').forEach(b=>shortcuts.append(b));details.append(shortcuts);
  const saved=kind==='leave'?[360,1380]:[360,1435];
  document.addEventListener('railroam:reset',()=>{saved[0]=360;saved[1]=kind==='leave'?1380:1435;details.hidden=true;toggle.textContent='+ Time';toggle.setAttribute('aria-expanded','false');});
  toggle.onclick=()=>{
   const on=details.hidden;appState[kind+'HasTime']=on;details.hidden=!on;toggle.textContent=on?'− Time':'+ Time';toggle.setAttribute('aria-expanded',String(on));
   appState[kind+'Start']=on?saved[0]:0;appState[kind+'End']=on?saved[1]:1439;
   (kind==='leave'?leaveRangeCtl:arriveRangeCtl).render();validateForm(false);
  };
  range.addEventListener('pointerup',()=>{saved[0]=appState[kind+'Start'];saved[1]=appState[kind+'End'];});
  range.addEventListener('keydown',()=>{saved[0]=appState[kind+'Start'];saved[1]=appState[kind+'End'];});
 }
 timeOption(blocks[0],'leave');timeOption(blocks[1],'arrive');
 appState.leaveStart=0;appState.leaveEnd=1439;appState.arriveStart=0;appState.arriveEnd=1439;
 leaveRangeCtl.render();arriveRangeCtl.render();
 function fold(element,title,id){
  const details=document.createElement('details');details.className='planner-option';details.id=id;
  const summary=document.createElement('summary');summary.textContent=title;details.append(summary);
  element.before(details);details.append(element);return details;
 }
 fold($('visitAddAc').closest('.full'),'Places to visit','visitOptions');
 fold($('transferRows').closest('.full'),'Transfer-only cities','transferOptions');
 fold($('avoidChips').closest('.avoid-section'),'Avoid cities','avoidOptions');
 const preferences=$('plannerPanel').querySelectorAll(':scope > .card')[1];
 // Keep validation outside closed preferences so an invalid field is never silent.
 $('plannerPanel').appendChild($('formError'));
 fold(preferences,'Preferences','preferenceOptions');
 const count=()=>{
  const groups=[['visitOptions',$('visitRows').children.length],['transferOptions',$('transferRows').children.length],['avoidOptions',$('avoidChips').children.length]];
  groups.forEach(([id,n])=>{const summary=$(id).querySelector('summary');summary.dataset.count=n||'';summary.classList.toggle('has-values',n>0);});
  $('visitRows').querySelectorAll('.visit-row:not([data-compact])').forEach(row=>{
   row.dataset.compact='true';const details=document.createElement('details');details.className='visit-options';const summary=document.createElement('summary');summary.textContent='Stay & timing';details.append(summary);
   [...row.querySelectorAll('.visit-stay-row,.visit-time-windows')].forEach(el=>details.append(el));row.append(details);
  });
 };
 new MutationObserver(count).observe($('visitRows'),{childList:true});new MutationObserver(count).observe($('transferRows'),{childList:true});new MutationObserver(count).observe($('avoidChips'),{childList:true});
 document.addEventListener('railroam:selection',()=>{$('visitOptions').open=$('visitRows').children.length>0||$('visitOptions').open;});
 document.addEventListener('click',e=>{if(e.target.closest('#planBtn')&&$('formError').textContent.trim())document.querySelectorAll('.planner-option:has(.compat-bad)').forEach(d=>d.open=true);});
 count();renderWindowLabels();
 const arrivalLabel=blocks[1].querySelector(':scope > label');
 const roundTripLabel=()=>{arrivalLabel.firstChild.nodeValue=$('roundTrip').checked?'Return by ':'Arrive by ';};
 $('roundTrip').addEventListener('change',roundTripLabel);roundTripLabel();

})();
