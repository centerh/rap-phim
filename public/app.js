import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

const $ = (id) => document.getElementById(id);
const socket = io ? io() : null;

/* ---------------- Avatar ---------------- */
const texLoader = new THREE.TextureLoader();

function makeAvatar(look) {
  const g = new THREE.Group();
  const mk = (c) => new THREE.MeshLambertMaterial({ color: c });
  const skin = mk(look.skin || '#f1c27d');
  const shirt = mk(look.shirt || '#3a7bd5');
  const pants = mk(look.pants || '#2d3436');
  const hair = mk(look.hair || '#3b2a1a');

  // thân (chibi): mặt trước/sau có thể dán ảnh thiết kế
  let front = shirt;
  if (look.texture) {
    const tex = texLoader.load(look.texture);
    tex.colorSpace = THREE.SRGBColorSpace;
    front = new THREE.MeshLambertMaterial({ map: tex });
  }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.5), [shirt, shirt, shirt, shirt, front, front]);
  torso.position.y = 0.95;
  g.add(torso);

  // đầu to tròn
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.68, 32, 24), skin);
  head.position.y = 1.85;
  g.add(head);

  // tóc: chỏm tròn + mái + tóc sau
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), hair);
  cap.position.set(0, 1.88, -0.04); cap.rotation.x = -0.35;
  g.add(cap);
  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 16, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4), hair);
  backHair.position.set(0, 1.82, -0.1); backHair.rotation.x = 0.0;
  g.add(backHair);
  for (const x of [-0.3, 0, 0.3]) {
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), hair);
    bang.position.set(x, 2.38 - Math.abs(x) * 0.25, 0.46); bang.scale.set(1, 0.8, 0.7);
    g.add(bang);
  }

  // mắt to, má hồng, miệng cười
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x151515 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blush = new THREE.MeshBasicMaterial({ color: 0xff8f9c });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), eyeMat);
    eye.position.set(s * 0.24, 1.84, 0.6); eye.scale.set(1, 1.35, 0.5);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), white);
    shine.position.set(s * 0.24 + 0.03, 1.9, 0.64);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), blush);
    cheek.position.set(s * 0.4, 1.68, 0.52); cheek.scale.set(1, 0.6, 0.4);
    g.add(eye, shine, cheek);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: 0x6b2a2a }));
  mouth.position.set(0, 1.68, 0.655); mouth.rotation.z = Math.PI;
  g.add(mouth);

  // tay chân ngắn tròn
  const limb = (mat, r, len, x, y, shoe) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
    m.position.y = -(len / 2 + r * 0.6);
    pivot.add(m);
    if (shoe) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(r * 1.25, 12, 8), shoe);
      sh.scale.set(1, 0.6, 1.4); sh.position.set(0, -(len + r * 1.2) + 0.02, 0.07);
      pivot.add(sh);
    }
    g.add(pivot);
    return pivot;
  };
  const shoeMat = mk('#f2f2f2');
  const armL = limb(shirt, 0.14, 0.3, -0.56, 1.25);
  const armR = limb(shirt, 0.14, 0.3, 0.56, 1.25);
  const legL = limb(pants, 0.17, 0.2, -0.24, 0.55, shoeMat);
  const legR = limb(pants, 0.17, 0.2, 0.24, 0.55, shoeMat);
  // bàn tay
  for (const a of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), skin);
    hand.position.y = -0.52; a.add(hand);
  }

  let t = 0;
  g.userData.animate = (moving, dt) => {
    if (g.userData.sit) {
      armL.rotation.x = -0.6; armR.rotation.x = -0.6;
      legL.rotation.x = -1.5; legR.rotation.x = -1.5;
      g.userData.bob = 0.3;
      return;
    }
    if (moving) t += dt * 10;
    else t *= 0.85;
    const s = Math.sin(t) * (moving ? 0.8 : 0.68);
    armL.rotation.x = s; armR.rotation.x = -s;
    legL.rotation.x = -s; legR.rotation.x = s;
    g.userData.bob = moving ? Math.abs(Math.sin(t)) * 0.08 : 0;
  };
  return g;
}

