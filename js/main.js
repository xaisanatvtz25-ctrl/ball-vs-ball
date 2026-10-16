// App shell: screens, character select, battle loop, online lobby, settings, install.
import { FIGHTERS, ORDER } from "./fighters.js";
import { createMatch, step, newSeed, DT, L, snapshot, restore, hashState, timeOf, busy as skillBusy, PH } from "./sim.js";
import { FX, drawWorld, portraitURL, Showcase, loadFaces } from "./draw.js";
import * as audio from "./audio.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const DEBUG = params.has("debug");
const IN_APP = /BallVsBallApp\//.test(navigator.userAgent);           // running inside the Android APK
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const APK_URL = "https://github.com/xaisanatvtz25-ctrl/ball-vs-ball/releases/download/apk/ball-vs-ball.apk";
const reduceMotion = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const cleanName = s => String(s || "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 12);
const fmtTime = sec => { const t = Math.floor(sec); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

// ---------------------------------------------------------------- storage
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const settings = Object.assign({ sfx: true, music: true, gravity: true, speed: 1 }, store.get("bvb-settings", {}) || {});
const saveSettings = () => store.set("bvb-settings", settings);
let wins = store.get("bvb-wins", {});
if (!wins || typeof wins !== "object") wins = {};
audio.setPrefs({ sfx: settings.sfx, music: settings.music });

for (const t of ORDER) for (const [k, url] of Object.entries(FIGHTERS[t].voice || {})) audio.registerSample(`${t}-${k}`, url);
if (document.fonts) {
  document.fonts.load('30px "Lilita One"').catch(() => {});
  document.fonts.load('600 20px "Noto Sans Lao"', "ໂຍສາຍຊອຍ").catch(() => {});
}
await loadFaces();
const IMG = {};
for (const t of ORDER) IMG[t] = portraitURL(t, 128);
const setC = (el, type) => el.style.setProperty("--c", FIGHTERS[type].ink);
const introVoice = t => { if (FIGHTERS[t].voice) audio.playSample(`${t}-intro`, { interrupt: true }); };

// ---------------------------------------------------------------- toast + modal
let toastTimer = 0;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}
function modal({ title, body, buttons }) {
  $("#modal-h").textContent = title;
  const b = $("#modal-body"); b.textContent = "";
  if (typeof body === "string") b.textContent = body; else b.append(body);
  const box = $("#modal-btns"); box.textContent = "";
  for (const bt of buttons) {
    const e = document.createElement("button");
    e.type = "button"; e.className = bt.cls || "midbtn"; e.textContent = bt.label;
    e.addEventListener("click", () => { closeModal(); if (bt.onClick) bt.onClick(); });
    box.append(e);
  }
  $("#modal").hidden = false;
  if (box.lastChild) box.lastChild.focus();
}
function closeModal() { $("#modal").hidden = true; }
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });

// ---------------------------------------------------------------- screens + back button
let current = "home";
const enter = {};
const parentOf = { select: "home", roster: "home", settings: "home", online: "home", lobby: "online", battle: "select" };
let trapArmed = false;
function armTrap() { if (!trapArmed) { history.pushState({ trap: 1 }, ""); trapArmed = true; } }

function show(name) {
  for (const s of $$(".screen")) s.hidden = s.dataset.screen !== name;
  current = name;
  if (name !== "home") armTrap();
  audio.setIntense(name === "battle");
  if (enter[name]) enter[name]();
}

try { history.replaceState({ base: 1 }, ""); } catch (e) { /* ignore */ }
armTrap();
addEventListener("popstate", () => {
  trapArmed = false;
  if (current === "home" && $("#modal").hidden) { toast("กดย้อนกลับอีกครั้งเพื่อออก"); return; }
  back();
  armTrap();
});

function back() {
  if (!$("#modal").hidden) { closeModal(); return; }
  switch (current) {
    case "home": return;
    case "battle":
      if (battle.online) { confirmLeaveOnline(); return; }
      if (battle.done || battle.paused) { stopBattle(); show("select"); return; }
      pause(true);
      return;
    case "lobby": leaveRoom(); show("online"); return;
    default: show(parentOf[current] || "home");
  }
}
$$("[data-back]").forEach(b => b.addEventListener("click", back));

document.addEventListener("pointerdown", () => audio.unlock(), { passive: true });
document.addEventListener("keydown", () => audio.unlock());
document.addEventListener("click", e => { if (e.target.closest("button")) audio.sfx("tap"); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { back(); return; }
  if (e.code === "Space" && current === "battle" && !battle.online && !/INPUT|BUTTON/.test(document.activeElement.tagName)) {
    e.preventDefault(); if (!battle.done) pause(!battle.paused);
  }
});

