import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const $ = (id) => document.getElementById(id);
const socket = io ? io() : null;

/* ---------------- Avatar ---------------- */
const texLoader = new THREE.TextureLoader();

const HAIR_NAMES = {
  male: ['Xoăn nhẹ', 'Thẳng gọn', 'Rẽ ngôi', 'Undercut', 'Vuốt dựng'],
  female: ['Xõa tự nhiên', 'Buộc 2 bên', 'Đuôi ngựa', 'Búi củ tỏi', 'Tết vương miện'],
};
const FACE_LIST = [
  ['happy', '😄', 'Vui vẻ'], ['normal', '🙂', 'Bình thường'], ['surprised', '😮', 'Ngạc nhiên'], ['sad', '😢', 'Buồn'],
  ['angry', '😠', 'Tức giận'], ['wink', '😉', 'Nháy mắt'], ['laugh', '😆', 'Cười lớn'],
];

/* ---- Áo thi đấu BLG / GEN.G (vẽ bằng canvas) ---- */
const JERSEYS = {
  blg: { base: '#f6f8ff', cuffL: '#4fb6e8', cuffR: '#f27ab0' },
  geng: { base: '#14141a', cuffL: '#d4a72c', cuffR: '#d4a72c' },
};
const jerseyCache = {};
function jerseyTexture(id, back) {
  const key = id + (back ? '-b' : '-f');
  if (jerseyCache[key]) return jerseyCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  const poly = (pts, col) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fillStyle = col; x.fill(); };
  const txt = (t, px, py, size, col, weight = '900', italic = true) => {
    x.font = `${italic ? 'italic ' : ''}${weight} ${size}px Impact, "Arial Black", sans-serif`;
    x.textAlign = 'center'; x.fillStyle = col; x.fillText(t, px, py);
  };
  if (id === 'blg') {
    x.fillStyle = '#f6f8ff'; x.fillRect(0, 0, 512, 512);
    // tia chớp xanh (trái) / hồng (phải)
    poly([[0, 300], [70, 360], [40, 400], [110, 512], [20, 512], [0, 430]], '#4fb6e8');
    poly([[512, 280], [440, 350], [470, 395], [400, 512], [500, 512], [512, 420]], '#f27ab0');
    poly([[40, 430], [110, 512], [70, 512]], '#f27ab0'); poly([[470, 430], [400, 512], [440, 512]], '#4fb6e8');
    // cổ chữ V
    x.lineWidth = 22; x.lineJoin = 'round';
    x.strokeStyle = '#4fb6e8'; x.beginPath(); x.moveTo(110, -10); x.lineTo(256, 130); x.stroke();
    x.strokeStyle = '#f27ab0'; x.beginPath(); x.moveTo(402, -10); x.lineTo(256, 130); x.stroke();
    if (!back) {
      txt('BLG', 256, 330, 170, '#2f9fe0'); txt('BILIBILI GAMING', 256, 375, 30, '#2f9fe0', '700', false);
      txt('bilibili', 150, 205, 34, '#27a5e8', '700'); txt('平安银行', 380, 205, 34, '#f26a21', '700', false);
      txt('Logitech G', 100, 160, 22, '#555', '700', false);
    } else {
      txt('BLG', 256, 260, 120, '#2f9fe0');
    }
  } else {
    x.fillStyle = '#14141a'; x.fillRect(0, 0, 512, 512);
    poly([[0, 320], [80, 380], [50, 420], [120, 512], [10, 512], [0, 440]], '#d4a72c');
    poly([[512, 300], [430, 370], [465, 410], [390, 512], [505, 512], [512, 430]], '#d4a72c');
    poly([[135, 360], [175, 430], [150, 512], [120, 512]], '#f3f3f3');
    poly([[380, 380], [350, 450], [380, 512], [405, 512]], '#f3f3f3');
    x.lineWidth = 22; x.lineJoin = 'round'; x.strokeStyle = '#d4a72c';
    x.beginPath(); x.moveTo(110, -10); x.lineTo(256, 130); x.lineTo(402, -10); x.stroke();
    if (!back) {
      // huy hiệu GG
      x.fillStyle = '#d4a72c'; x.beginPath(); x.moveTo(220, 150); x.lineTo(292, 150); x.lineTo(292, 230); x.lineTo(256, 262); x.lineTo(220, 230); x.closePath(); x.fill();
      x.fillStyle = '#14141a'; x.font = '900 52px Arial Black'; x.textAlign = 'center'; x.fillText('GG', 256, 222);
      txt('GEN.G', 256, 345, 100, '#ffffff');
      txt('PUMA', 170, 200, 30, '#fff', '900'); txt('LG UltraGear', 390, 190, 24, '#fff', '700', false);
      x.fillStyle = '#6ac11a'; for (let i = 0; i < 3; i++) { x.fillRect(100 + i * 14, 110, 8, 46); }
    } else {
      txt('GEN.G', 256, 260, 100, '#d4a72c');
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (jerseyCache[key] = t);
}

/* ---- Kiểu tóc ---- */
function buildHair(g, style, female, hairM) {
  const pinkM = new THREE.MeshLambertMaterial({ color: 0xff5c9a });
  const S = (r, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, mat = hairM) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); g.add(m); return m;
  };
  const cap = (r, th, y, z, rx) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20, 0, Math.PI * 2, 0, Math.PI * th), hairM);
    m.position.set(0, y, z); m.rotation.x = rx; g.add(m);
  };
  const caps = (r, len, x, y, z, rz, mat = hairM) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
    m.position.set(x, y, z); m.rotation.z = rz; g.add(m); return m;
  };
  const ring = (R, t, x, y, z, rx, mat) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(R, t, 8, 28), mat);
    m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m;
  };
  const back = (r, y, z, sx, sy, sz) => S(r, 0, y, z, sx, sy, sz);

  if (!female) {
    if (style === 4) { cap(0.71, 0.42, 1.9, -0.04, -0.3); back(0.62, 1.95, -0.15, 1.05, 0.8, 0.8); }
    else { cap(0.73, 0.5, 1.88, -0.04, -0.35); S(0.7, 0, 1.82, -0.1, 1, 0.9, 0.95).scale.set(1, 0.85, 0.95); }
    if (style === 1) {
      [[-0.45, 2.33, 0.38, 0.6], [-0.2, 2.4, 0.46, 0.3], [0.05, 2.42, 0.47, -0.2], [0.3, 2.38, 0.43, -0.5], [0.5, 2.28, 0.33, -0.8]]
        .forEach(([x, y, z, rz]) => S(0.2, x, y, z, 1.25, 0.75, 0.8, 0, 0, rz));
      S(0.22, -0.3, 2.62, 0.0, 1.2, 0.9, 1, 0, 0, 0.5); S(0.25, 0.02, 2.68, -0.05, 1.1, 1, 0.9); S(0.22, 0.32, 2.6, 0.05, 1.2, 0.9, 1, 0, 0, -0.5);
      for (const s of [-1, 1]) S(0.2, s * 0.68, 2.08, -0.05, 0.9, 1.1, 1);
    } else if (style === 2) {
      S(0.3, 0.1, 2.3, 0.47, 1.9, 0.55, 0.7, 0, 0, -0.25); S(0.18, -0.4, 2.25, 0.4, 1, 0.8, 0.8, 0, 0, 0.5);
      for (const s of [-1, 1]) S(0.11, s * 0.68, 1.9, 0.1, 0.8, 1.8, 0.8);
    } else if (style === 3) {
      S(0.28, -0.3, 2.3, 0.5, 1.25, 0.65, 0.7, 0, 0, 0.55); S(0.28, 0.3, 2.3, 0.5, 1.25, 0.65, 0.7, 0, 0, -0.55);
      for (const s of [-1, 1]) S(0.12, s * 0.68, 1.92, 0.08, 0.8, 1.7, 0.8);
    } else if (style === 4) {
      S(0.32, 0, 2.52, 0.12, 1.3, 0.75, 1.5, -0.3); S(0.22, 0, 2.42, 0.48, 1.4, 0.7, 0.7, -0.5);
    } else if (style === 5) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 10), hairM);
        m.position.set(Math.cos(a) * 0.36, 2.62, Math.sin(a) * 0.36 - 0.02);
        m.rotation.z = -Math.cos(a) * 0.5; m.rotation.x = Math.sin(a) * 0.5; g.add(m);
      }
      for (const x of [-0.25, 0, 0.25]) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.4, 10), hairM); m.position.set(x, 2.45, 0.42); m.rotation.x = 0.7; g.add(m); }
    }
    // tai
    return;
  }
  // ---- nữ ----
  cap(0.73, 0.5, 1.88, -0.04, -0.35);
  S(0.3, -0.28, 2.28, 0.5, 1.3, 0.65, 0.7, 0, 0, 0.5); S(0.3, 0.28, 2.28, 0.5, 1.3, 0.65, 0.7, 0, 0, -0.5); S(0.22, 0, 2.33, 0.52, 1.1, 0.6, 0.7);
  if (style === 1) {
    S(0.64, 0, 1.35, -0.4, 1.1, 1.45, 0.55);
    for (const s of [-1, 1]) { caps(0.19, 0.7, s * 0.66, 1.35, -0.05, s * 0.08); S(0.17, s * 0.74, 2.12, 0, 1, 1, 1, 0, 0, 0, pinkM); }
    S(0.24, 0, 2.62, -0.12);
  } else if (style === 2) {
    S(0.66, 0, 1.6, -0.35, 1.05, 0.9, 0.55);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 5; k++) S(0.2 - k * 0.015, s * 0.72, 1.95 - k * 0.22, -0.1 + (k % 2 ? 0.05 : -0.03));
      S(0.13, s * 0.72, 2.12, -0.05, 1, 1, 1, 0, 0, 0, pinkM); S(0.1, s * 0.72, 0.98, -0.1, 1, 1, 1, 0, 0, 0, pinkM);
    }
  } else if (style === 3) {
    S(0.66, 0, 1.75, -0.3, 1.05, 0.85, 0.6);
    const tail = caps(0.2, 0.9, 0, 1.95, -0.92, 0); tail.rotation.x = 0.55;
    ring(0.2, 0.07, 0, 2.35, -0.66, 0.8, pinkM);
    for (const s of [-1, 1]) caps(0.15, 0.3, s * 0.66, 1.75, -0.05, s * 0.08);
  } else if (style === 4) {
    S(0.66, 0, 1.55, -0.35, 1.05, 0.9, 0.55);
    S(0.3, 0, 2.78, -0.08, 1, 1.15, 1); ring(0.26, 0.08, 0, 2.58, -0.08, Math.PI / 2, pinkM);
    for (const s of [-1, 1]) caps(0.17, 0.35, s * 0.64, 1.65, -0.05, s * 0.06);
  } else if (style === 5) {
    S(0.64, 0, 1.3, -0.4, 1.1, 1.5, 0.55);
    ring(0.7, 0.11, 0, 2.28, -0.02, Math.PI / 2 - 0.35, hairM);
    for (const s of [-1, 1]) { caps(0.17, 0.7, s * 0.66, 1.4, -0.05, s * 0.08); S(0.13, s * 0.74, 1.95, 0, 1, 1, 1, 0, 0, 0, pinkM); }
  }
}

