const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 2e6 });

app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));
app.use(express.static(path.join(__dirname, 'public')));

// rooms: name -> { players: Map, video: {id,time,playing,ts} }
const rooms = new Map();
function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, { players: new Map(), chat: [], seats: new Map(), tables: {}, claw: { by: null, state: null }, pool: newPool(), pp: { A: null, B: null, score: [0, 0], chain: 0, rally: 0, running: false, hitAt: { A: 0, B: 0 } }, video: { id: 'dQw4w9WgXcQ', time: 0, playing: false, ts: Date.now() } });
  return rooms.get(name);
}
const FACES = ['happy', 'normal', 'surprised', 'sad', 'angry', 'wink', 'laugh'];
const ITEM_KEYS = ['popcorn', 'caramel', 'coke', 'pepsi', 'orange', 'peach', 'milktea', 'water'];
function freeSeats(room, id) {
  for (const [s, o] of room.seats) if (o === id) room.seats.delete(s);
}
function currentVideo(v) {
  const time = v.playing ? v.time + (Date.now() - v.ts) / 1000 : v.time;
  return { id: v.id, time, playing: v.playing };
}
const clean = (s, n) => String(s || '').slice(0, n);

/* ---------- Bi-a (vật lý chạy trên server) ---------- */
const PL = 3.0, PW = 1.5, BR = 0.065;
const POCKETS = [[-PL / 2, -PW / 2], [0, -PW / 2], [PL / 2, -PW / 2], [-PL / 2, PW / 2], [0, PW / 2], [PL / 2, PW / 2]];
function newPool() {
  const balls = [{ x: -PL / 4, y: 0, vx: 0, vy: 0, out: false }];
  const dx = BR * 2 * 0.87 + 0.003, dy = BR * 2 + 0.003;
  for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) balls.push({ x: PL / 4 + r * dx, y: (k - r / 2) * dy, vx: 0, vy: 0, out: false });
  return { balls, moving: false, timer: null, by: '' };
}
function poolStep(pool, dt) {
  const B = pool.balls, ev = [];
  let moving = false;
  for (let i = 0; i < B.length; i++) {
    const b = B[i]; if (b.out) continue;
    b.x += b.vx * dt; b.y += b.vy * dt;
    const f = Math.pow(0.4, dt); b.vx *= f; b.vy *= f;
    if (Math.hypot(b.vx, b.vy) < 0.04) { b.vx = 0; b.vy = 0; } else moving = true;
    if (b.x < -PL / 2 + BR) { b.x = -PL / 2 + BR; b.vx = Math.abs(b.vx) * 0.9; }
    if (b.x > PL / 2 - BR) { b.x = PL / 2 - BR; b.vx = -Math.abs(b.vx) * 0.9; }
    if (b.y < -PW / 2 + BR) { b.y = -PW / 2 + BR; b.vy = Math.abs(b.vy) * 0.9; }
    if (b.y > PW / 2 - BR) { b.y = PW / 2 - BR; b.vy = -Math.abs(b.vy) * 0.9; }
    for (const [px, py] of POCKETS) if (Math.hypot(b.x - px, b.y - py) < 0.13) { b.out = true; b.vx = b.vy = 0; ev.push(i); break; }
  }
  for (let i = 0; i < B.length; i++) {
    if (B[i].out) continue;
    for (let j = i + 1; j < B.length; j++) {
      if (B[j].out) continue;
      const a = B[i], c = B[j];
      let nx = a.x - c.x, ny = a.y - c.y; const d = Math.hypot(nx, ny);
      if (d > 0 && d < BR * 2) {
        nx /= d; ny /= d;
        const o = (BR * 2 - d) / 2; a.x += nx * o; a.y += ny * o; c.x -= nx * o; c.y -= ny * o;
        const vn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (vn < 0) { a.vx -= vn * nx; a.vy -= vn * ny; c.vx += vn * nx; c.vy += vn * ny; }
      }
    }
  }
  return { moving, ev };
}
const poolPublic = (pool) => pool.balls.map((b) => [+b.x.toFixed(3), +b.y.toFixed(3), b.out ? 1 : 0]);
function poolShoot(rn, room, angle, power, by) {
  const pool = room.pool;
  if (pool.moving || pool.balls[0].out) return;
  const sp = 0.8 + Math.min(1, Math.max(0, power)) * 5.5;
  pool.balls[0].vx = Math.cos(angle) * sp; pool.balls[0].vy = Math.sin(angle) * sp;
  pool.moving = true; pool.by = by;
  pool.timer = setInterval(() => {
    let res;
    for (let s = 0; s < 4; s++) res = poolStep(pool, 1 / 120);
    for (const i of res.ev) {
      if (i === 0) io.to(rn).emit('pool-event', { text: `${by} bị rơi bi trắng! ⚪` });
      else io.to(rn).emit('pool-event', { text: `${by} bỏ bi số ${i} vào lỗ 🎱` });
    }
    if (!res.moving) {
      clearInterval(pool.timer); pool.timer = null; pool.moving = false;
      if (pool.balls[0].out) { Object.assign(pool.balls[0], { x: -PL / 4, y: 0, vx: 0, vy: 0, out: false }); }
      if (pool.balls.slice(1).every((b) => b.out)) { io.to(rn).emit('pool-event', { text: `🎉 ${by} đã dọn sạch bàn! Xếp lại bi...` }); setTimeout(() => poolReset(rn, room), 2500); }
    }
    io.to(rn).emit('pool', { balls: poolPublic(pool), moving: pool.moving });
  }, 33);
}
function poolReset(rn, room) {
  if (room.pool.timer) clearInterval(room.pool.timer);
  room.pool = newPool();
  io.to(rn).emit('pool', { balls: poolPublic(room.pool), moving: false });
}

