// ─── CONFIG ───────────────────────────────────────────────
const COLS = 25, ROWS = 25;
const CELL = 20;
const W = COLS * CELL, H = ROWS * CELL;

// Colors
const C = {
  bg:        '#0a0a0f',
  grid:      'rgba(255,255,255,0.025)',
  headFill:  '#00ff88',
  headGlow:  '#00ff88',
  bodyFill:  '#00cc66',
  bodyDim:   '#008844',
  food:      '#ff0080',
  foodGlow:  '#ff0080',
  bonus:     '#ffee00',
  bonusGlow: '#ffee00',
};

const SPEEDS = [180, 150, 120, 90, 65]; // ms per tick
const SCORE_PER_FOOD  = 10;
const SCORE_PER_BONUS = 50;
const LEVEL_EVERY     = 5; // foods to level up

// ─── SETUP ────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = W;
canvas.height = H;

// Particle BG canvas
const pCanvas = document.getElementById('particles');
const pCtx    = pCanvas.getContext('2d');
pCanvas.width  = window.innerWidth;
pCanvas.height = window.innerHeight;

// ─── STATE ────────────────────────────────────────────────
let snake, dir, nextDir, food, bonusFood, bonusTimer;
let score, highScore, level, foodEaten, gameState, lastTime, accumulator, paused;

// ─── INIT ─────────────────────────────────────────────────
function initGame() {
  snake = [
    { x: 12, y: 12 },
    { x: 11, y: 12 },
    { x: 10, y: 12 },
  ];
  dir      = { x: 1, y: 0 };
  nextDir  = { x: 1, y: 0 };
  food     = randomFood();
  bonusFood = null;
  bonusTimer = 0;
  score    = 0;
  level    = 1;
  foodEaten = 0;
  paused   = false;
  accumulator = 0;
  lastTime = null;
  updateUI();
}

function randomFood(exclude) {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (
    snake.some(s => s.x === pos.x && s.y === pos.y) ||
    (exclude && pos.x === exclude.x && pos.y === exclude.y)
  );
  return pos;
}

// ─── UPDATE ───────────────────────────────────────────────
function update(dt) {
  if (paused) return;

  const speed = SPEEDS[Math.min(level - 1, SPEEDS.length - 1)];
  accumulator += dt;
  if (accumulator < speed) return;
  accumulator = 0;

  dir = { ...nextDir };
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Wall collision
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    return endGame();
  }

  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    return endGame();
  }

  snake.unshift(head);

  // Food collision
  if (head.x === food.x && head.y === food.y) {
    score += SCORE_PER_FOOD * level;
    foodEaten++;
    triggerBump('score');
    food = randomFood(bonusFood);
    spawnParticles(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, C.food, 12);

    if (foodEaten % LEVEL_EVERY === 0 && level < 5) {
      level++;
      triggerBump('level');
    }

    // Spawn bonus occasionally
    if (!bonusFood && Math.random() < 0.3) {
      bonusFood  = randomFood(food);
      bonusTimer = 8000; // 8s
    }
  } else {
    snake.pop();
  }

  // Bonus collision
  if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
    score += SCORE_PER_BONUS;
    triggerBump('score');
    spawnParticles(bonusFood.x * CELL + CELL / 2, bonusFood.y * CELL + CELL / 2, C.bonus, 20);
    bonusFood  = null;
    bonusTimer = 0;
  }

  // Bonus timer decay
  if (bonusFood) {
    bonusTimer -= speed;
    if (bonusTimer <= 0) bonusFood = null;
  }

  if (score > highScore) {
    highScore = score;
    triggerBump('highScore');
  }

  updateUI();
}

// ─── DRAW ─────────────────────────────────────────────────
function draw() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, H);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(W, y * CELL);
    ctx.stroke();
  }

  // Bonus food (blinking)
  if (bonusFood) {
    const pulse = Math.sin(Date.now() / 150) * 0.5 + 0.5;
    drawFood(bonusFood.x, bonusFood.y, C.bonus, C.bonusGlow, pulse, '★');
  }

  // Food
  drawFood(food.x, food.y, C.food, C.foodGlow, Math.sin(Date.now() / 300) * 0.3 + 0.7, '●');

  // Snake
  snake.forEach((seg, i) => {
    const t = i / snake.length;
    const isHead = i === 0;
    drawSegment(seg.x, seg.y, isHead, t);
  });

  // Paused overlay text
  if (paused) {
    ctx.fillStyle = 'rgba(10,10,15,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#00e5ff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00e5ff';
    ctx.font = '900 14px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.shadowBlur = 0;
  }
}

