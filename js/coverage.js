/* A stale audit or network error never becomes a permanent service ban. */
window.RailRoamCoverage=(()=>{
 const data=window.RailRoamCoverageData,active=localYmd(new Date())<=data.validUntil,key=p=>canonicalCityKey(cleanCityFromStation(typeof p==='string'?p:p?.city||p?.name||p?.label||'')),cities=new Map(Object.entries(data.cities).map(([n,v])=>[key(n),v]));
 const empty=Object.values(data.cities).filter(c=>c.status==='empty');
 function selectable(p){const requested=typeof appState==='undefined'?null:appState.dateChoices?.leave;if(!active||!p||requested&&requested.mode!=='any'&&requested.from>data.validUntil)return true;const city=cities.get(key(p));if(city)return city.status!=='empty';if(typeof p==='object'&&p.lat!=null&&p.lon!=null)return !empty.some(c=>geoKm(c,p)<6);return true;}
 function muted(feature){return active&&data.countries[feature.properties?.ISO_A3]?.status==='no-connection';}
 for(const list of [AUTO_HUBS,EXPLORER_EXTRA_CITIES])for(let i=list.length-1;i>=0;i--){const p=Array.isArray(list[i])?{city:list[i][0],lat:list[i][1],lon:list[i][2]}:list[i];if(!selectable(p))list.splice(i,1);}
 for(let i=EXPLORER_CONNECTIONS.length-1;i>=0;i--)if(!selectable(EXPLORER_CONNECTIONS[i].from)||!selectable(EXPLORER_CONNECTIONS[i].to))EXPLORER_CONNECTIONS.splice(i,1);
 return {selectable,muted,reviewed:data.reviewed};
})();
