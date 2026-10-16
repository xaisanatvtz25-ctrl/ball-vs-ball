// Canvas drawing: arena, balls, skills and visual effects.
// Visual randomness (Math.random) is fine here: none of it feeds back into the fight.
import { FIGHTERS, ORDER } from "./fighters.js";
import { L, LO, HI, BL, P } from "./sim.js";

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const DISPLAY = '"Lilita One", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
export const BODY = '"Kanit", "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif';

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }

// ---------------------------------------------------------------- arena
export function drawArena(ctx, fever = 0) {
  ctx.fillStyle = "#08122b";
  ctx.fillRect(-40, -40, L + 80, L + 80);
  const g = ctx.createLinearGradient(0, LO, 0, HI);
  g.addColorStop(0, "#1e3463"); g.addColorStop(1, "#132650");
  ctx.fillStyle = g;
  ctx.fillRect(LO, LO, HI - LO, HI - LO);
  ctx.strokeStyle = "rgba(255,255,255,0.035)"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let p = LO + 48; p < HI; p += 48) { ctx.moveTo(p, LO); ctx.lineTo(p, HI); ctx.moveTo(LO, p); ctx.lineTo(HI, p); }
  ctx.stroke();
  if (fever > 0) {
    const fg = ctx.createRadialGradient(L / 2, L / 2, L * 0.25, L / 2, L / 2, L * 0.72);
    fg.addColorStop(0, "rgba(255,60,40,0)"); fg.addColorStop(1, `rgba(255,70,40,${0.28 * fever})`);
    ctx.fillStyle = fg; ctx.fillRect(LO, LO, HI - LO, HI - LO);
  }
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.moveTo(LO, LO); ctx.lineTo(HI, LO); ctx.lineTo(HI - 10, LO + 10); ctx.lineTo(LO + 10, LO + 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath(); ctx.moveTo(LO, LO); ctx.lineTo(LO + 10, LO + 10); ctx.lineTo(LO + 10, HI - 10); ctx.lineTo(LO, HI); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath(); ctx.moveTo(LO, HI); ctx.lineTo(LO + 10, HI - 10); ctx.lineTo(HI - 10, HI - 10); ctx.lineTo(HI, HI); ctx.closePath(); ctx.fill();
}

// ---------------------------------------------------------------- glyphs
function glyph(ctx, type, s, spin = 0) {
  const f = FIGHTERS[type];
  const c = type === "bomb" || type === "magnet" || type === "vampire" ? "#ffffff" : f.edge;
  ctx.strokeStyle = c; ctx.fillStyle = c;
  ctx.lineWidth = 4 * s; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.save(); ctx.scale(s, s);
  switch (type) {
    case "archer":
      ctx.beginPath(); ctx.moveTo(-15, 15); ctx.lineTo(11, -11); ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(17, -17); ctx.lineTo(2, -14); ctx.lineTo(14, -2); ctx.closePath(); ctx.fill();
      break;
    case "bomb":
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; circle(ctx, Math.cos(a) * 24.5, Math.sin(a) * 24.5, 2.4); ctx.fill(); }
      break;
    case "blade":
      ctx.rotate(spin);
      for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(5, -26); ctx.lineTo(4, -6); ctx.closePath(); ctx.fill(); }
      break;
    case "volt":
      ctx.beginPath(); ctx.moveTo(5, -23); ctx.lineTo(-11, 3); ctx.lineTo(0, 3); ctx.lineTo(-5, 23); ctx.lineTo(11, -3); ctx.lineTo(0, -3); ctx.closePath(); ctx.fill();
      break;
    case "shield":
      ctx.beginPath(); ctx.moveTo(-15, -17); ctx.lineTo(15, -17); ctx.lineTo(15, 0);
      ctx.quadraticCurveTo(15, 14, 0, 21); ctx.quadraticCurveTo(-15, 14, -15, 0); ctx.closePath();
      ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 15); ctx.moveTo(-10, -3); ctx.lineTo(10, -3); ctx.lineWidth = 3; ctx.stroke();
      break;
    case "vampire":
      ctx.beginPath(); ctx.moveTo(-16, -4); ctx.quadraticCurveTo(0, 8, 16, -4); ctx.lineWidth = 3.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 0.5); ctx.lineTo(-3, 2.5); ctx.lineTo(-5.5, 13); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, 0.5); ctx.lineTo(3, 2.5); ctx.lineTo(5.5, 13); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(-5, -9); ctx.moveTo(15, -12); ctx.lineTo(5, -9); ctx.lineWidth = 3; ctx.stroke();
      break;
    case "frost":
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        ctx.save(); ctx.rotate(k * Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 22);
        for (const e of [-1, 1]) { ctx.moveTo(0, e * 14); ctx.lineTo(-6, e * 20); ctx.moveTo(0, e * 14); ctx.lineTo(6, e * 20); }
        ctx.stroke(); ctx.restore();
      }
      break;
    case "blaze":
      ctx.beginPath(); ctx.moveTo(2, -24);
      ctx.bezierCurveTo(4, -14, 15, -8, 14, 4); ctx.bezierCurveTo(13, 15, 6, 21, 0, 21);
      ctx.bezierCurveTo(-7, 21, -14, 15, -14, 6); ctx.bezierCurveTo(-14, -2, -10, -7, -7, -12);
      ctx.bezierCurveTo(-7, -5, -5, -2, -2, -1); ctx.bezierCurveTo(-4, -9, -2, -17, 2, -24);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = FIGHTERS.blaze.body;
      ctx.beginPath(); ctx.moveTo(0, 3); ctx.bezierCurveTo(3, 8, 7, 10, 6, 14); ctx.bezierCurveTo(5, 18, 2, 20, 0, 20);
      ctx.bezierCurveTo(-3, 20, -6, 17, -6, 14); ctx.bezierCurveTo(-6, 10, -2, 8, 0, 3); ctx.closePath(); ctx.fill();
      break;
    case "magnet":
      ctx.lineWidth = 6; ctx.lineCap = "butt";
      ctx.beginPath(); ctx.moveTo(-11, -15); ctx.lineTo(-11, 2); ctx.arc(0, 2, 11, Math.PI, 0, true); ctx.lineTo(11, -15); ctx.stroke();
      break;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- ball body
