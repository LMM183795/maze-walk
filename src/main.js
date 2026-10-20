import "./style.css";
import { generateMaze, selectDecoyCells } from "./maze.js";

const canvas = document.querySelector("#maze");
const ctx = canvas.getContext("2d");
const mazeLayer = document.createElement("canvas");
const mazeCtx = mazeLayer.getContext("2d");
const fogLayer = document.createElement("canvas");
const fogCtx = fogLayer.getContext("2d");
const overlay = document.querySelector("#overlay");
const overlayEyebrow = overlay.querySelector(".eyebrow");
const overlayTitle = overlay.querySelector("h1");
const overlayLede = overlay.querySelector(".lede");
const startBtn = document.querySelector("#start-btn");
const reselectBtn = document.querySelector("#reselect-btn");
const restartBtn = document.querySelector("#restart-btn");
const difficultyGroup = document.querySelector(".difficulty");
const difficultyButtons = [...document.querySelectorAll("[data-difficulty]")];
const difficultyHint = document.querySelector("#difficulty-hint");
const difficultyLabel = document.querySelector("#difficulty-label");
const levelEl = document.querySelector("#level");
const stepsEl = document.querySelector("#steps");
const timerEl = document.querySelector("#timer");
const toastEl = document.querySelector("#toast");

const DIFFICULTIES = {
  easy: {
    label: "轻松",
    baseCols: 7,
    baseRows: 5,
    loopChance: 0,
    hint: "迷宫更小，适合熟悉操作",
  },
  normal: {
    label: "标准",
    baseCols: 9,
    baseRows: 7,
    loopChance: 0,
    hint: "经典尺寸，稳步变大",
  },
  hard: {
    label: "挑战",
    baseCols: 13,
    baseRows: 9,
    loopChance: 0.04,
    hint: "起步更大，路线更长",
  },
  demon: {
    label: "魔王",
    baseCols: 21,
    baseRows: 15,
    loopChance: 0,
    hint: "迷雾与假出口，极限挑战",
  },
};

const DIFFICULTY_KEY = "maze-walk:difficulty";
const POINTER_FIRST_DELAY = 50;
const KEY_FIRST_DELAY = 80;
const MOVE_REPEAT = 40;
const BLOCKED_RETRY = 70;
const VISION_RADIUS = 4.2;
const FAKE_EXIT_PENALTY = 5;
const START_LEDE =
  "轻点走一步，按住鼠标朝指针方向连续移动；方向键 / WASD 按住也能连续移动。手机可滑动或使用屏幕按钮。";

const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const KEYS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  W: "up",
  A: "left",
  S: "down",
  D: "right",
};

let level = 1;
let steps = 0;
let startedAt = 0;
let maze = null;
let tileColors = [];
let player = [1, 1];
let running = false;
let won = false;
let difficulty = loadDifficulty();
let decoys = [];
let explored = [];
let visible = [];
let penaltySeconds = 0;
let toastTimer = 0;

const view = { cell: 24, ox: 0, oy: 0 };
const pointer = {
  active: false,
  id: null,
  x: 0,
  y: 0,
  nextAt: 0,
  inside: false,
};
const keyboard = {
  dir: null,
  nextAt: 0,
};

function loadDifficulty() {
  try {
    const stored = localStorage.getItem(DIFFICULTY_KEY);
    if (stored && Object.prototype.hasOwnProperty.call(DIFFICULTIES, stored)) {
      return stored;
    }
  } catch {
    // 隐私模式或存储被禁用时使用默认难度。
  }
  return "normal";
}

function saveDifficulty() {
  try {
    localStorage.setItem(DIFFICULTY_KEY, difficulty);
  } catch {
    // 保存失败不影响当前游戏。
  }
}

function sizeForLevel(n) {
  const config = DIFFICULTIES[difficulty];
  return {
    cols: config.baseCols + n * 2,
    rows: config.baseRows + n * 2,
  };
}

