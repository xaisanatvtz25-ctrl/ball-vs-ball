// Deterministic fight simulation.
// Same seed + same picks => the exact same fight on every device, which is what
// lets online players run the match locally and still see the same result.
// Rules for this file: no DOM, no Math.random, no Math.sin/cos/hypot/pow/exp/atan2
// (their last bits differ between browsers). Only + - * / Math.sqrt Math.floor
// Math.abs Math.min Math.max and integer maths. Visual-only randomness belongs in draw.js.
import { FIGHTERS } from "./fighters.js";

export const L = 600, PAD = 12, LO = PAD, HI = L - PAD;
export const G = 760, R = 36, DT = 1 / 120, BL = 44;
export const PI = 3.141592653589793, TAU = 2 * PI, HALF_PI = PI / 2;
export const TIME_LIMIT = 90;           // seconds; then higher HP wins
export const FEVER_AT = 45;             // seconds; after this every hit does double damage
const MIN_VY = Math.sqrt(2 * G * 260);  // keeps floor bounces lively

// Fight numbers (balanced with tools/balance test runs).
export const P = {
  archer:  { dmg: 7, speed: 980, knock: 160 },
  bomb:    { dmg: 16, radius: 118, fuse: 1.15, knock: 560 },
  blade:   { dmg: 6, dur: 3.2, hitcd: 0.25, knock: 260 },
  volt:    { dmg: 12, speed: 1150, dur: 0.5, knock: 420 },
  shield:  { dur: 1.8, dmg: 9, knock: 500, hitcd: 0.45 },
  vampire: { range: 300, dur: 1.25, tick: 0.25, dmg: 2, heal: 1 },
  frost:   { spread: 0.26, speed: 760, dmg: 5, chill: 1.2 },
  blaze:   { dur: 3.0, gap: 30, life: 2.0, r: 22, burn: 1.7, tick: 0.55, dmg: 2 },
  magnet:  { dur: 1.5, pull: 2000, dmg: 13, knock: 380 }
};

