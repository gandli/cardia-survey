import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SPECIMENS } from '../data/specimens.js';

/* HeartEngine: 原站 Three.js + WebAudio + 状态机 + 渲染循环,
   封装为类, DOM 操作改走 this.root.querySelector, 便于 React 挂载/销毁。
   业务逻辑与原站一致(已验证)。 */
export class HeartEngine {
  constructor(root) {
    this.root = root;
    this.el = (id) => this.root.querySelector('#' + id);
    this._raf = null;
    this._initRenderer();
    this._initScene();
    this._initHeart();
    this._initAudio();
    this._initRecorder();
    this._initHUD();
    this._initStateMachine();
    this._bindLoop();
  }

  _initRenderer() {
    const canvas = this.el('gl');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;
  }

  _initScene() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 50);
    camera.position.set(0, 0.35, 5.9);
    camera.lookAt(0, 0, 0);
    const macroCam = new THREE.PerspectiveCamera(15, 1, 0.05, 50);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    scene.environmentIntensity = 0.55;

    scene.add(new THREE.HemisphereLight(0xfff6ea, 0xb9b2a6, 0.55));
    const key = new THREE.DirectionalLight(0xfff2e2, 1.7); key.position.set(3.5, 5, 2.5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8f2, 0.4); fill.position.set(-4, 1.5, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(-1, 3, -4); scene.add(rim);

    const rockGroup = new THREE.Group();
    rockGroup.rotation.z = 0.05;
    scene.add(rockGroup);

    const rock = new THREE.Group();
    rockGroup.add(rock);

    this.scene = scene; this.camera = camera; this.macroCam = macroCam;
    this.rockGroup = rockGroup; this.rock = rock;
  }

  _initHeart() {
    let heartLoaded = false, heartBox = new THREE.Box3(), heartRadius = 1;
    let heartMeshes = [], heartModel = null;

    const scanU = {
      uScanPoint: { value: new THREE.Vector3(999, 999, 999) },
      uScanRadius: { value: 0.55 },
      uScanStrength: { value: 0.0 },
      uScanColor: { value: new THREE.Color('#8fe8c8') },
      uRingRadius: { value: 0.0 },
      uRingStrength: { value: 0.0 },
    };
    const patchScan = (mat) => {
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, scanU);
        shader.vertexShader = 'varying vec3 vWPScan;\n' + shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n  vWPScan = (modelMatrix * vec4(transformed,1.0)).xyz;'
        );
        shader.fragmentShader =
          'uniform vec3 uScanPoint; uniform float uScanRadius; uniform float uScanStrength;\n' +
          'uniform vec3 uScanColor; uniform float uRingRadius; uniform float uRingStrength;\n' +
          'varying vec3 vWPScan;\n' + shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
             float _d = distance(vWPScan, uScanPoint);
             float _g = smoothstep(uScanRadius, uScanRadius*0.12, _d) * uScanStrength;
             float _r = smoothstep(0.075, 0.0, abs(_d - uRingRadius)) * uRingStrength;
             gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb + uScanColor, _g*0.9);
             gl_FragColor.rgb += uScanColor * _r;`
          );
      };
      mat.needsUpdate = true;
    };
    this._patchScan = patchScan; this._scanU = scanU;

    const loader = new GLTFLoader();
    loader.load('assets/heart.glb', (gltf) => {
      if (this.destroyed) return; // 卸载后忽略异步回调 (Gemini P1)
      const model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) {
          o.geometry.computeVertexNormals && o.geometry.computeVertexNormals();
          const m = o.material;
          if (m) { m.roughness = Math.min((m.roughness ?? 0.7) * 1.0, 0.95); m.metalness = 0.0; m.envMapIntensity = 0.6; patchScan(m); }
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const target = 1.35;
      const k = target / sphere.radius;
      model.scale.setScalar(k);
      model.position.sub(sphere.center.clone().multiplyScalar(k));
      model.rotation.y = Math.PI * 0.15;
      this.rock.add(model);

      heartMeshes = [];
      model.traverse((o) => { if (o.isMesh) heartMeshes.push(o); });
      heartModel = model;
      this.rockGroup.updateMatrixWorld(true);

      heartBox.setFromObject(model);
      heartRadius = heartBox.getBoundingSphere(new THREE.Sphere()).radius;
      const size = heartBox.getSize(new THREE.Vector3());
      const c = heartBox.getCenter(new THREE.Vector3());

      // 锚点计算结果放到实例 Map, 不污染模块级 SPECIMENS
      // (P0-1: StrictMode 双挂载 / HMR 时前实例 destroy 与新实例 loader 回调 race 会写坏同一对象)
      this.anchors = new Map();
      const ray = new THREE.Raycaster();
      for (const s of SPECIMENS) {
        const tgt = new THREE.Vector3(
          c.x + s.a[0] * size.x * 0.5, c.y + s.a[1] * size.y * 0.5, c.z + s.a[2] * size.z * 0.5);
        const dir = tgt.clone().sub(c).normalize();
        const origin = c.clone().addScaledVector(dir, heartRadius * 2.5);
        ray.set(origin, dir.clone().negate());
        const hits = ray.intersectObjects(heartMeshes, true);
        const worldHit = hits.length ? hits[0].point : tgt;
        const worldNrm = hits.length && hits[0].face
          ? hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld).normalize()
          : dir.clone();
        const anchorLocal = model.worldToLocal(worldHit.clone());
        const normalLocal = model.worldToLocal(worldHit.clone().addScaledVector(worldNrm, 1))
          .sub(model.worldToLocal(worldHit.clone())).normalize();
        this.anchors.set(s.name, { anchorLocal, normalLocal });
      }
      heartLoaded = true;
      const loading = this.el('loading'); if (loading) loading.style.opacity = '0';
      document.body.classList.add('ready');
      this._heartLoaded = heartLoaded; this._heartModel = heartModel;
    });
    this._getHeart = () => ({ heartLoaded, heartModel });
  }

  _initAudio() {
    const Audio = (() => {
      let ctx = null, master = null, ambGain = null, enabled = false, recDest = null;
      const ensure = () => {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 5;
        comp.attack.value = 0.004; comp.release.value = 0.20;
        const makeup = ctx.createGain(); makeup.gain.value = 1.5;
        comp.connect(makeup).connect(ctx.destination);
        // 录制专用旁路: makeup -> MediaStreamDestination, 保留原路径到扬声器
        recDest = ctx.createMediaStreamDestination();
        makeup.connect(recDest);
        master = ctx.createGain(); master.gain.value = 0; master.connect(comp);
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; ch[i] = last * 3.5; }
        const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.6;
        ambGain = ctx.createGain(); ambGain.gain.value = 0.05;
        noise.connect(lp).connect(ambGain).connect(master); noise.start();
        const drone = ctx.createOscillator(); drone.type = 'sine'; drone.frequency.value = 49;
        const dg = ctx.createGain(); dg.gain.value = 0.028;
        drone.connect(dg).connect(master); drone.start();
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
        const lfoG = ctx.createGain(); lfoG.gain.value = 90;
        lfo.connect(lfoG).connect(lp.frequency); lfo.start();
      };
      const tone = (freq, dur, { type = 'sine', gain = 0.08, glideTo = null, when = 0 } = {}) => {
        if (!enabled) return;
        const t0 = ctx.currentTime + when;
        const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
        if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
      };
      const noiseBurst = (dur, f0, f1, gain = 0.05, when = 0) => {
        if (!enabled) return;
        const t0 = ctx.currentTime + when;
        const len = Math.ceil(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
        bp.frequency.setValueAtTime(f0, t0);
        bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(bp).connect(g).connect(master); src.start(t0);
      };
      const thump = (freq, dur, gain, when) => {
        if (!enabled) return;
        const t0 = ctx.currentTime + when;
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(freq * 2.4, t0);
        o.frequency.exponentialRampToValueAtTime(freq * 0.72, t0 + dur * 0.85);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.010);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 190; lp.Q.value = 0.9;
        o.connect(lp).connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
      };
      return {
        get enabled() { return enabled; },
        toggle() { ensure(); enabled = !enabled; master.gain.linearRampToValueAtTime(enabled ? 0.6 : 0, ctx.currentTime + 0.1); return enabled; },
        captureStream() { ensure(); return recDest ? recDest.stream : new MediaStream(); },
        scrambleTick() { tone(1400 + Math.random() * 400, 0.03, { type: 'square', gain: 0.015 }); },
        whoosh() { noiseBurst(0.5, 180, 900, 0.05); },
        complete() { tone(523, 0.5, { gain: 0.1 }); tone(784, 0.7, { gain: 0.08, when: 0.18 }); },
        heartbeat(period) { thump(58, 0.18, 0.5, 0); thump(46, 0.22, 0.32, period * 0.28); },
        scanTick() { tone(900, 0.05, { type: 'triangle', gain: 0.03 }); },
        lock() { tone(1320, 0.12, { type: 'sine', gain: 0.05 }); },
        close() { if (ctx) { try { ctx.close(); } catch { /* noop */ } ctx = null; enabled = false; recDest = null; master = null; ambGain = null; } },
      };
    })();
    this.Audio = Audio;
  }

  _initRecorder() {
    const recBtn = this.el('rec-btn');
    let mediaRec = null, recChunks = [], recDisplay = null;
    let audioArmed = false;
    const setAudio = (on) => {
      const audioBtn = this.el('audio-btn');
      if (audioBtn) { audioBtn.textContent = on ? '声音 开' : '声音 关'; audioBtn.classList.toggle('on', on); }
      const audioHint = this.el('audio-hint'); if (audioHint) audioHint.style.opacity = '0';
    };
    const audioBtn = this.el('audio-btn');
    if (audioBtn) audioBtn.addEventListener('click', (e) => { e.stopPropagation(); audioArmed = true; setAudio(this.Audio.toggle()); });
    this.root.addEventListener('click', () => { if (!audioArmed) { audioArmed = true; if (!this.Audio.enabled) setAudio(this.Audio.toggle()); } });

    const replayBtn = this.el('replay-btn');
    if (replayBtn) replayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.Audio.enabled) { audioArmed = true; setAudio(this.Audio.toggle()); }
      this._restartSurvey();
    });

    const stopRecording = () => { if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop(); };
    const startRecording = async () => {
      try {
        recDisplay = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 60, cursor: 'never' }, audio: false, preferCurrentTab: true,
        });
        // Gemini High: getDisplayMedia 弹框期间组件可能已卸载 → 立即停 tracks 并 return
        if (this.destroyed) {
          recDisplay.getTracks().forEach((t) => t.stop());
          recDisplay = null;
          return;
        }
        if (!this.Audio.enabled) { audioArmed = true; setAudio(this.Audio.toggle()); }
        const audioStream = this.Audio.captureStream();
        const mixed = new MediaStream([...recDisplay.getVideoTracks(), ...audioStream.getAudioTracks()]);
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
        recChunks = [];
        mediaRec = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 16_000_000 });
        mediaRec.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
        mediaRec.onstop = () => {
          const blob = new Blob(recChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'cardia-survey.webm'; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          recDisplay.getTracks().forEach((t) => t.stop());
          document.body.classList.remove('capturing');
          clearTimeout(this._recAutoStop);
          recBtn.classList.remove('recording'); recBtn.textContent = '● 录制';
        };
        recDisplay.getVideoTracks()[0].addEventListener('ended', stopRecording);
        mediaRec.start();
        recBtn.classList.add('recording'); recBtn.textContent = '■ 停止';
        document.body.classList.add('capturing');
        // P0-3: 提到 this.* 让 destroy 能清; 33s 自动停
        this._recAutoStop = setTimeout(stopRecording, 33000);
        this._restartSurvey();
      } catch (err) {
        console.warn('recording cancelled:', err);
        // P1-3: catch 兜底停 recDisplay tracks, 避免屏幕录制指示灯持续亮
        recDisplay?.getTracks().forEach((t) => t.stop());
        recDisplay = null;
        document.body.classList.remove('capturing');
        recBtn.classList.remove('recording'); recBtn.textContent = '● 录制';
      }
    };
    if (recBtn) recBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mediaRec && mediaRec.state === 'recording') stopRecording(); else startRecording();
    });
    // 保存 keydown handler 以便 destroy() 清理
    this._onKeyDown = (e) => { if (e.key === 'Escape') stopRecording(); };
    window.addEventListener('keydown', this._onKeyDown);
    // 暴露 stop 以便 destroy() 主动停止录制
    this._stopRecording = stopRecording;
  }

  _initHUD() {
    this.elId = (id) => this.root.querySelector('#' + id);
    const specCount = this.elId('spec-count'), specName = this.elId('spec-name-txt'), specDesc = this.elId('spec-desc');
    const scanState = this.elId('scan-state'), surveyDot = this.elId('survey-dot');
    const barVit = this.elId('bar-vit'), barLum = this.elId('bar-lum'), barTox = this.elId('bar-tox');
    const valVit = this.elId('val-vit'), valLum = this.elId('val-lum'), valTox = this.elId('val-tox');
    const posTxt = this.elId('pos-txt'), altTxt = this.elId('alt-txt');
    const spTxt = this.elId('sp-txt'), magTxt = this.elId('mag-txt'), macroMode = this.elId('macro-mode');
    const macroFlash = this.elId('macro-flash');
    const scanPath = this.elId('scanline'), scanHalo = this.elId('scanline-halo'), reticle = this.elId('reticle'), retOuter = this.elId('ret-outer');
    const completeCap = this.elId('complete');
    const meterTox = this.elId('meter-tox');
    const surveyPanel = this.elId('survey');
    const macroWin = this.elId('macro-window');
    Object.assign(this, {
      specCount, specName, specDesc, scanState, surveyDot, barVit, barLum, barTox,
      valVit, valLum, valTox, posTxt, altTxt, spTxt, magTxt, macroMode, macroFlash,
      scanPath, scanHalo, reticle, retOuter, completeCap, meterTox, surveyPanel, macroWin,
    });
    this.SCRAMBLE_CHARS = 'ABCDEFGHIKLMNOPRSTUVX0123456789·∷';
    this.scramblers = new Map();
  }

  _scrambleTo(node, text, dur = 450) {
    if (!node) return;
    clearInterval(this.scramblers.get(node));
    const start = performance.now();
    const iv = setInterval(() => {
      const k = Math.min(1, (performance.now() - start) / dur);
      const solved = Math.floor(k * text.length);
      let out = text.slice(0, solved);
      for (let i = solved; i < text.length; i++)
        out += text[i] === ' ' ? ' ' : this.SCRAMBLE_CHARS[Math.floor(Math.random() * this.SCRAMBLE_CHARS.length)];
      node.textContent = out;
      this.Audio.scrambleTick();
      if (k >= 1) clearInterval(iv);
    }, 34);
    this.scramblers.set(node, iv);
  }
  _animNum(node, to, dur = 800) {
    if (!node) return;
    const from = parseFloat(node.textContent) || 0;
    const start = performance.now();
    // 同步 mini chip: node.id=val-vit -> mini-vit, val-lum -> mini-lum, val-tox -> mini-tox
    const miniId = node.id ? 'mini-' + node.id.slice(4) : null;
    const mini = miniId ? document.getElementById(miniId) : null;
    const step = () => {
      if (this.destroyed) return; // 组件卸载后停止动画
      const k = Math.min(1, (performance.now() - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const v = (from + (to - from) * e).toFixed(2);
      node.textContent = v;
      if (mini) mini.textContent = v;
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }

  _initStateMachine() {
    this.SCAN_DUR = 3.4; this.COMPLETE_DUR = 5.0;
    this.phase = 'scan'; this.specIdx = -1; this.phaseStart = 0;
    this.archivedShown = false; this.lastTick = 0;
    this._showSpecimen = (i) => {
      const s = SPECIMENS[i];
      this.specCount.textContent = `切面 0${i + 1} / 06`;
      this._scrambleTo(this.specName, s.name, 500);
      this._scrambleTo(this.specDesc, s.desc, 620);
      this.barVit.style.width = (s.vit * 100) + '%';
      this.barLum.style.width = (s.lum * 100) + '%';
      this.barTox.style.width = (s.tox * 100) + '%';
      this._animNum(this.valVit, s.vit); this._animNum(this.valLum, s.lum); this._animNum(this.valTox, s.tox);
      this.meterTox.classList.toggle('hot', s.tox > 0.3);
      this.scanState.textContent = '扫描中';
      this.surveyDot.classList.remove('done');
      this.spTxt.textContent = `SP-0${i + 1}`;
      this.magTxt.textContent = `放大 ${(1.8 + ((i * 37) % 90) / 100).toFixed(2)}×`;
      this.posTxt.textContent = `位置 ${String(1000 + ((i * 613) % 900)).padStart(4, '0')} · 0${String(400 + ((i * 271) % 500)).padStart(3, '0')}`;
      this.altTxt.textContent = `Ø 0${String(380 + ((i * 97) % 240)).padStart(3, '0')}`;
      this.macroMode.textContent = '跟踪中';
      if (this.macroFlash) this.macroFlash.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
      if (this.retOuter) this.retOuter.animate([{ r: 22 }, { r: 8 }], { duration: 500, easing: 'cubic-bezier(0.22,1,0.36,1)' });
      this.specShownAt = performance.now() / 1000;
      this.ringStart = this.specShownAt + 0.5;
      this.progSegs.forEach((seg, j) => { seg.classList.toggle('done', j < i); seg.classList.toggle('active', j === i); });
      this.Audio.whoosh();
    };
    this._enterComplete = () => {
      this.phase = 'complete'; this.phaseStart = performance.now() / 1000;
      this.specCount.textContent = '序列 06 / 06';
      this._scrambleTo(this.specName, '检查完成', 550);
      this._scrambleTo(this.specDesc, '全部序列已采集', 620);
      this.scanState.textContent = '已采集';
      this.surveyDot.classList.add('done');
      this.macroMode.textContent = '归档';
      this.barVit.style.width = '75%'; this.barLum.style.width = '39%'; this.barTox.style.width = '17%';
      this._animNum(this.valVit, 0.75); this._animNum(this.valLum, 0.39); this._animNum(this.valTox, 0.17);
      this.meterTox.classList.remove('hot');
      this.scanPath.setAttribute('d', ''); this.scanHalo.setAttribute('d', ''); this.reticle.style.opacity = '0';
      this.progSegs.forEach((seg) => { seg.classList.remove('active'); seg.classList.add('done'); });
      if (this.completeCap) this.completeCap.style.opacity = '1';
      this.Audio.complete();
    };
    this._nextSpecimen = () => {
      this.specIdx++;
      if (this.specIdx >= SPECIMENS.length) { this._enterComplete(); return; }
      this.phaseStart = performance.now() / 1000;
      this.archivedShown = false;
      this._showSpecimen(this.specIdx);
    };
    this._restartSurvey = () => {
      const { heartLoaded } = this._getHeart();
      if (!heartLoaded) return;
      this.phase = 'scan'; this.specIdx = -1; this.introStart = null; this.rotAngle = 0;
      this.phaseStart = performance.now() / 1000;
      this.specShownAt = -99; this.ringStart = -99; this.lastBeatIdx = -1; this.archivedShown = false;
      this.scanPath.setAttribute('d', ''); this.scanHalo.setAttribute('d', ''); this.reticle.style.opacity = '0';
      if (this.completeCap) this.completeCap.style.opacity = '0';
      this.scanState.textContent = '扫描中'; this.surveyDot.classList.remove('done');
      this.macroMode.textContent = '跟踪中';
      this.progSegs.forEach((s) => s.classList.remove('done', 'active'));
      this._scanU.uScanStrength.value = 0; this._scanU.uRingStrength.value = 0;
      clearInterval(this.scramblers.get(this.specName)); clearInterval(this.scramblers.get(this.specDesc));
      this.specCount.textContent = '切面 01 / 06';
      this.specName.textContent = ''; this.specDesc.textContent = '';
      this.barVit.style.width = '0%'; this.barLum.style.width = '0%'; this.barTox.style.width = '0%';
      this.valVit.textContent = '0.00'; this.valLum.textContent = '0.00'; this.valTox.textContent = '0.00';
      this.meterTox.classList.remove('hot');
      document.body.classList.remove('ready');
      void document.body.offsetWidth;
      document.body.classList.add('ready');
    };
    this.progSegs = [...this.root.querySelectorAll('#progress i')];
  }

  _bindLoop() {
    const resize = () => {
      const w = innerWidth, h = innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize); resize();
    this._resize = resize;

    const tmpV = new THREE.Vector3();
    const worldAnchor = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const BEAT_PERIOD = 0.88;
    const g1 = (p, c, w) => Math.exp(-((p - c) * (p - c)) / (w * w));
    const beatContract = (p) => Math.min(1, g1(p, 0.12, 0.05) + 0.42 * g1(p, 0.30, 0.06));
    const ecgValue = (p) => g1(p, 0.06, 0.020) * 0.16 - g1(p, 0.115, 0.007) * 0.12 + g1(p, 0.15, 0.007) * 1.0 - g1(p, 0.185, 0.010) * 0.30 + g1(p, 0.34, 0.05) * 0.24;
    const ecgLine = this.elId('ecg-line'), ecgDot = this.elId('ecg-dot');
    const ecgHr = this.elId('ecg-hr'), miniHr = this.elId('mini-hr');
    const ECG_N = 116, ecgBuf = new Array(ECG_N).fill(0);
    let hrUpdateAt = 0, currentHr = 68;
    const renderECG = () => {
      let pts = '';
      for (let i = 0; i < ECG_N; i++) { const x = (i / (ECG_N - 1)) * 214; const y = 15 - ecgBuf[i] * 11; pts += x.toFixed(1) + ',' + y.toFixed(1) + ' '; }
      ecgLine.setAttribute('points', pts);
      ecgDot.setAttribute('cx', '214'); ecgDot.setAttribute('cy', (15 - ecgBuf[ECG_N - 1] * 11).toFixed(1));
    };
    const updateHr = (t) => {
      // 每 1.6s 微抖动 HR (66-74), 保持医学可信
      if (t - hrUpdateAt < 1.6) return;
      hrUpdateAt = t;
      currentHr = Math.round(68 + (Math.random() - 0.5) * 6);
      if (ecgHr) ecgHr.textContent = String(currentHr);
      if (miniHr) miniHr.textContent = String(currentHr);
    };

    let lastFrameS = null;
    // 状态统一放 this.* (CodeRabbit + Codex Major: 之前闭包版每帧反向覆盖实例字段导致 _showSpecimen/_restartSurvey 写入失效)
    this.introStart = null; this.rotAngle = 0; this.specShownAt = -99; this.ringStart = -99; this.lastBeatIdx = -1;

    const render = (nowMs) => {
      if (this.destroyed) return; // 组件卸载后停止 (Gemini)
      this._raf = requestAnimationFrame(render);
      const t = nowMs / 1000;
      const dt = lastFrameS === null ? 0.016 : Math.min(0.05, t - lastFrameS);
      lastFrameS = t;

      const beatPhase = (t / BEAT_PERIOD) % 1;
      const contract = beatContract(beatPhase);
      ecgBuf.push(ecgValue(beatPhase)); ecgBuf.shift();
      renderECG();
      updateHr(t);
      const beatIdx = Math.floor(t / BEAT_PERIOD);
      if (beatIdx !== this.lastBeatIdx) { this.lastBeatIdx = beatIdx; this.Audio.heartbeat(BEAT_PERIOD); }

      const { heartLoaded, heartModel } = this._getHeart();
      if (heartLoaded) {
        if (this.introStart === null) this.introStart = t;
        const intro = THREE.MathUtils.clamp((t - this.introStart) / 1.25, 0, 1);
        const introE = 1 - Math.pow(1 - intro, 3);
        const present = THREE.MathUtils.smoothstep(t - this.specShownAt, 0.2, 1.6);
        this.rotAngle += dt * (0.018 + 0.055 * present) * introE;
        this.rockGroup.rotation.y = this.rotAngle;
        this.rock.scale.setScalar(introE * (1 - 0.032 * contract));
        this.rock.position.y = -0.018 * contract;
        this.renderer.toneMappingExposure = 0.98 + 0.05 * contract;
      }
      this.rockGroup.rotation.z = 0.05 + Math.sin(t * 0.3) * 0.02;
      this.rockGroup.position.y = Math.sin(t * 0.6) * 0.05;
      this.camera.position.x = Math.sin(t * 0.11) * 0.10;
      this.camera.position.y = 0.35 + Math.sin(t * 0.17) * 0.04;
      this.camera.lookAt(0, 0, 0);
      const sh = this.el('rockshadow');
      const shk = (1 - Math.sin(t * 0.6) * 0.06) * (1 + 0.05 * contract);
      if (sh) { sh.style.transform = `translate(-50%,-50%) scale(${shk})`; sh.style.opacity = String(0.85 + 0.1 * contract); }

      if (!heartLoaded) {
        this.renderer.setScissorTest(false);
        this.renderer.setViewport(0, 0, innerWidth, innerHeight);
        this.renderer.render(this.scene, this.camera);
        return;
      }

      if (this.phase === 'scan') {
        if (this.specIdx < 0) { if (t - this.introStart > 1.2) this._nextSpecimen(); }
        else if (t - this.phaseStart > this.SCAN_DUR) this._nextSpecimen();
        else if (!this.archivedShown && t - this.phaseStart > this.SCAN_DUR - 0.65) {
          this.archivedShown = true;
          this.scanState.textContent = '已采集';
          this.surveyDot.classList.add('done');
          this.Audio.lock();
        }
        if (t - this.lastTick > 0.55 && !this.archivedShown) { this.lastTick = t; this.Audio.scanTick(); }
      } else {
        if (t - this.phaseStart > this.COMPLETE_DUR) {
          if (this.completeCap) this.completeCap.style.opacity = '0';
          this.phase = 'scan'; this.specIdx = -1;
        }
      }

      const s = SPECIMENS[Math.max(0, Math.min(this.specIdx, SPECIMENS.length - 1))];
      const anchor = this.anchors?.get(s.name);
      if (this.phase === 'scan' && this.specIdx >= 0 && anchor) {
        worldAnchor.copy(anchor.anchorLocal); heartModel.localToWorld(worldAnchor);
        worldNormal.copy(anchor.normalLocal).transformDirection(heartModel.matrixWorld).normalize();
        tmpV.copy(worldAnchor).project(this.camera);
        const sx = (tmpV.x * 0.5 + 0.5) * innerWidth;
        const sy = (-tmpV.y * 0.5 + 0.5) * innerHeight;
        const pr = this.surveyPanel.getBoundingClientRect();
        const x0 = pr.right, y0 = pr.top + 52;
        const mx = x0 + (sx - x0) * 0.45;
        const dw = THREE.MathUtils.clamp((t - this.specShownAt) / 0.5, 0, 1);
        const de = 1 - Math.pow(1 - dw, 3);
        const ex = mx + (sx - mx) * de, ey = y0 + (sy - y0) * de;
        const dPath = `M ${x0} ${y0} L ${mx} ${y0} L ${ex} ${ey}`;
        const dashOff = String(-(t * 14) % 7);
        this.scanPath.setAttribute('d', dPath); this.scanPath.setAttribute('stroke-dashoffset', dashOff);
        this.scanHalo.setAttribute('d', dPath); this.scanHalo.setAttribute('stroke-dashoffset', dashOff);
        this.reticle.setAttribute('transform', `translate(${sx},${sy})`);
        const facing = worldNormal.dot(tmpV.copy(this.camera.position).sub(worldAnchor).normalize());
        const faceO = THREE.MathUtils.clamp((facing + 0.15) / 0.5, 0.12, 1);
        this.reticle.style.opacity = String(faceO * THREE.MathUtils.smoothstep(dw, 0.75, 1));
        this._scanU.uScanPoint.value.copy(worldAnchor);
        const target = 0.5 * THREE.MathUtils.smoothstep(dw, 0.6, 1) * faceO;
        this._scanU.uScanStrength.value += (target - this._scanU.uScanStrength.value) * Math.min(1, dt * 8);
        this._scanU.uScanRadius.value = 0.5 + 0.04 * Math.sin(t * 3);
        const rt = t - this.ringStart;
        if (rt >= 0 && rt < 0.75) { const re = rt / 0.75; this._scanU.uRingRadius.value = re * 1.15; this._scanU.uRingStrength.value = (1 - re) * 0.85; }
        else this._scanU.uRingStrength.value = 0;
        this.macroCam.position.copy(worldAnchor)
          .addScaledVector(worldNormal, (s.macroDist || 0.6) * 0.55)
          .addScaledVector(tmpV.copy(this.camera.position).sub(worldAnchor).normalize(), (s.macroDist || 0.6) * 0.5);
        this.macroCam.lookAt(worldAnchor);
      } else {
        this._scanU.uScanStrength.value += (0 - this._scanU.uScanStrength.value) * Math.min(1, dt * 6);
        this._scanU.uRingStrength.value = 0;
      }

      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, innerWidth, innerHeight);
      this.renderer.render(this.scene, this.camera);

      const r = this.macroWin.getBoundingClientRect();
      if (r.width > 4) {
        const y = innerHeight - r.bottom;
        this.macroCam.aspect = r.width / r.height; this.macroCam.updateProjectionMatrix();
        this.renderer.setScissorTest(true);
        this.renderer.setScissor(r.left, y, r.width, r.height);
        this.renderer.setViewport(r.left, y, r.width, r.height);
        this.renderer.render(this.scene, this.macroCam);
      }
    };
    this._render = render;
    this._raf = requestAnimationFrame(render);
  }

  destroy() {
    this.destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
    // 停止录制 + 清理定时器 (Gemini P1)
    try { this._stopRecording?.(); } catch { /* noop */ }
    // P0-3: 清 recAutoStop 定时器
    clearTimeout(this._recAutoStop);
    // 清理 scramble 定时器
    if (this.scramblers) {
      for (const iv of this.scramblers.values()) clearInterval(iv);
      this.scramblers.clear();
    }
    // 关闭 AudioContext (CodeRabbit Major)
    try { this.Audio?.close?.(); } catch { /* noop */ }
    document.body.classList.remove('ready', 'capturing');
    this.renderer.dispose();
  }
}