// ---------------------------------------------------------------- home
const showcase = new Showcase($("#showcase"));
enter.home = () => requestAnimationFrame(() => showcase.resize());
addEventListener("resize", () => { if (current === "home") { showcase.balls = []; showcase.resize(); } });
$("#btn-play").addEventListener("click", () => show("select"));
$("#btn-online").addEventListener("click", () => show("online"));
$("#btn-roster").addEventListener("click", () => show("roster"));
$("#btn-settings").addEventListener("click", () => show("settings"));

// ---------------------------------------------------------------- shared bits
function makeTile(type, onPick) {
  const f = FIGHTERS[type];
  const b = document.createElement("button");
  b.type = "button"; b.className = "tile" + (f.special ? " wide" : ""); b.dataset.type = type; setC(b, type);
  const img = document.createElement("img"); img.alt = ""; img.src = IMG[type];
  const th = document.createElement("span"); th.className = "t-th"; th.textContent = f.th;
  const en = document.createElement("span"); en.className = "t-en"; en.textContent = f.en;
  if (f.special) {
    const txt = document.createElement("span"); txt.className = "t-txt";
    const tags = document.createElement("span"); tags.className = "t-tags";
    tags.append(chip("ตัวละครพิเศษ", "chip new"), chip(f.ult ? `มี${f.ult}` : f.role, "chip role"));
    txt.append(th, en, tags);
    b.append(img, txt);
  } else b.append(img, th, en);
  b.setAttribute("aria-label", `${f.th} ${f.en}`);
  b.addEventListener("click", () => onPick(type));
  return b;
}
function chip(text, cls = "chip") { const s = document.createElement("span"); s.className = cls; s.textContent = text; return s; }
function statChips(type) {
  const f = FIGHTERS[type], box = document.createElement("div");
  box.className = "stats";
  box.append(chip(f.role, "chip role"), chip(`คูลดาวน์ ${f.cd} วิ`), chip(`ดาเมจ ${f.dmg}`), chip(`ชนะ ${wins[type] || 0}`));
  return box;
}
function ultBlock(type) {
  const f = FIGHTERS[type];
  if (!f.ult) return null;
  const box = document.createElement("div"); box.className = "ult-line";
  const h = document.createElement("b"); h.textContent = `อันติ: ${f.ult}`;
  const p = document.createElement("span"); p.textContent = `${f.ultDesc} (ดาเมจ ${f.ultDmg})`;
  box.append(h, p);
  return box;
}

// ---------------------------------------------------------------- character select
const sel = { left: null, right: null, side: "left", focus: "archer" };
const selTiles = $("#sel-tiles");
for (const t of ORDER) selTiles.append(makeTile(t, pickSelect));

function pickSelect(t) {
  sel[sel.side] = t; sel.focus = t;
  audio.sfx("select");
  introVoice(t);
  if (sel.side === "left" && !sel.right) sel.side = "right";
  else if (sel.side === "right" && !sel.left) sel.side = "left";
  renderSelect();
}
for (const side of ["left", "right"]) {
  $("#slot-" + side).addEventListener("click", () => {
    sel.side = side;
    if (sel[side]) sel.focus = sel[side];
    renderSelect();
  });
}
$("#sel-random").addEventListener("click", () => {
  const a = ORDER[Math.floor(Math.random() * ORDER.length)];
  let b; do { b = ORDER[Math.floor(Math.random() * ORDER.length)]; } while (b === a);
  sel.left = a; sel.right = b; sel.focus = b; sel.side = "right";
  audio.sfx("select");
  renderSelect();
});
$("#sel-start").addEventListener("click", () => { if (sel.left && sel.right) startLocal(sel.left, sel.right); });

function renderInfo(el, t) {
  const f = FIGHTERS[t];
  setC(el, t); el.textContent = "";
  const img = document.createElement("img"); img.alt = ""; img.src = IMG[t];
  const top = document.createElement("div"); top.className = "i-top";
  const en = document.createElement("span"); en.className = "i-en"; en.textContent = f.en;
  const th = document.createElement("span"); th.className = "i-th"; th.textContent = f.th;
  top.append(en, th);
  const sk = document.createElement("div"); sk.className = "i-skill"; sk.textContent = `สกิล: ${f.skill}`;
  const p = document.createElement("p"); p.textContent = f.desc;
  el.append(img, top, sk, statChips(t), p);
  const u = ultBlock(t); if (u) el.append(u);
}

