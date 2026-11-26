const $=id=>document.getElementById(id);
const stage=$("stage"),EDGE=9,LV=3; // LV = number of blur steps between sharp and fully blurred
let cur=0,k=0,cart=0,mode=0,v=0;
const mk=l=>{const c=document.createElement("canvas");c.className="item l"+(l||0);stage.appendChild(c);return c};
const mkB=()=>Array.from({length:LV},(_,i)=>mk(i+1));
const items=P.map(()=>mk()),blurs=P.map(mkB);
const kit={s:mk(),b:mkB()},hw={s:mk(),b:mkB()};

function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}

/* Every view is drawn ONCE into a bitmap; sliding only moves bitmaps (smooth in Firefox).
   kind 0 = the product as shown in the slider, 1 = kit (loose parts), 2 = hardware only (small board). */
function draw(cv,p,kind){
  const dpr=Math.min(window.devicePixelRatio||1,2),W=p.w,H=p.h;
  const hw_=.3536*(W+H)*k,hh=.1768*(W+H)*k,m=70*k,bt=140*k;
  const cw=Math.ceil(2*(hw_+m)),ch=Math.ceil(m+2*hh+bt),cx=cw/2,cy=m+hh;
  cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr);
  cv.style.width=cw+"px";cv.style.height=ch+"px";
  cv.style.marginLeft=(-cx)+"px";cv.style.marginTop=(-cy)+"px";
  const c=cv.getContext("2d");
  const set=dy=>c.setTransform(dpr*.7071*k,dpr*-.3536*k,dpr*.7071*k,dpr*.3536*k,dpr*cx,dpr*(cy+dy));
  c.clearRect(0,0,cv.width,cv.height);
  const col=kind===2?{c1:"#3d4044",c2:"#2a2d30",e:"#141618",tc:"#999"}:p;
  const pcs=kind===0?[[0,0,W,H]]:kind===1?[[0,-.2*H,.9*W,.5*H],[-.3*W,.33*H,.3*W,.28*H],[.18*W,.33*H,.5*W,.28*H]]:[[0,0,.55*W,.42*H]];
  pcs.sort((a,b)=>(a[1]-a[0])-(b[1]-b[0]));
  // soft shadows (shapes drawn far off-canvas, only the blurred shadow lands here)
  set(-4000);
  c.shadowColor="rgba(0,0,0,.16)";c.shadowBlur=24*k*dpr;c.shadowOffsetY=(4000+30*k)*dpr;c.fillStyle="#000";
  pcs.forEach(q=>{rr(c,q[0]-q[2]/2,q[1]-q[3]/2,q[2],q[3],14);c.fill()});
  c.shadowColor="transparent";c.shadowBlur=0;c.shadowOffsetY=0;
  pcs.forEach(q=>{
    const x=q[0]-q[2]/2,y=q[1]-q[3]/2,w=q[2],h=q[3];
    c.fillStyle=col.e;
    for(let d=EDGE;d>=1;d--){set(d*k);rr(c,x,y,w,h,14);c.fill()}
    set(0);rr(c,x,y,w,h,14);
    const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,col.c1);g.addColorStop(1,col.c2);
    c.fillStyle=g;c.fill();c.lineWidth=1.2/k;c.strokeStyle="rgba(255,255,255,.35)";c.stroke();
  });
  if(kind===0){c.font="13px 'JetBrains Mono',monospace";c.textAlign="right";c.fillStyle=p.tc;c.globalAlpha=.75;c.fillText(p.n,W/2-28,H/2-20);c.globalAlpha=1}
  if(kind===2){c.fillStyle="#d8d8cf";[[-.12,-.06,.1,.1],[.04,.02,.07,.07],[.13,-.07,.05,.05]].forEach(q=>c.fillRect(q[0]*W,q[1]*H,q[2]*W,q[3]*H))}
}
// Does this browser really blur with ctx.filter? (Safari/iOS: no, it is disabled by default.) Tested once by drawing.
const NATIVE_BLUR=(()=>{try{
  const t=document.createElement("canvas");t.width=t.height=9;const c=t.getContext("2d");
  if(!("filter" in c))return false;
  c.filter="blur(2px)";c.fillRect(3,3,3,3);
  return c.getImageData(2,4,1,1).data[3]>0; // pixel just outside the square: only non-zero if it was blurred
}catch(e){return false}})();
// Software Gaussian blur (3 box passes) for browsers without ctx.filter. Works on premultiplied colour so edges stay clean.
function boxSizes(sg,n){
  let w=Math.floor(Math.sqrt(12*sg*sg/n+1));if(w%2===0)w--;
  const m=Math.round((12*sg*sg-n*w*w-4*n*w-3*n)/(-4*w-4));
  return Array.from({length:n},(_,i)=>((i<m?w:w+2)-1)/2); // box radii
}
function boxPass(a,t,w,h,r,vert){
  const k=1/(2*r+1),st=vert?w*4:4,len=vert?h:w,lines=vert?w:h;
  for(let l=0;l<lines;l++){
    const o=vert?l*4:l*w*4;
    for(let ch=0;ch<4;ch++){
      let sum=0;
      for(let i=0;i<=r&&i<len;i++)sum+=a[o+i*st+ch];
      for(let i=0;i<len;i++){
        t[o+i*st+ch]=sum*k;
        if(i+r+1<len)sum+=a[o+(i+r+1)*st+ch];
        if(i-r>=0)sum-=a[o+(i-r)*st+ch];
      }
    }
  }
}
function softBlur(c,w,h,sg){
  const im=c.getImageData(0,0,w,h),d=im.data,n=w*h*4;
  let a=new Float32Array(n),t=new Float32Array(n);
  for(let i=0;i<n;i+=4){const al=d[i+3]/255;a[i]=d[i]*al;a[i+1]=d[i+1]*al;a[i+2]=d[i+2]*al;a[i+3]=d[i+3]}
  boxSizes(sg,3).forEach(r=>{boxPass(a,t,w,h,r,false);boxPass(t,a,w,h,r,true)}); // each pass ends back in a
  for(let i=0;i<n;i+=4){const al=a[i+3]/255;
    if(al>0){d[i]=a[i]/al;d[i+1]=a[i+1]/al;d[i+2]=a[i+2]/al}
    d[i+3]=a[i+3]}
  c.putImageData(im,0,0);
}
// blurred copies, baked once: LV steps from slightly to fully blurred (b is an array, b[0] = least blurred)
function bake(b,s){
  b.forEach((cv,i)=>{
    const l=i+1,r=l===1?1:.5; // the blurrier steps are soft anyway, so half-size bitmaps (less memory)
    cv.width=Math.ceil(s.width*r);cv.height=Math.ceil(s.height*r);
    cv.style.width=s.style.width;cv.style.height=s.style.height;cv.style.marginLeft=s.style.marginLeft;cv.style.marginTop=s.style.marginTop;
    const c=cv.getContext("2d");c.clearRect(0,0,cv.width,cv.height);
    const full=Math.max(1.5,3.5*k*(s.width/parseFloat(s.style.width))), px=full*l/LV*r; // full = the old single blur amount
    if(NATIVE_BLUR){c.filter="blur("+px+"px)";c.drawImage(s,0,0,cv.width,cv.height);c.filter="none"}
    else{c.drawImage(s,0,0,cv.width,cv.height);softBlur(c,cv.width,cv.height,px)} // Safari/iOS: no ctx.filter
  });
}
// Kit / Hardware drawings for the current product. Heavy (draw + blur steps), so layout() prepares them in the
// background once the slider has settled (prepX); enter() then has nothing left to compute and the slide stays smooth.
let prepKey="",prepT;
const xKey=()=>cur+"@"+k;
function drawX(){draw(kit.s,P[cur],1);bake(kit.b,kit.s);draw(hw.s,P[cur],2);bake(hw.b,hw.s);prepKey=xKey()}
function prepX(){
  clearTimeout(prepT);
  prepT=setTimeout(()=>{
    if(mode||prepKey===xKey())return;
    const key=xKey();
    draw(kit.s,P[cur],1);bake(kit.b,kit.s);
    prepT=setTimeout(()=>{if(mode||xKey()!==key)return;draw(hw.s,P[cur],2);bake(hw.b,hw.s);prepKey=key},50); // second job in its own task
  },1000);
}