export function drawBallBody(ctx, type, x, y, r, opt = {}) {
  const f = FIGHTERS[type];
  ctx.save();
  ctx.translate(x, y);
  if (opt.glow) { ctx.shadowColor = f.body; ctx.shadowBlur = opt.glow; }
  if (f.body2) {
    ctx.fillStyle = f.body; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = f.body2; ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = f.body; circle(ctx, 0, 0, r); ctx.fill();
  }
  ctx.shadowBlur = 0;
  const hl = ctx.createRadialGradient(-r * 0.38, -r * 0.42, 1, -r * 0.2, -r * 0.2, r * 1.05);
  hl.addColorStop(0, "rgba(255,255,255,0.5)"); hl.addColorStop(0.45, "rgba(255,255,255,0.08)"); hl.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = hl; circle(ctx, 0, 0, r); ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.11); ctx.strokeStyle = f.edge; circle(ctx, 0, 0, r - ctx.lineWidth / 2); ctx.stroke();
  ctx.globalAlpha = opt.glyphAlpha ?? 0.3;
  glyph(ctx, type, r / 36, opt.spin || 0);
  ctx.globalAlpha = 1;
  if (type === "bomb") {
    const a = -Math.PI / 4, cx = Math.cos(a) * (r - 2), cy = Math.sin(a) * (r - 2), s = r / 36;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a + Math.PI / 2); ctx.scale(s, s);
    ctx.fillStyle = "#2a3142"; ctx.fillRect(-7, -9, 14, 9);
    ctx.strokeStyle = "#c9a36a"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(6, -16, 2, -21); ctx.stroke();
    if (opt.spark) { ctx.fillStyle = "#ffcf5a"; ctx.shadowColor = "#ff9a3c"; ctx.shadowBlur = 12; circle(ctx, 2, -22, 4); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}

const portraitCache = new Map();
export function portrait(type, size = 128) {
  const key = type + size;
  if (portraitCache.has(key)) return portraitCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const r = size * 0.44;
  drawBallBody(ctx, type, size / 2, size / 2, r, { glyphAlpha: 0.95, spin: 0.3, spark: true });
  portraitCache.set(key, c);
  return c;
}
export function portraitURL(type, size = 128) { return portrait(type, size).toDataURL("image/png"); }

