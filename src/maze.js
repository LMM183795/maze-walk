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

  return { grid, width, height, start: [1, 1], goal: [width - 2, height - 2] };
}