/* ---------- Bóng bàn (đối đầu với máy hoặc người) ---------- */
const opp = (s) => (s === 'A' ? 'B' : 'A');
const ppHumans = (room) => ['A', 'B'].filter((s) => room.pp[s] && room.players.has(room.pp[s]));
function ppPublic(room) {
  const n = (s) => (room.pp[s] && room.players.get(room.pp[s]) ? room.players.get(room.pp[s]).name : null);
  return { A: n('A'), B: n('B'), ids: { A: room.pp.A, B: room.pp.B }, score: room.pp.score };
}
function ppFlight(rn, room, from, dur, token) {
  const pp = room.pp;
  if (token !== pp.chain) return;
  const to = opp(from);
  pp.hitAt[to] = 0;
  const arrive = Date.now() + dur * 1000;
  io.to(rn).emit('pp-ball', { from, to, dur });
  setTimeout(() => {
    if (token !== pp.chain) return;
    const human = pp[to] && room.players.has(pp[to]);
    const ok = human ? pp.hitAt[to] >= arrive - 650 : Math.random() < 0.8;
    if (ok) {
      pp.rally++;
      io.to(rn).emit('pp-swing', { side: to });
      ppFlight(rn, room, to, Math.max(0.6, 1.1 - pp.rally * 0.04), token);
    } else {
      const wi = from === 'A' ? 0 : 1;
      pp.score[wi]++; pp.rally = 0;
      io.to(rn).emit('pp-miss', { side: to });
      if (pp.score[wi] >= 11) {
        const nm = ppPublic(room)[from] || 'Máy';
        io.to(rn).emit('pool-event', { text: `🏓 ${nm} thắng ván bóng bàn ${pp.score[0]}-${pp.score[1]}!` });
        pp.score = [0, 0];
      }
      io.to(rn).emit('pp', ppPublic(room));
      setTimeout(() => { if (token === pp.chain && ppHumans(room).length) ppServe(rn, room, from); }, 1700);
    }
  }, dur * 1000 + 250);
}
function ppServe(rn, room, from) {
  room.pp.chain++; room.pp.running = true;
  ppFlight(rn, room, from, 1.1, room.pp.chain);
}
function ppLeave(rn, room, id) {
  const pp = room.pp;
  for (const s of ['A', 'B']) if (pp[s] === id) pp[s] = null;
  if (!ppHumans(room).length) { pp.chain++; pp.running = false; pp.score = [0, 0]; pp.rally = 0; io.to(rn).emit('pp-stop'); }
  io.to(rn).emit('pp', ppPublic(room));
}