function buildTileColors() {
  return maze.grid.map((row) =>
    row.map(() => {
      const hue = Math.floor(Math.random() * 360);
      return `hsl(${hue}, 70%, 27%)`;
    }),
  );
}

function applyDifficultyUI() {
  const config = DIFFICULTIES[difficulty];
  difficultyLabel.textContent = config.label;
  for (const button of difficultyButtons) {
    const active = button.dataset.difficulty === difficulty;
    button.setAttribute("aria-pressed", String(active));
  }
  const { cols, rows } = sizeForLevel(1);
  difficultyHint.textContent = `第 1 关 ${cols} × ${rows}，${config.hint}`;
}

function setDifficulty(next) {
  if (next === difficulty || !Object.prototype.hasOwnProperty.call(DIFFICULTIES, next)) {
    return;
  }
  difficulty = next;
  saveDifficulty();
  applyDifficultyUI();
}

function resize() {
  if (!maze) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  view.cell = Math.max(
    1,
    Math.floor(Math.min(canvas.width / maze.width, canvas.height / maze.height)),
  );
  view.ox = Math.floor((canvas.width - maze.width * view.cell) / 2);
  view.oy = Math.floor((canvas.height - maze.height * view.cell) / 2);
  paintMazeLayer();
  paintFogLayer();
}

function paintMazeLayer() {
  if (!maze) return;
  mazeLayer.width = canvas.width;
  mazeLayer.height = canvas.height;
  const { cell, ox, oy } = view;

  mazeCtx.fillStyle = "#050814";
  mazeCtx.fillRect(0, 0, mazeLayer.width, mazeLayer.height);
  mazeCtx.lineCap = "round";
  mazeCtx.strokeStyle = "rgba(190, 204, 232, 0.55)";
  mazeCtx.lineWidth = Math.max(1, cell * 0.055);

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const px = ox + x * cell;
      const py = oy + y * cell;
      mazeCtx.fillStyle = tileColors[y]?.[x] || "#182444";
      mazeCtx.fillRect(px, py, cell + 0.5, cell + 0.5);
      if (maze.grid[y][x] === 1) {
        const pad = Math.max(2, cell * 0.24);
        mazeCtx.beginPath();
        mazeCtx.moveTo(px + pad, py + pad);
        mazeCtx.lineTo(px + cell - pad, py + cell - pad);
        mazeCtx.moveTo(px + cell - pad, py + pad);
        mazeCtx.lineTo(px + pad, py + cell - pad);
        mazeCtx.stroke();
      }
    }
  }
}

function isDemon() {
  return difficulty === "demon";
}

function paintFogLayer() {
  const width = canvas.width;
  const height = canvas.height;
  if (fogLayer.width !== width || fogLayer.height !== height) {
    fogLayer.width = width;
    fogLayer.height = height;
  }
  fogCtx.globalCompositeOperation = "source-over";
  fogCtx.clearRect(0, 0, width, height);
  if (!maze || !isDemon() || !explored.length) return;

  const { cell, ox, oy } = view;
  fogCtx.fillStyle = "rgba(3, 6, 16, 0.96)";
  fogCtx.fillRect(0, 0, width, height);
  fogCtx.globalCompositeOperation = "destination-out";

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const alpha = visible[y]?.[x] ? 1 : explored[y]?.[x] ? 0.52 : 0;
      if (alpha === 0) continue;
      fogCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      fogCtx.fillRect(ox + x * cell, oy + y * cell, cell + 0.5, cell + 0.5);
    }
  }
  fogCtx.globalCompositeOperation = "source-over";
}

function resetVision() {
  explored = Array.from({ length: maze.height }, () => Array(maze.width).fill(false));
  visible = Array.from({ length: maze.height }, () => Array(maze.width).fill(false));
}

