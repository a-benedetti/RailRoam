/* One heading, spacing and toggle system for the Preferences section. */
(()=>{
 const root=document.getElementById('preferenceOptions');
 const titles={interrailPass:'I have an Interrail pass',useSightHours:'Sightseeing hours',useSleepHours:'Sleep hours',allowTransfers:'Allow train changes',allowFerries:'Include ferries'};
 for(const [id,text]of Object.entries(titles)){
  const input=document.getElementById(id),label=input?.closest('label');if(!label)continue;
  const title=document.createElement('span');title.className='preference-heading';title.textContent=text;
  const track=document.createElement('span');track.className='preference-switch-track';track.setAttribute('aria-hidden','true');
  input.classList.add('preference-switch-input');input.setAttribute('role','switch');input.setAttribute('aria-label',text);label.classList.add('preference-toggle');label.replaceChildren(title,input,track);
  if(id==='interrailPass'){const note=document.createElement('small');note.className='preference-note';note.textContent='2nd-class Global Pass · reservations may cost extra';label.append(note);}
 }
 root.querySelector('.optimization-control label').classList.add('preference-heading');
 root.querySelectorAll('.grid>.full>label').forEach(label=>label.classList.add('preference-heading'));
})();