function makeAvatar(look) {
  const g = new THREE.Group();
  const mk = (c) => new THREE.MeshLambertMaterial({ color: c });
  const female = look.gender === 'female';
  const jersey = JERSEYS[look.jersey] ? look.jersey : '';
  const J = jersey ? JERSEYS[jersey] : null;
  const skin = mk(look.skin || '#f2c394');
  const shirt = mk(J ? J.base : (look.shirt || '#2f6fe0'));
  const pants = mk(look.pants || '#2d3436');
  const hair = mk(look.hair || '#4a3020');
  const mats = [skin, shirt, pants, hair];

  // thân tròn mềm; mặt trước/sau có thể dán áo đấu hoặc ảnh thiết kế
  let front = shirt, backM = shirt;
  if (jersey) {
    front = new THREE.MeshLambertMaterial({ map: jerseyTexture(jersey, false) });
    backM = new THREE.MeshLambertMaterial({ map: jerseyTexture(jersey, true) });
    mats.push(front, backM);
  } else if (look.texture) {
    const tex = texLoader.load(look.texture);
    tex.colorSpace = THREE.SRGBColorSpace;
    front = new THREE.MeshLambertMaterial({ map: tex });
    backM = front;
    mats.push(front);
  }
  const torso = new THREE.Mesh(new RoundedBoxGeometry(0.88, 0.88, 0.52, 4, 0.16), [shirt, shirt, shirt, shirt, front, backM]);
  torso.position.y = 0.97;
  g.add(torso);

  // đầu to tròn kiểu đất sét
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.68, 40, 30), skin);
  head.position.y = 1.85; head.scale.set(1.04, 0.98, 1);
  g.add(head);
  if (!female) {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skin);
      ear.position.set(s * 0.69, 1.8, 0); ear.scale.set(0.6, 1, 0.9); g.add(ear);
    }
  }
  buildHair(g, Math.min(5, Math.max(1, look.hairStyle | 0 || 1)), female, hair);

  // ---- khuôn mặt + biểu cảm ----
  const face = new THREE.Group(); g.add(face);
  const dark = new THREE.MeshBasicMaterial({ color: 0x1a1210 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blush = new THREE.MeshBasicMaterial({ color: 0xff8f9c });
  const redM = new THREE.MeshBasicMaterial({ color: 0x8a2b2b });
  const tongueM = new THREE.MeshBasicMaterial({ color: 0xff7a8a });
  const browM = new THREE.MeshBasicMaterial({ color: new THREE.Color(look.hair || '#4a3020').multiplyScalar(0.8) });
  const F = (m) => { face.add(m); return m; };
  const ell = (r, x, y, z, sx, sy, sz, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return F(m); };
  const arc = (R, t, x, y, z, rz, mat = dark) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R, t, 6, 16, Math.PI), mat); m.position.set(x, y, z); m.rotation.z = rz; return F(m); };
  const openEye = (s, k = 1) => {
    ell(0.1, s * 0.25, 1.83, 0.615, k, 1.5 * k, 0.45, dark);
    ell(0.04, s * 0.25 + 0.035, 1.9, 0.655, 1, 1, 0.5, white);
    ell(0.02, s * 0.25 - 0.03, 1.78, 0.655, 1, 1, 0.5, white);
  };
  const closedEye = (s) => arc(0.085, 0.022, s * 0.25, 1.79, 0.635, 0);
  const brow = (s, y, rot) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.03), browM);
    m.position.set(s * 0.25, y, 0.6); m.rotation.set(0, s * 0.35, rot); F(m);
  };
  const sprite = (t, x, y, z) => { const sp = textSprite(t, { size: 70 }); sp.scale.multiplyScalar(0.4); sp.position.set(x, y, z); F(sp); };
  function setFace(name) {
    while (face.children.length) face.remove(face.children[0]);
    const strong = name === 'laugh' || name === 'happy';
    for (const s of [-1, 1]) ell(0.085, s * 0.42, 1.66, 0.5, strong ? 1.2 : 1, 0.6, 0.4, blush);
    const mouthY = 1.62, mz = 0.645;
    if (name === 'normal') {
      openEye(-1); openEye(1); brow(-1, 2.07, 0.05); brow(1, 2.07, -0.05);
      arc(0.055, 0.016, 0, mouthY + 0.02, mz, Math.PI);
    } else if (name === 'happy') {
      closedEye(-1); closedEye(1); brow(-1, 2.1, 0.1); brow(1, 2.1, -0.1);
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.085, 16, Math.PI, Math.PI), redM); d.position.set(0, mouthY + 0.03, mz - 0.005); F(d);
      arc(0.085, 0.02, 0, mouthY + 0.03, mz, Math.PI);
    } else if (name === 'surprised') {
      openEye(-1, 1.15); openEye(1, 1.15); brow(-1, 2.15, 0.1); brow(1, 2.15, -0.1);
      ell(0.055, 0, 1.58, 0.64, 1, 1.3, 0.4, redM);
      sprite('❗', 0.58, 2.5, 0.3);
    } else if (name === 'sad') {
      openEye(-1, 0.95); openEye(1, 0.95); brow(-1, 2.05, 0.38); brow(1, 2.05, -0.38);
      arc(0.06, 0.016, 0, 1.56, mz, 0);
      ell(0.04, -0.3, 1.62, 0.6, 0.8, 1.5, 0.5, new THREE.MeshBasicMaterial({ color: 0x8fd3ff }));
    } else if (name === 'angry') {
      openEye(-1, 0.95); openEye(1, 0.95); brow(-1, 2.0, -0.42); brow(1, 2.0, 0.42);
      arc(0.05, 0.016, 0, 1.57, mz, 0);
      sprite('💢', 0.6, 2.45, 0.3);
    } else if (name === 'wink') {
      openEye(-1); closedEye(1); brow(-1, 2.08, 0.08); brow(1, 2.12, -0.12);
      arc(0.07, 0.018, 0, mouthY + 0.03, mz, Math.PI);
      sprite('✨', 0.6, 2.5, 0.3);
    } else { // laugh
      closedEye(-1); closedEye(1); brow(-1, 2.12, 0.12); brow(1, 2.12, -0.12);
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20, Math.PI, Math.PI), redM); d.position.set(0, mouthY + 0.06, mz - 0.005); F(d);
      ell(0.06, 0, mouthY - 0.04, mz - 0.002, 1.2, 0.6, 0.2, tongueM);
      arc(0.13, 0.022, 0, mouthY + 0.06, mz, Math.PI);
    }
  }
  setFace(look.face || 'normal');
  g.userData.setFace = setFace;

  // thân/tay/chân ngắn tròn
  const limb = (mat, r, len, x, y, shoe) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 16), mat);
    m.position.y = -(len / 2 + r * 0.6);
    pivot.add(m);
    if (shoe) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 16, 10), shoe);
      sh.scale.set(1, 0.6, 1.45); sh.position.set(0, -(len + r * 1.2) + 0.03, 0.08);
      pivot.add(sh);
    }
    g.add(pivot);
    return pivot;
  };
  const shoeMat = mk('#f7f7f7');
  const armL = limb(shirt, 0.15, 0.3, -0.58, 1.27);
  const armR = limb(shirt, 0.15, 0.3, 0.58, 1.27);
  const legMat = female ? mk('#f4f4f4') : pants; // nữ: tất trắng
  const legL = limb(legMat, 0.17, 0.2, -0.24, 0.55, shoeMat);
  const legR = limb(legMat, 0.17, 0.2, 0.24, 0.55, shoeMat);
  if (female) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.7, 0.4, 28), pants);
    skirt.position.y = 0.64; g.add(skirt);
  }
  // bàn tay + cổ tay áo đấu
  [armL, armR].forEach((a, i) => {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10), skin);
    hand.position.y = -0.55; a.add(hand);
    if (J) {
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 18), mk(i ? J.cuffR : J.cuffL));
      cuff.position.y = -0.42; cuff.rotation.x = Math.PI / 2; a.add(cuff);
    }
  });

  let t = 0;
  g.userData.animate = (moving, dt) => {
    const ud = g.userData;
    if (ud.hit !== undefined) { // bị đánh: nháy đỏ + lắc
      ud.hit -= dt;
      const k = Math.max(0, ud.hit) / 0.45;
      for (const m of mats) m.emissive.setRGB(k * 0.9, 0, 0);
      g.rotation.z = Math.sin(ud.hit * 45) * 0.3 * k;
      if (ud.hit <= 0) ud.hit = undefined;
    }
    if (!ud.dance) { armL.rotation.z = 0; armR.rotation.z = 0; legL.rotation.z = 0; legR.rotation.z = 0; }
    if (ud.dance) { // nhảy Audition
      ud.dt = (ud.dt || 0) + dt;
      const ph = ud.dt * Math.PI * 4, sn = Math.sin(ph), mv = Math.floor(ud.dt / 4) % 4;
      armL.rotation.set(0, 0, 0); armR.rotation.set(0, 0, 0); legL.rotation.set(0, 0, 0); legR.rotation.set(0, 0, 0);
      if (mv === 0) { armR.rotation.z = 2.4 + 0.3 * sn; armL.rotation.z = -0.4; legR.rotation.x = -0.7 * Math.max(0, sn); }
      else if (mv === 1) { armL.rotation.z = -(sn > 0 ? 2.4 : 0.7); armR.rotation.z = sn > 0 ? 0.7 : 2.4; legL.rotation.x = -0.5 * sn; legR.rotation.x = 0.5 * sn; }
      else if (mv === 2) { armL.rotation.z = -2.7; armR.rotation.z = 2.7; legL.rotation.z = -0.25; legR.rotation.z = 0.25; }
      else { armL.rotation.x = -1.3 * Math.abs(sn); armR.rotation.x = -1.3 * Math.abs(Math.cos(ph)); legL.rotation.z = -0.3 * Math.max(0, sn); legR.rotation.z = 0.3 * Math.max(0, -sn); }
      g.userData.bob = Math.abs(sn) * (mv === 2 ? 0.3 : 0.14);
      g.rotation.y += Math.sin(ph / 2) * dt * 0.8;
      return;
    }
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
    if (ud.act) { // đấm / đá
      ud.act.t += dt;
      const u = ud.act.t / 0.4;
      if (u >= 1) ud.act = null;
      else {
        const sn = Math.sin(u * Math.PI);
        if (ud.act.type === 'punch') { armR.rotation.x = -1.8 * sn; armL.rotation.x = 0.5 * sn; }
        else { legR.rotation.x = -1.5 * sn; armL.rotation.x = 0.6 * sn; armR.rotation.x = -0.6 * sn; }
      }
    }
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
const look = { gender: 'male', hairStyle: 1, face: 'normal', jersey: '', skin: '#f2c394', hair: '#4a3020', shirt: '#2f6fe0', pants: '#2d3436', texture: null };
function renderHairButtons() {
  $('hairStyles').innerHTML = HAIR_NAMES[look.gender].map((n, i) =>
    `<button type="button" data-h="${i + 1}" class="${look.hairStyle === i + 1 ? 'on' : ''}">${i + 1}. ${n}</button>`).join('');
}
function renderFaceButtons() {
  $('faces').innerHTML = FACE_LIST.map(([k, e, n]) =>
    `<button type="button" data-f="${k}" title="${n}" class="${look.face === k ? 'on' : ''}"><span>${e}</span>${n}</button>`).join('');
}
renderHairButtons(); renderFaceButtons();
$('hairStyles').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  look.hairStyle = +b.dataset.h; renderHairButtons(); rebuildPreview();
});
$('faces').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  look.face = b.dataset.f; renderFaceButtons(); rebuildPreview();
});
for (const b of document.querySelectorAll('#gender button')) {
  b.addEventListener('click', () => {
    look.gender = b.dataset.g;
    document.querySelectorAll('#gender button').forEach((x) => x.classList.toggle('on', x === b));
    $('pantsLabel').firstChild.textContent = look.gender === 'female' ? 'Váy ' : 'Quần ';
    renderHairButtons();
    rebuildPreview();
  });
}

