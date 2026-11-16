// WindShield (旧 LUMEN BLADE) — main game module (rendering, player, enemies, story flow, UI wiring).
// TODO: split further into modules (see CLAUDE.md). Type-checking is disabled here for now.
// @ts-nocheck
import * as THREE from 'three';
import { initAudio, sfx, setWind } from './audio';
import { Z3, lerpA, mixPose, STANCE, POSE, runPose, smooth, LEG_L, LEG_R, LEG_SET, ATK, sampleAtk, runPose2 } from './motion/poses';
import { SCENES, NAMES } from './story/scenes';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

/* ================= renderer / scene ================= */
const ARENA = 17;
const $ = id => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a18);
scene.fog = new THREE.FogExp2(0xcfe2f5, 0.006);   // 昼の空気遠近：遠くほど白っぽい青に溶ける
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 300);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth/2, innerHeight/2), 0.35, 0.45, 0.92);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms:{ tDiffuse:{value:null}, uTime:{value:0}, uAberr:{value:.0012}, uHurt:{value:0}, uDesat:{value:0} },
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform sampler2D tDiffuse; uniform float uTime; uniform float uAberr; uniform float uHurt; uniform float uDesat; varying vec2 vUv;
    void main(){
      vec2 c = vUv-0.5; float d = length(c);
      vec2 off = c*uAberr*(1.0+d*5.0);
      vec3 col = vec3(texture2D(tDiffuse,vUv+off).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-off).b);
      float l = dot(col, vec3(.299,.587,.114));
      col = mix(col, col*vec3(.86,1.0,1.18), smoothstep(.45,0.0,l)*.6);   // cool shadows
      col = mix(col, col*vec3(1.12,1.0,.86), smoothstep(.35,1.4,l)*.45);   // warm highlights
      col *= 1.0 - smoothstep(.32,.9,d)*.35;                                // vignette
      col = mix(col, vec3(l)*vec3(.92,.95,1.0), uDesat);                    // 風が止まると世界が色を失う
      col *= 1.0 - uDesat*.18;
      col = mix(col, col*vec3(1.4,.6,.6), uHurt*smoothstep(.2,.8,d));
      float n = fract(sin(dot(vUv*vec2(12.9898,78.233)+fract(uTime), vec2(1.0)))*43758.5453);
      col += (n-.5)*.018;                                                  // film grain
      gl_FragColor = vec4(col,1.0);
    }`
});
composer.addPass(grade);
composer.addPass(new OutputPass());
let aberr = 0, hurtFx = 0;

/* adaptive resolution: if the phone can't hold ~60fps, render at a lower pixel ratio, and go back up once it recovers.
   A level that once failed is never retried (cap), so the resolution doesn't keep bouncing up and down. */
let pr = DPR, prCap = DPR, fpsFrames = 0, fpsTime = 0, fpsGood = 0, lastFrameAt = performance.now();
function adaptResolution(){
  const now = performance.now(), dt = (now - lastFrameAt)/1000; lastFrameAt = now;
  if (now < 5000 || dt > .5) return;            // ignore start-up (shader compile, texture upload) and background tabs
  fpsFrames++; fpsTime += dt;
  if (fpsTime < 1) return;
  const fps = fpsFrames/fpsTime; fpsFrames = 0; fpsTime = 0;
  let next = pr;
  if (fps < 48 && pr > .8){ prCap = Math.min(prCap, pr); next = Math.max(.8, pr - .15); fpsGood = 0; }
  else if (fps > 57){ if (++fpsGood >= 4 && pr + .1 < prCap){ next = pr + .1; fpsGood = 0; } }
  else fpsGood = 0;
  if (next === pr) return;
  pr = next; renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth/2, innerHeight/2);
});

/* ================= textures ================= */
function canvasTex(size, draw){
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const dotTex = canvasTex(64, (g,s) => {
  const gr = g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.35,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0,0,s,s);
});
const runeTex = canvasTex(1024, (g,s) => {
  g.translate(s/2,s/2); g.strokeStyle = '#fff'; g.lineCap='round';
  const ring = (r,w)=>{ g.lineWidth=w; g.beginPath(); g.arc(0,0,r,0,Math.PI*2); g.stroke(); };
  ring(490,6); ring(460,2); ring(330,4); ring(300,2); ring(120,3);
  for (let i=0;i<48;i++){ // glyphs
    const a = i/48*Math.PI*2; g.save(); g.rotate(a); g.translate(0,-395); g.lineWidth=4;
    g.beginPath();
    for (let k=0;k<3;k++){ g.moveTo((Math.random()-.5)*36,(Math.random()-.5)*44); g.lineTo((Math.random()-.5)*36,(Math.random()-.5)*44); }
    g.stroke(); g.restore();
  }
  g.lineWidth=3; // hexagram
  for (let t=0;t<2;t++){ g.beginPath(); for(let i=0;i<=3;i++){ const a=i/3*Math.PI*2+t*Math.PI/3-Math.PI/2; g.lineTo(Math.cos(a)*300,Math.sin(a)*300);} g.stroke(); }
});

/* ================= photo-scanned materials (Poly Haven, CC0) =================
   Each material = colour (diff) + surface bumps (nor_gl) + one packed map "arm":
   R = ambient occlusion, G = roughness, B = metalness. One texture feeds three slots, which saves memory on iPhone. */
const texLoader = new THREE.TextureLoader();
function pbrMaps(name, rx, ry){
  const ld = (kind, srgb=false) => {
    const t = texLoader.load(`${import.meta.env.BASE_URL}textures/${name}_${kind}_1k.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const arm = ld('arm');
  return { map:ld('diff', true), normalMap:ld('nor_gl'), aoMap:arm, roughnessMap:arm };
}