function textSprite(text, { size = 48, bg = null, color = '#fff', maxW = 512 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `bold ${size}px sans-serif`;
  const w = Math.min(maxW, Math.ceil(ctx.measureText(text).width) + 30);
  c.width = w; c.height = size + 24;
  ctx.font = `bold ${size}px sans-serif`;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 20); ctx.fill();
  }
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
  ctx.fillText(text, c.width / 2, c.height / 2, maxW - 20);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const k = 0.012;
  sp.scale.set(c.width * k, c.height * k, 1);
  sp.renderOrder = 10;
  return sp;
}

/* ---------------- Lobby / preview ---------------- */
const look = { skin: '#f1c27d', hair: '#3b2a1a', shirt: '#3a7bd5', pants: '#2d3436', texture: null };

const pv = $('preview');
const pvRenderer = new THREE.WebGLRenderer({ canvas: pv, antialias: true, alpha: true });
pvRenderer.setSize(pv.width, pv.height, false);
const pvScene = new THREE.Scene();
pvScene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.6));
const pvLight = new THREE.DirectionalLight(0xffffff, 1.2); pvLight.position.set(2, 4, 5); pvScene.add(pvLight);
const pvCam = new THREE.PerspectiveCamera(35, pv.width / pv.height, 0.1, 50);
pvCam.position.set(0, 1.8, 7); pvCam.lookAt(0, 1.4, 0);
let pvAvatar = null;
function rebuildPreview() {
  if (pvAvatar) pvScene.remove(pvAvatar);
  pvAvatar = makeAvatar(look);
  pvScene.add(pvAvatar);
}
rebuildPreview();
let inLobby = true;
(function pvLoop() {
  if (!inLobby) return;
  requestAnimationFrame(pvLoop);
  pvAvatar.rotation.y += 0.012;
  pvAvatar.userData.animate(false, 0);
  pvRenderer.render(pvScene, pvCam);
})();

for (const k of ['skin', 'hair', 'shirt', 'pants']) {
  $(k).addEventListener('input', (e) => { look[k] = e.target.value; rebuildPreview(); });
}
$('texture').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    // vẽ nền màu áo rồi đặt ảnh vừa khung (giữ tỉ lệ, cover)
    ctx.fillStyle = look.shirt; ctx.fillRect(0, 0, 256, 256);
    const s = Math.max(256 / img.width, 256 / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, (256 - w) / 2, (256 - h) / 2, w, h);
    look.texture = c.toDataURL('image/jpeg', 0.85);
    rebuildPreview();
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(f);
});
$('clearTex').onclick = () => { look.texture = null; $('texture').value = ''; rebuildPreview(); };

const savedName = localStorage.getItem('cinema-name');
if (savedName) $('name').value = savedName;
const qRoom = new URLSearchParams(location.search).get('room');
if (qRoom) $('room').value = qRoom;

/* ---------------- 3D cinema ---------------- */
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0d0d16, 25, 55);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
const cssRenderer = new CSS3DRenderer({ element: $('cssLayer') });
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  cssRenderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0xaab0ff, 0x221122, 1.1));
const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(5, 12, 8); scene.add(dl);