// ---------- deterministic helpers ----------
export function dsin(x) {
  x = x - TAU * Math.floor((x + PI) / TAU);          // [-PI, PI)
  if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x;
  const x2 = x * x;
  return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110 * (1 - x2 / 156))))));
}
export const dcos = x => dsin(x + HALF_PI);
const len = (x, y) => Math.sqrt(x * x + y * y);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function rnd(S) {                       // mulberry32, state kept in S.rs
  const a = (S.rs = (S.rs + 0x6D2B79F5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (S, a, b) => a + rnd(S) * (b - a);

function limit(b, max) {
  const s = len(b.vx, b.vy);
  if (s > max) { b.vx *= max / s; b.vy *= max / s; }
}

function segDist(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const t = clamp(((px - x1) * vx + (py - y1) * vy) / (vx * vx + vy * vy), 0, 1);
  return len(px - (x1 + vx * t), py - (y1 + vy * t));
}

// ---------- setup ----------
function makeBall(S, type, side) {
  const f = FIGHTERS[type];
  const a = side === 0 ? rr(S, -0.7, 0.3) : PI + rr(S, -0.3, 0.7);
  const sp = rr(S, 380, 460);
  return {
    type, side,
    x: side === 0 ? rr(S, 110, 190) : rr(S, 410, 490),
    y: rr(S, 130, 260),
    vx: dcos(a) * sp, vy: dsin(a) * sp,
    r: R, m: f.mass, hp: 100, max: 100,
    cd: f.cd * rr(S, 0.45, 0.8),
    alive: true,
    act: 0,      // time left on the active skill (dash / spin / shield / beam / trail / pull)
    hit: false,  // dash already landed this activation
    hitCD: 0,    // re-hit delay for blade and shield bash
    spinA: rr(S, 0, TAU),
    tick: 0,     // vampire beam tick timer
    acc: 0,      // blaze distance since last fire patch
    chill: 0,    // frost slow
    burn: 0, btick: 0, bsrc: -1,
    dealt: 0
  };
}

export function createMatch({ seed, left, right, gravity = true }) {
  if (!FIGHTERS[left] || !FIGHTERS[right]) throw new Error("unknown fighter");
  const S = {
    v: 2, f: 0, rs: seed | 0, grav: !!gravity,
    balls: [], proj: [], bombs: [], fires: [],
    over: false, win: -1, koF: -1, timeout: false, fever: false, ev: []
  };
  S.balls.push(makeBall(S, left, 0), makeBall(S, right, 1));
  return S;
}

export const newSeed = () => (Math.random() * 2147483647) | 0;
export const timeOf = S => S.f * DT;

// ---------- damage ----------
function hurt(S, ti, dmg, si, kind) {
  const t = S.balls[ti];
  if (!t.alive || S.over) return false;
  if (t.type === "shield" && t.act > 0) {
    S.ev.push({ k: "block", i: ti, x: t.x, y: t.y });
    return false;
  }
  if (S.fever) dmg *= 2;
  t.hp = Math.max(0, t.hp - dmg);
  S.balls[si].dealt += dmg;
  S.ev.push({ k: "hit", i: ti, src: si, dmg, kind, x: t.x, y: t.y });
  if (t.hp <= 0) {
    t.alive = false;
    S.over = true; S.win = si; S.koF = S.f;
    S.ev.push({ k: "ko", i: ti, src: si, x: t.x, y: t.y });
  }
  return true;
}

function heal(S, i, amt) {
  const b = S.balls[i];
  if (!b.alive || S.over) return;
  const before = b.hp;
  b.hp = Math.min(b.max, b.hp + amt);
  if (b.hp > before) S.ev.push({ k: "heal", i, amt: b.hp - before, x: b.x, y: b.y });
}

function ignite(S, f, src) {
  if (!f.alive || (f.type === "shield" && f.act > 0)) return;
  if (f.burn <= 0) { f.btick = 0.15; S.ev.push({ k: "ignite", i: f.side, x: f.x, y: f.y }); }
  f.burn = P.blaze.burn; f.bsrc = src;
}

// ---------- walls ----------
function wall(S, b) {
  let hit = 0, floor = false;
  if (b.x - b.r < LO) { b.x = LO + b.r; b.vx = Math.abs(b.vx); hit = b.vx; }
  else if (b.x + b.r > HI) { b.x = HI - b.r; b.vx = -Math.abs(b.vx); hit = -b.vx; }
  if (b.y - b.r < LO) { b.y = LO + b.r; b.vy = Math.abs(b.vy); hit = Math.max(hit, b.vy); }
  else if (b.y + b.r > HI) { b.y = HI - b.r; b.vy = -Math.abs(b.vy); hit = Math.max(hit, -b.vy); floor = true; }
  if (hit) S.ev.push({ k: "wall", i: b.side, x: b.x, y: b.y, sp: hit });
  if (b.type === "volt" && b.act > 0) return;
  if (S.grav && floor) {
    if (-b.vy < MIN_VY) b.vy = -MIN_VY;
    if (Math.abs(b.vx) < 120) b.vx = (b.vx < 0 ? -1 : 1) * 120;
  }
  if (!S.grav && hit) {
    const s = len(b.vx, b.vy);
    if (s < 340) { if (s < 1) { b.vx = 340; b.vy = 0; } else { b.vx *= 340 / s; b.vy *= 340 / s; } }
  }
  limit(b, 1000);
}

// ---------- skills ----------
function cast(S, b, o) {
  const i = b.side;
  switch (b.type) {
    case "archer": {
      let dx = o.x + o.vx * 0.12 - b.x, dy = o.y + o.vy * 0.12 - b.y;
      const d = len(dx, dy) || 1; dx /= d; dy /= d;
      const x = b.x + dx * (b.r + 6), y = b.y + dy * (b.r + 6);
      S.proj.push({ k: "arrow", x, y, sx: x, sy: y, vx: dx * P.archer.speed, vy: dy * P.archer.speed, o: i, life: 1.4 });
      b.vx -= dx * 60; b.vy -= dy * 60;
      S.ev.push({ k: "cast", i, kind: "archer", x, y });
      return true;
    }
    case "bomb": {
      const tx = clamp(o.x + o.vx * 0.6, LO + 30, HI - 30), ty = clamp(o.y + o.vy * 0.3, LO + 30, HI - 30);
      const dx = tx - b.x, dy = ty - b.y;
      let vx, vy;
      if (S.grav) { const t = 0.75; vx = dx / t; vy = dy / t - 0.5 * G * t; }
      else { const d = len(dx, dy) || 1; vx = dx / d * 520; vy = dy / d * 520; }
      vx = clamp(vx, -750, 750); vy = clamp(vy, -900, 600);
      const s = len(vx, vy) || 1;
      S.bombs.push({ x: b.x + vx / s * (b.r + 14), y: b.y + vy / s * (b.r + 14), vx, vy, r: 12, fuse: P.bomb.fuse, o: i });
      S.ev.push({ k: "cast", i, kind: "bomb", x: b.x, y: b.y });
      return true;
    }
    case "blade":
      b.act = P.blade.dur; b.hitCD = 0;
      S.ev.push({ k: "cast", i, kind: "blade", x: b.x, y: b.y });
      return true;
    case "volt": {
      let dx = o.x - b.x, dy = o.y - b.y;
      const d = len(dx, dy) || 1; dx /= d; dy /= d;
      b.vx = dx * P.volt.speed; b.vy = dy * P.volt.speed; b.act = P.volt.dur; b.hit = false;
      S.ev.push({ k: "cast", i, kind: "volt", x: b.x, y: b.y, dx, dy });
      return true;
    }
    case "shield":
      b.act = P.shield.dur; b.hitCD = 0;
      S.ev.push({ k: "cast", i, kind: "shield", x: b.x, y: b.y });
      return true;
    case "vampire":
      if (len(o.x - b.x, o.y - b.y) > P.vampire.range) return false;   // waits until close enough
      b.act = P.vampire.dur; b.tick = 0.1;
      S.ev.push({ k: "cast", i, kind: "vampire", x: b.x, y: b.y });
      return true;
    case "frost": {
      let dx = o.x + o.vx * 0.1 - b.x, dy = o.y + o.vy * 0.1 - b.y;
      const d = len(dx, dy) || 1; dx /= d; dy /= d;
      for (let k = -1; k <= 1; k++) {
        const cs = dcos(k * P.frost.spread), sn = dsin(k * P.frost.spread);
        const ux = dx * cs - dy * sn, uy = dx * sn + dy * cs;
        const x = b.x + ux * (b.r + 6), y = b.y + uy * (b.r + 6);
        S.proj.push({ k: "shard", x, y, sx: x, sy: y, vx: ux * P.frost.speed, vy: uy * P.frost.speed, o: i, life: 1.6 });
      }
      S.ev.push({ k: "cast", i, kind: "frost", x: b.x, y: b.y });
      return true;
    }
    case "blaze":
      b.act = P.blaze.dur; b.acc = P.blaze.gap;
      S.ev.push({ k: "cast", i, kind: "blaze", x: b.x, y: b.y });
      return true;
    case "magnet":
      b.act = P.magnet.dur;
      S.ev.push({ k: "cast", i, kind: "magnet", x: b.x, y: b.y });
      return true;
  }
  return false;
}

// ---------- contacts ----------
function contact(S, p, q, nx, ny) {     // p acts on q, (nx, ny) points from p to q
  if (!p.alive || !q.alive || S.over) return;
  const pi = p.side, qi = q.side;
  if (p.type === "volt" && p.act > 0 && !p.hit) {
    p.hit = true; p.act = 0;
    q.vx += nx * P.volt.knock; q.vy += ny * P.volt.knock;
    limit(p, 720);
    S.ev.push({ k: "zap", i: pi, x: p.x + nx * p.r, y: p.y + ny * p.r });
    hurt(S, qi, P.volt.dmg, pi, "dash");
  }
  if (p.type === "shield" && p.act > 0 && p.hitCD <= 0) {
    p.hitCD = P.shield.hitcd;
    q.vx += nx * P.shield.knock; q.vy += ny * P.shield.knock;
    hurt(S, qi, P.shield.dmg, pi, "bash");
  }
  if (p.type === "magnet" && p.act > 0) {
    p.act = 0;
    q.vx += nx * P.magnet.knock; q.vy += ny * P.magnet.knock;
    hurt(S, qi, P.magnet.dmg, pi, "magnet");
  }
  if (p.type === "blaze" && p.act > 0) ignite(S, q, pi);
}

function collide(S, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = len(dx, dy) || 0.0001;
  const ov = a.r + b.r - d;
  if (ov <= 0) return;
  const nx = dx / d, ny = dy / d;
  const ia = 1 / a.m, ib = 1 / b.m, tot = ia + ib;
  a.x -= nx * ov * (ia / tot); a.y -= ny * ov * (ia / tot);
  b.x += nx * ov * (ib / tot); b.y += ny * ov * (ib / tot);
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn < 0) {
    const j = -2 * vn / tot;               // perfectly elastic
    a.vx -= j * ia * nx; a.vy -= j * ia * ny;
    b.vx += j * ib * nx; b.vy += j * ib * ny;
    S.ev.push({ k: "clash", x: a.x + nx * a.r, y: a.y + ny * a.r, sp: -vn });
  }
  contact(S, a, b, nx, ny);
  contact(S, b, a, -nx, -ny);
}

function blades(S, i) {
  const o = S.balls[i], f = S.balls[1 - i];
  if (o.type !== "blade" || !o.alive || !f.alive || o.act <= 0 || o.hitCD > 0 || S.over) return;
  for (let k = 0; k < 3; k++) {
    const a = o.spinA + k * TAU / 3, ux = dcos(a), uy = dsin(a);
    const x1 = o.x + ux * (o.r + 2), y1 = o.y + uy * (o.r + 2);
    const x2 = o.x + ux * (o.r + BL), y2 = o.y + uy * (o.r + BL);
    if (segDist(f.x, f.y, x1, y1, x2, y2) < f.r + 3) {
      o.hitCD = P.blade.hitcd;
      const dx = f.x - o.x, dy = f.y - o.y, d = len(dx, dy) || 1;
      f.vx += dx / d * P.blade.knock; f.vy += dy / d * P.blade.knock;
      S.ev.push({ k: "slash", i, x: x2, y: y2 });
      hurt(S, 1 - i, P.blade.dmg, i, "blade");
      return;
    }
  }
}

// ---------- projectiles, bombs, fire ----------
function hitsBlade(o, x, y) {            // a projectile is only knocked away if a blade actually touches it
  for (let k = 0; k < 3; k++) {
    const a = o.spinA + k * TAU / 3, ux = dcos(a), uy = dsin(a);
    if (segDist(x, y, o.x + ux * (o.r + 2), o.y + uy * (o.r + 2), o.x + ux * (o.r + BL), o.y + uy * (o.r + BL)) < 8) return true;
  }
  return false;
}

function projectiles(S) {
  const keep = [];
  for (const p of S.proj) {
    p.x += p.vx * DT; p.y += p.vy * DT; p.life -= DT;
    if (p.life <= 0) continue;
    if (p.x < LO || p.x > HI || p.y < LO || p.y > HI) {
      S.ev.push({ k: "pop", kind: p.k, x: clamp(p.x, LO, HI), y: clamp(p.y, LO, HI) });
      continue;
    }
    const fi = 1 - p.o, f = S.balls[fi];
    if (f.alive) {
      const d = len(p.x - f.x, p.y - f.y);
      if (f.type === "blade" && f.act > 0 && d < f.r + BL + 6 && hitsBlade(f, p.x, p.y)) {
        S.ev.push({ k: "deflect", i: fi, x: p.x, y: p.y });
        continue;
      }
      if (f.type === "shield" && f.act > 0 && d < f.r + 16) {
        const ow = S.balls[p.o], sp = len(p.vx, p.vy);
        const rx = ow.x - p.x, ry = ow.y - p.y, rd = len(rx, ry) || 1;
        p.vx = rx / rd * sp; p.vy = ry / rd * sp; p.o = fi; p.life = 1.4; p.sx = p.x; p.sy = p.y;
        S.ev.push({ k: "reflect", i: fi, x: p.x, y: p.y });
        keep.push(p);
        continue;
      }
      if (d < f.r + (p.k === "shard" ? 4 : 2)) {
        const sp = len(p.vx, p.vy) || 1;
        if (p.k === "arrow") {
          f.vx += p.vx / sp * P.archer.knock; f.vy += p.vy / sp * P.archer.knock;
          hurt(S, fi, P.archer.dmg, p.o, "arrow");
        } else if (hurt(S, fi, P.frost.dmg, p.o, "shard")) {
          f.chill = P.frost.chill; f.vx *= 0.7; f.vy *= 0.7;
          S.ev.push({ k: "chill", i: fi, x: f.x, y: f.y });
        }
        continue;
      }
    }
    keep.push(p);
  }
  S.proj = keep;
}

function explode(S, m) {
  S.ev.push({ k: "boom", x: m.x, y: m.y, r: P.bomb.radius });
  const fi = 1 - m.o, f = S.balls[fi];
  if (!f.alive) return;
  const dx = f.x - m.x, dy = f.y - m.y, d = len(dx, dy) || 1;
  if (d < P.bomb.radius + f.r) {
    f.vx += dx / d * P.bomb.knock; f.vy += dy / d * P.bomb.knock;
    hurt(S, fi, P.bomb.dmg, m.o, "bomb");
  }
}

function bombs(S) {
  const keep = [];
  for (const m of S.bombs) {
    if (S.grav) m.vy += G * DT; else { m.vx *= 0.996; m.vy *= 0.996; }
    m.x += m.vx * DT; m.y += m.vy * DT;
    if (m.x - m.r < LO) { m.x = LO + m.r; m.vx = Math.abs(m.vx) * 0.7; }
    else if (m.x + m.r > HI) { m.x = HI - m.r; m.vx = -Math.abs(m.vx) * 0.7; }
    if (m.y - m.r < LO) { m.y = LO + m.r; m.vy = Math.abs(m.vy) * 0.7; }
    else if (m.y + m.r > HI) { m.y = HI - m.r; m.vy = -Math.abs(m.vy) * 0.7; m.vx *= 0.9; }
    m.fuse -= DT;
    const fi = 1 - m.o, f = S.balls[fi];
    if (f.alive && len(m.x - f.x, m.y - f.y) < f.r + m.r) {
      if (f.type === "shield" && f.act > 0) {        // bat the bomb back at its thrower
        const ow = S.balls[m.o];
        const rx = ow.x - m.x, ry = ow.y - m.y, rd = len(rx, ry) || 1;
        m.vx = rx / rd * 560; m.vy = ry / rd * 560 - (S.grav ? 220 : 0);
        m.o = fi; m.fuse = Math.max(m.fuse, 0.6);
        S.ev.push({ k: "reflect", i: fi, x: m.x, y: m.y });
        keep.push(m);
        continue;
      }
      explode(S, m);
      continue;
    }
    if (m.fuse <= 0) { explode(S, m); continue; }
    keep.push(m);
  }
  S.bombs = keep;
}

function fires(S) {
  const keep = [];
  for (const fl of S.fires) {
    fl.life -= DT;
    if (fl.life <= 0) continue;
    const f = S.balls[1 - fl.o];
    if (f.alive && !S.over && len(f.x - fl.x, f.y - fl.y) < f.r + fl.r) ignite(S, f, fl.o);
    keep.push(fl);
  }
  S.fires = keep;
}

// ---------- main step ----------
export function step(S) {
  const B = S.balls;
  for (let i = 0; i < 2; i++) {
    const b = B[i];
    if (!b.alive) continue;
    const o = B[1 - i];
    const f = FIGHTERS[b.type];

    if (b.type === "volt" && b.act > 0) {
      b.act -= DT;
      if (b.act <= 0) { b.act = 0; limit(b, 720); }
    } else if (S.grav) b.vy += G * DT;

    if (b.type === "magnet" && b.act > 0) {
      b.act -= DT; if (b.act < 0) b.act = 0;
      if (o.alive) {
        const dx = b.x - o.x, dy = b.y - o.y, d = len(dx, dy) || 1;
        o.vx += dx / d * P.magnet.pull * DT; o.vy += dy / d * P.magnet.pull * DT;
        limit(o, 900);
      }
    }

    const px = b.x, py = b.y;
    b.x += b.vx * DT; b.y += b.vy * DT;
    wall(S, b);

    if (!S.over) {
      b.cd -= DT * (b.chill > 0 ? 0.5 : 1);
      if (b.cd <= 0) b.cd = o.alive && cast(S, b, o) ? f.cd : 0;
    }

    if (b.type === "blade") {
      if (b.act > 0) { b.act -= DT; if (b.act < 0) b.act = 0; b.spinA += DT * 11; }
      else b.spinA += DT * 1.5;
      if (b.spinA > TAU) b.spinA -= TAU;
    } else if (b.type === "shield") {
      if (b.act > 0) { b.act -= DT; if (b.act < 0) b.act = 0; }
    } else if (b.type === "blaze") {
      if (b.act > 0) {
        b.act -= DT; if (b.act < 0) b.act = 0;
        b.acc += len(b.x - px, b.y - py);
        if (b.acc >= P.blaze.gap) {
          b.acc = 0;
          S.fires.push({ x: b.x, y: b.y, r: P.blaze.r, life: P.blaze.life, o: i });
        }
      }
    } else if (b.type === "vampire") {
      if (b.act > 0) {
        b.act -= DT; b.tick -= DT;
        if (b.tick <= 0) {
          b.tick += P.vampire.tick;
          if (o.alive && len(o.x - b.x, o.y - b.y) <= P.vampire.range + 100) {
            if (hurt(S, 1 - i, P.vampire.dmg, i, "drain")) heal(S, i, P.vampire.heal);
          } else b.act = 0;
        }
        if (b.act < 0) b.act = 0;
      }
    }

    if (b.chill > 0) { b.chill -= DT; if (b.chill < 0) b.chill = 0; }
    if (b.burn > 0) {
      b.burn -= DT; b.btick -= DT;
      if (b.btick <= 0) { b.btick += P.blaze.tick; hurt(S, i, P.blaze.dmg, b.bsrc, "burn"); }
      if (b.burn < 0) b.burn = 0;
    }
    if (b.hitCD > 0) { b.hitCD -= DT; if (b.hitCD < 0) b.hitCD = 0; }
  }

  if (B[0].alive && B[1].alive) collide(S, B[0], B[1]);
  blades(S, 0); blades(S, 1);
  projectiles(S);
  bombs(S);
  fires(S);

  S.f++;
  if (!S.fever && !S.over && S.f * DT >= FEVER_AT) { S.fever = true; S.ev.push({ k: "fever" }); }
  if (!S.over && S.f * DT >= TIME_LIMIT) {
    const [a, b] = B;
    S.over = true; S.timeout = true; S.koF = S.f;
    S.win = a.hp !== b.hp ? (a.hp > b.hp ? 0 : 1) : (a.dealt >= b.dealt ? 0 : 1);
    S.ev.push({ k: "timeout", win: S.win });
  }
}

// ---------- online sync helpers ----------
export function snapshot(S) {
  const { ev, ...rest } = S;
  return JSON.stringify(rest);
}
export function restore(json) {
  const S = JSON.parse(json);
  S.ev = [];
  return S;
}

const hf = new Float64Array(1), hu = new Uint32Array(hf.buffer);
export function hashState(S) {
  let h = 0x811c9dc5 | 0;
  const mix = v => { hf[0] = v; h = Math.imul(h ^ hu[0], 16777619); h = Math.imul(h ^ hu[1], 16777619); };
  mix(S.f); mix(S.rs); mix(S.over ? 1 : 0); mix(S.win); mix(S.fever ? 1 : 0);
  for (const b of S.balls) {
    mix(b.x); mix(b.y); mix(b.vx); mix(b.vy); mix(b.hp); mix(b.cd); mix(b.act); mix(b.hitCD);
    mix(b.spinA); mix(b.chill); mix(b.burn); mix(b.btick); mix(b.acc); mix(b.tick);
    mix(b.alive ? 1 : 0); mix(b.hit ? 1 : 0);
  }
  mix(S.proj.length); for (const p of S.proj) { mix(p.x); mix(p.y); mix(p.vx); mix(p.vy); mix(p.o); mix(p.life); }
  mix(S.bombs.length); for (const m of S.bombs) { mix(m.x); mix(m.y); mix(m.vx); mix(m.vy); mix(m.o); mix(m.fuse); }
  mix(S.fires.length); for (const fl of S.fires) { mix(fl.x); mix(fl.y); mix(fl.life); mix(fl.o); }
  return h >>> 0;
}