function revealAroundPlayer() {
  if (!maze) return;
  if (!isDemon()) {
    paintFogLayer();
    return;
  }

  for (const row of visible) row.fill(false);
  const [px, py] = player;
  const radiusSq = VISION_RADIUS * VISION_RADIUS;
  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const dx = x - px;
      const dy = y - py;
      if (dx * dx + dy * dy > radiusSq) continue;
      visible[y][x] = true;
      explored[y][x] = true;
    }
  }
  paintFogLayer();
}

function buildDecoys() {
  if (!isDemon()) return [];
  const count = 3 + Math.min(2, Math.floor((level - 1) / 2));
  return selectDecoyCells(maze, count).map(([x, y]) => ({
    x,
    y,
    triggered: false,
    phase: Math.random() * Math.PI * 2,
  }));
}

function resetLevel() {
  stopInputs();
  const { cols, rows } = sizeForLevel(level);
  maze = generateMaze(cols, rows, DIFFICULTIES[difficulty].loopChance);
  tileColors = buildTileColors();
  decoys = buildDecoys();
  player = [...maze.start];
  steps = 0;
  won = false;
  penaltySeconds = 0;
  startedAt = performance.now();
  stepsEl.textContent = "0";
  timerEl.textContent = "0.0";
  levelEl.textContent = String(level);
  if (toastEl) toastEl.classList.remove("show");
  clearTimeout(toastTimer);
  resetVision();
  resize();
  revealAroundPlayer();
}

function tryMove(dir) {
  if (!running || won || !maze) return false;
  const [dx, dy] = DIRS[dir];
  const [x, y] = player;
  const nx = x + dx;
  const ny = y + dy;
  if (maze.grid[ny]?.[nx] !== 0) return false;

  player = [nx, ny];
  steps += 1;
  stepsEl.textContent = String(steps);
  revealAroundPlayer();

  const decoy = decoys.find((item) => !item.triggered && item.x === nx && item.y === ny);
  if (decoy) {
    decoy.triggered = true;
    penaltySeconds += FAKE_EXIT_PENALTY;
    showToast(`假出口！+${FAKE_EXIT_PENALTY} 秒`);
  }

  if (nx === maze.goal[0] && ny === maze.goal[1]) {
    const seconds = ((performance.now() - startedAt) / 1000 + penaltySeconds).toFixed(1);
    completeLevel(seconds);
  }
  return true;
}

function completeLevel(seconds) {
  const completedLevel = level;
  running = false;
  won = true;
  stopInputs();
  level += 1;
  showWinScreen(completedLevel, seconds);
}

function showWinScreen(completedLevel, seconds) {
  const config = DIFFICULTIES[difficulty];
  const penaltyNote =
    penaltySeconds > 0 ? `（含假出口罚时 ${penaltySeconds} 秒）` : "";
  overlayEyebrow.textContent = `${config.label} · 第 ${completedLevel} 关完成`;
  overlayTitle.textContent = "找到出口了";
  overlayLede.textContent = `用了 ${steps} 步，耗时 ${seconds} 秒${penaltyNote}。下一关迷宫会更大。`;
  startBtn.textContent = "下一关";
  difficultyGroup.hidden = true;
  reselectBtn.hidden = false;
  overlay.classList.remove("hidden");
}

function showStartScreen() {
  overlayEyebrow.textContent = "MAZE WALK";
  overlayTitle.textContent = "走迷宫";
  overlayLede.textContent = START_LEDE;
  startBtn.textContent = "开始探索";
  difficultyGroup.hidden = false;
  reselectBtn.hidden = true;
  restartBtn.hidden = true;
  overlay.classList.remove("hidden");
}

function prepareNewRun() {
  running = false;
  won = false;
  level = 1;
  resetLevel();
  applyDifficultyUI();
  showStartScreen();
}

function startGame() {
  stopInputs();
  running = false;
  resetLevel();
  running = true;
  restartBtn.hidden = false;
  overlay.classList.add("hidden");
  startBtn.blur();
}

function eventCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
  return { x, y };
}