const pv = $('preview');
const pvRenderer = new THREE.WebGLRenderer({ canvas: pv, antialias: true, alpha: true });
pvRenderer.setSize(pv.width, pv.height, false);
const pvScene = new THREE.Scene();
pvScene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.6));
const pvLight = new THREE.DirectionalLight(0xffffff, 1.2); pvLight.position.set(2, 4, 5); pvScene.add(pvLight);
const pvCam = new THREE.PerspectiveCamera(35, pv.width / pv.height, 0.1, 50);
pvCam.position.set(0, 1.9, 8.6); pvCam.lookAt(0, 1.45, 0);
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

for (const [k, v] of Object.entries({ skin: look.skin, hair: look.hair, shirt: look.shirt, pants: look.pants })) $(k).value = v;
for (const k of ['skin', 'hair', 'shirt', 'pants']) {
  $(k).addEventListener('input', (e) => { look[k] = e.target.value; rebuildPreview(); });
}
const markJersey = () => document.querySelectorAll('#jerseys button').forEach((x) => x.classList.toggle('on', x.dataset.j === look.jersey && !look.texture));
$('jerseys').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  look.jersey = b.dataset.j; look.texture = null; $('texture').value = '';
  markJersey(); rebuildPreview();
});
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
    look.jersey = '';
    markJersey(); rebuildPreview();
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(f);
});
$('clearTex').onclick = () => { look.texture = null; look.jersey = ''; $('texture').value = ''; markJersey(); rebuildPreview(); };

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

scene.add(new THREE.HemisphereLight(0x8c9cff, 0x1a0f1a, 0.8));
const dl = new THREE.DirectionalLight(0xffffff, 0.55); dl.position.set(5, 12, 8); scene.add(dl);

const clickables = [], seatsInfo = new Map(), tableGroups = new Map();
const trophies = [], beams = [];
const BOUND = { x: 14, zMin: -11, zMax: 17.3 };

function bannerTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function titleTexture() {
  return bannerTexture(1024, 480, (ctx, w, h) => {
    ctx.textAlign = 'center';
    ctx.font = 'italic 900 175px Impact, "Arial Black", sans-serif';
    let g = ctx.createLinearGradient(0, 20, 0, 190);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c7d2e0'); g.addColorStop(1, '#7f8da3');
    ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = '#0b1230';
    ctx.strokeText('WORLDS', 512, 175); ctx.fillStyle = g; ctx.fillText('WORLDS', 512, 175);
    rr(ctx, 230, 195, 564, 50, 14); ctx.fillStyle = '#0b1230'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#b9c4d6'; ctx.stroke();
    ctx.font = '700 32px "Arial Black", sans-serif'; ctx.fillStyle = '#e8eef7'; ctx.fillText('WORLD CHAMPIONSHIP', 512, 232);
    ctx.font = 'italic 900 135px Impact, "Arial Black", sans-serif';
    g = ctx.createLinearGradient(0, 250, 0, 370);
    g.addColorStop(0, '#fff2a8'); g.addColorStop(0.5, '#f5b82e'); g.addColorStop(1, '#a8650a');
    ctx.lineWidth = 12; ctx.strokeStyle = '#3a1d02';
    ctx.strokeText('GRAND FINAL', 512, 365); ctx.fillStyle = g; ctx.fillText('GRAND FINAL', 512, 365);
    // BLG VS GENG
    rr(ctx, 170, 392, 270, 62, 12); ctx.fillStyle = '#1647c9'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#cfd9ee'; ctx.stroke();
    rr(ctx, 584, 392, 270, 62, 12); ctx.fillStyle = '#15151b'; ctx.fill(); ctx.strokeStyle = '#f0c84b'; ctx.stroke();
    ctx.font = '900 46px "Arial Black", sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('BLG', 305, 438); ctx.fillText('GENG', 719, 438);
    ctx.fillStyle = '#f5d067'; ctx.fillText('VS', 512, 438);
  });
}
function flagTexture(blue) {
  return bannerTexture(512, 768, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    if (blue) { g.addColorStop(0, '#0a2a8a'); g.addColorStop(0.5, '#1f5fff'); g.addColorStop(1, '#07123a'); }
    else { g.addColorStop(0, '#0b0b0e'); g.addColorStop(0.5, '#4a3608'); g.addColorStop(1, '#0b0b0e'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = blue ? `rgba(130,180,255,${0.08 + (i % 4) * 0.05})` : `rgba(255,200,70,${0.08 + (i % 4) * 0.05})`;
      ctx.lineWidth = 6 + (i % 5) * 7;
      ctx.beginPath(); ctx.moveTo(-20, i * 60); ctx.bezierCurveTo(w * 0.3, i * 60 - 140, w * 0.6, i * 60 + 160, w + 20, i * 60 - 60); ctx.stroke();
    }
    ctx.textAlign = 'center';
    if (blue) {
      const gg = ctx.createLinearGradient(0, 260, 0, 440);
      gg.addColorStop(0, '#fff1a0'); gg.addColorStop(1, '#d99a14');
      ctx.font = 'italic 900 210px Impact, "Arial Black", sans-serif';
      ctx.lineWidth = 12; ctx.strokeStyle = '#2a1a02'; ctx.lineJoin = 'round';
      ctx.strokeText('BLG', 256, 400); ctx.fillStyle = gg; ctx.fillText('BLG', 256, 400);
      ctx.font = '700 44px "Arial Black", sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('BILIBILI GAMING', 256, 470);
    } else {
      ctx.font = 'italic 900 170px Impact, "Arial Black", sans-serif';
      ctx.lineWidth = 12; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';
      ctx.strokeText('GENG', 256, 400); ctx.fillStyle = '#f4c542'; ctx.fillText('GENG', 256, 400);
    }
  });
}
function makeTrophy() {
  const g = new THREE.Group();
  const silver = new THREE.MeshPhongMaterial({ color: 0xd5dde8, specular: 0xffffff, shininess: 90, side: THREE.DoubleSide });
  const goldM = new THREE.MeshPhongMaterial({ color: 0xe0b030, specular: 0xffffff, shininess: 80 });
  const pts = [[0.01, 0], [0.7, 0], [0.7, 0.14], [0.4, 0.28], [0.16, 0.6], [0.16, 1.0], [0.45, 1.3], [0.9, 2.1], [0.82, 2.25], [0.55, 1.75], [0.01, 1.55]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 32), silver));
  for (const s of [-1, 1]) { // cánh
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1 - i * 0.25, 0.08), silver);
      w.position.set(s * (0.75 + i * 0.22), 2.0 - i * 0.12, 0); w.rotation.z = -s * (0.35 + i * 0.15);
      g.add(w);
    }
  }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0x3d7bff }));
  gem.position.set(0, 1.5, 0.45); gem.scale.y = 1.4; g.add(gem);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.45, 24), goldM); base.position.y = -0.22; g.add(base);
  g.scale.setScalar(1.35);
  return g;
}

