/* Render the existing summary layout locally, preserving Unicode station names. */
const RailRoamPdf=(()=>{
 let loading;
 function script(src){return new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=src;tag.onload=resolve;tag.onerror=()=>reject(Error('PDF tools could not load. Retry the download.'));document.head.appendChild(tag);});}
 async function download(html){
  if(!loading)loading=Promise.all([script('vendor/jspdf.umd.min.js'),script('vendor/html2canvas.min.js')]).catch(e=>{loading=null;throw e;});await loading;
  const frame=document.createElement('iframe');frame.title='Preparing route PDF';frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-10000px;top:0;width:820px;height:1100px;border:0;';
  const loaded=new Promise(resolve=>frame.onload=resolve);frame.srcdoc=html;document.body.appendChild(frame);
  try{await loaded;const doc=frame.contentDocument;doc.querySelector('button')?.remove();await doc.fonts.ready;
   const body=doc.body,rect=body.getBoundingClientRect(),canvas=await html2canvas(body,{scale:2,backgroundColor:'#ffffff',logging:false,windowWidth:820,scrollX:0,scrollY:0});
   const pdf=new jspdf.jsPDF({unit:'mm',format:'a4',compress:true});pdf.setProperties({title:'RailRoam planned route',creator:'RailRoam'});
   const width=190,pagePixels=277*canvas.width/width,ratio=canvas.height/rect.height;
   const breaks=[...doc.querySelectorAll('section,tr,footer,p,.rules-group,.rules-group li')].map(el=>(el.getBoundingClientRect().bottom-rect.top)*ratio).sort((a,b)=>a-b);
   let offset=0,page=0;while(offset<canvas.height){let end=Math.min(canvas.height,offset+pagePixels);if(end<canvas.height){const safe=breaks.filter(n=>n<=end&&n>offset+pagePixels*.4).at(-1);if(safe)end=Math.ceil(safe);}
    const tile=document.createElement('canvas');tile.width=canvas.width;tile.height=Math.ceil(end-offset);tile.getContext('2d').drawImage(canvas,0,offset,canvas.width,tile.height,0,0,canvas.width,tile.height);
    if(page++)pdf.addPage();pdf.addImage(tile.toDataURL('image/png'),'PNG',10,10,width,tile.height*width/canvas.width,undefined,'FAST');
    // Keep the source operator links clickable in the PDF.
    for(const a of doc.querySelectorAll('a[href]')){const r=a.getBoundingClientRect(),y=(r.top-rect.top)*ratio;if(y>=offset&&y<end)pdf.link(10+(r.left-rect.left)*ratio*width/canvas.width,10+(y-offset)*width/canvas.width,r.width*ratio*width/canvas.width,r.height*ratio*width/canvas.width,{url:a.href});}
    offset=end;
   }
   pdf.save('RailRoam-route.pdf');
  }finally{frame.remove();}
 }
 return {download};
})();