function cellAtPoint(x, y) {
  if (!maze || view.cell < 1) return null;
  const cx = Math.floor((x - view.ox) / view.cell);
  const cy = Math.floor((y - view.oy) / view.cell);
  if (cx < 0 || cy < 0 || cx >= maze.width || cy >= maze.height) return null;
  return [cx, cy];
}

function directionFromPointer(x, y) {
  const target = cellAtPoint(x, y);
  if (!target) return null;
  const dx = target[0] - player[0];
  const dy = target[1] - player[1];
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function endPointer() {
  const pointerId = pointer.id;
  pointer.active = false;
  pointer.id = null;
  pointer.inside = false;
  pointer.nextAt = 0;
  canvas.classList.remove("dragging");
  if (pointerId !== null && canvas.hasPointerCapture?.(pointerId)) {
    try {
      canvas.releasePointerCapture(pointerId);
    } catch {
      // 指针可能已经释放，忽略即可。
    }
  }
}

function stopKeyboard() {
  keyboard.dir = null;
  keyboard.nextAt = 0;
}

function stopInputs() {
  endPointer();
  stopKeyboard();
}

function onPointerDown(event) {
  if (event.pointerType === "touch" || event.button !== 0 || !running) return;
  const point = eventCanvasPoint(event);
  if (!point) return;

  event.preventDefault();
  stopKeyboard();
  pointer.active = true;
  pointer.id = event.pointerId;
  pointer.x = point.x;
  pointer.y = point.y;
  pointer.inside = true;
  pointer.nextAt = performance.now() + POINTER_FIRST_DELAY;
  canvas.classList.add("dragging");
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Pointer Capture 不可用时仍可通过普通事件操作。
  }

  const dir = directionFromPointer(point.x, point.y);
  if (dir) tryMove(dir);
}

function onPointerMove(event) {
  if (!pointer.active || event.pointerId !== pointer.id) return;
  const point = eventCanvasPoint(event);
  if (!point) {
    pointer.inside = false;
    return;
  }
  pointer.inside = true;
  pointer.x = point.x;
  pointer.y = point.y;
}

function onPointerUp(event) {
  if (event.pointerId === pointer.id) endPointer();
}

function updatePointerMovement(now) {
  if (!running || !pointer.active || !pointer.inside) return;
  if (now < pointer.nextAt) return;

  const dir = directionFromPointer(pointer.x, pointer.y);
  if (!dir) {
    pointer.nextAt = now + BLOCKED_RETRY;
    return;
  }

  if (tryMove(dir)) {
    if (pointer.active) pointer.nextAt = now + MOVE_REPEAT;
  } else {
    pointer.nextAt = now + BLOCKED_RETRY;
  }
}

function updateKeyboardMovement(now) {
  if (!running || !keyboard.dir) return;
  if (now < keyboard.nextAt) return;

  if (tryMove(keyboard.dir)) {
    if (keyboard.dir) keyboard.nextAt = now + MOVE_REPEAT;
  } else {
    keyboard.nextAt = now + BLOCKED_RETRY;
  }
}

function drawGoldOrb(x, y, now, phase = 0) {
  const { cell, ox, oy } = view;
  const glow = 0.55 + Math.sin(now / 280 + phase) * 0.25;
  ctx.fillStyle = `rgba(246, 196, 92, ${glow})`;
  ctx.beginPath();
  ctx.arc(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, cell * 0.32, 0, Math.PI * 2);
  ctx.fill();
}

function drawTriggeredDecoy(decoy) {
  const { cell, ox, oy } = view;
  const cx = ox + (decoy.x + 0.5) * cell;
  const cy = oy + (decoy.y + 0.5) * cell;
  const pad = cell * 0.27;
  ctx.strokeStyle = "rgba(255, 92, 92, 0.85)";
  ctx.lineWidth = Math.max(2, cell * 0.07);
  ctx.beginPath();
  ctx.moveTo(cx - pad, cy - pad);
  ctx.lineTo(cx + pad, cy + pad);
  ctx.moveTo(cx + pad, cy - pad);
  ctx.lineTo(cx - pad, cy + pad);
  ctx.stroke();
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2000);
}