function buildRoom() {
  const H = 18;
  const L = (c) => new THREE.MeshLambertMaterial({ color: c });
  // sàn: nửa xanh (BLG) – nửa đỏ (GENG), thảm giữa
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(16, 32), L(0x0a1230));
  fl.rotation.x = -Math.PI / 2; fl.position.set(-8, 0, 2); scene.add(fl);
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(16, 32), L(0x17120a));
  fr.rotation.x = -Math.PI / 2; fr.position.set(8, 0, 2); scene.add(fr);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(32, H), L(0x090b15)); back.position.set(0, H / 2, -14); scene.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(32, H), L(0x08163f)); left.rotation.y = Math.PI / 2; left.position.set(-16, H / 2, 2); scene.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(32, H), L(0x1c1608)); right.rotation.y = -Math.PI / 2; right.position.set(16, H / 2, 2); scene.add(right);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), L(0x05060c)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, 2); scene.add(ceil);

  // màn hình chiếu: "lỗ" trong suốt ở WebGL để lộ iframe YouTube (CSS3D) phía sau
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(16.8, 9.8), new THREE.MeshBasicMaterial({ color: 0x050508 }));
  frame.position.set(0, 7, -13.95); scene.add(frame);
  const gl = new THREE.MeshBasicMaterial({ color: 0xf0c84b });
  for (const [w, h, x, y] of [[17.2, 0.15, 0, 11.95], [17.2, 0.15, 0, 2.05], [0.15, 10, -8.5, 7], [0.15, 10, 8.5, 7]]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), gl); b.position.set(x, y, -13.93); scene.add(b);
  }
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(16, 9),
    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, transparent: false, blending: THREE.NoBlending, fog: false }));
  hole.position.set(0, 7, -13.9); scene.add(hole);
  const holder = $('ytHolder');
  const cssObj = new CSS3DObject(holder);
  cssObj.position.set(0, 7, -13.9);
  cssObj.scale.setScalar(16 / 1280);
  scene.add(cssObj);

  // biển WORLDS GRAND FINAL phía trên màn hình
  const title = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 8.6 * 480 / 1024),
    new THREE.MeshBasicMaterial({ map: titleTexture(), transparent: true, fog: false }));
  title.position.set(0, 14.6, -13.85); scene.add(title);

  // cờ BLG (trái) / GENG (phải) trên tường hai bên
  for (const s of [-1, 1]) {
    for (const z of [-5.5, 6.5]) {
      const geo = new THREE.PlaneGeometry(7, 10.5, 10, 14);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 1.1 + pos.getY(i) * 0.6) * 0.25);
      geo.computeVertexNormals();
      const flag = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: flagTexture(s < 0), side: THREE.DoubleSide }));
      flag.position.set(s * 15.6, 9, z); flag.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(flag);
    }
  }

  // đèn màu + ánh sáng
  const mkL = (c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d); l.position.set(x, y, z); scene.add(l); };
  mkL(0x3d6bff, 260, 45, -9, 11, 0);
  mkL(0xffbf33, 260, 45, 9, 11, 0);
  mkL(0xaabbff, 60, 30, 0, 8, -9);

  // giàn đèn + chùm sáng quét
  const trussM = L(0x151821);
  for (const x of [-12, -6, 6, 12]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 32), trussM); t.position.set(x, H - 0.6, 2); scene.add(t);
    for (let z = -12; z <= 14; z += 3.2) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: x < 0 ? 0x7aa2ff : 0xffd36b }));
      lamp.position.set(x, H - 0.9, z); scene.add(lamp);
    }
  }
  [[-12, 0x3d7bff], [-6, 0x6fa0ff], [6, 0xffd45a], [12, 0xffb830]].forEach(([x, c], i) => {
    for (let z = -9; z <= 11; z += 6.7) {
      const geo = new THREE.ConeGeometry(2.4, H - 1, 24, 1, true);
      geo.rotateX(Math.PI); geo.translate(0, -(H - 1) / 2, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      const pv = new THREE.Group(); pv.position.set(x, H - 0.8, z); pv.add(m); scene.add(pv);
      beams.push({ g: pv, base: x < 0 ? 0.22 : -0.22, ph: i * 1.3 + z });
    }
  });

  // cúp ở hai bên sân khấu
  for (const s of [-1, 1]) {
    const tr = makeTrophy(); tr.position.set(s * 10.6, 0.5, -12.3); scene.add(tr); trophies.push(tr);
    mkL(0xffffff, 40, 14, s * 10.6, 6, -9.5);
  }

  // ---- Sofa cao cấp, mỗi cặp 2 sofa có bàn ở giữa ----
  const gold = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
  const darkTop = new THREE.MeshLambertMaterial({ color: 0x14161f });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9b8 });
  const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  function makeSofa(colorHex) {
    const grp = new THREE.Group();
    const vel = new THREE.MeshLambertMaterial({ color: colorHex });
    const velLight = new THREE.MeshLambertMaterial({ color: new THREE.Color(colorHex).offsetHSL(0, 0, 0.08) });
    add(grp, new THREE.BoxGeometry(2.3, 0.4, 1.2), vel, 0, 0.35, 0);
    add(grp, new THREE.BoxGeometry(1.8, 0.28, 0.95), velLight, 0, 0.67, 0.08);
    add(grp, new THREE.BoxGeometry(2.3, 1.0, 0.3), vel, 0, 1.0, 0.5);
    for (const s of [-1, 1]) {
      add(grp, new THREE.BoxGeometry(0.28, 0.75, 1.2), vel, s * 1.0, 0.72, 0);
      add(grp, new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), gold, s * 1.0, 0.1, -0.5);
      add(grp, new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), gold, s * 1.0, 0.1, 0.5);
    }
    for (const s of [-0.55, 0.55]) {
      const p = add(grp, new THREE.BoxGeometry(0.5, 0.45, 0.14), velLight, s, 1.0, 0.3);
      p.rotation.x = -0.25;
    }
    return grp;
  }
  function makeTable() {
    const grp = new THREE.Group();
    add(grp, new THREE.CylinderGeometry(0.55, 0.55, 0.06, 32), darkTop, 0, 0.78, 0);
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
  const rowsZ = [-7.5, -4, -0.5, 3, 6.5, 10], setsX = [-6.5, 6.5], sideColors = [0x1a4fd6, 0xd8a313];
  rowsZ.forEach((z, r) => {
    setsX.forEach((cx, si) => {
      const a = makeSofa(sideColors[si]); a.position.set(cx - 2.0, 0, z);
      const b = makeSofa(sideColors[si]); b.position.set(cx + 2.0, 0, z);
      const t = makeTable(); t.position.set(cx, 0, z - 0.1);
      const tid = `t${r}${si}`;
      a.userData.seatId = `s${r}${si}a`; b.userData.seatId = `s${r}${si}b`; t.userData.tableId = tid;
      seatsInfo.set(a.userData.seatId, { x: cx - 2.0, z: z + 0.05 });
      seatsInfo.set(b.userData.seatId, { x: cx + 2.0, z: z + 0.05 });
      tableGroups.set(tid, t);
      clickables.push(a, b, t);
      scene.add(a, b, t);
    });
  });

  // thảm lối đi giữa + dải đèn LED
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(6, 28), L(0x0d1020));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.01, 1); scene.add(carpet);
  for (const [x, c] of [[-2.9, 0x4d86ff], [-2.6, 0xf0c84b], [2.6, 0xf0c84b], [2.9, 0xffe08a]]) {
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 28), new THREE.MeshBasicMaterial({ color: c }));
    trim.rotation.x = -Math.PI / 2; trim.position.set(x, 0.02, 1); scene.add(trim);
  }
  // sân khấu
  const stage = new THREE.Mesh(new THREE.BoxGeometry(24, 0.5, 2.5), L(0x12151f)); stage.position.set(0, 0.25, -12.7); scene.add(stage);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(24, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xf0c84b })); edge.position.set(0, 0.5, -11.45); scene.add(edge);
  // dải LED dọc tường
  for (let z = -11; z <= 13; z += 4) {
    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 12, 0.18), new THREE.MeshBasicMaterial({ color: s < 0 ? 0x5a8fff : 0xffc94d }));
      strip.position.set(s * 15.9, 8, z); scene.add(strip);
    }
  }
}
buildRoom();

