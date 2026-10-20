import "./style.css";
import { generateMaze } from "./maze.js";

const canvas = document.querySelector("#maze");
const ctx = canvas.getContext("2d");
const overlay = document.querySelector("#overlay");
const startBtn = document.querySelector("#start-btn");
const levelEl = document.querySelector("#level");
const stepsEl = document.querySelector("#steps");
const timerEl = document.querySelector("#timer");

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
let player = [1, 1];
let cell = 24;
let running = false;
let won = false;
let raf = 0;

function sizeForLevel(n) {
  return { cols: 9 + n * 2, rows: 7 + n * 2 };
}

function resetLevel() {
  const { cols, rows } = sizeForLevel(level);
  maze = generateMaze(cols, rows);
  player = [...maze.start];
  steps = 0;
  won = false;
  startedAt = performance.now();
  stepsEl.textContent = "0";
  levelEl.textContent = String(level);
  resize();
}

function resize() {
  if (!maze) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  cell = Math.floor(Math.min(canvas.width / maze.width, canvas.height / maze.height));
}

function tryMove(dir) {
  if (!running || won || !maze) return;
  const [dx, dy] = DIRS[dir];
  const [x, y] = player;
  const nx = x + dx;
  const ny = y + dy;
  if (maze.grid[ny]?.[nx] !== 0) return;
  player = [nx, ny];
  steps += 1;
  stepsEl.textContent = String(steps);
  if (nx === maze.goal[0] && ny === maze.goal[1]) {
    won = true;
    running = false;
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    overlay.querySelector(".eyebrow").textContent = `第 ${level} 关完成`;
    overlay.querySelector("h1").textContent = "找到出口了";
    overlay.querySelector(".lede").textContent = `用了 ${steps} 步，耗时 ${seconds} 秒。下一关迷宫会更大。`;
    startBtn.textContent = "下一关";
    overlay.classList.remove("hidden");
    level += 1;
  }
}

function draw(now) {
  raf = requestAnimationFrame(draw);
  if (!maze) return;

  const elapsed = running ? (now - startedAt) / 1000 : Number(timerEl.textContent) || 0;
  if (running) timerEl.textContent = elapsed.toFixed(1);

  const ox = Math.floor((canvas.width - maze.width * cell) / 2);
  const oy = Math.floor((canvas.height - maze.height * cell) / 2);

  ctx.fillStyle = "#050814";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const px = ox + x * cell;
      const py = oy + y * cell;
      if (maze.grid[y][x] === 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#121a33" : "#0e162c";
        ctx.fillRect(px, py, cell + 0.5, cell + 0.5);
      } else {
        ctx.fillStyle = "#182444";
        ctx.fillRect(px, py, cell + 0.5, cell + 0.5);
      }
    }
  }

  const [gx, gy] = maze.goal;
  const glow = 0.55 + Math.sin(now / 280) * 0.25;
  ctx.fillStyle = `rgba(246, 196, 92, ${glow})`;
  ctx.beginPath();
  ctx.arc(ox + (gx + 0.5) * cell, oy + (gy + 0.5) * cell, cell * 0.32, 0, Math.PI * 2);
  ctx.fill();

  const [px, py] = player;
  ctx.fillStyle = "#6ee7ff";
  ctx.shadowColor = "#6ee7ff";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(ox + (px + 0.5) * cell, oy + (py + 0.5) * cell, cell * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function startGame() {
  overlay.classList.add("hidden");
  resetLevel();
  running = true;
}

startBtn.addEventListener("click", startGame);

window.addEventListener("keydown", (event) => {
  const dir = KEYS[event.key];
  if (!dir) return;
  event.preventDefault();
  tryMove(dir);
});

document.querySelectorAll("[data-dir]").forEach((btn) => {
  btn.addEventListener("click", () => tryMove(btn.dataset.dir));
});

let touchStart = null;
canvas.addEventListener(
  "touchstart",
  (event) => {
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

window.addEventListener("resize", resize);
resetLevel();
raf = requestAnimationFrame(draw);