const clickables = [], seatsInfo = new Map(), tableGroups = new Map();
const BOUND = { x: 14, zMin: -11, zMax: 14 };
function buildRoom() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), new THREE.MeshLambertMaterial({ color: 0x2a1a14 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = 2; scene.add(floor);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x2a2038 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(32, 14), wallMat); back.position.set(0, 7, -14); scene.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(32, 14), wallMat); left.rotation.y = Math.PI / 2; left.position.set(-16, 7, 2); scene.add(left);
  const right = left.clone(); right.rotation.y = -Math.PI / 2; right.position.x = 16; scene.add(right);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), new THREE.MeshLambertMaterial({ color: 0x15101c }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 14, 2); scene.add(ceil);

  // màn hình chiếu: "lỗ" trong suốt ở WebGL để lộ iframe YouTube (CSS3D) phía sau
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(16.8, 9.8), new THREE.MeshBasicMaterial({ color: 0x050508 }));
  frame.position.set(0, 7, -13.95); scene.add(frame);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(16, 9),
    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, transparent: false, blending: THREE.NoBlending, fog: false }));
  hole.position.set(0, 7, -13.9); scene.add(hole);
  const holder = $('ytHolder');
  const cssObj = new CSS3DObject(holder);
  cssObj.position.set(0, 7, -13.9);
  cssObj.scale.setScalar(16 / 1280);
  scene.add(cssObj);
  const glow = new THREE.PointLight(0x88aaff, 40, 30); glow.position.set(0, 6, -10); scene.add(glow);
  const sign = textSprite('🎬 RẠP PHIM ONLINE', { size: 60, color: '#fff' });
  sign.position.set(0, 12.7, -13.5); sign.scale.multiplyScalar(1.6); scene.add(sign);

  // ---- Sofa cao cấp, mỗi cặp 2 sofa có bàn ở giữa ----
  const gold = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
  const woodDark = new THREE.MeshLambertMaterial({ color: 0x3b2314 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  function makeSofa(colorHex) {
    const grp = new THREE.Group();
    const vel = new THREE.MeshLambertMaterial({ color: colorHex });
    const velLight = new THREE.MeshLambertMaterial({ color: new THREE.Color(colorHex).offsetHSL(0, 0, 0.06) });
    add(grp, new THREE.BoxGeometry(2.3, 0.4, 1.2), vel, 0, 0.35, 0);
    add(grp, new THREE.BoxGeometry(1.8, 0.28, 0.95), velLight, 0, 0.67, 0.08);
    add(grp, new THREE.BoxGeometry(2.3, 1.0, 0.3), vel, 0, 1.0, 0.5);
    for (const s of [-1, 1]) {
      add(grp, new THREE.BoxGeometry(0.28, 0.75, 1.2), vel, s * 1.0, 0.72, 0);
      add(grp, new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), gold, s * 1.0, 0.1, -0.5);
      add(grp, new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), gold, s * 1.0, 0.1, 0.5);
    }
    // gối tựa
    for (const s of [-0.55, 0.55]) {
      const p = add(grp, new THREE.BoxGeometry(0.5, 0.45, 0.14), velLight, s, 1.0, 0.3);
      p.rotation.x = -0.25;
    }
    return grp;
  }
  function makeTable() {
    const grp = new THREE.Group();
    add(grp, new THREE.CylinderGeometry(0.55, 0.55, 0.06, 32), woodDark, 0, 0.78, 0);
    add(grp, new THREE.TorusGeometry(0.55, 0.03, 8, 32), gold, 0, 0.78, 0).rotation.x = Math.PI / 2;
    add(grp, new THREE.CylinderGeometry(0.07, 0.07, 0.75, 12), gold, 0, 0.4, 0);
    add(grp, new THREE.CylinderGeometry(0.32, 0.38, 0.05, 24), gold, 0, 0.03, 0);
    add(grp, new THREE.SphereGeometry(0.1, 12, 10), lampMat, 0, 0.95, 0);
    add(grp, new THREE.CylinderGeometry(0.1, 0.12, 0.04, 12), gold, 0, 0.83, 0);
    for (const [x, z] of [[-0.25, 0.15], [0.25, -0.12]]) {
      add(grp, new THREE.CylinderGeometry(0.06, 0.05, 0.14, 12),
        new THREE.MeshLambertMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.6 }), x, 0.88, z);
    }
    return grp;
  }
  const rowsZ = [-6, -1.5, 3], setsX = [-6.5, 6.5], colors = [0x7a1530, 0x1d3557, 0x2f4a2f];
  rowsZ.forEach((z, r) => {
    setsX.forEach((cx, si) => {
      const a = makeSofa(colors[r]); a.position.set(cx - 2.0, 0, z);
      const b = makeSofa(colors[r]); b.position.set(cx + 2.0, 0, z);
      const t = makeTable(); t.position.set(cx, 0, z - 0.1);
      const tid = `t${r}${si}`;
      a.userData.seatId = `s${r}${si}a`; b.userData.seatId = `s${r}${si}b`; t.userData.tableId = tid;
      seatsInfo.set(a.userData.seatId, { x: cx - 2.0, z: z + 0.05 });
      seatsInfo.set(b.userData.seatId, { x: cx + 2.0, z: z + 0.05 });
      tableGroups.set(tid, t);
      clickables.push(a, b, t);
      scene.add(a, b, t);
      const pl = new THREE.PointLight(0xffcf8a, 4, 6); pl.position.set(cx, 1.4, z); scene.add(pl);
    });
  });

  // thảm lối đi + đèn dẫn đường
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(6, 26), new THREE.MeshLambertMaterial({ color: 0x5a0f22 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.01, 1); scene.add(carpet);
  for (const x of [-2.7, 2.7]) {
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 26), new THREE.MeshBasicMaterial({ color: 0xc9a227 }));
    trim.rotation.x = -Math.PI / 2; trim.position.set(x, 0.02, 1); scene.add(trim);
  }
  // sân khấu + rèm nhung hai bên màn hình
  const stage = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 2.5), woodDark); stage.position.set(0, 0.25, -12.7); scene.add(stage);
  const curtainMat = new THREE.MeshLambertMaterial({ color: 0x8c1020 });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 12, 12), curtainMat);
      c.position.set(s * (9.6 + i * 0.6), 6.5, -13.5); scene.add(c);
    }
  }
  // đèn tường + ốp gỗ hai bên
  for (let z = -10; z <= 12; z += 4.4) {
    for (const s of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 8, 2.4), woodDark); panel.position.set(s * 15.9, 4, z); scene.add(panel);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), lampMat); lamp.position.set(s * 15.5, 4.5, z); scene.add(lamp);
    }
  }
  // đèn downlight trần
  for (let x = -10; x <= 10; x += 5) for (let z = -8; z <= 12; z += 5) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), lampMat); d.position.set(x, 13.95, z); scene.add(d);
  }
}
buildRoom();

