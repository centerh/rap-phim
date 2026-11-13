/* Máy game console: Tetris, Cờ cá ngựa, Bắn tank, Đua xe, Bomberman (canvas 2D, chơi 1 người) */
const GAMES = [
  { id: 'tetris', icon: '🧱', name: 'Tetris', help: '← → hoặc A D: di chuyển · ↑ / W / X: xoay · Z: xoay ngược · ↓ / S: rơi nhanh · Space: thả xuống · Enter: chơi lại' },
  { id: 'ludo', icon: '🐴', name: 'Cờ cá ngựa', help: 'Space/Enter: tung xúc xắc · click vào quân hoặc phím 1-4 để đi · cần ra 6 để xuất quân · bạn là quân đỏ (trên)' },
  { id: 'tank', icon: '🛡️', name: 'Bắn tank', help: 'WASD / mũi tên: lái · Space: bắn · phá gạch, diệt hết xe địch · Enter: chơi lại' },
  { id: 'racing', icon: '🏎️', name: 'Đua xe', help: '← → đánh lái · ↑ tăng tốc · ↓ phanh · tránh xe phía trước · Enter: chơi lại' },
  { id: 'bomber', icon: '💣', name: 'Bomberman', help: 'WASD / mũi tên: đi · Space: đặt bom · nổ gạch nhặt vật phẩm, diệt hết kẻ địch · Enter: chơi lại' },
];
const W = 640, H = 480;
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ========================= TETRIS ========================= */
function tetris(api) {
  const { ctx } = api;
  const C = 23, FW = 10, FH = 20, OX = 60, OY = 10;
  const SH = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], O: [[1, 1], [1, 1]], T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  };
  const KEYS = Object.keys(SH), COL = { I: '#22d3ee', O: '#facc15', T: '#a855f7', S: '#22c55e', Z: '#ef4444', J: '#3b82f6', L: '#f97316' };
  const grid = Array.from({ length: FH }, () => Array(FW).fill(null));
  let bag = [], cur, next, timer = 0, score = 0, lines = 0, level = 1, dead = false;
  const take = () => { if (!bag.length) bag = KEYS.slice().sort(() => Math.random() - 0.5); return bag.pop(); };
  const rot = (m) => m[0].map((_, i) => m.map((r) => r[i]).reverse());
  const hit = (m, x, y) => {
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) if (m[r][c]) {
      const gx = x + c, gy = y + r;
      if (gx < 0 || gx >= FW || gy >= FH) return true;
      if (gy >= 0 && grid[gy][gx]) return true;
    }
    return false;
  };
  function spawn() {
    const id = next || take(); next = take();
    const m = SH[id].map((r) => r.slice());
    cur = { id, m, x: Math.floor((FW - m[0].length) / 2), y: id === 'I' ? -1 : 0 };
    if (hit(cur.m, cur.x, cur.y)) { dead = true; api.over(score); }
  }
  const move = (dx, dy) => { if (hit(cur.m, cur.x + dx, cur.y + dy)) return false; cur.x += dx; cur.y += dy; return true; };
  function lock() {
    cur.m.forEach((row, r) => row.forEach((v, c) => { if (v && cur.y + r >= 0) grid[cur.y + r][cur.x + c] = cur.id; }));
    let n = 0;
    for (let r = FH - 1; r >= 0; r--) if (grid[r].every(Boolean)) { grid.splice(r, 1); grid.unshift(Array(FW).fill(null)); n++; r++; }
    score += [0, 100, 300, 500, 800][n] * level; lines += n; level = 1 + Math.floor(lines / 10);
    api.setScore(score); spawn(); timer = 0;
  }
  function rotate(dir) {
    const m = dir > 0 ? rot(cur.m) : rot(rot(rot(cur.m)));
    for (const k of [0, -1, 1, -2, 2]) if (!hit(m, cur.x + k, cur.y)) { cur.m = m; cur.x += k; return; }
  }
  spawn();
  const cell = (x, y, col, a = 1) => {
    ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(x, y, C - 1, C - 1);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, C - 1, 4); ctx.globalAlpha = 1;
  };
  return {
    update(dt) {
      if (dead) return;
      timer += dt;
      const iv = api.down.has('ArrowDown') ? 0.04 : Math.max(0.07, 0.8 - (level - 1) * 0.07);
      if (timer >= iv) { timer = 0; if (!move(0, 1)) lock(); }
    },
    keyDown(c, rep) {
      if (dead) return;
      if (rep && (c === 'ArrowUp' || c === 'KeyX' || c === 'KeyZ' || c === 'Space')) return;
      if (c === 'ArrowLeft') move(-1, 0); else if (c === 'ArrowRight') move(1, 0);
      else if (c === 'ArrowUp' || c === 'KeyX') rotate(1); else if (c === 'KeyZ') rotate(-1);
      else if (c === 'Space') { let d = 0; while (move(0, 1)) d++; score += d * 2; lock(); }
    },
    draw() {
      ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#111936'; ctx.fillRect(OX - 4, OY - 4, FW * C + 8, FH * C + 8);
      ctx.fillStyle = '#0a0f22'; ctx.fillRect(OX, OY, FW * C, FH * C);
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      for (let i = 1; i < FW; i++) { ctx.beginPath(); ctx.moveTo(OX + i * C, OY); ctx.lineTo(OX + i * C, OY + FH * C); ctx.stroke(); }
      for (let i = 1; i < FH; i++) { ctx.beginPath(); ctx.moveTo(OX, OY + i * C); ctx.lineTo(OX + FW * C, OY + i * C); ctx.stroke(); }
      grid.forEach((row, r) => row.forEach((id, c) => { if (id) cell(OX + c * C, OY + r * C, COL[id]); }));
      if (cur && !dead) {
        let gy = cur.y; while (!hit(cur.m, cur.x, gy + 1)) gy++;
        cur.m.forEach((row, r) => row.forEach((v, c) => { if (v) { cell(OX + (cur.x + c) * C, OY + (gy + r) * C, COL[cur.id], 0.2); } }));
        cur.m.forEach((row, r) => row.forEach((v, c) => { if (v && cur.y + r >= 0) cell(OX + (cur.x + c) * C, OY + (cur.y + r) * C, COL[cur.id]); }));
      }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('TIẾP THEO', 330, 40);
      const nm = SH[next];
      nm.forEach((row, r) => row.forEach((v, c) => { if (v) cell(340 + c * C, 60 + r * C, COL[next]); }));
      ctx.fillText(`Điểm: ${score}`, 330, 200); ctx.fillText(`Hàng: ${lines}`, 330, 235); ctx.fillText(`Cấp: ${level}`, 330, 270);
      ctx.font = '14px sans-serif'; ctx.fillStyle = '#9aa4c7';
      ctx.fillText('← →  di chuyển', 330, 330); ctx.fillText('↑ / X  xoay', 330, 352); ctx.fillText('↓  rơi nhanh', 330, 374); ctx.fillText('Space  thả xuống', 330, 396);
    },
  };
}

