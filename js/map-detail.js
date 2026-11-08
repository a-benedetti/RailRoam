/* Regional map data is demand-loaded, debounced and shared by viewport. */
const RailRoamMapDetail=(()=>{
 const cache=new Map(),rail=new Set(['HIGHSPEED_RAIL','LONG_DISTANCE','NIGHT_RAIL','REGIONAL_RAIL','SUBURBAN','FERRY']);
 function frame(b){const lat=y=>Math.atan(Math.sinh(Math.log(Math.tan(Math.PI/4+67*Math.PI/360))-y/800))*180/Math.PI,lon=x=>x*180/(Math.PI*800)-13;return {west:lon(b.x),east:lon(b.x+b.w),north:lat(b.y),south:lat(b.y+b.h)};}
 function snapped(box){const step=box.east-box.west<2?.2:box.east-box.west<6?.5:1;return {west:Math.floor(box.west/step)*step,east:Math.ceil(box.east/step)*step,south:Math.floor(box.south/step)*step,north:Math.ceil(box.north/step)*step};}
 function intersects(coords,b,project){let previous;for(const p of coords){const next=project(p[0],p[1]);if(next.x>=b.x&&next.x<=b.x+b.w&&next.y>=b.y&&next.y<=b.y+b.h)return true;if(previous){const dx=next.x-previous.x,dy=next.y-previous.y,ps=[-dx,dx,-dy,dy],qs=[previous.x-b.x,b.x+b.w-previous.x,previous.y-b.y,b.y+b.h-previous.y];let low=0,high=1,valid=true;for(let i=0;i<4;i++){if(ps[i]===0){if(qs[i]<0){valid=false;break;}}else {const t=qs[i]/ps[i];if(ps[i]<0)low=Math.max(low,t);else high=Math.min(high,t);if(low>high){valid=false;break;}}}if(valid)return true;}previous=next;}return false;}

 function budget(width,height,focused=false){return Math.max(8,Math.min(60,Math.round(width*height/(focused?60000:33000))));}
 async function load(box,date,tz,signal){const bounds=snapped(box),key=JSON.stringify([bounds,date]);const old=cache.get(key);if(old&&old.expires>Date.now())return old.data;const data=await queryMapOverview(bounds,date,tz,signal);data.segments=data.segments.filter(s=>rail.has(s.mode)&&s.polyline&&s.from&&s.to);cache.set(key,{data,expires:Date.now()+10*60000});if(cache.size>12)cache.delete(cache.keys().next().value);return data;}
 return {frame,snapped,intersects,budget,load};
})();
window.RailRoamMapDetail=RailRoamMapDetail;
