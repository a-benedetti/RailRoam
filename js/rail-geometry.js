/* Geographic rail paths. Overview routing does not alter timetable routing. */
const RailGeometry=(()=>{
 let graph=null,promise=null,adj=[],components=[],grid=new Map(),shapeGrid=new Map();const cache=new Map(),snaps=new Map();
 const distance=(a,b)=>Math.hypot((a[0]-b[0])*Math.cos((a[1]+b[1])*Math.PI/360),a[1]-b[1])*111;
 const key=p=>`${Math.floor(p[0]*5)},${Math.floor(p[1]*5)}`;
 function load(){
  if(promise)return promise;
  promise=(typeof RailRoamAssets==='undefined'?fetch('data/rail-network.json').then(r=>{if(!r.ok)throw Error('Rail geometry unavailable');return r.json()}):RailRoamAssets.load('data/rail-network.json','RailRoamRailData')).then(data=>{
   graph=data;adj=graph.nodes.map(()=>[]);
   graph.edges.forEach(([a,b,coords],i)=>{let length=0;for(let j=1;j<coords.length;j++)length+=distance(coords[j-1],coords[j]);adj[a].push([b,length,i]);adj[b].push([a,length,i]);});
   const ids=new Int32Array(graph.nodes.length).fill(-1),sizes=[];
   graph.nodes.forEach((p,i)=>{const k=key(p);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);if(ids[i]>=0)return;const stack=[i],id=sizes.length;ids[i]=id;let size=0;while(stack.length){const n=stack.pop();size++;for(const [z]of adj[n])if(ids[z]<0){ids[z]=id;stack.push(z);}}sizes.push(size);});
   components=Array.from(ids,id=>sizes[id]);
   graph.edges.forEach(([a,b,coords],edge)=>{if(components[a]<60)return;coords.forEach((p,index)=>{const k=key(p);if(!shapeGrid.has(k))shapeGrid.set(k,[]);shapeGrid.get(k).push([edge,index]);});});
   // The source predates through-running on Marmaray. Add the existing tunnel
   // corridor so overview trains do not detour around the Black Sea.
   const marmaray=[[28.976,41.015],[28.994,41.013],[29.015,41.025],[29.023,41.011],[29.031,40.999]];
   const west=snap({lon:28.976,lat:41.015}),east=snap({lon:29.031,lat:40.999});
   if(west&&east){const coords=[graph.nodes[west.id],...marmaray,graph.nodes[east.id]];let length=0;for(let i=1;i<coords.length;i++)length+=distance(coords[i-1],coords[i]);const e=graph.edges.length;graph.edges.push([west.id,east.id,coords]);adj[west.id].push([east.id,length,e]);adj[east.id].push([west.id,length,e]);}
   return data;
  }).catch(error=>{promise=null;throw error;});return promise;
 }
 function nearest(place){
  const p=[+place.lon,+place.lat],x=Math.floor(p[0]*5),y=Math.floor(p[1]*5),candidates=[];
  for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(const i of grid.get(`${x+dx},${y+dy}`)||[])if(components[i]>60)candidates.push([distance(p,graph.nodes[i]),i]);
  candidates.sort((a,b)=>a[0]-b[0]);return candidates.slice(0,5);
 }
 function snap(place){
  const code=[place.lon,place.lat].map(n=>(+n).toFixed(4)).join('|');if(snaps.has(code))return snaps.get(code);
  const p=[+place.lon,+place.lat],x=Math.floor(p[0]*5),y=Math.floor(p[1]*5);let best=Infinity,match=null;
  for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(const [edge,index]of shapeGrid.get(`${x+dx},${y+dy}`)||[]){const d=distance(p,graph.edges[edge][2][index]);if(d<best){best=d;match={edge,index};}}
  if(!match)return null;
  const [a,b,coords]=graph.edges[match.edge];
  if(match.index===0)match.id=a;else if(match.index===coords.length-1)match.id=b;
  else{
   const id=graph.nodes.length;graph.nodes.push(coords[match.index]);adj.push([]);components.push(components[a]);match.id=id;
   for(const [end,points]of [[a,coords.slice(0,match.index+1)],[b,coords.slice(match.index).reverse()]]){
    let length=0;for(let j=1;j<points.length;j++)length+=distance(points[j-1],points[j]);
    const e=graph.edges.length;graph.edges.push([end,id,points]);adj[end].push([id,length,e]);adj[id].push([end,length,e]);
   }
  }
  snaps.set(code,match);return match;
 }
 function path(from,to){
  if(!graph||!from||!to)return [];
  const code=[from.lat,from.lon,to.lat,to.lon].map(n=>(+n).toFixed(3)).join('|');if(cache.has(code))return cache.get(code);
  const source=snap(from),destination=snap(to);if(!source||!destination)return [];
  if(source.edge===destination.edge){const coords=graph.edges[source.edge][2],a=source.index,b=destination.index;const result=a<b?coords.slice(a,b+1):coords.slice(b,a+1).reverse();cache.set(code,result);return result;}
  const starts=[[0,source.id]],ends=[[0,destination.id]];
  const target=ends[0][1],start=starts[0][1];const n=graph.nodes.length,cost=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),prevEdge=new Int32Array(n).fill(-1),heap=[];
  const push=item=>{heap.push(item);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=item[0])break;heap[i]=heap[p];i=p;}heap[i]=item;};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;};
  const targets=new Set(ends.map(x=>x[1]));for(const [d,i]of starts){cost[i]=d;push([d+distance(graph.nodes[i],graph.nodes[target]),i,d]);}
  let found=-1,steps=0;
  while(heap.length&&steps++<n*3){const [,a,g]=pop();if(g>cost[a])continue;if(targets.has(a)){found=a;break;}for(const [b,w,e]of adj[a]){const next=g+w;if(next<cost[b]){cost[b]=next;prev[b]=a;prevEdge[b]=e;push([next+distance(graph.nodes[b],graph.nodes[target]),b,next]);}}}
  let coords=[];
  if(found>=0){const pieces=[];for(let b=found;prev[b]>=0;b=prev[b]){const edge=graph.edges[prevEdge[b]],points=edge[0]===prev[b]?edge[2]:[...edge[2]].reverse();pieces.push(points);}for(const points of pieces.reverse())coords.push(...(coords.length?points.slice(1):points));}
  cache.set(code,coords);return coords;
 }
 function decode(encoded,precision=6){
  if(!encoded)return [];let i=0,lat=0,lon=0,result=[];const factor=10**precision;
  while(i<encoded.length){const value=()=>{let shift=0,bits=0,b;do{b=encoded.charCodeAt(i++)-63;bits|=(b&31)<<shift;shift+=5;}while(b>=32&&i<encoded.length);return bits&1?~(bits>>1):bits>>1;};lat+=value();lon+=value();result.push([lon/factor,lat/factor]);}return result;
 }
 function legPath(leg){const shape=leg.legGeometry;if(shape?.points){const coords=decode(shape.points,shape.precision||6);if(coords.length>2)return coords;}return path(leg.from,leg.to);}
 function displayPath(coords,project,unit=1){
  if(coords.length<2)return '';
  const raw=coords.map(([lon,lat])=>project(lon,lat)),tolerance=3*unit;
  const simplify=points=>{
   if(points.length<3)return points;const a=points[0],b=points.at(-1),dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;let max=0,index=0;
   for(let i=1;i<points.length-1;i++){const p=points[i],t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0,d=(p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;if(d>max){max=d;index=i;}}
   return max>tolerance*tolerance?[...simplify(points.slice(0,index+1)).slice(0,-1),...simplify(points.slice(index))]:[a,b];
  };
  const points=simplify(raw),angular=[points[0]];
  for(let i=1;i<points.length;i++){
   const a=angular.at(-1),b=points[i],dx=b.x-a.x,dy=b.y-a.y;
   // Short segments use the quiet horizontal/vertical/45° grammar of rail maps.
   if(Math.hypot(dx,dy)<40*unit&&Math.abs(dx)>4*unit&&Math.abs(dy)>4*unit){const elbow=Math.abs(dx)>Math.abs(dy)?{x:b.x-Math.sign(dx)*Math.abs(dy),y:a.y}:{x:a.x,y:b.y-Math.sign(dy)*Math.abs(dx)};angular.push(elbow);}
   angular.push(b);
  }
  const fmt=p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`;let d='M'+fmt(angular[0]);
  for(let i=1;i<angular.length-1;i++){
   const a=angular[i-1],b=angular[i],c=angular[i+1],ab=Math.hypot(b.x-a.x,b.y-a.y),bc=Math.hypot(c.x-b.x,c.y-b.y),r=Math.min(3*unit,ab/3,bc/3);
   if(!ab||!bc)continue;
   const before={x:b.x+(a.x-b.x)*r/ab,y:b.y+(a.y-b.y)*r/ab},after={x:b.x+(c.x-b.x)*r/bc,y:b.y+(c.y-b.y)*r/bc};d+=' L'+fmt(before)+' Q'+fmt(b)+' '+fmt(after);
  }
  return d+' L'+fmt(angular.at(-1));
 }
 return {load,path,decode,legPath,displayPath,get ready(){return !!graph;}};
})();