/* ========================= CỜ CÁ NGỰA (LUDO) ========================= */
function ludo(api) {
  const { ctx } = api;
  const CS = 40, OX = (W - 440) / 2, OY = 12;
  const ring = [];
  for (let x = 0; x <= 10; x++) ring.push([x, 0]);
  for (let y = 1; y <= 10; y++) ring.push([10, y]);
  for (let x = 9; x >= 0; x--) ring.push([x, 10]);
  for (let y = 9; y >= 1; y--) ring.push([0, y]);
  const entry = [5, 15, 25, 35], start = entry.map((e) => (e + 2) % 40);
  const homeDir = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  const baseC = [[8, 2], [8, 8], [2, 8], [2, 2]], slotOff = [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]];
  const COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047'], NAMES = ['Bạn (đỏ)', 'Máy xanh dương', 'Máy vàng', 'Máy xanh lá'];
  const pcs = [0, 1, 2, 3].map(() => [-1, -1, -1, -1]);
  let turn = 0, phase = 'roll', dice = 0, sixes = 0, winner = -1, botT = 0.8, passT = 0, msg = 'Tới lượt bạn — bấm Space để tung xúc xắc', autoT = 0, rolling = 0;
  const cellOf = (k, p, i) => {
    if (p < 0) return [baseC[k][0] + slotOff[i][0], baseC[k][1] + slotOff[i][1]];
    if (p <= 38) return ring[(start[k] + p) % 40];
    const s = p - 39, e = ring[entry[k]];
    return [e[0] + homeDir[k][0] * (s + 1), e[1] + homeDir[k][1] * (s + 1)];
  };
  const px = (c) => [OX + (c[0] + 0.5) * CS, OY + (c[1] + 0.5) * CS];
  const legal = (k, d) => {
    const out = [];
    pcs[k].forEach((p, i) => {
      if (p === -1) { if (d === 6) out.push(i); } else if (p + d <= 43) out.push(i);
    });
    return out;
  };
  function nextTurn() {
    if (dice === 6 && sixes < 3) { sixes++; } else { turn = (turn + 1) % 4; sixes = 0; }
    phase = 'roll'; dice = 0;
    msg = turn === 0 ? 'Tới lượt bạn — bấm Space để tung xúc xắc' : `Lượt của ${NAMES[turn]}...`;
    botT = 0.9;
  }
  function doRoll() {
    dice = ri(1, 6); rolling = 0.4;
    const mv = legal(turn, dice);
    if (!mv.length) { phase = 'pass'; passT = 1.0; msg = `${NAMES[turn]} tung ${dice}: không có nước đi`; return; }
    phase = 'choose'; msg = `${NAMES[turn]} tung ${dice}` + (turn === 0 ? (mv.length > 1 ? ' — chọn quân để đi (click hoặc phím 1-4)' : '') : '');
    if (turn === 0 && mv.length === 1) autoT = 0.6; else autoT = 0;
  }
  function movePiece(k, i) {
    const p = pcs[k][i];
    const np = p === -1 ? 0 : p + dice;
    pcs[k][i] = np;
    if (np <= 38) {
      const idx = (start[k] + np) % 40;
      for (let o = 0; o < 4; o++) if (o !== k) pcs[o].forEach((q, j) => {
        if (q >= 0 && q <= 38 && (start[o] + q) % 40 === idx) { pcs[o][j] = -1; msg = `${NAMES[k]} đá quân của ${NAMES[o]}! 💥`; }
      });
    }
    if (pcs[k].every((q) => q === 43)) { winner = k; msg = k === 0 ? '🎉 Bạn thắng!' : `${NAMES[k]} thắng rồi!`; api.over(k === 0 ? 1 : 0); return; }
    nextTurn();
  }
  function botChoose() {
    const mv = legal(turn, dice);
    let best = mv[0], bs = -1;
    for (const i of mv) {
      const p = pcs[turn][i], np = p === -1 ? 0 : p + dice;
      let s = np;
      if (p === -1) s += 60;
      if (np <= 38) { const idx = (start[turn] + np) % 40; for (let o = 0; o < 4; o++) if (o !== turn) pcs[o].forEach((q) => { if (q >= 0 && q <= 38 && (start[o] + q) % 40 === idx) s += 100; }); }
      if (np >= 39) s += 30; if (np === 43) s += 40;
      if (s > bs) { bs = s; best = i; }
    }
    movePiece(turn, best);
  }
  const pip = [[], [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];
  return {
    update(dt) {
      if (winner >= 0) return;
      if (rolling > 0) rolling -= dt;
      if (phase === 'pass') { passT -= dt; if (passT <= 0) nextTurn(); return; }
      if (turn !== 0) {
        botT -= dt;
        if (botT <= 0) { if (phase === 'roll') { doRoll(); botT = 0.9; } else if (phase === 'choose') botChoose(); }
      } else if (phase === 'choose' && autoT > 0) { autoT -= dt; if (autoT <= 0) movePiece(0, legal(0, dice)[0]); }
    },
    keyDown(c) {
      if (winner >= 0 || turn !== 0) return;
      if ((c === 'Space' || c === 'Enter') && phase === 'roll') doRoll();
      else if (phase === 'choose' && /^Digit[1-4]$/.test(c)) { const i = +c.slice(5) - 1; if (legal(0, dice).includes(i)) movePiece(0, i); }
    },
    click(x, y) {
      if (winner >= 0 || turn !== 0) return;
      if (phase === 'roll') { doRoll(); return; }
      if (phase !== 'choose') return;
      for (const i of legal(0, dice)) {
        const [cx, cy] = px(cellOf(0, pcs[0][i], i));
        if (Math.hypot(x - cx, y - cy) < 20) { movePiece(0, i); return; }
      }
    },
    draw() {
      ctx.fillStyle = '#16213e'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f5ecd5'; ctx.fillRect(OX - 6, OY - 6, 452, 452);
      // bãi xuất quân
      for (let k = 0; k < 4; k++) {
        const [cx, cy] = px(baseC[k]);
        ctx.fillStyle = COLORS[k] + '55'; ctx.beginPath(); ctx.roundRect(cx - 1.6 * CS, cy - 1.6 * CS, 3.2 * CS, 3.2 * CS, 14); ctx.fill();
        ctx.strokeStyle = COLORS[k]; ctx.lineWidth = 3; ctx.stroke();
      }
      // đường đi
      ring.forEach(([x, y], i) => {
        const [cx, cy] = px([x, y]);
        let col = '#fff';
        for (let k = 0; k < 4; k++) if (i === start[k]) col = COLORS[k];
        ctx.fillStyle = col; ctx.fillRect(cx - CS / 2 + 2, cy - CS / 2 + 2, CS - 4, CS - 4);
        ctx.strokeStyle = '#9b8f6a'; ctx.lineWidth = 1; ctx.strokeRect(cx - CS / 2 + 2, cy - CS / 2 + 2, CS - 4, CS - 4);
      });
      for (let k = 0; k < 4; k++) for (let s = 1; s <= 5; s++) {
        const e = ring[entry[k]], [cx, cy] = px([e[0] + homeDir[k][0] * s, e[1] + homeDir[k][1] * s]);
        ctx.fillStyle = COLORS[k]; ctx.globalAlpha = s === 5 ? 1 : 0.65; ctx.fillRect(cx - CS / 2 + 2, cy - CS / 2 + 2, CS - 4, CS - 4); ctx.globalAlpha = 1;
      }
      const mvs = turn === 0 && phase === 'choose' ? legal(0, dice) : [];
      // quân cờ
      const stack = {};
      for (let k = 0; k < 4; k++) pcs[k].forEach((p, i) => {
        const c = cellOf(k, p, i), key = c.join(',');
        const n = stack[key] = (stack[key] || 0) + 1;
        let [cx, cy] = px(c); if (p >= 0) { cx += (n - 1) * 6; cy -= (n - 1) * 6; }
        const hl = k === 0 && mvs.includes(i);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + 12, 12, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = COLORS[k]; ctx.strokeStyle = hl ? '#fff' : '#222'; ctx.lineWidth = hl ? 4 + Math.sin(performance.now() / 120) : 2;
        ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (k === 0) ctx.fillText(String(i + 1), cx, cy + 1);
      });
      ctx.textBaseline = 'alphabetic';
      // xúc xắc + thông báo
      const dx = 560, dy = 70;
      ctx.fillStyle = turn === 0 ? '#fff' : '#ddd'; ctx.strokeStyle = COLORS[turn]; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(dx - 30, dy - 30, 60, 60, 10); ctx.fill(); ctx.stroke();
      const shown = rolling > 0 ? ri(1, 6) : dice;
      ctx.fillStyle = '#111';
      (pip[shown] || []).forEach(([a, b]) => { ctx.beginPath(); ctx.arc(dx + a * 15, dy + b * 15, 5, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(NAMES[turn], dx, dy + 52);
      ctx.textAlign = 'left'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#ffd166';
      const lines = [];
      let line = ''; for (const w of msg.split(' ')) { if ((line + w).length > 22) { lines.push(line); line = ''; } line += w + ' '; } lines.push(line);
      lines.forEach((l, i) => ctx.fillText(l, 14, 40 + i * 20));
      ctx.fillStyle = '#9aa4c7'; ctx.font = '13px sans-serif';
      pcs.forEach((a, k) => ctx.fillText(`${NAMES[k].split(' ')[0]} ${NAMES[k].split(' ').slice(-1)[0]}: ${a.filter((p) => p === 43).length}/4 về đích`, 14, 400 + k * 18));
    },
  };
}

/* ========================= BẮN TANK ========================= */
function tankGame(api) {
  const { ctx } = api;
  const T = 24, COLS = 26, ROWS = 20, OX = 8, HALF = 10;
  let map, tanks, bullets, stage = 1, score = 0, lives = 3, toSpawn, spawnT = 1, dead = false, flash = 0;
  const player = { x: 0, y: 0, dir: 0, cool: 0, inv: 0, ply: true };
  const SPAWNS = [[1, 0], [12, 0], [24, 0]];
  function gen() {
    map = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (Math.random() < 0.2 ? 1 : Math.random() < 0.04 ? 2 : 0)));
    for (let r = 17; r < ROWS; r++) for (let c = 10; c < 16; c++) map[r][c] = 0;
    for (const [c] of SPAWNS) for (let r = 0; r < 3; r++) for (let d = -1; d <= 1; d++) if (map[r] && map[r][c + d] !== undefined) map[r][c + d] = 0;
    // tường gạch che quanh chỗ xuất phát
    for (const c of [9, 16]) for (let r = 17; r < ROWS; r++) map[r][c] = 1;
    tanks = []; bullets = [];
    toSpawn = 6 + stage * 2; spawnT = 1;
    Object.assign(player, { x: OX + 13 * T, y: 19.5 * T - 2, dir: 0, cool: 0, inv: 2 });
  }
  gen();
  const solid = (c, r) => c < 0 || r < 0 || c >= COLS || r >= ROWS || map[r][c] > 0;
  const tileAt = (x, y) => [Math.floor((x - OX) / T), Math.floor(y / T)];
  function blocked(t, nx, ny) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const [c, r] = tileAt(nx + sx * HALF, ny + sy * HALF);
      if (solid(c, r)) return true;
    }
    for (const o of [player, ...tanks]) {
      if (o === t || (o === player && o.dead)) continue;
      if (Math.abs(o.x - nx) < HALF * 2 && Math.abs(o.y - ny) < HALF * 2) return true;
    }
    return false;
  }
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  function step(t, dir, d) {
    t.dir = dir;
    const nx = t.x + DX[dir] * d, ny = t.y + DY[dir] * d;
    if (!blocked(t, nx, ny)) { t.x = nx; t.y = ny; return true; }
    return false;
  }
  function shoot(t, own) {
    bullets.push({ x: t.x + DX[t.dir] * 14, y: t.y + DY[t.dir] * 14, dir: t.dir, own });
  }
  function killPlayer() {
    if (player.inv > 0) return;
    lives--; flash = 0.5;
    if (lives <= 0) { dead = true; api.over(score); return; }
    Object.assign(player, { x: OX + 13 * T, y: 19.5 * T - 2, dir: 0, inv: 2.5 });
  }
  return {
    update(dt) {
      if (dead) return;
      flash = Math.max(0, flash - dt); player.inv = Math.max(0, player.inv - dt); player.cool -= dt;
      const d = api.down;
      if (d.has('ArrowUp') || d.has('KeyW')) step(player, 0, 100 * dt);
      else if (d.has('ArrowDown') || d.has('KeyS')) step(player, 2, 100 * dt);
      else if (d.has('ArrowLeft') || d.has('KeyA')) step(player, 3, 100 * dt);
      else if (d.has('ArrowRight') || d.has('KeyD')) step(player, 1, 100 * dt);
      if (d.has('Space') && player.cool <= 0) { shoot(player, 'p'); player.cool = 0.4; }
      // sinh địch
      spawnT -= dt;
      if (spawnT <= 0 && toSpawn > 0 && tanks.length < Math.min(5, 3 + Math.floor(stage / 2))) {
        const [c, r] = SPAWNS[ri(0, 2)], x = OX + (c + 0.5) * T, y = (r + 0.5) * T + 2;
        if (!blocked(null, x, y)) { tanks.push({ x, y, dir: 2, turn: rnd(0.5, 2), fire: rnd(0.8, 2), speed: 60 + stage * 6 }); toSpawn--; spawnT = 2.2; }
      }
      for (const t of tanks) {
        t.turn -= dt; t.fire -= dt;
        const ok = step(t, t.dir, t.speed * dt);
        if (!ok || t.turn <= 0) {
          t.turn = rnd(0.6, 2.2);
          const r = Math.random();
          t.dir = r < 0.4 ? 2 : r < 0.55 ? (player.x < t.x ? 3 : 1) : ri(0, 3);
        }
        if (t.fire <= 0) { shoot(t, 'e'); t.fire = rnd(0.9, 2.2); }
      }
      // đạn
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += DX[b.dir] * 280 * dt; b.y += DY[b.dir] * 280 * dt;
        const [c, r] = tileAt(b.x, b.y);
        let gone = false;
        if (solid(c, r)) {
          if (r >= 0 && c >= 0 && r < ROWS && c < COLS && map[r][c] === 1) {
            map[r][c] = 0;
            const pc = b.dir % 2 === 0 ? [[c - 1, r], [c + 1, r]] : [[c, r - 1], [c, r + 1]];
            for (const [a, bb] of pc) if (map[bb] && map[bb][a] === 1 && Math.random() < 0.5) map[bb][a] = 0;
          }
          gone = true;
        } else if (b.own === 'p') {
          for (let j = tanks.length - 1; j >= 0; j--) if (Math.hypot(tanks[j].x - b.x, tanks[j].y - b.y) < 13) { tanks.splice(j, 1); score += 100; api.setScore(score); gone = true; break; }
        } else if (Math.hypot(player.x - b.x, player.y - b.y) < 12) { killPlayer(); gone = true; }
        if (gone) bullets.splice(i, 1);
      }
      for (const t of tanks) if (Math.abs(t.x - player.x) < 20 && Math.abs(t.y - player.y) < 20 && Math.random() < 0.02) killPlayer();
      if (toSpawn === 0 && !tanks.length) { stage++; score += 500; api.setScore(score); gen(); }
    },
    keyDown() {},
    draw() {
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#000'; ctx.fillRect(OX, 0, COLS * T, ROWS * T);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const v = map[r][c]; if (!v) continue;
        const x = OX + c * T, y = r * T;
        if (v === 1) {
          ctx.fillStyle = '#b4532a'; ctx.fillRect(x, y, T, T);
          ctx.fillStyle = '#7c3517'; ctx.fillRect(x, y + 11, T, 2); ctx.fillRect(x + 11, y, 2, 11); ctx.fillRect(x + 5, y + 13, 2, 11); ctx.fillRect(x + 17, y + 13, 2, 11); ctx.fillRect(x, y + 23, T, 1);
        } else {
          ctx.fillStyle = '#9ca3af'; ctx.fillRect(x, y, T, T); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x + 4, y + 4, T - 8, T - 8); ctx.fillStyle = '#6b7280'; ctx.fillRect(x + 8, y + 8, T - 16, T - 16);
        }
      }
      const drawTank = (t, body, trim) => {
        ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.dir * Math.PI / 2);
        ctx.fillStyle = '#222'; ctx.fillRect(-10, -10, 5, 20); ctx.fillRect(5, -10, 5, 20);
        ctx.fillStyle = body; ctx.fillRect(-6, -8, 12, 16);
        ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
        ctx.fillStyle = trim; ctx.fillRect(-1.5, -14, 3, 12);
        ctx.restore();
      };
      for (const t of tanks) drawTank(t, '#ef4444', '#fca5a5');
      if (!dead && (player.inv <= 0 || Math.floor(player.inv * 10) % 2 === 0)) drawTank(player, '#facc15', '#fde68a');
      ctx.fillStyle = '#fff';
      for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 7); ctx.fill(); }
      if (flash > 0) { ctx.fillStyle = `rgba(255,0,0,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`Màn ${stage}  ·  ❤ ${lives}  ·  Địch còn: ${toSpawn + tanks.length}  ·  Điểm ${score}`, OX + 6, 14);
    },
  };
}

/* ========================= ĐUA XE ========================= */
function racing(api) {
  const { ctx } = api;
  const X0 = 140, X1 = 500, LW = (X1 - X0) / 4;
  const me = { x: 320, y: 390, w: 38, h: 66, v: 260 };
  let cars = [], offs = 0, dist = 0, t = 0, spawnT = 0.5, dead = false, crash = 0;
  const trees = Array.from({ length: 14 }, (_, i) => ({ x: i % 2 ? rnd(520, 620) : rnd(10, 120), y: rnd(0, H) }));
  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];
  const drawCar = (x, y, w, h, col) => {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - w / 2 + 3, y - h / 2 + 4, w, h);
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 8); ctx.fill();
    ctx.fillStyle = '#cfe8ff'; ctx.fillRect(x - w / 2 + 5, y - h / 2 + h * 0.2, w - 10, h * 0.2);
    ctx.fillRect(x - w / 2 + 5, y + h * 0.15, w - 10, h * 0.15);
    ctx.fillStyle = '#111'; ctx.fillRect(x - w / 2 - 3, y - h / 2 + 8, 4, 14); ctx.fillRect(x + w / 2 - 1, y - h / 2 + 8, 4, 14); ctx.fillRect(x - w / 2 - 3, y + h / 2 - 22, 4, 14); ctx.fillRect(x + w / 2 - 1, y + h / 2 - 22, 4, 14);
  };
  return {
    update(dt) {
      if (dead) return;
      t += dt;
      const d = api.down;
      const maxV = 380 + Math.min(420, t * 6);
      if (d.has('ArrowUp') || d.has('KeyW')) me.v = Math.min(maxV, me.v + 220 * dt); else if (d.has('ArrowDown') || d.has('KeyS')) me.v = Math.max(140, me.v - 380 * dt); else me.v = Math.min(maxV * 0.8, me.v + 60 * dt);
      const steer = 80 + me.v * 0.6;
      if (d.has('ArrowLeft') || d.has('KeyA')) me.x -= steer * dt;
      if (d.has('ArrowRight') || d.has('KeyD')) me.x += steer * dt;
      me.x = clamp(me.x, X0 + me.w / 2 + 4, X1 - me.w / 2 - 4);
      offs = (offs + me.v * dt) % 80; dist += me.v * dt;
      api.setScore(Math.floor(dist / 10));
      spawnT -= dt;
      if (spawnT <= 0) {
        const lane = ri(0, 3);
        const x = X0 + LW * lane + LW / 2;
        if (!cars.some((c) => Math.abs(c.x - x) < 10 && c.y < 60)) cars.push({ x, y: -90, w: 38, h: 66, v: rnd(110, 230), col: COLORS[ri(0, 5)] });
        spawnT = Math.max(0.35, rnd(0.5, 1.1) - t * 0.004);
      }
      for (const c of cars) {
        c.y += (me.v - c.v) * dt;
        if (Math.abs(c.x - me.x) < (c.w + me.w) / 2 - 4 && Math.abs(c.y - me.y) < (c.h + me.h) / 2 - 6) { dead = true; api.over(Math.floor(dist / 10)); }
      }
      cars = cars.filter((c) => c.y < H + 120 && c.y > -300);
      for (const tr of trees) { tr.y += me.v * dt; if (tr.y > H + 20) { tr.y = -20; tr.x = tr.x < 320 ? rnd(10, 120) : rnd(520, 620); } }
    },
    keyDown() {},
    draw() {
      ctx.fillStyle = '#2f8f3a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#444b55'; ctx.fillRect(X0, 0, X1 - X0, H);
      ctx.fillStyle = '#fff'; ctx.fillRect(X0 - 6, 0, 6, H); ctx.fillRect(X1, 0, 6, H);
      ctx.fillStyle = '#e5e7eb';
      for (let l = 1; l < 4; l++) for (let y = -80 + offs; y < H; y += 80) ctx.fillRect(X0 + LW * l - 2, y, 4, 40);
      for (const tr of trees) { ctx.fillStyle = '#5b3a1a'; ctx.fillRect(tr.x - 3, tr.y, 6, 14); ctx.fillStyle = '#176b2a'; ctx.beginPath(); ctx.arc(tr.x, tr.y - 4, 16, 0, 7); ctx.fill(); }
      for (const c of cars) drawCar(c.x, c.y, c.w, c.h, c.col);
      drawCar(me.x, me.y, me.w, me.h, '#ef4444');
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(10, 10, 150, 54);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(me.v * 0.5)} km/h`, 20, 33); ctx.fillText(`${Math.floor(dist / 10)} m`, 20, 55);
    },
  };
}