// st: 1 sharp, 2 blurred, 0 hidden. Only --p/--h are set here; CSS (.l0-.l3) turns them into layer opacities.
function put(s,b,x,y,sc,st,z){
  const t="translate("+x+"px,"+y+"px)"+(sc!==1?" scale("+sc+")":"");
  [s,...b].forEach((el,i)=>{
    el.style.transform=t;el.style.zIndex=z*10+LV+1-i; // sharp on top, then least blurred ... most blurred
    el.style.setProperty("--p",st===1?0:1);el.style.setProperty("--h",st?1:0);
  });
}
const hide=(s,b)=>[s,...b].forEach(el=>el.style.setProperty("--h",0));
const fmt=x=>"€"+x.toFixed(2).replace(".",",");
const base=p=>parseFloat(p.p.slice(1).replace(",","."));

function layout(force){
  const W=stage.clientWidth,H=stage.clientHeight;
  const nk=Math.round((W<700?Math.min(W/900,H/700):Math.min(W/1250,H/700))*100)/100;
  if(force||nk!==k){k=nk;if(force)prepKey="";items.forEach((cv,i)=>draw(cv,P[i],0));blurs.forEach((b,i)=>bake(b,items[i]));if(mode)drawX()}
  const gap=640*k;
  if(!mode){
    items.forEach((cv,i)=>{const o=i-cur,a=Math.abs(o);put(cv,blurs[i],o*gap*.7071,-o*gap*.3536,1,o===0?1:a<=2?2:0,10-a)});
    // options wait off-screen at the bottom right (they slide back there when leaving)
    [kit,hw].forEach((e,j)=>put(e.s,e.b,(j+2)*gap*.7071,(j+2)*gap*.3536,1,0,0));
    prepX();
  }else{
    items.forEach((cv,i)=>{if(i!==cur)hide(cv,blurs[i])});
    // row on the product's OTHER axis (down-right / up-left): [main product, kit, hardware], centre = v+1.
    // The main product sits one step up-left, blurred; clicking it goes back.
    [{s:items[cur],b:blurs[cur]},kit,hw].forEach((e,j)=>{const o=j-(v+1),a=Math.abs(o);
      put(e.s,e.b,o*gap*.7071,o*gap*.3536,o===0?1.1:1,o===0?1:a<=2?2:0,10-a)});
  }
  panel();
}
function panel(){
  const p=P[cur];
  $("name").textContent=p.n;
  document.body.classList.toggle("cfg",!!mode);
  $("home").textContent=mode?"← All objects":"All objects";
  $("specs").style.display=mode?"none":"";
  if(!mode){
    $("chip").textContent=p.chip;$("desc").textContent=p.d;$("lbl").textContent="select";
    $("price").textContent=p.p;$("old").textContent=p.o;
    $("specs").innerHTML=p.s.map(s=>"<div><b>"+s[0]+"</b><small>"+s[1]+"</small></div>").join("");
    $("tree").innerHTML='<span class="on">Filtering</span><span>All</span><span>Series A</span><span>Series B</span>';
    $("count").textContent=(cur+1)+" of "+P.length;
  }else{
    const x=V[v];
    $("chip").textContent=x.k;$("desc").textContent=x.d;$("lbl").textContent=x.btn;
    $("price").textContent=fmt(base(p)*x.m);$("old").textContent="";
    $("tree").innerHTML='<span class="on">Version</span>'+V.map((y,j)=>'<span data-v="'+j+'"'+(j===v?' class="on"':'')+'>'+y.k+'</span>').join("");
    $("count").textContent=(v+1)+" of "+V.length;
  }
}
function go(i){cur=Math.max(0,Math.min(P.length-1,i));layout()}
function setV(j){v=Math.max(0,Math.min(V.length-1,j));layout()}
const step=d=>mode?setV(v+d):go(cur+d);
const optL=()=>[kit,hw].flatMap(e=>[e.s,...e.b]);
function enter(){
  mode=1;v=0;if(prepKey!==xKey())drawX();
  optL().forEach(el=>el.style.transition=""); // options slide in from where layout() parked them
  layout();
}
function back(){
  mode=0;
  // options slide out to the bottom right and only fade once they are mostly gone
  optL().forEach(el=>el.style.transition="transform .9s cubic-bezier(.2,.8,.2,1),--p .9s cubic-bezier(.35,0,.3,1),--h .3s ease .55s");
  layout();
}