function renderSelect() {
  for (const side of ["left", "right"]) {
    const slot = $("#slot-" + side), t = sel[side];
    slot.classList.toggle("active", sel.side === side);
    slot.classList.toggle("filled", !!t);
    const img = $("img", slot), q = $("i", slot);
    img.hidden = !t; q.hidden = !!t;
    if (t) img.src = IMG[t];
    $(".slot-name", slot).textContent = t ? FIGHTERS[t].th : "ยังไม่เลือก";
  }
  for (const tile of $$(".tile", selTiles)) {
    const t = tile.dataset.type;
    tile.classList.toggle("focus", t === sel.focus);
    $$(".badge", tile).forEach(b => b.remove());
    if (sel.left === t) tile.append(chip("1", "badge b1"));
    if (sel.right === t) tile.append(chip("2", "badge b2"));
  }
  const both = !!(sel.left && sel.right);
  $("#sel-hint").textContent = both ? "พร้อมแล้ว กดเริ่มเกมได้เลย" : `แตะลูกบอลเพื่อเลือก${sel.side === "left" ? "ฝั่งซ้าย" : "ฝั่งขวา"}`;
  $("#sel-start").disabled = !both;
  $("#sel-start-label").textContent = both ? "เริ่มเกม" : "เลือกให้ครบ 2 ลูก";
  renderInfo($("#sel-info"), sel.focus);
}
enter.select = renderSelect;

// ---------------------------------------------------------------- battle
const cv = $("#arena"), g2 = cv.getContext("2d");
function resizeArena() {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const px = Math.max(1, Math.round(r.width * dpr));
  if (cv.width !== px) { cv.width = px; cv.height = px; }
}
if (window.ResizeObserver) new ResizeObserver(resizeArena).observe(cv);

const battle = {
  S: null, fx: new FX(), online: false, paused: false, done: false, acc: 0, speed: 1,
  slowT: 0, resultAt: 0, countdown: 0, cdStep: -1, t0: 0, names: ["", ""], round: 0,
  hashes: new Map(), pending: null, hostWin: null, picks: null, resyncs: 0, lastClock: ""
};

const hud = ["#hudL", "#hudR"].map(s => {
  const el = $(s);
  return { el, img: $("img", el), en: $(".en", el), who: $(".who", el), bar: $(".bar i", el), hpn: $(".hpn", el), skt: $(".skt", el), cd: $(".cd i", el), ult: $(".ult", el), ultI: $(".ult i", el), chips: $(".chips", el), last: {} };
});

function startLocal(left, right) {
  startBattle({ left, right, seed: newSeed(), gravity: settings.gravity, online: false });
}

function startBattle({ left, right, seed, gravity, online, names, round = 0 }) {
  closeModal();
  battle.S = createMatch({ seed, left, right, gravity });
  battle.fx.reset();
  Object.assign(battle, {
    online, paused: false, done: false, acc: 0, slowT: 0, resultAt: 0, countdown: 3.0, cdStep: -1, t0: 0,
    round, pending: null, hostWin: null, picks: { left, right }, resyncs: 0, lastClock: "",
    speed: online ? 1 : settings.speed,
    names: names ? names.map(n => cleanName(n) || "ผู้เล่น") : [FIGHTERS[left].th, FIGHTERS[right].th]
  });
  battle.hashes.clear();
  battle.S.balls.forEach((b, i) => {
    const h = hud[i], f = FIGHTERS[b.type];
    h.el.style.setProperty("--c", f.ink);
    h.img.src = IMG[b.type]; h.en.textContent = f.special ? f.th : f.en;
    h.en.classList.toggle("lao", !!f.special);
    h.ult.hidden = !f.ult;
    const mine = online && room && ((room.role === "host") === (i === 0));
    h.who.textContent = online ? battle.names[i] + (mine ? " (คุณ)" : "") : (f.special ? f.en : f.th);
    h.last = {};
  });
  $("#pause-ov").hidden = true; $("#result-ov").hidden = true;
  $("#b-speed").hidden = online; $("#b-online").hidden = !online;
  if (online && room) $("#b-online").textContent = `ออนไลน์ · ห้อง ${room.code}`;
  const voiced = [left, right].find(t => FIGHTERS[t].voice);
  if (voiced) setTimeout(() => { if (battle.S && current === "battle") introVoice(voiced); }, 250);
  $("#b-pause").setAttribute("aria-label", online ? "ออกจากห้อง" : "หยุดเกม");
  syncSpeedSeg();
  syncSoundBtn();
  show("battle");
  resizeArena();
}

function stopBattle() {
  battle.S = null; battle.paused = false;
  $("#pause-ov").hidden = true; $("#result-ov").hidden = true; $("#countdown").hidden = true;
}

function pause(v) {
  if (battle.online || !battle.S) return;
  battle.paused = v;
  $("#pause-ov").hidden = !v;
  if (v) $("#p-resume").focus();
}