/* ========================= BOMBERMAN ========================= */
function bomber(api) {
  const { ctx } = api;
  const T = 32, COLS = 15, ROWS = 13, OX = 80, OY = 32;
  let grid, bombs, flames, items, enemies, stage = 1, score = 0, lives = 3, dead = false, msgT = 0;
  const P = { c: 1, r: 1, x: 0, y: 0, fc: 1, fr: 1, t: 1, inv: 0, max: 1, range: 2 };
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  function gen() {
    grid = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => {
      if (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0)) return 1;
      return Math.random() < 0.6 ? 2 : 0;
    }));
    for (const [c, r] of [[1, 1], [1, 2], [2, 1], [13, 1], [12, 1], [13, 2], [1, 11], [1, 10], [2, 11], [13, 11], [12, 11], [13, 10]]) grid[r][c] = 0;
    bombs = []; flames = []; items = [];
    Object.assign(P, { c: 1, r: 1, fc: 1, fr: 1, t: 1, inv: 2 });
    const spots = [[13, 1], [1, 11], [13, 11], [7, 5], [7, 7], [5, 5]];
    enemies = spots.slice(0, Math.min(6, 2 + stage)).map(([c, r]) => ({ c, r, fc: c, fr: r, t: 1, dir: ri(0, 3), cool: rnd(1, 3) }));
    for (const e of enemies) grid[e.r][e.c] = 0;
  }
  gen();
  const bombAt = (c, r) => bombs.find((b) => b.c === c && b.r === r);
  const free = (c, r) => grid[r] && grid[r][c] === 0 && !bombAt(c, r);
  function blast(c, r, range) {
    const out = [[c, r]];
    for (const [dx, dy] of DIRS) for (let i = 1; i <= range; i++) {
      const x = c + dx * i, y = r + dy * i;
      if (grid[y][x] === 1) break;
      out.push([x, y]);
      if (grid[y][x] === 2) break;
    }
    return out;
  }
  function dangerSet() {
    const s = new Set();
    for (const f of flames) s.add(f.c + ',' + f.r);
    for (const b of bombs) for (const [x, y] of blast(b.c, b.r, b.range)) s.add(x + ',' + y);
    return s;
  }
  function explode(b) {
    bombs.splice(bombs.indexOf(b), 1);
    for (const [x, y] of blast(b.c, b.r, b.range)) {
      if (grid[y][x] === 2) {
        grid[y][x] = 0; score += 10;
        if (Math.random() < 0.28) items.push({ c: x, r: y, type: Math.random() < 0.5 ? 'range' : 'bomb' });
      }
      flames.push({ c: x, r: y, t: 0.45 });
      const o = bombAt(x, y); if (o) o.t = 0;
      items = items.filter((it) => !(it.c === x && it.r === y && grid[y][x] === 0 && it.fresh !== true && false));
    }
    api.setScore(score);
  }
  function bfsSafe(c, r, danger, maxDepth, extraBomb) {
    const seen = new Set([c + ',' + r]), q = [[c, r, 0, null]];
    while (q.length) {
      const [x, y, d, first] = q.shift();
      if (d > 0 && !danger.has(x + ',' + y)) return first;
      if (d >= maxDepth) continue;
      for (let i = 0; i < 4; i++) {
        const nx = x + DIRS[i][0], ny = y + DIRS[i][1], k = nx + ',' + ny;
        if (seen.has(k) || !free(nx, ny)) continue;
        seen.add(k); q.push([nx, ny, d + 1, first === null ? i : first]);
      }
    }
    return -1;
  }
  const killP = () => {
    if (P.inv > 0) return;
    lives--;
    if (lives <= 0) { dead = true; api.over(score); return; }
    Object.assign(P, { c: 1, r: 1, fc: 1, fr: 1, t: 1, inv: 2.5 });
  };
  function stepActor(a, c, r, dur) { a.fc = a.c; a.fr = a.r; a.c = c; a.r = r; a.t = 0; a.dur = dur; }
  return {
    update(dt) {
      if (dead) return;
      msgT = Math.max(0, msgT - dt); P.inv = Math.max(0, P.inv - dt);
      for (const a of [P, ...enemies]) if (a.t < 1) a.t = Math.min(1, a.t + dt / (a.dur || 0.13));
      // người chơi
      if (P.t >= 1) {
        const d = api.down;
        const dir = (d.has('ArrowUp') || d.has('KeyW')) ? 0 : (d.has('ArrowRight') || d.has('KeyD')) ? 1 : (d.has('ArrowDown') || d.has('KeyS')) ? 2 : (d.has('ArrowLeft') || d.has('KeyA')) ? 3 : -1;
        if (dir >= 0) { const nx = P.c + DIRS[dir][0], ny = P.r + DIRS[dir][1]; if (free(nx, ny)) stepActor(P, nx, ny, 0.13); }
      }
      // bom
      for (const b of bombs.slice()) { b.t -= dt; if (b.t <= 0 && bombs.includes(b)) explode(b); }
      for (const f of flames) f.t -= dt;
      flames = flames.filter((f) => f.t > 0);
      // vật phẩm
      const it = items.findIndex((i) => i.c === P.c && i.r === P.r && P.t > 0.5);
      if (it >= 0) { const i = items.splice(it, 1)[0]; if (i.type === 'range') P.range++; else P.max++; score += 20; api.setScore(score); }
      // địch
      const danger = dangerSet();
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (flames.some((f) => f.c === e.c && f.r === e.r)) { enemies.splice(i, 1); score += 100; api.setScore(score); continue; }
        if (e.t >= 1) {
          e.cool -= dt;
          const here = danger.has(e.c + ',' + e.r);
          if (here) {
            const d = bfsSafe(e.c, e.r, danger, 8);
            if (d >= 0) { stepActor(e, e.c + DIRS[d][0], e.r + DIRS[d][1], 0.2); e.dir = d; }
          } else {
            const nearP = Math.abs(e.c - P.c) + Math.abs(e.r - P.r) <= 4;
            let wantBomb = e.cool <= 0 && !bombs.some((b) => b.owner === e) && (nearP || DIRS.some(([dx, dy]) => grid[e.r + dy][e.c + dx] === 2)) && Math.random() < 0.5;
            if (wantBomb) {
              const test = new Set([...danger, ...blast(e.c, e.r, 2).map(([x, y]) => x + ',' + y)]);
              if (bfsSafe(e.c, e.r, test, 6) >= 0) { bombs.push({ c: e.c, r: e.r, t: 2, range: 2, owner: e }); e.cool = rnd(3, 6); }
            }
            const opts = [];
            for (let d = 0; d < 4; d++) { const nx = e.c + DIRS[d][0], ny = e.r + DIRS[d][1]; if (free(nx, ny) && !danger.has(nx + ',' + ny)) opts.push(d); }
            if (opts.length) {
              let d = opts.includes(e.dir) && Math.random() < 0.7 ? e.dir : opts[ri(0, opts.length - 1)];
              if (Math.random() < 0.3) {
                const toward = opts.filter((o) => Math.abs(e.c + DIRS[o][0] - P.c) + Math.abs(e.r + DIRS[o][1] - P.r) < Math.abs(e.c - P.c) + Math.abs(e.r - P.r));
                if (toward.length) d = toward[ri(0, toward.length - 1)];
              }
              e.dir = d; stepActor(e, e.c + DIRS[d][0], e.r + DIRS[d][1], 0.28);
            }
          }
        }
        if (e.c === P.c && e.r === P.r) killP();
      }
      if (flames.some((f) => f.c === P.c && f.r === P.r)) killP();
      if (!enemies.length && !dead) { stage++; score += 300 * (stage - 1); api.setScore(score); msgT = 1.5; gen(); }
    },
    keyDown(c) {
      if (dead) return;
      if (c === 'Space' && bombs.filter((b) => b.owner === P).length < P.max && !bombAt(P.c, P.r)) bombs.push({ c: P.c, r: P.r, t: 2, range: P.range, owner: P });
    },
    draw() {
      ctx.fillStyle = '#10151f'; ctx.fillRect(0, 0, W, H);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const x = OX + c * T, y = OY + r * T, v = grid[r][c];
        ctx.fillStyle = (r + c) % 2 ? '#2f6b3a' : '#2a6035'; ctx.fillRect(x, y, T, T);
        if (v === 1) { ctx.fillStyle = '#5b6475'; ctx.fillRect(x, y, T, T); ctx.fillStyle = '#8b94a7'; ctx.fillRect(x, y, T, 5); ctx.fillStyle = '#3d4352'; ctx.fillRect(x, y + T - 5, T, 5); }
        else if (v === 2) { ctx.fillStyle = '#b8793f'; ctx.fillRect(x + 1, y + 1, T - 2, T - 2); ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x + 1, y + 15, T - 2, 2); ctx.fillRect(x + 15, y + 1, 2, 14); ctx.fillRect(x + 8, y + 17, 2, 14); ctx.fillRect(x + 22, y + 17, 2, 14); }
      }
      for (const i of items) {
        const x = OX + i.c * T + T / 2, y = OY + i.r * T + T / 2;
        ctx.fillStyle = i.type === 'range' ? '#f97316' : '#38bdf8'; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(i.type === 'range' ? '🔥' : '💣', x, y + 5);
      }
      for (const b of bombs) {
        const x = OX + b.c * T + T / 2, y = OY + b.r * T + T / 2, s = 1 + Math.sin(performance.now() / 90) * 0.08;
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y + 2, 11 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 4, 3, 3);
        ctx.strokeStyle = '#d4a017'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 4, y - 7); ctx.lineTo(x + 9, y - 13); ctx.stroke();
        ctx.fillStyle = Math.floor(performance.now() / 100) % 2 ? '#ff0' : '#f60'; ctx.beginPath(); ctx.arc(x + 9, y - 13, 3, 0, 7); ctx.fill();
      }
      for (const f of flames) {
        const x = OX + f.c * T, y = OY + f.r * T;
        ctx.fillStyle = '#ff7b00'; ctx.fillRect(x + 3, y + 3, T - 6, T - 6); ctx.fillStyle = '#ffe14d'; ctx.fillRect(x + 9, y + 9, T - 18, T - 18);
      }
      const pos = (a) => { const t = a.t >= 1 ? 1 : a.t; return [OX + (a.fc + (a.c - a.fc) * t) * T + T / 2, OY + (a.fr + (a.r - a.fr) * t) * T + T / 2]; };
      for (const e of enemies) {
        const [x, y] = pos(e);
        ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(x - 7, y - 5, 5, 6); ctx.fillRect(x + 2, y - 5, 5, 6); ctx.fillStyle = '#111'; ctx.fillRect(x - 5, y - 3, 2, 3); ctx.fillRect(x + 4, y - 3, 2, 3);
        ctx.fillRect(x - 6, y + 5, 12, 2);
      }
      if (!dead && (P.inv <= 0 || Math.floor(P.inv * 10) % 2 === 0)) {
        const [x, y] = pos(P);
        ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(x, y - 2, 11, 0, 7); ctx.fill();
        ctx.fillStyle = '#2563eb'; ctx.fillRect(x - 8, y + 6, 16, 8);
        ctx.fillStyle = '#fbd5b0'; ctx.fillRect(x - 7, y - 6, 14, 9);
        ctx.fillStyle = '#111'; ctx.fillRect(x - 4, y - 4, 2, 4); ctx.fillRect(x + 2, y - 4, 2, 4);
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x, y - 13, 3, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`Màn ${stage}   ❤ ${lives}   💣 ${P.max}   🔥 ${P.range}   Địch: ${enemies.length}   Điểm: ${score}`, OX, 22);
      if (msgT > 0) { ctx.fillStyle = '#ffd166'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('QUA MÀN!', W / 2, H / 2); }
    },
  };
}

