'use strict';

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
let W, H;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!sim.anchorDragging) { sim.anchor.x = W / 2; }
}
window.addEventListener('resize', () => { resize(); wake(); });

// Sleep/wake
let sleepFrames = 0, sleeping = false, lastTime = performance.now();
function wake() {
  if (!sleeping) return;
  sleeping = false; sleepFrames = 0;
  lastTime = performance.now();
  requestAnimationFrame(animate);
}

// Physics
class VNode { constructor(x,y){this.x=x;this.y=y;this.oldX=x;this.oldY=y;} }

class RopeSim {
  constructor(segs=20,segLen=14){
    this.segs=segs; this.segLen=segLen;
    this.gravity=1800; this.damping=0.998;
    this.dt=1/240; this.acc=0; this.nodes=[];
    this.dragging=false; this.anchorDragging=false;
    this.dragTarget={x:0,y:0};
    this.anchor={x:200,y:50};
    this.reset();
  }
  reset(){
    this.nodes=[];
    for(let i=0;i<=this.segs;i++){
      const a=0.15;
      this.nodes.push(new VNode(
        this.anchor.x+Math.sin(a)*i*this.segLen,
        this.anchor.y+Math.cos(a)*i*this.segLen
      ));
    }
    this.acc=0;
  }
  isSettled(){
    return this.nodes.every(n=>Math.abs(n.x-n.oldX)<0.05&&Math.abs(n.y-n.oldY)<0.05);
  }
  step(dt){
    this.acc=Math.min(this.acc+dt,0.1);
    while(this.acc>=this.dt){this.advance(this.dt);this.acc-=this.dt;}
  }
  advance(dt){
    const a=this.nodes[0];
    a.x=a.oldX=this.anchor.x; a.y=a.oldY=this.anchor.y;
    for(let i=1;i<this.nodes.length;i++){
      const n=this.nodes[i];
      if(this.dragging&&i===this.nodes.length-1){n.oldX=n.x;n.oldY=n.y;n.x=this.dragTarget.x;n.y=this.dragTarget.y;continue;}
      const vx=(n.x-n.oldX)*this.damping, vy=(n.y-n.oldY)*this.damping;
      n.oldX=n.x; n.oldY=n.y; n.x+=vx; n.y+=vy+this.gravity*dt*dt;
    }
    for(let pass=0;pass<60;pass++){
      this.nodes[0].x=this.anchor.x; this.nodes[0].y=this.anchor.y;
      for(let i=0;i<this.nodes.length-1;i++){
        const n1=this.nodes[i],n2=this.nodes[i+1];
        const dx=n2.x-n1.x,dy=n2.y-n1.y;
        const dist=Math.sqrt(dx*dx+dy*dy)||0.001;
        const pct=((dist-this.segLen)/dist)*0.5;
        const ox=dx*pct,oy=dy*pct;
        if(i===0){n2.x-=ox*2;n2.y-=oy*2;}
        else if(this.dragging&&i+1===this.nodes.length-1){n1.x+=ox*2;n1.y+=oy*2;}
        else{n1.x+=ox;n1.y+=oy;n2.x-=ox;n2.y-=oy;}
      }
    }
  }
  end(){return this.nodes[this.nodes.length-1];}
  prev(){return this.nodes[this.nodes.length-2];}
}

const sim = new RopeSim();

// Charm loading
let charmImg=new Image(), charmLoaded=false, charmAR=1;
function loadCharm(src){
  charmLoaded=false; charmImg=new Image(); charmImg.crossOrigin='anonymous';
  charmImg.onload=()=>{charmLoaded=true;charmAR=(charmImg.naturalWidth||100)/(charmImg.naturalHeight||100);wake();};
  if(!src.startsWith('data:')&&!src.startsWith('http')){
    const parts=src.split('/');
    parts[parts.length-1]=encodeURIComponent(parts[parts.length-1]);
    src=parts.join('/');
  }
  charmImg.src=src;
}
loadCharm('assets/charms/Nazar Boncuğu.svg');

const sel=document.getElementById('charmSelect');
sel.addEventListener('change',e=>{loadCharm(`assets/charms/${e.target.value}`);wake();});

const fileInput=document.getElementById('fileInput');
document.getElementById('addSvgBtn').addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',e=>{
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=ev=>{
    const url=ev.target.result;
    const opt=document.createElement('option');
    opt.value=url; opt.textContent=`★ ${file.name}`; opt.selected=true;
    sel.appendChild(opt); loadCharm(url); wake();
  };
  r.readAsDataURL(file);
});

// Theme
let dark=window.matchMedia('(prefers-color-scheme: dark)').matches;
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',e=>{dark=e.matches;wake();});

