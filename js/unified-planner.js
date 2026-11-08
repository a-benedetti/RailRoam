/* One planner: city wishlist, endpoints/dates, selected services, preferences. */
(()=>{
 const $=id=>document.getElementById(id),planner=$('plannerPanel'),visits=$('visitOptions'),rows=$('visitRows');
 $('visitAddAc').querySelector('input').setAttribute('aria-label','Add a city to wishlist');$('visitAddAc').querySelector('input').placeholder='Add a city';$('addVisitBtn').setAttribute('aria-label','Add city to wishlist');
 visits.querySelector('summary').textContent='City wishlist';visits.open=true;visits.classList.add('city-wishlist');planner.prepend(visits);
 const order=document.createElement('label');order.className='strict-order';order.innerHTML='<input type="checkbox" id="strictCityOrder"> Follow this city order';visits.querySelector('summary').after(order);
 const addCity=city=>{if(!city)return;const existing=collectSelections().visits.some(v=>v.sel&&canonicalCityKey(v.sel.city)===canonicalCityKey(city.city));if(!existing)addVisit(city);visits.open=true;RailRoamExplorer.setPanel('plan');};
 const source=$('wishlistPanel'),services=source.querySelector('.card');services.id='selectedTrains';services.querySelector('.section-title').textContent='Selected trains';
 source.after(services);planner.querySelector(':scope > .card').after(services);
 // Retain the existing date picker and stay controls without a second form.
 services.addEventListener('click',source.onclick);services.addEventListener('input',source.oninput);
 services.querySelectorAll(':scope > .hint,:scope > .ac-wrap,#wishConnections,.wish-dates').forEach(el=>el.hidden=true);
 const finder=document.createElement('details');finder.className='train-finder';const findTitle=document.createElement('summary');findTitle.textContent='+ Add a train';finder.append(findTitle);const findInput=$('wishCity').closest('.ac-wrap');findInput.hidden=false;$('wishCity').setAttribute('aria-label','Find trains departing from a city');$('wishCity').placeholder='Departing from…';$('wishConnections').hidden=false;finder.append(findInput,$('wishConnections'));$('wishItems').before(finder);
 const stays=$('wishStays');visits.append(stays);stays.addEventListener('click',source.onclick);stays.addEventListener('input',source.oninput);
 new MutationObserver(()=>document.dispatchEvent(new CustomEvent('railroam:city-wishlist-change'))).observe(rows,{childList:true});
 function persist(){document.dispatchEvent(new CustomEvent('railroam:wishlist-change'));}
 function enhance(){rows.querySelectorAll('.visit-row').forEach((row,index)=>{if(row.querySelector('.city-order-buttons'))return;const controls=document.createElement('div');controls.className='city-order-buttons';controls.innerHTML='<button type="button" data-move="-1" aria-label="Move city up">↑</button><button type="button" data-move="1" aria-label="Move city down">↓</button><span class="city-drag" draggable="true" title="Drag to reorder">⠿</span>';row.querySelector('.visit-card-top').prepend(controls);row.addEventListener('dragover',e=>e.preventDefault());row.addEventListener('drop',e=>{e.preventDefault();const from=rows.children[Number(e.dataTransfer.getData('text/plain'))];if(from&&from!==row){const after=e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2;rows.insertBefore(from,after?row.nextSibling:row);persist();}});controls.querySelector('.city-drag').ondragstart=e=>e.dataTransfer.setData('text/plain',String([...rows.children].indexOf(row)));});persist();}
 rows.addEventListener('click',e=>{const b=e.target.closest('[data-move]');if(!b)return;const row=b.closest('.visit-row'),other=+b.dataset.move<0?row.previousElementSibling:row.nextElementSibling;if(other)rows.insertBefore(+b.dataset.move<0?row:other,+b.dataset.move<0?other:row);});
 new MutationObserver(enhance).observe(rows,{childList:true});enhance();
 $('strictCityOrder').onchange=persist;rows.addEventListener('input',persist);rows.addEventListener('change',persist);document.addEventListener('railroam:constraints-change',persist);
 document.addEventListener('railroam:panel',e=>{document.body.dataset.panel=e.detail;});document.body.dataset.panel='plan';
 window.RailRoamCityWishlist={add:addCity};
})();
