function neighbors(x, y) {
  return [
    [x, y - 2],
    [x + 2, y],
    [x, y + 2],
    [x - 2, y],
  ];
}

export function generateMaze(cols, rows) {
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

  return { grid, width, height, start: [1, 1], goal: [width - 2, height - 2] };
}
