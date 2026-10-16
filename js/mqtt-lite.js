// Minimal MQTT 3.1.1 client over WebSocket (QoS 0 only): CONNECT, SUBSCRIBE,
// UNSUBSCRIBE, PUBLISH, PINGREQ, DISCONNECT. Enough for a small game lobby.
const te = new TextEncoder(), td = new TextDecoder();

function remLen(n) {
  const out = [];
  do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 0x80; out.push(b); } while (n > 0);
  return out;
}
function utf8(s) {
  const b = te.encode(s);
  const out = new Uint8Array(2 + b.length);
  out[0] = b.length >> 8; out[1] = b.length & 255; out.set(b, 2);
  return out;
}
function concat(parts) {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function packet(first, body) {
  return concat([Uint8Array.of(first, ...remLen(body.length)), body]);
}

export const encode = {
  connect(clientId, keepAlive) {
    return packet(0x10, concat([utf8("MQTT"), Uint8Array.of(4, 0x02, keepAlive >> 8, keepAlive & 255), utf8(clientId)]));
  },
  subscribe(pid, topic) {
    return packet(0x82, concat([Uint8Array.of(pid >> 8, pid & 255), utf8(topic), Uint8Array.of(0)]));
  },
  unsubscribe(pid, topic) {
    return packet(0xa2, concat([Uint8Array.of(pid >> 8, pid & 255), utf8(topic)]));
  },
  publish(topic, payload) {
    return packet(0x30, concat([utf8(topic), te.encode(payload)]));
  },
  pingreq() { return Uint8Array.of(0xc0, 0); },
  disconnect() { return Uint8Array.of(0xe0, 0); }
};

export class MqttLite {
  constructor(url, { clientId, keepAlive = 40, onMessage, onState } = {}) {
    this.url = url; this.clientId = clientId; this.keepAlive = keepAlive;
    this.onMessage = onMessage || (() => {}); this.onState = onState || (() => {});
    this.ws = null; this.buf = new Uint8Array(0); this.pid = 1; this.connected = false;
    this.topics = new Set(); this.pingTimer = null; this.lastIn = 0; this.closedByUser = false;
    this.retry = 0; this.retryTimer = null;
  }

  connect() {
    this.closedByUser = false;
    clearTimeout(this.retryTimer);
    let ws;
    try { ws = new WebSocket(this.url, ["mqtt"]); } catch (e) { this._scheduleRetry(); return; }
    ws.binaryType = "arraybuffer";
    this.ws = ws; this.buf = new Uint8Array(0);
    ws.onopen = () => { ws.send(encode.connect(this.clientId, this.keepAlive)); };
    ws.onmessage = ev => {
      this.lastIn = Date.now();
      const chunk = new Uint8Array(ev.data);
      this.buf = this.buf.length ? concat([this.buf, chunk]) : chunk;
      this._parse();
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      const was = this.connected;
      this.connected = false; clearInterval(this.pingTimer);
      if (this.ws === ws) this.ws = null;
      if (was) this.onState("down");
      if (!this.closedByUser) this._scheduleRetry();
    };
  }

  _scheduleRetry() {
    const wait = Math.min(10000, 1500 * Math.pow(1.6, this.retry++));
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), wait);
  }

  _parse() {
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      let mult = 1, len = 0, i = 1, byte;
      do {
        if (i >= b.length) return;
        byte = b[i++]; len += (byte & 127) * mult; mult *= 128;
        if (i > 5) { this.ws && this.ws.close(); return; }
      } while (byte & 128);
      if (b.length < i + len) return;
      const type = b[0] >> 4, flags = b[0] & 15, body = b.subarray(i, i + len);
      this.buf = b.subarray(i + len);
      this._handle(type, flags, body);
    }
  }

  _handle(type, flags, body) {
    if (type === 2) {                         // CONNACK
      if (body[1] !== 0) { this.onState("refused"); this.ws && this.ws.close(); return; }
      this.connected = true; this.retry = 0;
      for (const t of this.topics) this._send(encode.subscribe(this._pid(), t));
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (Date.now() - this.lastIn > this.keepAlive * 1500) { this.ws && this.ws.close(); return; }
        this._send(encode.pingreq());
      }, (this.keepAlive * 1000) / 2);
      this.onState("up");
    } else if (type === 3) {                  // PUBLISH
      const qos = (flags >> 1) & 3;
      const tl = (body[0] << 8) | body[1];
      const topic = td.decode(body.subarray(2, 2 + tl));
      let o = 2 + tl;
      if (qos > 0) {                          // we only subscribe at QoS 0, but acknowledge just in case
        const p1 = body[o], p2 = body[o + 1]; o += 2;
        if (qos === 1) this._send(Uint8Array.of(0x40, 2, p1, p2));
      }
      let text;
      try { text = td.decode(body.subarray(o)); } catch (e) { return; }
      this.onMessage(topic, text);
    }
    // SUBACK (9), UNSUBACK (11), PINGRESP (13): nothing to do
  }

  _pid() { this.pid = (this.pid % 65535) + 1; return this.pid; }
  _send(bytes) { if (this.ws && this.ws.readyState === 1) { this.ws.send(bytes); return true; } return false; }

  subscribe(topic) {
    this.topics.add(topic);
    if (this.connected) this._send(encode.subscribe(this._pid(), topic));
  }
  unsubscribe(topic) {
    this.topics.delete(topic);
    if (this.connected) this._send(encode.unsubscribe(this._pid(), topic));
  }
  publish(topic, text) { return this.connected && this._send(encode.publish(topic, text)); }

  close() {
    this.closedByUser = true;
    clearTimeout(this.retryTimer); clearInterval(this.pingTimer);
    if (this.ws) { try { this._send(encode.disconnect()); this.ws.close(); } catch (e) {} }
    this.ws = null; this.connected = false;
  }
}
