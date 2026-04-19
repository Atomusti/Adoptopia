import { Position, SHELTER_POSITION, gameData } from "./gameData";

export function calculatePath(start: Position, end: Position): Position[] {
  const obstacles = new Set(gameData.families.map(f => `${f.gridPosition.x},${f.gridPosition.y}`));
  obstacles.delete(`${start.x},${start.y}`);
  obstacles.delete(`${end.x},${end.y}`);

  const queue: { pos: Position, path: Position[] }[] = [{ pos: start, path: [start] }];
  const visited = new Set([`${start.x},${start.y}`]);
  const dirs = [ {x:0, y:1}, {x:1, y:0}, {x:0, y:-1}, {x:-1, y:0} ];

  let bestPath: Position[] | null = null;

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;
    if (pos.x === end.x && pos.y === end.y) {
      bestPath = path;
      break;
    }
    for (const d of dirs) {
      const nx = pos.x + d.x;
      const ny = pos.y + d.y;
      if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
        const key = `${nx},${ny}`;
        if (!visited.has(key) && !obstacles.has(key)) {
          visited.add(key);
          queue.push({ pos: { x: nx, y: ny }, path: [...path, { x: nx, y: ny }] });
        }
      }
    }
  }
  return bestPath || [start, end];
}
