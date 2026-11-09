/* Short practical reminders; deterministic rotation, no background API calls. */
window.RailRoamTips=(()=>{let n=Math.floor(Math.random()*6);const tips=[
 'A night train can save you a hotel night. Check whether a berth reservation is required.',
 'One longer stay usually means fewer travel days, fewer check-ins and more time to get to know a place.',
 'A refillable bottle is handy on long train days. Many big stations have drinking-water fountains.',
 'The busiest sights are often quieter early in the morning. Check opening times before setting off.',
 'Regional trains sometimes take the prettier route. They can also save you a compulsory seat reservation.',
 'A rail pass is not always a reservation. Check the rules for each train, especially sleepers and high-speed services.'
 ];return {pick:()=>tips[n++%tips.length]};})();
