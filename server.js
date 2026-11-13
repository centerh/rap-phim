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
  if (!rooms.has(name)) rooms.set(name, { players: new Map(), chat: [], seats: new Map(), tables: {}, video: { id: 'dQw4w9WgXcQ', time: 0, playing: false, ts: Date.now() } });
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
    socket.emit('init', { id: socket.id, players: [...room.players.values()], video: currentVideo(room.video), tables: room.tables, chat: room.chat });
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
    room.players.delete(socket.id);
    io.to(roomName).emit('player-leave', socket.id);
    io.to(roomName).emit('count', room.players.size);
    if (room.players.size === 0) rooms.delete(roomName);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Cinema chạy tại http://localhost:${PORT}`));
