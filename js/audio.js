// All sound is synthesised with WebAudio, so there are no audio files to load.
let ctx = null, master, sfxBus, musicBus, voiceBus, noiseBuf;
const last = {};
const state = { sfx: true, music: true, musicOn: false, intense: false };

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
  comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(comp);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.0; musicBus.connect(comp);
  voiceBus = ctx.createGain(); voiceBus.gain.value = 1.0; voiceBus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

export function unlock() {
  if (!init()) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  if (state.music && !state.musicOn) startMusic();
  preloadSamples();
}

// ---------- recorded voice clips ----------
const samples = {}, playing = {};
export function registerSample(name, url) { if (!samples[name]) samples[name] = { url, buf: null, loading: null }; }
function loadSample(name) {
  const smp = samples[name];
  if (!smp || smp.buf || smp.loading || !ctx) return;
  smp.loading = fetch(smp.url)
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("http " + r.status))))
    .then(ab => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
    .then(buf => { smp.buf = buf; })
    .catch(() => { smp.loading = null; });
}
export function preloadSamples() { for (const n in samples) loadSample(n); }
export function playSample(name, { interrupt = false, gain = 1 } = {}) {
  if (!ctx || !state.sfx || ctx.state !== "running") return false;
  const smp = samples[name];
  if (!smp) return false;
  if (!smp.buf) { loadSample(name); return false; }
  if (playing[name]) {
    if (!interrupt) return false;
    try { playing[name].stop(); } catch (e) { /* already stopped */ }
  }
  const src = ctx.createBufferSource(); src.buffer = smp.buf;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(g).connect(voiceBus);
  src.onended = () => { if (playing[name] === src) delete playing[name]; };
  src.start();
  playing[name] = src;
  duckMusic(smp.buf.duration);
  return true;
}
export function stopSample(name) {
  if (!playing[name]) return;
  try { playing[name].stop(); } catch (e) { /* already stopped */ }
  delete playing[name];
}
function duckMusic(dur) {
  if (!state.musicOn) return;
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setTargetAtTime(0.1, t, 0.04);
  musicBus.gain.setTargetAtTime(0.32, t + dur, 0.35);
}

export function setPrefs({ sfx, music }) {
  if (sfx !== undefined) state.sfx = sfx;
  if (music !== undefined) {
    state.music = music;
    if (ctx) { if (music) startMusic(); else stopMusic(); }
  }
}

export function setIntense(v) { state.intense = v; }

document.addEventListener("visibilitychange", () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
});

// ---------- voices ----------
function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone({ type = "sine", f = 440, f2 = 0, t = 0, a = 0.005, d = 0.15, v = 0.3, dest = sfxBus, detune = 0 }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
  env(g, t, a, v, d);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + a + d + 0.05);
}
function noise({ t = 0, a = 0.003, d = 0.2, v = 0.3, type = "lowpass", f = 1200, f2 = 0, q = 0.8, dest = sfxBus }) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d);
  const g = ctx.createGain(); env(g, t, a, v, d);
  s.connect(fl).connect(g).connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + a + d + 0.05);
}

function gate(name, gap) {
  const now = ctx.currentTime;
  if (last[name] && now - last[name] < gap) return false;
  last[name] = now;
  return true;
}