function draw(now) {
  requestAnimationFrame(draw);
  if (!maze) return;
  updatePointerMovement(now);
  updateKeyboardMovement(now);

  const { cell, ox, oy } = view;
  if (running) {
    const text = ((now - startedAt) / 1000 + penaltySeconds).toFixed(1);
    if (timerEl.textContent !== text) timerEl.textContent = text;
  }

  ctx.drawImage(mazeLayer, 0, 0);

  const [gx, gy] = maze.goal;
  drawGoldOrb(gx, gy, now);
  for (const decoy of decoys) {
    if (decoy.triggered) drawTriggeredDecoy(decoy);
    else drawGoldOrb(decoy.x, decoy.y, now, decoy.phase);
  }

  if (running && isDemon()) ctx.drawImage(fogLayer, 0, 0);

  const [px, py] = player;
  const cx = ox + (px + 0.5) * cell;
  const cy = oy + (py + 0.5) * cell;
  ctx.fillStyle = "rgba(110, 231, 255, 0.18)";
  ctx.beginPath();
  ctx.arc(cx, cy, cell * 0.44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6ee7ff";
  ctx.beginPath();
  ctx.arc(cx, cy, cell * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

for (const button of difficultyButtons) {
  button.addEventListener("click", () => setDifficulty(button.dataset.difficulty));
}

startBtn.addEventListener("click", startGame);

reselectBtn.addEventListener("click", () => {
  prepareNewRun();
});

restartBtn.addEventListener("click", () => {
  if (running && !window.confirm("重新开始？当前进度会丢失。")) return;
  prepareNewRun();
});

window.addEventListener("keydown", (event) => {
  const dir = KEYS[event.key];
  if (!dir) return;
  event.preventDefault();
  if (!running || event.repeat) return;
  if (pointer.active) endPointer();
  keyboard.dir = dir;
  keyboard.nextAt = performance.now() + KEY_FIRST_DELAY;
  tryMove(dir);
});

window.addEventListener("keyup", (event) => {
  const dir = KEYS[event.key];
  if (dir && keyboard.dir === dir) stopKeyboard();
});

document.querySelectorAll("[data-dir]").forEach((btn) => {
  btn.addEventListener("click", () => {
    stopKeyboard();
    tryMove(btn.dataset.dir);
  });
});

let touchStart = null;
canvas.addEventListener(
  "touchstart",
  (event) => {
    stopKeyboard();
    const t = event.changedTouches[0];
    touchStart = [t.clientX, t.clientY];
  },
  { passive: true },
);
canvas.addEventListener(
  "touchend",
  (event) => {
    if (!touchStart) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStart[0];
    const dy = t.clientY - touchStart[1];
    touchStart = null;
    if (Math.hypot(dx, dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? "right" : "left");
    else tryMove(dy > 0 ? "down" : "up");
  },
  { passive: true },
);

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);
canvas.addEventListener("lostpointercapture", endPointer);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);
window.addEventListener("blur", stopInputs);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopInputs();
});
window.addEventListener("resize", () => {
  stopInputs();
  resize();
});

if (import.meta.env.DEV) {
  window.__mazeTest = {
    state: () =>
      maze
        ? {
            width: maze.width,
            height: maze.height,
            grid: maze.grid,
            start: [...maze.start],
            goal: [...maze.goal],
            player: [...player],
            decoys: decoys.map((item) => ({ ...item })),
            penaltySeconds,
            visible: visible.map((row) => [...row]),
            explored: explored.map((row) => [...row]),
          }
        : null,
    teleport: (x, y) => {
      if (maze?.grid[y]?.[x] !== 0) return false;
      player = [x, y];
      revealAroundPlayer();
      return true;
    },
  };
}

applyDifficultyUI();
prepareNewRun();
requestAnimationFrame(draw);