/* ---------------- Game state ---------------- */
const players = new Map(); // id -> {group, label, bubble, target, moving}
let myId = null;
let me = null; // {x,z,ry}
let camYaw = 0, camPitch = 0.45, camDist = 8;
const keys = {};
let chatting = false;

function addPlayer(p) {
  if (players.has(p.id)) return;
  const group = makeAvatar(p.look || {});
  group.position.set(p.x, 0, p.z);
  group.rotation.y = p.ry || 0;
  group.userData.sit = !!p.seat;
  const label = textSprite(p.name, { size: 44, bg: 'rgba(0,0,0,.45)' });
  label.position.set(0, 3.0, 0);
  group.add(label);
  scene.add(group);
  players.set(p.id, { group, label, bubble: null, target: { x: p.x, z: p.z, ry: p.ry || 0 }, moving: false, name: p.name });
}
function removePlayer(id) {
  const p = players.get(id);
  if (!p) return;
  scene.remove(p.group);
  players.delete(id);
}
function showBubble(id, text) {
  const p = players.get(id);
  if (!p) return;
  if (p.bubble) { p.group.remove(p.bubble); clearTimeout(p.bubbleT); }
  const short = text.length > 40 ? text.slice(0, 40) + '…' : text;
  const b = textSprite(short, { size: 40, bg: 'rgba(255,255,255,.85)', color: '#111' });
  b.material.opacity = 0.9;
  b.position.set(0, 3.6, 0);
  p.group.add(b); p.bubble = b;
  p.bubbleT = setTimeout(() => { p.group.remove(b); if (p.bubble === b) p.bubble = null; }, 6000);
}