/* ================= Khu trò chơi phía sau: bi-a, bóng bàn, sàn nhảy Audition ================= */
const POOL_C = { x: -9.5, z: 15.2 }, PP_C = { x: 9.5, z: 15.2 }, DANCE_C = { x: 0, z: 15.2 };
const PL = 3.0, PW = 1.5, BR = 0.065, SURF = 0.92;
const BALL_COLORS = [0xffffff, 0xf4d03f, 0x2e6bd6, 0xd62e2e, 0x7d3cc4, 0xf08a24, 0x1f9d55, 0x8b1a1a, 0x111111, 0xf4d03f, 0x2e6bd6];
const game = { poolBalls: [], poolPos: [], poolMoving: false, tiles: [], ppBall: null, ppFlight: null, board: null, cue: null, aimLine: null, mirror: null };

function buildGameZone() {
  const L = (c) => new THREE.MeshLambertMaterial({ color: c });
  const BM = (c) => new THREE.MeshBasicMaterial({ color: c });
  const put = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // tường sau + biển neon
  const bw = new THREE.Mesh(new THREE.PlaneGeometry(32, 18), L(0x0a0b14)); bw.rotation.y = Math.PI; bw.position.set(0, 9, 18); scene.add(bw);
  const signTex = bannerTexture(1024, 200, (ctx, w, h) => {
    ctx.textAlign = 'center'; ctx.font = '900 100px "Arial Black", sans-serif';
    ctx.shadowColor = '#ff4df0'; ctx.shadowBlur = 30; ctx.fillStyle = '#ffe3fc';
    ctx.fillText('🎱 KHU TRÒ CHƠI 🏓', 512, 130);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 12 * 200 / 1024), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, fog: false }));
  sign.rotation.y = Math.PI; sign.position.set(0, 8.5, 17.9); scene.add(sign);
  for (const [c, y] of [[0xff4df0, 7.2], [0x4de1ff, 9.8]]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 0.08), BM(c)); strip.position.set(0, y, 17.9); scene.add(strip);
  }

  /* ---- Bàn bi-a ---- */
  const pool = new THREE.Group(); pool.position.set(POOL_C.x, 0, POOL_C.z);
  const wood = L(0x4a2a14), felt = L(0x0b6a3b);
  put(pool, new THREE.BoxGeometry(3.5, 0.3, 2.0), wood, 0, 0.78, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(pool, new THREE.BoxGeometry(0.2, 0.65, 0.2), wood, sx * 1.6, 0.33, sz * 0.88);
  for (const sz of [-1, 1]) put(pool, new THREE.BoxGeometry(3.5, 0.12, 0.25), wood, 0, 0.99, sz * 0.875);
  for (const sx of [-1, 1]) put(pool, new THREE.BoxGeometry(0.25, 0.12, 2.0), wood, sx * 1.625, 0.99, 0);
  const f = put(pool, new THREE.PlaneGeometry(PL, PW), felt, 0, SURF + 0.001, 0); f.rotation.x = -Math.PI / 2;
  for (const [px, py] of [[-PL / 2, -PW / 2], [0, -PW / 2], [PL / 2, -PW / 2], [-PL / 2, PW / 2], [0, PW / 2], [PL / 2, PW / 2]]) {
    const h = put(pool, new THREE.CircleGeometry(0.12, 20), BM(0x050505), px, SURF + 0.004, py); h.rotation.x = -Math.PI / 2;
  }
  for (let i = 0; i < 11; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(BR, 20, 14), new THREE.MeshPhongMaterial({ color: BALL_COLORS[i], shininess: 80 }));
    b.position.set(0, SURF + BR, 0); scene.add(b); game.poolBalls.push(b);
    if (i >= 9) { const st = new THREE.Mesh(new THREE.SphereGeometry(BR * 1.01, 16, 10, 0, 6.3, 1.2, 0.5), new THREE.MeshPhongMaterial({ color: 0xffffff })); b.add(st); }
  }
  // đèn treo trên bàn
  put(pool, new THREE.CylinderGeometry(0.02, 0.02, 3, 6), BM(0x222222), 0, 3.8, 0);
  put(pool, new THREE.ConeGeometry(0.9, 0.4, 20, 1, true), new THREE.MeshLambertMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide }), 0, 2.4, 0);
  put(pool, new THREE.CircleGeometry(0.7, 20), BM(0xfff0c0), 0, 2.38, 0).rotation.x = Math.PI / 2;
  pool.userData.gameId = 'pool'; scene.add(pool); clickables.push(pool);
  const pl1 = new THREE.PointLight(0xfff0c0, 55, 11); pl1.position.set(POOL_C.x, 2.2, POOL_C.z); scene.add(pl1);
  // gậy + đường ngắm
  const cue = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 1.5, 8).rotateZ(Math.PI / 2), L(0xd9a066)); cue.visible = false; scene.add(cue); game.cue = cue;
  const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
  const al = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); al.visible = false; al.frustumCulled = false; scene.add(al); game.aimLine = al;

  /* ---- Bàn bóng bàn ---- */
  const pp = new THREE.Group(); pp.position.set(PP_C.x, 0, PP_C.z);
  put(pp, new THREE.BoxGeometry(3.0, 0.07, 1.7), L(0x14508c), 0, 0.76, 0);
  const ln = BM(0xffffff);
  put(pp, new THREE.PlaneGeometry(3.0, 0.03), ln, 0, 0.797, 0).rotation.x = -Math.PI / 2;
  for (const sz of [-1, 1]) put(pp, new THREE.PlaneGeometry(3.0, 0.03), ln, 0, 0.797, sz * 0.84).rotation.x = -Math.PI / 2;
  for (const sx of [-1, 1]) put(pp, new THREE.PlaneGeometry(0.03, 1.7), ln, sx * 1.485, 0.797, 0).rotation.x = -Math.PI / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(pp, new THREE.BoxGeometry(0.1, 0.72, 0.1), L(0x222222), sx * 1.35, 0.36, sz * 0.7);
  put(pp, new THREE.BoxGeometry(0.015, 0.17, 1.85), new THREE.MeshLambertMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.55 }), 0, 0.885, 0);
  for (const sz of [-1, 1]) put(pp, new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), L(0x333333), 0, 0.88, sz * 0.93);
  pp.userData.gameId = 'pp'; scene.add(pp); clickables.push(pp);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), BM(0xfff2c8)); ball.visible = false; scene.add(ball); game.ppBall = ball;
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  board.scale.set(2.6, 0.81, 1); board.position.set(PP_C.x, 2.0, PP_C.z); board.renderOrder = 10; scene.add(board);
  game.board = { c, tex };
  drawBoard(null, null, [0, 0]);
  const pl2 = new THREE.PointLight(0x7fe9ff, 35, 10); pl2.position.set(PP_C.x, 2.6, PP_C.z); scene.add(pl2);

  /* ---- Sàn nhảy Audition ---- */
  const dance = new THREE.Group(); dance.position.set(DANCE_C.x, 0, DANCE_C.z);
  put(dance, new THREE.BoxGeometry(5.2, 0.08, 5.2), L(0x120f1c), 0, 0.04, 0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ color: 0x331a55 }));
    m.rotation.x = -Math.PI / 2; m.position.set((i - 1.5) * 1.2, 0.085, (j - 1.5) * 1.2); dance.add(m); game.tiles.push({ m, i, j });
  }
  const arrowTex = bannerTexture(512, 512, (ctx) => {
    ctx.textAlign = 'center'; ctx.font = '900 90px "Arial Black"'; ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillText('←', 170, 270); ctx.fillText('→', 342, 270); ctx.fillText('↑', 256, 190); ctx.fillText('↓', 256, 350);
    ctx.font = '900 46px "Arial Black"'; ctx.fillText('AUDITION', 256, 60);
  });
  const ov = put(dance, new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true }), 0, 0.09, 0); ov.rotation.x = -Math.PI / 2;
  for (const [c2, x, z, w, d] of [[0xff4df0, 0, -2.6, 5.4, 0.08], [0x4de1ff, 0, 2.6, 5.4, 0.08], [0xff4df0, -2.6, 0, 0.08, 5.4], [0x4de1ff, 2.6, 0, 0.08, 5.4]])
    put(dance, new THREE.BoxGeometry(w, 0.12, d), BM(c2), x, 0.1, z);
  dance.userData.gameId = 'dance'; scene.add(dance); clickables.push(dance);
  // quả cầu disco + đèn
  const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 100, flatShading: true }));
  mirror.position.set(DANCE_C.x, 7, DANCE_C.z); scene.add(mirror); game.mirror = mirror;
  put(scene, new THREE.CylinderGeometry(0.02, 0.02, 11, 6), BM(0x333333), DANCE_C.x, 12.5, DANCE_C.z);
  const pl3 = new THREE.PointLight(0xc060ff, 70, 14); pl3.position.set(DANCE_C.x, 4, DANCE_C.z); scene.add(pl3); game.danceLight = pl3;
}
function drawBoard(nameA, nameB, score) {
  const { c, tex } = game.board, x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = 'rgba(0,0,0,.65)'; x.beginPath(); x.roundRect(0, 0, 512, 160, 24); x.fill();
  x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = '900 40px "Arial Black", sans-serif';
  x.fillText(`${score[0]}  :  ${score[1]}`, 256, 70);
  x.font = '700 26px sans-serif'; x.fillStyle = '#ffd166';
  x.fillText(`🏓 ${nameA || '🤖 Máy'}`, 120, 130); x.fillText(`${nameB || '🤖 Máy'} 🏓`, 392, 130);
  tex.needsUpdate = true;
}
buildGameZone();

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
  group.userData.pid = p.id;
  group.userData.dance = !!p.dance;
  if (p.dance) { dancers.add(p.id); setTimeout(refreshMusic, 0); }
  const label = textSprite(p.name, { size: 44, bg: 'rgba(0,0,0,.45)' });
  label.position.set(0, 3.4, 0);
  group.add(label);
  scene.add(group);
  players.set(p.id, { group, label, bubble: null, target: { x: p.x, z: p.z, ry: p.ry || 0 }, moving: false, name: p.name });
}
function removePlayer(id) {
  const p = players.get(id);
  if (!p) return;
  scene.remove(p.group);
  players.delete(id);
  dancers.delete(id); refreshMusic();
}
function showBubble(id, text) {
  const p = players.get(id);
  if (!p) return;
  if (p.bubble) { p.group.remove(p.bubble); clearTimeout(p.bubbleT); }
  const short = text.length > 40 ? text.slice(0, 40) + '…' : text;
  const b = textSprite(short, { size: 40, bg: 'rgba(255,255,255,.85)', color: '#111' });
  b.material.opacity = 0.9;
  b.position.set(0, 4.0, 0);
  p.group.add(b); p.bubble = b;
  p.bubbleT = setTimeout(() => { p.group.remove(b); if (p.bubble === b) p.bubble = null; }, 6000);
}