function showCount(i) {
  const el = $("#countdown");
  el.hidden = false;
  el.classList.toggle("go", i === 3);
  el.textContent = "";
  el.append(chip(["3", "2", "1", "สู้!"][i], ""));
  audio.sfx(i === 3 ? "go" : "count");
}

function simStep() {
  step(battle.S);
  const S = battle.S, ev = S.ev;
  S.ev = [];
  battle.fx.consume(S, ev, reduceMotion);
  audio.playEvents(S, ev);
  if (battle.online && room) {
    if (room.role === "host") {
      if (S.f % 240 === 0 && !S.over) room.sendSnap(battle.round, S.f, hashState(S), snapshot(S));
    } else {
      if (S.f % 240 === 0) {
        battle.hashes.set(S.f, hashState(S));
        if (battle.hashes.size > 12) battle.hashes.delete(battle.hashes.keys().next().value);
      }
      const p = battle.pending;
      if (p && S.f >= p.f) {
        battle.pending = null;
        if (S.f === p.f && hashState(S) !== p.h) { const R = restoreSafe(p.st); if (R) { battle.S = R; battle.resyncs++; } }
      }
    }
  }
  if (battle.S.over && !battle.done) matchOver();
}

function matchOver() {
  const S = battle.S;
  battle.done = true;
  battle.slowT = reduceMotion ? 0 : 1.0;
  battle.resultAt = performance.now() + 1700;
  const w = S.balls[S.win];
  wins[w.type] = (wins[w.type] || 0) + 1;
  store.set("bvb-wins", wins);
  if (battle.online && room) {
    if (room.role === "host") room.sendEnd(battle.round, S.win, S.f, hashState(S));
    room.matchOver();
  }
}

function fillResult() {
  const S = battle.S;
  if (!S) return;
  let win = S.win;
  if (battle.online && room && room.role === "guest" && (battle.hostWin === 0 || battle.hostWin === 1)) win = battle.hostWin;
  const w = S.balls[win], f = FIGHTERS[w.type];
  const ov = $("#result-ov");
  ov.style.setProperty("--c", f.ink);
  $("#r-orb").src = IMG[w.type];
  $("#r-name").textContent = f.special ? f.th : f.en;
  $("#r-name").classList.toggle("lao", !!f.special);
  const t = timeOf(S) > 0 ? (S.koF > 0 ? S.koF * DT : timeOf(S)) : 0;
  if (battle.online && room) {
    const iWon = (room.role === "host") === (win === 0);
    $("#r-kicker").textContent = iWon ? "คุณชนะ!" : "เพื่อนชนะ";
    $("#r-sub").textContent = `${battle.names[win]} ชนะ · สกอร์ ${room.score[0]} : ${room.score[1]}`;
  } else {
    $("#r-kicker").textContent = S.timeout ? "หมดเวลา · ผู้ชนะ" : "ผู้ชนะ";
    $("#r-sub").textContent = `${f.special ? "" : f.th + " "}ชนะ · เหลือ HP ${Math.ceil(w.hp)} · เวลา ${fmtTime(t)}`;
  }
  $("#r-local").hidden = battle.online; $("#r-online").hidden = !battle.online;
}

function showResult() {
  battle.resultAt = 0;
  fillResult();
  $("#result-ov").hidden = false;
  audio.sfx("win");
  (battle.online ? $("#r-lobby") : $("#r-again")).focus({ preventScroll: true });
}

function updateHud() {
  const S = battle.S;
  S.balls.forEach((b, i) => {
    const h = hud[i], f = FIGHTERS[b.type], hp = Math.max(0, Math.ceil(b.hp));
    if (hp !== h.last.hp) { h.bar.style.width = hp + "%"; h.hpn.textContent = hp; h.last.hp = hp; }
    const ready = b.alive ? 1 - Math.min(f.cd, Math.max(0, b.cd)) / f.cd : 0;
    const w = (ready * 100).toFixed(0) + "%";
    if (w !== h.last.cd) { h.cd.style.width = w; h.last.cd = w; }
    const txt = !b.alive ? "แพ้" : b.ph >= PH.IGNITE ? `${f.ult}!` : skillBusy(b) ? f.skill + "!" : `${f.skill} ${Math.max(0, b.cd).toFixed(1)} วิ`;
    if (txt !== h.last.txt) { h.skt.textContent = txt; h.last.txt = txt; }
    if (f.ult) {
      const u = Math.round(b.ult);
      if (u !== h.last.ult) { h.ultI.style.width = u + "%"; h.ult.classList.toggle("full", u >= 100); h.last.ult = u; }
    }
    const st = [b.chill > 0 && "หนาว", b.burn > 0 && "ติดไฟ", b.type === "shield" && b.act > 0 && "โล่", f.ult && b.ult >= 100 && b.ph === PH.IDLE && "อันติพร้อม"].filter(Boolean).join(",");
    if (st !== h.last.st) { h.chips.textContent = ""; if (st) st.split(",").forEach(c => h.chips.append(chip(c, ""))); h.last.st = st; }
  });
  const clock = fmtTime(S.over && S.koF > 0 ? S.koF * DT : timeOf(S));
  if (clock !== battle.lastClock) { $("#b-clock").textContent = clock; battle.lastClock = clock; }
}