/* ========================= VỎ MÁY GAME ========================= */
const FACTORY = { tetris, ludo, tank: tankGame, racing, bomber };
let root = null, canvas, ctx, current = null, currentId = null, raf = 0, last = 0, overScore = null, onCloseCb = null;
const down = new Set();
const api = { get ctx() { return ctx; }, down, setScore: (s) => { root.querySelector('#arcScore').textContent = 'Điểm: ' + s; }, over: (s) => { overScore = s; } };

function build() {
  const st = document.createElement('style');
  st.textContent = `
  #arcade{position:fixed;inset:0;z-index:60;background:rgba(5,5,15,.82);display:flex;align-items:center;justify-content:center}
  #arcade.hidden{display:none}
  .arc-card{background:#141428;border:3px solid #7c3aed;border-radius:18px;padding:12px;box-shadow:0 0 40px #7c3aed88;max-width:96vw}
  .arc-head{display:flex;gap:10px;align-items:center;margin-bottom:8px;color:#fff}
  .arc-head b{flex:1;font-size:17px}
  #arcMenu{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:min(640px,86vw);padding:10px}
  #arcMenu button{padding:18px 8px;font-size:17px;background:#26264a;border:2px solid #4c3b8f;border-radius:14px;color:#fff;cursor:pointer}
  #arcMenu button:hover{background:#3b2f78;border-color:#a78bfa}
  #arcMenu button span{display:block;font-size:34px}
  #arcMenu button small{display:block;font-size:11px;opacity:.7;margin-top:4px}
  #arcCanvas{display:block;width:min(640px,92vw);height:auto;aspect-ratio:4/3;background:#000;border-radius:8px;image-rendering:auto}
  #arcHelp{color:#aab;font-size:12px;margin-top:8px;text-align:center;max-width:640px}
  #arcCanvas.hidden{display:none}
  `;
  document.head.appendChild(st);
  root = document.createElement('div');
  root.id = 'arcade'; root.className = 'hidden';
  root.innerHTML = `<div class="arc-card"><div class="arc-head"><b id="arcTitle">🕹️ MÁY GAME CONSOLE</b><span id="arcScore"></span>
    <button id="arcBack" class="hidden">☰ Menu</button><button id="arcClose">✖ Thoát</button></div>
    <div id="arcMenu"></div><canvas id="arcCanvas" width="${W}" height="${H}" class="hidden"></canvas><div id="arcHelp">Chọn một trò chơi · Esc: thoát</div></div>`;
  document.body.appendChild(root);
  canvas = root.querySelector('#arcCanvas'); ctx = canvas.getContext('2d');
  root.querySelector('#arcClose').onclick = () => Arcade.close();
  root.querySelector('#arcBack').onclick = () => backToMenu();
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    current && current.click && current.click((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
  });
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', (e) => { if (!Arcade.isOpen) return; e.stopImmediatePropagation(); down.delete(e.code); down.delete(ALIAS[e.code]); }, true);
  window.addEventListener('blur', () => down.clear());
}
function renderMenu() {
  const m = root.querySelector('#arcMenu');
  m.innerHTML = GAMES.map((g) => `<button data-id="${g.id}"><span>${g.icon}</span>${g.name}<small>Kỷ lục: ${localStorage.getItem('arcade-best-' + g.id) || 0}</small></button>`).join('');
  m.onclick = (e) => { const b = e.target.closest('button'); if (b) startGame(b.dataset.id); };
}
function backToMenu() {
  current = null; currentId = null; overScore = null;
  canvas.classList.add('hidden'); root.querySelector('#arcMenu').classList.remove('hidden'); root.querySelector('#arcBack').classList.add('hidden');
  root.querySelector('#arcTitle').textContent = '🕹️ MÁY GAME CONSOLE'; root.querySelector('#arcScore').textContent = '';
  root.querySelector('#arcHelp').textContent = 'Chọn một trò chơi · Esc: thoát'; renderMenu();
}
function startGame(id) {
  currentId = id; overScore = null; down.clear();
  const g = GAMES.find((x) => x.id === id);
  root.querySelector('#arcMenu').classList.add('hidden'); canvas.classList.remove('hidden'); root.querySelector('#arcBack').classList.remove('hidden');
  root.querySelector('#arcTitle').textContent = `${g.icon} ${g.name}`; root.querySelector('#arcScore').textContent = 'Điểm: 0';
  root.querySelector('#arcHelp').textContent = g.help;
  current = FACTORY[id](api);
}
const ALIAS = { KeyW: 'ArrowUp', KeyA: 'ArrowLeft', KeyS: 'ArrowDown', KeyD: 'ArrowRight' };
function onKeyDown(e) {
  if (!Arcade.isOpen) return;
  e.stopImmediatePropagation();
  const c = e.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
  if (c === 'Escape') { if (current) backToMenu(); else Arcade.close(); return; }
  if (current && overScore !== null && c === 'Enter') { startGame(currentId); return; }
  const c2 = ALIAS[c] || c; // WASD hoạt động như phím mũi tên ở mọi trò
  down.add(c); down.add(c2);
  if (current && overScore === null) current.keyDown && current.keyDown(c2, e.repeat);
}
function loop(t) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (!current) return;
  if (overScore === null) current.update(dt);
  current.draw();
  if (overScore !== null) {
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, 150, W, 170);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 40px sans-serif';
    ctx.fillText(currentId === 'ludo' ? 'KẾT THÚC' : 'GAME OVER', W / 2, 215);
    const key = 'arcade-best-' + currentId, best = +localStorage.getItem(key) || 0;
    if (overScore > best) localStorage.setItem(key, overScore);
    ctx.font = '22px sans-serif'; ctx.fillStyle = '#ffd166';
    if (currentId !== 'ludo') ctx.fillText(`Điểm: ${overScore}   ·   Kỷ lục: ${Math.max(best, overScore)}`, W / 2, 255);
    ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText('Enter: chơi lại · Esc: về menu', W / 2, 295);
  }
}
export const Arcade = {
  isOpen: false,
  open(onClose) {
    if (!root) build();
    onCloseCb = onClose; Arcade.isOpen = true; down.clear();
    root.classList.remove('hidden'); backToMenu();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  },
  close() {
    if (!Arcade.isOpen) return;
    Arcade.isOpen = false; root.classList.add('hidden'); cancelAnimationFrame(raf); current = null; down.clear();
    if (onCloseCb) onCloseCb();
  },
};