/* ---------------- Networking ---------------- */
socket.on('init', ({ id, players: list, video, tables }) => {
  myId = id;
  for (const p of list) addPlayer(p);
  const mine = players.get(id);
  me = { x: mine.target.x, z: mine.target.z, ry: 0 };
  pendingVideo = video; applyPending();
  for (const [tid, items] of Object.entries(tables || {})) renderTable(tid, items);
});
socket.on('player-join', (p) => { addPlayer(p); addChat('', `${p.name} vừa vào rạp`, true); });
socket.on('player-leave', (id) => {
  const p = players.get(id);
  if (p) addChat('', `${p.name} đã rời rạp`, true);
  removePlayer(id);
});
socket.on('player-move', (m) => {
  const p = players.get(m.id);
  if (!p) return;
  p.target = { x: m.x, z: m.z, ry: m.ry }; p.moving = m.moving;
});
socket.on('count', (n) => { $('count').textContent = '👥 ' + n; });
socket.on('chat', ({ id, name, text }) => { addChat(name, text); showBubble(id, text); });
socket.on('video', (v) => { pendingVideo = v; applyPending(); });

/* ---------------- Chat (mờ, góc dưới trái) ---------------- */
function addChat(name, text, system = false) {
  const el = document.createElement('div');
  el.className = 'msg';
  if (system) { el.style.fontStyle = 'italic'; el.textContent = text; }
  else { const b = document.createElement('b'); b.textContent = name + ':'; el.append(b, document.createTextNode(text)); }
  const log = $('log');
  log.appendChild(el);
  while (log.children.length > 12) log.firstChild.remove();
  setTimeout(() => el.classList.add('fade'), 12000);
  setTimeout(() => el.remove(), 14000);
}
const chatInput = $('chatInput');
chatInput.addEventListener('focus', () => { chatting = true; for (const k in keys) keys[k] = false; });
chatInput.addEventListener('blur', () => { chatting = false; });
chatInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') {
    const t = chatInput.value.trim();
    if (t) socket.emit('chat', t);
    chatInput.value = ''; chatInput.blur();
  } else if (e.key === 'Escape') chatInput.blur();
});

/* ---------------- YouTube sync ---------------- */
let player = null, playerReady = false, pendingVideo = null, applying = false, currentId = null;

function parseYT(s) {
  s = s.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function initPlayer() {
  player = new YT.Player('yt', {
    width: '100%', height: '100%',
    playerVars: { playsinline: 1, rel: 0, origin: location.origin },
    events: {
      onReady: () => { playerReady = true; applyPending(); },
      onStateChange: (e) => {
        if (applying) return;
        if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.PAUSED) {
          socket.emit('video-state', { playing: e.data === YT.PlayerState.PLAYING, time: player.getCurrentTime() });
        }
      },
    },
  });
}
function applyPending() {
  if (!pendingVideo || !playerReady) return;
  const v = pendingVideo; pendingVideo = null;
  applying = true;
  if (v.id !== currentId) {
    currentId = v.id;
    player.loadVideoById(v.id, v.time);
    if (!v.playing) setTimeout(() => player.pauseVideo(), 800);
  } else {
    if (Math.abs(player.getCurrentTime() - v.time) > 1.5) player.seekTo(v.time, true);
    v.playing ? player.playVideo() : player.pauseVideo();
  }
  setTimeout(() => { applying = false; }, 1500);
}
function startYT() {
  if (window.YT && YT.Player) initPlayer();
  else window.onYouTubeIframeAPIReady = initPlayer;
}
$('ytGo').onclick = () => {
  const id = parseYT($('ytUrl').value);
  if (!id) return alert('Link YouTube không hợp lệ');
  socket.emit('video-set', id); $('ytUrl').value = '';
};
$('ytUrl').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('ytGo').click(); });
$('sizeBtn').onclick = () => setFS(!fsMode);
$('playBtn').onclick = () => {
  if (!playerReady) return;
  player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
};
let fsMode = false;
function setFS(on) {
  fsMode = on;
  document.body.classList.toggle('fs', on);
  $('ytHolder').style.pointerEvents = on ? 'auto' : 'none';
  if (on) { document.documentElement.requestFullscreen?.().catch(() => {}); }
  else if (document.fullscreenElement) document.exitFullscreen?.();
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && fsMode) setFS(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && fsMode && !chatting) setFS(false); });

