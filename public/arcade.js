/* Máy game console: Tetris, Cờ cá ngựa, Bắn tank, Đua xe, Bomberman (canvas 2D; Cờ cá ngựa/Tank/Bomberman chơi online nhiều người) */
const GAMES = [
  { id: 'tetris', icon: '🧱', name: 'Tetris', help: '← → hoặc A D: di chuyển · ↑ / W / X: xoay · Z: xoay ngược · ↓ / S: rơi nhanh · Space: thả xuống · Enter: chơi lại' },
  { id: 'ludo', icon: '🐴', name: 'Cờ cá ngựa', help: 'Space/Enter: tung xúc xắc · click vào quân hoặc phím 1-4 để đi · cần ra 6 để xuất quân · không được nhảy qua đầu quân khác · 1 người đấu 3 máy hoặc chơi Online với bạn bè' },
  { id: 'tank', icon: '🛡️', name: 'Bắn tank', help: 'WASD / mũi tên: lái · Space: bắn · phá gạch, diệt hết xe địch · Online: co-op cùng bạn bè · Enter: chơi lại' },
  { id: 'racing', icon: '🏎️', name: 'Đua xe', help: '← → đánh lái · ↑ tăng tốc · ↓ phanh · tránh xe phía trước · Enter: chơi lại' },
  { id: 'bomber', icon: '💣', name: 'Bomberman', help: 'WASD / mũi tên: đi · Space: đặt bom · nổ gạch nhặt vật phẩm · 1 người: diệt hết kẻ địch · Online: đấu, sống sót cuối cùng thắng · Enter: chơi lại' },
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

/* ========================= CỜ CÁ NGỰA (LUDO) — 1 người hoặc nhiều người ========================= */
const CN = ['đỏ', 'xanh dương', 'vàng', 'xanh lá'];
function ludo(api, o = {}) {
  const { ctx } = api;
  const guest = o.mode === 'guest', mySlot = o.mySlot || 0;
  const slots = o.slots || [{ name: 'Bạn', human: true }, { human: false }, { human: false }, { human: false }];
  const isHuman = (k) => !!slots[k].human;
  const label = (k) => (isHuman(k) ? `${slots[k].name} (${CN[k]})` : `Máy ${CN[k]}`);
  const CS = 40, OX = (W - 440) / 2, OY = 12;
  const ring = [];
  for (let x = 0; x <= 10; x++) ring.push([x, 0]);
  for (let y = 1; y <= 10; y++) ring.push([10, y]);
  for (let x = 9; x >= 0; x--) ring.push([x, 10]);
  for (let y = 9; y >= 1; y--) ring.push([0, y]);
  const entry = [5, 15, 25, 35], start = entry.map((e) => (e + 2) % 40);
  const homeDir = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  const baseC = [[8, 2], [8, 8], [2, 8], [2, 2]], slotOff = [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]];
  const COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047'];
  let pcs = [0, 1, 2, 3].map(() => [-1, -1, -1, -1]);
  let turn = 0, phase = 'roll', dice = 0, sixes = 0, winner = -1, botT = 0.8, passT = 0, msg = '', autoT = 0, rolling = 0;
  msg = `Lượt của ${label(0)}`;
  const cellOf = (k, p, i) => {
    if (p < 0) return [baseC[k][0] + slotOff[i][0], baseC[k][1] + slotOff[i][1]];
    if (p <= 38) return ring[(start[k] + p) % 40];
    const s = p - 39, e = ring[entry[k]];
    return [e[0] + homeDir[k][0] * (s + 1), e[1] + homeDir[k][1] * (s + 1)];
  };
  const px = (c) => [OX + (c[0] + 0.5) * CS, OY + (c[1] + 0.5) * CS];
  // mỗi ô có 1 "khoá" để biết quân nào đang đứng đó (đường chung: theo vị trí vòng; đường về đích: riêng từng màu)
  const cellKey = (k, p) => (p <= 38 ? 'r' + ((start[k] + p) % 40) : 'h' + k + '_' + p);
  const occupiedBy = (key) => {
    const out = [];
    for (let o = 0; o < 4; o++) pcs[o].forEach((q, j) => { if (q >= 0 && cellKey(o, q) === key) out.push([o, j]); });
    return out;
  };
  // luật: KHÔNG được nhảy qua đầu quân khác (bất kể màu); không được đáp lên quân nhà (trừ ô đích cuối); đáp lên quân địch = đá về chuồng
  const legal = (k, d) => {
    const out = [];
    pcs[k].forEach((p, i) => {
      if (p === -1) {
        if (d !== 6) return;
        if (occupiedBy(cellKey(k, 0)).some(([o]) => o === k)) return;
        out.push(i); return;
      }
      const np = p + d;
      if (np > 43) return;
      for (let s = p + 1; s <= np; s++) {
        const occ = occupiedBy(cellKey(k, s));
        if (s < np) { if (occ.length) return; }
        else if (np !== 43 && occ.some(([o]) => o === k)) return;
      }
      out.push(i);
    });
    return out;
  };  function nextTurn() {
    if (dice === 6 && sixes < 3) sixes++; else { turn = (turn + 1) % 4; sixes = 0; }
    phase = 'roll'; dice = 0; msg = `Lượt của ${label(turn)}`; botT = 0.9;
  }
  function doRoll() {
    dice = ri(1, 6); rolling = 0.4;
    const mv = legal(turn, dice);
    if (!mv.length) { phase = 'pass'; passT = 1.0; msg = `${label(turn)} tung ${dice}: không có nước đi`; return; }
    phase = 'choose'; msg = `${label(turn)} tung ${dice}` + (isHuman(turn) && mv.length > 1 ? ' — chọn quân để đi' : '');
    autoT = isHuman(turn) && mv.length === 1 ? 0.6 : 0;
  }
  function movePiece(k, i) {
    const p = pcs[k][i], np = p === -1 ? 0 : p + dice;
    pcs[k][i] = np;
    if (np <= 38) {
      const idx = (start[k] + np) % 40;
      for (let q = 0; q < 4; q++) if (q !== k) pcs[q].forEach((v, j) => {
        if (v >= 0 && v <= 38 && (start[q] + v) % 40 === idx) { pcs[q][j] = -1; msg = `${label(k)} đá quân của ${label(q)}! 💥`; }
      });
    }
    if (pcs[k].every((q) => q === 43)) {
      winner = k; msg = `🎉 ${label(k)} thắng!`;
      api.over(k === mySlot ? 1 : 0, k === mySlot ? '🎉 BẠN THẮNG!' : `${label(k)} thắng`); return;
    }
    nextTurn();
  }
  function botChoose() {
    const mv = legal(turn, dice);
    let best = mv[0], bs = -1;
    for (const i of mv) {
      const p = pcs[turn][i], np = p === -1 ? 0 : p + dice;
      let s = np;
      if (p === -1) s += 60;
      if (np <= 38) { const idx = (start[turn] + np) % 40; for (let q = 0; q < 4; q++) if (q !== turn) pcs[q].forEach((v) => { if (v >= 0 && v <= 38 && (start[q] + v) % 40 === idx) s += 100; }); }
      if (np >= 39) s += 30; if (np === 43) s += 40;
      if (s > bs) { bs = s; best = i; }
    }
    movePiece(turn, best);
  }
  const rollAction = (slot) => { if (winner < 0 && turn === slot && isHuman(slot) && phase === 'roll') doRoll(); };
  const moveAction = (slot, i) => { if (winner < 0 && turn === slot && phase === 'choose' && legal(slot, dice).includes(i)) movePiece(slot, i); };
  function slotKey(slot, c) {
    if (c === 'Space' || c === 'Enter') rollAction(slot);
    else if (/^Digit[1-4]$/.test(c)) moveAction(slot, +c.slice(5) - 1);
  }
  function slotClick(slot, x, y) {
    if (winner >= 0 || turn !== slot) return;
    if (phase === 'roll') { rollAction(slot); return; }
    if (phase !== 'choose') return;
    for (const i of legal(slot, dice)) {
      const [cx, cy] = px(cellOf(slot, pcs[slot][i], i));
      if (Math.hypot(x - cx, y - cy) < 20) { moveAction(slot, i); return; }
    }
  }
  const pip = [[], [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];
  return {
    update(dt) {
      if (rolling > 0) rolling -= dt;
      if (guest || winner >= 0) return;
      if (phase === 'pass') { passT -= dt; if (passT <= 0) nextTurn(); return; }
      if (!isHuman(turn)) {
        botT -= dt;
        if (botT <= 0) { if (phase === 'roll') { doRoll(); botT = 0.9; } else if (phase === 'choose') botChoose(); }
      } else if (phase === 'choose' && autoT > 0) { autoT -= dt; if (autoT <= 0) movePiece(turn, legal(turn, dice)[0]); }
    },
    keyDown(c) { slotKey(mySlot, c); },
    click(x, y) { slotClick(mySlot, x, y); },
    slotKey, slotClick,
    slotLeft(slot) { slots[slot].human = false; },
    getState: () => ({ pcs, turn, phase, dice, msg, winner, sixes, hum: slots.map((s) => !!s.human) }),
    setState(s) {
      const nd = s.dice !== dice && s.dice > 0;
      pcs = s.pcs; turn = s.turn; phase = s.phase; dice = s.dice; msg = s.msg; sixes = s.sixes;
      s.hum.forEach((h, i) => { slots[i].human = h; });
      if (nd) rolling = 0.4;
      if (s.winner >= 0 && winner < 0) { winner = s.winner; api.over(winner === mySlot ? 1 : 0, winner === mySlot ? '🎉 BẠN THẮNG!' : `${label(winner)} thắng`); }
    },
    draw() {
      ctx.fillStyle = '#16213e'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f5ecd5'; ctx.fillRect(OX - 6, OY - 6, 452, 452);
      for (let k = 0; k < 4; k++) {
        const [cx, cy] = px(baseC[k]);
        ctx.fillStyle = COLORS[k] + '55'; ctx.beginPath(); ctx.roundRect(cx - 1.6 * CS, cy - 1.6 * CS, 3.2 * CS, 3.2 * CS, 14); ctx.fill();
        ctx.strokeStyle = COLORS[k]; ctx.lineWidth = k === mySlot ? 6 : 3; ctx.stroke();
      }
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
      const mvs = turn === mySlot && phase === 'choose' && winner < 0 ? legal(mySlot, dice) : [];
      const stack = {};
      for (let k = 0; k < 4; k++) pcs[k].forEach((p, i) => {
        const c = cellOf(k, p, i), key = c.join(',');
        const n = stack[key] = (stack[key] || 0) + 1;
        let [cx, cy] = px(c); if (p >= 0) { cx += (n - 1) * 6; cy -= (n - 1) * 6; }
        const hl = k === mySlot && mvs.includes(i);
        const bounce = hl ? Math.abs(Math.sin(performance.now() / 180)) * 5 : 0;
        // bóng + đế
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + 13, 13, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = COLORS[k]; ctx.strokeStyle = hl ? '#fff' : '#222'; ctx.lineWidth = hl ? 3 : 2;
        ctx.beginPath(); ctx.ellipse(cx, cy + 10, 12, 5.5, 0, 0, 7); ctx.fill(); ctx.stroke();
        // con ngựa ♞
        ctx.font = '32px "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", "Arial Unicode MS", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = hl ? '#fff' : '#1a1a1a'; ctx.lineJoin = 'round';
        ctx.strokeText('♞', cx, cy - 3 - bounce);
        ctx.fillStyle = COLORS[k]; ctx.fillText('♞', cx, cy - 3 - bounce);
        if (k === mySlot) { // số thứ tự quân để chọn bằng phím 1-4
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(cx + 11, cy + 9, 7, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#111'; ctx.font = 'bold 10px sans-serif'; ctx.fillText(String(i + 1), cx + 11, cy + 10);
        }
      });
      ctx.textBaseline = 'alphabetic';
      const dx = 560, dy = 70;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = COLORS[turn]; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(dx - 30, dy - 30, 60, 60, 10); ctx.fill(); ctx.stroke();
      const shown = rolling > 0 ? ri(1, 6) : dice;
      ctx.fillStyle = '#111';
      (pip[shown] || []).forEach(([a, b]) => { ctx.beginPath(); ctx.arc(dx + a * 15, dy + b * 15, 5, 0, 7); ctx.fill(); });
      ctx.fillStyle = COLORS[turn]; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(isHuman(turn) ? slots[turn].name : `Máy ${CN[turn]}`, dx, dy + 52);
      ctx.textAlign = 'left'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#ffd166';
      const lines = []; let line = '';
      for (const w of String(msg).split(' ')) { if ((line + w).length > 22) { lines.push(line); line = ''; } line += w + ' '; } lines.push(line);
      lines.forEach((l, i) => ctx.fillText(l, 14, 40 + i * 20));
      if (turn === mySlot && winner < 0 && phase === 'roll') { ctx.fillStyle = '#4ade80'; ctx.fillText('👉 Tới lượt bạn!', 14, 140); ctx.font = '13px sans-serif'; ctx.fillText('Space / click để tung', 14, 160); }
      ctx.fillStyle = COLORS[mySlot]; ctx.font = 'bold 13px sans-serif'; ctx.fillText(`Bạn là quân ${CN[mySlot]}`, 14, 380);
      ctx.fillStyle = '#9aa4c7'; ctx.font = '13px sans-serif';
      pcs.forEach((a, k) => ctx.fillText(`${isHuman(k) ? slots[k].name : 'Máy ' + CN[k]}: ${a.filter((p) => p === 43).length}/4`, 14, 402 + k * 17));
    },
  };
}

/* ========================= BẮN TANK — chơi 1 người hoặc co-op nhiều người ========================= */
function tankGame(api, o = {}) {
  const { ctx } = api;
  const guest = o.mode === 'guest', mySlot = o.mySlot || 0;
  const slots = o.slots || [{ name: 'Bạn' }];
  const remote = o.remote || [];
  const isDown = (slot, code) => (slot === mySlot ? api.down.has(code) : !!(remote[slot] && remote[slot].has(code)));
  const T = 24, COLS = 26, ROWS = 20, OX = 8, HALF = 10;
  const PCOL = [['#facc15', '#fde68a'], ['#38bdf8', '#bae6fd'], ['#4ade80', '#bbf7d0'], ['#f472b6', '#fbcfe8']];
  let map, tanks = [], bullets = [], stage = 1, score = 0, toSpawn = 0, spawnT = 1, dead = false, flash = 0, mapVer = 0, sentVer = -1;
  const pls = slots.map((s, i) => ({ x: 0, y: 0, dir: 0, cool: 0, inv: 2, lives: 3, alive: true, slot: i, name: s.name || 'Bạn', tx: 0, ty: 0 }));
  const SPAWNS = [[1, 0], [12, 0], [24, 0]];
  const homeX = (i) => OX + T * (10.5 + 1.6 * i), homeY = 19.5 * T - 2;
  function gen() {
    map = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => (Math.random() < 0.2 ? 1 : Math.random() < 0.04 ? 2 : 0)));
    for (let r = 17; r < ROWS; r++) for (let c = 10; c < 16; c++) map[r][c] = 0;
    for (const [c] of SPAWNS) for (let r = 0; r < 3; r++) for (let d = -1; d <= 1; d++) if (map[r] && map[r][c + d] !== undefined) map[r][c + d] = 0;
    for (const c of [9, 16]) for (let r = 17; r < ROWS; r++) map[r][c] = 1;
    tanks = []; bullets = []; mapVer++;
    toSpawn = 6 + stage * 2 + (slots.length - 1) * 4; spawnT = 1;
    for (const p of pls) if (p.alive) Object.assign(p, { x: homeX(p.slot), y: homeY, dir: 0, cool: 0, inv: 2 });
  }
  if (!guest) gen(); else { map = Array.from({ length: ROWS }, () => Array(COLS).fill(0)); pls.forEach((p) => { p.x = p.tx = homeX(p.slot); p.y = p.ty = homeY; }); }
  const solid = (c, r) => c < 0 || r < 0 || c >= COLS || r >= ROWS || map[r][c] > 0;
  const tileAt = (x, y) => [Math.floor((x - OX) / T), Math.floor(y / T)];
  function blocked(t, nx, ny) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const [c, r] = tileAt(nx + sx * HALF, ny + sy * HALF);
      if (solid(c, r)) return true;
    }
    for (const q of [...pls.filter((p) => p.alive), ...tanks]) {
      if (q === t) continue;
      if (Math.abs(q.x - nx) < HALF * 2 && Math.abs(q.y - ny) < HALF * 2) return true;
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
  const shoot = (t, own) => bullets.push({ x: t.x + DX[t.dir] * 14, y: t.y + DY[t.dir] * 14, dir: t.dir, own });
  function killPlayer(p) {
    if (!p.alive || p.inv > 0) return;
    p.lives--; if (p.slot === mySlot) flash = 0.5;
    if (p.lives <= 0) {
      p.alive = false;
      if (!pls.some((q) => q.alive)) { dead = true; api.over(score, 'GAME OVER'); }
      return;
    }
    Object.assign(p, { x: homeX(p.slot), y: homeY, dir: 0, inv: 2.5 });
  }
  const nearest = (t) => { let b = null, bd = 1e9; for (const p of pls) if (p.alive) { const d = Math.hypot(p.x - t.x, p.y - t.y); if (d < bd) { bd = d; b = p; } } return b; };
  function hostUpdate(dt) {
    flash = Math.max(0, flash - dt);
    for (const p of pls) {
      if (!p.alive) continue;
      p.inv = Math.max(0, p.inv - dt); p.cool -= dt;
      if (isDown(p.slot, 'ArrowUp')) step(p, 0, 100 * dt);
      else if (isDown(p.slot, 'ArrowDown')) step(p, 2, 100 * dt);
      else if (isDown(p.slot, 'ArrowLeft')) step(p, 3, 100 * dt);
      else if (isDown(p.slot, 'ArrowRight')) step(p, 1, 100 * dt);
      if (isDown(p.slot, 'Space') && p.cool <= 0) { shoot(p, 'p'); p.cool = 0.4; }
    }
    spawnT -= dt;
    if (spawnT <= 0 && toSpawn > 0 && tanks.length < Math.min(7, 3 + Math.floor(stage / 2) + slots.length - 1)) {
      const [c, r] = SPAWNS[ri(0, 2)], x = OX + (c + 0.5) * T, y = (r + 0.5) * T + 2;
      if (!blocked(null, x, y)) { tanks.push({ x, y, dir: 2, turn: rnd(0.5, 2), fire: rnd(0.8, 2), speed: 60 + stage * 6 }); toSpawn--; spawnT = 2.2; }
    }
    for (const t of tanks) {
      t.turn -= dt; t.fire -= dt;
      const ok = step(t, t.dir, t.speed * dt);
      if (!ok || t.turn <= 0) {
        t.turn = rnd(0.6, 2.2);
        const r = Math.random(), tp = nearest(t);
        t.dir = r < 0.4 ? 2 : r < 0.55 && tp ? (tp.x < t.x ? 3 : 1) : ri(0, 3);
      }
      if (t.fire <= 0) { shoot(t, 'e'); t.fire = rnd(0.9, 2.2); }
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += DX[b.dir] * 280 * dt; b.y += DY[b.dir] * 280 * dt;
      const [c, r] = tileAt(b.x, b.y);
      let gone = false;
      if (solid(c, r)) {
        if (r >= 0 && c >= 0 && r < ROWS && c < COLS && map[r][c] === 1) {
          map[r][c] = 0; mapVer++;
          const pc = b.dir % 2 === 0 ? [[c - 1, r], [c + 1, r]] : [[c, r - 1], [c, r + 1]];
          for (const [a, bb] of pc) if (map[bb] && map[bb][a] === 1 && Math.random() < 0.5) map[bb][a] = 0;
        }
        gone = true;
      } else if (b.own === 'p') {
        for (let j = tanks.length - 1; j >= 0; j--) if (Math.hypot(tanks[j].x - b.x, tanks[j].y - b.y) < 13) { tanks.splice(j, 1); score += 100; api.setScore(score); gone = true; break; }
      } else {
        for (const p of pls) if (p.alive && Math.hypot(p.x - b.x, p.y - b.y) < 12) { killPlayer(p); gone = true; break; }
      }
      if (gone) bullets.splice(i, 1);
    }
    for (const t of tanks) for (const p of pls) if (p.alive && Math.abs(t.x - p.x) < 20 && Math.abs(t.y - p.y) < 20 && Math.random() < 0.02) killPlayer(p);
    if (!dead && toSpawn === 0 && !tanks.length) { stage++; score += 500; api.setScore(score); gen(); }
  }
  return {
    update(dt) {
      if (guest) {
        const f = Math.min(1, dt * 18);
        for (const p of pls) { p.x += (p.tx - p.x) * f; p.y += (p.ty - p.y) * f; }
        for (const t of tanks) { t.x += (t.tx - t.x) * f; t.y += (t.ty - t.y) * f; }
        flash = Math.max(0, flash - dt);
        return;
      }
      if (dead) return;
      hostUpdate(dt);
    },
    keyDown() {},
    slotKey() {},
    slotLeft(slot) { const p = pls[slot]; if (p) { p.alive = false; if (!pls.some((q) => q.alive)) { dead = true; api.over(score, 'GAME OVER'); } } },
    getState() {
      const s = {
        pls: pls.map((p) => ({ x: p.x, y: p.y, dir: p.dir, inv: p.inv, lives: p.lives, alive: p.alive, slot: p.slot, name: p.name })),
        tanks: tanks.map((t) => [t.x, t.y, t.dir]), bullets: bullets.map((b) => [b.x, b.y, b.dir, b.own]), stage, score, toSpawn,
      };
      if (mapVer !== sentVer) { s.map = map; sentVer = mapVer; }
      return s;
    },
    setState(s) {
      if (s.map) map = s.map;
      s.pls.forEach((n, i) => {
        const p = pls[i]; if (!p) return;
        if (p.slot === mySlot && n.lives < p.lives) flash = 0.5;
        Object.assign(p, { dir: n.dir, inv: n.inv, lives: n.lives, alive: n.alive, tx: n.x, ty: n.y });
        if (Math.abs(p.x - n.x) > 60 || Math.abs(p.y - n.y) > 60) { p.x = n.x; p.y = n.y; }
      });
      tanks = s.tanks.map((t, i) => {
        const old = tanks[i];
        return { x: old ? old.x : t[0], y: old ? old.y : t[1], tx: t[0], ty: t[1], dir: t[2] };
      });
      bullets = s.bullets.map((b) => ({ x: b[0], y: b[1], dir: b[2], own: b[3] }));
      stage = s.stage; score = s.score; toSpawn = s.toSpawn; api.setScore(score);
    },
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
        ctx.fillRect(-1.5, -14, 3, 12);
        ctx.restore();
      };
      for (const t of tanks) drawTank(t, '#ef4444', '#fca5a5');
      for (const p of pls) {
        if (!p.alive || (p.inv > 0 && Math.floor(p.inv * 10) % 2)) continue;
        drawTank(p, PCOL[p.slot % 4][0], PCOL[p.slot % 4][1]);
        if (pls.length > 1) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.name, p.x, p.y - 16); }
      }
      ctx.fillStyle = '#fff';
      for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 7); ctx.fill(); }
      if (flash > 0) { ctx.fillStyle = `rgba(255,0,0,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
      const me = pls[mySlot] || pls[0];
      ctx.fillText(`Màn ${stage}  ·  ❤ ${me.lives}  ·  Địch còn: ${toSpawn + tanks.length}  ·  Điểm ${score}` + (pls.length > 1 ? `  ·  ${pls.map((p) => p.name + ':' + (p.alive ? p.lives : '✖')).join(' ')}` : ''), OX + 6, 14);
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

/* ========================= BOMBERMAN — chiến dịch 1 người hoặc đấu nhiều người ========================= */
function bomber(api, o = {}) {
  const { ctx } = api;
  const guest = o.mode === 'guest', mySlot = o.mySlot || 0, multi = !!o.multi;
  const slots = o.slots || [{ name: 'Bạn' }];
  const remote = o.remote || [];
  const isDown = (slot, code) => (slot === mySlot ? api.down.has(code) : !!(remote[slot] && remote[slot].has(code)));
  const T = 32, COLS = 15, ROWS = 13, OX = 80, OY = 32;
  const CORNERS = [[1, 1], [13, 1], [1, 11], [13, 11]], PCOL = ['#2563eb', '#ef4444', '#16a34a', '#eab308'];
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  let grid, bombs = [], flames = [], items = [], enemies = [], pl = [], stage = 1, score = 0, dead = false, msgT = 0, endText = null;
  const mk = (i) => ({ c: CORNERS[i][0], r: CORNERS[i][1], fc: CORNERS[i][0], fr: CORNERS[i][1], t: 1, dur: 0.13, inv: 2, max: 1, range: 2, alive: true, lives: multi ? 1 : 3, slot: i, name: (slots[i] && slots[i].name) || 'Bạn' });
  function gen() {
    grid = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => {
      if (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0)) return 1;
      return Math.random() < 0.6 ? 2 : 0;
    }));
    for (const [c, r] of [[1, 1], [1, 2], [2, 1], [13, 1], [12, 1], [13, 2], [1, 11], [1, 10], [2, 11], [13, 11], [12, 11], [13, 10]]) grid[r][c] = 0;
    bombs = []; flames = []; items = [];
    if (!pl.length) pl = slots.map((s, i) => mk(i));
    else pl.forEach((p) => { if (p.alive) Object.assign(p, { c: CORNERS[p.slot][0], r: CORNERS[p.slot][1], fc: CORNERS[p.slot][0], fr: CORNERS[p.slot][1], t: 1, inv: 2 }); });
    if (multi) { enemies = []; for (let i = slots.length; i < 4; i++) enemies.push({ c: CORNERS[i][0], r: CORNERS[i][1], fc: CORNERS[i][0], fr: CORNERS[i][1], t: 1, dir: ri(0, 3), cool: rnd(1, 3) }); }
    else {
      const spots = [[13, 1], [1, 11], [13, 11], [7, 5], [7, 7], [5, 5]];
      enemies = spots.slice(0, Math.min(6, 2 + stage)).map(([c, r]) => ({ c, r, fc: c, fr: r, t: 1, dir: ri(0, 3), cool: rnd(1, 3) }));
      for (const e of enemies) grid[e.r][e.c] = 0;
    }
  }
  if (!guest) gen(); else { grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0)); pl = slots.map((s, i) => mk(i)); }
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
      const ob = bombAt(x, y); if (ob) ob.t = 0;
    }
    api.setScore(score);
  }
  function bfsSafe(c, r, danger, maxDepth) {
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
  function finish(text) { if (dead) return; dead = true; endText = text; api.over(score, text); }
  function killP(p) {
    if (!p.alive || p.inv > 0) return;
    p.lives--;
    if (p.lives <= 0) {
      p.alive = false;
      if (!multi) finish('GAME OVER');
      return;
    }
    Object.assign(p, { c: CORNERS[p.slot][0], r: CORNERS[p.slot][1], fc: CORNERS[p.slot][0], fr: CORNERS[p.slot][1], t: 1, inv: 2.5 });
  }
  const stepActor = (a, c, r, dur) => { a.fc = a.c; a.fr = a.r; a.c = c; a.r = r; a.t = 0; a.dur = dur; };
  function placeBomb(p) {
    if (!p.alive || bombs.filter((b) => b.owner === p).length >= p.max || bombAt(p.c, p.r)) return;
    bombs.push({ c: p.c, r: p.r, t: 2, range: p.range, owner: p });
  }
  function hostUpdate(dt) {
    msgT = Math.max(0, msgT - dt);
    for (const a of [...pl, ...enemies]) if (a.t < 1) a.t = Math.min(1, a.t + dt / (a.dur || 0.13));
    for (const p of pl) {
      if (!p.alive) continue;
      p.inv = Math.max(0, p.inv - dt);
      if (p.t >= 1) {
        const dir = isDown(p.slot, 'ArrowUp') ? 0 : isDown(p.slot, 'ArrowRight') ? 1 : isDown(p.slot, 'ArrowDown') ? 2 : isDown(p.slot, 'ArrowLeft') ? 3 : -1;
        if (dir >= 0) { const nx = p.c + DIRS[dir][0], ny = p.r + DIRS[dir][1]; if (free(nx, ny)) stepActor(p, nx, ny, 0.13); }
      }
    }
    for (const b of bombs.slice()) { b.t -= dt; if (b.t <= 0 && bombs.includes(b)) explode(b); }
    for (const f of flames) f.t -= dt;
    flames = flames.filter((f) => f.t > 0);
    for (const p of pl) {
      if (!p.alive) continue;
      const it = items.findIndex((i) => i.c === p.c && i.r === p.r && p.t > 0.5);
      if (it >= 0) { const i = items.splice(it, 1)[0]; if (i.type === 'range') p.range++; else p.max++; score += 20; api.setScore(score); }
    }
    const danger = dangerSet();
    const humans = pl.filter((p) => p.alive);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (flames.some((f) => f.c === e.c && f.r === e.r)) { enemies.splice(i, 1); score += 100; api.setScore(score); continue; }
      let tp = null, bd = 1e9; for (const p of humans) { const d = Math.abs(p.c - e.c) + Math.abs(p.r - e.r); if (d < bd) { bd = d; tp = p; } }
      if (e.t >= 1) {
        e.cool -= dt;
        if (danger.has(e.c + ',' + e.r)) {
          const d = bfsSafe(e.c, e.r, danger, 8);
          if (d >= 0) { stepActor(e, e.c + DIRS[d][0], e.r + DIRS[d][1], 0.2); e.dir = d; }
        } else {
          const nearP = tp && bd <= 4;
          const wantBomb = e.cool <= 0 && !bombs.some((b) => b.owner === e) && (nearP || DIRS.some(([dx, dy]) => grid[e.r + dy][e.c + dx] === 2)) && Math.random() < 0.5;
          if (wantBomb) {
            const test = new Set([...danger, ...blast(e.c, e.r, 2).map(([x, y]) => x + ',' + y)]);
            if (bfsSafe(e.c, e.r, test, 6) >= 0) { bombs.push({ c: e.c, r: e.r, t: 2, range: 2, owner: e }); e.cool = rnd(3, 6); }
          }
          const opts = [];
          for (let d = 0; d < 4; d++) { const nx = e.c + DIRS[d][0], ny = e.r + DIRS[d][1]; if (free(nx, ny) && !danger.has(nx + ',' + ny)) opts.push(d); }
          if (opts.length) {
            let d = opts.includes(e.dir) && Math.random() < 0.7 ? e.dir : opts[ri(0, opts.length - 1)];
            if (tp && Math.random() < 0.3) {
              const toward = opts.filter((op) => Math.abs(e.c + DIRS[op][0] - tp.c) + Math.abs(e.r + DIRS[op][1] - tp.r) < bd);
              if (toward.length) d = toward[ri(0, toward.length - 1)];
            }
            e.dir = d; stepActor(e, e.c + DIRS[d][0], e.r + DIRS[d][1], 0.28);
          }
        }
      }
      if (!multi) for (const p of humans) if (e.c === p.c && e.r === p.r) killP(p);
    }
    for (const p of pl) if (p.alive && flames.some((f) => f.c === p.c && f.r === p.r)) killP(p);
    if (dead) return;
    if (multi) {
      const al = pl.filter((p) => p.alive);
      if (!al.length) finish(enemies.length ? 'Máy thắng!' : 'Hoà!');
      else if (al.length + enemies.length <= 1) finish(`🏆 ${al[0].name} thắng!`);
      else if (al.length === 1 && !enemies.length) finish(`🏆 ${al[0].name} thắng!`);
    } else if (!enemies.length) { stage++; score += 300 * (stage - 1); api.setScore(score); msgT = 1.5; gen(); }
  }
  return {
    update(dt) {
      if (guest) {
        for (const a of [...pl, ...enemies]) if (a.t < 1) a.t = Math.min(1, a.t + dt / (a.dur || 0.13));
        for (const b of bombs) b.t -= dt;
        for (const f of flames) f.t -= dt;
        flames = flames.filter((f) => f.t > 0); msgT = Math.max(0, msgT - dt);
        return;
      }
      if (dead) return;
      hostUpdate(dt);
    },
    keyDown(c) { if (!guest && c === 'Space' && pl[mySlot]) placeBomb(pl[mySlot]); },
    slotKey(slot, c) { if (c === 'Space' && pl[slot]) placeBomb(pl[slot]); },
    slotLeft(slot) { const p = pl[slot]; if (p) { p.alive = false; } },
    getState: () => ({
      grid, stage, score, msgT,
      bombs: bombs.map((b) => ({ c: b.c, r: b.r, t: b.t })), flames: flames.map((f) => ({ c: f.c, r: f.r, t: f.t })), items,
      pl: pl.map((p) => ({ c: p.c, r: p.r, fc: p.fc, fr: p.fr, t: p.t, dur: p.dur, inv: p.inv, max: p.max, range: p.range, alive: p.alive, lives: p.lives, slot: p.slot, name: p.name })),
      enemies: enemies.map((e) => ({ c: e.c, r: e.r, fc: e.fc, fr: e.fr, t: e.t, dur: e.dur })),
    }),
    setState(s) { grid = s.grid; bombs = s.bombs; flames = s.flames; items = s.items; pl = s.pl; enemies = s.enemies; stage = s.stage; score = s.score; msgT = s.msgT; api.setScore(score); },
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
      for (const p of pl) {
        if (!p.alive || (p.inv > 0 && Math.floor(p.inv * 10) % 2)) continue;
        const [x, y] = pos(p);
        ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(x, y - 2, 11, 0, 7); ctx.fill();
        ctx.fillStyle = PCOL[p.slot % 4]; ctx.fillRect(x - 8, y + 6, 16, 8);
        ctx.fillStyle = '#fbd5b0'; ctx.fillRect(x - 7, y - 6, 14, 9);
        ctx.fillStyle = '#111'; ctx.fillRect(x - 4, y - 4, 2, 4); ctx.fillRect(x + 2, y - 4, 2, 4);
        ctx.fillStyle = PCOL[p.slot % 4]; ctx.beginPath(); ctx.arc(x, y - 13, 3, 0, 7); ctx.fill();
        if (pl.length > 1) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.name, x, y - 20); }
      }
      const me = pl[mySlot] || pl[0] || { max: 1, range: 2, lives: 0 };
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(multi ? `Đấu: ${pl.map((p) => p.name + (p.alive ? '' : ' ✖')).join(' · ')}   💣 ${me.max}   🔥 ${me.range}` : `Màn ${stage}   ❤ ${me.lives}   💣 ${me.max}   🔥 ${me.range}   Địch: ${enemies.length}   Điểm: ${score}`, OX, 22);
      if (msgT > 0) { ctx.fillStyle = '#ffd166'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('QUA MÀN!', W / 2, H / 2); }
    },
  };
}

/* ========================= VỎ MÁY GAME ========================= */
const FACTORY = { tetris, ludo, tank: tankGame, racing, bomber };
const MULTI = { ludo: 'Cờ cá ngựa', tank: 'Bắn tank (co-op)', bomber: 'Bomberman (đấu)' };
let root = null, canvas, ctx, current = null, currentId = null, raf = 0, last = 0, overScore = null, overTitle = null, onCloseCb = null;
let net = null, getMyId = () => null, session = null, lobby = null, counts = {}, sendAcc = 0, view = 'menu';
const down = new Set();
const api = { get ctx() { return ctx; }, down, setScore: (s) => { root.querySelector('#arcScore').textContent = 'Điểm: ' + s; }, over: (s, title) => { if (overScore === null) { overScore = s; overTitle = title || null; } } };
const ALIAS = { KeyW: 'ArrowUp', KeyA: 'ArrowLeft', KeyS: 'ArrowDown', KeyD: 'ArrowRight' };
const $a = (s) => root.querySelector(s);

function build() {
  const st = document.createElement('style');
  st.textContent = `
  #arcade{position:fixed;inset:0;z-index:60;background:rgba(5,5,15,.82);display:flex;align-items:center;justify-content:center}
  #arcade.hidden{display:none}
  #arcade .hidden{display:none}
  .arc-card{background:#141428;border:3px solid #7c3aed;border-radius:18px;padding:12px;box-shadow:0 0 40px #7c3aed88;max-width:96vw}
  .arc-head{display:flex;gap:10px;align-items:center;margin-bottom:8px;color:#fff}
  .arc-head b{flex:1;font-size:17px}
  #arcade button{cursor:pointer;border:0;border-radius:8px;padding:8px 12px;background:#3a3a5c;color:#fff;font-size:14px}
  #arcade button:hover{background:#4a4a74}
  #arcMenu{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:min(640px,86vw);padding:10px}
  .arc-g{background:#26264a;border:2px solid #4c3b8f;border-radius:14px;color:#fff;padding:12px 8px;text-align:center}
  .arc-g:hover{border-color:#a78bfa}
  .arc-g .ic{font-size:34px}
  .arc-g small{display:block;font-size:11px;opacity:.7;margin:3px 0 6px}
  .arc-g .row{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
  .arc-g .row button{padding:6px 8px;font-size:12px}
  .arc-g .row button.on{background:#7c3aed}
  #arcLobby{width:min(640px,86vw);padding:20px;color:#fff;text-align:center}
  #arcLobby h3{margin:0 0 12px}
  #arcPlayers{display:flex;flex-direction:column;gap:6px;margin:12px auto;max-width:360px}
  #arcPlayers div{background:#26264a;border-radius:8px;padding:8px}
  #arcCanvas{display:block;width:min(640px,92vw);height:auto;aspect-ratio:4/3;background:#000;border-radius:8px}
  #arcHelp{color:#aab;font-size:12px;margin-top:8px;text-align:center;max-width:640px}
  #arcCanvas.hidden{display:none}
  `;
  document.head.appendChild(st);
  root = document.createElement('div');
  root.id = 'arcade'; root.className = 'hidden';
  root.innerHTML = `<div class="arc-card"><div class="arc-head"><b id="arcTitle">🕹️ MÁY GAME CONSOLE</b><span id="arcScore"></span>
    <button id="arcBack" class="hidden">☰ Menu</button><button id="arcClose">✖ Thoát</button></div>
    <div id="arcMenu"></div>
    <div id="arcLobby" class="hidden"><h3 id="arcLobbyTitle"></h3><div id="arcPlayers"></div><div id="arcLobbyNote" style="font-size:13px;opacity:.75;margin-bottom:12px"></div>
      <button id="arcStart">▶ Bắt đầu</button> <button id="arcLeave">Rời phòng</button></div>
    <canvas id="arcCanvas" width="${W}" height="${H}" class="hidden"></canvas><div id="arcHelp">Chọn một trò chơi · Esc: thoát</div></div>`;
  document.body.appendChild(root);
  canvas = $a('#arcCanvas'); ctx = canvas.getContext('2d');
  $a('#arcClose').onclick = () => Arcade.close();
  $a('#arcBack').onclick = () => backToMenu();
  $a('#arcLeave').onclick = () => backToMenu();
  $a('#arcStart').onclick = () => { if (lobby) net.emit('arc-start', { game: lobby.game }); };
  canvas.addEventListener('pointerdown', (e) => {
    if (!current) return;
    const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
    if (session && session.mode === 'guest') net.emit('arc-input', { game: session.game, data: { t: 'click', x, y } });
    else current.click && current.click(x, y);
  });
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', () => { down.clear(); sendDown(); });
}
function sendDown() { if (session && session.mode === 'guest') net.emit('arc-input', { game: session.game, data: { t: 'down', list: [...down] } }); }
function onKeyUp(e) {
  if (!Arcade.isOpen) return;
  e.stopImmediatePropagation(); down.delete(e.code); down.delete(ALIAS[e.code]); sendDown();
}
function renderMenu() {
  const m = $a('#arcMenu');
  m.innerHTML = GAMES.map((g) => {
    const best = localStorage.getItem('arcade-best-' + g.id) || 0;
    const online = MULTI[g.id] ? `<button data-online="${g.id}">👥 Online${counts[g.id] ? ' (' + counts[g.id] + ')' : ''}</button>` : '';
    return `<div class="arc-g"><div class="ic">${g.icon}</div><b>${g.name}</b><small>Kỷ lục: ${best}</small><div class="row"><button data-id="${g.id}">${MULTI[g.id] ? '🤖 1 người' : '▶ Chơi'}</button>${online}</div></div>`;
  }).join('');
  m.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.online) joinLobby(b.dataset.online); else if (b.dataset.id) startGame(b.dataset.id);
  };
}
function show(v) {
  view = v;
  $a('#arcMenu').classList.toggle('hidden', v !== 'menu');
  $a('#arcLobby').classList.toggle('hidden', v !== 'lobby');
  canvas.classList.toggle('hidden', v !== 'game');
  $a('#arcBack').classList.toggle('hidden', v === 'menu');
}
function leaveNet() { if (net && (session || lobby)) net.emit('arc-leave'); session = null; lobby = null; }
function backToMenu() {
  leaveNet();
  current = null; currentId = null; overScore = null; overTitle = null;
  show('menu'); $a('#arcTitle').textContent = '🕹️ MÁY GAME CONSOLE'; $a('#arcScore').textContent = '';
  $a('#arcHelp').textContent = 'Chọn một trò chơi · Esc: thoát'; renderMenu();
}
function joinLobby(game) {
  if (!net) return;
  lobby = { game, players: [], host: null };
  show('lobby');
  $a('#arcLobbyTitle').textContent = `👥 Phòng chờ — ${MULTI[game]}`;
  $a('#arcPlayers').innerHTML = '<div>Đang vào phòng...</div>';
  $a('#arcStart').classList.add('hidden');
  $a('#arcHelp').textContent = 'Chờ bạn bè vào cùng máy rồi chủ phòng bấm Bắt đầu · Esc: về menu';
  net.emit('arc-join', { game });
}
function renderLobby() {
  if (!lobby || view !== 'lobby') return;
  const meId = getMyId(), max = 4;
  $a('#arcPlayers').innerHTML = lobby.players.map((p) => `<div>${p.id === lobby.host ? '👑 ' : '🙂 '}${p.name}${p.id === meId ? ' (bạn)' : ''}</div>`).join('');
  const isHost = lobby.host === meId, n = lobby.players.length;
  const note = { ludo: 'Ghế trống do máy chơi · tối đa 4 người', tank: 'Co-op: cùng nhau diệt xe địch · tối đa 4 người', bomber: 'Đấu tối đa 4 người, ghế trống do máy chơi · người sống sót cuối cùng thắng' }[lobby.game];
  $a('#arcLobbyNote').textContent = `${n}/${max} người · ${note}` + (isHost ? (n < 2 ? ' — cần ít nhất 2 người' : '') : ' — chờ chủ phòng bắt đầu...');
  $a('#arcStart').classList.toggle('hidden', !isHost);
  $a('#arcStart').disabled = n < 2;
}
function startGame(id, opts) {
  currentId = id; overScore = null; overTitle = null; down.clear();
  const g = GAMES.find((x) => x.id === id);
  show('game');
  $a('#arcTitle').textContent = `${g.icon} ${g.name}` + (opts && opts.mode ? ' (online)' : ''); $a('#arcScore').textContent = 'Điểm: 0';
  $a('#arcHelp').textContent = g.help;
  current = FACTORY[id](api, opts || {});
}
function startSession(game, players, host) {
  const meId = getMyId();
  const mySlot = players.findIndex((p) => p.id === meId);
  if (mySlot < 0) return;
  session = { game, mode: host === meId ? 'host' : 'guest', remote: [], mySlot, sendAcc: 0 };
  lobby = { game, players, host };
  let slots;
  if (game === 'ludo') slots = [0, 1, 2, 3].map((k) => (players[k] ? { name: players[k].name, human: true } : { human: false }));
  else slots = players.map((p) => ({ name: p.name, human: true }));
  startGame(game, { mode: session.mode, slots, mySlot, remote: session.remote, multi: true });
  const help = GAMES.find((x) => x.id === game).help;
  $a('#arcHelp').textContent = help + (session.mode === 'guest' ? ' · (bạn đang chơi online, chủ phòng chạy game)' : ' · (bạn là chủ phòng)');
}
function onKeyDown(e) {
  if (!Arcade.isOpen) return;
  e.stopImmediatePropagation();
  const c = e.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
  if (c === 'Escape') { if (view !== 'menu') backToMenu(); else Arcade.close(); return; }
  if (current && overScore !== null && c === 'Enter') {
    if (session) { if (session.mode === 'host') net.emit('arc-restart', { game: session.game }); }
    else startGame(currentId);
    return;
  }
  const c2 = ALIAS[c] || c;
  down.add(c); down.add(c2);
  if (!current || overScore !== null) return;
  if (session && session.mode === 'guest') {
    sendDown();
    if (!e.repeat) net.emit('arc-input', { game: session.game, data: { t: 'key', c: c2 } });
  } else current.keyDown && current.keyDown(c2, e.repeat);
}
function loop(t) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (!current) return;
  current.update(dt);
  if (session && session.mode === 'host' && current.getState) {
    session.sendAcc += dt;
    if (session.sendAcc >= (session.game === 'ludo' ? 0.1 : 0.05)) {
      session.sendAcc = 0;
      net.emit('arc-state', { game: session.game, data: { s: current.getState(), over: overScore === null ? null : { score: overScore, title: overTitle } } });
    }
  }
  current.draw();
  if (overScore !== null) {
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, 150, W, 170);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 40px sans-serif';
    ctx.fillText(overTitle || 'GAME OVER', W / 2, 215);
    const key = 'arcade-best-' + currentId, best = +localStorage.getItem(key) || 0;
    if (!session && currentId !== 'ludo' && overScore > best) localStorage.setItem(key, overScore);
    ctx.font = '22px sans-serif'; ctx.fillStyle = '#ffd166';
    if (currentId !== 'ludo' && !(session && currentId === 'bomber')) ctx.fillText(`Điểm: ${overScore}` + (session ? '' : `   ·   Kỷ lục: ${Math.max(best, overScore)}`), W / 2, 255);
    ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
    ctx.fillText(session && session.mode === 'guest' ? 'Chờ chủ phòng bắt đầu ván mới · Esc: về menu' : 'Enter: chơi lại · Esc: về menu', W / 2, 295);
  }
}
function setupNet(socket, myIdFn) {
  net = { emit: (...a) => socket.emit(...a) }; getMyId = myIdFn;
  socket.on('arc-counts', (c) => { counts = c; if (Arcade.isOpen && view === 'menu') renderMenu(); });
  socket.on('arc-lobby', (l) => { if (lobby && lobby.game === l.game && view === 'lobby') { lobby = l; renderLobby(); } });
  socket.on('arc-started', ({ game, players, host }) => { if (Arcade.isOpen && lobby && lobby.game === game) startSession(game, players, host); });
  socket.on('arc-input', ({ slot, data }) => {
    if (!session || session.mode !== 'host' || !current) return;
    if (data.t === 'down') session.remote[slot] = new Set(data.list);
    else if (data.t === 'key') current.slotKey && current.slotKey(slot, data.c);
    else if (data.t === 'click') current.slotClick && current.slotClick(slot, data.x, data.y);
  });
  socket.on('arc-state', ({ game, data }) => {
    if (!session || session.mode !== 'guest' || session.game !== game || !current) return;
    current.setState(data.s);
    if (data.over && overScore === null) api.over(data.over.score, data.over.title);
    if (!data.over && overScore !== null) { overScore = null; overTitle = null; }
  });
  socket.on('arc-left', ({ slot }) => { if (session && session.mode === 'host' && current && current.slotLeft) current.slotLeft(slot); });
  socket.on('arc-ended', ({ game, reason }) => {
    if (Arcade.isOpen && (session || lobby) && (session ? session.game : lobby.game) === game) {
      session = null; lobby = null; backToMenu();
      $a('#arcHelp').textContent = `⚠ ${reason}`;
    }
  });
  socket.on('arc-full', () => { if (view === 'lobby') { backToMenu(); $a('#arcHelp').textContent = '⚠ Phòng đã đủ người'; } });
  socket.on('arc-busy', () => { if (view === 'lobby') { backToMenu(); $a('#arcHelp').textContent = '⚠ Ván đang diễn ra, thử lại sau'; } });
}
export const Arcade = {
  isOpen: false,
  setNet(socket, myIdFn) { setupNet(socket, myIdFn); },
  setCounts(c) { counts = c || {}; },
  open(onClose) {
    if (!root) build();
    onCloseCb = onClose; Arcade.isOpen = true; down.clear();
    root.classList.remove('hidden'); backToMenu();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  },
  close() {
    if (!Arcade.isOpen) return;
    leaveNet();
    Arcade.isOpen = false; root.classList.add('hidden'); cancelAnimationFrame(raf); current = null; down.clear();
    if (onCloseCb) onCloseCb();
  },
};
