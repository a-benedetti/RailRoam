/* Four shared sections, in planning order. */
(()=>{
 const $=id=>document.getElementById(id),planner=$('plannerPanel'),route=planner.querySelector(':scope > .card'),dates=route.querySelector('.trip-dates');
 const dateCard=document.createElement('section');dateCard.id='datesSection';dateCard.className='card planner-dates';dateCard.innerHTML='<h2 class="section-title">Dates</h2>';dateCard.append(dates);planner.prepend(dateCard);
 route.id='routeSection';const header=document.createElement('div');header.className='route-section-header';header.innerHTML='<h2 class="section-title">Cities</h2>';const round=route.querySelector('.roundtrip-mobile-host');if(round)header.append(round);route.prepend(header);
 route.querySelector('.endpoint-prompt > .planner-prompt-heading')?.remove();$('selectedTrains').querySelector('.section-title').textContent='Trains';
 $('preferenceOptions').append($('avoidOptions'));
})();
