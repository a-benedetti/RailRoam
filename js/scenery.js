/* Conservative scenic-route recognition, not a fabricated crowdsourced review.
 * 5 = a named scenic railway in Interrail's guide; unknown routes stay unrated. */
window.RailRoamScenery=(()=>{
 const source='https://www.interrail.com/en/plan-your-trip/tips-and-tricks/trains-europe/scenic-trains';
 const lines=[['Bernina Railway',/bernina/i,/chur|st.? moritz|pontresina/i,/tirano/i],['Glacier Express',/glacier express/i,/zermatt/i,/st.? moritz|andermatt/i],['Bergen Railway',/bergensbanen/i,/oslo|honefoss|hønefoss|geilo/i,/bergen|voss|myrdal/i],['Rhine Valley',null,/koblenz|boppard/i,/bingen|mainz|oberwesel/i],['Semmering Railway',null,/gloggnitz|semmering/i,/m[uü]rzzuschlag|bruck.*mur/i],['Centovalli',/centovalli/i,/locarno/i,/domodossola/i],['West Highland Line',null,/fort william|glasgow/i,/mallaig|fort william/i]];
 function rating(leg){if(!leg||leg.mode==='FERRY')return null;const names=[leg.from?.name,leg.to?.name,...(leg.intermediateStops||[]).map(s=>s.name)].filter(Boolean),brand=[leg.displayName,leg.routeLongName].filter(Boolean).join(' ');for(const [name,train,a,b]of lines){if(train?.test(brand)||names.some((n,i)=>a.test(n)&&names.some((m,j)=>i!==j&&b.test(m)))&&names.length>1){return {name,score:5,source,basis:'Recognised scenic railway · RailRoam indication, not a review score'};}}return null;}
 function html(leg,connection){const item=rating(leg||{from:{name:connection?.origin||connection?.from},to:{name:connection?.destination||connection?.to},displayName:connection?.serviceName});return item?`<p class="scenic-note"><a href="${source}" target="_blank" rel="noopener" title="${item.basis}. Views depend on daylight and the exact service.">Scenery <strong>${item.score}/5</strong> · ${item.name} ↗</a></p>`:'';}
 return {rating,html};
})();