/* ================= environment ================= */
const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), new THREE.ShaderMaterial({
  side:THREE.BackSide, depthWrite:false,
  uniforms:{ top:{value:new THREE.Color(0x02030b)}, mid:{value:new THREE.Color(0x1b1748)}, bot:{value:new THREE.Color(0x2a1640)} },
  vertexShader:`varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP;
    void main(){ float h=vP.y; vec3 c = h>0.0 ? mix(mid, top, smoothstep(0.0,0.55,h)) : mix(mid, bot, smoothstep(0.0,-0.3,h));
    gl_FragColor=vec4(c,1.0); }`
}));
scene.add(sky);
{ // stars
  const n=900, p=new Float32Array(n*3);
  for(let i=0;i<n;i++){ const th=Math.random()*Math.PI*2, ph=Math.random()*Math.PI*0.45; const r=140;
    p[i*3]=Math.cos(th)*Math.sin(ph)*r; p[i*3+1]=Math.cos(ph)*r; p[i*3+2]=Math.sin(th)*Math.sin(ph)*r; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const stars = new THREE.Points(g,new THREE.PointsMaterial({size:1.6,sizeAttenuation:false,color:0xcfe0ff,fog:false,transparent:true,opacity:.85}));
  sky.add(stars);
}
const moon = new THREE.Mesh(new THREE.SphereGeometry(5,32,16), new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,2.3,2.6),fog:false}));
moon.position.set(-55,48,-90); sky.add(moon);
// 聖都アウリスの空：写真の昼空（Poly Haven の HDR を軽いJPGに変換したもの）を背景にする。夜の空ドーム・星・月は使わない
sky.visible = false;
new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}sky/aulis_sky_2k.jpg`, t => {
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scene.background = t; });
scene.background = new THREE.Color(0x9cc4ef);   // 読み込みまでの仮の空色
// 太陽の向き（空の写真の太陽の位置に合わせてある）
const SUN_DIR = new THREE.Vector3(.83, 1.1, .56).normalize();
{ // environment reflections for metal
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16), sky.material));
  const blob = (c,x,y,z,r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r,16,8), new THREE.MeshBasicMaterial({color:c})); m.position.set(x,y,z); envScene.add(m); };
  blob(new THREE.Color(8,8,9),-20,24,-32,4); blob(new THREE.Color(.6,2.6,4),32,6,0,7); blob(new THREE.Color(3.2,.9,4),-30,6,12,7);
  scene.environment = pmrem.fromScene(envScene, .04).texture;
  // swap in a real photographed night sky (moonrise) for image-based lighting once it has loaded
  new RGBELoader().load(`${import.meta.env.BASE_URL}hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr`, hdr => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose(); pmrem.dispose();
  });
}

scene.add(new THREE.HemisphereLight(0xcfe4ff, 0xd9d2c4, 0.45));
// 太陽光（変数名は夜の名残で moonLight のまま）
const moonLight = new THREE.DirectionalLight(0xfff1dc, 2.3);
moonLight.position.set(-12,22,10); moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024,1024);
Object.assign(moonLight.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:70});
moonLight.shadow.bias = -0.0005; moonLight.shadow.normalBias = 0.03;
scene.add(moonLight, moonLight.target);


const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA+8, 72),
  // 白い大理石の広場（磨かれていて、空がうっすら映り込む）
  new THREE.MeshStandardMaterial({...pbrMaps('marble_01', 9, 9), color:0xe6ecfb, roughness:.5, metalness:0, envMapIntensity:.55}));
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);

// 床の紋様：白い大理石の上でも見えるよう、光る加算合成ではなく青いインクのような通常合成にする
const runeMat = new THREE.MeshBasicMaterial({map:runeTex, color:new THREE.Color(0.18,0.38,0.85), transparent:true, opacity:.4, depthWrite:false});
const rune = new THREE.Mesh(new THREE.PlaneGeometry(16,16), runeMat);
rune.rotation.x = -Math.PI/2; rune.position.y = 0.02; scene.add(rune);
const edge = new THREE.Mesh(new THREE.RingGeometry(ARENA+0.2, ARENA+0.5, 128),
  new THREE.MeshBasicMaterial({color:new THREE.Color(0.75,0.62,0.3), transparent:true, opacity:.85, depthWrite:false}));   // 縁取りは金
edge.rotation.x = -Math.PI/2; edge.position.y = 0.03; scene.add(edge);

const stoneMat = new THREE.MeshStandardMaterial({...pbrMaps('marble_01', 1, 3), color:0xe8edf8, roughness:.55, metalness:0, envMapIntensity:.55});
// 浮島の岩肌（広場の裏側・遠くの浮島）
const rockMat = new THREE.MeshStandardMaterial({...pbrMaps('castle_wall_slates', 6, 2), color:0x9a958c, roughness:1, metalness:0, envMapIntensity:.6});
const crystalMats = [new THREE.Color(0x57e1ff), new THREE.Color(0xc070ff)].map(c =>
  new THREE.MeshStandardMaterial({color:0x111122, emissive:c, emissiveIntensity:2.4, roughness:.2, metalness:.6, flatShading:true}));
// 青地に白い星（風見の紋章）の旗。風が止まると垂れ下がって動かなくなる
const bannerTex = canvasTex(256, (g,s) => {
  g.fillStyle = '#1f4f9e'; g.fillRect(0,0,s,s);
  g.strokeStyle = '#d8b765'; g.lineWidth = 10; g.strokeRect(8,8,s-16,s-16);
  g.translate(s/2, s*.42); g.fillStyle = '#f5f7ff';
  for (let i=0;i<8;i++){ g.rotate(Math.PI/4); g.beginPath(); g.moveTo(0,-s*.3); g.lineTo(s*.05,0); g.lineTo(-s*.05,0); g.closePath(); g.fill(); }
  g.beginPath(); g.arc(0,0,s*.06,0,Math.PI*2); g.fill();
});
const banners = [];
const crystals = [];
for (let i=0;i<10;i++){
  const a = i/10*Math.PI*2 + 0.15, r = ARENA + 4.5;
  const h = 3 + Math.random()*5;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.1,h,20), stoneMat);
  col.position.set(Math.sin(a)*r, h/2, Math.cos(a)*r); col.castShadow = true; col.receiveShadow = true; scene.add(col);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.0,0.4,20), stoneMat); cap.position.set(col.position.x,h+0.2,col.position.z); scene.add(cap);
  const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.6,0), crystalMats[i%2]);
  cr.position.set(col.position.x, h+1.6, col.position.z); cr.scale.y = 1.6; scene.add(cr);
  crystals.push({m:cr, base:h+1.6, ph:Math.random()*6});
  const bn = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.2, 1, 6), new THREE.MeshStandardMaterial({map:bannerTex, side:THREE.DoubleSide, roughness:.8}));
  const toC = new THREE.Vector3(-col.position.x, 0, -col.position.z).normalize();
  bn.position.set(col.position.x + toC.x*1.15, h - 1.4, col.position.z + toC.z*1.15); bn.lookAt(0, h - 1.4, 0);
  scene.add(bn); banners.push({m:bn, ph:Math.random()*6});
}
const pl1 = new THREE.PointLight(0x57e1ff, 8, 30, 2); pl1.position.set(14,5,-14); scene.add(pl1);
const pl2 = new THREE.PointLight(0xc070ff, 8, 30, 2); pl2.position.set(-14,5,14); scene.add(pl2);
/* ================= 天空の聖都：雲海と浮島 =================
   広場そのものが空に浮かぶ島。足元には雲の海、遠くには白い塔の建つ浮島と、そこから落ちる滝。 */
{ // 広場の裏側の岩（浮いていることが分かるように）
  const under = new THREE.Mesh(new THREE.CylinderGeometry(ARENA+8, ARENA-4, 9, 48, 1, true), rockMat); under.position.y = -4.5; scene.add(under);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(ARENA-4, 16, 48), rockMat); tip.rotation.x = Math.PI; tip.position.y = -17; scene.add(tip);
}
{ // 広場の縁の白い欄干。手前（+z 側）は「門」として開けておく（⑦ 聖都を去る の行き先）
  const R = ARENA + .7, GAP = .16, white = new THREE.MeshStandardMaterial({color:0xf1f2f6, roughness:.55});
  const arc = Math.PI*2 - GAP*2;
  for (const y of [.08, 1.08]){   // 上下の手すり（門の部分だけ途切れたリング）
    const rail = new THREE.Mesh(new THREE.TorusGeometry(R, y > .5 ? .14 : .1, 6, 160, arc), white);
    rail.rotation.x = -Math.PI/2; rail.rotation.z = Math.PI/2 + GAP; rail.position.y = y; scene.add(rail);
  }
  const n = 200, bal = new THREE.InstancedMesh(new THREE.CylinderGeometry(.08, .12, 1.0, 8), white, n), m4 = new THREE.Matrix4();
  let k = 0;
  for (let i=0;i<n;i++){ const a = GAP + i/(n-1)*arc; if (k >= n) break;
    m4.makeTranslation(Math.sin(a)*R, .58, Math.cos(a)*R); bal.setMatrixAt(k++, m4); }
  bal.count = k; scene.add(bal);
  for (const sgn of [-1, 1]){   // 門柱
    const a = sgn*GAP, post = new THREE.Mesh(new THREE.BoxGeometry(.6, 2.6, .6), white);
    post.position.set(Math.sin(a)*R, 1.3, Math.cos(a)*R); scene.add(post);
  }
}
const cloudTex = canvasTex(512, (g,s) => {
  g.fillStyle = '#c9d9ec'; g.fillRect(0,0,s,s);
  for (let i=0;i<260;i++){ const x=Math.random()*s, y=Math.random()*s, r=s*(.03+Math.random()*.09);
    for (const [dx,dy] of [[0,0],[s,0],[-s,0],[0,s],[0,-s]]){   // 端でつながるように上下左右にも描く
      const gr=g.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,r); gr.addColorStop(0,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=gr; g.fillRect(x+dx-r,y+dy-r,r*2,r*2); } }
});
cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping; cloudTex.repeat.set(10,10);
const cloudSea = new THREE.Mesh(new THREE.CircleGeometry(420, 64), new THREE.MeshBasicMaterial({map:cloudTex, color:0xffffff}));
cloudSea.rotation.x = -Math.PI/2; cloudSea.position.y = -26; scene.add(cloudSea);
{ // 遠くの浮島：逆さの岩山の上に白い建物と青い屋根の尖塔、縁から雲海へ落ちる滝
  const white = new THREE.MeshStandardMaterial({color:0xf4f2ee, roughness:.7});
  const roof = new THREE.MeshStandardMaterial({color:0x3d6fc2, roughness:.5, metalness:.2});
  const grass = new THREE.MeshStandardMaterial({color:0x7fae6a, roughness:1});
  const fallTex = canvasTex(128, (g,s) => { const gr=g.createLinearGradient(0,0,0,s); gr.addColorStop(0,'rgba(255,255,255,.95)'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr; g.fillRect(0,0,s,s); });
  const fallMat = new THREE.MeshBasicMaterial({map:fallTex, transparent:true, opacity:.75, depthWrite:false, side:THREE.DoubleSide});
  const island = (x, y, z, r, seed) => {
    const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(r, r*1.8, 9), rockMat); rock.rotation.x = Math.PI; rock.position.y = -r*.9; g.add(rock);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r*.98, .6, 18), grass); top.position.y = .3; g.add(top);
    let rnd = seed; const R = () => (rnd = (rnd*9301 + 49297) % 233280) / 233280;
    for (let i=0;i<6;i++){   // 建物と尖塔
      const a = R()*Math.PI*2, d = R()*r*.6, h = 2 + R()*r*.9, w = 1 + R()*r*.25;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), white); b.position.set(Math.sin(a)*d, h/2+.6, Math.cos(a)*d); g.add(b);
      const sp = new THREE.Mesh(new THREE.ConeGeometry(w*.62, h*.5, 8), roof); sp.position.set(b.position.x, h+.6+h*.25, b.position.z); g.add(sp);
    }
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(r*.25, r*3.2), fallMat);   // 滝
    fall.position.set(0, -r*1.5, r*.92); g.add(fall);
  };
  island(-70, 6, -95, 14, 3); island(85, 10, -120, 18, 7); island(120, -2, 20, 12, 11);
  island(-115, 14, 40, 16, 5); island(30, 22, 140, 13, 9); island(-40, -6, 130, 10, 13);
}
/* ================= アースファン（世界樹型の巨大風車） =================
   ねじれ合う樹皮の幹が雲海の下から立ち上がり、上に葉の茂み。その前に、金の骨組みと白い帆の羽根車が3つ。
   中心の青いコアと光る内輪は「超古代技術」の動力のイメージ。風が弱まると回転と一緒に光も弱まる。
   羽根車を1つずつ止められるようにしてあるのは、ラストの「羽根がひとつ、音もなく止まった」のため。 */
const FAN = { g:new THREE.Group(), rotors:[], glowMat:null };
{
  const F = FAN.g; F.position.set(0, -12, -78); scene.add(F);   // 広場のどこからでも見える位置
  const bark = new THREE.MeshStandardMaterial({...pbrMaps('bark_platanus', 2, 8), color:0xf2efe8, roughness:1, metalness:0, envMapIntensity:.7});
  const gold = new THREE.MeshStandardMaterial({color:0xe6c27a, metalness:1, roughness:.28, envMapIntensity:1.2});   // 空を映す本物の金属
  const sail = new THREE.MeshStandardMaterial({color:0xf7f6f1, roughness:.85, metalness:0, side:THREE.DoubleSide, envMapIntensity:.8});
  // 葉：小さな葉を何千枚も描いたテクスチャを、色と凹凸（bump）の両方に使って茂みの奥行きを出す
  const leafTex = canvasTex(512, (g,s) => {
    g.fillStyle = '#2f4a2a'; g.fillRect(0,0,s,s);
    for (let i=0;i<3200;i++){
      const x = Math.random()*s, y = Math.random()*s, rx = 5 + Math.random()*8, ry = 2.5 + Math.random()*3.5;
      g.fillStyle = `hsl(${88 + Math.random()*36},${32 + Math.random()*25}%,${24 + Math.random()*34}%)`;
      g.beginPath(); g.ellipse(x, y, rx, ry, Math.random()*Math.PI, 0, Math.PI*2); g.fill();
    }
  });
  leafTex.wrapS = leafTex.wrapT = THREE.RepeatWrapping; leafTex.repeat.set(3, 3);
  const leaf = new THREE.MeshStandardMaterial({map:leafTex, bumpMap:leafTex, bumpScale:3, color:0xd8ecc8, roughness:.92, metalness:0});
  FAN.glowMat = new THREE.MeshStandardMaterial({color:0x0a1a33, emissive:new THREE.Color(.35,.85,1.6), emissiveIntensity:1.6, roughness:.2, metalness:.3});

  // 幹：何本もの樹皮の束がねじれ合って、雲海の下から立ち上がる（世界樹）
  const TOP = 30, BOT = -34;
  F.add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.2, TOP-BOT, 20).translate(0, (TOP+BOT)/2, 0), bark));
  for (let k=0;k<7;k++){
    const pts = [];
    for (let i=0;i<=24;i++){
      const t = i/24, y = BOT + (TOP+2-BOT)*t, r = THREE.MathUtils.lerp(4.4, 2.2, t) + Math.sin(t*9+k)*.25;
      const a = k/7*Math.PI*2 + t*Math.PI*1.6;   // 上に行くほどねじれる
      pts.push(new THREE.Vector3(Math.cos(a)*r, y, Math.sin(a)*r));
    }
    F.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 72, .95 - k*.05, 8), bark));
  }
  // 上の枝と葉の茂み（羽根車の後ろ側に広がる）
  const branch = (to) => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, TOP-6, -1), new THREE.Vector3(to.x*.45, TOP+to.y*.4, -2), to]);
    F.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, .7, 7), bark));
  };
  const blob = (x, y, z, r) => {
    const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position, v = new THREE.Vector3();
    for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p, i); const n = 1 + .18*Math.sin(v.x*1.7+y)*Math.sin(v.y*1.3+x)*Math.sin(v.z*1.9); p.setXYZ(i, v.x*n, v.y*n, v.z*n); }
    g.computeVertexNormals(); const m = new THREE.Mesh(g, leaf); m.position.set(x, y, z); F.add(m);
  };
  for (const [x,y,z,r] of [[-15,37,-5,6],[15,38,-5,6.5],[-8,44,-6,7],[8,45,-6,7],[0,48,-7,7.5],[-21,30,-4,4.5],[21,31,-4,4.5],[-3,40,-9,6],[4,36,-10,6]]){
    branch(new THREE.Vector3(x*.8, y-2, z+2)); blob(x, y, z, r);
  }

  // 羽根車：中心の青いコア、金の輪、金の骨組みに張られた白い帆
  const rotor = (x, y, z, R, blades, base) => {
    const hub = new THREE.Group(); hub.position.set(x, y, z); F.add(hub);
    const spin = new THREE.Group(); hub.add(spin);
    spin.add(new THREE.Mesh(new THREE.SphereGeometry(R*.085, 24, 16), FAN.glowMat));                       // コア
    spin.add(new THREE.Mesh(new THREE.TorusGeometry(R*.13, R*.018, 8, 40), gold));
    spin.add(new THREE.Mesh(new THREE.TorusGeometry(R*.3, R*.012, 6, 64), FAN.glowMat));                  // 光る内輪
    spin.add(new THREE.Mesh(new THREE.TorusGeometry(R*.62, R*.014, 6, 96), gold));
    spin.add(new THREE.Mesh(new THREE.TorusGeometry(R*.97, R*.02, 6, 128), gold));
    for (let i=0;i<blades;i++){
      const arm = new THREE.Group(); arm.rotation.z = i/blades*Math.PI*2; spin.add(arm);
      const spar = new THREE.Mesh(new THREE.BoxGeometry(R*.03, R*.98, R*.03), gold); spar.position.y = R*.5; arm.add(spar);
      // 帆：少しふくらんだ布。根元は細く、先は広い
      const W = R*.3, L = R*.72, g = new THREE.PlaneGeometry(W, L, 6, 10), p = g.attributes.position;
      for (let j=0;j<p.count;j++){ const px = p.getX(j), py = p.getY(j), u = (py/L)+.5;
        p.setX(j, px*(.55 + .45*u) + W*.5*(.55+.45*u)); p.setZ(j, Math.sin((px/W+.5)*Math.PI)*R*.025); }
      g.computeVertexNormals();
      const sl = new THREE.Mesh(g, sail); sl.position.y = R*.24 + L*.5; sl.rotation.y = .28; arm.add(sl);
      for (const t of [.0, .33, .66, 1.0]){   // 帆を横切る金の桟
        const bw = W*(.55+.45*t), bat = new THREE.Mesh(new THREE.BoxGeometry(bw, R*.012, R*.02), gold);
        bat.position.set(bw*.5, R*.24 + L*t, 0); bat.rotation.y = .28; arm.add(bat);
      }
      const edge = new THREE.Mesh(new THREE.BoxGeometry(R*.014, L, R*.02), gold); edge.position.set(W, R*.24 + L*.5, -.1); edge.rotation.y = .28; arm.add(edge);
    }
    // 回らない外枠（幹に固定された装飾の輪）
    hub.add(new THREE.Mesh(new THREE.TorusGeometry(R*1.06, R*.016, 6, 128), gold));
    const tilt = new THREE.Mesh(new THREE.TorusGeometry(R*1.12, R*.01, 6, 128), gold); tilt.rotation.y = .5; hub.add(tilt);
    FAN.rotors.push({spin, base, factor:1, stop:false});
  };
  rotor(0, 30, 4.5, 17, 6, .22);          // 主の羽根車（ラストで止まるのはこれ）
  rotor(-17, 21, 2.5, 6.5, 6, .45);
  rotor(17, 22, 2.5, 6, 6, .5);
}
/* 風の状態：on(穏やか) / stutter(止まりかけては回る) / weak(弱い) / off(静寂)
   wind（0〜1）がアースファンの回転・光・舞う粒子・風の音の強さをまとめて決める。 */
let windMode = 'on', wind = 1, windGoal = 1, windStutT = 0;
function setWindMode(m){
  windMode = m; windStutT = 0;
  windGoal = m==='on' ? 1 : m==='weak' ? .22 : m==='off' ? 0 : windGoal;
}
function fanStopMain(){ FAN.rotors[0].stop = true; }   // 頂上の羽根車だけを止める
function resetWind(){ setWindMode('on'); for (const r of FAN.rotors){ r.stop = false; r.factor = 1; } }
function updateWind(dt){
  if (windMode==='stutter'){
    // 弱い⇔強いをランダムな間隔で行き来させ、弱まるときに風車をきしませる
    windStutT -= dt;
    if (windStutT <= 0){
      const weak = Math.random() < .5;
      windGoal = weak ? .05 + Math.random()*.12 : .55 + Math.random()*.4;
      windStutT = .9 + Math.random()*1.8;
      if (weak && running) sfx('creak');
    }
  }
  wind = THREE.MathUtils.damp(wind, windGoal, windMode==='off' ? 2.6 : windMode==='stutter' ? 2.2 : 1.1, dt);
  for (const r of FAN.rotors){
    if (r.stop) r.factor = THREE.MathUtils.damp(r.factor, 0, .5, dt);
    r.spin.rotation.z += dt * r.base * (.02 + wind) * r.factor;   // 静寂でもごくわずかに惰性で回る
  }
  FAN.glowMat.emissiveIntensity = .15 + 1.5*wind;
  grade.uniforms.uDesat.value = (1 - wind)*.75;   // 風が弱まるほど色が抜ける
  const tt = performance.now()/1000;
  for (const b of banners){ b.m.rotation.z = Math.sin(tt*2.2 + b.ph)*.06*wind; b.m.rotation.x = -.12*wind + Math.sin(tt*3 + b.ph)*.05*wind; }
  setWind(running ? wind : 0);
}

// embers
const EMB = 320, embPos = new Float32Array(EMB*3), embCol = new Float32Array(EMB*3), embSpd = new Float32Array(EMB);
for (let i=0;i<EMB;i++){
  const a=Math.random()*Math.PI*2, r=Math.random()*26;
  embPos[i*3]=Math.sin(a)*r; embPos[i*3+1]=Math.random()*12; embPos[i*3+2]=Math.cos(a)*r;
  const warm = Math.random()<.4; const c = warm ? [1.6,.8,.3] : [.4,1.1,1.8];
  embCol.set(c, i*3); embSpd[i] = .3 + Math.random()*.8;
}
const embGeo = new THREE.BufferGeometry();
embGeo.setAttribute('position', new THREE.BufferAttribute(embPos,3));
embGeo.setAttribute('color', new THREE.BufferAttribute(embCol,3));
const embers = new THREE.Points(embGeo, new THREE.PointsMaterial({size:.13, map:dotTex, vertexColors:true, transparent:true,
  blending:THREE.AdditiveBlending, depthWrite:false}));
embers.frustumCulled = false; scene.add(embers);
// light shafts
const shaftTex = canvasTex(256, (g,s) => {
  const gr = g.createLinearGradient(0,s,0,0);
  gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(.2,'rgba(255,255,255,.9)'); gr.addColorStop(.55,'rgba(255,255,255,.35)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0,0,s,s);
});
const shafts = [];
{
  const dir = SUN_DIR.clone();
  for (const [x,z,r] of [[2,-3,3.2],[-6,5,2.4],[7,6,2.0],[-3,-9,1.6]]){
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r*.35, r, 36, 24, 1, true),
      new THREE.MeshBasicMaterial({map:shaftTex, color:new THREE.Color(.55,.75,1.25), transparent:true, opacity:.06,
        blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false}));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
    m.position.set(x,0,z).addScaledVector(dir, 18); scene.add(m); shafts.push(m);
  }
}
// ground mist
const mistTex = canvasTex(256, (g,s) => {
  for (let i=0;i<40;i++){ const x=s*(.15+Math.random()*.7), y=s*(.15+Math.random()*.7), r=s*(.08+Math.random()*.18);
    const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(255,255,255,.18)'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr; g.fillRect(0,0,s,s); }
});
const mists = [];
for (let i=0;i<9;i++){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(16,16), new THREE.MeshBasicMaterial({map:mistTex, color:new THREE.Color(.5,.55,.65),
    transparent:true, opacity:.1, blending:THREE.AdditiveBlending, depthWrite:false}));
  m.rotation.x = -Math.PI/2; const a = Math.random()*Math.PI*2, r = Math.random()*16;
  m.position.set(Math.sin(a)*r, .25 + (i%3)*.25, Math.cos(a)*r); m.rotation.z = Math.random()*6;
  scene.add(m); mists.push({m, sp:(Math.random()-.5)*.06, ph:Math.random()*6});
}

/* ================= particles ================= */
const PMAX = 1000;
const pPos = new Float32Array(PMAX*3).fill(-999), pCol = new Float32Array(PMAX*3), pBase = new Float32Array(PMAX*3);
const pVel = new Float32Array(PMAX*3), pLife = new Float32Array(PMAX), pMax = new Float32Array(PMAX).fill(1), pGrav = new Float32Array(PMAX);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol,3));
const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({size:.26, map:dotTex, vertexColors:true, transparent:true,
  blending:THREE.AdditiveBlending, depthWrite:false}));
parts.frustumCulled = false; scene.add(parts);
let pIdx = 0;
function emit(pos, color, count, speed=5, life=.6, up=1.5, spread=0.2, grav=6){
  for (let i=0;i<count;i++){
    const k = pIdx; pIdx = (pIdx+1)%PMAX;
    pPos[k*3]=pos.x+(Math.random()-.5)*spread; pPos[k*3+1]=pos.y+(Math.random()-.5)*spread; pPos[k*3+2]=pos.z+(Math.random()-.5)*spread;
    const u=Math.random()*2-1, th=Math.random()*Math.PI*2, s=Math.sqrt(1-u*u), sp=speed*(.35+Math.random()*.65);
    pVel[k*3]=s*Math.cos(th)*sp; pVel[k*3+1]=u*sp+up; pVel[k*3+2]=s*Math.sin(th)*sp;
    pLife[k]=pMax[k]=life*(.6+Math.random()*.6); pGrav[k]=grav;
    const m = 1 + Math.random()*1.2;
    pBase[k*3]=color.r*m; pBase[k*3+1]=color.g*m; pBase[k*3+2]=color.b*m;
  }
}
function updateParticles(dt){
  for (let k=0;k<PMAX;k++){
    if (pLife[k] <= 0) continue;
    pLife[k] -= dt;
    if (pLife[k] <= 0){ pPos[k*3+1] = -999; continue; }
    pVel[k*3+1] -= pGrav[k]*dt;
    const d = Math.pow(0.08, dt);
    pVel[k*3]*=d; pVel[k*3+1]*=d; pVel[k*3+2]*=d;
    pPos[k*3]+=pVel[k*3]*dt; pPos[k*3+1]+=pVel[k*3+1]*dt; pPos[k*3+2]+=pVel[k*3+2]*dt;
    const f = pLife[k]/pMax[k];
    pCol[k*3]=pBase[k*3]*f; pCol[k*3+1]=pBase[k*3+1]*f; pCol[k*3+2]=pBase[k*3+2]*f;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}

/* ================= hero ================= */
const PIV = .85; // body pivot height (for rolls)
function buildHero(){
  const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner); inner.position.y = PIV;
  const dark  = new THREE.MeshStandardMaterial({color:0x0e1120, roughness:.45, metalness:.55});
  const gold  = new THREE.MeshStandardMaterial({color:0xd8b25a, roughness:.22, metalness:1});
  const add = (geo, mat, x,y,z, parent) => { const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.castShadow=true; parent.add(m); return m; };
  // sword (blade along +Z of the hand)
  const sword = new THREE.Group(); sword.scale.setScalar(.82);
  add(new THREE.CylinderGeometry(.026,.026,.24,8).rotateX(Math.PI/2), dark, 0,0,-.02, sword);
  add(new THREE.SphereGeometry(.042,10,8), gold, 0,0,-.16, sword);
  add(new THREE.BoxGeometry(.34,.08,.05), gold, 0,0,.11, sword);
  add(new THREE.TorusGeometry(.055,.014,6,16), gold, 0,0,.11, sword).rotation.x = Math.PI/2;
  const sh = new THREE.Shape(); sh.moveTo(-.055,0); sh.lineTo(.055,0); sh.lineTo(.055,-1.2); sh.lineTo(0,-1.44); sh.lineTo(-.055,-1.2); sh.closePath();
  const bg = new THREE.ExtrudeGeometry(sh, {depth:.02, bevelEnabled:true, bevelThickness:.011, bevelSize:.011, bevelSegments:1});
  bg.translate(0,0,-.01); bg.rotateX(-Math.PI/2); bg.translate(0,0,.13);
  const bladeMat = new THREE.MeshStandardMaterial({color:0xd8ecff, metalness:1, roughness:.12, emissive:new THREE.Color(.3,.75,1), emissiveIntensity:.5});
  add(bg, bladeMat, 0,0,0, sword);
  const fuller = add(new THREE.BoxGeometry(.014,.05,1.02), new THREE.MeshBasicMaterial({color:new THREE.Color(1.2,2.6,3.2)}), 0,0,.78, sword);
  const tip = new THREE.Object3D(); tip.position.set(0,0,1.57); sword.add(tip);
  const base = new THREE.Object3D(); base.position.set(0,0,.75); sword.add(base);
  // ground glow
  const gglow = new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.8), new THREE.MeshBasicMaterial({map:dotTex, color:new THREE.Color(.3,.9,1.4),
    transparent:true, opacity:.15, blending:THREE.AdditiveBlending, depthWrite:false}));
  gglow.rotation.x = -Math.PI/2; gglow.position.y = .03; root.add(gglow);
  const light = new THREE.PointLight(0x66e0ff, 1.5, 5, 2); scene.add(light);
  const lookObj = new THREE.Object3D(); scene.add(lookObj);
  scene.add(root);
  return {root, inner, sword, tip, base, light, bladeMat, fuller, lookObj, vrm:null, bones:{}, hipsY:0, cape:null};
}
const H = buildHero();
const hero = {
  pos:H.root.position, vel:new THREE.Vector3(), facing:0, onGround:true,
  hp:100, maxHp:100, atb:0, state:'free', t:0, combo:0, queued:false, hitDone:false,
  invuln:0, dodgeDir:new THREE.Vector3(), runPhase:0, perfectGiven:false, deadT:0, lunge:4.5
};
const atkDur = () => hero.combo===3 ? .56 : .38;
let heroReady = false;
const BONES = ['hips','spine','chest','upperChest','neck','head','leftShoulder','rightShoulder','leftUpperArm','leftLowerArm','leftHand',
  'rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot'];
const vrmLoader = new GLTFLoader(); vrmLoader.register(p => new VRMLoaderPlugin(p));
async function loadVRM(url){
  const gltf = await vrmLoader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const bones = {}; for (const n of BONES){ const bn = vrm.humanoid.getNormalizedBoneNode(n); if (bn) bones[n] = bn; }
  return {vrm, bones, sign: vrm.meta && vrm.meta.metaVersion === '0' ? -1 : 1};
}
function rimVRM(vrm, r,g,b){
  const mats = new Set(); vrm.scene.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => mats.add(m)); });
  for (const m of mats){ if (!m.isMToonMaterial) continue;
    if (m.parametricRimColorFactor){ m.parametricRimColorFactor.setRGB(r,g,b); m.parametricRimFresnelPowerFactor = 3.4; m.parametricRimLiftFactor = .04; }
    if ('rimLightingMixFactor' in m) m.rimLightingMixFactor = .6; }
}
// NPC: Ciel, the star-reader at the altar
const NPC = { root:new THREE.Group(), vrm:null, bones:{}, sign:1, hipsY:0, look:new THREE.Object3D(), talk:0, expr:null, blinkT:1 };
NPC.root.position.set(0,0,-14.0); scene.add(NPC.root); scene.add(NPC.look);
{ // altar behind her
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.4,1.0,8), stoneMat); ped.position.set(0,.5,-16.4); ped.castShadow = ped.receiveShadow = true; scene.add(ped);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.1,.18,8), stoneMat); top.position.set(0,1.08,-16.4); scene.add(top);
  const ac = new THREE.Mesh(new THREE.OctahedronGeometry(.55,0), crystalMats[0]); ac.position.set(0,3.6,-16.4); ac.scale.y = 1.7; scene.add(ac);
  crystals.push({m:ac, base:3.6, ph:0});
  const al = new THREE.PointLight(0x7fe8ff, 3, 7, 2); al.position.set(0,3.4,-16.8); scene.add(al);
}
{
  // title loader: thin progress line under the menu (2 VRM models)
  const btn = document.getElementById('startBtn'), btn2 = document.getElementById('endlessBtn');
  const loadText = document.getElementById('tlLoadText'), loadFill = document.getElementById('tlLoadFill');
  let done = 0;
  const tick = () => { done++; loadFill.style.width = (done/2*100)+'%'; };
  Promise.all([
    loadVRM(`${import.meta.env.BASE_URL}models/lumina.vrm`).then(r => { tick(); return r; }),
    loadVRM(`${import.meta.env.BASE_URL}models/ciel.vrm`).then(r => { tick(); return r; })
  ]).then(([L, C]) => {
    // hero: Lumina
    const vrm = L.vrm; vrm.scene.position.y = -PIV; H.inner.add(vrm.scene);
    rimVRM(vrm, .3,.75,1.4);
    H.bones = L.bones; H.sign = L.sign; H.hipsY = H.bones.hips.position.y;
    H.bones.rightHand.add(H.sword);
    vrm.scene.updateMatrixWorld(true);
    const hp = H.bones.rightHand.getWorldPosition(new THREE.Vector3()), lp = H.bones.rightLowerArm.getWorldPosition(new THREE.Vector3());
    const fd = hp.sub(lp).normalize().applyQuaternion(H.bones.rightHand.getWorldQuaternion(new THREE.Quaternion()).invert());
    H.sword.position.copy(fd.multiplyScalar(.07));
    if (vrm.lookAt) vrm.lookAt.target = H.lookObj;
    H.vrm = vrm;
    // NPC: Ciel
    NPC.vrm = C.vrm; NPC.bones = C.bones; NPC.sign = C.sign; NPC.hipsY = C.bones.hips.position.y;
    rimVRM(C.vrm, 1.3,.75,1.0); NPC.root.add(C.vrm.scene);
    if (C.vrm.lookAt) C.vrm.lookAt.target = NPC.look;
    heroReady = true;
    btn.disabled = false; btn2.disabled = false;
    document.getElementById('startOv').classList.add('ready');
  }).catch(err => { loadText.textContent = 'モデルの読み込みに失敗しました'; console.error(err); });
}

/* ================= camera ================= */
let camYaw = 0, camPitch = 0.24, camDist = 4.0, shake = 0;
const camTarget = new THREE.Vector3(0,1.2,0), lastLockPos = new THREE.Vector3();

/* ================= audio ================= */
/* ================= input ================= */
const keys = new Set(), pressed = new Set();
addEventListener('keydown', e => {
  keys.add(e.code); if (e.repeat) return;
  const m = {Space:'jump',KeyK:'jump',Enter:'jump',KeyJ:'attack',KeyL:'dodge',ShiftLeft:'dodge',KeyI:'special',Escape:'pause',KeyP:'pause',KeyF:'lock',Tab:'lock',KeyQ:'switchL',KeyE:'switchR'}[e.code];
  if (e.code==='Tab') e.preventDefault();
  if (m) pressed.add(m);
});
addEventListener('keyup', e => keys.delete(e.code));
let prevBtn = [], padConnected = false;
function readPad(){
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.connected) return p;
  return null;
}
function rumble(strong, weak, ms){
  const p = readPad();
  try{ p && p.vibrationActuator && p.vibrationActuator.playEffect && p.vibrationActuator.playEffect('dual-rumble',{startDelay:0,duration:ms,strongMagnitude:strong,weakMagnitude:weak}).catch(()=>{}); }catch(e){}
}
// touch
const touchEl = $('touch'), joyEl = $('joy'), knob = $('knob');
const ts = {joyId:null, ox:0, oy:0, jx:0, jy:0, camId:null, lx:0, ly:0, dx:0, dy:0};
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
touchEl.addEventListener('pointerdown', e => {
  if (e.target.closest('.tbtn') || e.target.id==='pauseBtn') return;
  if (e.clientX < innerWidth*0.45 && ts.joyId===null){
    ts.joyId = e.pointerId; ts.ox = e.clientX; ts.oy = e.clientY;
    joyEl.style.left = (e.clientX-60)+'px'; joyEl.style.top = (e.clientY-60)+'px'; joyEl.style.bottom='auto';
  } else if (ts.camId===null){ ts.camId = e.pointerId; ts.lx = e.clientX; ts.ly = e.clientY; }
});
addEventListener('pointermove', e => {
  if (e.pointerId===ts.joyId){
    let dx=e.clientX-ts.ox, dy=e.clientY-ts.oy; const l=Math.hypot(dx,dy), mx=50;
    if (l>mx){ dx*=mx/l; dy*=mx/l; }
    ts.jx = dx/mx; ts.jy = dy/mx; knob.style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId===ts.camId){ ts.dx += e.clientX-ts.lx; ts.dy += e.clientY-ts.ly; ts.lx=e.clientX; ts.ly=e.clientY; }
});
const endPtr = e => {
  if (e.pointerId===ts.joyId){ ts.joyId=null; ts.jx=ts.jy=0; knob.style.transform=''; }
  if (e.pointerId===ts.camId) ts.camId=null;
};
addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
document.querySelectorAll('.tbtn').forEach(b => {
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pressed.add(b.dataset.a); b.classList.add('act'); });
  const up = () => b.classList.remove('act');
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
});
$('pauseBtn').addEventListener('pointerdown', e => { e.stopPropagation(); pressed.add('pause'); });

function gatherInput(){
  const inp = {mx:0,my:0,cx:0,cy:0,rx:0,jump:false,attack:false,dodge:false,special:false,pause:false,lock:false,switchL:false,switchR:false,any:false};
  if (keys.has('KeyA')) inp.mx-=1; if (keys.has('KeyD')) inp.mx+=1;
  if (keys.has('KeyW')) inp.my-=1; if (keys.has('KeyS')) inp.my+=1;
  if (keys.has('ArrowLeft')) inp.cx-=1; if (keys.has('ArrowRight')) inp.cx+=1;
  if (keys.has('ArrowUp')) inp.cy-=1; if (keys.has('ArrowDown')) inp.cy+=1;
  inp.mx += ts.jx; inp.my += ts.jy;
  const p = readPad();
  padConnected = !!p;
  if (p){
    const ax = p.axes;
    const lx = ax[0]||0, ly = ax[1]||0, lm = Math.hypot(lx,ly);
    if (lm > .15){ const s = Math.min(1,(lm-.15)/.8)/lm; inp.mx += lx*s; inp.my += ly*s; }
    const rx = ax[2]||0, ry = ax[3]||0;
    inp.rx = rx; if (Math.abs(rx)>.15) inp.cx += rx; if (Math.abs(ry)>.15) inp.cy += ry;
    const b = p.buttons.map(x => x.pressed);
    const edge = (i,a) => { if (b[i] && !prevBtn[i]) { inp[a]=true; inp.any=true; } };
    edge(0,'jump'); edge(1,'dodge'); edge(2,'attack'); edge(3,'special'); edge(9,'pause'); edge(5,'attack'); edge(4,'lock'); edge(11,'lock');
    // d-pad as movement
    if (b[12]) inp.my-=1; if (b[13]) inp.my+=1; if (b[14]) inp.mx-=1; if (b[15]) inp.mx+=1;
    prevBtn = b;
  }
  for (const a of pressed){ inp[a] = true; inp.any = true; }
  pressed.clear();
  const m = Math.hypot(inp.mx, inp.my); if (m>1){ inp.mx/=m; inp.my/=m; }
  return inp;
}

/* ================= helpers ================= */
const _v = new THREE.Vector3();
function toScreen(p){ _v.copy(p).project(camera); return {x:(_v.x*.5+.5)*innerWidth, y:(-_v.y*.5+.5)*innerHeight, vis:_v.z<1 && _v.z>-1}; }
const labels = $('labels');
function popText(pos, text, cls=''){
  const s = toScreen(pos); if (!s.vis) return;
  const d = document.createElement('div'); d.className = 'pop '+cls; d.textContent = text;
  d.style.left = (s.x + (Math.random()-.5)*30)+'px'; d.style.top = s.y+'px';
  labels.appendChild(d); setTimeout(() => d.remove(), 900);
}
const bannerEl = $('banner');
function banner(t, s='', cls=''){
  bannerEl.className = ''; bannerEl.innerHTML = `<div class="t">${t}</div>${s?`<div class="s">${s}</div>`:''}`;
  void bannerEl.offsetWidth; bannerEl.className = 'show '+cls;
}
const flashEl = $('flash');
function flash(kind='white', o=.6){ flashEl.className = kind==='red'?'red':''; flashEl.style.transition='none'; flashEl.style.opacity=o;
  requestAnimationFrame(()=>{ flashEl.style.transition='opacity .35s'; flashEl.style.opacity=0; }); }
const lerpAngle = (a,b,t) => { let d = ((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI; return a+d*t; };
const easeOut = t => 1-Math.pow(1-t,3);
let hitStop = 0, slowMo = 0;

/* ================= slashes & shockwaves ================= */
const fx = [];
function spawnSlash(n){
  const g = new THREE.Group(); g.position.copy(hero.pos); g.position.y += n===3 ? 1.0 : 1.15; g.rotation.y = hero.facing;
  const col = n===3 ? new THREE.Color(1.1,.8,.35) : new THREE.Color(.35,.9,1.2);
  const mk = (r0,r1,s,l,op) => new THREE.Mesh(new THREE.RingGeometry(r0,r1,40,1,s,l),
    new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:op, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false}));
  const tilt = new THREE.Group(); g.add(tilt);
  let a, b;
  if (n<3){
    a = mk(2.0,2.15,-Math.PI/2-1.35,2.7,.5); b = mk(1.2,2.0,-Math.PI/2-1.35,2.7,.08);
    a.rotation.x = b.rotation.x = -Math.PI/2; tilt.rotation.z = n===1 ? .22 : -.22;
  } else {
    a = mk(2.3,2.5,-.9,2.4,.5); b = mk(1.0,2.3,-.9,2.4,.1);
    a.rotation.y = b.rotation.y = -Math.PI/2;
  }
  tilt.add(a,b); scene.add(g);
  fx.push({obj:g, mats:[a.material,b.material], base:[a.material.opacity,b.material.opacity], t:0, life:.24, grow:.25});
}
function spawnShock(pos, color, maxR=7){
  const ring = new THREE.Mesh(new THREE.RingGeometry(.85,1,72), new THREE.MeshBasicMaterial({color, transparent:true, opacity:1,
    blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false}));
  ring.rotation.x = -Math.PI/2; ring.position.set(pos.x,.12,pos.z); scene.add(ring);
  fx.push({obj:ring, mats:[ring.material], base:[1], t:0, life:.55, scaleTo:maxR});
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.6,14,32,1,true), new THREE.MeshBasicMaterial({color, transparent:true, opacity:.7,
    blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false}));
  pillar.position.set(pos.x,7,pos.z); scene.add(pillar);
  fx.push({obj:pillar, mats:[pillar.material], base:[.7], t:0, life:.6, pillar:true});
}
function impact(pos, color, size=2.2){
  const mk = (sx,sy,rot,op) => { const m = new THREE.SpriteMaterial({map:dotTex, color, blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, rotation:rot});
    const sp = new THREE.Sprite(m); sp.position.copy(pos); sp.scale.set(sx,sy,1); scene.add(sp);
    fx.push({obj:sp, mats:[m], base:[op], t:0, life:.16, grow:.8, keepGeo:true}); };
  mk(size,size,0,.25); const r = Math.random()*Math.PI; mk(size*2.6,size*.12,r,.9); mk(size*1.7,size*.1,r+1.4,.7);
}
function spawnBeam(pos, color){
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.5,.9,16,24,1,true), new THREE.MeshBasicMaterial({map:shaftTex, color, transparent:true, opacity:.9,
    blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false}));
  pillar.position.set(pos.x,8,pos.z); scene.add(pillar);
  fx.push({obj:pillar, mats:[pillar.material], base:[.9], t:0, life:.8, pillar:true});
}
// sword ribbon trail
const TN = 24, trPos = new Float32Array(TN*2*3), trCol = new Float32Array(TN*2*4), trS = [];
const trGeo = new THREE.BufferGeometry();
{ const idx=[]; for (let i=0;i<TN-1;i++){ const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); } trGeo.setIndex(idx); }
trGeo.setAttribute('position', new THREE.BufferAttribute(trPos,3));
trGeo.setAttribute('color', new THREE.BufferAttribute(trCol,4));
const trail = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, blending:THREE.AdditiveBlending,
  side:THREE.DoubleSide, depthWrite:false}));
trail.frustumCulled = false; scene.add(trail);
const TC = new THREE.Color(.2,.75,1.2), TG = new THREE.Color(1.1,.6,.15);
function updateTrail(){
  const h = hero;
  const au = h.t/atkDur(), active = (h.state==='attack' && au > .13 && au < .52) || (h.state==='special' && !h.hitDone);
  trS.unshift({b:H.base.getWorldPosition(new THREE.Vector3()), t:H.tip.getWorldPosition(new THREE.Vector3()), s:active?1:0,
    c:(h.state==='special' || h.combo===3) ? TG : TC});
  if (trS.length > TN) trS.pop();
  for (let i=0;i<TN;i++){
    const sm = trS[Math.min(i, trS.length-1)], f = sm.s * Math.pow(1-i/(TN-1), 1.4);
    trPos.set([sm.b.x,sm.b.y,sm.b.z], i*6); trPos.set([sm.t.x,sm.t.y,sm.t.z], i*6+3);
    trCol.set([sm.c.r,sm.c.g,sm.c.b,0], i*8); trCol.set([sm.c.r,sm.c.g,sm.c.b,f*.5], i*8+4);
  }
  trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true;
}
// shatter debris
const shardGeo = new THREE.TetrahedronGeometry(.24,0), debris = [];
function shatter(pos, color, n, scale){
  const mat = new THREE.MeshStandardMaterial({color:0x1a0c18, emissive:color, emissiveIntensity:1.8, metalness:.9, roughness:.2, flatShading:true});
  const items = [];
  for (let i=0;i<n;i++){
    const m = new THREE.Mesh(shardGeo, mat); m.position.copy(pos).add(new THREE.Vector3((Math.random()-.5)*.6,(Math.random()-.5)*.6,(Math.random()-.5)*.6));
    m.scale.setScalar(scale*(.5+Math.random()*.9)); m.castShadow = true; scene.add(m);
    const a = Math.random()*Math.PI*2, sp = 3+Math.random()*5;
    items.push({m, v:new THREE.Vector3(Math.cos(a)*sp, 4+Math.random()*6, Math.sin(a)*sp), s:new THREE.Vector3(Math.random()*12,Math.random()*12,Math.random()*12), s0:m.scale.x});
  }
  debris.push({mat, items, life:1.6});
}
function updateDebris(dt){
  for (let i=debris.length-1;i>=0;i--){
    const d = debris[i]; d.life -= dt;
    const k = Math.min(1, d.life/.5); d.mat.emissiveIntensity = 1.8*k + .2;
    for (const it of d.items){
      it.v.y -= 20*dt; it.m.position.addScaledVector(it.v, dt);
      if (it.m.position.y < .12){ it.m.position.y = .12; it.v.y *= -.35; it.v.x *= .6; it.v.z *= .6; it.s.multiplyScalar(.7); }
      it.m.rotation.x += it.s.x*dt; it.m.rotation.y += it.s.y*dt; it.m.rotation.z += it.s.z*dt;
      it.m.scale.setScalar(it.s0*Math.max(.001,k));
    }
    if (d.life <= 0){ d.items.forEach(it=>scene.remove(it.m)); d.mat.dispose(); debris.splice(i,1); }
  }
}
function updateFx(dt){
  for (let i=fx.length-1;i>=0;i--){
    const f = fx[i]; f.t += dt; const k = f.t/f.life;
    if (k>=1){ scene.remove(f.obj); if (!f.keepGeo) f.obj.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); f.mats.forEach(m=>m.dispose()); fx.splice(i,1); continue; }
    f.mats.forEach((m,j) => m.opacity = f.base[j]*(1-k)*(1-k));
    if (f.grow) f.obj.scale.setScalar(1+f.grow*k);
    if (f.scaleTo) f.obj.scale.setScalar(1+(f.scaleTo-1)*easeOut(k));
    if (f.pillar) f.obj.scale.set(1+k*1.5,1,1+k*1.5);
  }
}

/* ================= enemies ================= */
const enemies = [], shots = [];
const geo = {
  golem:new THREE.IcosahedronGeometry(.85,0), caster:new THREE.OctahedronGeometry(.55,0),
  shard:new THREE.TetrahedronGeometry(.18,0), eye:new THREE.SphereGeometry(.09,10,8),
  halo:new THREE.TorusGeometry(.8,.03,6,40),
  golemEdges:new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.86,0)), casterEdges:new THREE.EdgesGeometry(new THREE.OctahedronGeometry(.56,0)), ground:new THREE.RingGeometry(.9,1.1,40), shot:new THREE.SphereGeometry(.22,12,10)
};
function spawnEnemy(type, pos, elite=false){
  const color = new THREE.Color(type==='golem' ? (elite?0xff8a2a:0xff2a5a) : 0xaa4cff);
  const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
  const mat = new THREE.MeshStandardMaterial({color:0x22101c, emissive:color, emissiveIntensity:.3, metalness:.9, roughness:.18, flatShading:true});
  const body = new THREE.Group(); g.add(body);
  const core = new THREE.Mesh(geo[type], mat); core.castShadow = true; body.add(core);
  const lm = new THREE.LineBasicMaterial({color:color.clone().multiplyScalar(2.4)});
  core.add(new THREE.LineSegments(geo[type+'Edges'], lm));
  const eyeM = new THREE.MeshBasicMaterial({color:new THREE.Color(2.5,2.3,2.0)});
  const eye = new THREE.Mesh(geo.eye, eyeM); eye.position.set(0,.1,type==='golem'?.78:.5); body.add(eye);
  const glowMat = new THREE.MeshStandardMaterial({color:0x000000, emissive:color, emissiveIntensity:2.8, flatShading:true});
  const orbit = new THREE.Group(); body.add(orbit);
  if (type==='golem'){
    for (let i=0;i<4;i++){ const s=new THREE.Mesh(geo.shard, glowMat); const a=i/4*Math.PI*2; s.position.set(Math.cos(a)*1.25,0,Math.sin(a)*1.25); orbit.add(s); }
  } else {
    for (let i=0;i<2;i++){ const h=new THREE.Mesh(geo.halo, glowMat); h.rotation.x = i?1.2:-.6; h.rotation.y = i*1.4; orbit.add(h); }
  }
  const gm = new THREE.MeshBasicMaterial({color, transparent:true, opacity:.35, blending:THREE.AdditiveBlending, depthWrite:false});
  const ground = new THREE.Mesh(geo.ground, gm); ground.rotation.x = -Math.PI/2; ground.position.y = .04; g.add(ground);
  const sc = elite ? 1.6 : 1; g.scale.setScalar(.01);
  const hpBase = type==='golem' ? 48 + wave*9 : 30 + wave*6;
  const hp = elite ? hpBase*3.2 : hpBase;
  const bar = document.createElement('div'); bar.className = 'ebar'+(elite?' elite':''); bar.innerHTML='<i></i>'; labels.appendChild(bar);
  spawnBeam(pos, color);
  const e = {type, elite, lm, name: mode==='story' ? '正体不明の影' : elite ? 'ゴーレム・ロード' : type==='golem' ? 'クリスタル・ゴーレム' : 'ヴォイド・メイジ', g, body, core, mat, orbit, ground, gm, color, sc, hp, maxHp:hp, state:'spawn', t:0,
    cd:1+Math.random()*1.5, vel:new THREE.Vector3(), stagger:0, flash:0, bar, barI:bar.firstChild,
    radius:(type==='golem'?.9:.6)*sc, hover:type==='golem'?1.1:1.7, strikeDir:new THREE.Vector3(), struck:false, ph:Math.random()*6};
  emit(new THREE.Vector3(pos.x,.3,pos.z), color, 40, 3, .9, 4, 1.5, 2);
  enemies.push(e);
}
function removeEnemy(e){
  scene.remove(e.g); e.mat.dispose(); e.gm.dispose(); e.lm.dispose(); e.bar.remove();
  if (lockTarget === e) lockTarget = null;
  enemies.splice(enemies.indexOf(e),1);
}
function damageEnemy(e, dmg, dir, kb){
  const crit = Math.random() < .15 || e.state==='windup';
  if (crit) dmg = Math.round(dmg*1.6);
  e.hp -= dmg; e.flash = .12; e.punch = .22;
  const at = e.g.position.clone(); at.y += e.hover*e.sc + .6;
  popText(at, dmg, crit?'crit':'');
  emit(at, crit ? new THREE.Color(1,.75,.25) : new THREE.Color(.35,.8,1.1), crit?20:12, 8, .4, 1, .3, 8);
  impact(at.clone().addScaledVector(dir.clone().normalize(), -.5), crit ? new THREE.Color(1.6,1.2,.5) : new THREE.Color(.7,1.3,1.7), crit?1.6:1.1);
  aberr = Math.max(aberr, crit ? .01 : .005);
  if (e.boss){ if (crit) e.stagger = .12; }
  else if (!e.elite || crit){ e.stagger = .35; if (e.state==='windup'||e.state==='strike'){ e.state='chase'; e.cd=1.2; } }
  e.vel.addScaledVector(dir, kb/(e.elite?2.5:1));
  if (e.hp <= 0){
    kills++; hero.atb = Math.min(100, hero.atb+5);
    const p = e.g.position.clone(); p.y += e.hover*e.sc;
    emit(p, e.color, 60, 9, 1.0, 2, .6, 5); emit(p, new THREE.Color(2,2,2), 20, 5, .5, 1, .3, 2);
    shatter(p, e.color, e.elite ? 16 : 10, e.sc*(e.type==='golem'?1.2:.8)); impact(p, e.color.clone().multiplyScalar(1.4), 2.2*e.sc);
    sfx('break'); rumble(.6,.4,140);
    const wasLocked = lockTarget === e;
    removeEnemy(e);
    if (wasLocked) setLock(acquireLock(), true);
  }
}
function updateEnemies(dt, now){
  for (const e of [...enemies]){
    const g = e.g, to = new THREE.Vector3().subVectors(hero.pos, g.position); to.y = 0;
    const dist = to.length(); const dir = dist>0.001 ? to.clone().divideScalar(dist) : new THREE.Vector3(0,0,1);
    e.t += dt; e.flash -= dt;
    // visual
    e.body.position.y = e.hover + Math.sin(now*2.2+e.ph)*.15;
    e.punch = THREE.MathUtils.damp(e.punch||0, 0, 10, dt); const pq = e.punch*Math.cos((e.punch)*40);
    e.body.scale.set(1+pq, 1-pq*.8, 1+pq);
    e.orbit.rotation.y += dt*(e.state==='windup'?9:2.2);
    e.core.rotation.x += dt*.4;
    if (e.state==='spawn'){
      const k = Math.min(1, e.t/.6); g.scale.setScalar(e.sc*easeOut(k));
      if (k>=1){ e.state='chase'; e.t=0; }
      continue;
    }
    let ei = .3;
    if (e.state==='windup') ei = .3 + 2.6*(e.t/(e.type==='golem'?.75:.6));
    e.mat.emissive.copy(e.color); if (e.flash>0) e.mat.emissive.lerp(new THREE.Color(1,1,1), .5);
    if (e.boss && e.phase===2 && e.flash<=0){ e.mat.emissive.setRGB(1,.25,.1); }
    e.lm.color.copy(e.flash>0 ? new THREE.Color(1.1,1.1,1.1) : e.color).multiplyScalar(e.flash>0 ? 1 : (e.state==='windup' ? 3.5 : 2.4));
    e.mat.emissiveIntensity = e.flash>0 ? .75 : ei;
    e.gm.opacity = e.state==='windup' ? .35 + .6*Math.abs(Math.sin(e.t*20)) : .3;
    g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dir.x, dir.z), Math.min(1, dt*6));

    const vdamp = Math.pow(.02, dt); e.vel.multiplyScalar(vdamp);
    if (e.stagger > 0){ e.stagger -= dt; }
    else if (hero.state !== 'dead'){
      const spd = e.type==='golem' ? (e.elite?2.4:2.9) : 2.2;
      if (e.boss) bossAI(e, dt, dist, dir, now);
      else if (e.type==='golem'){
        if (e.state==='chase'){
          e.cd -= dt;
          if (dist > 1.9*e.sc) g.position.addScaledVector(dir, spd*dt);
          if (dist < 2.6*e.sc && e.cd <= 0){ e.state='windup'; e.t=0; }
        } else if (e.state==='windup'){
          g.position.addScaledVector(dir, -.6*dt);
          if (e.t >= .75){ e.state='strike'; e.t=0; e.strikeDir.copy(dir); e.struck=false; }
        } else if (e.state==='strike'){
          g.position.addScaledVector(e.strikeDir, 10*dt*(1-e.t/.25));
          if (!e.struck && dist < 1.9*e.sc + .3){ e.struck = true; hurtHero(Math.round((11+wave)*(e.elite?1.7:1)), g.position); }
          if (e.t >= .25){ e.state='chase'; e.cd = (e.elite?1.0:1.6) + Math.random(); }
        }
      } else {
        if (e.state==='chase'){
          e.cd -= dt;
          if (dist < 6) g.position.addScaledVector(dir, -spd*dt);
          else if (dist > 10) g.position.addScaledVector(dir, spd*dt);
          else { const side = new THREE.Vector3(dir.z,0,-dir.x); g.position.addScaledVector(side, Math.sin(now*.7+e.ph)*1.2*dt); }
          if (e.cd <= 0 && dist < 16){ e.state='windup'; e.t=0; }
        } else if (e.state==='windup'){
          if (e.t >= .6){ fireShot(e); e.state='chase'; e.cd = 2.2 + Math.random()*1.2; }
        }
      }
    }
    g.position.addScaledVector(e.vel, dt);
    // separation
    for (const o of enemies){ if (o===e) continue;
      const d = new THREE.Vector3().subVectors(g.position, o.g.position); d.y=0; const l = d.length(), m = e.radius+o.radius+.2;
      if (l < m && l > .001) g.position.addScaledVector(d, (m-l)/l*.5);
    }
    const r = Math.hypot(g.position.x, g.position.z); if (r > ARENA){ g.position.x *= ARENA/r; g.position.z *= ARENA/r; }
    // bar
    if (e.boss) continue;
    const bp = g.position.clone(); bp.y += (e.hover + 1.3)*e.sc;
    const s = toScreen(bp);
    if (s.vis){ e.bar.style.display='block'; e.bar.style.transform=`translate(${s.x}px,${s.y}px)`; e.barI.style.width = Math.max(0,e.hp/e.maxHp*100)+'%'; }
    else e.bar.style.display='none';
  }
}
const shotMat = new THREE.MeshBasicMaterial({color:new THREE.Color(1.8,.8,2.6)});
function fireShot(e){
  const p = e.g.position.clone(); p.y += e.hover;
  const target = hero.pos.clone(); target.y += 1.0;
  const dir = target.sub(p).normalize();
  const m = new THREE.Mesh(geo.shot, shotMat); m.position.copy(p); scene.add(m);
  shots.push({m, dir, life:3.2, speed:8.5 + wave*.3});
  sfx('shot');
}
function updateShots(dt){
  const chest = hero.pos.clone(); chest.y += 1.0;
  for (let i=shots.length-1;i>=0;i--){
    const s = shots[i]; s.life -= dt; s.m.position.addScaledVector(s.dir, s.speed*dt);
    s.m.scale.setScalar(1 + Math.sin(s.life*30)*.15);
    if (Math.random()<.6) emit(s.m.position, new THREE.Color(1.2,.5,2), 1, .5, .35, 0, .1, 0);
    let hit = false;
    if (s.m.position.distanceTo(chest) < .75) hit = hurtHero(9 + Math.floor(wave/2), s.m.position);
    if (hit || s.life <= 0 || s.m.position.y < 0){
      emit(s.m.position, new THREE.Color(1.6,.7,2.4), 14, 4, .4); scene.remove(s.m); shots.splice(i,1);
    }
  }
}

/* ================= hero logic ================= */
function hurtHero(dmg, src){
  if (hero.state==='dead') return false;
  if (hero.state==='dodge'){
    if (!hero.perfectGiven){
      hero.perfectGiven = true; hero.atb = Math.min(100, hero.atb+15); slowMo = .45;
      const p = hero.pos.clone(); p.y += 2.1; popText(p, 'JUST DODGE!', 'just'); sfx('just'); rumble(.2,.6,90);
    }
    return false;
  }
  if (hero.invuln > 0 || hero.state==='special') return false;
  hero.hp = Math.max(0, hero.hp - dmg);
  const p = hero.pos.clone(); p.y += 2; popText(p, dmg, 'hurt');
  const kb = new THREE.Vector3().subVectors(hero.pos, src); kb.y = 0; kb.normalize().multiplyScalar(7);
  hero.vel.x = kb.x; hero.vel.z = kb.z;
  hero.invuln = .7; shake = Math.max(shake,.35); flash('red',.8); sfx('hurt'); rumble(1,.5,220); hurtFx = 1; aberr = .012;
  emit(new THREE.Vector3(hero.pos.x,1.1,hero.pos.z), new THREE.Color(2.2,.4,.6), 18, 5, .5);
  kick('spine',[-9,(Math.random()-.5)*6,0]); kick('head',[-12,0,(Math.random()-.5)*8]); kick('chest',[-6,0,0]);
  if (hero.hp <= 0){ hero.state='dead'; hero.t=0; hero.deadT=0; }
  else { hero.state='hurt'; hero.t=0; hero.combo=0; }
  return true;
}
function nearestEnemy(maxD){
  let best=null, bd=maxD;
  for (const e of enemies){ if (e.state==='spawn') continue; const d = Math.hypot(e.g.position.x-hero.pos.x, e.g.position.z-hero.pos.z); if (d<bd){bd=d;best=e;} }
  return best;
}
function startAttack(n){
  hero.state='attack'; hero.t=0; hero.combo=n; hero.hitDone=false; hero.queued=false;
  hero.lunge = n===3 ? 7 : 4.5;
  const t = (lockTarget && lockTarget.state!=='spawn') ? lockTarget : nearestEnemy(6.5);
  if (t){
    hero.facing = Math.atan2(t.g.position.x-hero.pos.x, t.g.position.z-hero.pos.z);
    const d = Math.hypot(t.g.position.x-hero.pos.x, t.g.position.z-hero.pos.z);
    if (t===lockTarget && d > 2.8 && d < 10){ // dash in to the locked target
      hero.lunge = Math.min(24, (d-2.0)/.12);
      emit(new THREE.Vector3(hero.pos.x,.4,hero.pos.z), new THREE.Color(.6,1.6,2.4), 18, 3, .4, .5, .4, 1);
    }
  }
  sfx('slash');
}
function startDodge(move, mag){
  hero.state='dodge'; hero.t=0; hero.perfectGiven=false; hero.combo=0;
  if (mag > .2) hero.dodgeDir.copy(move); else hero.dodgeDir.set(-Math.sin(hero.facing),0,-Math.cos(hero.facing));
  hero.facing = Math.atan2(hero.dodgeDir.x, hero.dodgeDir.z) + (mag>.2?0:Math.PI);
  sfx('dodge'); emit(new THREE.Vector3(hero.pos.x,.2,hero.pos.z), new THREE.Color(.6,1.4,2), 14, 3, .4, .5, .4, 2);
}
function startSpecial(){
  hero.state='special'; hero.t=0; hero.hitDone=false; hero.atb=0; hero.vel.set(0,9,0); hero.onGround=false;
  banner('ルミナス・ブレイク','LIMIT ARTS','special'); sfx('special'); flash('white',.35); slowMo = .25;
}
function doHit(){
  const n = hero.combo, range = n===3 ? 3.1 : 2.7;
  const dmg = [0,13,15,27][n];
  const fwd = new THREE.Vector3(Math.sin(hero.facing),0,Math.cos(hero.facing));
  if (n===3) spawnSlash(n);
  let any = false;
  for (const e of [...enemies]){
    if (e.state==='spawn') continue;
    const d = new THREE.Vector3().subVectors(e.g.position, hero.pos); d.y=0; const l = d.length();
    if (l < range + e.radius && (l < .8 || d.normalize().dot(fwd) > -.1)){
      any = true; damageEnemy(e, Math.round(dmg*(.9+Math.random()*.2)), d.lengthSq()>0?d:fwd, n===3?9:5);
      hero.atb = Math.min(100, hero.atb + 6);
    }
  }
  if (any){ kick('rightUpperArm',[0,n===2?3:-3,0]); kick('chest',[2,0,0]);
    hitStop = n===3 ? .1 : .06; shake = Math.max(shake, n===3?.3:.15); sfx('hit'); rumble(n===3?.8:.4, .5, n===3?150:80); }
}
function doSpecialHit(){
  spawnShock(hero.pos, new THREE.Color(2.2,1.6,.6), 8);
  emit(new THREE.Vector3(hero.pos.x,.5,hero.pos.z), new THREE.Color(2.2,1.7,.7), 160, 14, 1.1, 3, 1, 5);
  emit(new THREE.Vector3(hero.pos.x,.5,hero.pos.z), new THREE.Color(.7,1.8,2.6), 90, 10, 1.0, 6, 1, 3);
  sfx('boom'); flash('white',.7); shake = .7; hitStop = .14; rumble(1,1,450); aberr = .02;
  for (const e of [...enemies]){
    if (e.state==='spawn') continue;
    const d = new THREE.Vector3().subVectors(e.g.position, hero.pos); d.y=0;
    if (d.length() < 7.5 + e.radius) damageEnemy(e, 60 + wave*4, d.length()>0?d.normalize():new THREE.Vector3(0,0,1), 14);
  }
  for (const s of shots){ s.life = 0; }
}
function updateHero(dt, inp, now){
  const h = hero;
  const f = new THREE.Vector3(-Math.sin(camYaw),0,-Math.cos(camYaw)), r = new THREE.Vector3(Math.cos(camYaw),0,-Math.sin(camYaw));
  const move = f.multiplyScalar(-inp.my).add(r.multiplyScalar(inp.mx));
  const mag = Math.min(1, move.length()); if (mag > .01) move.normalize();
  h.invuln = Math.max(0, h.invuln - dt);
  const fwd = new THREE.Vector3(Math.sin(h.facing),0,Math.cos(h.facing));

  if (h.state==='free'){
    const sp = (isStrolling() ? 2.6 : 6.8)*mag;   // ストーリーの歩くパートでは走らず、ゆっくり歩く
    h.vel.x = THREE.MathUtils.damp(h.vel.x, move.x*sp, 14, dt);
    h.vel.z = THREE.MathUtils.damp(h.vel.z, move.z*sp, 14, dt);
    if (mag > .1) h.facing = lerpAngle(h.facing, Math.atan2(move.x, move.z), Math.min(1, dt*14));
    else if (lockTarget) h.facing = lerpAngle(h.facing, Math.atan2(lockTarget.g.position.x-h.pos.x, lockTarget.g.position.z-h.pos.z), Math.min(1, dt*8));
    if (inp.jump && h.onGround){ h.vel.y = 8.8; h.onGround = false; sfx('jump'); }
    if (inp.attack) startAttack(1);
    else if (inp.dodge) startDodge(move, mag);
    else if (inp.special && h.atb >= 100) startSpecial();
    else if (inp.special){ const p=h.pos.clone(); p.y+=2.1; popText(p,'ゲージ不足','just'); }
  } else if (h.state==='attack'){
    h.t += dt; const dur = h.combo===3 ? .56 : .38;
    const lunge = h.t < .12 ? h.lunge : 0;
    h.vel.x = fwd.x*lunge; h.vel.z = fwd.z*lunge;
    if (!h.hitDone && h.t >= dur*.32){ h.hitDone = true; doHit(); }
    if (inp.attack && h.t > dur*.2) h.queued = true;
    if (inp.dodge && h.t > dur*.3) startDodge(move, mag);
    else if (inp.special && h.atb >= 100) startSpecial();
    else if (h.t >= dur){
      if (h.queued && h.combo < 3) startAttack(h.combo+1);
      else { h.state='free'; h.combo=0; }
    }
  } else if (h.state==='dodge'){
    h.t += dt; const D = .4, k = h.t/D;
    const sp = 15*(1-k)+2;
    h.vel.x = h.dodgeDir.x*sp; h.vel.z = h.dodgeDir.z*sp;
    if (Math.random()<.5) emit(new THREE.Vector3(h.pos.x,.9,h.pos.z), new THREE.Color(.5,1.3,2), 2, 1, .35, 0, .5, 0);
    if (h.t >= D){ h.state='free'; }
  } else if (h.state==='special'){
    h.t += dt; h.vel.x = h.vel.z = 0;
    if (!h.hitDone && ((h.t >= .55 && h.onGround) || h.t >= .8)){ h.hitDone = true; h.pos.y = 0; h.vel.y = 0; h.onGround = true; doSpecialHit(); }
    if (!h.hitDone && h.t > .3) h.vel.y = Math.min(h.vel.y, -18);
    if (Math.random()<.8) emit(H.tip.getWorldPosition(new THREE.Vector3()), new THREE.Color(2,1.6,.6), 3, 2, .4, 0, .2, 0);
    if (h.hitDone && h.t >= 1.0){ h.state='free'; }
  } else if (h.state==='hurt'){
    h.t += dt; h.vel.x = THREE.MathUtils.damp(h.vel.x,0,8,dt); h.vel.z = THREE.MathUtils.damp(h.vel.z,0,8,dt);
    if (h.t >= .35) h.state='free';
  } else if (h.state==='dead'){
    h.deadT += dt; h.vel.x = THREE.MathUtils.damp(h.vel.x,0,6,dt); h.vel.z = THREE.MathUtils.damp(h.vel.z,0,6,dt);
    if (h.deadT > 1.6 && !overShown) showOver();
  }
  // physics
  h.vel.y -= 24*dt;
  h.pos.addScaledVector(h.vel, dt);
  if (h.pos.y <= 0){ if (!h.onGround && h.vel.y < -6) emit(new THREE.Vector3(h.pos.x,.1,h.pos.z), new THREE.Color(.6,1,1.6), 10, 3, .4, .5, .4, 2);
    h.pos.y = 0; h.vel.y = 0; h.onGround = true; }
  const rr = Math.hypot(h.pos.x, h.pos.z); if (rr > ARENA){ h.pos.x *= ARENA/rr; h.pos.z *= ARENA/rr; }
  for (const e of enemies){ // push out of enemies
    const d = new THREE.Vector3().subVectors(h.pos, e.g.position); d.y=0; const l = d.length(), m = e.radius + .4;
    if (l < m && l > .001 && h.state!=='dodge') h.pos.addScaledVector(d, (m-l)/l);
  }
  H.root.rotation.y = h.facing;
  animateHero(dt, now);
}
const bladeDir = new THREE.Vector3(0,.2,1), _bd = new THREE.Vector3();
const heroFace = {expr:null, talk:0};
function animateNPC(dt, now){
  if (!NPC.vrm) return;
  const sg = NPC.sign, br = Math.sin(now*1.6)*.03;
  const P = { spine:[.02+br,0,0], chest:[br,0,0], head:[0,Math.sin(now*.5)*.1,Math.sin(now*.7)*.04],
    leftUpperArm:[.15,0,-1.25], leftLowerArm:[0,-.35,0], rightUpperArm:[.15,0,1.25], rightLowerArm:[0,.35,0],
    leftUpperLeg:[0,0,.03], rightUpperLeg:[0,0,-.03] };
  if (NPC.talk > 0){ P.rightUpperArm = [-.35,0,1.0]; P.rightLowerArm = [0,1.3,0]; }
  for (const n of BONES){ const b = NPC.bones[n]; if (!b) continue; const v = P[n] || Z3;
    _e3.set(v[0]*sg,v[1],v[2]*sg); _q3.setFromEuler(_e3); b.quaternion.slerp(_q3, Math.min(1, dt*6)); }
  NPC.look.position.set(hero.pos.x, 1.45, hero.pos.z);
  const tf = Math.atan2(hero.pos.x-NPC.root.position.x, hero.pos.z-NPC.root.position.z);
  NPC.root.rotation.y = lerpAngle(NPC.root.rotation.y, tf, Math.min(1, dt*2));
  const em = NPC.vrm.expressionManager;
  if (em){
    NPC.blinkT -= dt; const bl = NPC.blinkT < .12 ? 1 : 0; if (NPC.blinkT < 0) NPC.blinkT = 2.5 + Math.random()*3;
    em.setValue('blink', bl);
    for (const x of ['happy','sad','surprised','angry','relaxed']) em.setValue(x, NPC.expr===x ? .85 : 0);
    em.setValue('aa', NPC.talk > 0 ? Math.abs(Math.sin(now*17))*.6 : 0);
  }
  NPC.vrm.update(dt);
}
const _e3 = new THREE.Euler(), _q3 = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _dz = new THREE.Vector3(0,0,1);
let blinkT = 2, blinkV = 0;
/* ---------- motion: spring-driven joints + keyframed attacks ---------- */
const FREQ = {hips:4.5, spine:4.5, chest:5, upperChest:5, neck:4, head:3.5, leftShoulder:6, rightShoulder:6, leftUpperArm:5.5, rightUpperArm:7.5,
  leftLowerArm:6.5, rightLowerArm:8.5, leftHand:6, leftUpperLeg:10, rightUpperLeg:10, leftLowerLeg:11, rightLowerLeg:11, leftFoot:10, rightFoot:10};
const SPR = {};
function spring(n, tgt, dt, f, z){
  let s = SPR[n]; if (!s){ s = SPR[n] = {x:tgt.slice(), v:[0,0,0]}; return s.x; }
  const w = 2*Math.PI*f, steps = Math.max(1, Math.ceil(dt*w/.3)), hh = dt/steps;
  for (let k=0;k<steps;k++) for (let i=0;i<3;i++){ const a = w*w*(tgt[i]-s.x[i]) - 2*z*w*s.v[i]; s.v[i] += a*hh; s.x[i] += s.v[i]*hh; }
  return s.x;
}
function kick(n, dv){ const s = SPR[n]; if (s){ s.v[0]+=dv[0]; s.v[1]+=dv[1]; s.v[2]+=dv[2]; } }
const mot = {prevGround:true, landT:0, prevFacing:0, prevSp:0, lean:0, bank:0};
function animateHero(dt, now){
  const h = hero, sp = Math.hypot(h.vel.x, h.vel.z);
  if (!H.vrm) return;
  const run = Math.min(1, sp/6.8) * (h.state==='free' ? 1 : 0);
  h.runPhase += dt*sp*1.9;
  // derived motion signals
  if (!mot.prevGround && h.onGround && h.state!=='dead'){ mot.landT = .32; kick('spine',[4,0,0]); kick('leftLowerLeg',[8,0,0]); kick('rightLowerLeg',[8,0,0]); }
  mot.prevGround = h.onGround; mot.landT = Math.max(0, mot.landT - dt);
  const dF = ((h.facing - mot.prevFacing + Math.PI*3) % (Math.PI*2)) - Math.PI; mot.prevFacing = h.facing;
  mot.bank = THREE.MathUtils.damp(mot.bank, THREE.MathUtils.clamp(-dF/Math.max(dt,1e-3)*.05, -.3, .3)*run, 8, dt);
  const acc = (sp - mot.prevSp)/Math.max(dt,1e-3); mot.prevSp = sp;
  mot.lean = THREE.MathUtils.damp(mot.lean, THREE.MathUtils.clamp(acc*.02, -.3, .25), 6, dt);
  // base: idle with weight shift + breathing, blended into the run cycle
  const IDLE = {...POSE.idle,
    hips:[0,0,.035*Math.sin(now*.6)], spine:[.05+.02*Math.sin(now*2.1),-.25,-.03*Math.sin(now*.6)], chest:[.03*Math.sin(now*2.1+.6),-.1,0],
    head:[.02*Math.sin(now*1.3),.2+.05*Math.sin(now*.4),0]};
  let P = mixPose(IDLE, runPose2(h.runPhase, mot.lean), h.onGround ? run : 0);
  if (sp > .5 && run < .2 && h.state==='free') P.spine = lerpA(P.spine, [mot.lean,0,0], .6);
  let hipY = (h.onGround ? -.07*(1-Math.abs(Math.sin(h.runPhase)))*run : 0) - .03;
  _bd.set(.15,.2,1).lerp(new THREE.Vector3(-.35,-.35,-1), run);
  let snap = false;
  if (cine){ P = {rightUpperArm:[0,.1,1.25], rightLowerArm:[0,.25,0], leftUpperArm:[.1,0,-1.25], leftLowerArm:[0,-.3,0], spine:[.02+.02*Math.sin(now*2),0,0],
    head:[0,0,0], leftUpperLeg:[0,0,.04], rightUpperLeg:[0,0,-.04], hips:[0,0,.025*Math.sin(now*.6)]}; hipY = 0; _bd.set(.15,-.95,.2); }
  if (!h.onGround && h.state==='free'){
    const rise = THREE.MathUtils.clamp(h.vel.y/8, -1, 1);
    const AIR = {spine:[.15,0,0], rightUpperArm:[0,.2,.6], rightLowerArm:[0,.7,0], leftUpperArm:[0,-.2,-.6+.3*rise], leftLowerArm:[0,-.7,0],
      leftUpperLeg:[-1.1*Math.max(.3,rise),0,.1], leftLowerLeg:[1.5*Math.max(.3,rise)+.2,0,0], rightUpperLeg:[-.3+.2*(1-rise),0,-.1], rightLowerLeg:[.9,0,0],
      leftFoot:[.3,0,0], rightFoot:[.3,0,0]};
    P = mixPose(P, AIR, .9); _bd.set(.2,.4,1);
  }
  if (mot.landT > 0 && h.state==='free'){
    const k = mot.landT/.32;
    P.leftUpperLeg = lerpA(P.leftUpperLeg||Z3, [-.7,0,.1], k); P.leftLowerLeg = lerpA(P.leftLowerLeg||Z3, [1.3,0,0], k);
    P.rightUpperLeg = lerpA(P.rightUpperLeg||Z3, [-.5,0,-.1], k); P.rightLowerLeg = lerpA(P.rightLowerLeg||Z3, [1.1,0,0], k);
    P.spine = lerpA(P.spine||Z3, [.35,0,0], k); hipY -= .22*k;
  }
  if (h.state==='attack'){
    const S = sampleAtk(ATK[h.combo], Math.min(1, h.t/atkDur()));
    P = S.pose; hipY = S.hy;
    _bd.set(Math.sin(S.yaw)*Math.cos(S.pitch), Math.sin(S.pitch), Math.cos(S.yaw)*Math.cos(S.pitch));
    snap = true;
  } else if (h.state==='dodge'){
    P = {...POSE.dodge, leftFoot:[.6,0,0], rightFoot:[.6,0,0]}; _bd.set(-.2,-.5,-1); hipY = 0;
  } else if (h.state==='special'){
    if (h.hitDone){ const S = sampleAtk(ATK[3], .5); P = S.pose; hipY = S.hy; _bd.set(.05,-.75,.65); }
    else { P = POSE.spin; _bd.set(-1,.05,.3); }
    snap = !h.hitDone;
  } else if (h.state==='hurt' || h.state==='dead'){
    P = {...POSE.hurt, hips:[0,0,0]}; _bd.set(.2,-.5,.8); hipY = -.06;
  }
  // apply pose through per-joint springs (overshoot + follow-through)
  const mul = snap ? 2.3 : 1, zeta = snap ? .82 : .68, sg = H.sign;
  for (const n of BONES){
    if (n==='rightHand') continue; const b = H.bones[n]; if (!b) continue;
    const x = spring(n, P[n] || Z3, dt, (FREQ[n] || 6)*mul, zeta);
    _e3.set(x[0]*sg, x[1], x[2]*sg); b.quaternion.setFromEuler(_e3);
  }
  H.bones.hips.position.y = H.hipsY + spring('hipY', [hipY,0,0], dt, snap ? 9 : 6, .7)[0];
  // aim the sword: rotate the wrist so the blade points along bladeDir (character space)
  bladeDir.lerp(_bd.normalize(), snap ? 1 : Math.min(1, dt*12)).normalize();
  const la = H.bones.rightLowerArm; la.updateWorldMatrix(true, false); la.getWorldQuaternion(_qp);
  H.inner.getWorldQuaternion(_qr);
  const dW = bladeDir.clone().applyQuaternion(_qr).applyQuaternion(_qp.invert());
  H.bones.rightHand.quaternion.setFromUnitVectors(_dz, dW.normalize());
  // whole-body: roll, bank into turns, spin, fall
  if (h.state==='dodge'){ const k = Math.min(1, h.t/.4); H.inner.rotation.x = (k<.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2)*Math.PI*2; }
  else if (h.state==='dead'){ H.inner.rotation.x = THREE.MathUtils.damp(H.inner.rotation.x, -Math.PI/2, 5, dt); }
  else H.inner.rotation.x = 0;
  H.inner.rotation.z = h.state==='free' ? mot.bank : THREE.MathUtils.damp(H.inner.rotation.z, 0, 10, dt);
  H.inner.position.y = THREE.MathUtils.damp(H.inner.position.y, h.state==='dead' ? .18 : h.state==='dodge' ? PIV*.62 : PIV, h.state==='dodge' ? 18 : 6, dt);
  H.inner.rotation.y = h.state==='special' && !h.hitDone ? h.t*26 : THREE.MathUtils.damp(H.inner.rotation.y % (Math.PI*2), 0, 12, dt);
  // cape cloth
  if (H.cape){
    const spf = Math.min(1, sp/8), pa = H.cape.geo.attributes.position, b = H.cape.base;
    H.cape.g.rotation.x = .1 + spf*.9 + (h.onGround ? 0 : .5);
    for (let i=0;i<pa.count;i++){ const x=b[i*3], y=b[i*3+1], kk=-y/.78;
      pa.array[i*3+2] = b[i*3+2] - kk*kk*.12 + Math.sin(now*(6+spf*6) + y*6 + x*5)*.05*kk*(.4+spf); }
    pa.needsUpdate = true; H.cape.geo.computeVertexNormals();
  }
  // face
  const em = H.vrm.expressionManager;
  if (em){
    blinkT -= dt; if (blinkT < 0){ blinkV = 1; blinkT = 2 + Math.random()*3; }
    blinkV = Math.max(0, blinkV - dt*8);
    em.setValue('blink', h.state==='dead' ? 1 : Math.sin(Math.min(1,blinkV)*Math.PI));
    const fx = heroFace.expr;
    for (const x of ['happy','surprised','relaxed']) em.setValue(x, fx===x ? .8 : 0);
    em.setValue('angry', fx==='angry' ? .7 : (h.state==='attack' || h.state==='special') && !fx ? .55 : 0);
    em.setValue('sad', fx==='sad' ? .7 : h.state==='hurt' ? .8 : 0);
    em.setValue('aa', heroFace.talk);
  }
  // look target
  if (lockTarget) H.lookObj.position.copy(ecenter(lockTarget));
  else H.lookObj.position.set(h.pos.x + Math.sin(h.facing)*4, 1.4, h.pos.z + Math.cos(h.facing)*4);
  H.vrm.update(dt);
  if (h.state==='free' && run > .6 && h.onGround && Math.random() < dt*9) emit(new THREE.Vector3(h.pos.x,.08,h.pos.z), new THREE.Color(.35,.45,.7), 2, 1.2, .5, .6, .3, 1);
  // invuln blink
  H.inner.visible = !(h.invuln > 0 && !cine && h.state!=='dodge' && Math.floor(now*20)%2===0);
  H.tip.getWorldPosition(H.light.position);
  H.bladeMat.emissiveIntensity = h.state==='special' ? 2.5 : h.state==='attack' ? 1.6 : .5;
  H.fuller.material.color.setRGB(...(h.state==='special' ? [3,2.2,.9] : [1.2,2.6,3.2]));
  H.light.intensity = h.state==='attack' || h.state==='special' ? .8 : .35;
}

/* ================= lock-on ================= */
let lockTarget = null, lockAnim = 0, prevRx = 0, lockSwipe = 0, lockBlend = 0;
const ecenter = e => new THREE.Vector3(e.g.position.x, e.g.position.y + e.body.position.y*e.g.scale.y, e.g.position.z);
const reticle = new THREE.Group(), retSpin = new THREE.Group(); reticle.add(retSpin); reticle.visible = false; scene.add(reticle);
{
  const rm = new THREE.MeshBasicMaterial({color:new THREE.Color(2.6,2.0,.9), transparent:true, opacity:.95, depthTest:false, depthWrite:false,
    blending:THREE.AdditiveBlending, side:THREE.DoubleSide});
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0,1.07,56,1,0,Math.PI*.42), rm);
  for (let i=0;i<4;i++){
    const r = ring.clone(); r.rotation.z = i*Math.PI/2 + .2; r.renderOrder = 999; retSpin.add(r);
    const a = i*Math.PI/2, tri = new THREE.Mesh(new THREE.CircleGeometry(.17,3), rm);
    tri.position.set(Math.cos(a)*1.38, Math.sin(a)*1.38, 0); tri.rotation.z = a + Math.PI; tri.renderOrder = 999; reticle.add(tri);
  }
  const dot = new THREE.Mesh(new THREE.CircleGeometry(.07,12), rm); dot.renderOrder = 999; reticle.add(dot);
}
function acquireLock(){
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  let best = null, bs = Infinity;
  for (const e of enemies){
    if (e.state==='spawn') continue;
    const d = new THREE.Vector3(e.g.position.x-hero.pos.x, 0, e.g.position.z-hero.pos.z), dist = d.length();
    if (dist > 24) continue;
    const ang = Math.acos(THREE.MathUtils.clamp(d.divideScalar(dist||1).dot(fwd), -1, 1));
    const sc = dist + ang*5; if (sc < bs){ bs = sc; best = e; }
  }
  return best;
}
function setLock(e, quiet=false){ lockTarget = e; if (e){ lockAnim = .25; if (!quiet) sfx('lock'); else sfx('lock2'); } }
function switchTarget(dir){
  if (!lockTarget) return;
  const cs = toScreen(ecenter(lockTarget)).x; let best = null, bd = Infinity;
  for (const e of enemies){
    if (e===lockTarget || e.state==='spawn') continue;
    const dx = (toScreen(ecenter(e)).x - cs)*dir; if (dx > 0 && dx < bd){ bd = dx; best = e; }
  }
  if (best) setLock(best);
}
const tEl = $('target'), tName = $('tName'), tFill = $('tFill'), lockBtn = $('lockBtn');
function updateLock(dt, now, inp){
  if (lockTarget && (!enemies.includes(lockTarget) || hero.state==='dead')) lockTarget = null;
  if (inp.lock){ if (lockTarget) { lockTarget = null; sfx('lock2'); } else { const t = acquireLock(); if (t) setLock(t); } }
  if (lockTarget){
    // right-stick flick / keys / swipe to change target
    if (Math.abs(inp.rx) > .7 && Math.abs(prevRx) < .5) switchTarget(Math.sign(inp.rx));
    if (inp.switchL) switchTarget(-1); if (inp.switchR) switchTarget(1);
    if (ts.camId !== null){ lockSwipe += ts.dx; if (Math.abs(lockSwipe) > 55){ switchTarget(Math.sign(lockSwipe)); lockSwipe = 0; } } else lockSwipe = 0;
  }
  prevRx = inp.rx;
  lockBlend = THREE.MathUtils.damp(lockBlend, lockTarget ? 1 : 0, 6, dt);
  tEl.classList.toggle('on', !!lockTarget); lockBtn.classList.toggle('on', !!lockTarget);
  if (lockTarget){
    reticle.visible = true; lockAnim = Math.max(0, lockAnim - dt);
    reticle.position.copy(ecenter(lockTarget)); reticle.quaternion.copy(camera.quaternion);
    reticle.scale.setScalar(lockTarget.sc*(.95 + Math.sin(now*6)*.05 + lockAnim*3));
    retSpin.rotation.z -= dt*1.6;
    tName.textContent = lockTarget.name; tFill.style.width = Math.max(0, lockTarget.hp/lockTarget.maxHp*100)+'%';
  } else reticle.visible = false;
}

/* ================= cutscenes ================= */
let cine = null; const camPos2 = new THREE.Vector3(), camLook2 = new THREE.Vector3(), camLookCur = new THREE.Vector3();
const dlg = $('dlg'), dName = $('dName'), dText = $('dText');
function startScene(key, onEnd, setup){
  if (setup) setup();
  // setup でエルフィナを移動させた直後は、頭の位置（ボーンのワールド座標）がまだ前の場所のまま。
  // そのままだと最初のカメラが古い位置を基準に置かれて後ろ姿になるので、ここで更新しておく。
  H.root.rotation.y = hero.facing; H.root.updateMatrixWorld(true);
  cine = {lines:SCENES[key], i:-1, typed:0, onEnd, t:0};
  document.body.classList.add('cine'); lockTarget = null;
  hero.state = 'free'; hero.vel.set(0,0,0); hero.combo = 0;
  nextLine(true);
}
function nextLine(first){
  cine.i++;
  if (cine.i >= cine.lines.length){ endScene(); return; }
  const L = cine.lines[cine.i]; cine.typed = 0; cine.t = 0;
  dName.textContent = NAMES[L.who]; dName.className = L.who; dlg.className = 'on' + (L.who==='narr' ? ' narr' : '');
  dText.textContent = '';
  heroFace.expr = L.who==='lumina' ? (L.expr||null) : heroFace.expr;
  if (L.who==='ciel') NPC.expr = L.expr || null;
  if (L.wind) setWindMode(L.wind);       // 台本の行ごとの風の演出（on / off / stutter / weak）
  if (L.fx==='fanStop') fanStopMain();   // アースファンの羽根車をひとつ止める
  if (first) shotTo(L.shot, true);
  else shotTo(L.shot, false);
  sfx('lock2');
}
function endScene(){
  dlg.className = ''; document.body.classList.remove('cine');
  heroFace.expr = null; heroFace.talk = 0; NPC.expr = null; NPC.talk = 0;
  const cb = cine.onEnd; cine = null; camYaw = Math.atan2(-Math.sin(hero.facing), -Math.cos(hero.facing)); camPitch = .24;
  camTarget.set(hero.pos.x, 1.2, hero.pos.z);
  if (cb) cb();
}
function headPos(bones, fallback){ return bones.head ? bones.head.getWorldPosition(new THREE.Vector3()) : fallback.clone().setY(1.5); }
function shotTo(shot, snap){
  const hp = headPos(H.bones, hero.pos), np = headPos(NPC.bones, NPC.root.position);
  const face = (head, yaw, side) => { const f = new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)), r = new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    camPos2.copy(head).addScaledVector(f, 1.15).addScaledVector(r, side).add(new THREE.Vector3(0,.04,0)); camLook2.copy(head).addScaledVector(r, -side*.25).add(new THREE.Vector3(0,-.06,0)); };
  if (shot==='lumina') face(hp, hero.facing, -.42);
  else if (shot==='ciel') face(np, NPC.root.rotation.y, .42);
  else if (shot==='two'){ const m = hp.clone().add(np).multiplyScalar(.5), d = np.clone().sub(hp); d.y = 0; d.normalize();
    camPos2.copy(m).add(new THREE.Vector3(d.z,0,-d.x).multiplyScalar(3.4)).add(new THREE.Vector3(0,.25,0)); camLook2.copy(m).add(new THREE.Vector3(0,-.15,0)); }
  else if (shot==='boss' && boss){ const bp = boss.g.position.clone(), d = hero.pos.clone().sub(bp).setY(0).normalize();
    camPos2.copy(bp).addScaledVector(d, 6.5).add(new THREE.Vector3(1.5,1.2,0)); camLook2.copy(bp).add(new THREE.Vector3(0,2.6,0)); }
  else if (shot==='wide2'){ camPos2.set(-3.5,1.4,-9.5); camLook2.set(0,1.6,-14.5); }
  else if (shot==='fan'){ camPos2.set(-6,1.0,6); camLook2.set(0,15,-78); }   // アースファンを見上げる
  else { camPos2.set(4.5,2.6,-6.5); camLook2.set(0,1.3,-13.2); }
  if (snap){ camera.position.copy(camPos2); camLookCur.copy(camLook2); }
}
function updateCine(dt, inp, now){
  const L = cine.lines[cine.i]; cine.t += dt;
  const len = [...L.text].length;
  if (cine.typed < len){ cine.typed = Math.min(len, cine.typed + dt*32); dText.textContent = [...L.text].slice(0, Math.floor(cine.typed)).join(''); }
  const talking = cine.typed < len;
  heroFace.talk = L.who==='lumina' && talking ? Math.abs(Math.sin(now*17))*.6 : 0;
  NPC.talk = L.who==='ciel' && talking ? 1 : 0;
  if ((inp.jump || inp.attack || inp.dodge || cine.tap) && cine.t > .15){
    cine.tap = false;
    if (talking){ cine.typed = len; dText.textContent = L.text; }
    else nextLine(false);
  }
  cine && (cine.tap = false);
  if (!cine) return;
  if (L.shot==='wide' || L.shot==='wide2') { camPos2.x += Math.sin(now*.2)*dt*.3; }
  camera.position.lerp(camPos2, 1 - Math.pow(.02, dt)); camLookCur.lerp(camLook2, 1 - Math.pow(.02, dt));
  camera.lookAt(camLookCur);
  camera.fov = THREE.MathUtils.damp(camera.fov, L.shot==='lumina'||L.shot==='ciel' ? 38 : 50, 4, dt); camera.updateProjectionMatrix();
}
addEventListener('pointerdown', () => { if (cine) cine.tap = true; });

/* ================= barks ================= */
const barkEl = $('bark'); let barkT = 0; const barkSaid = new Set();
function bark(text, who=NAMES.ciel, once=null){
  if (once){ if (barkSaid.has(once)) return; barkSaid.add(once); }
  barkEl.innerHTML = `<b>${who}</b>${text}`; barkEl.classList.add('on'); barkT = 3.2;
}

/* ================= boss ================= */
let boss = null;
const teleMat = new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,.25,.4), transparent:true, opacity:.5, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
const teles = [];
function telegraph(pos, r, time, onHit){
  const ring = new THREE.Mesh(new THREE.RingGeometry(r-.12, r, 64), teleMat.clone()); ring.rotation.x = -Math.PI/2; ring.position.set(pos.x,.06,pos.z);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 64), teleMat.clone()); fill.rotation.x = -Math.PI/2; fill.position.set(pos.x,.05,pos.z); fill.scale.setScalar(.01);
  fill.material.opacity = .25; scene.add(ring, fill);
  teles.push({ring, fill, t:0, time, pos:pos.clone(), r, onHit});
}
function updateTeles(dt){
  for (let i=teles.length-1;i>=0;i--){
    const T = teles[i]; T.t += dt; const k = Math.min(1, T.t/T.time);
    T.fill.scale.setScalar(Math.max(.01,k)); T.ring.material.opacity = .4 + Math.sin(T.t*20)*.2;
    if (k >= 1){
      T.onHit(T);
      scene.remove(T.ring, T.fill); T.ring.geometry.dispose(); T.fill.geometry.dispose(); T.ring.material.dispose(); T.fill.material.dispose();
      teles.splice(i,1);
    }
  }
}
function clearTeles(){ for (const T of teles){ scene.remove(T.ring, T.fill); } teles.length = 0; }
function spawnBoss(){
  spawnEnemy('golem', new THREE.Vector3(0,0,7), true);
  boss = enemies[enemies.length-1];
  boss.boss = true; boss.name = '穢れし守護者 ゴーレム・ロード'; boss.sc = 2.3; boss.radius = .9*2.3;
  boss.hp = boss.maxHp = 1000; boss.phase = 1; boss.cd = 2; boss.bar.style.display = 'none'; boss.bar.remove();
  boss.state = 'chase'; boss.g.scale.setScalar(2.3); boss.g.rotation.y = Math.PI;
  $('bossName').textContent = boss.name; $('bossbar').classList.add('on'); $('hud').classList.add('boss');
}
function bossAI(e, dt, dist, dir, now){
  const g = e.g;
  if (e.phase===1 && e.hp < e.maxHp*.5){
    e.phase = 2; e.state = 'roar'; e.t = 0; clearTeles();
    banner('守護者が激昂した','PHASE 2'); shake = .6; sfx('boom'); rumble(1,.8,500);
    bark('攻撃が激しくなってる！ 気をつけて！');
    for (let i=0;i<2;i++){ const a = Math.random()*6.28; spawnEnemy('caster', new THREE.Vector3(Math.sin(a)*12,0,Math.cos(a)*12)); }
  }
  const fast = e.phase===2 ? 1.35 : 1;
  if (e.state==='roar'){ e.mat.emissiveIntensity = 2.5; if (e.t > 1.4){ e.state='chase'; e.cd = .8; } return; }
  if (e.state==='chase'){
    e.cd -= dt*fast;
    if (dist > 3.2) g.position.addScaledVector(dir, 2.0*fast*dt);
    if (e.cd <= 0){
      const r = Math.random();
      if (e.phase===2 && r < .3){ // crystal rain
        e.state='cast'; e.t=0;
        for (let i=0;i<6;i++){ const p = hero.pos.clone().add(new THREE.Vector3((Math.random()-.5)*8,0,(Math.random()-.5)*8)); if (i===0) p.copy(hero.pos);
          telegraph(p, 1.6, 1.3, T => { emit(new THREE.Vector3(T.pos.x,.4,T.pos.z), new THREE.Color(1.6,.4,1.4), 30, 7, .6, 4, .5, 6); spawnShockLite(T.pos);
            if (Math.hypot(hero.pos.x-T.pos.x, hero.pos.z-T.pos.z) < 1.7) hurtHero(13, T.pos); }); }
        sfx('special');
      } else if (dist < 6.5){ // slam
        e.state='slam'; e.t=0;
        telegraph(g.position, 4.6, 1.1/fast, T => { spawnShock(T.pos, new THREE.Color(2.2,.4,.6), 5.5); shake = .5; sfx('boom'); rumble(.9,.6,300);
          if (Math.hypot(hero.pos.x-T.pos.x, hero.pos.z-T.pos.z) < 4.8) hurtHero(20, T.pos); });
      } else { e.state='windup'; e.t=0; }
      e.cd = (e.phase===2 ? 2.0 : 2.8) + Math.random();
    }
  } else if (e.state==='slam'){ e.body.position.y += Math.min(1, e.t/(1.1/fast))*1.2; if (e.t > 1.1/fast + .3) e.state='chase'; }
  else if (e.state==='cast'){ if (e.t > 1.0) e.state='chase'; }
  else if (e.state==='windup'){ g.position.addScaledVector(dir, -.8*dt); if (e.t >= .85/fast){ e.state='strike'; e.t=0; e.strikeDir.copy(dir); e.struck=false; } }
  else if (e.state==='strike'){
    g.position.addScaledVector(e.strikeDir, 15*dt*(1-e.t/.55));
    if (Math.random()<.5) emit(new THREE.Vector3(g.position.x,.3,g.position.z), e.color, 3, 2, .5, 1, 1, 2);
    if (!e.struck && dist < e.radius + .6){ e.struck = true; hurtHero(18, g.position); }
    if (e.t >= .55) e.state='chase';
  }
}
function spawnShockLite(pos){
  const ring = new THREE.Mesh(new THREE.RingGeometry(.85,1,48), new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,.5,1.6), transparent:true, opacity:1,
    blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false}));
  ring.rotation.x = -Math.PI/2; ring.position.set(pos.x,.1,pos.z); scene.add(ring);
  fx.push({obj:ring, mats:[ring.material], base:[1], t:0, life:.4, scaleTo:2.2});
}

/* ================= story flow ================= */
let mode = 'story', storyStep = 0, storyWave = 0, storyWaveT = 0, stepT = 0, playTime = 0;
// WindShield 第1話「風の沈黙」。会話(scene) → 戦闘(battle) → 会話 … の順に進む。
// ボス戦(boss)の仕組みはコードに残してあるが、第1話では使わない。
const ep1Reset = () => { hero.pos.set(0,0,-11.4); hero.facing = Math.PI; };
const STORY = [
  {scene:'ep1_dawn', setup:ep1Reset, wind:'on'},                 // ① 夜明け
  // ② 祈りの台座へ（操作パート）：広場の反対側から、神官と台座の前まで歩く
  {walk:{x:0, z:-12, r:1.8}, obj:'祈りの台座へ向かう', setup:() => { hero.pos.set(0,0,8); hero.facing = Math.PI; },
    barks:[[1,'巫女さま、今年も麦が実りますように'], [3.6,'風の声を、聞かせてください'], [6.2,'エルフィナさまがいれば安心だ']]},
  {scene:'ep1_hush', setup:ep1Reset},                 // ③ 最初の沈黙
  {scene:'ep1_unrest'},                               // ④ 異変
  {battle:[['golem','golem'], ['golem','golem','caster'], ['golem','caster','caster','golem']], obj:'広場に現れた影を祓え', wind:'stutter'},
  {scene:'ep1_heresy', setup:() => { for (const e of [...enemies]) removeEnemy(e); ep1Reset(); }},  // ⑤ 異端
  {scene:'ep1_farewell'},                             // ⑥ 別れ
  // ⑦ 聖都を去る（操作パート）：台座に背を向け、広場の外れ（門に見立てた場所）まで歩く
  {walk:{x:0, z:16, r:1.8}, obj:'聖都を去る', wind:'off', setup:() => { hero.pos.set(0,0,-8); hero.facing = 0; },  // 神官がカメラを塞がないよう少し前から
    barks:[[4,'……異端だ']]},
  {scene:'ep1_departure'},                            // ⑧ ラスト
  {end:true}
];
const objEl = $('objective');
const isStrolling = () => mode==='story' && running && !!(STORY[storyStep] && STORY[storyStep].walk);
// 歩くパートの目的地を示す、床の光の輪
const walkMarkMat = new THREE.MeshBasicMaterial({color:new THREE.Color(.5,1.4,2.2), transparent:true, opacity:.6,
  blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
const walkMark = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.35, 64), walkMarkMat);
walkMark.rotation.x = -Math.PI/2; walkMark.visible = false; scene.add(walkMark);
function setObjective(t){ if (t){ objEl.innerHTML = `◆ ${t}`; objEl.classList.add('on'); } else objEl.classList.remove('on'); }
function runStep(){
  const S = STORY[storyStep]; stepT = 0;
  if (!S) return;
  if (S.wind) setWindMode(S.wind);   // ステップ単位の風（やり直したときも正しい状態に戻るように）
  if (S.scene){ setObjective(null); startScene(S.scene, () => { storyStep++; runStep(); }, S.setup); }
  else if (S.battle){ storyWave = 0; storyWaveT = 1.2; setObjective(S.obj); bark('なんだ、あれは……！', NAMES.people); }
  else if (S.walk){
    // 歩くパート：目的地に光の輪を出し、カメラをエルフィナの背後に戻す
    if (S.setup) S.setup();
    camYaw = Math.atan2(-Math.sin(hero.facing), -Math.cos(hero.facing)); camPitch = .24; camTarget.set(hero.pos.x, 1.2, hero.pos.z);
    S.barkI = 0; setObjective(S.obj);
    walkMark.position.set(S.walk.x, .04, S.walk.z); walkMark.visible = true;
  }
  else if (S.boss){ S.downT = 0; setObjective(S.obj); banner('BOSS','穢れし守護者 ゴーレム・ロード'); bark('守護者の大技は、足元の赤い円を見て避けて！'); }
  else if (S.end){ showEnd(); }
}
function updateStory(dt){
  const S = STORY[storyStep]; if (!S || cine) return; stepT += dt;
  if (S.walk){
    // 決まった時間に民の声を出し、目的地に着いたら次へ
    const b = S.barks && S.barks[S.barkI];
    if (b && stepT >= b[0]){ bark(b[1], NAMES.people); S.barkI++; }
    walkMark.scale.setScalar(1 + Math.sin(stepT*3)*.08); walkMarkMat.opacity = .55 + Math.sin(stepT*3)*.2;
    if (Math.hypot(hero.pos.x - S.walk.x, hero.pos.z - S.walk.z) < S.walk.r){ walkMark.visible = false; storyStep++; runStep(); }
    return;   // 歩くパートでは戦闘用のヒント（体力・必殺技）は出さない
  }
  if (S.battle){
    if (enemies.length === 0){
      storyWaveT -= dt;
      if (storyWaveT <= 0){
        if (storyWave >= S.battle.length){ storyStep++; runStep(); return; }
        const list = S.battle[storyWave]; storyWave++; wave = storyWave;
        banner(`WAVE ${storyWave} / ${S.battle.length}`);
        list.forEach((t,i) => { let a, x, z; do { a = Math.random()*Math.PI*2; x = Math.sin(a)*12; z = Math.cos(a)*12; } while (z < -8 && Math.abs(x) < 6);
          spawnEnemy(t, new THREE.Vector3(x,0,z)); });
        if (list.includes('caster')) bark('遠くの影は何かを撃ってきます！ ○で避けて！', NAMES.ciel, 'caster');
        storyWaveT = 1.6; hero.hp = Math.min(hero.maxHp, hero.hp + 15);
      }
    }
  } else if (S.boss){
    if (boss && !enemies.includes(boss)){
      if (!S.downT){ S.downT = 2.6; slowMo = 1.2; flash('white',.8); banner('守護者を鎮めた'); for (const e of [...enemies]) damageEnemy(e, 9999, new THREE.Vector3(0,0,1), 0); clearTeles(); }
      S.downT -= dt; if (S.downT <= 0){ S.downT = 0; boss = null; storyStep++; runStep(); }
    }
  }
  if (hero.hp < 40) bark('無理をなさらないで……！', NAMES.ciel, 'lowhp');
  if (hero.atb >= 100) bark('今です！ △を！', NAMES.ciel, 'atb');
}
function showEnd(){
  running = false; overShown = true; overAt = performance.now(); setObjective(null);
  $('endStats').innerHTML = `撃破数 <b>${kills}</b>　／　プレイ時間 <b>${Math.floor(playTime/60)}:${String(Math.floor(playTime%60)).padStart(2,'0')}</b>`;
  $('endOv').classList.remove('hide'); $('hud').classList.remove('on');
}

/* ================= game flow ================= */
let running = false, paused = false, overShown = false, wave = 0, kills = 0, waveT = 0;
function resetGame(){
  resetWind();
  walkMark.visible = false;
  if (cine){ cine = null; dlg.className = ''; document.body.classList.remove('cine'); heroFace.expr = null; heroFace.talk = 0; NPC.expr = null; NPC.talk = 0; }
  barkEl.classList.remove('on');
  for (const e of [...enemies]) removeEnemy(e); boss = null; clearTeles(); $('bossbar').classList.remove('on'); $('hud').classList.remove('boss');
  for (const s of shots) scene.remove(s.m); shots.length = 0; lockTarget = null;
  Object.assign(hero, {hp:100, atb:0, state:'free', t:0, combo:0, invuln:1, deadT:0});
  hero.pos.set(0,0,0); hero.vel.set(0,0,0); hero.facing = Math.PI; camYaw = 0; camPitch = .24;
  H.inner.rotation.set(0,0,0); H.inner.position.y = PIV; H.inner.visible = true;
  wave = 0; kills = 0; waveT = 1.0; overShown = false;
}
function startGame(m='story', fromStep=0){
  if (!heroReady) return;
  mode = m; initAudio(); resetGame(); running = true; paused = false;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  ['startOv','overOv','pauseOv','endOv'].forEach(id => $(id).classList.add('hide'));
  $('hud').classList.add('on'); setObjective(null);
  if (mode==='story'){
    if (fromStep===0){ playTime = 0; barkSaid.clear(); }
    storyStep = fromStep;
    if (STORY[storyStep].boss){ hero.pos.set(0,0,-3); hero.facing = 0; spawnBoss(); }
    if (fromStep===0) banner('EPISODE 1','風の沈黙');
    camYaw = hero.facing + Math.PI; camTarget.set(hero.pos.x,1.2,hero.pos.z);
    runStep();
  } else emit(new THREE.Vector3(0,.5,0), new THREE.Color(.7,1.8,2.6), 80, 6, 1, 4, .5, 3);
}
function toTitle(){
  setCtrlPanel(false);
  running = false; overShown = false; resetGame(); setObjective(null);
  ['overOv','pauseOv','endOv'].forEach(id => $(id).classList.add('hide'));
  $('startOv').classList.remove('hide'); $('hud').classList.remove('on');
}
function showOver(){
  overShown = true; overAt = performance.now();
  $('overStats').innerHTML = mode==='story' ? 'エルフィナは力尽きた……<br>直前のチェックポイントから再開できます' : `到達 WAVE <b>${wave}</b><br>撃破数 <b>${kills}</b>`;
  $('overOv').classList.remove('hide');
}
let overAt = 0;
function setPause(v){ paused = v; $('pauseOv').classList.toggle('hide', !v); }
// iPhone: react the moment the finger lifts (pointerup) instead of waiting for the delayed "click",
// which arrives late or gets lost while the game is busy rendering. The real click that follows a tap is ignored
// so nothing fires twice; keyboard Enter/Space (a click with detail 0) still works.
function onTap(el, fn){
  el.addEventListener('pointerup', e => { if (el.disabled || e.button > 0) return; fn(); });
  el.addEventListener('click', e => { if (e.detail === 0 && !el.disabled) fn(); });
}
onTap($('startBtn'), () => startGame('story'));
onTap($('endlessBtn'), () => startGame('endless'));
// title "controls" panel: opened from the menu (or △), closed by tapping anywhere (or ○ / △)
const setCtrlPanel = v => $('startOv').classList.toggle('ctrl-open', v);
const ctrlOpen = () => $('startOv').classList.contains('ctrl-open');
onTap($('ctrlBtn'), () => setCtrlPanel(true));
onTap($('ctrlPanel'), () => setCtrlPanel(false));
const retry = () => startGame(mode, mode==='story' ? storyStep : 0);
onTap($('retryBtn'), retry);
onTap($('titleBtn'), toTitle);
onTap($('endTitleBtn'), toTitle);
onTap($('endEndlessBtn'), () => startGame('endless'));
onTap($('resumeBtn'), () => setPause(false));
function nextWave(){
  wave++;
  const elite = wave % 5 === 0;
  banner(`WAVE ${wave}`, elite ? '— 強敵出現 —' : '');
  const n = Math.min(2 + wave, 9), casters = wave >= 2 ? Math.min(Math.floor(wave/2), 4) : 0;
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, r = 10 + Math.random()*5;
    spawnEnemy(i < casters ? 'caster' : 'golem', new THREE.Vector3(Math.sin(a)*r, 0, Math.cos(a)*r));
  }
  if (elite){ const a = Math.random()*Math.PI*2; spawnEnemy('golem', new THREE.Vector3(Math.sin(a)*12,0,Math.cos(a)*12), true); }
  if (wave > 1){ hero.hp = Math.min(hero.maxHp, hero.hp + 20); }
}

/* ================= HUD ================= */
const hpFill=$('hpFill'), hpText=$('hpText'), hpBar=$('hpBar'), atbFill=$('atbFill'), atbBar=$('atbBar'), atbReady=$('atbReady');
const padEl = $('padStatus'), waveEl = $('wave'), killsEl = $('kills');
let lastPad = null;
function updateHud(){
  hpFill.style.width = (hero.hp/hero.maxHp*100)+'%'; hpText.textContent = `${Math.ceil(hero.hp)} / ${hero.maxHp}`;
  hpBar.classList.toggle('low', hero.hp < 30);
  atbFill.style.width = hero.atb+'%'; atbBar.classList.toggle('full', hero.atb>=100); atbReady.classList.toggle('on', hero.atb>=100);
  waveEl.textContent = mode==='story' ? '第一話　風の沈黙' : `WAVE ${Math.max(1,wave)}`; killsEl.textContent = `撃破 ${kills}`;
}
function updatePadUi(){
  if (lastPad === padConnected) return; lastPad = padConnected;
  padEl.textContent = padConnected ? '🎮 コントローラー接続中' : (isTouch ? '👆 タッチ操作' : '⌨️ キーボード');
  padEl.classList.toggle('ok', padConnected);
  touchEl.classList.toggle('on', isTouch && !padConnected);
  if (padConnected) $('padNote').innerHTML = '🎮 コントローラーを認識しました！ ✕ボタンでスタート';
}
addEventListener('gamepadconnected', () => { lastPad = null; });
addEventListener('gamepaddisconnected', () => { lastPad = null; });

/* ================= loop ================= */
const clock = new THREE.Clock();
function loop(){
  requestAnimationFrame(loop);
  adaptResolution();
  const dt = Math.min(clock.getDelta(), 1/20), now = clock.elapsedTime;
  const inp = gatherInput(); updatePadUi();

  // ambient
  rune.rotation.z += dt*.05; runeMat.opacity = .45 + Math.sin(now*1.3)*.08;
  for (const m of mists){ m.m.rotation.z += m.sp*dt; m.m.material.opacity = .1 + Math.sin(now*.4+m.ph)*.04; }
  shafts.forEach((m,i) => m.material.opacity = .012 + Math.sin(now*.5+i*1.7)*.006);   // 昼は光の筋をごく控えめに
  grade.uniforms.uTime.value = now;
  aberr = THREE.MathUtils.damp(aberr, 0, 7, dt); hurtFx = THREE.MathUtils.damp(hurtFx, 0, 3, dt);
  grade.uniforms.uAberr.value = .0012 + aberr; grade.uniforms.uHurt.value = hurtFx*.5 + (running && hero.hp < 30 ? .25 + Math.sin(now*4)*.1 : 0);
  for (const c of crystals){ c.m.rotation.y += dt*.8; c.m.position.y = c.base + Math.sin(now*1.5+c.ph)*.25; }
  updateWind(dt);
  // 舞う粒子は風に流される。風が止まると、ほとんど動かなくなる
  const wk = .08 + .92*wind;
  for (let i=0;i<EMB;i++){ embPos[i*3+1] += embSpd[i]*dt*wk; embPos[i*3] += (Math.sin(now*.5+i)*.003 + dt*.5*wind);
    if (embPos[i*3] > 26) embPos[i*3] = -26; if (embPos[i*3+1] > 12) embPos[i*3+1] = 0; }
  embGeo.attributes.position.needsUpdate = true;

  barkT -= dt; if (barkT <= 0) barkEl.classList.remove('on');
  animateNPC(dt, now);
  if (!running){
    const endOn = !$('endOv').classList.contains('hide');
    if (endOn){
      if (performance.now()-overAt > 900){ if (inp.jump || inp.attack) toTitle(); else if (inp.dodge) startGame('endless'); }
    } else if (ctrlOpen()){ if (inp.dodge || inp.special) setCtrlPanel(false); }
    else if (inp.special) setCtrlPanel(true);
    else if (heroReady){ if (inp.jump || inp.attack) startGame('story'); else if (inp.dodge) startGame('endless'); }
    const a = now*.12; camera.position.set(Math.sin(a)*4.2, 1.6, -11.8 + Math.cos(a)*4.2); camera.lookAt(0,1.1,-12.6);
    hero.pos.set(0,0,-11.8); H.root.rotation.y = Math.PI; animateHero(dt, now); updateTrail();
    sky.position.copy(camera.position); updateParticles(dt); composer.render(); return;
  }
  if (overShown){
    if (performance.now()-overAt > 900){ if (inp.jump || inp.attack) retry(); else if (inp.dodge) toTitle(); }
  } else if (cine){ /* dialogue consumes input */ }
  else if (inp.pause) setPause(!paused);
  else if (paused && (inp.jump)) setPause(false);
  if (paused){ composer.render(); return; }

  if (cine){
    updateCine(dt, inp, now);
    const none = {mx:0,my:0,cx:0,cy:0,rx:0};
    updateHero(dt, none, now); updateFx(dt); updateDebris(dt); updateTrail(); updateParticles(dt);
    sky.position.copy(camera.position); moonLight.position.copy(hero.pos).addScaledVector(SUN_DIR, 26); moonLight.target.position.copy(hero.pos);
    for (const e of enemies){ e.body.position.y = e.hover + Math.sin(now*2.2+e.ph)*.15; e.orbit.rotation.y += dt*2; if (e.state==='spawn'){ e.t+=dt; e.g.scale.setScalar(e.sc*easeOut(Math.min(1,e.t/.6))); if (e.t>.6) e.state='chase'; }
      e.g.rotation.y = lerpAngle(e.g.rotation.y, Math.atan2(hero.pos.x-e.g.position.x, hero.pos.z-e.g.position.z), Math.min(1,dt*3)); }
    composer.render(); return;
  }
  playTime += dt;
  let gdt = dt;
  if (hitStop > 0){ hitStop -= dt; gdt = dt*.06; }
  else if (slowMo > 0){ slowMo -= dt; gdt = dt*.35; }

  updateLock(dt, now, inp);
  // camera control (real time)
  if (lockTarget){
    const tp = lockTarget.g.position, dxz = Math.hypot(hero.pos.x-tp.x, hero.pos.z-tp.z);
    if (dxz > .8) camYaw = lerpAngle(camYaw, Math.atan2(hero.pos.x-tp.x, hero.pos.z-tp.z), 1-Math.pow(.03, dt));
    camPitch += inp.cy*1.7*dt + ts.dy*.004;
    if (Math.abs(inp.cy) < .15 && ts.camId === null) camPitch = THREE.MathUtils.damp(camPitch, .26, 2, dt);
  } else {
    camYaw -= inp.cx*2.6*dt + ts.dx*.0065; camPitch += inp.cy*1.7*dt + ts.dy*.004;
  }
  ts.dx = ts.dy = 0;
  camPitch = THREE.MathUtils.clamp(camPitch, -.05, 1.15);

  updateHero(gdt, inp, now);
  updateEnemies(gdt, now);
  updateShots(gdt);
  updateTeles(gdt);
  updateFx(gdt);
  updateDebris(gdt);
  updateTrail();
  updateParticles(gdt);

  if (mode==='story'){ if (!overShown && hero.state !== 'dead') updateStory(dt); if (boss) $('bossFill').style.width = Math.max(0, boss.hp/boss.maxHp*100)+'%'; }
  else if (!overShown && enemies.length === 0 && hero.state !== 'dead'){ waveT -= dt; if (waveT <= 0){ nextWave(); waveT = 2.0; } }
  if (hero.state !== 'dead' && hero.state !== 'special') hero.atb = Math.min(100, hero.atb + dt*1.5);

  // camera follow
  camTarget.lerp(new THREE.Vector3(hero.pos.x, hero.pos.y*.6 + 1.2, hero.pos.z), 1 - Math.pow(.0005, dt));
  const cd = camDist * (hero.state==='special' ? 1.25 : 1) * (boss ? 1.4 : 1);
  camera.position.set(camTarget.x + Math.sin(camYaw)*Math.cos(camPitch)*cd, camTarget.y + Math.sin(camPitch)*cd + .4, camTarget.z + Math.cos(camYaw)*Math.cos(camPitch)*cd);
  if (camera.position.y < .4) camera.position.y = .4;
  if (lockBlend > .01 && (lockTarget || lockBlend < 1)){
    if (lockTarget) lastLockPos.copy(ecenter(lockTarget));
    camera.lookAt(camTarget.clone().lerp(lastLockPos, .28*lockBlend));
  } else camera.lookAt(camTarget);
  const fovT = hero.state==='special' ? 70 : hero.state==='dodge' ? 66 : (hero.state==='attack' && hero.lunge > 10 && hero.t < .15) ? 70 : 60;
  camera.fov = THREE.MathUtils.damp(camera.fov, fovT, 9, dt); camera.updateProjectionMatrix();
  if (shake > 0){ camera.position.x += (Math.random()-.5)*shake; camera.position.y += (Math.random()-.5)*shake; shake *= Math.pow(.003, dt); if (shake < .01) shake = 0; }
  sky.position.copy(camera.position);
  moonLight.position.copy(hero.pos).addScaledVector(SUN_DIR, 26); moonLight.target.position.copy(hero.pos);

  updateHud();
  composer.render();
}
updatePadUi();
loop();