function render() {
  const w = cv.width, k = w / L, fx = battle.fx;
  let sx = 0, sy = 0;
  if (fx.shake > 0 && !reduceMotion) { sx = (Math.random() * 2 - 1) * fx.shake; sy = (Math.random() * 2 - 1) * fx.shake; }
  g2.setTransform(1, 0, 0, 1, 0, 0);
  g2.clearRect(0, 0, w, w);
  g2.setTransform(k, 0, 0, k, sx * k, sy * k);
  const S = battle.S;
  drawWorld(g2, S, fx, { markers: battle.online || S.balls[0].type === S.balls[1].type });
}

function battleFrame(dt, now) {
  if (battle.countdown > 0 && !battle.paused) {
    battle.countdown -= dt;
    const idx = Math.min(3, Math.floor((3.0 - battle.countdown) / 0.75));
    if (idx !== battle.cdStep) { battle.cdStep = idx; showCount(idx); }
    if (battle.countdown <= 0.75 && !battle.t0) battle.t0 = now;
    if (battle.countdown <= 0) $("#countdown").hidden = true;
  }
  const running = battle.t0 > 0 && !battle.paused;
  if (running) {
    if (battle.online && !battle.S.over) {
      const target = Math.floor((now - battle.t0) / 1000 / DT);
      let n = 0;
      while (battle.S && battle.S.f < target && n < 900 && !battle.S.over) { simStep(); n++; }
    } else {
      const scale = battle.slowT > 0 ? 0.3 : 1;
      battle.acc += dt * battle.speed * scale;
      let n = 0;
      while (battle.acc >= DT && n < 60) { simStep(); battle.acc -= DT; n++; }
      if (n >= 60) battle.acc = 0;
    }
  }
  if (!battle.S) return;
  if (battle.slowT > 0) battle.slowT -= dt;
  battle.fx.update(battle.paused ? 0 : dt * (battle.slowT > 0 ? 0.5 : 1), battle.S);
  if (battle.resultAt && now >= battle.resultAt) showResult();
  render();
  updateHud();
}

$("#b-pause").addEventListener("click", () => { if (battle.online) confirmLeaveOnline(); else if (!battle.done) pause(!battle.paused); });
$("#p-resume").addEventListener("click", () => pause(false));
$("#p-restart").addEventListener("click", () => startLocal(battle.picks.left, battle.picks.right));
$("#p-change").addEventListener("click", () => { stopBattle(); show("select"); });
$("#p-home").addEventListener("click", () => { stopBattle(); show("home"); });
$("#r-again").addEventListener("click", () => startLocal(battle.picks.left, battle.picks.right));
$("#r-change").addEventListener("click", () => { stopBattle(); show("select"); });
$("#r-home").addEventListener("click", () => { stopBattle(); show("home"); });
$("#r-lobby").addEventListener("click", () => { stopBattle(); if (room) show("lobby"); else show("online"); });
$("#r-leave").addEventListener("click", () => { stopBattle(); leaveRoom(); show("online"); });

function syncSpeedSeg() {
  for (const b of $$("#b-speed button")) b.setAttribute("aria-pressed", String(Number(b.dataset.sp) === battle.speed));
}
for (const b of $$("#b-speed button")) b.addEventListener("click", () => { battle.speed = Number(b.dataset.sp); syncSpeedSeg(); });

function syncSoundBtn() {
  const on = settings.sfx || settings.music;
  $("#b-sound use").setAttribute("href", on ? "#i-sound" : "#i-mute");
  $("#b-sound").setAttribute("aria-label", on ? "ปิดเสียง" : "เปิดเสียง");
}
$("#b-sound").addEventListener("click", () => {
  const on = !(settings.sfx || settings.music);
  settings.sfx = on; settings.music = on; saveSettings();
  audio.setPrefs({ sfx: on, music: on });
  syncSoundBtn();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && current === "battle" && battle.S && !battle.online && !battle.done && battle.t0) pause(true);
});