function drawSegment(gx, gy, isHead, t) {
  const x = gx * CELL, y = gy * CELL;
  const pad = isHead ? 1 : 2;
  const r = isHead ? 6 : 4;
  const color = isHead ? C.headFill : lerpColor(C.bodyFill, C.bodyDim, t);
  const glow  = isHead ? C.headGlow : null;

  if (glow) {
    ctx.shadowBlur  = 18;
    ctx.shadowColor = glow;
  }

  ctx.fillStyle = color;
  roundRect(ctx, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, r);
  ctx.fill();

  // Inner highlight
  if (isHead) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    roundRect(ctx, x + pad + 3, y + pad + 2, CELL - pad * 2 - 10, 4, 2);
    ctx.fill();

    // Eyes
    const eyeOffX = dir.x !== 0 ? dir.x * 5 : 0;
    const eyeOffY = dir.y !== 0 ? dir.y * 5 : 0;
    const cx2 = x + CELL / 2 + eyeOffX;
    const cy2 = y + CELL / 2 + eyeOffY;
    const perp = dir.y !== 0 ? 1 : 0;
    const perpX = perp ? 4 : 0;
    const perpY = perp ? 0 : 4;
    ctx.fillStyle = '#0a0a0f';
    [[cx2 - perpX - eyeOffX * 0.3, cy2 - perpY - eyeOffY * 0.3],
     [cx2 + perpX - eyeOffX * 0.3, cy2 + perpY - eyeOffY * 0.3]].forEach(([ex, ey]) => {
      ctx.beginPath();
      ctx.arc(ex, ey, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.shadowBlur = 0;
}

function drawFood(gx, gy, color, glowColor, pulse, symbol) {
  const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
  const r = 7 * pulse;
  ctx.save();
  ctx.shadowBlur  = 25 * pulse;
  ctx.shadowColor = glowColor;
  ctx.fillStyle   = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.restore();
}

// ─── PARTICLES ────────────────────────────────────────────
let particles = [];

function spawnParticles(wx, wy, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 3;
    particles.push({
      x: wx + canvas.getBoundingClientRect().left,
      y: wy + canvas.getBoundingClientRect().top,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function updateParticles(dt) {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life -= dt / 800;
  });

  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  particles.forEach(p => {
    pCtx.globalAlpha = Math.max(0, p.life);
    pCtx.fillStyle   = p.color;
    pCtx.shadowBlur  = 8;
    pCtx.shadowColor = p.color;
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    pCtx.fill();
  });
  pCtx.globalAlpha = 1;
  pCtx.shadowBlur  = 0;
}

// ─── HELPERS ──────────────────────────────────────────────
function lerpColor(a, b, t) {
  const ah = parseInt(a.replace('#',''), 16);
  const bh = parseInt(b.replace('#',''), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr},${rg},${rb})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function updateUI() {
  document.getElementById('score').textContent     = score;
  document.getElementById('highScore').textContent = highScore;
  document.getElementById('level').textContent     = level;
  const pips = document.querySelectorAll('.pip');
  pips.forEach((p, i) => p.classList.toggle('active', i < level));
}

function triggerBump(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 200);
}

// ─── GAME LOOP ────────────────────────────────────────────
function loop(ts) {
  if (gameState !== 'playing') return;
  const dt = lastTime ? ts - lastTime : 16;
  lastTime = ts;
  update(dt);
  updateParticles(dt);
  draw();
  requestAnimationFrame(loop);
}

// ─── GAME FLOW ────────────────────────────────────────────
function startGame() {
  initGame();
  gameState = 'playing';
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameOverScreen').classList.add('hidden');
  lastTime = null;
  requestAnimationFrame(loop);
}

function endGame() {
  gameState = 'over';
  document.getElementById('finalScore').textContent = score;
  document.getElementById('gameOverScreen').classList.remove('hidden');
}

// ─── INPUT ────────────────────────────────────────────────
const keyMap = {
  ArrowUp:    { x: 0,  y: -1 },
  ArrowDown:  { x: 0,  y:  1 },
  ArrowLeft:  { x: -1, y:  0 },
  ArrowRight: { x: 1,  y:  0 },
  w: { x: 0,  y: -1 },
  s: { x: 0,  y:  1 },
  a: { x: -1, y:  0 },
  d: { x: 1,  y:  0 },
};

window.addEventListener('keydown', e => {
  if (keyMap[e.key]) {
    e.preventDefault();
    const nd = keyMap[e.key];
    // Prevent 180° reversal
    if (nd.x !== -dir.x || nd.y !== -dir.y) {
      nextDir = nd;
    }
  }
  if (e.key === 'p' || e.key === 'P') {
    if (gameState === 'playing') paused = !paused;
  }
  if (e.key === 'r' || e.key === 'R') {
    if (gameState !== 'idle') startGame();
  }
});

// Mobile swipe
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
canvas.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy)) {
    const nd = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    if (nd.x !== -dir.x) nextDir = nd;
  } else {
    const nd = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    if (nd.y !== -dir.y) nextDir = nd;
  }
}, { passive: true });

// ─── BUTTONS ──────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

// ─── BOOT ─────────────────────────────────────────────────
gameState  = 'idle';
highScore  = 0;
score      = 0;
level      = 1;
dir        = { x: 1, y: 0 };
nextDir    = { x: 1, y: 0 };
snake      = [{ x: 12, y: 12 }, { x: 11, y: 12 }, { x: 10, y: 12 }];
food       = { x: 18, y: 12 };
bonusFood  = null;
bonusTimer = 0;
accumulator = 0;
draw(); // draw initial frame behind overlay