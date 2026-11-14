const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '50kb' }));
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 6e6 });

app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/rooms', (req, res) => {
  const out = [];
  for (const [name, r] of rooms) if (r.players.size) out.push({ name, players: r.players.size, locked: !!(store.rooms[name] && store.rooms[name].pw) });
  out.sort((a, b) => b.players - a.players);
  res.json(out.slice(0, 30));
});
app.post('/api/room-check', (req, res) => {
  const b = req.body || {};
  const name = String(b.room || '').slice(0, 30).replace(/[^\w-]/g, '').toLowerCase() || 'main';
  const meta = store.rooms[name];
  res.json({ ok: pwOk(meta, b.password, b.uid), exists: rooms.has(name) || !!(meta && meta.pw), locked: !!(meta && meta.pw) });
});

/* ---------- Lưu trữ: mã VIP, mật khẩu phòng, giao diện phòng (data/meta.json, KHÔNG đưa lên git) ---------- */
const DATA_DIR = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
const META_FILE = path.join(DATA_DIR, 'meta.json');
let store = { codes: {}, rooms: {} };
try { store = Object.assign(store, JSON.parse(fs.readFileSync(META_FILE, 'utf8'))); } catch (e) {}
let saveTimer = null;
function saveStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    for (const [n, m] of Object.entries(store.rooms)) if (!m.pw && !Object.keys(m.theme || {}).length && !rooms.has(n)) delete store.rooms[n];
    try { fs.writeFileSync(META_FILE, JSON.stringify(store)); } catch (e) {}
  }, 1500);
}
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const safeEq = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
let ADMIN_KEY = (process.env.ADMIN_KEY || '').trim();
if (!ADMIN_KEY) {
  const kf = path.join(DATA_DIR, 'admin-key.txt');
  try { ADMIN_KEY = fs.readFileSync(kf, 'utf8').trim(); } catch (e) {}
  if (!ADMIN_KEY) { ADMIN_KEY = 'ADMIN-' + crypto.randomBytes(9).toString('hex').toUpperCase(); try { fs.writeFileSync(kf, ADMIN_KEY); } catch (e) {} }
}
console.log(`🔑 MÃ ADMIN (chỉ mình bạn biết): ${ADMIN_KEY}  — nhập ở nút 👑 trong game để tạo mã VIP cho người khác`);
const ENV_VIP = (process.env.VIP_CODES || '').split(',').map((s) => s.trim()).filter(Boolean);
function codeLevel(code) { // 0 = sai, 1 = VIP, 2 = admin
  code = String(code || '').trim().slice(0, 60);
  if (!code) return 0;
  if (safeEq(code, ADMIN_KEY)) return 2;
  if (ENV_VIP.some((c) => safeEq(code, c))) return 1;
  for (const c of Object.keys(store.codes)) if (safeEq(code, c)) return 1;
  return 0;
}
const listCodes = () => Object.entries(store.codes).map(([code, v]) => ({ code, label: v.label, created: v.created }));
const pwHash = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString('hex');
function pwOk(meta, pw, uid) {
  if (!meta || !meta.pw) return true;
  if (uid && meta.owner && meta.owner === uid) return true;
  try { return safeEq(pwHash(pw || '', meta.pw.salt), meta.pw.hash); } catch (e) { return false; }
}
const THEME_SLOTS = ['floor', 'wallL', 'wallR', 'wallBack', 'ceiling', 'flagL', 'flagR', 'title'];
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

