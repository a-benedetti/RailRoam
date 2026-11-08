/* Classic-script map data works consistently in external browsers and file previews. */
const RailRoamAssets=(()=>{
 const pending=new Map();
 function load(path,name){if(pending.has(path))return pending.get(path);const task=(async()=>{
  if(window[name])return window[name];
  try{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(path+'.js',document.baseURI).href;script.onload=resolve;script.onerror=()=>reject(Error('Local map data could not load'));document.head.appendChild(script);});}catch(error){if(location.protocol==='file:')throw error;const response=await fetch(new URL(path,document.baseURI),{cache:'no-store'});if(!response.ok)throw error;return await response.json();}
  if(!window[name])throw Error('Invalid local map data');return window[name];
 })();pending.set(path,task);task.catch(()=>pending.delete(path));return task;}
 return {load};
})();
