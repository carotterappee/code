
import * as T from './three-718.module.js';

export function mountBoard(canvas,info){
  const gl=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  gl.outputEncoding=T.sRGBEncoding;
  const scene=new T.Scene();
  scene.background=new T.Color(0x091310);
  scene.add(new T.HemisphereLight(0xf1fff6,0x728c80,1.05));
  for(const [x,y,z,p] of [[-5,9,6,1.2],[6,3,-6,.8]]){
    const l=new T.DirectionalLight(0xffffff,p);l.position.set(x,y,z);scene.add(l);
  }
  const cam=new T.PerspectiveCamera(34,1,.05,80);
  const board=new T.Group();scene.add(board);
  const parts=[],targets=[];
  const material=(color,metal=.05,rough=.52)=>new T.MeshStandardMaterial({
    color,metalness:metal,roughness:rough
  });
  const green=material(0x155e42),edge=material(0x707341),ink=material(0xd9e7c8);
  const black=material(0x252b2d),plastic=material(0x31393a),silver=material(0xbfc8c7,.48,.29);
  const gold=material(0xd5ad58,.42,.32),copper=material(0xd47d3a,.40,.31);
  const trace=material(0x44855d,.13),blue=material(0x337c89),ceramic=material(0xbea484);
  const led=material(0x82f69b);led.emissive.setHex(0x347e41);
  function mesh(parent,geo,mat,x,y,z){
    const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;
  }
  function box(p,x,y,z,w,h,d,m){return mesh(p,new T.BoxGeometry(w,h,d),m,x,y,z)}
  function cylinder(p,x,y,z,r,h,m,n=20){return mesh(p,new T.CylinderGeometry(r,r,h,n),m,x,y,z)}
  function rod(p,a,b,r,m,n=8){
    const A=new T.Vector3(...a),B=new T.Vector3(...b),delta=B.clone().sub(A);
    const mid=A.clone().lerp(B,.5);
    const v=cylinder(p,mid.x,mid.y,mid.z,r,delta.length(),m,n);
    v.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return v;
  }
  function text(p,str,x,y,z,w,d,back=false){
    const c=document.createElement('canvas');c.width=512;c.height=96;
    const g=c.getContext('2d');g.font='bold 66px monospace';g.fillStyle='#dfebd5';
    g.textAlign='center';g.textBaseline='middle';g.fillText(str,256,49,495);
    const tx=new T.CanvasTexture(c);tx.encoding=T.sRGBEncoding;
    const m=mesh(p,new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({
      map:tx,transparent:true,depthWrite:false
    }),x,y,z);
    m.rotation.x=back?Math.PI/2:-Math.PI/2;return m;
  }
  function component(id,name,detail,x,z){
    const p=new T.Group();p.position.set(x,0,z);board.add(p);
    p.userData={id,name,detail};parts.push(p);return p;
  }

  // Stratifié de la carte, coins arrondis et quatre vrais perçages.
  const shape=new T.Shape();
  shape.moveTo(-4.10,-2.65);shape.lineTo(4.10,-2.65);
  shape.quadraticCurveTo(4.35,-2.65,4.35,-2.40);shape.lineTo(4.35,2.40);
  shape.quadraticCurveTo(4.35,2.65,4.10,2.65);shape.lineTo(-4.10,2.65);
  shape.quadraticCurveTo(-4.35,2.65,-4.35,2.40);shape.lineTo(-4.35,-2.40);
  shape.quadraticCurveTo(-4.35,-2.65,-4.10,-2.65);
  const holes=[[-3.98,-2.29],[3.98,-2.29],[-3.98,2.29],[3.98,2.29]];
  for(const [x,z] of holes){
    const hole=new T.Path();hole.absarc(x,-z,.127,0,Math.PI*2,true);shape.holes.push(hole);
  }
  const laminate=new T.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false,curveSegments:14});
  laminate.rotateX(-Math.PI/2);mesh(board,laminate,[green,edge],0,-.12,0);
  for(const [x,z] of holes)for(const back of [false,true]){
    const ring=mesh(board,new T.RingGeometry(.129,.21,32),gold,x,back?-.123:.004,z);
    ring.rotation.x=back?Math.PI/2:-Math.PI/2;
  }

  // Pistes plates regroupées en un maillage par face.
  function tracks(routes,y,mat){
    const vertices=[];
    for(const points of routes)for(let i=1;i<points.length;i++){
      const [x,z]=points[i-1],[X,Z]=points[i];
      const len=Math.hypot(X-x,Z-z);if(!len)continue;
      const dx=(Z-z)/len*.016,dz=(x-X)/len*.016;
      const a=[x-dx,y,z-dz],b=[x+dx,y,z+dz],c=[X+dx,y,Z+dz],d=[X-dx,y,Z-dz];
      vertices.push(...a,...b,...c,...a,...c,...d);
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
    const m=mat.clone();m.side=T.DoubleSide;mesh(board,geo,m,0,0,0);
  }
  const front=[],rear=[];
  for(let j=0;j<11;j++){
    const k=j*.085;
    front.push([[.70,-.46+k],[1.03+k,-.46+k],[1.59+k,-1.02+k],[2.78,-1.02+k]]);
    front.push([[-.70,-.45+k],[-1.13-k,-.45+k],[-1.73-k,.15+k],[-2.96,.15+k]]);
    rear.push([[-3.30,-1.48+k],[-2.88+k,-1.48+k],[-1.14+k,.26+k],[2.75,.26+k]]);
  }
  for(let j=0;j<8;j++){
    const x=-.55+j*.15;
    front.push([[x,.67],[x,1.01+j*.04],[x+.46,1.47+j*.04],[x+.46,1.96]]);
  }
  tracks(front,.008,trace);tracks(rear,-.125,trace);
  text(board,'SPECTRE  /  SENSOR BOARD',0,.013,-2.17,3.42,.24);
  text(board,'PCB–04   REV B',-.80,-.132,1.95,2.45,.22,true);

  // Les pattes métalliques ont un coude et un pied soudé sur une pastille.
  function chip(id,name,detail,x,z,size,count){
    const p=component(id,name,detail,x,z);
    box(p,0,.135,0,size,.23,size,black);
    text(p,id==='U1'?'SPC32 / MCU':id,0,.255,0,size*.81,size*.16);
    cylinder(p,-size*.33,.255,-size*.32,.035,.013,ceramic);
    for(let side=0;side<4;side++)for(let k=0;k<count;k++){
      const u=(k-(count-1)/2)*size/(count+1),v=size/2;
      const a=side*Math.PI/2,co=Math.cos(a),si=Math.sin(a);
      function pt(dist,y){return [u*co-dist*si,y,u*si+dist*co]}
      rod(p,pt(v,.115),pt(v+.11,.039),.024,silver);
      rod(p,pt(v+.11,.039),pt(v+.19,.039),.027,silver);
    }
    text(p,id,0,.015,-size*.5-.27,.42,.16);
    return p;
  }
  chip('U1','Microcontrôleur','Exécute le programme, interroge les capteurs et commande les sorties.',0,0,1.30,10);
  chip('U2','Magnétomètre','Mesure le champ magnétique selon trois axes. On peut s’en servir pour une boussole électronique.',2.72,-1.14,.65,5);
  chip('U3','Capteur de température','Mesure la température locale et envoie sa valeur au microcontrôleur.',2.75,.96,.55,4);

  // Bobine toroïdale : le cuivre passe alternativement au-dessus et au-dessous du noyau.
  const L=component('L1','Bobine toroïdale','Le courant qui parcourt le fil de cuivre crée un champ magnétique. Le noyau concentre ce champ.',-2.18,-1.03);
  const core=mesh(L,new T.TorusGeometry(.41,.145,14,48),black,0,.24,0);
  core.rotation.x=Math.PI/2;
  const winding=[];
  for(let j=0;j<=480;j++){
    const a=j/480*Math.PI*2,b=22*a,r=.41+.163*Math.cos(b);
    winding.push(new T.Vector3(r*Math.cos(a),.24+.163*Math.sin(b),r*Math.sin(a)));
  }
  mesh(L,new T.TubeGeometry(new T.CatmullRomCurve3(winding),480,.027,7,false),copper,0,0,0);
  text(L,'L1',0,.015,-.73,.38,.16);

  const C=component('C1','Condensateur électrolytique','Stocke de l’énergie électrique et atténue les variations de tension de l’alimentation.',-2.82,.85);
  cylinder(C,0,.43,0,.32,.83,plastic,40);
  cylinder(C,0,.86,0,.305,.035,silver,40);
  for(const a of [-.75,.75]){
    const cut=box(C,0,.882,0,.40,.012,.016,black);cut.rotation.y=a;
  }
  text(C,'C1',0,.015,.53,.38,.16);

  const J=component('J1','Bornier à vis','Les vis maintiennent les fils qui apportent l’alimentation à la carte.',-3.56,-.53);
  box(J,0,.29,0,.67,.56,1.15,blue);
  for(const s of [-1,1]){
    cylinder(J,0,.585,s*.265,.155,.045,silver);
    box(J,0,.611,s*.265,.22,.012,.027,black).rotation.y=.55;
    const A=[-.32,.23,s*.265],B=[-.56,.23,s*.265],D=[-.88,.31,s*.37];
    rod(J,A,B,.040,copper);rod(J,B,D,.070,s<0?material(0xad483d):black);
  }
  text(J,'J1',0,.015,-.74,.38,.16);

  const D=component('D1','LED témoin','Émet de la lumière quand un courant la traverse dans le sens passant.',1.37,-1.56);
  for(const k of [-1,1])rod(D,[k*.11,.01,0],[k*.11,.24,0],.027,silver);
  cylinder(D,0,.31,0,.15,.23,led);
  const dome=mesh(D,new T.SphereGeometry(.15,18,12),led,0,.425,0);dome.scale.y=.85;
  text(D,'D1',0,.015,-.34,.36,.14);

  const R=component('R1','Résistance','En série avec la LED, elle limite le courant qui la traverse.',1.42,-.81);
  box(R,0,.08,0,.49,.12,.22,ceramic);
  for(const s of [-1,1])box(R,s*.21,.08,0,.09,.13,.23,silver);
  for(const x of [-.10,0,.10])box(R,x,.145,0,.026,.008,.21,black);
  text(R,'R1',0,.015,.26,.35,.13);

  const H=component('J2','Connecteur de signaux','Ses broches relient la carte à d’autres modules. Retourne la carte pour voir les soudures.',0,1.95);
  box(H,0,.125,0,2.18,.22,.33,black);
  for(let k=0;k<8;k++){
    const x=(k-3.5)*.26;
    box(H,x,.19,0,.067,.94,.067,gold);
    const joint=mesh(H,new T.ConeGeometry(.101,.115,14),silver,x,-.175,0);
    joint.rotation.z=Math.PI;
  }
  text(H,'J2',1.36,.015,0,.40,.15);

  for(const part of parts)part.traverse(o=>{
    if(o.isMesh){o.userData.pcbPart=part;targets.push(o)}
  });
  const pickRay=new T.Raycaster(),mouse=new T.Vector2();
  const outline=new T.BoxHelper(undefined,0xffd677);outline.visible=false;scene.add(outline);
  let selected=null,az=.18,el=1.03,distance=12.2,drag=null,lastKey='';
  function select(p){
    if(selected===p)return;selected=p;
    outline.visible=!!p;if(p)outline.setFromObject(p);
    info.children[0].textContent=p?p.userData.id+' / '+p.userData.name:'PCB–04';
    info.children[1].textContent=p?p.userData.detail:'Glisse pour tourner · molette pour zoomer';
  }

  const panel=canvas.closest('section');
  const scope=canvas.parentElement;
  const style=document.createElement('style');
  style.textContent=`
    .pcb-holo-layer {
      position:absolute;inset:0;z-index:3;overflow:hidden;pointer-events:none;
      color:#b6ffed;font-family:Consolas,monospace;
    }
    .pcb-holo-layer[hidden],section:not(.max) .pcb-holo-layer {display:none}
    .pcb-holo-layer svg {position:absolute;inset:0;width:100%;height:100%}
    .pcb-holo-card {
      position:absolute;box-sizing:border-box;width:min(236px,52%);
      padding:11px 14px 12px;
      background:linear-gradient(115deg,rgba(7,35,39,.96),rgba(7,23,30,.89));
      border:1px solid #559b9b;border-left:2px solid #8cf8e1;
      box-shadow:inset 0 0 18px #57e8e80a,0 5px 22px #0006;
      backdrop-filter:blur(5px);
    }
    .pcb-holo-card::after {
      content:"";position:absolute;right:-1px;top:-1px;
      width:16px;height:5px;background:#93f4df;
    }
    .pcb-holo-card small {
      display:block;color:#8bceca;font-size:9px;letter-spacing:.14em;
    }
    .pcb-holo-card strong {
      display:block;margin:6px 0 5px;color:#d5fff3;
      font-size:14px;font-weight:600;line-height:1.2;
    }
    .pcb-holo-card p {
      margin:0;color:#bdcfce;font-size:12px;line-height:1.45;
    }
    @media(prefers-reduced-motion:no-preference){
      .pcb-holo-card.pcb-reveal {animation:pcb-readout .16s ease-out}
      @keyframes pcb-readout {
        from {opacity:.3;clip-path:inset(0 0 65% 0)}
        to {opacity:1;clip-path:inset(0)}
      }
    }
  `;
  document.head.append(style);

  const layer=document.createElement('div');
  layer.className='pcb-holo-layer';layer.hidden=true;
  layer.innerHTML=`
    <svg aria-hidden="true">
      <polyline fill="none" stroke="#081c21" stroke-width="3.5"/>
      <polyline fill="none" stroke="#8ff6e2" stroke-width="1.25"/>
      <circle r="5.5" fill="#0b282b" fill-opacity=".6" stroke="#9bffeb"/>
      <circle r="1.8" fill="#d0fff3"/>
    </svg>
    <div class="pcb-holo-card" role="tooltip">
      <small></small><strong></strong><p></p>
    </div>`;
  scope.append(layer);
  const card=layer.querySelector('.pcb-holo-card');
  const wires=layer.querySelectorAll('polyline');
  const dots=layer.querySelectorAll('circle');
  let shownPart=null;

  function hideHolo(){
    layer.hidden=true;
    shownPart=null;
  }

  function showHolo(part,point){
    if(!panel.classList.contains('max') || !part){hideHolo();return}
    const w=scope.clientWidth,h=scope.clientHeight;
    const projected=point.clone().project(cam);
    const x=(projected.x+1)*canvas.clientWidth/2+canvas.offsetLeft;
    const y=(1-projected.y)*canvas.clientHeight/2+canvas.offsetTop;
    layer.hidden=false;

    if(shownPart!==part){
      const {id,name,detail}=part.userData;
      card.querySelector('small').textContent='PCB–04  /  '+id;
      card.querySelector('strong').textContent=name;
      card.querySelector('p').textContent=detail;
      card.classList.remove('pcb-reveal');
      void card.offsetWidth;
      card.classList.add('pcb-reveal');
      shownPart=part;
    }

    const cw=card.offsetWidth,ch=card.offsetHeight,pad=10;
    const right=w-x>=x;
    const dir=right?1:-1;
    const gap=Math.max(30,Math.min(98,w*.09));
    const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));
    const left=clamp(right?x+gap:x-gap-cw,pad,w-cw-pad);
    const top=clamp(y-ch*.5+(y<h*.48?32:-32),pad,h-ch-pad);
    card.style.left=left+'px';card.style.top=top+'px';

    const edge=right?left:left+cw;
    const endY=top+ch*.5;
    const bend=edge-dir*Math.min(18,Math.abs(edge-x)*.35);
    const points=`${x},${y} ${bend},${endY} ${edge},${endY}`;
    wires.forEach(line=>line.setAttribute('points',points));
    dots.forEach(dot=>{
      dot.setAttribute('cx',x);dot.setAttribute('cy',y);
    });
  }

  function resetInspection(){hideHolo();select(null)}
  new MutationObserver(resetInspection).observe(panel,{
    attributes:true,attributeFilter:['class']
  });
  new ResizeObserver(resetInspection).observe(scope);
  window.addEventListener('blur',resetInspection);

  function pick(e){
    if(!panel.classList.contains('max')){resetInspection();return}

    const r=canvas.getBoundingClientRect();
    mouse.set(2*(e.clientX-r.left)/r.width-1,1-2*(e.clientY-r.top)/r.height);
    pickRay.setFromCamera(mouse,cam);
    // Le support opaque bloque le survol des composants cachés derrière lui.
    const hit=pickRay.intersectObjects(board.children,true)[0];

    const part=hit?.object.userData.pcbPart||null;
    select(part);
    if(part)showHolo(part,hit.point);
    else hideHolo();
  }
  canvas.style.touchAction='none';canvas.style.cursor='grab';
  canvas.onpointerdown=e=>{
    if(!e.isPrimary||e.button!==0)return;
    resetInspection();
    drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};
    canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
  };
  canvas.onpointermove=e=>{
    if(!drag){pick(e);return}
    if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>3)drag.moved=true;
    if(drag.moved){
      select(null);az-=(e.clientX-drag.x)*.009;
      el=Math.max(-1.53,Math.min(1.53,el+(e.clientY-drag.y)*.010));
    }
    drag.x=e.clientX;drag.y=e.clientY;
  };
  canvas.onpointerup=e=>{if(drag&&!drag.moved)pick(e);drag=null;canvas.style.cursor='grab'};
  canvas.onlostpointercapture=()=>{drag=null;canvas.style.cursor='grab'};
  canvas.onpointerleave=e=>{if(!drag&&e.pointerType==='mouse')resetInspection()};
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();resetInspection();
    distance=Math.max(4.6,Math.min(22,distance*Math.exp(Math.max(-220,Math.min(220,e.deltaY))*.0018)));
  },{passive:false});
  canvas.onkeydown=e=>{
    if(!['ArrowRight','ArrowLeft'].includes(e.key))return;
    e.preventDefault();const i=parts.indexOf(selected);
    if(!panel.classList.contains('max')){resetInspection();return}
    const next=i<0?(e.key==='ArrowRight'?0:parts.length-1):
      (i+(e.key==='ArrowRight'?1:-1)+parts.length)%parts.length;
    const part=parts[next];select(part);
    const center=new T.Box3().setFromObject(part).getCenter(new T.Vector3());
    showHolo(part,center);
  };
  return function draw(g,w,h){
    const key=[w,h,az,el,distance,selected?.userData.id,devicePixelRatio].join('/');
    if(key!==lastKey){
      lastKey=key;
      const d=Math.min(devicePixelRatio||1,1.6);
      if(gl.getPixelRatio()!==d)gl.setPixelRatio(d);
      if(gl.domElement.width!==Math.floor(w*d)||gl.domElement.height!==Math.floor(h*d))
        gl.setSize(w,h,false);
      cam.aspect=w/h;cam.updateProjectionMatrix();
      const r=distance*Math.max(1,1.35/cam.aspect);
      cam.position.set(Math.sin(az)*Math.cos(el)*r,Math.sin(el)*r,Math.cos(az)*Math.cos(el)*r);
      cam.lookAt(0,0,0);cam.updateMatrixWorld();gl.render(scene,cam);
    }
    g.drawImage(gl.domElement,0,0,w,h);
  };
}
