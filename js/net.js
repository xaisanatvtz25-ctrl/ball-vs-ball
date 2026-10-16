// Online rooms over free public MQTT brokers. Two brokers are used at once and
// messages are de-duplicated, so a room still works if one broker is down.
import { MqttLite } from "./mqtt-lite.js";
import { ORDER } from "./fighters.js";

const DEFAULT_BROKERS = ["wss://broker.hivemq.com:8884/mqtt", "wss://broker.emqx.io:8084/mqtt"];
const PREFIX = "ballvsball-x25/v2/room/";
const HB_MS = 2500, LOST_MS = 10000;

function brokerList() {
  const q = new URLSearchParams(location.search).get("mqtt");
  if (q && /^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/.test(q)) return [q];   // local testing only
  return DEFAULT_BROKERS;
}
const rid = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
export const cleanName = s => String(s || "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 12);

class Link {
  constructor(onMessage, onStatus) {
    this.id = "bvb" + rid(12);
    this.seen = new Map();
    this.onMessage = onMessage; this.onStatus = onStatus;
    this.clients = brokerList().map(url => new MqttLite(url, {
      clientId: this.id + rid(3),
      onMessage: (topic, text) => this._in(topic, text),
      onState: () => this.onStatus(this.up())
    }));
  }
  up() { return this.clients.filter(c => c.connected).length; }
  start() { this.clients.forEach(c => c.connect()); }
  waitUp(ms) {
    return new Promise(res => {
      const t0 = Date.now();
      const tick = () => { if (this.up() > 0) return res(true); if (Date.now() - t0 > ms) return res(false); setTimeout(tick, 150); };
      tick();
    });
  }
  subscribe(t) { this.clients.forEach(c => c.subscribe(t)); }
  unsubscribe(t) { this.clients.forEach(c => c.unsubscribe(t)); }
  publish(topic, obj) {
    const msg = JSON.stringify({ ...obj, mid: rid(10), from: this.id });
    let sent = 0;
    for (const c of this.clients) if (c.publish(topic, msg)) sent++;
    return sent > 0;
  }
  _in(topic, text) {
    let m;
    try { m = JSON.parse(text); } catch (e) { return; }
    if (!m || typeof m !== "object" || typeof m.mid !== "string" || typeof m.t !== "string") return;
    if (this.seen.has(m.mid)) return;
    this.seen.set(m.mid, 1);
    if (this.seen.size > 600) this.seen.delete(this.seen.keys().next().value);
    this.onMessage(topic, m);
  }
  close() { this.clients.forEach(c => c.close()); }
}

// Room: host (left side) creates, guest (right side) joins with a 5-digit code.
export class Room {
  constructor(handlers) {
    this.h = handlers;                 // { status(n), lobby(), start(info), snap(m), end(m), left(reason), notice(text) }
    this.link = new Link((t, m) => this._msg(t, m), n => this.h.status && this.h.status(n));
    this.role = null; this.code = null; this.topic = null;
    this.me = { name: "", pick: null, ready: false };
    this.peer = null;                  // { id, name, pick, ready, seen }
    this.score = [0, 0]; this.round = 0; this.inMatch = false; this.startedRound = -1;
    this.timer = null; this.joinWait = null;
  }

  async connect() {
    this.link.start();
    return this.link.waitUp(9000);
  }
  get connected() { return this.link.up() > 0; }
  get myId() { return this.link.id; }

  _send(t, extra = {}) { return this.topic && this.link.publish(this.topic, { t, ...extra }); }
  _hb() {
    this._send("hb", { name: this.me.name, pick: this.me.pick, ready: this.me.ready, score: this.role === "host" ? this.score : undefined, inMatch: this.inMatch });
  }
  _loop() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this._hb();
      if (this.peer && Date.now() - this.peer.seen > LOST_MS) {
        const who = this.peer.name;
        this.peer = null;
        if (this.role === "guest") { this.h.left && this.h.left("host-lost"); this.leave(true); }
        else { this.h.notice && this.h.notice(`${who} หลุดออกจากห้อง`); this.h.lobby && this.h.lobby(); }
      }
    }, HB_MS);
  }

  host(name) {
    this.role = "host"; this.me.name = name;
    this.code = String(10000 + Math.floor(Math.random() * 90000));
    this.topic = PREFIX + this.code;
    this.link.subscribe(this.topic);
    this._loop();
    return this.code;
  }

  join(name, code) {
    this.role = "guest"; this.me.name = name; this.code = code;
    this.topic = PREFIX + code;
    this.link.subscribe(this.topic);
    return new Promise((resolve, reject) => {
      let tries = 0;
      const ask = () => {
        if (this.peer) return;
        if (tries++ >= 5) { this.joinWait = null; this.link.unsubscribe(this.topic); this.topic = null; reject(new Error("notfound")); return; }
        this._send("join", { name });
        this.joinTimer = setTimeout(ask, 1600);
      };
      this.joinWait = { resolve, reject };
      setTimeout(ask, 400);           // give the subscription a moment to land
    });
  }

  setPick(p) { if (ORDER.includes(p)) { this.me.pick = p; this._hb(); this._maybeStart(); } }
  setReady(v) { this.me.ready = !!v && !!this.me.pick; this._hb(); this._maybeStart(); }

  _maybeStart() {
    if (this.role !== "host" || this.inMatch || !this.peer) return;
    if (!(this.me.ready && this.peer.ready && this.me.pick && this.peer.pick)) return;
    this.round++;
    const info = {
      r: this.round, seed: (Math.random() * 2147483647) | 0,
      left: this.me.pick, right: this.peer.pick, leftName: this.me.name, rightName: this.peer.name,
      guest: this.peer.id, gravity: true
    };
    this.inMatch = true;
    this._send("start", info);
    clearTimeout(this.startFallback);
    this.startFallback = setTimeout(() => this._begin(info), 1200);   // in case our own echo never arrives
  }

  _begin(info) {
    if (this.startedRound === info.r) return;
    this.startedRound = info.r;
    this.round = info.r;
    this.inMatch = true; this.me.ready = false;
    if (this.peer) this.peer.ready = false;
    this.h.start && this.h.start(info);
  }

  matchOver() { this.inMatch = false; this.me.ready = false; this._hb(); }
  sendSnap(r, f, h, st) { this._send("snap", { r, f, h, st }); }
  sendEnd(r, win, f, h) {
    if (this.role === "host") { this.score[win]++; }
    this._send("end", { r, win, f, h, score: this.score });
  }

  _msg(topic, m) {
    if (topic !== this.topic) return;
    const mine = m.from === this.link.id;
    if (mine && m.t !== "start") return;
    if (m.to && m.to !== this.link.id) return;
    const now = Date.now();
    if (!mine && this.peer && this.peer.id === m.from) this.peer.seen = now;

    switch (m.t) {
      case "join":
        if (this.role !== "host") return;
        if (!this.peer || this.peer.id === m.from) {
          const fresh = !this.peer;
          this.peer = { id: m.from, name: cleanName(m.name) || "เพื่อน", pick: null, ready: false, seen: now };
          this._send("welcome", { to: m.from, name: this.me.name, pick: this.me.pick, ready: this.me.ready, score: this.score });
          if (fresh) { this.h.notice && this.h.notice(`${this.peer.name} เข้าห้องแล้ว`, "join"); }
          this.h.lobby && this.h.lobby();
        } else {
          this._send("full", { to: m.from });
        }
        break;
      case "welcome":
        if (this.role !== "guest" || this.peer) return;
        clearTimeout(this.joinTimer);
        this.peer = { id: m.from, name: cleanName(m.name) || "เจ้าของห้อง", pick: ORDER.includes(m.pick) ? m.pick : null, ready: !!m.ready, seen: now };
        if (Array.isArray(m.score)) this.score = m.score.map(n => n | 0).slice(0, 2);
        this._loop(); this._hb();
        if (this.joinWait) { this.joinWait.resolve(); this.joinWait = null; }
        this.h.lobby && this.h.lobby();
        break;
      case "full":
        if (this.role === "guest" && this.joinWait) {
          clearTimeout(this.joinTimer);
          this.joinWait.reject(new Error("full")); this.joinWait = null;
          this.link.unsubscribe(this.topic); this.topic = null;
        }
        break;
      case "hb":
        if (!this.peer || this.peer.id !== m.from) return;
        this.peer.name = cleanName(m.name) || this.peer.name;
        this.peer.pick = ORDER.includes(m.pick) ? m.pick : null;
        this.peer.ready = !!m.ready;
        if (this.role === "guest" && Array.isArray(m.score)) this.score = m.score.map(n => n | 0).slice(0, 2);
        this.h.lobby && this.h.lobby();
        this._maybeStart();
        break;
      case "start":
        if (!ORDER.includes(m.left) || !ORDER.includes(m.right) || typeof m.seed !== "number") return;
        if (this.role === "host" && mine) { clearTimeout(this.startFallback); this._begin(m); }
        else if (this.role === "guest" && this.peer && m.from === this.peer.id && m.guest === this.link.id) this._begin(m);
        break;
      case "snap":
        if (this.role === "guest" && this.peer && m.from === this.peer.id && typeof m.st === "string") this.h.snap && this.h.snap(m);
        break;
      case "end":
        if (this.role === "guest" && this.peer && m.from === this.peer.id) {
          if (Array.isArray(m.score)) this.score = m.score.map(n => n | 0).slice(0, 2);
          this.h.end && this.h.end(m);
        }
        break;
      case "leave":
        if (!this.peer || this.peer.id !== m.from) return;
        if (this.role === "guest") { this.h.left && this.h.left("host-left"); this.leave(true); }
        else { const who = this.peer.name; this.peer = null; this.h.notice && this.h.notice(`${who} ออกจากห้องแล้ว`); this.h.lobby && this.h.lobby(); }
        break;
    }
  }

  leave(silent = false) {
    clearInterval(this.timer); clearTimeout(this.joinTimer); clearTimeout(this.startFallback);
    if (!silent && this.topic) this._send("leave");
    const link = this.link;
    setTimeout(() => link.close(), silent ? 0 : 300);
    this.topic = null; this.peer = null; this.role = null;
  }
}