// ---------- effects ----------
export function sfx(name, x = 0.5) {
  if (!ctx || !state.sfx || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.005;
  switch (name) {
    case "wall": if (!gate("wall", 0.06)) return;
      tone({ type: "triangle", f: 180 + 160 * x, f2: 90 + 60 * x, t, d: 0.09, v: 0.16 * (0.4 + x) }); break;
    case "clash": if (!gate("clash", 0.05)) return;
      tone({ type: "sine", f: 150, f2: 55, t, d: 0.16, v: 0.5 }); noise({ t, d: 0.06, v: 0.22, f: 2500, type: "bandpass", q: 1.2 }); break;
    case "hit": if (!gate("hit", 0.03)) return;
      tone({ type: "square", f: 260, f2: 110, t, d: 0.09, v: 0.16 }); noise({ t, d: 0.08, v: 0.25, f: 1800, f2: 500 }); break;
    case "hitSoft": if (!gate("hitSoft", 0.08)) return;
      tone({ type: "sine", f: 420, f2: 260, t, d: 0.07, v: 0.1 }); break;
    case "arrow":
      noise({ t, d: 0.16, v: 0.18, type: "bandpass", f: 2400, f2: 700, q: 2 }); tone({ type: "triangle", f: 700, f2: 300, t, d: 0.08, v: 0.12 }); break;
    case "bombThrow":
      noise({ t, d: 0.18, v: 0.14, type: "bandpass", f: 500, f2: 1400, q: 1.5 }); break;
    case "boom":
      noise({ t, a: 0.004, d: 0.7, v: 0.6, f: 1600, f2: 90 }); tone({ type: "sine", f: 95, f2: 32, t, d: 0.6, v: 0.6 }); break;
    case "spin":
      tone({ type: "sawtooth", f: 300, f2: 900, t, a: 0.02, d: 0.25, v: 0.07 }); noise({ t, d: 0.3, v: 0.1, type: "bandpass", f: 3000, q: 3 }); break;
    case "slash": if (!gate("slash", 0.05)) return;
      tone({ type: "triangle", f: 1900, t, d: 0.16, v: 0.12 }); tone({ type: "triangle", f: 2530, t, d: 0.12, v: 0.08 }); noise({ t, d: 0.05, v: 0.15, type: "highpass", f: 4000 }); break;
    case "dash":
      tone({ type: "sawtooth", f: 1300, f2: 180, t, d: 0.16, v: 0.14 }); noise({ t, d: 0.14, v: 0.16, type: "bandpass", f: 3500, q: 4 }); break;
    case "zap":
      tone({ type: "square", f: 900, f2: 120, t, d: 0.2, v: 0.14 }); noise({ t, d: 0.18, v: 0.24, type: "highpass", f: 2200 }); break;
    case "shieldUp":
      tone({ type: "sine", f: 300, f2: 700, t, a: 0.01, d: 0.22, v: 0.25 }); tone({ type: "triangle", f: 600, f2: 1400, t, a: 0.01, d: 0.2, v: 0.08 }); break;
    case "block": if (!gate("block", 0.06)) return;
      tone({ type: "triangle", f: 1600, t, d: 0.12, v: 0.14 }); tone({ type: "sine", f: 2400, t, d: 0.1, v: 0.08 }); break;
    case "reflect":
      tone({ type: "triangle", f: 500, f2: 1500, t, d: 0.14, v: 0.16 }); break;
    case "beam":
      tone({ type: "sine", f: 160, f2: 90, t, a: 0.03, d: 0.5, v: 0.2 }); tone({ type: "triangle", f: 480, f2: 240, t, a: 0.03, d: 0.4, v: 0.06, detune: 15 }); break;
    case "drain": if (!gate("drain", 0.1)) return;
      tone({ type: "sine", f: 640, f2: 300, t, d: 0.08, v: 0.08 }); break;
    case "heal": if (!gate("heal", 0.12)) return;
      tone({ type: "sine", f: 880, f2: 1320, t, d: 0.09, v: 0.06 }); break;
    case "ice":
      for (const [f, dl] of [[1760, 0], [2349, 0.03], [2960, 0.06]]) tone({ type: "sine", f, t: t + dl, d: 0.18, v: 0.07 }); break;
    case "chill": if (!gate("chill", 0.08)) return;
      noise({ t, d: 0.12, v: 0.2, type: "highpass", f: 3500 }); tone({ type: "triangle", f: 1200, f2: 600, t, d: 0.1, v: 0.08 }); break;
    case "fire":
      noise({ t, a: 0.03, d: 0.45, v: 0.28, f: 300, f2: 2400, q: 0.7 }); break;
    case "ignite": if (!gate("ignite", 0.1)) return;
      noise({ t, d: 0.25, v: 0.22, type: "bandpass", f: 900, f2: 300, q: 1 }); break;
    case "burn": if (!gate("burn", 0.15)) return;
      noise({ t, d: 0.07, v: 0.1, type: "bandpass", f: 1500, q: 2 }); break;
    case "magnet":
      tone({ type: "square", f: 110, t, a: 0.05, d: 0.7, v: 0.06 }); tone({ type: "sine", f: 220, f2: 330, t, a: 0.05, d: 0.6, v: 0.08 }); break;
    case "clank":
      tone({ type: "square", f: 330, f2: 140, t, d: 0.18, v: 0.16 }); tone({ type: "triangle", f: 990, t, d: 0.2, v: 0.08 }); break;
    case "pop": if (!gate("pop", 0.05)) return;
      noise({ t, d: 0.05, v: 0.08, type: "bandpass", f: 2000, q: 2 }); break;
    case "deflect":
      tone({ type: "triangle", f: 2200, t, d: 0.1, v: 0.1 }); break;
    case "ko":
      noise({ t, a: 0.004, d: 0.9, v: 0.55, f: 2200, f2: 80 }); tone({ type: "sine", f: 120, f2: 30, t, d: 0.9, v: 0.6 });
      break;
    case "win": {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => tone({ type: "square", f, t: t + 0.12 * i, d: 0.18, v: 0.07 }));
      tone({ type: "triangle", f: 1046.5, t: t + 0.5, d: 0.6, v: 0.12 });
      break;
    }
    case "count": tone({ type: "square", f: 660, t, d: 0.12, v: 0.09 }); break;
    case "go": tone({ type: "square", f: 990, t, d: 0.35, v: 0.1 }); tone({ type: "triangle", f: 1320, t, d: 0.3, v: 0.06 }); break;
    case "fever":
      [440, 554, 659, 880].forEach((f, i) => tone({ type: "sawtooth", f, t: t + i * 0.07, d: 0.16, v: 0.06 })); break;
    case "tap": if (!gate("tap", 0.03)) return; tone({ type: "triangle", f: 880, f2: 660, t, d: 0.05, v: 0.08 }); break;
    case "lunge":
      noise({ t, d: 0.2, v: 0.22, type: "bandpass", f: 500, f2: 2600, q: 1.4 }); tone({ type: "sine", f: 140, f2: 70, t, d: 0.12, v: 0.25 }); break;
    case "latch":
      tone({ type: "sine", f: 190, f2: 80, t, d: 0.12, v: 0.4 }); noise({ t, d: 0.04, v: 0.2, f: 1500 }); break;
    case "stab":
      noise({ t, d: 0.06, v: 0.32, type: "bandpass", f: 1900, q: 1.1 }); tone({ type: "triangle", f: 340, f2: 110, t, d: 0.07, v: 0.22 });
      tone({ type: "square", f: 2400, t, d: 0.02, v: 0.05 }); break;
    case "ustab":
      noise({ t, d: 0.07, v: 0.32, type: "bandpass", f: 1700, q: 1.1 }); tone({ type: "triangle", f: 300, f2: 90, t, d: 0.08, v: 0.24 });
      noise({ t, d: 0.16, v: 0.2, f: 2600, f2: 500 }); break;
    case "ultDash":
      noise({ t, d: 0.32, v: 0.3, type: "bandpass", f: 400, f2: 3200, q: 1.2 }); tone({ type: "sawtooth", f: 180, f2: 760, t, d: 0.26, v: 0.07 }); break;
    case "fireworks": {
      noise({ t, a: 0.004, d: 0.8, v: 0.6, f: 2400, f2: 90 }); tone({ type: "sine", f: 110, f2: 34, t, d: 0.7, v: 0.6 });
      for (let k = 0; k < 18; k++) {
        const at = t + 0.12 + Math.random() * 1.0;
        noise({ t: at, a: 0.001, d: 0.025 + Math.random() * 0.03, v: 0.12 + Math.random() * 0.12, type: "highpass", f: 2500 + Math.random() * 3000 });
      }
      for (const [dl, f] of [[0.16, 900], [0.3, 1100], [0.46, 800], [0.6, 1000]]) tone({ type: "sine", f, f2: f * 0.5, t: t + dl, d: 0.18, v: 0.05 });
      break;
    }
    case "ultReady": [660, 880, 1320].forEach((f, i) => tone({ type: "triangle", f, t: t + i * 0.06, d: 0.16, v: 0.09 })); break;
    case "select": tone({ type: "triangle", f: 660, f2: 990, t, d: 0.09, v: 0.1 }); break;
    case "join": [660, 880].forEach((f, i) => tone({ type: "sine", f, t: t + i * 0.09, d: 0.12, v: 0.1 })); break;
  }
}