// ---------------------------------------------------------------- roster
enter.roster = () => {
  const box = $("#roster");
  box.textContent = "";
  for (const t of ORDER) {
    const f = FIGHTERS[t], c = document.createElement("article");
    c.className = "rcard"; setC(c, t);
    const top = document.createElement("div"); top.className = "top";
    const img = document.createElement("img"); img.alt = ""; img.src = IMG[t];
    const names = document.createElement("div");
    const en = document.createElement("div"); en.className = "en"; en.textContent = f.en;
    const th = document.createElement("div"); th.className = "th"; th.textContent = f.th;
    names.append(en, th); top.append(img, names);
    const sk = document.createElement("div"); sk.className = "sk"; sk.textContent = `สกิล: ${f.skill}`;
    const p = document.createElement("p"); p.textContent = f.desc;
    c.append(top, sk, p);
    const u = ultBlock(t); if (u) c.append(u);
    c.append(statChips(t));
    if (f.special) c.classList.add("special");
    box.append(c);
  }
};

// ---------------------------------------------------------------- settings
function syncSettings() {
  $("#set-sfx").checked = settings.sfx;
  $("#set-music").checked = settings.music;
  $("#set-grav").checked = settings.gravity;
  for (const b of $$("#set-speed button")) b.setAttribute("aria-pressed", String(Number(b.dataset.sp) === settings.speed));
}
enter.settings = syncSettings;
$("#set-sfx").addEventListener("change", e => { settings.sfx = e.target.checked; saveSettings(); audio.setPrefs({ sfx: settings.sfx }); });
$("#set-music").addEventListener("change", e => { settings.music = e.target.checked; saveSettings(); audio.unlock(); audio.setPrefs({ music: settings.music }); });
$("#set-grav").addEventListener("change", e => { settings.gravity = e.target.checked; saveSettings(); });
for (const b of $$("#set-speed button")) b.addEventListener("click", () => { settings.speed = Number(b.dataset.sp); saveSettings(); syncSettings(); });
$("#set-reset").addEventListener("click", () => modal({
  title: "ล้างสถิติชนะ?", body: "จำนวนครั้งที่แต่ละลูกชนะจะกลับเป็น 0",
  buttons: [{ label: "ยกเลิก" }, { label: "ล้างสถิติ", cls: "midbtn", onClick: () => { wins = {}; store.set("bvb-wins", wins); toast("ล้างสถิติแล้ว"); } }]
}));

// ---------------------------------------------------------------- install (PWA)
let deferredPrompt = null;
const isStandalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
function updateInstall() {
  for (const b of $$("[data-install]")) b.hidden = isStandalone() || IN_APP;
  for (const b of $$("[data-apk]")) b.hidden = IN_APP || IS_IOS;
}
function downloadApk() {
  const a = document.createElement("a");
  a.href = APK_URL; a.rel = "noopener";
  document.body.append(a); a.click(); a.remove();
  toast("กำลังดาวน์โหลด ball-vs-ball.apk");
}
for (const b of $$("[data-apk]")) b.addEventListener("click", downloadApk);
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; updateInstall(); });
addEventListener("appinstalled", () => { deferredPrompt = null; updateInstall(); toast("ติดตั้งแอปแล้ว เปิดจากหน้าจอหลักได้เลย"); });
function installHelp() {
  const box = document.createElement("div");
  const ol = document.createElement("ol");
  const steps = IS_IOS
    ? ["เปิดหน้านี้ใน Safari", "กดปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น)", "เลือก “เพิ่มไปยังหน้าจอโฮม”"]
    : ["เปิดหน้านี้ใน Google Chrome", "กดปุ่มเมนู ⋮ มุมขวาบน", "เลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก”"];
  for (const s of steps) { const li = document.createElement("li"); li.textContent = s; ol.append(li); }
  box.append(ol);
  const buttons = [{ label: "เข้าใจแล้ว", cls: "bigbtn gold wide" }];
  if (!IS_IOS) {
    const p = document.createElement("p");
    p.className = "apk-note";
    p.textContent = "หรือดาวน์โหลดไฟล์ APK ไว้ติดตั้งหรือส่งให้เพื่อน (เฉพาะ Android)";
    box.append(p);
    buttons.unshift({ label: "ดาวน์โหลด APK", cls: "midbtn", onClick: downloadApk });
  }
  modal({ title: "ติดตั้ง Ball vs Ball", body: box, buttons });
}
for (const b of $$("[data-install]")) b.addEventListener("click", async () => {
  if (deferredPrompt) {
    const p = deferredPrompt; deferredPrompt = null;
    try { await p.prompt(); await p.userChoice; } catch (e) { installHelp(); }
  } else installHelp();
});
updateInstall();
if ("serviceWorker" in navigator && window.isSecureContext && !params.has("nosw") && !IN_APP) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// ---------------------------------------------------------------- online
let room = null, netMod = null;
const loadNet = async () => netMod || (netMod = await import("./net.js"));
function setStatus(msg, err = false) { const el = $("#on-status"); el.textContent = msg; el.classList.toggle("err", err); }
function busy(v) { $("#on-create").disabled = v; $("#on-join").disabled = v; }

