/* Per-search cancellation: old responses cannot replace a newer search. */
const RailRoamSearch=(()=>{
 let current=null,sequence=0;
 function start(mode){current?.controller.abort();const session={id:++sequence,mode,controller:new AbortController(),started:performance.now(),baseline:window.RailRoamTimetables?.snapshot()};current=session;document.getElementById('cancelSearch').hidden=false;return session;}
 async function run(task,session){const signal=session.controller.signal;let abort;try{return await Promise.race([task,new Promise((_,reject)=>{abort=()=>reject(Object.assign(Error('Search cancelled'),{name:'AbortError'}));if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});})]);}finally{if(abort)signal.removeEventListener('abort',abort);}}
 function finish(session){if(current!==session)return false;report(session);current=null;document.getElementById('cancelSearch').hidden=true;return true;}
 function cancel(){if(!current)return;const previous=current;current=null;previous.controller.abort();previous.restore?.();previous.restore=null;report(previous,true);document.getElementById('cancelSearch').hidden=true;const button=document.getElementById('planBtn');button.disabled=false;button.classList.remove('loading');document.dispatchEvent(new CustomEvent('railroam:cancel',{detail:previous.mode}));}
 function progress(session,count){if(!session.firstResultMs)session.firstResultMs=performance.now()-session.started;session.resultCount=count;report(session);}
 function report(session,cancelled=false){const now=window.RailRoamTimetables?.snapshot(),base=session.baseline;const delta={};if(now&&base)for(const key of ['requests','hits','shared','networkMs'])delta[key]=now[key]-base[key];window.RailRoamSearchMetrics={mode:session.mode,cancelled,totalMs:Math.round(performance.now()-session.started),firstResultMs:session.firstResultMs?Math.round(session.firstResultMs):null,phases:session.phases||{},cacheEntries:now?.entries,cacheBytes:now?.bytes,...delta};document.documentElement?.setAttribute('data-search-metrics',JSON.stringify(window.RailRoamSearchMetrics));}
 document.getElementById('cancelSearch').onclick=cancel;
 return {start,run,finish,cancel,progress,isCurrent:session=>current===session};
})();