// Map simulation events to sounds.
export function playEvents(S, events) {
  if (!ctx || !state.sfx) return;
  for (const e of events) {
    switch (e.k) {
      case "wall": sfx("wall", Math.min(1, e.sp / 900)); break;
      case "clash": sfx("clash"); break;
      case "hit":
        if (S.balls[e.i] && S.balls[e.i].type === "yosai" && !S.over && !playing["yosai-ult"] && gate("yosaiHurt", 3.2)) playSample("yosai-hurt");
        if (e.kind === "stab" || e.kind === "ustab") { /* the stab event covers it */ }
        else if (e.kind === "fireworks") { /* the fireworks event covers it */ }
        else if (e.kind === "burn" || e.kind === "drain") sfx(e.kind === "burn" ? "burn" : "drain");
        else if (e.kind === "blade") sfx("slash");
        else if (e.kind === "dash") sfx("zap");
        else if (e.kind === "magnet") sfx("clank");
        else if (e.kind === "bomb") { /* the boom covers it */ }
        else sfx("hit");
        break;
      case "block": sfx("block"); break;
      case "deflect": sfx("deflect"); break;
      case "reflect": sfx("reflect"); break;
      case "heal": sfx("heal"); break;
      case "ignite": sfx("ignite"); break;
      case "chill": sfx("chill"); break;
      case "pop": sfx("pop"); break;
      case "boom": sfx("boom"); break;
      case "ko": sfx("ko"); break;
      case "fever": sfx("fever"); break;
      case "cast": {
        if (e.kind === "yosaiUlt") {
          stopSample("yosai-hurt"); stopSample("yosai-intro");
          playSample("yosai-ult", { interrupt: true });
          sfx("fire");
          break;
        }
        const map = { archer: "arrow", bomb: "bombThrow", blade: "spin", volt: "dash", shield: "shieldUp", vampire: "beam", frost: "ice", blaze: "fire", magnet: "magnet", yosai: "lunge" };
        sfx(map[e.kind]);
        break;
      }
      case "latch": sfx("latch"); break;
      case "stab": sfx(e.ult ? "ustab" : "stab"); break;
      case "ultDash": sfx("ultDash"); break;
      case "fireworks": sfx("fireworks"); break;
      case "ultReady": sfx("ultReady"); break;
    }
  }
}

