/* Geographic importance supports map prominence; visitability uses the
 * sourced visitor survey when available, with an unrated neutral fallback.
 */
const CityRanking=(()=>{
 const significance=new Map(Object.entries(EXPLORER_IMPORTANCE).map(([name,value])=>[canonicalCityKey(name),value]));
 EXPLORER_EXTRA_CITIES.forEach(([city,,,,importance])=>{const key=canonicalCityKey(city);if(!significance.has(key))significance.set(key,importance);});
 const capitals=new Set(['London','Paris','Berlin','Madrid','Rome','Vienna','Amsterdam','Brussels','Copenhagen','Stockholm','Oslo','Helsinki','Tallinn','Warsaw','Prague','Bratislava','Budapest','Ljubljana','Zagreb','Sarajevo','Belgrade','Podgorica','Sofia','Bucharest','Athens','Ankara','Lisbon'].map(canonicalCityKey));
 function importance(city){const key=canonicalCityKey(city);return Math.min(100,Math.max(capitals.has(key)?82:0,significance.get(key)||58));}
 function visitability(city){const key=canonicalCityKey(city);const external=typeof RailRoamScores==='undefined'?null:RailRoamScores.city(city);return external?.visit!=null?external.visit*2:5;}
 function score(city){return .45*(importance(city)/10)+.55*visitability(city);}
 return {score,importance,visitability};
})();