// Mouse
let mx=0,my=0,hoverCharm=false,hoverUI=false;
const picker=document.getElementById('pickerContainer');
picker.addEventListener('mouseenter',()=>hoverUI=true);
picker.addEventListener('mouseleave',()=>hoverUI=false);

function inAnchor(x,y){return Math.abs(x-sim.anchor.x)<80&&y<sim.anchor.y+30;}
function charmDist(x,y){const e=sim.end();const dx=x-e.x,dy=y-(e.y+40);return Math.sqrt(dx*dx+dy*dy);}

window.addEventListener('mousemove',e=>{
  const px=mx,py=my; mx=e.clientX; my=e.clientY;
  if(sim.anchorDragging){
    sim.anchor.x=Math.max(10,Math.min(W-10,sim.anchor.x+(mx-px)));
    sim.anchor.y=Math.max(4,Math.min(H/2,sim.anchor.y+(my-py)));
    wake(); return;
  }
  if(sim.dragging){sim.dragTarget={x:mx,y:my-40};wake();}
  hoverCharm=charmDist(mx,my)<=52;
});

window.addEventListener('mousedown',e=>{
  if(hoverUI) return;
  if(inAnchor(e.clientX,e.clientY)){sim.anchorDragging=true;wake();return;}
  if(charmDist(e.clientX,e.clientY)<=55){sim.dragging=true;sim.dragTarget={x:e.clientX,y:e.clientY-40};wake();}
});
window.addEventListener('mouseup',()=>{sim.anchorDragging=false;sim.dragging=false;wake();});

// Draw
function drawAnchor(nodes){
  const ax=nodes[0].x,ay=nodes[0].y;
  ctx.beginPath(); ctx.moveTo(ax-10,ay); ctx.lineTo(ax+10,ay);
  ctx.strokeStyle=dark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.28)';
  ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(ax,ay,3.5,0,Math.PI*2);
  ctx.fillStyle=dark?'rgba(255,255,255,0.6)':'rgba(80,60,40,0.8)'; ctx.fill();
}

function draw(nodes){
  ctx.clearRect(0,0,W,H);
  drawAnchor(nodes);
  ctx.beginPath(); ctx.moveTo(nodes[0].x,nodes[0].y);
  for(let i=1;i<nodes.length;i++) ctx.lineTo(nodes[i].x,nodes[i].y);
  ctx.strokeStyle=dark?'#8c7b6b':'#594d43'; ctx.lineWidth=2.5;
  ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke();

  for(let i=3;i<nodes.length-2;i+=3){
    const p=nodes[i];
    ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2);
    const g=ctx.createRadialGradient(p.x-1,p.y-1,0.5,p.x,p.y,4);
    g.addColorStop(0,'#e8c88a'); g.addColorStop(1,'#a07840');
    ctx.fillStyle=g; ctx.shadowColor='rgba(0,0,0,0.25)'; ctx.shadowBlur=4;
    ctx.fill(); ctx.shadowBlur=0;
  }

  const end=nodes[nodes.length-1],prev=nodes[nodes.length-2];
  const angle=Math.atan2(end.y-prev.y,end.x-prev.x)-Math.PI/2;
  ctx.save(); ctx.translate(end.x,end.y); ctx.rotate(angle);
  if(charmLoaded){
    const cH=88,cW=cH*charmAR;
    ctx.shadowColor='rgba(0,0,0,0.22)'; ctx.shadowBlur=12; ctx.shadowOffsetY=6;
    ctx.drawImage(charmImg,-cW/2,2,cW,cH);
  } else {
    ctx.beginPath(); ctx.arc(0,38,36,0,Math.PI*2); ctx.fillStyle='#3080a8'; ctx.fill();
  }
  ctx.restore();

  if(hoverCharm&&!sim.dragging){
    const cH=88,cW=cH*charmAR;
    ctx.save(); ctx.translate(end.x,end.y); ctx.rotate(angle);
    ctx.beginPath(); ctx.ellipse(0,cH/2+2,cW/2+4,cH/2+4,0,0,Math.PI*2);
    ctx.strokeStyle='rgba(100,160,255,0.35)'; ctx.lineWidth=2; ctx.stroke();
    ctx.restore();
  }
}

function animate(now){
  const dt=Math.min((now-lastTime)/1000,0.05); lastTime=now;
  sim.step(dt);
  if(!sim.dragging&&!sim.anchorDragging&&sim.isSettled()){
    if(++sleepFrames>90){sleeping=true;sleepFrames=0;draw(sim.nodes);return;}
  } else { sleepFrames=0; }
  draw(sim.nodes); requestAnimationFrame(animate);
}

resize();
sim.anchor.x=W/2; sim.anchor.y=50; sim.reset();
lastTime=performance.now();
requestAnimationFrame(animate);