/* ---------------- Input ---------------- */
addEventListener('keydown', (e) => {
  if (inLobby) return;
  if (e.key === 'Enter') { e.preventDefault(); chatInput.focus(); return; }
  if (chatting) return;
  keys[e.key.toLowerCase()] = true;
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
let dragging = false, lx = 0, ly = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  if (fpMode) {
    camYaw += (e.clientX - lx) * 0.005;
    fpPitch = Math.min(1.2, Math.max(-1.2, fpPitch + (e.clientY - ly) * 0.004));
  } else {
    camYaw -= (e.clientX - lx) * 0.006;
    camPitch = Math.min(1.3, Math.max(0.08, camPitch + (e.clientY - ly) * 0.005));
  }
  lx = e.clientX; ly = e.clientY;
});
let fpMode = false, fpPitch = 0;
function toggleView() {
  fpMode = !fpMode;
  $('viewBtn').textContent = fpMode ? '👁 Góc 1' : '👤 Góc 3';
}
$('viewBtn').onclick = toggleView;
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'v' && !inLobby && !chatting) toggleView(); });
canvas.addEventListener('wheel', (e) => { camDist = Math.min(16, Math.max(3, camDist + e.deltaY * 0.01)); });

/* ---------------- Enter ---------------- */
$('enter').onclick = () => {
  const name = $('name').value.trim() || 'Khách' + Math.floor(Math.random() * 1000);
  localStorage.setItem('cinema-name', name);
  const room = $('room').value.trim() || 'main';
  inLobby = false;
  $('lobby').classList.add('hidden');
  for (const id of ['screenPanel', 'chat', 'help']) $(id).classList.remove('hidden');
  let cid = sessionStorage.getItem('cinema-cid');
  if (!cid) { cid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('cinema-cid', cid); }
  socket.emit('join', { room, name, look, cid });
  last = performance.now();
  requestAnimationFrame(loop);
  try { startYT(); } catch (err) { console.error(err); }
};

/* ---------------- Ngồi sofa & gọi món ---------------- */
const ITEMS = {
  popcorn:  { name: 'Bỏng ngô bơ',     emoji: '🍿', kind: 'bucket', color: 0xd62828 },
  caramel:  { name: 'Bỏng ngô caramel', emoji: '🍿', kind: 'bucket', color: 0xe09f3e },
  coke:     { name: 'Coca-Cola',        emoji: '🥤', kind: 'cup', color: 0xc1121f },
  pepsi:    { name: 'Pepsi',            emoji: '🥤', kind: 'cup', color: 0x1d4ed8 },
  orange:   { name: 'Nước cam',         emoji: '🍊', kind: 'cup', color: 0xfb8500 },
  peach:    { name: 'Trà đào',          emoji: '🍑', kind: 'cup', color: 0xffb3a7 },
  milktea:  { name: 'Trà sữa trân châu', emoji: '🧋', kind: 'cup', color: 0xb98b64 },
  water:    { name: 'Nước suối',        emoji: '💧', kind: 'cup', color: 0xa8dadc },
};
function buildProp(key) {
  const it = ITEMS[key], g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  if (it.kind === 'bucket') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.24, 16), mat(it.color)); b.position.y = 0.12; g.add(b);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.102, 0.08, 16), mat(0xffffff)); stripe.position.y = 0.12; g.add(stripe);
    const pm = mat(0xfff1b8);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, rr = i < 3 ? 0.03 : 0.085;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.06 + (i % 3) * 0.008, 8, 6), pm);
      s.position.set(Math.cos(a) * rr, 0.27 + (i % 2) * 0.03, Math.sin(a) * rr); g.add(s);
    }
  } else {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.058, 0.22, 16), mat(it.color)); c.position.y = 0.11; g.add(c);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 16), mat(0xffffff)); lid.position.y = 0.23; g.add(lid);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6), mat(0xffffff)); straw.position.set(0.02, 0.33, 0); straw.rotation.z = -0.2; g.add(straw);
  }
  return g;
}
function renderTable(tid, items) {
  const t = tableGroups.get(tid);
  if (!t) return;
  if (t.userData.props) t.remove(t.userData.props);
  const grp = new THREE.Group();
  items.forEach((k, i) => {
    if (!ITEMS[k]) return;
    const p = buildProp(k), a = (i / 6) * Math.PI * 2 + 0.4;
    p.position.set(Math.cos(a) * 0.33, 0.81, Math.sin(a) * 0.33);
    grp.add(p);
  });
  t.add(grp); t.userData.props = grp;
}
socket.on('table', ({ table, items, by, item }) => {
  renderTable(table, items);
  if (by && ITEMS[item]) addChat('', `${by} gọi ${ITEMS[item].emoji} ${ITEMS[item].name}`, true);
});
socket.on('seat', ({ id, seat, x, z }) => {
  const p = players.get(id);
  if (!p) return;
  p.group.userData.sit = !!seat;
  p.target = { x, z, ry: seat ? Math.PI : p.target.ry }; p.moving = false;
  if (id === myId && me) { me.sit = seat; me.x = x; me.z = z; if (seat) me.ry = Math.PI; }
});
socket.on('sit-denied', () => addChat('', 'Ghế này đã có người ngồi 🪑', true));