// ---------------------------------------------------------------- skill overlays
function drawBlades(ctx, b) {
  const fade = Math.min(1, b.act / 0.3);
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.globalAlpha = 0.14 * fade; ctx.strokeStyle = FIGHTERS.blade.body; ctx.lineWidth = BL - 6;
  circle(ctx, 0, 0, b.r + BL / 2 + 1); ctx.stroke();
  ctx.globalAlpha = fade;
  for (let k = 0; k < 3; k++) {
    ctx.save(); ctx.rotate(b.spinA + k * TAU / 3);
    ctx.beginPath();
    ctx.moveTo(b.r + 2, -7);
    ctx.quadraticCurveTo(b.r + BL * 0.6, -11, b.r + BL, 0);
    ctx.quadraticCurveTo(b.r + BL * 0.5, 2, b.r + 2, 7);
    ctx.closePath();
    ctx.fillStyle = "#eef2fb"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = FIGHTERS.blade.edge; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawShield(ctx, b, t) {
  const a = Math.min(1, b.act / 0.25), pulse = 0.5 + 0.5 * Math.sin(t * 14);
  const R2 = b.r + 14;
  ctx.save();
  ctx.globalAlpha = 0.16 * a; ctx.fillStyle = "#7dffc9"; circle(ctx, b.x, b.y, R2); ctx.fill();
  ctx.globalAlpha = (0.65 + 0.35 * pulse) * a; ctx.lineWidth = 4; ctx.strokeStyle = "#7dffc9";
  circle(ctx, b.x, b.y, R2); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = "#e9fff6";
  for (let k = 0; k < 3; k++) {
    const s = t * 3 + k * TAU / 3;
    ctx.beginPath(); ctx.arc(b.x, b.y, R2 - 5, s, s + 0.7); ctx.stroke();
  }
  ctx.restore();
}

function drawChill(ctx, b, t) {
  const a = Math.min(1, b.chill / 0.3);
  ctx.save();
  ctx.globalAlpha = 0.38 * a; ctx.fillStyle = "#c8efff"; circle(ctx, b.x, b.y, b.r); ctx.fill();
  ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = "#e8f8ff"; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 20;
  circle(ctx, b.x, b.y, b.r + 5); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

function flame(ctx, x, y, s, rot, c1, c2) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = c1;
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.bezierCurveTo(7, -6, 10, 0, 7, 6); ctx.bezierCurveTo(4, 11, -4, 11, -7, 6); ctx.bezierCurveTo(-10, 0, -5, -5, 0, -16); ctx.fill();
  ctx.fillStyle = c2; ctx.scale(0.55, 0.6); ctx.translate(0, 4);
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.bezierCurveTo(7, -6, 10, 0, 7, 6); ctx.bezierCurveTo(4, 11, -4, 11, -7, 6); ctx.bezierCurveTo(-10, 0, -5, -5, 0, -16); ctx.fill();
  ctx.restore();
}

function drawBurn(ctx, b) {
  const a = Math.min(1, b.burn / 0.3);
  ctx.save(); ctx.globalAlpha = a;
  for (const ang of [-2.3, -1.57, -0.85]) {
    const x = b.x + Math.cos(ang) * (b.r - 4), y = b.y + Math.sin(ang) * (b.r - 4);
    flame(ctx, x, y, rand(0.85, 1.25), ang + Math.PI / 2, "#ff6a1a", "#ffd25a");
  }
  ctx.restore();
}

function drawBeam(ctx, v, o, t) {
  const dx = o.x - v.x, dy = o.y - v.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const fade = Math.min(1, v.act / 0.2);
  ctx.save();
  ctx.globalAlpha = fade; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [w, col, amp] of [[10, "rgba(160,60,255,0.25)", 9], [4, "#d07bff", 7], [2, "#ffd6ff", 4]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const s = k / 16, off = Math.sin(s * 10 - t * 22) * amp * Math.sin(s * Math.PI);
      const x = v.x + dx * s + nx * off, y = v.y + dy * s + ny * off;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawMagnetField(ctx, m, o, t) {
  const fade = Math.min(1, m.act / 0.2);
  ctx.save(); ctx.globalAlpha = 0.85 * fade;
  ctx.setLineDash([10, 10]); ctx.lineDashOffset = t * 60; ctx.lineWidth = 3;
  const dx = o.x - m.x, dy = o.y - m.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  for (const [k, col] of [[-1, "#ff6b81"], [0, "#ffffff"], [1, "#7aa2ff"]]) {
    ctx.strokeStyle = col; ctx.beginPath();
    ctx.moveTo(m.x + nx * k * 14, m.y + ny * k * 14);
    ctx.quadraticCurveTo((m.x + o.x) / 2 + nx * k * 40, (m.y + o.y) / 2 + ny * k * 40, o.x + nx * k * 10, o.y + ny * k * 10);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  const rr = m.r + 10 + ((t * 80) % 40);
  ctx.globalAlpha = fade * (1 - ((t * 80) % 40) / 40); ctx.strokeStyle = "#ffb3c0"; ctx.lineWidth = 3;
  circle(ctx, o.x, o.y, o.r + 40 - ((t * 80) % 40)); ctx.stroke();
  ctx.restore();
  void rr;
}

function drawFires(ctx, fires, t) {
  for (const fl of fires) {
    const a = Math.min(1, fl.life / 0.5) * Math.min(1, (P.blaze.life - fl.life) / 0.15 + 0.2);
    const r = fl.r * (0.85 + 0.15 * Math.sin(t * 20 + fl.x));
    const g = ctx.createRadialGradient(fl.x, fl.y, 1, fl.x, fl.y, r * 1.3);
    g.addColorStop(0, `rgba(255,230,120,${0.9 * a})`); g.addColorStop(0.45, `rgba(255,120,30,${0.7 * a})`); g.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = g; circle(ctx, fl.x, fl.y, r * 1.3); ctx.fill();
  }
}

function drawBombs(ctx, bombs, t) {
  for (const bm of bombs) {
    if (bm.fuse < 0.4) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 50);
      ctx.fillStyle = "#ff5a3c"; circle(ctx, bm.x, bm.y, bm.r + 6); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#1c2232"; circle(ctx, bm.x, bm.y, bm.r); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#05080f"; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)"; circle(ctx, bm.x - 4, bm.y - 4, 3); ctx.fill();
    ctx.strokeStyle = "#c9a36a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bm.x + 6, bm.y - 8); ctx.quadraticCurveTo(bm.x + 12, bm.y - 12, bm.x + 10, bm.y - 17); ctx.stroke();
    if (Math.sin(t * (bm.fuse < 0.4 ? 60 : 24)) > -0.2) {
      ctx.save(); ctx.fillStyle = "#ffd36a"; ctx.shadowColor = "#ff9a3c"; ctx.shadowBlur = 12;
      circle(ctx, bm.x + 10, bm.y - 18, 3.5); ctx.fill(); ctx.restore();
    }
  }
}

function drawProjectiles(ctx, proj) {
  for (const p of proj) {
    const s = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / s, uy = p.vy / s;
    const len = Math.min(p.k === "arrow" ? 140 : 70, Math.hypot(p.x - p.sx, p.y - p.sy));
    const tx = p.x - ux * len, ty = p.y - uy * len;
    const tail = p.k === "arrow" ? "120,220,255" : "210,245,255";
    const g = ctx.createLinearGradient(tx, ty, p.x, p.y);
    g.addColorStop(0, `rgba(${tail},0)`); g.addColorStop(1, `rgba(${tail},0.55)`);
    ctx.strokeStyle = g; ctx.lineWidth = p.k === "arrow" ? 4 : 3;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.save();
    if (p.k === "arrow") {
      ctx.shadowColor = "#3fc6ff"; ctx.shadowBlur = 14;
      ctx.strokeStyle = "#c8f3ff"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x - ux * 30, p.y - uy * 30); ctx.lineTo(p.x - ux * 6, p.y - uy * 6); ctx.stroke();
      ctx.fillStyle = "#effcff";
      ctx.beginPath(); ctx.moveTo(p.x + ux * 7, p.y + uy * 7);
      ctx.lineTo(p.x - ux * 10 - uy * 7, p.y - uy * 10 + ux * 7);
      ctx.lineTo(p.x - ux * 10 + uy * 7, p.y - uy * 10 - ux * 7);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.shadowColor = "#a6e3ff"; ctx.shadowBlur = 12;
      ctx.fillStyle = "#f2fbff"; ctx.strokeStyle = "#5aaee0"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x + ux * 12, p.y + uy * 12);
      ctx.lineTo(p.x - uy * 5, p.y + ux * 5);
      ctx.lineTo(p.x - ux * 9, p.y - uy * 9);
      ctx.lineTo(p.x + uy * 5, p.y - ux * 5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- effects
export class FX {
  constructor() { this.reset(); }
  reset() {
    this.parts = []; this.rings = []; this.texts = []; this.bolts = [];
    this.trails = [[], []]; this.flash = [0, 0]; this.shake = 0; this.banner = null; this.t = 0; this.fever = 0;
  }
  burst(x, y, color, n, spd, size, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(spd * 0.3, spd), life = rand(0.25, 0.6);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life, max: life, color, size: rand(size * 0.6, size * 1.3) });
    }
  }
  ring(x, y, r0, r1, life, color, width, fill = false) { this.rings.push({ x, y, r0, r1, life, max: life, color, width, fill }); }
  text(x, y, txt, color, big = false, thai = false) { this.texts.push({ x, y, txt, color, life: big ? 1.1 : 0.9, big, thai }); }
  bolt(x1, y1, x2, y2, color) {
    const pts = [], n = 7, dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, px = -dy / d, py = dx / d;
    for (let i = 0; i <= n; i++) { const t = i / n, off = i === 0 || i === n ? 0 : rand(-12, 12); pts.push([x1 + dx * t + px * off, y1 + dy * t + py * off]); }
    this.bolts.push({ pts, life: 0.22, max: 0.22, color });
  }
  show(txt, sub, color, life = 1.6) { this.banner = { txt, sub, color, life, max: life }; }

  consume(S, events, reduceMotion) {
    const B = S.balls;
    for (const e of events) {
      switch (e.k) {
        case "wall": {
          const b = B[e.i];
          const d = [b.x - LO, HI - b.x, b.y - LO, HI - b.y], m = d.indexOf(Math.min(...d));
          const x = m === 0 ? LO : m === 1 ? HI : b.x, y = m === 2 ? LO : m === 3 ? HI : b.y;
          if (e.sp > 260) this.burst(x, y, "rgba(170,195,255,0.9)", 3, 90, 2);
          break;
        }
        case "clash":
          this.burst(e.x, e.y, "#ffffff", 6, 170, 2.2);
          if (e.sp > 500) this.ring(e.x, e.y, 6, 34, 0.25, "#ffffff", 3);
          break;
        case "hit": {
          const t = B[e.i], src = FIGHTERS[B[e.src].type];
          this.text(t.x + rand(-10, 10), t.y - t.r - 6, "-" + e.dmg, src.ink);
          this.burst(t.x, t.y, FIGHTERS[t.type].body, e.kind === "burn" || e.kind === "drain" ? 4 : 10, 240, 3);
          this.flash[e.i] = 0.12;
          if (e.dmg >= 12 && !reduceMotion) this.shake = Math.max(this.shake, 6);
          break;
        }
        case "block": {
          const t = B[e.i];
          this.text(t.x, t.y - t.r - 24, "กัน!", "#b9ffe3", false, true);
          this.ring(t.x, t.y, t.r + 10, t.r + 30, 0.3, "#7dffc9", 4);
          break;
        }
        case "deflect":
          this.burst(e.x, e.y, "#ffffff", 8, 220, 2.2);
          this.text(e.x, e.y - 20, "ปัด!", "#ffffff", false, true);
          break;
        case "reflect":
          this.ring(e.x, e.y, 6, 40, 0.3, "#7dffc9", 4);
          this.text(e.x, e.y - 22, "สะท้อน!", "#b9ffe3", false, true);
          break;
        case "heal": {
          const b = B[e.i];
          this.text(b.x + rand(-8, 8), b.y - b.r - 18, "+" + e.amt, "#7dff9a");
          break;
        }
        case "ignite": this.burst(e.x, e.y, "#ff8a2a", 12, 200, 3.5, 60); break;
        case "chill": this.burst(e.x, e.y, "#e6f8ff", 10, 180, 2.6); break;
        case "slash": this.burst(e.x, e.y, "#f4f6ff", 8, 260, 2.5); break;
        case "zap":
          this.ring(e.x, e.y, 8, 70, 0.35, "#ffd43b", 5);
          if (!reduceMotion) this.shake = Math.max(this.shake, 7);
          break;
        case "pop": this.burst(e.x, e.y, e.kind === "arrow" ? "#9fe6ff" : "#e6f8ff", 6, 180, 2); break;
        case "boom":
          this.ring(e.x, e.y, 10, e.r, 0.45, "#ffb347", 6);
          this.ring(e.x, e.y, e.r * 0.4, e.r, 0.25, "#ffd38a", 0, true);
          this.burst(e.x, e.y, "#ff9a3c", 16, 420, 4);
          this.burst(e.x, e.y, "#ffe08a", 10, 300, 3);
          this.burst(e.x, e.y, "#5b6274", 8, 200, 5);
          if (!reduceMotion) this.shake = Math.max(this.shake, 12);
          break;
        case "cast": {
          const b = B[e.i], f = FIGHTERS[b.type];
          if (e.kind === "archer") this.burst(e.x, e.y, "#bff0ff", 5, 140, 2);
          else if (e.kind === "volt") { this.bolt(b.x, b.y, b.x + e.dx * 130, b.y + e.dy * 130, "#fff1a8"); this.ring(b.x, b.y, b.r, b.r + 26, 0.25, f.ink, 3); }
          else if (e.kind === "blade") this.ring(b.x, b.y, b.r, b.r + BL, 0.35, f.ink, 4);
          else if (e.kind === "shield") this.ring(b.x, b.y, b.r, b.r + 34, 0.35, "#7dffc9", 5);
          else if (e.kind === "vampire") this.ring(b.x, b.y, b.r, b.r + 26, 0.3, f.ink, 4);
          else if (e.kind === "frost") this.burst(b.x, b.y, "#e6f8ff", 10, 160, 2.4);
          else if (e.kind === "blaze") { this.ring(b.x, b.y, b.r, b.r + 30, 0.35, "#ff9a3c", 5); this.burst(b.x, b.y, "#ffb347", 10, 180, 3, 60); }
          else if (e.kind === "magnet") this.ring(b.x, b.y, b.r + 60, b.r, 0.4, "#ffb3c0", 4);
          else if (e.kind === "bomb") this.burst(e.x, e.y, "#8d96ad", 5, 90, 3);
          break;
        }
        case "ko": {
          const b = B[e.i], f = FIGHTERS[b.type];
          this.burst(b.x, b.y, f.body, 40, 560, 4.5);
          this.burst(b.x, b.y, "#ffffff", 14, 380, 2.5);
          this.ring(b.x, b.y, b.r, b.r * 3.2, 0.6, f.ink, 6);
          if (!reduceMotion) this.shake = Math.max(this.shake, 14);
          this.show("K.O.!", "", "#ffffff", 1.4);
          break;
        }
        case "fever": this.show("โหมดเดือด!", "ดาเมจ x2", "#ff7a5c", 1.8); break;
        case "timeout": this.show("หมดเวลา!", "HP เหลือมากกว่าชนะ", "#ffd43b", 1.8); break;
      }
    }
  }

  update(dt, S) {
    this.t += dt;
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter(r => r.life > 0);
    for (const t of this.texts) { t.y -= 42 * dt; t.life -= dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter(b => b.life > 0);
    this.flash = this.flash.map(f => Math.max(0, f - dt));
    this.shake = Math.max(0, this.shake - dt * 40);
    if (this.banner) { this.banner.life -= dt; if (this.banner.life <= 0) this.banner = null; }
    this.fever = S && S.fever ? Math.min(1, this.fever + dt * 2) : Math.max(0, this.fever - dt * 2);
    if (!S) return;
    S.balls.forEach((b, i) => {
      for (const p of this.trails[i]) p.life -= dt;
      this.trails[i] = this.trails[i].filter(p => p.life > 0);
      if (b.alive && b.type === "volt" && b.act > 0) this.trails[i].push({ x: b.x, y: b.y, life: 0.22 });
      const o = S.balls[1 - i];
      if (b.alive && b.type === "vampire" && b.act > 0 && o.alive && Math.random() < dt * 30) {
        const s = Math.random();
        this.parts.push({ x: o.x + (b.x - o.x) * s, y: o.y + (b.y - o.y) * s, vx: (b.x - o.x) * 1.2, vy: (b.y - o.y) * 1.2, life: 0.3, max: 0.3, color: "#ff6bd0", size: 3 });
      }
      if (b.alive && b.burn > 0 && Math.random() < dt * 14) this.parts.push({ x: b.x + rand(-20, 20), y: b.y - b.r * 0.6, vx: rand(-20, 20), vy: -rand(60, 120), life: 0.4, max: 0.4, color: "#ffb347", size: 2.5 });
      if (b.alive && b.chill > 0 && Math.random() < dt * 10) this.parts.push({ x: b.x + rand(-30, 30), y: b.y + rand(-30, 30), vx: 0, vy: 20, life: 0.5, max: 0.5, color: "#ffffff", size: 2 });
    });
    for (const fl of S.fires) if (Math.random() < dt * 4) this.parts.push({ x: fl.x + rand(-10, 10), y: fl.y, vx: rand(-10, 10), vy: -rand(50, 110), life: 0.45, max: 0.45, color: Math.random() < 0.5 ? "#ffcf5a" : "#ff7a1a", size: rand(2, 3.5) });
  }
}

// ---------------------------------------------------------------- full frame
export function drawWorld(ctx, S, fx, opts = {}) {
  const t = fx.t;
  drawArena(ctx, fx.fever);
  drawFires(ctx, S.fires, t);
  drawBombs(ctx, S.bombs, t);
  const B = S.balls;
  B.forEach((b, i) => {
    const o = B[1 - i];
    if (!b.alive || !o.alive) return;
    if (b.type === "vampire" && b.act > 0) drawBeam(ctx, b, o, t);
    if (b.type === "magnet" && b.act > 0) drawMagnetField(ctx, b, o, t);
  });
  drawProjectiles(ctx, S.proj);
  B.forEach((b, i) => {
    const f = FIGHTERS[b.type];
    for (const p of fx.trails[i]) {
      ctx.globalAlpha = (p.life / 0.22) * 0.3; ctx.fillStyle = f.body;
      circle(ctx, p.x, p.y, b.r * 0.85); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  B.forEach((b, i) => {
    if (!b.alive) return;
    const f = FIGHTERS[b.type];
    if (b.type === "blade" && b.act > 0) drawBlades(ctx, b);
    const ready = 1 - clamp(b.cd, 0, f.cd) / f.cd;
    drawBallBody(ctx, b.type, b.x, b.y, b.r, {
      glow: (b.type === "volt" && b.act > 0) || (b.type === "magnet" && b.act > 0) ? 24 : 0,
      spin: b.spinA * 0.4, spark: b.type === "bomb" && ready > 0.8 && Math.sin(t * 40) > 0
    });
    if (b.chill > 0) drawChill(ctx, b, t);
    if (b.burn > 0) drawBurn(ctx, b);
    if (b.type === "shield" && b.act > 0) drawShield(ctx, b, t);
    if (fx.flash[i] > 0) { ctx.globalAlpha = fx.flash[i] / 0.12 * 0.7; ctx.fillStyle = "#ffffff"; circle(ctx, b.x, b.y, b.r); ctx.fill(); ctx.globalAlpha = 1; }
    // cooldown ring
    ctx.lineCap = "round"; ctx.lineWidth = 3.5;
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; circle(ctx, b.x, b.y, b.r + 7); ctx.stroke();
    ctx.strokeStyle = f.ink; ctx.globalAlpha = ready > 0.97 ? 1 : 0.75;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * ready); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineCap = "butt";
    // side marker (small dot above) so mirror matches stay readable
    if (opts.markers) {
      ctx.fillStyle = i === 0 ? "#3fa9ff" : "#ff5a6e";
      ctx.beginPath(); ctx.moveTo(b.x - 7, b.y - b.r - 20); ctx.lineTo(b.x + 7, b.y - b.r - 20); ctx.lineTo(b.x, b.y - b.r - 12); ctx.closePath(); ctx.fill();
    }
    // HP number
    ctx.font = `30px ${DISPLAY}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const txt = String(Math.ceil(b.hp));
    ctx.lineJoin = "round"; ctx.lineWidth = 6; ctx.strokeStyle = "rgba(8,14,30,0.9)";
    ctx.strokeText(txt, b.x, b.y + 1); ctx.fillStyle = "#ffffff"; ctx.fillText(txt, b.x, b.y + 1);
  });
  // particles, rings, bolts, floating text
  for (const r of fx.rings) {
    const p = 1 - r.life / r.max, e = 1 - Math.pow(1 - p, 3), rad = r.r0 + (r.r1 - r.r0) * e;
    if (r.fill) { ctx.fillStyle = r.color; ctx.globalAlpha = (1 - p) * 0.4; circle(ctx, r.x, r.y, Math.max(0, rad)); ctx.fill(); }
    else { ctx.globalAlpha = 1 - p; ctx.strokeStyle = r.color; ctx.lineWidth = r.width * (1 - p * 0.6); circle(ctx, r.x, r.y, Math.max(0, rad)); ctx.stroke(); }
  }
  for (const p of fx.parts) {
    ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color;
    circle(ctx, p.x, p.y, p.size * (0.4 + 0.6 * p.life / p.max)); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const b of fx.bolts) {
    ctx.save(); ctx.globalAlpha = b.life / b.max; ctx.strokeStyle = b.color; ctx.lineWidth = 3;
    ctx.shadowColor = "#ffd43b"; ctx.shadowBlur = 14; ctx.lineJoin = "round";
    ctx.beginPath(); b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.restore();
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  for (const tx of fx.texts) {
    ctx.globalAlpha = clamp(tx.life / 0.5, 0, 1);
    ctx.font = tx.thai ? `600 20px ${BODY}` : `24px ${DISPLAY}`;
    ctx.lineWidth = 5; ctx.strokeStyle = "rgba(8,14,30,0.9)"; ctx.strokeText(tx.txt, tx.x, tx.y);
    ctx.fillStyle = tx.color; ctx.fillText(tx.txt, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
  if (fx.banner) {
    const bn = fx.banner, p = 1 - bn.life / bn.max;
    const sc = p < 0.15 ? 0.6 + (p / 0.15) * 0.5 : p < 0.25 ? 1.1 - (p - 0.15) * 1 : 1;
    ctx.save();
    ctx.globalAlpha = bn.life < 0.3 ? bn.life / 0.3 : 1;
    ctx.translate(L / 2, L / 2 - 20); ctx.scale(sc, sc);
    const thai = /[฀-๿]/.test(bn.txt);
    ctx.font = thai ? `600 58px ${BODY}` : `78px ${DISPLAY}`;
    ctx.lineWidth = 12; ctx.strokeStyle = "rgba(8,14,30,0.92)"; ctx.strokeText(bn.txt, 0, 0);
    ctx.fillStyle = bn.color; ctx.fillText(bn.txt, 0, 0);
    if (bn.sub) {
      ctx.font = `500 24px ${BODY}`; ctx.lineWidth = 6;
      ctx.strokeText(bn.sub, 0, 54); ctx.fillStyle = "#ffffff"; ctx.fillText(bn.sub, 0, 54);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- menu backdrop: balls drifting behind the title
export class Showcase {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext("2d"); this.balls = []; this.w = 0; this.h = 0; this.dpr = 1;
  }
  resize() {
    const r = this.c.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height;
    this.c.width = Math.max(1, Math.round(r.width * this.dpr)); this.c.height = Math.max(1, Math.round(r.height * this.dpr));
    if (!this.balls.length && this.w > 0) {
      const base = Math.max(22, Math.min(40, this.w / 11));
      this.balls = ORDER.map((type, i) => {
        const a = rand(0, TAU), s = rand(30, 70);
        return { type, r: base * rand(0.8, 1.15), x: rand(base, this.w - base), y: rand(base, this.h - base), vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rand(0, TAU), vr: rand(-0.6, 0.6), i };
      });
    }
  }
  frame(dt) {
    const { ctx, w, h } = this;
    if (!w) return;
    for (const b of this.balls) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); } else if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); } else if (b.y > h - b.r) { b.y = h - b.r; b.vy = -Math.abs(b.vy); }
    }
    for (let i = 0; i < this.balls.length; i++) for (let j = i + 1; j < this.balls.length; j++) {
      const a = this.balls[i], b = this.balls[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ov = a.r + b.r - d;
      if (ov > 0) {
        const nx = dx / d, ny = dy / d; a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) { a.vx += vn * nx; a.vy += vn * ny; b.vx -= vn * nx; b.vy -= vn * ny; }
      }
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const b of this.balls) {
      const img = portrait(b.type, 128);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      ctx.drawImage(img, -b.r / 0.88, -b.r / 0.88, (b.r / 0.88) * 2, (b.r / 0.88) * 2);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- cover art (used for icons / share images)
export function drawCover(ctx, w, h, mode = "cover") {
  const m = Math.min(w, h);
  const bg = ctx.createRadialGradient(w / 2, h * 0.42, m * 0.05, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  bg.addColorStop(0, "#24407e"); bg.addColorStop(0.55, "#12224a"); bg.addColorStop(1, "#070f24");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // light rays
  ctx.save(); ctx.translate(w / 2, h * (mode === "cover" ? 0.56 : 0.5));
  for (let i = 0; i < 16; i++) {
    ctx.rotate(TAU / 16);
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.035)" : "rgba(255,190,60,0.04)";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-m * 0.12, -Math.max(w, h)); ctx.lineTo(m * 0.12, -Math.max(w, h)); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const hero = (type, x, y, r, dir) => {
    // speed streaks
    ctx.save();
    for (let k = 0; k < 4; k++) {
      ctx.globalAlpha = 0.18 - k * 0.035; ctx.fillStyle = FIGHTERS[type].body;
      circle(ctx, x - dir * r * (0.55 + k * 0.5), y + r * 0.08 * k, r * (0.92 - k * 0.12)); ctx.fill();
    }
    ctx.restore();
    drawBallBody(ctx, type, x, y, r, { glyphAlpha: 0.9, glow: r * 0.5, spark: true, spin: 0.4 });
  };
  const impact = (x, y, s) => {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.6);
    g.addColorStop(0, "rgba(255,255,240,1)"); g.addColorStop(0.25, "rgba(255,214,90,0.9)"); g.addColorStop(1, "rgba(255,150,40,0)");
    ctx.fillStyle = g; circle(ctx, 0, 0, s * 1.6); ctx.fill();
    ctx.fillStyle = "#fff6d6";
    ctx.beginPath();
    for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU, rr = i % 2 ? s * 0.38 : s * (0.9 + (i % 4 === 0 ? 0.35 : 0)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  const logo = (cx, cy, size) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.05);
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    ctx.font = `${size}px ${DISPLAY}`;
    const word = (txt, x, y) => {
      ctx.lineWidth = size * 0.2; ctx.strokeStyle = "#08122b"; ctx.strokeText(txt, x, y + size * 0.06);
      ctx.strokeText(txt, x, y);
      ctx.fillStyle = "#ffffff"; ctx.fillText(txt, x, y);
      const gl = ctx.createLinearGradient(0, y - size * 0.45, 0, y + size * 0.45);
      gl.addColorStop(0, "rgba(255,255,255,0)"); gl.addColorStop(1, "rgba(150,200,255,0.35)");
      ctx.fillStyle = gl; ctx.fillText(txt, x, y);
    };
    const gap = size * 0.62, ww = ctx.measureText("BALL").width;
    word("BALL", -(gap * 0.95 + ww / 2 + size * 0.06), 0);
    word("BALL", gap * 0.95 + ww / 2 + size * 0.06, 0);
    ctx.fillStyle = "#08122b"; circle(ctx, 0, size * 0.04, gap * 0.95); ctx.fill();
    const vg = ctx.createLinearGradient(0, -gap, 0, gap);
    vg.addColorStop(0, "#ffd45c"); vg.addColorStop(1, "#ff9a1f");
    ctx.fillStyle = vg; circle(ctx, 0, 0, gap * 0.8); ctx.fill();
    ctx.fillStyle = "#2a1600"; ctx.font = `${size * 0.62}px ${DISPLAY}`; ctx.fillText("VS", 0, size * 0.04);
    ctx.restore();
  };
  if (mode === "icon" || mode === "maskable") {
    const s = mode === "maskable" ? 0.78 : 1;
    const r = m * 0.24 * s;
    hero("archer", w / 2 - r * 0.95, h / 2 + r * 0.12, r, 1);
    hero("blaze", w / 2 + r * 0.95, h / 2 - r * 0.12, r, -1);
    impact(w / 2, h / 2, r * 0.62);
    return;
  }
  const portraitMode = h > w;
  const logoY = portraitMode ? h * 0.2 : h * 0.17;
  const logoSize = portraitMode ? w * 0.112 : h * 0.13;
  const heroR = portraitMode ? w * 0.17 : h * 0.2;
  const cy = portraitMode ? h * 0.47 : h * 0.53;
  hero("volt", w / 2 - heroR * 1.05, cy + heroR * 0.1, heroR, 1);
  hero("blade", w / 2 + heroR * 1.05, cy - heroR * 0.1, heroR, -1);
  impact(w / 2, cy, heroR * 0.55);
  logo(w / 2, logoY, logoSize);
  // roster row
  const rest = ORDER.filter(t => t !== "volt" && t !== "blade");
  const rowY = portraitMode ? h * 0.72 : h * 0.86;
  const rr = portraitMode ? w * 0.052 : h * 0.062;
  const span = portraitMode ? w * 0.84 : w * 0.62;
  rest.forEach((type, i) => {
    const x = w / 2 - span / 2 + (span / (rest.length - 1)) * i;
    const y = rowY + (i % 2 ? rr * 0.25 : -rr * 0.25);
    drawBallBody(ctx, type, x, y, rr, { glyphAlpha: 0.9, spark: true, spin: 0.3 });
  });
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `600 ${portraitMode ? w * 0.05 : h * 0.05}px ${BODY}`;
  ctx.fillStyle = "#ffd45c";
  ctx.fillText("ลูกบอลสกิลสู้กันในกรง", w / 2, portraitMode ? h * 0.82 : h * 0.31);
  if (portraitMode) {
    ctx.font = `500 ${w * 0.036}px ${BODY}`; ctx.fillStyle = "#c9d6ff";
    ctx.fillText("9 นักสู้ · เล่นออนไลน์กับเพื่อนได้", w / 2, h * 0.865);
  }
}
