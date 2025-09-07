const canvas = document.getElementById('pad');
const ctx = canvas.getContext('2d');
ctx.fillStyle = "#000"; ctx.fillRect(0,0,canvas.width,canvas.height);
ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
ctx.lineJoin = "round"; ctx.lineCap = "round";

let drawing=false;
canvas.addEventListener("mousedown", e => {drawing=true; ctx.beginPath(); ctx.moveTo(e.offsetX,e.offsetY);});
canvas.addEventListener("mousemove", e => { if(drawing){ctx.lineTo(e.offsetX,e.offsetY); ctx.stroke();}});
canvas.addEventListener("mouseup", ()=>drawing=false);
canvas.addEventListener("mouseleave", ()=>drawing=false);

document.getElementById("clearBtn").onclick = ()=>{
  ctx.fillStyle="#000"; ctx.fillRect(0,0,canvas.width,canvas.height);
};

const bar=document.getElementById("bar");
const out=document.getElementById("outText");

async function recognize(){
  out.value="Recognizing…";
  bar.style.width="0%";
  const worker=await Tesseract.createWorker("eng", 1, {
    langPath: "tesseract/langs",  // load traineddata locally
    corePath: "tesseract/tesseract-core.wasm.js",
    logger: m=>{
      if(m.status==="recognizing text")
        bar.style.width=(m.progress*100).toFixed(0)+"%";
    }
  });
  const {data:{text}} = await worker.recognize(canvas);
  out.value=text.trim();
  await worker.terminate();
  bar.style.width="100%";
}
document.getElementById("recognizeBtn").onclick=recognize;
