/* Static-host friendly request broker. Raw responses only: user constraints are
 * always checked again by callers. Abort one consumer without cancelling others. */
const RailRoamTimetables=(()=>{
 const TTL=10*60*1000,MAX_BYTES=8*1024*1024,MAX_PERSIST_BYTES=4*1024*1024,MAX_RESPONSE_BYTES=2*1024*1024,MAX_ENTRIES=100,CONCURRENCY=6,STORE='railroam-timetables-v1';
 const noCache=typeof location!=='undefined'&&new URLSearchParams(location.search).get('qaNoCache')==='1';
 const cache=new Map(),pending=new Map(),queue=[],priorities=new WeakMap();
 let active=0,background=0,bytes=0,persistTimer;
 const stats={requests:0,hits:0,shared:0,aborted:0,networkMs:0,maxActive:0};
 const abortError=()=>Object.assign(Error('Search cancelled'),{name:'AbortError'});
 try{if(!noCache)for(const [key,entry]of JSON.parse(localStorage.getItem(STORE)||'[]'))if(entry.expires>Date.now()&&entry.size<=MAX_RESPONSE_BYTES){cache.set(key,entry);bytes+=entry.size;}}catch{}
 function prune(){for(const [key,e]of cache)if(e.expires<=Date.now()){cache.delete(key);bytes-=e.size;}for(const [key,e]of [...cache].sort((a,b)=>(b[1].priority??2)-(a[1].priority??2))){if(bytes<=MAX_BYTES&&cache.size<=MAX_ENTRIES)break;cache.delete(key);bytes-=e.size;}}
 prune();
 function persist(){clearTimeout(persistTimer);persistTimer=setTimeout(()=>{try{prune();const disk=[];let size=0;for(const item of [...cache].reverse().sort((a,b)=>(a[1].priority??2)-(b[1].priority??2))){if(size+item[1].size>MAX_PERSIST_BYTES)continue;disk.unshift(item);size+=item[1].size;}localStorage.setItem(STORE,JSON.stringify(disk));}catch{}},250);}
 function remember(key,data,priority){if(noCache)return;const size=JSON.stringify(data).length*2;if(size>MAX_RESPONSE_BYTES)return;const old=cache.get(key);if(old)bytes-=old.size;cache.delete(key);cache.set(key,{data,size,priority,expires:Date.now()+TTL});bytes+=size;prune();persist();}
 function pump(){while(active<CONCURRENCY&&queue.length){queue.sort((a,b)=>a.priority-b.priority);const index=queue.findIndex(j=>j.controller.signal.aborted||j.priority<2||background<2);if(index<0)return;const job=queue.splice(index,1)[0];if(job.controller.signal.aborted){job.reject(abortError());continue;}active++;job.background=job.priority>=2;if(job.background)background++;stats.maxActive=Math.max(stats.maxActive,active);stats.requests++;const started=performance.now();let timer=setTimeout(()=>job.controller.abort(),job.timeout);
   (async()=>{try{let data;for(let attempt=0;attempt<2;attempt++){try{const response=await fetch(job.key,{signal:job.controller.signal});if(!response.ok){let body='';try{body=await response.text();}catch{}const error=Error(`Timetable API returned ${response.status}`);error.status=response.status;error.details=body.slice(0,1200);throw error;}data=await response.json();break;}catch(error){const transient=error.name!=='AbortError'&&(!error.status||[429,502,503,504].includes(error.status));if(attempt||!transient||job.controller.signal.aborted)throw error;await new Promise(resolve=>setTimeout(resolve,250));if(job.controller.signal.aborted)throw abortError();}}
    if(job.controller.signal.aborted)throw abortError();remember(job.key,data,job.priority);job.resolve(data);}catch(e){job.reject(e);}finally{clearTimeout(timer);stats.networkMs+=performance.now()-started;active--;if(job.background)background--;pump();}})();
 }}
 function request(url,signal,timeout=25000){
  if(signal?.aborted)return Promise.reject(abortError());const priority=signal?(priorities.get(signal)??0):2,key=String(url),saved=noCache?null:cache.get(key);
  if(saved&&saved.expires>Date.now()){stats.hits++;saved.priority=Math.min(saved.priority??2,priority);cache.delete(key);cache.set(key,saved);return Promise.resolve(saved.data);}
  let job=pending.get(key);
  if(job?.controller.signal.aborted){pending.delete(key);job=null;}
  if(job){stats.shared++;job.priority=Math.min(job.priority,priority);}
  else {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});job={key,promise,resolve,reject,timeout,controller:new AbortController(),consumers:0,priority};pending.set(key,job);queue.push(job);const own=job;promise.finally(()=>{if(pending.get(key)===own)pending.delete(key);}).catch(()=>{});pump();}
  job.consumers++;pump();
  return new Promise((resolve,reject)=>{let done=false;const release=()=>{if(done)return false;done=true;signal?.removeEventListener('abort',abort);job.consumers--;return true;};const abort=()=>{if(!release())return;stats.aborted++;if(!job.consumers)job.controller.abort();reject(abortError());};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}job.promise.then(data=>{if(release())resolve(data);},e=>{if(release())reject(e);});});
 }
 function snapshot(){return {...stats,active,queued:queue.length,entries:cache.size,bytes};}
 return {request,snapshot,prioritize:(signal,priority)=>priorities.set(signal,priority)};
})();
window.RailRoamTimetables=RailRoamTimetables;