/* ---------------- Networking ---------------- */
socket.on('init', ({ id, players: list, video, tables, chat, pool, pp }) => {
  if (pool) applyPool(pool);
  if (pp) { ppNames = { A: pp.A, B: pp.B }; ppIds = pp.ids || {}; ppScore = pp.score; drawBoard(pp.A, pp.B, pp.score); }
  for (const m of chat || []) addChat(m.name, m.text, false, true, m.ts);
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
socket.on('chat', ({ id, name, text, ts }) => { addChat(name, text, false, false, ts); showBubble(id, text); });
socket.on('video', (v) => { pendingVideo = v; applyPending(); });

/* ---------------- Chat (mờ, góc dưới trái) ---------------- */
const chatHistory = [];
let histPinned = false;
function fmtTime(ts) { const d = new Date(ts || Date.now()); return d.toTimeString().slice(0, 5); }
function makeMsgEl(name, text, system, ts, withTime) {
  const el = document.createElement('div');
  el.className = 'msg';
  if (withTime) { const tm = document.createElement('small'); tm.textContent = fmtTime(ts) + ' '; tm.style.opacity = .6; el.append(tm); }
  if (system) { el.style.fontStyle = 'italic'; el.append(document.createTextNode(text)); }
  else { const b = document.createElement('b'); b.textContent = name + ':'; el.append(b, document.createTextNode(text)); }
  return el;
}
function refreshHistory() {
  const show = histPinned || chatting;
  $('history').classList.toggle('hidden', !show);
  $('log').classList.toggle('hidden', show);
  if (show) $('history').scrollTop = $('history').scrollHeight;
}
function addChat(name, text, system = false, quiet = false, ts = Date.now()) {
  chatHistory.push({ name, text, system, ts });
  if (chatHistory.length > 300) chatHistory.shift();
  const h = $('history');
  const stick = h.scrollTop + h.clientHeight >= h.scrollHeight - 30;
  h.appendChild(makeMsgEl(name, text, system, ts, true));
  while (h.children.length > 300) h.firstChild.remove();
  if (stick || chatting) h.scrollTop = h.scrollHeight;
  if (quiet) return;
  const el = makeMsgEl(name, text, system, ts, false);
  const log = $('log');
  log.appendChild(el);
  while (log.children.length > 12) log.firstChild.remove();
  setTimeout(() => el.classList.add('fade'), 12000);
  setTimeout(() => el.remove(), 14000);
}
$('histBtn').onclick = () => { histPinned = !histPinned; refreshHistory(); };
const chatInput = $('chatInput');
chatInput.addEventListener('focus', () => { chatting = true; for (const k in keys) keys[k] = false; refreshHistory(); });
chatInput.addEventListener('blur', () => { chatting = false; refreshHistory(); });
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
  if (!dragging || poolMode) return;
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
  for (const id of ['screenPanel', 'chat', 'help', 'emoteBar']) $(id).classList.remove('hidden');
  let cid = sessionStorage.getItem('cinema-cid');
  if (!cid) { cid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('cinema-cid', cid); }
  socket.emit('join', { room, name, look, cid });
  try { ensureAudio(); } catch (e) {}
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
function otherGroups() {
  const arr = [];
  for (const [id, p] of players) if (id !== myId) arr.push(p.group);
  return arr;
}
function pick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(clickables.concat(otherGroups()), true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.seatId && !o.userData.tableId && !o.userData.pid && !o.userData.gameId) o = o.parent;
    if (o) return o.userData;
  }
  return null;
}