// rooms: name -> { players: Map, video: {id,time,playing,ts} }
const rooms = new Map();
function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, { players: new Map(), chat: [], seats: new Map(), tables: {}, claw: { by: null, state: null }, poolSeats: { A: null, B: null, turn: 'A' }, arc: {}, pool: newPool(), pp: { A: null, B: null, score: [0, 0], chain: 0, rally: 0, running: false, hitAt: { A: 0, B: 0 } }, video: { id: 'dQw4w9WgXcQ', time: 0, playing: false, ts: Date.now() } });
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
const poolActive = (room) => { const s = room.poolSeats; return !!(s.A && s.B && room.players.has(s.A) && room.players.has(s.B)); };
function poolSeatsPublic(room) {
  const s = room.poolSeats, nm = (id) => (id && room.players.get(id) ? room.players.get(id).name : null);
  return { A: nm(s.A), B: nm(s.B), idA: s.A, idB: s.B, turn: s.turn, active: poolActive(room) };
}
const poolSeatsBroadcast = (rn, room) => io.to(rn).emit('pool-seats', poolSeatsPublic(room));
function poolLeave(rn, room, id) {
  const s = room.poolSeats; let ch = false;
  for (const k of ['A', 'B']) if (s[k] === id) { s[k] = null; ch = true; }
  if (ch) { s.turn = 'A'; poolSeatsBroadcast(rn, room); }
}
function poolShoot(rn, room, angle, power, by, id) {
  const pool = room.pool, seats = room.poolSeats;
  if (pool.moving || pool.balls[0].out) return;
  if (poolActive(room) && seats[seats.turn] !== id) { io.to(id).emit('pool-event', { text: 'Chưa tới lượt bạn nhé 🎱' }); return; }
  const sp = 0.8 + Math.min(1, Math.max(0, power)) * 5.5;
  pool.balls[0].vx = Math.cos(angle) * sp; pool.balls[0].vy = Math.sin(angle) * sp;
  pool.moving = true; pool.by = by; pool.shot = [];
  pool.timer = setInterval(() => {
    let res;
    for (let s = 0; s < 4; s++) res = poolStep(pool, 1 / 120);
    for (const i of res.ev) {
      pool.shot.push(i);
      if (i === 0) io.to(rn).emit('pool-event', { text: `${by} bị rơi bi trắng! ⚪` });
      else io.to(rn).emit('pool-event', { text: `${by} bỏ bi số ${i} vào lỗ 🎱` });
    }
    if (!res.moving) {
      clearInterval(pool.timer); pool.timer = null; pool.moving = false;
      const scratch = pool.balls[0].out;
      if (scratch) Object.assign(pool.balls[0], { x: -PL / 4, y: 0, vx: 0, vy: 0, out: false });
      if (poolActive(room)) {
        const side = seats.turn, mine = (i) => (side === 'A' ? i >= 1 && i <= 5 : i >= 6 && i <= 10);
        const own = pool.shot.some((i) => i > 0 && mine(i));
        const aDone = pool.balls.slice(1, 6).every((b) => b.out), bDone = pool.balls.slice(6, 11).every((b) => b.out);
        const ps = poolSeatsPublic(room);
        if (aDone || bDone) {
          const w = aDone && !bDone ? 'A' : bDone && !aDone ? 'B' : side;
          io.to(rn).emit('pool-event', { text: `🏆 ${ps[w]} thắng ván bi-a! Xếp lại bi...` });
          setTimeout(() => { seats.turn = 'A'; poolReset(rn, room); poolSeatsBroadcast(rn, room); }, 3000);
        } else {
          if (scratch || !own) seats.turn = side === 'A' ? 'B' : 'A';
          poolSeatsBroadcast(rn, room);
          io.to(rn).emit('pool-event', { text: `Lượt của ${poolSeatsPublic(room)[seats.turn]} (bi ${seats.turn === 'A' ? '1-5' : '6-10'})` });
        }
      } else if (pool.balls.slice(1).every((b) => b.out)) { io.to(rn).emit('pool-event', { text: `🎉 ${by} đã dọn sạch bàn! Xếp lại bi...` }); setTimeout(() => poolReset(rn, room), 2500); }
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
/* ---------- Máy game console nhiều người (chủ phòng chạy game, server chuyển tiếp) ---------- */
const ARC_MAX = { ludo: 4, bomber: 4, tank: 4 };
const arcLobby = (room, g) => room.arc[g] || (room.arc[g] = { players: [], host: null, started: false });
const arcMembers = (room, g) => arcLobby(room, g).players.map((id, slot) => (id && room.players.has(id) ? { id, name: room.players.get(id).name, slot } : null)).filter(Boolean);
function arcCounts(room) { const o = {}; for (const g of Object.keys(ARC_MAX)) o[g] = room.arc[g] ? arcMembers(room, g).length : 0; return o; }
function arcBroadcast(rn, room, g) {
  const l = arcLobby(room, g), pl = arcMembers(room, g);
  for (const m of pl) io.to(m.id).emit('arc-lobby', { game: g, players: pl, host: l.host, started: l.started });
  io.to(rn).emit('arc-counts', arcCounts(room));
}
function arcLeave(rn, room, id) {
  for (const g of Object.keys(ARC_MAX)) {
    const l = room.arc[g];
    if (!l || !l.players.includes(id)) continue;
    if (l.host === id) {
      for (const m of l.players) if (m && m !== id) io.to(m).emit('arc-ended', { game: g, reason: 'Chủ phòng đã thoát' });
      room.arc[g] = { players: [], host: null, started: false };
    } else if (l.started) {
      const slot = l.players.indexOf(id); l.players[slot] = null;
      io.to(l.host).emit('arc-left', { game: g, slot });
      if (!l.players.some((m, i) => m && m !== l.host)) { /* chỉ còn chủ phòng: giữ ván đến khi thoát */ }
    } else {
      l.players.splice(l.players.indexOf(id), 1); arcBroadcast(rn, room, g);
    }
  }
  io.to(rn).emit('arc-counts', arcCounts(room));
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
    roomName = clean(r, 30).replace(/[^\w-]/g, '').toLowerCase() || 'main';
    const meta0 = store.rooms[roomName];
    if (!pwOk(meta0, data.password, clean(data.uid, 40))) return socket.emit('join-denied', { reason: 'pw' });
    if (!rooms.has(roomName) && !(meta0 && meta0.pw)) { store.rooms[roomName] = { pw: null, owner: clean(data.uid, 40) || null, theme: meta0 ? meta0.theme || {} : {} }; saveStore(); } // phòng mới (hoặc phòng trống không mật khẩu): người vào đầu là chủ phòng
    socket.data.uid = clean(data.uid, 40);
    room = getRoom(roomName);
    // cùng 1 tab vào lại -> xoá nhân vật cũ
    if (cid) {
      for (const [oid, op] of room.players) {
        if (op.cid === cid && oid !== socket.id) {
          room.players.delete(oid);
          freeSeats(room, oid);
          ppLeave(roomName, room, oid); poolLeave(roomName, room, oid); arcLeave(roomName, room, oid);
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
    socket.emit('init', { id: socket.id, players: [...room.players.values()], video: currentVideo(room.video), tables: room.tables, chat: room.chat, pool: { balls: poolPublic(room.pool), moving: room.pool.moving }, pp: ppPublic(room), clawState: room.claw.state, poolSeats: poolSeatsPublic(room), arcCounts: arcCounts(room),
      theme: (store.rooms[roomName] || {}).theme || {}, locked: !!(store.rooms[roomName] && store.rooms[roomName].pw), isOwner: !!(store.rooms[roomName] && store.rooms[roomName].owner && store.rooms[roomName].owner === socket.data.uid) });
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
    poolShoot(roomName, room, +angle, +power, p.name, socket.id);
  });
  socket.on('pool-get', () => { if (!room) return; socket.emit('pool', { balls: poolPublic(room.pool), moving: room.pool.moving }); socket.emit('pool-seats', poolSeatsPublic(room)); });
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
  /* ----- VIP / admin / giao diện phòng / mật khẩu phòng ----- */
  const tries = [];
  socket.on('vip-login', ({ code } = {}) => {
    const now = Date.now();
    while (tries.length && now - tries[0] > 60000) tries.shift();
    if (tries.length >= 8) return socket.emit('vip-status', { vip: false, error: 'Thử quá nhiều lần, đợi 1 phút rồi thử lại' });
    tries.push(now);
    const lv = codeLevel(code);
    socket.vip = lv >= 1; socket.admin = lv === 2; socket.vipCode = lv ? String(code).trim() : null;
    socket.emit('vip-status', { vip: socket.vip, admin: socket.admin, error: lv ? null : 'Mã không đúng' });
    if (socket.admin) socket.emit('vip-codes', listCodes());
  });
  socket.on('vip-gen', ({ label } = {}) => {
    if (!socket.admin) return;
    const al = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = (n) => Array.from(crypto.randomBytes(n), (b) => al[b % al.length]).join('');
    const code = `VIP-${r(4)}-${r(4)}`;
    store.codes[code] = { label: clean(label, 30), created: Date.now() };
    saveStore(); socket.emit('vip-codes', listCodes());
  });
  socket.on('vip-revoke', ({ code } = {}) => {
    if (!socket.admin || !store.codes[code]) return;
    delete store.codes[code]; saveStore();
    for (const s of io.sockets.sockets.values()) if (s.vipCode === code && !s.admin) { s.vip = false; s.emit('vip-status', { vip: false, admin: false, error: 'Mã VIP của bạn đã bị thu hồi' }); }
    socket.emit('vip-codes', listCodes());
  });
  socket.on('theme-set', ({ slot, data } = {}) => {
    if (!room || !socket.vip || !THEME_SLOTS.includes(slot)) return;
    if (data !== null && !(typeof data === 'string' && data.length <= 450000 && IMG_RE.test(data))) return;
    const meta = store.rooms[roomName] || (store.rooms[roomName] = { pw: null, owner: null, theme: {} });
    meta.theme = meta.theme || {};
    if (data) meta.theme[slot] = data; else delete meta.theme[slot];
    saveStore();
    io.to(roomName).emit('theme', { slot, data: data || null });
  });
  socket.on('theme-reset-all', () => {
    if (!room || !socket.vip) return;
    const meta = store.rooms[roomName]; if (!meta) return;
    meta.theme = {}; saveStore();
    for (const s of THEME_SLOTS) io.to(roomName).emit('theme', { slot: s, data: null });
  });
  socket.on('room-pw-set', ({ pw } = {}) => {
    if (!room) return;
    const meta = store.rooms[roomName] || (store.rooms[roomName] = { pw: null, owner: null, theme: {} });
    if (!(socket.vip || (meta.owner && meta.owner === socket.data.uid))) return socket.emit('pool-event', { text: 'Chỉ chủ phòng hoặc VIP mới đặt được mật khẩu' });
    pw = String(pw || '').slice(0, 40);
    if (!pw) meta.pw = null; else { const salt = crypto.randomBytes(8).toString('hex'); meta.pw = { salt, hash: pwHash(pw, salt) }; }
    saveStore();
    io.to(roomName).emit('room-info', { locked: !!meta.pw });
    io.to(roomName).emit('pool-event', { text: meta.pw ? '🔒 Phòng đã được đặt mật khẩu' : '🔓 Phòng đã bỏ mật khẩu' });
  });

  socket.on('pool-sit', () => {
    if (!room) return;
    const s = room.poolSeats;
    if (s.A === socket.id || s.B === socket.id) return;
    if (!s.A || !room.players.has(s.A)) s.A = socket.id; else if (!s.B || !room.players.has(s.B)) s.B = socket.id; else return socket.emit('pool-event', { text: 'Bàn bi-a đã đủ 2 người chơi' });
    if (poolActive(room)) {
      s.turn = 'A'; poolReset(roomName, room);
      const ps = poolSeatsPublic(room);
      io.to(roomName).emit('pool-event', { text: `🎱 Ván 2 người: ${ps.A} (bi 1-5) vs ${ps.B} (bi 6-10). ${ps.A} đánh trước!` });
    }
    poolSeatsBroadcast(roomName, room);
  });
  socket.on('pool-stand', () => { if (room) poolLeave(roomName, room, socket.id); });

  socket.on('arc-join', ({ game }) => {
    if (!room || !ARC_MAX[game] || !room.players.has(socket.id)) return;
    arcLeave(roomName, room, socket.id);
    const l = arcLobby(room, game);
    if (l.started) return socket.emit('arc-busy', { game });
    if (l.players.length >= ARC_MAX[game]) return socket.emit('arc-full', { game });
    l.players.push(socket.id); if (!l.host) l.host = socket.id;
    arcBroadcast(roomName, room, game);
  });
  socket.on('arc-leave', () => { if (room) arcLeave(roomName, room, socket.id); });
  socket.on('arc-start', ({ game }) => {
    if (!room || !ARC_MAX[game]) return;
    const l = arcLobby(room, game);
    if (l.host !== socket.id || l.started || arcMembers(room, game).length < 2) return;
    l.started = true;
    const pl = arcMembers(room, game);
    for (const m of pl) io.to(m.id).emit('arc-started', { game, players: pl, host: l.host });
    io.to(roomName).emit('arc-counts', arcCounts(room));
  });
  socket.on('arc-restart', ({ game }) => {
    if (!room || !ARC_MAX[game]) return;
    const l = arcLobby(room, game);
    if (l.host !== socket.id || !l.started) return;
    const pl = arcMembers(room, game);
    for (const m of pl) io.to(m.id).emit('arc-started', { game, players: pl, host: l.host });
  });
  socket.on('arc-input', ({ game, data }) => {
    if (!room || !ARC_MAX[game]) return;
    const l = room.arc[game];
    if (!l || !l.started || l.host === socket.id) return;
    const slot = l.players.indexOf(socket.id);
    if (slot >= 0) io.to(l.host).emit('arc-input', { slot, data });
  });
  socket.on('arc-state', ({ game, data }) => {
    if (!room || !ARC_MAX[game]) return;
    const l = room.arc[game];
    if (!l || l.host !== socket.id) return;
    for (const m of l.players) if (m && m !== socket.id) io.to(m).emit('arc-state', { game, data });
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
    ppLeave(roomName, room, socket.id); poolLeave(roomName, room, socket.id); arcLeave(roomName, room, socket.id);
    if (room.claw.by === socket.id) room.claw.by = null;
    room.players.delete(socket.id);
    io.to(roomName).emit('player-leave', socket.id);
    io.to(roomName).emit('count', room.players.size);
    if (room.players.size === 0) { if (room.pool.timer) clearInterval(room.pool.timer); room.pp.chain++; rooms.delete(roomName); }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Cinema chạy tại http://localhost:${PORT}`));
