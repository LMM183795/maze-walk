function neighbors(x, y) {
  return [
    [x, y - 2],
    [x + 2, y],
    [x, y + 2],
    [x - 2, y],
  ];
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

export function generateMaze(cols, rows, loopChance = 0) {
  const width = cols % 2 === 0 ? cols + 1 : cols;
  const height = rows % 2 === 0 ? rows + 1 : rows;
  const grid = Array.from({ length: height }, () => Array(width).fill(1));

  const stack = [[1, 1]];
  grid[1][1] = 0;

  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options = neighbors(cx, cy).filter(
      ([nx, ny]) => ny > 0 && ny < height - 1 && nx > 0 && nx < width - 1 && grid[ny][nx] === 1,
    );

    if (!options.length) {
      stack.pop();
      continue;
    }

    const [nx, ny] = options[Math.floor(Math.random() * options.length)];
    grid[(cy + ny) >> 1][(cx + nx) >> 1] = 0;
    grid[ny][nx] = 0;
    stack.push([nx, ny]);
  }

  // 打通部分内部墙体，形成环路，让路线相互重叠、岔路更多。
  const chance = Math.max(0, Math.min(loopChance, 1));
  if (chance > 0) {
    const candidates = [];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        if (grid[y][x] !== 1) continue;
        const horizontal = grid[y][x - 1] === 0 && grid[y][x + 1] === 0;
        const vertical = grid[y - 1][x] === 0 && grid[y + 1][x] === 0;
        if (horizontal || vertical) candidates.push([x, y]);
      }
    }
    shuffle(candidates);
    const loopCount = Math.floor(candidates.length * chance);
    for (let i = 0; i < loopCount; i += 1) {
      const [x, y] = candidates[i];
      grid[y][x] = 0;
    }
  }

  // 出口随机落在离起点较远的通道中，避免固定在地图右下角。
  const start = [1, 1];
  const distances = distanceMap({ grid, width, height, start, goal: null }, start);
  let maxDistance = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (distances[y][x] > maxDistance) maxDistance = distances[y][x];
    }
  }
  const goalCandidates = [];
  const minDistance = maxDistance * 0.55;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (grid[y][x] !== 0) continue;
      if (x === 1 && y === 1) continue;
      if (distances[y][x] >= minDistance) goalCandidates.push([x, y]);
    }
  }
  const goal =
    goalCandidates[Math.floor(Math.random() * goalCandidates.length)] || [
      width - 2,
      height - 2,
    ];

  return { grid, width, height, start, goal };
}

export function findDeadEnds(maze) {
  const ends = [];
  for (let y = 1; y < maze.height - 1; y += 1) {
    for (let x = 1; x < maze.width - 1; x += 1) {
      if (maze.grid[y][x] !== 0) continue;
      let degree = 0;
      if (maze.grid[y - 1][x] === 0) degree += 1;
      if (maze.grid[y + 1][x] === 0) degree += 1;
      if (maze.grid[y][x - 1] === 0) degree += 1;
      if (maze.grid[y][x + 1] === 0) degree += 1;
      if (degree === 1) ends.push([x, y]);
    }
  }
  return ends;
}

export function distanceMap(maze, start) {
  const dist = Array.from({ length: maze.height }, () => Array(maze.width).fill(-1));
  const [sx, sy] = start;
  dist[sy][sx] = 0;
  const queue = [[sx, sy]];

  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= maze.width || ny >= maze.height) continue;
      if (maze.grid[ny][nx] !== 0 || dist[ny][nx] !== -1) continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

export function selectDecoyCells(maze, count) {
  if (count <= 0) return [];
  const startDist = distanceMap(maze, maze.start);
  const goalDist = distanceMap(maze, maze.goal);
  const [sx, sy] = maze.start;
  const [gx, gy] = maze.goal;

  const candidates = findDeadEnds(maze).filter(([x, y]) => {
    if (x === sx && y === sy) return false;
    if (x === gx && y === gy) return false;
    return startDist[y][x] >= 6 && goalDist[y][x] >= 3;
  });
  if (!candidates.length) return [];

  const picked = [];
  const isSeparated = (x, y) =>
    picked.every(([px, py]) => Math.abs(px - x) + Math.abs(py - y) >= 4);
  const add = ([x, y]) => {
    if (picked.length >= count) return;
    if (picked.some(([px, py]) => px === x && py === y)) return;
    if (isSeparated(x, y)) picked.push([x, y]);
  };

  const maxStart = Math.max(...candidates.map(([x, y]) => startDist[y][x]));
  const early = [...candidates].sort(
    (a, b) =>
      Math.abs(startDist[a[1]][a[0]] - maxStart * 0.3) -
      Math.abs(startDist[b[1]][b[0]] - maxStart * 0.3),
  )[0];
  add(early);

  const nearGoal = candidates
    .filter(([x, y]) => startDist[y][x] >= 8)
    .sort((a, b) => goalDist[a[1]][a[0]] - goalDist[b[1]][b[0]]);
  if (nearGoal.length) add(nearGoal[0]);

  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const cell of shuffled) add(cell);

  return picked.slice(0, count);
}