$("prev").onclick=()=>step(-1);$("next").onclick=()=>step(1);
$("home").onclick=()=>{if(mode)back()};
$("tree").onclick=e=>{const t=e.target.closest("[data-v]");if(t&&mode)setV(+t.dataset.v)};
$("add").onclick=()=>{
  if(!mode){enter();return}
  const l=$("lbl");
  if(V[v].btn==="Add to cart"){cart++;$("cart").textContent="Cart ("+cart+")";l.textContent="Added ✓"}
  else l.textContent="Configurator coming soon";
  setTimeout(panel,1400);
};
addEventListener("keydown",e=>{
  if(e.key==="ArrowRight"||e.key==="ArrowDown")step(1);
  if(e.key==="ArrowLeft"||e.key==="ArrowUp")step(-1);
  if(e.key==="Escape"&&mode)back();
});
let rt;addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(layout,120)});

// click a product: pixel hit-test so transparent areas don't count
stage.addEventListener("click",e=>{
  const c=mode?v+1:cur;
  const L=(mode?[items[cur],kit.s,hw.s].map((s,j)=>({s,j})):items.map((s,j)=>({s,j})).filter(x=>Math.abs(x.j-cur)<=2))
    .sort((a,b)=>Math.abs(a.j-c)-Math.abs(b.j-c));
  for(const it of L){
    const cv=it.s,r=cv.getBoundingClientRect();
    const x=Math.floor((e.clientX-r.left)/r.width*cv.width),y=Math.floor((e.clientY-r.top)/r.height*cv.height);
    if(x<0||y<0||x>=cv.width||y>=cv.height)continue;
    if(cv.getContext("2d").getImageData(x,y,1,1).data[3]>20){
      if(it.j===c){if(!mode)enter()}else if(mode){if(it.j===0)back();else setV(it.j-1)}else go(it.j);
      return;
    }
  }
});
let sx=null;
stage.addEventListener("touchstart",e=>{sx=e.touches[0].clientX},{passive:true});
stage.addEventListener("touchend",e=>{if(sx===null)return;const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40)step(dx<0?1:-1);sx=null});
let lock=false;
stage.addEventListener("wheel",e=>{if(lock)return;const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(Math.abs(d)<12)return;lock=true;step(d>0?1:-1);setTimeout(()=>lock=false,500)},{passive:true});

layout(true);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>layout(true));