// menu
let menuOpen = false, menuTable = null;
const menuEl = $('menu');
$('menuItems').innerHTML = Object.entries(ITEMS).map(([k, v]) =>
  `<button data-k="${k}"><span>${v.emoji}</span>${v.name}</button>`).join('');
$('menuItems').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b && menuTable) socket.emit('order', { table: menuTable, item: b.dataset.k });
});
$('menuClear').onclick = () => { if (menuTable) socket.emit('clear-table', menuTable); };
$('menuClose').onclick = closeMenu;
function openMenu(tid) {
  menuOpen = true; menuTable = tid;
  for (const k in keys) keys[k] = false;
  $('menuTitle').textContent = `🍽️ Menu — Bàn ${tid.slice(1, 2) * 2 + +tid.slice(2) + 1}`;
  menuEl.classList.remove('hidden');
}
function closeMenu() { menuOpen = false; menuEl.classList.add('hidden'); }
addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) closeMenu(); });

// click chọn sofa / bàn
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(clickables, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.seatId && !o.userData.tableId) o = o.parent;
    if (o) return o.userData;
  }
  return null;
}
let downX = 0, downY = 0;
canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
canvas.addEventListener('pointerup', (e) => {
  if (fsMode || menuOpen || Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
  const u = pick(e);
  if (!u || !me) return;
  if (u.tableId) return openMenu(u.tableId);
  if (u.seatId) {
    if (me.sit === u.seatId) return;
    const s = seatsInfo.get(u.seatId);
    // đi tới trước sofa rồi ngồi
    if (me.sit) { socket.emit('stand', { x: me.x, z: me.z - 1.3 }); me.sit = null; me.z -= 1.3; }
    me.walkTo = { x: s.x, z: s.z, seat: u.seatId };
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (dragging || fsMode || menuOpen || inLobby) return;
  canvas.style.cursor = pick(e) ? 'pointer' : 'default';
});

/* ---------------- Main loop ---------------- */
let last = 0, sendT = 0, lastSent = '';
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;

  let moving = false;
  const mine = players.get(myId);
  if (me && mine) {
    let f = 0, r = 0;
    if (!chatting && !fsMode && !menuOpen) {
      if (keys['w'] || keys['arrowup']) f += 1;
      if (keys['s'] || keys['arrowdown']) f -= 1;
      if (keys['d'] || keys['arrowright']) r += 1;
      if (keys['a'] || keys['arrowleft']) r -= 1;
    }
    // đứng dậy khi bấm phím di chuyển
    if ((f || r) && me.sit) {
      const s = seatsInfo.get(me.sit);
      me.sit = null; mine.group.userData.sit = false;
      me.x = s.x; me.z = s.z - 1.3;
      socket.emit('stand', { x: me.x, z: me.z });
    }
    if (f || r) me.walkTo = null;
    if (me.sit) {
      me.ry = Math.PI;
    } else if (me.walkTo) {
      const wx = me.walkTo.x - me.x, wz = me.walkTo.z - me.z;
      const dist = Math.hypot(wx, wz);
      if (dist < 0.15) {
        me.x = me.walkTo.x; me.z = me.walkTo.z;
        const seat = me.walkTo.seat; me.walkTo = null;
        socket.emit('sit', { seat, x: me.x, z: me.z });
      } else {
        const step = Math.min(dist, 5 * dt);
        me.x += wx / dist * step; me.z += wz / dist * step;
        me.ry = Math.atan2(wx, wz);
        moving = true;
      }
    } else if (f || r) {
      const sx = Math.sin(camYaw), cz = Math.cos(camYaw);
      let dx = -sx * f + cz * r, dz = -cz * f - sx * r;
      const len = Math.hypot(dx, dz); dx /= len; dz /= len;
      const speed = keys['shift'] ? 9 : 5;
      me.x = Math.min(BOUND.x, Math.max(-BOUND.x, me.x + dx * speed * dt));
      me.z = Math.min(BOUND.zMax, Math.max(BOUND.zMin, me.z + dz * speed * dt));
      me.ry = Math.atan2(dx, dz);
      moving = true;
    }
    if (fpMode && !fsMode && !me.walkTo) me.ry = camYaw + Math.PI; // nhân vật nhìn theo hướng camera
    mine.group.userData.sit = !!me.sit;
    mine.group.position.set(me.x, mine.group.userData.bob || 0, me.z);
    // xoay mượt
    let d = me.ry - mine.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    mine.group.rotation.y += d * Math.min(1, dt * 12);
    mine.group.userData.animate(moving, dt);

    sendT += dt;
    const snap = `${me.x.toFixed(2)},${me.z.toFixed(2)},${me.ry.toFixed(2)},${moving}`;
    if (sendT > 0.066 && snap !== lastSent) {
      sendT = 0; lastSent = snap;
      socket.emit('move', { x: me.x, z: me.z, ry: me.ry, moving });
    }

    if (fsMode) {
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const dist = Math.max(4.5 / t, 8 / (t * camera.aspect));
      camera.position.lerp(new THREE.Vector3(0, 7, -13.9 + dist), Math.min(1, dt * 6));
      camera.lookAt(0, 7, -13.9);
    } else if (fpMode) {
      camera.position.set(me.x, 1.85 + (mine.group.userData.bob || 0), me.z);
      camera.lookAt(
        me.x - Math.sin(camYaw) * Math.cos(fpPitch),
        1.85 + (mine.group.userData.bob || 0) + Math.sin(fpPitch),
        me.z - Math.cos(camYaw) * Math.cos(fpPitch));
    } else {
      camera.position.set(
        me.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist,
        1.4 + Math.sin(camPitch) * camDist,
        me.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist);
      camera.lookAt(me.x, 1.4, me.z);
    }
    mine.group.visible = !(fpMode && !fsMode);
  }

  for (const [id, p] of players) {
    if (id === myId) continue;
    const g = p.group;
    g.position.x += (p.target.x - g.position.x) * Math.min(1, dt * 10);
    g.position.z += (p.target.z - g.position.z) * Math.min(1, dt * 10);
    let d = p.target.ry - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 12);
    g.userData.animate(p.moving, dt);
    g.position.y = g.userData.bob || 0;
  }
  renderer.render(scene, camera);
  cssRenderer.render(scene, camera);
}