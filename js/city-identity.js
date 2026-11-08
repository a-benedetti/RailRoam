/* City-level identity for station variants and local-language station names. */
const RailRoamCityIdentity=(()=>{
 const names=[...Object.keys(EXPLORER_IMPORTANCE),...EXPLORER_EXTRA_CITIES.map(c=>c[0]),...AUTO_HUBS.map(c=>c.city)];
 const labels=new Map(),prefixes=[];
 for(const name of new Set(names)){const key=canonicalCityKey(name);labels.set(key,name);prefixes.push([norm(name),key]);for(const alias of CITY_ALIASES[canonicalCityKey(name)]||[])prefixes.push([norm(alias),key]);}
 for(const [alias,english] of [['Koebenhavn','Copenhagen'],['Kobenhavn','Copenhagen'],['Muenchen','Munich']])prefixes.push([norm(alias),canonicalCityKey(english)]);
 prefixes.sort((a,b)=>b[0].length-a[0].length);
 const cache=new Map();
 function identify(place){const text=typeof place==='string'?place:place?.city||place?.name||place?.label||'',raw=String(text).replace(/^(?:S\+U|S|U)\s+/i,''),n=norm(raw),cacheKey=n+(typeof place==='object'&&place?.lat!=null?'|'+Number(place.lat).toFixed(2)+'|'+Number(place.lon).toFixed(2):'');if(cache.has(cacheKey))return cache.get(cacheKey);let key=canonicalCityKey(raw);
  if(!labels.has(key)){const match=prefixes.find(([prefix])=>n===prefix||n.startsWith(prefix+' '));if(match)key=match[1];else {key=canonicalCityKey(cleanCityFromStation(raw));if(typeof place==='object'&&!place.city&&place.lat!=null&&place.lon!=null){const nearby=AUTO_HUBS.map(city=>({city,km:geoKm(city,place)})).filter(x=>x.km<20).sort((a,b)=>a.km-b.km)[0];if(nearby)key=canonicalCityKey(nearby.city.city);}}}
  const value={key,city:labels.get(key)||cleanCityFromStation(raw)};cache.set(cacheKey,value);return value;
 }
 return {key:p=>identify(p).key,name:p=>identify(p).city,identify};
})();
window.RailRoamCityIdentity=RailRoamCityIdentity;