/* ---- Tương tác nhân vật: đấm / đá ---- */
const fx = [];
function spawnFx(text, pos) {
  const sp = textSprite(text, { size: 80, color: '#fff' });
  sp.position.set(pos.x, 2.6, pos.z); scene.add(sp);
  fx.push({ sp, t: 0 });
}
let lastAtk = 0, actionTarget = null;
const actionMenu = $('actionMenu');
function closeActionMenu() { actionMenu.classList.add('hidden'); actionTarget = null; }
function openActionMenu(pid, x, y) {
  const p = players.get(pid);
  if (!p) return;
  actionTarget = pid;
  $('actionName').textContent = p.name;
  actionMenu.style.left = Math.min(x, innerWidth - 170) + 'px';
  actionMenu.style.top = Math.min(y, innerHeight - 140) + 'px';
  actionMenu.classList.remove('hidden');
}
function doAttack(type, tid) {
  const t = players.get(tid), mine = players.get(myId);
  if (!t || !mine || tid === myId) return;
  const now = performance.now();
  if (now - lastAtk < 600) return;
  const dist = Math.hypot(t.group.position.x - me.x, t.group.position.z - me.z);
  if (dist > 3.6) return addChat('', 'Lại gần hơn một chút nhé 🏃', true);
  lastAtk = now;
  if (me.sit) { // đứng dậy trước khi ra đòn
    const s = seatsInfo.get(me.sit);
    me.sit = null; me.x = s.x; me.z = s.z - 1.3;
    socket.emit('stand', { x: me.x, z: me.z });
  }
  socket.emit('attack', { target: tid, type });
}
function attackNearest(type) {
  let best = null, bd = 3.6;
  for (const [id, p] of players) {
    if (id === myId) continue;
    const d = Math.hypot(p.group.position.x - me.x, p.group.position.z - me.z);
    if (d < bd) { bd = d; best = id; }
  }
  if (best) doAttack(type, best);
  else addChat('', 'Không có ai ở gần để ' + (type === 'punch' ? 'đấm' : 'đá'), true);
}
$('actPunch').onclick = () => { const t = actionTarget; closeActionMenu(); approachAndAttack('punch', t); };
$('actKick').onclick = () => { const t = actionTarget; closeActionMenu(); approachAndAttack('kick', t); };
function approachAndAttack(type, tid) {
  const t = players.get(tid);
  if (!t || !me) return;
  const dx = t.group.position.x - me.x, dz = t.group.position.z - me.z, d = Math.hypot(dx, dz);
  if (d <= 2.6) return doAttack(type, tid);
  if (me.sit) { socket.emit('stand', { x: me.x, z: me.z - 1.3 }); me.sit = null; me.z -= 1.3; }
  me.walkTo = { x: t.group.position.x - dx / d * 1.8, z: t.group.position.z - dz / d * 1.8, attack: { type, tid } };
}
addEventListener('keydown', (e) => {
  if (inLobby || chatting || menuOpen || fsMode || !me) return;
  const k = e.key.toLowerCase();
  if (k === 'f') attackNearest('punch');
  else if (k === 'g') attackNearest('kick');
  else if (k === 'escape') closeActionMenu();
});
socket.on('attack', ({ from, to, type }) => {
  const a = players.get(from), v = players.get(to);
  if (!a || !v) return;
  let nx = v.group.position.x - a.group.position.x, nz = v.group.position.z - a.group.position.z;
  const len = Math.hypot(nx, nz) || 1; nx /= len; nz /= len;
  const face = Math.atan2(nx, nz);
  a.group.userData.act = { type, t: 0 };
  a.target.ry = face;
  if (from === myId && me) me.ry = face;
  v.group.userData.hit = 0.45;
  spawnFx(type === 'punch' ? '👊 BỊCH!' : '🦶 BỐP!', v.group.position);
  if (to === myId && me) {
    if (me.sit) {
      const s = seatsInfo.get(me.sit);
      me.sit = null; me.x = s.x; me.z = s.z - 1.3;
      socket.emit('stand', { x: me.x, z: me.z });
    }
    me.kb = { x: nx * (type === 'kick' ? 9 : 6), z: nz * (type === 'kick' ? 9 : 6), t: 0.25 };
  }
  addChat('', `${a.name} ${type === 'punch' ? 'đấm 👊' : 'đá 🦶'} ${v.name}`, true);
});
let downX = 0, downY = 0;
canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
canvas.addEventListener('pointerup', (e) => {
  if (fsMode || menuOpen || poolMode || gameMode === 'pp' || Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
  const u = pick(e);
  closeActionMenu();
  if (!u || !me) return;
  if (u.gameId) return startGame(u.gameId);
  if (u.pid) return openActionMenu(u.pid, e.clientX, e.clientY);
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
  if (dragging || fsMode || menuOpen || inLobby || poolMode) return;
  canvas.style.cursor = pick(e) ? 'pointer' : 'default';
});

/* ---------------- Voice chat (tin nhắn thoại tối đa 10s) ---------------- */
const MAX_VOICE = 10;
let micStream = null, recorder = null, recChunks = [], recStart = 0, recTimer = null, recTick = null, voiceMuted = false;
const recBar = $('recBar');
async function startRec() {
  if (recorder || inLobby) return;
  try {
    if (!micStream) micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (err) {
    return addChat('', '🎤 Không truy cập được micro — hãy cho phép quyền micro trên trình duyệt', true);
  }
  if (recorder) return;
  const mimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  const mime = mimes.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  recorder = new MediaRecorder(micStream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
  recChunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
  const rec = recorder;
  rec.onstop = async () => {
    clearTimeout(recTimer); clearInterval(recTick);
    recBar.classList.add('hidden'); $('micBtn').classList.remove('rec');
    recorder = null;
    const dur = (performance.now() - recStart) / 1000;
    if (dur < 0.6) return addChat('', '🎤 Giữ nút lâu hơn một chút để ghi âm nhé', true);
    const blob = new Blob(recChunks, { type: rec.mimeType || 'audio/webm' });
    socket.emit('voice', { data: await blob.arrayBuffer(), mime: blob.type, dur: Math.min(MAX_VOICE, Math.round(dur)) });
    addChat('Bạn', `🎤 đã gửi tin nhắn thoại (${Math.min(MAX_VOICE, Math.round(dur))}s)`, false, true);
    if (myId) showBubble(myId, '🎤 ...');
  };
  rec.start();
  recStart = performance.now();
  $('micBtn').classList.add('rec');
  recBar.classList.remove('hidden');
  recTick = setInterval(() => {
    const s = Math.min(MAX_VOICE, (performance.now() - recStart) / 1000);
    recBar.textContent = `🔴 Đang ghi âm… ${s.toFixed(1)}s / ${MAX_VOICE}s — thả ra để gửi`;
  }, 100);
  recTimer = setTimeout(stopRec, MAX_VOICE * 1000);
}
function stopRec() { if (recorder && recorder.state === 'recording') recorder.stop(); }
$('micBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); startRec(); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('micBtn').addEventListener(ev, stopRec);
addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'b' && !e.repeat && !inLobby && !chatting && !menuOpen) startRec();
});
addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'b') stopRec(); });
$('voiceMute').onclick = () => {
  voiceMuted = !voiceMuted;
  $('voiceMute').textContent = voiceMuted ? '🔇' : '🔊';
};
let voiceQueue = [], voicePlaying = false;
socket.on('voice', (v) => {
  addChat(v.name, `🎤 gửi tin nhắn thoại (${v.dur}s)`, false, true);
  showBubble(v.id, '🎤 đang nói...');
  if (voiceMuted) return;
  voiceQueue.push(v);
  playNextVoice();
});
function playNextVoice() {
  if (voicePlaying || !voiceQueue.length) return;
  const v = voiceQueue.shift();
  voicePlaying = true;
  const url = URL.createObjectURL(new Blob([v.data], { type: v.mime || 'audio/webm' }));
  const au = new Audio(url);
  const sp = players.get(v.id);
  const dist = sp && me ? Math.hypot(sp.group.position.x - me.x, sp.group.position.z - me.z) : 0;
  au.volume = Math.max(0.3, 1 - dist / 30);
  let prevVol = null;
  try { if (playerReady) { prevVol = player.getVolume(); player.setVolume(Math.min(prevVol, 20)); } } catch (e) {}
  const done = () => {
    URL.revokeObjectURL(url); voicePlaying = false;
    try { if (prevVol !== null) player.setVolume(prevVol); } catch (e) {}
    playNextVoice();
  };
  au.onended = done; au.onerror = done;
  au.play().catch(done);
}

/* ---------------- Biểu cảm trong rạp (phím 1-7) ---------------- */
const emoteBar = $('emoteBar');
emoteBar.innerHTML = FACE_LIST.map(([k, e, n], i) => `<button data-f="${k}" title="${i + 1}: ${n}">${e}</button>`).join('');
emoteBar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) socket.emit('face', b.dataset.f); });
addEventListener('keydown', (e) => {
  if (inLobby || chatting || menuOpen || e.repeat) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= FACE_LIST.length) socket.emit('face', FACE_LIST[n - 1][0]);
});
socket.on('face', ({ id, face }) => { const p = players.get(id); if (p) p.group.userData.setFace(face); });

/* ---------------- Trò chơi: bi-a / bóng bàn / nhảy Audition ---------------- */
let gameMode = null, poolMode = false, ppSide = null, ppIds = {}, ppNames = {}, ppScore = [0, 0];
const hud = $('gameHud');
function setHud(html, extra) {
  $('hudText').innerHTML = html;
  $('powerWrap').classList.toggle('hidden', extra !== 'pool');
  $('hudReset').classList.toggle('hidden', extra !== 'pool');
  hud.classList.toggle('hidden', !html);
}
const ppEnd = (s) => ({ x: PP_C.x + (s === 'A' ? -2.2 : 2.2), z: PP_C.z });
function leaveGames() {
  if (poolMode) { poolMode = false; game.cue.visible = false; game.aimLine.visible = false; charging = 0; }
  if (ppSide) { socket.emit('pp-leave'); ppSide = null; }
  if (me && me.dancing) { socket.emit('dance', false); me.dancing = false; }
  gameMode = null; setHud('');
}
function startGame(id) {
  if (!me) return;
  leaveGames();
  if (me.sit) { socket.emit('stand', { x: me.x, z: me.z - 1.3 }); me.sit = null; me.z -= 1.3; }
  if (id === 'pool') me.walkTo = { x: POOL_C.x, z: POOL_C.z + 1.75, game: 'pool' };
  else if (id === 'pp') { const s = me.x < PP_C.x ? 'A' : 'B'; const e = ppEnd(s); me.walkTo = { x: e.x, z: e.z, game: 'pp', side: s }; }
  else me.walkTo = { x: DANCE_C.x + (Math.random() * 3 - 1.5), z: DANCE_C.z + (Math.random() * 3 - 1.5), game: 'dance' };
}
function enterGame(w) {
  if (w.game === 'pool') {
    gameMode = 'pool'; poolMode = true; me.ry = Math.PI;
    setHud('🎱 <b>Bi-a</b>: di chuột để ngắm · <b>giữ chuột rồi thả</b> để đánh · Esc: thoát', 'pool');
  } else if (w.game === 'pp') {
    gameMode = 'pp'; ppSide = w.side; me.ry = w.side === 'A' ? Math.PI / 2 : -Math.PI / 2;
    socket.emit('pp-join', { side: w.side }); refreshPpHud();
  } else if (w.game === 'pp-pos') {
    me.ry = w.side === 'A' ? Math.PI / 2 : -Math.PI / 2;
  } else if (w.game === 'dance') {
    gameMode = 'dance'; me.dancing = true; socket.emit('dance', true);
    setHud('💃 <b>Audition</b>: bạn đang nhảy theo nhạc · bấm phím di chuyển hoặc Esc để dừng');
  }
}
function refreshPpHud() {
  if (gameMode !== 'pp') return;
  setHud(`🏓 <b>Bóng bàn</b> ${ppNames.A || '🤖 Máy'} ${ppScore[0]} : ${ppScore[1]} ${ppNames.B || '🤖 Máy'} · bóng tới gần thì bấm <b>Space</b> (hoặc click) để đỡ · Esc: thoát`);
}
$('hudExit').onclick = leaveGames;
$('hudReset').onclick = () => socket.emit('pool-reset');
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && gameMode && !chatting) leaveGames();
  if (e.code === 'Space' && gameMode === 'pp' && !chatting && !e.repeat) { e.preventDefault(); ppHit(); }
});
let lastPpHit = 0;
function ppHit() {
  if (performance.now() - lastPpHit < 450) return;
  lastPpHit = performance.now();
  socket.emit('pp-hit');
  const me2 = players.get(myId); if (me2) me2.group.userData.act = { type: 'punch', t: 0 };
}