// ---------- music: a short chiptune loop ----------
const BPM = 112, STEP = 60 / BPM / 4;
// C - G - Am - F, one bar each
const CHORDS = [[261.63, 329.63, 392.0], [196.0, 246.94, 293.66], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63]];
const BASS = [65.41, 49.0, 55.0, 43.65];
let step = 0, nextT = 0, timer = null;

function scheduleStep(i, t) {
  const bar = Math.floor(i / 16) % 4, s = i % 16, ch = CHORDS[bar];
  if ([0, 3, 6, 8, 11, 14].includes(s)) tone({ type: "triangle", f: BASS[bar] * (s === 8 ? 2 : 1), t, a: 0.005, d: STEP * 1.6, v: 0.32, dest: musicBus });
  if (s % 2 === 0) {
    const n = ch[(s / 2) % 3] * (s >= 8 ? 2 : 1);
    tone({ type: "square", f: n, t, a: 0.004, d: STEP * 0.9, v: 0.05, dest: musicBus });
  }
  if (s % 4 === 2) noise({ t, a: 0.001, d: 0.04, v: 0.08, type: "highpass", f: 7000, dest: musicBus });
  if (state.intense) {
    if (s === 0 || s === 8 || s === 10) tone({ type: "sine", f: 130, f2: 45, t, a: 0.002, d: 0.16, v: 0.45, dest: musicBus });
    if (s === 4 || s === 12) noise({ t, a: 0.002, d: 0.12, v: 0.18, type: "bandpass", f: 1800, q: 0.7, dest: musicBus });
  }
}

function startMusic() {
  if (!ctx || state.musicOn) return;
  state.musicOn = true;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(0.32, ctx.currentTime, 0.4);
  nextT = ctx.currentTime + 0.1;
  timer = setInterval(() => {
    if (ctx.state !== "running") return;
    while (nextT < ctx.currentTime + 0.15) { scheduleStep(step, nextT); step++; nextT += STEP; }
  }, 30);
}

function stopMusic() {
  if (!ctx || !state.musicOn) return;
  state.musicOn = false;
  musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  clearInterval(timer); timer = null;
}
