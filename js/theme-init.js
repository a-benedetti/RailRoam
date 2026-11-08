/* Runs before CSS/first paint, including a full planner reset. */
(()=>{let mode='system';try{mode=localStorage.getItem('railroam-theme')||mode;}catch{}const dark=mode==='dark'||mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';})();
