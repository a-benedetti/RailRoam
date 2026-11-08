/* Informational, shown on each fresh page; no consent or persistent trip state. */
(()=>{
 const overlay=document.createElement('div');overlay.className='beta-overlay';
 overlay.innerHTML='<section class="beta-notice" role="dialog" aria-modal="true" aria-labelledby="betaTitle" tabindex="-1"><header><div class="beta-brand"><span class="beta-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 10h14M9 18l-2 3m8-3 2 3M9 6h6"/><circle cx="9" cy="14" r=".7"/><circle cx="15" cy="14" r=".7"/></svg></span><div><span class="beta-eyebrow">RailRoam</span><h2 id="betaTitle">Beta preview</h2></div></div></header><p>This is a beta planning tool. Fares are estimates; timetables and accessibility details may be incomplete or change. Confirm schedules, reservations, prices and access with operators before booking.</p><button type="button" class="beta-acknowledge">I understand</button></section>';
 const button=overlay.querySelector('button'),dialog=overlay.querySelector('.beta-notice'),previous=document.activeElement;
 const close=()=>{overlay.remove();document.removeEventListener('keydown',key);if(previous?.isConnected&&previous!==document.body)previous.focus();};
 const key=e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){e.preventDefault();button.focus();}};
 button.onclick=close;document.body.append(overlay);document.addEventListener('keydown',key);dialog.focus();
})();