enter.online = () => {
  const n = $("#on-name");
  if (!n.value) n.value = store.get("bvb-name", "") || "ผู้เล่น" + (100 + Math.floor(Math.random() * 900));
  busy(false);
};
$("#on-code").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 5); });

function readName() {
  const name = cleanName($("#on-name").value);
  if (!name) { setStatus("ใส่ชื่อก่อนนะ", true); $("#on-name").focus(); return null; }
  store.set("bvb-name", name);
  return name;
}

const roomHandlers = {
  status(n) { $("#lb-conn").classList.toggle("up", n > 0); },
  lobby() { if (current === "lobby") renderLobby(); },
  start(info) { startOnline(info); },
  snap(m) { onSnap(m); },
  end(m) { onHostEnd(m); },
  left(reason) {
    room = null;
    if (current === "battle") stopBattle();
    closeModal();
    show("online");
    setStatus(reason === "host-left" ? "เจ้าของห้องออกจากห้องแล้ว" : "การเชื่อมต่อกับเจ้าของห้องหลุด", true);
  },
  notice(text, kind) { toast(text); if (kind === "join") audio.sfx("join"); }
};

async function openRoom(join) {
  const name = readName();
  if (!name) return;
  let code = "";
  if (join) {
    code = $("#on-code").value.trim();
    if (!/^\d{5}$/.test(code)) { setStatus("รหัสห้องต้องเป็นตัวเลข 5 หลัก", true); $("#on-code").focus(); return; }
  }
  busy(true);
  setStatus("กำลังเชื่อมต่อเซิร์ฟเวอร์…");
  try {
    const { Room } = await loadNet();
    if (room) { room.leave(true); room = null; }
    room = new Room(roomHandlers);
    const ok = await room.connect();
    if (!ok) throw new Error("offline");
    if (join) { setStatus("กำลังหาห้อง…"); await room.join(name, code); audio.sfx("join"); }
    else room.host(name);
    setStatus("");
    show("lobby");
  } catch (e) {
    if (room) { room.leave(true); room = null; }
    const msg = { offline: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่", notfound: "ไม่พบห้องนี้ ตรวจรหัสอีกครั้ง หรือให้เพื่อนเปิดห้องค้างไว้", full: "ห้องนี้มีคนเล่นครบ 2 คนแล้ว" }[e.message] || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    setStatus(msg, true);
  } finally {
    busy(false);
  }
}
$("#on-create").addEventListener("click", () => openRoom(false));
$("#on-join").addEventListener("click", () => openRoom(true));
$("#on-code").addEventListener("keydown", e => { if (e.key === "Enter") openRoom(true); });

const lbTiles = $("#lb-tiles");
for (const t of ORDER) lbTiles.append(makeTile(t, t2 => {
  if (!room) return;
  room.setPick(t2);
  if (room.me.ready) room.setReady(false);
  audio.sfx("select");
  introVoice(t2);
  renderLobby();
}));

function playerRow(p) {
  const row = document.createElement("div");
  row.className = "prow";
  row.style.setProperty("--sc", p.side === 0 ? "var(--p1)" : "var(--p2)");
  let pic;
  if (p.present && p.pick) { pic = document.createElement("img"); pic.alt = ""; pic.src = IMG[p.pick]; }
  else { pic = document.createElement("span"); pic.className = "empty"; }
  const pn = document.createElement("div"); pn.className = "pn";
  const b = document.createElement("b");
  if (p.host) b.insertAdjacentHTML("afterbegin", '<svg aria-hidden="true"><use href="#i-crown"/></svg>');
  b.append(document.createTextNode(p.present ? (p.name || "ผู้เล่น") + (p.me ? " (คุณ)" : "") : "รอเพื่อนเข้าห้อง…"));
  const small = document.createElement("small");
  small.textContent = !p.present ? (p.side === 0 ? "ฝั่งซ้าย" : "ฝั่งขวา") : `${p.side === 0 ? "ฝั่งซ้าย" : "ฝั่งขวา"} · ${p.pick ? FIGHTERS[p.pick].th : "ยังไม่เลือกบอล"}`;
  pn.append(b, small);
  const st = document.createElement("span");
  st.className = "state" + (p.present && p.ready ? " ok" : "");
  st.textContent = !p.present ? "ว่าง" : p.ready ? "พร้อม" : "ยังไม่พร้อม";
  row.append(pic, pn, st);
  return row;
}

function renderLobby() {
  if (!room) return;
  $("#lb-code").textContent = room.code;
  $("#lb-conn").classList.toggle("up", room.connected);
  const host = room.role === "host", peer = room.peer;
  const meP = { name: room.me.name, pick: room.me.pick, ready: room.me.ready, me: true, present: true };
  const peerP = { name: peer && peer.name, pick: peer && peer.pick, ready: peer && peer.ready, me: false, present: !!peer };
  const left = host ? meP : peerP, right = host ? peerP : meP;
  left.side = 0; right.side = 1; left.host = true;
  const box = $("#lb-players"); box.textContent = "";
  box.append(playerRow(left), playerRow(right));
  const sc = $("#lb-score"); sc.textContent = "สกอร์ ";
  const b = document.createElement("b"); b.textContent = `${room.score[0]} : ${room.score[1]}`; sc.append(b);
  for (const tile of $$(".tile", lbTiles)) tile.classList.toggle("mine", tile.dataset.type === room.me.pick);
  const btn = $("#lb-ready"), label = $("#lb-ready-label"), msg = $("#lb-msg");
  btn.disabled = !room.me.pick || !peer;
  label.textContent = !room.me.pick ? "เลือกบอลก่อน" : !peer ? "รอเพื่อนเข้าห้อง" : room.me.ready ? "ยกเลิกพร้อม" : "พร้อม!";
  msg.textContent = !peer ? "ส่งรหัสห้องให้เพื่อน แล้วรอเพื่อนเข้ามา"
    : !room.me.pick ? "เลือกบอลของคุณด้านล่าง"
    : !room.me.ready ? "เลือกเสร็จแล้วกดพร้อม"
    : !peer.ready ? `รอ ${peer.name} กดพร้อม`
    : "กำลังเริ่มเกม…";
}
enter.lobby = renderLobby;

$("#lb-ready").addEventListener("click", () => { if (room) { room.setReady(!room.me.ready); renderLobby(); } });
async function copyCode() {
  if (!room) return;
  try { await navigator.clipboard.writeText(room.code); toast("คัดลอกรหัสห้องแล้ว"); }
  catch (e) { toast(`รหัสห้อง ${room.code}`); }
}
$("#lb-copy").addEventListener("click", copyCode);
$("#lb-share").addEventListener("click", async () => {
  if (!room) return;
  const text = `มาเล่น Ball vs Ball กัน! รหัสห้อง ${room.code}`;
  if (navigator.share) {
    try { await navigator.share({ title: "Ball vs Ball", text, url: location.origin + location.pathname }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  copyCode();
});

function leaveRoom() { if (room) { room.leave(); room = null; } }
addEventListener("pagehide", () => { if (room) room.leave(); });

function confirmLeaveOnline() {
  modal({
    title: "ออกจากห้อง?", body: "เกมนี้จะจบ และเพื่อนจะเห็นว่าคุณออกจากห้องแล้ว",
    buttons: [{ label: "อยู่ต่อ" }, { label: "ออกจากห้อง", onClick: () => { stopBattle(); leaveRoom(); show("online"); } }]
  });
}

function startOnline(info) {
  startBattle({ left: info.left, right: info.right, seed: info.seed, gravity: info.gravity !== false, online: true, names: [info.leftName, info.rightName], round: info.r });
}

function restoreSafe(st) {
  try {
    const S = restore(st);
    if (!S || !Array.isArray(S.balls) || S.balls.length !== 2 || !S.balls.every(b => FIGHTERS[b.type])) return null;
    if (!Array.isArray(S.proj) || !Array.isArray(S.bombs) || !Array.isArray(S.fires)) return null;
    return S;
  } catch (e) { return null; }
}

function onSnap(m) {
  if (!battle.online || !battle.S || m.r !== battle.round || typeof m.f !== "number") return;
  const S = battle.S;
  if (S.f === m.f) {
    if (hashState(S) !== m.h) { const R = restoreSafe(m.st); if (R) { battle.S = R; battle.resyncs++; } }
  } else if (S.f > m.f) {
    if (battle.hashes.get(m.f) === m.h) return;
    const R = restoreSafe(m.st);
    if (!R) return;
    while (R.f < S.f) { step(R); R.ev.length = 0; }
    battle.S = R; battle.resyncs++;
  } else {
    battle.pending = m;
  }
}

function onHostEnd(m) {
  if (!battle.online || m.r !== battle.round) return;
  if (m.win === 0 || m.win === 1) battle.hostWin = m.win;
  if (!$("#result-ov").hidden) fillResult();
}

// ---------------------------------------------------------------- loop
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  if (current === "home") showcase.frame(dt);
  else if (current === "battle" && battle.S) battleFrame(dt, now);
  requestAnimationFrame(frame);
}
show("home");
requestAnimationFrame(frame);

if (DEBUG) window.__bvb = { battle, sel, show, startLocal, hashState, get room() { return room; }, get current() { return current; } };
