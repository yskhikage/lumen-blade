// Synthesized sound effects (Web Audio API) — no audio files needed.
// @ts-nocheck
let actx = null, noiseBuf = null;
export function initAudio(){
  try{
    if (!actx){ actx = new (window.AudioContext||window.webkitAudioContext)();
      noiseBuf = actx.createBuffer(1, actx.sampleRate*.5, actx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
    actx.resume();
    if (windLevel > 0) setWind(windLevel);
  }catch(e){ actx = null; }
}

/* ---------- 風の環境音（WindShield） ----------
   ループするノイズを2系統に分けて「風らしさ」を作る:
   - 低い「ごうっ」という風音（ローパス）。ゆっくり揺れるLFOで、強弱の波（突風）をつける
   - 高い「ひゅう」という風切り音（バンドパス）。周波数を揺らして口笛のように
   setWind(0〜1) で全体の強さを変える。0 にすると完全な静寂になる。 */
let windLevel = 0, windGain = null, whistleGain = null, windApplied = -1;
function ensureWind(){
  if (windGain || !actx) return;
  const buf = actx.createBuffer(1, actx.sampleRate*2, actx.sampleRate), d = buf.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
  const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
  const low = actx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 520; low.Q.value = .8;
  const band = actx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 950; band.Q.value = 7;
  windGain = actx.createGain(); windGain.gain.value = 0;
  whistleGain = actx.createGain(); whistleGain.gain.value = 0;
  const lfo = (hz, amount, target) => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = hz; g.gain.value = amount; o.connect(g); g.connect(target); o.start(); };
  lfo(.09, 260, low.frequency);   // 突風のうねり
  lfo(.13, 380, band.frequency);  // 風切り音の音程の揺れ
  src.connect(low); low.connect(windGain); windGain.connect(actx.destination);
  src.connect(band); band.connect(whistleGain); whistleGain.connect(actx.destination);
  src.start();
}
export function setWind(level){
  windLevel = level;
  if (!actx) return;               // 音はユーザー操作（ゲーム開始）後にしか鳴らせないので、それまでは値だけ覚えておく
  if (Math.abs(level - windApplied) < .01) return;   // 毎フレーム呼ばれるので、変化が小さいときは何もしない
  windApplied = level;
  try{
    ensureWind();
    const t = actx.currentTime;
    windGain.gain.setTargetAtTime(level*.22, t, .15);
    whistleGain.gain.setTargetAtTime(level*level*.05, t, .15);
  }catch(e){}
}
export function sfx(type){
  if (!actx) return;
  try{
    const t = actx.currentTime, out = actx.createGain(); out.connect(actx.destination);
    const noise = (f0,f1,dur,vol,q=1.2) => {
      const s=actx.createBufferSource(); s.buffer=noiseBuf; const f=actx.createBiquadFilter(); f.type='bandpass'; f.Q.value=q;
      f.frequency.setValueAtTime(f0,t); f.frequency.exponentialRampToValueAtTime(f1,t+dur);
      const g=actx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t+dur);
    };
    const tone = (type,f0,f1,dur,vol) => {
      const o=actx.createOscillator(); o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f1,t+dur);
      const g=actx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t+dur);
    };
    if (type==='slash'){ noise(3500,700,.16,.28,.9); }
    else if (type==='hit'){ tone('square',260,70,.12,.12); noise(1800,300,.1,.3); }
    else if (type==='break'){ noise(4000,200,.45,.35,.6); tone('triangle',900,120,.4,.12); }
    else if (type==='jump'){ tone('sine',300,620,.12,.08); }
    else if (type==='dodge'){ noise(800,2400,.18,.18,.7); }
    else if (type==='hurt'){ tone('sawtooth',320,90,.25,.12); }
    else if (type==='just'){ tone('sine',900,1800,.25,.12); tone('sine',1350,2700,.25,.06); }
    else if (type==='special'){ tone('sawtooth',90,900,.55,.12); noise(200,3000,.55,.2,.5); }
    else if (type==='boom'){ tone('sine',120,30,.8,.5); noise(1200,80,.8,.5,.4); }
    else if (type==='lock'){ tone('sine',1500,1500,.07,.07); setTimeout(()=>sfx('lock2'),70); }
    else if (type==='lock2'){ tone('sine',2000,2000,.08,.06); }
    else if (type==='shot'){ tone('sine',700,300,.2,.06); }
    else if (type==='creak'){ tone('sawtooth',58,42,.9,.045); noise(320,110,.9,.1,2.5); }  // 風車がきしむ音
  }catch(e){}
}