// --- bi-a ---
let charging = 0, aimAngle = 0;
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SURF);
const hitPt = new THREE.Vector3();
function pointerToTable(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(tablePlane, hitPt) ? hitPt : null;
}
canvas.addEventListener('pointermove', (e) => {
  if (!poolMode) return;
  const pt = pointerToTable(e), cb = game.poolPos[0];
  if (pt && cb) aimAngle = Math.atan2(pt.z - POOL_C.z - cb[1], pt.x - POOL_C.x - cb[0]);
});
canvas.addEventListener('pointerdown', (e) => {
  if (gameMode === 'pp') return ppHit();
  if (poolMode && !game.poolMoving) {
    const pt = pointerToTable(e), cb = game.poolPos[0];
    if (pt && cb) aimAngle = Math.atan2(pt.z - POOL_C.z - cb[1], pt.x - POOL_C.x - cb[0]);
    charging = performance.now();
  }
});
canvas.addEventListener('pointerup', () => {
  if (poolMode && charging) {
    const power = Math.min(1, (performance.now() - charging) / 1100);
    charging = 0;
    if (!game.poolMoving) socket.emit('pool-shot', { angle: aimAngle, power });
  }
});
function applyPool(st) {
  game.poolPos = st.balls; game.poolMoving = st.moving;
  st.balls.forEach((b, i) => {
    const m = game.poolBalls[i]; if (!m) return;
    m.visible = !b[2];
    m.position.set(POOL_C.x + b[0], SURF + BR, POOL_C.z + b[1]);
  });
}
socket.on('pool', applyPool);
socket.on('pool-event', ({ text }) => addChat('', text, true));

// --- bóng bàn ---
socket.on('pp', (s) => {
  ppNames = { A: s.A, B: s.B }; ppIds = s.ids || {}; ppScore = s.score;
  drawBoard(s.A, s.B, s.score); refreshPpHud();
});
socket.on('pp-side', (slot) => {
  if (ppSide && slot !== ppSide) { ppSide = slot; const e = ppEnd(slot); me.walkTo = { x: e.x, z: e.z, game: 'pp-pos', side: slot }; }
});
socket.on('pp-full', () => { addChat('', 'Bàn bóng bàn đã đủ 2 người chơi 🏓', true); leaveGames(); });
socket.on('pp-ball', ({ from, to, dur }) => {
  const fx0 = PP_C.x + (from === 'A' ? -1.25 : 1.25), tx = PP_C.x + (to === 'A' ? -1.25 : 1.25);
  game.ppFlight = { t: 0, dur, fx: fx0, tx, zr: (Math.random() - 0.5) * 0.9, z0: (Math.random() - 0.5) * 0.7 };
});
socket.on('pp-swing', ({ side }) => { const p = players.get(ppIds[side]); if (p) p.group.userData.act = { type: 'punch', t: 0 }; });
socket.on('pp-miss', ({ side }) => {
  game.ppFlight = null; game.ppBall.visible = false;
  spawnFx('❌', { x: PP_C.x + (side === 'A' ? -1.4 : 1.4), z: PP_C.z });
});
socket.on('pp-stop', () => { game.ppFlight = null; game.ppBall.visible = false; });

// --- nhạc + sàn nhảy ---
const dancers = new Set();
let actx = null, master = null, musicTimer = null, nextT = 0, stepN = 0;
function ensureAudio() {
  if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0; master.connect(actx.destination); }
  if (actx.state === 'suspended') actx.resume();
}
function tone(f, t, d, type, v) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}
function kick(t) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.22);
}
let noiseBuf = null;
function hat(t, v, d = 0.05) {
  if (!noiseBuf) { noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.3, actx.sampleRate); const a = noiseBuf.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
  const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 6000; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.02);
}
const BASS = [55, 55, 82.4, 55, 65.4, 65.4, 98, 65.4], LEAD = [440, 523, 659, 784, 659, 523, 587, 698];
function playStep(s, t) {
  if (s % 4 === 0) kick(t);
  if (s % 8 === 4) hat(t, 0.8, 0.12);
  if (s % 2 === 0) hat(t, 0.25);
  const bar = Math.floor(stepN / 16) % 2;
  if (s % 2 === 1) tone(BASS[(s >> 1) % 8] * (bar ? 1.12 : 1), t, 0.2, 'sawtooth', 0.25);
  if (s % 2 === 0 || s % 4 === 3) tone(LEAD[(s + bar * 3) % 8], t, 0.12, 'square', 0.07);
}
function schedule() { while (nextT < actx.currentTime + 0.15) { playStep(stepN % 16, nextT); nextT += 0.125; stepN++; } }
function refreshMusic() {
  if (dancers.size && !musicTimer) { ensureAudio(); nextT = actx.currentTime + 0.05; stepN = 0; musicTimer = setInterval(schedule, 25); }
  else if (!dancers.size && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
socket.on('dance', ({ id, on }) => {
  const p = players.get(id); if (!p) return;
  p.group.userData.dance = on; p.group.userData.sit = false;
  if (on) dancers.add(id); else dancers.delete(id);
  refreshMusic();
});
function updateGameVisuals(dt, now) {
  // nhạc: âm lượng theo khoảng cách tới sàn nhảy
  if (master && me) {
    const d = Math.hypot(me.x - DANCE_C.x, me.z - DANCE_C.z);
    master.gain.value = (voiceMuted || !musicTimer) ? 0 : Math.max(0.06, 1 - d / 26) * 0.22;
  }
  // sàn nhảy nhấp nháy theo nhịp
  const on = !!musicTimer && actx;
  const beat = on ? actx.currentTime / 0.125 : 0;
  for (const t of game.tiles) {
    const col = t.m.material.color;
    if (on) {
      const k = ((beat / 4 + t.i + t.j) % 4) / 4;
      col.setHSL((beat / 32 + (t.i * 4 + t.j) / 16) % 1, 0.9, 0.35 + 0.3 * (1 - k));
    } else col.setHSL(0.75, 0.5, 0.14 + 0.03 * Math.sin(now / 700 + t.i + t.j));
  }
  game.mirror.rotation.y += dt * 0.8;
  game.danceLight.color.setHSL(on ? (beat / 32) % 1 : 0.78, 1, 0.6);
  // quả bóng bàn
  const fl = game.ppFlight;
  if (fl) {
    fl.t += dt / fl.dur;
    const u = Math.min(1, fl.t);
    game.ppBall.visible = true;
    game.ppBall.position.set(fl.fx + (fl.tx - fl.fx) * u, 0.86 + Math.sin(u * Math.PI) * 0.45, PP_C.z + fl.z0 + (fl.zr - fl.z0) * u);
  }
  // gậy bi-a + đường ngắm
  const cb = game.poolPos[0];
  const show = poolMode && !game.poolMoving && cb && !cb[2];
  game.cue.visible = game.aimLine.visible = !!show;
  if (show) {
    const dx = Math.cos(aimAngle), dz = Math.sin(aimAngle);
    const bx = POOL_C.x + cb[0], bz = POOL_C.z + cb[1], y = SURF + BR;
    const pull = charging ? Math.min(1, (performance.now() - charging) / 1100) * 0.35 : 0;
    game.cue.position.set(bx - dx * (0.1 + pull + 0.75), y + 0.03, bz - dz * (0.1 + pull + 0.75));
    game.cue.rotation.y = -aimAngle;
    const pos = game.aimLine.geometry.attributes.position;
    pos.setXYZ(0, bx, y, bz); pos.setXYZ(1, bx + dx * 1.6, y, bz + dz * 1.6); pos.needsUpdate = true;
    $('powerBar').style.width = (charging ? Math.min(100, (performance.now() - charging) / 11) : 0) + '%';
  }
}

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
    if ((f || r) && gameMode) leaveGames();
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
        const w = me.walkTo; me.walkTo = null;
        if (w.seat) socket.emit('sit', { seat: w.seat, x: me.x, z: me.z });
        else if (w.attack) doAttack(w.attack.type, w.attack.tid);
        else if (w.game) enterGame(w);
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
    if (me.kb) { // bị đẩy lùi
      me.x = Math.min(BOUND.x, Math.max(-BOUND.x, me.x + me.kb.x * dt));
      me.z = Math.min(BOUND.zMax, Math.max(BOUND.zMin, me.z + me.kb.z * dt));
      me.kb.t -= dt; moving = true;
      if (me.kb.t <= 0) me.kb = null;
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
    } else if (poolMode) {
      camera.position.lerp(new THREE.Vector3(POOL_C.x, 3.5, POOL_C.z + 2.5), Math.min(1, dt * 6));
      camera.lookAt(POOL_C.x, 0.9, POOL_C.z - 0.1);
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
    camera.position.z = Math.min(camera.position.z, 17.6);
    camera.position.x = Math.min(15.4, Math.max(-15.4, camera.position.x));
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
  const tsec = now / 1000;
  updateGameVisuals(dt, now);
  for (const tr of trophies) tr.rotation.y += dt * 0.7;
  for (const b of beams) b.g.rotation.z = b.base + Math.sin(tsec * 0.6 + b.ph) * 0.12;
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    f.sp.position.y += dt * 1.6;
    f.sp.material.opacity = Math.max(0, 1 - f.t / 0.9);
    if (f.t > 0.9) { scene.remove(f.sp); fx.splice(i, 1); }
  }
  renderer.render(scene, camera);
  cssRenderer.render(scene, camera);
}