io.on('connection', (socket) => {
  let roomName = null;
  let room = null;

  socket.on('join', (data) => {
    const { room: r, name, look } = data;
    const cid = clean(data.cid, 40);
    roomName = clean(r, 30).replace(/[^\w-]/g, '') || 'main';
    room = getRoom(roomName);
    // cùng 1 tab vào lại -> xoá nhân vật cũ
    if (cid) {
      for (const [oid, op] of room.players) {
        if (op.cid === cid && oid !== socket.id) {
          room.players.delete(oid);
          freeSeats(room, oid);
          ppLeave(roomName, room, oid);
          if (room.claw.by === oid) room.claw.by = null;
          io.to(roomName).emit('player-leave', oid);
          io.sockets.sockets.get(oid)?.disconnect(true);
        }
      }
    }
    socket.join(roomName);
    const p = {
      cid,
      id: socket.id,
      name: clean(name, 20) || 'Khách',
      look: {
        skin: clean(look && look.skin, 9), shirt: clean(look && look.shirt, 9), pants: clean(look && look.pants, 9),
        hair: clean(look && look.hair, 9),
        gender: look && look.gender === 'female' ? 'female' : 'male',
        hairStyle: Math.min(5, Math.max(1, (look && look.hairStyle | 0) || 1)),
        face: FACES.includes(look && look.face) ? look.face : 'normal',
        jersey: ['blg', 'geng'].includes(look && look.jersey) ? look.jersey : '',
        texture: look && typeof look.texture === 'string' && look.texture.startsWith('data:image/') && look.texture.length < 600000 ? look.texture : null,
      },
      x: (Math.random() - 0.5) * 6, z: 6, ry: 0,
    };
    room.players.set(socket.id, p);
    socket.emit('init', { id: socket.id, players: [...room.players.values()], video: currentVideo(room.video), tables: room.tables, chat: room.chat, pool: { balls: poolPublic(room.pool), moving: room.pool.moving }, pp: ppPublic(room), clawState: room.claw.state });
    socket.to(roomName).emit('player-join', p);
    io.to(roomName).emit('count', room.players.size);
  });

  socket.on('move', (m) => {
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p || p.seat) return;
    p.x = +m.x || 0; p.z = +m.z || 0; p.ry = +m.ry || 0;
    socket.to(roomName).volatile.emit('player-move', { id: socket.id, x: p.x, z: p.z, ry: p.ry, moving: !!m.moving });
  });

  socket.on('chat', (text) => {
    if (!room) return;
    const p = room.players.get(socket.id);
    const t = clean(text, 200).trim();
    if (!p || !t) return;
    const msg = { id: socket.id, name: p.name, text: t, ts: Date.now() };
    room.chat.push(msg); if (room.chat.length > 50) room.chat.shift();
    io.to(roomName).emit('chat', msg);
  });

  socket.on('voice', ({ data, mime, dur }) => {
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p || !data) return;
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const now = Date.now();
    if (buf.length > 400000 || buf.length < 100 || (p.lastVoice && now - p.lastVoice < 800)) return;
    if (!String(mime || '').startsWith('audio/')) return;
    p.lastVoice = now;
    socket.to(roomName).emit('voice', { id: socket.id, name: p.name, data: buf, mime: clean(mime, 40), dur: Math.min(10, Math.max(1, Math.round(+dur || 1))) });
  });

  socket.on('face', (f) => {
    if (!room || !FACES.includes(f)) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    p.look.face = f;
    io.to(roomName).emit('face', { id: socket.id, face: f });
  });

  socket.on('pool-shot', ({ angle, power }) => {
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p || !Number.isFinite(+angle) || !Number.isFinite(+power)) return;
    poolShoot(roomName, room, +angle, +power, p.name);
  });
  socket.on('pool-reset', () => { if (room) poolReset(roomName, room); });

  socket.on('pp-join', ({ side }) => {
    if (!room || !room.players.has(socket.id)) return;
    const pp = room.pp;
    for (const s of ['A', 'B']) if (pp[s] === socket.id) pp[s] = null;
    const want = side === 'B' ? 'B' : 'A';
    const slot = !pp[want] || !room.players.has(pp[want]) ? want : (!pp[opp(want)] || !room.players.has(pp[opp(want)]) ? opp(want) : null);
    if (!slot) return socket.emit('pp-full');
    pp[slot] = socket.id;
    socket.emit('pp-side', slot);
    io.to(roomName).emit('pp', ppPublic(room));
    if (!pp.running) setTimeout(() => { if (ppHumans(room).length && !pp.running) ppServe(roomName, room, opp(slot)); }, 1200);
  });
  socket.on('pp-leave', () => { if (room) ppLeave(roomName, room, socket.id); });
  socket.on('pp-hit', () => {
    if (!room) return;
    const pp = room.pp;
    for (const s of ['A', 'B']) if (pp[s] === socket.id) pp.hitAt[s] = Date.now();
  });

  socket.on('dance', (on) => {
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    p.dance = !!on;
    if (on) { freeSeats(room, socket.id); p.seat = null; }
    io.to(roomName).emit('dance', { id: socket.id, on: p.dance });
  });

  socket.on('claw-join', () => {
    if (!room) return;
    const c = room.claw;
    if (c.by && c.by !== socket.id && room.players.has(c.by)) return socket.emit('claw-busy');
    c.by = socket.id;
  });
  socket.on('claw-leave', () => { if (room && room.claw.by === socket.id) room.claw.by = null; });
  socket.on('claw-state', (s) => {
    if (!room || room.claw.by !== socket.id || !s) return;
    const n = (v, a, b) => Math.min(b, Math.max(a, +v || 0));
    const st = { x: n(s.x, -0.6, 0.6), y: n(s.y, 1, 2.5), z: n(s.z, -0.6, 0.6), open: n(s.open, 0, 1), hold: Number.isInteger(s.hold) && s.hold >= 0 && s.hold < 14 ? s.hold : -1 };
    room.claw.state = st;
    socket.to(roomName).emit('claw-state', st);
  });
  socket.on('claw-win', ({ toy }) => {
    if (!room || room.claw.by !== socket.id || !Number.isInteger(toy) || toy < 0 || toy > 13) return;
    const p = room.players.get(socket.id);
    io.to(roomName).emit('claw-won', { toy });
    io.to(roomName).emit('pool-event', { text: `🎉 ${p ? p.name : 'Ai đó'} gắp được một chú thú bông 🧸!` });
  });

  socket.on('attack', ({ target, type }) => {
    if (!room || !['punch', 'kick'].includes(type) || target === socket.id) return;
    const a = room.players.get(socket.id), v = room.players.get(target);
    if (!a || !v) return;
    const now = Date.now();
    if (a.lastAtk && now - a.lastAtk < 450) return;
    if (Math.hypot(a.x - v.x, a.z - v.z) > 5) return;
    a.lastAtk = now;
    io.to(roomName).emit('attack', { from: socket.id, to: target, type });
  });

  socket.on('video-set', (id) => {
    if (!room) return;
    room.video = { id: clean(id, 20), time: 0, playing: true, ts: Date.now() };
    io.to(roomName).emit('video', { ...currentVideo(room.video), by: room.players.get(socket.id)?.name, load: true });
  });

  socket.on('video-state', ({ playing, time }) => {
    if (!room) return;
    room.video.playing = !!playing;
    room.video.time = +time || 0;
    room.video.ts = Date.now();
    socket.to(roomName).emit('video', { ...currentVideo(room.video), load: false });
  });

  socket.on('sit', ({ seat, x, z }) => {
    if (!room || !/^s\d\d[ab]$/.test(String(seat))) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    const owner = room.seats.get(seat);
    if (owner && owner !== socket.id) return socket.emit('sit-denied', seat);
    freeSeats(room, socket.id);
    room.seats.set(seat, socket.id);
    p.seat = seat; p.x = +x || 0; p.z = +z || 0; p.ry = Math.PI;
    io.to(roomName).emit('seat', { id: socket.id, seat, x: p.x, z: p.z });
  });

  socket.on('stand', ({ x, z }) => {
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    freeSeats(room, socket.id);
    p.seat = null; p.x = +x || 0; p.z = +z || 0;
    io.to(roomName).emit('seat', { id: socket.id, seat: null, x: p.x, z: p.z });
  });

  socket.on('order', ({ table, item }) => {
    if (!room || !/^t\d\d$/.test(String(table)) || !ITEM_KEYS.includes(item)) return;
    const items = room.tables[table] || (room.tables[table] = []);
    items.push(item);
    if (items.length > 6) items.shift();
    io.to(roomName).emit('table', { table, items, by: room.players.get(socket.id)?.name, item });
  });

  socket.on('clear-table', (table) => {
    if (!room || !/^t\d\d$/.test(String(table))) return;
    room.tables[table] = [];
    io.to(roomName).emit('table', { table, items: [] });
  });

  socket.on('disconnect', () => {
    if (!room) return;
    freeSeats(room, socket.id);
    ppLeave(roomName, room, socket.id);
    if (room.claw.by === socket.id) room.claw.by = null;
    room.players.delete(socket.id);
    io.to(roomName).emit('player-leave', socket.id);
    io.to(roomName).emit('count', room.players.size);
    if (room.players.size === 0) { if (room.pool.timer) clearInterval(room.pool.timer); room.pp.chain++; rooms.delete(roomName); }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Cinema chạy tại http://localhost:${PORT}`));
