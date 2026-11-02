// Tiny tolerance so routes may travel exactly along expanded obstacle margins.
const BOUNDS_EPSILON = 0.1;

/**
 * Rectangular bounds that A* routing treats as an obstacle.
 */
export interface Obstacle {
  /** Left edge x-coordinate in diagram space. */
  x: number;
  /** Top edge y-coordinate in diagram space. */
  y: number;
  /** Obstacle width in diagram units. */
  w: number;
  /** Obstacle height in diagram units. */
  h: number;
}

/**
 * Two-dimensional point in diagram space.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Result of A* routing computation.
 */
export interface RouteAStarResult {
  /** Ordered waypoints from start to end. */
  points: Point[];
  /** Whether the algorithm fell back to a simple midpoint route. */
  fallbackUsed: boolean;
  /** Optional diagnostic for fallback routes. */
  warning?: string;
}

const assertFinitePoint = (name: string, point: Point) => {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${name} must contain finite x and y coordinates.`);
  }
};

const assertFiniteObstacle = (obstacle: Obstacle, index: number) => {
  if (
    !Number.isFinite(obstacle.x) ||
    !Number.isFinite(obstacle.y) ||
    !Number.isFinite(obstacle.w) ||
    !Number.isFinite(obstacle.h)
  ) {
    throw new TypeError(`obstacles[${index}] must contain finite bounds.`);
  }
};

/**
 * Computes a grid-snapped orthogonal route between two points while avoiding obstacles.
 *
 * @param start - Starting point.
 * @param end - Ending point.
 * @param obstacles - Rectangular obstacles to route around.
 * @param margin - Clearance to keep around each obstacle. Defaults to 20.
 * @returns Ordered waypoints from start to end and whether a fallback midpoint route was used.
 * @throws TypeError when a point, obstacle bound, or margin is not finite.
 */
export function routeAStar(
  start: Point,
  end: Point,
  obstacles: Obstacle[],
  margin: number = 20
): RouteAStarResult {
  assertFinitePoint('start', start);
  assertFinitePoint('end', end);
  obstacles.forEach(assertFiniteObstacle);
  if (!Number.isFinite(margin)) {
    throw new TypeError('margin must be finite.');
  }

  // 1. Build grid coordinates
  const xSet = new Set<number>();
  const ySet = new Set<number>();

  xSet.add(start.x);
  xSet.add(end.x);
  ySet.add(start.y);
  ySet.add(end.y);

  obstacles.forEach((o) => {
    xSet.add(o.x - margin);
    xSet.add(o.x + o.w + margin);
    ySet.add(o.y - margin);
    ySet.add(o.y + o.h + margin);
  });

  const xCoords = Array.from(xSet).sort((a, b) => a - b);
  const yCoords = Array.from(ySet).sort((a, b) => a - b);

  // 2. Identify obstacle grid cells
  // To keep it simple, a point (x,y) is blocked if it falls strictly inside any obstacle
  const isBlocked = (x: number, y: number) => {
    for (const o of obstacles) {
      // Use slightly smaller bounds to allow walking on the margin edge
      if (
        x > o.x - margin + BOUNDS_EPSILON &&
        x < o.x + o.w + margin - BOUNDS_EPSILON &&
        y > o.y - margin + BOUNDS_EPSILON &&
        y < o.y + o.h + margin - BOUNDS_EPSILON
      ) {
        return true;
      }
    }
    return false;
  };

  // If start or end is blocked, we must allow escaping it.
  // Actually, we'll just ignore blockages exactly AT start or end.

  // 3. A* Search
  // State: index representing (xIdx, yIdx, direction)
  // direction: 0=start, 1=horizontal, 2=vertical

  const startXIdx = xCoords.indexOf(start.x);
  const startYIdx = yCoords.indexOf(start.y);
  const endXIdx = xCoords.indexOf(end.x);
  const endYIdx = yCoords.indexOf(end.y);

  if (
    startXIdx === -1 ||
    startYIdx === -1 ||
    endXIdx === -1 ||
    endYIdx === -1
  ) {
    // Should never happen
    return { points: [start, end], fallbackUsed: true };
  }

  interface Node {
    xIdx: number;
    yIdx: number;
    dir: number;
    g: number;
    f: number;
    parent: Node | null;
  }

  const openHeap: Node[] = [];
  const closed = new Set<string>();
  const bestG = new Map<string, number>();

  const startNode: Node = {
    xIdx: startXIdx,
    yIdx: startYIdx,
    dir: 0,
    g: 0,
    f: 0,
    parent: null,
  };

  const getStateKey = (xIdx: number, yIdx: number, dir: number) =>
    `${xIdx},${yIdx},${dir}`;

  const compareNodes = (a: Node, b: Node) => a.f - b.f || a.g - b.g;

  // Keep a tiny local heap to avoid adding a priority-queue dependency for A*.
  const pushOpen = (node: Node) => {
    openHeap.push(node);
    let idx = openHeap.length - 1;
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (compareNodes(openHeap[parent], openHeap[idx]) <= 0) break;
      [openHeap[parent], openHeap[idx]] = [openHeap[idx], openHeap[parent]];
      idx = parent;
    }
  };

  const popOpen = (): Node => {
    if (openHeap.length === 0) {
      throw new Error('popOpen called on empty heap');
    }

    const min = openHeap[0];
    const last = openHeap.pop()!;
    if (openHeap.length > 0) {
      openHeap[0] = last;
      let idx = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const left = idx * 2 + 1;
        const right = left + 1;
        let smallest = idx;

        if (
          left < openHeap.length &&
          compareNodes(openHeap[left], openHeap[smallest]) < 0
        ) {
          smallest = left;
        }
        if (
          right < openHeap.length &&
          compareNodes(openHeap[right], openHeap[smallest]) < 0
        ) {
          smallest = right;
        }
        if (smallest === idx) break;

        [openHeap[idx], openHeap[smallest]] = [
          openHeap[smallest],
          openHeap[idx],
        ];
        idx = smallest;
      }
    }
    return min;
  };

  pushOpen(startNode);
  bestG.set(getStateKey(startXIdx, startYIdx, 0), 0);

  let bestNode: Node | null = null;

  while (openHeap.length > 0) {
    const curr = popOpen();

    if (curr.xIdx === endXIdx && curr.yIdx === endYIdx) {
      bestNode = curr;
      break;
    }

    const key = getStateKey(curr.xIdx, curr.yIdx, curr.dir);
    if (closed.has(key)) continue;
    closed.add(key);

    const neighbors = [
      { dx: 1, dy: 0, dir: 1 },
      { dx: -1, dy: 0, dir: 1 },
      { dx: 0, dy: 1, dir: 2 },
      { dx: 0, dy: -1, dir: 2 },
    ];

    for (const n of neighbors) {
      // Don't reverse direction directly (not really needed if g-cost handles it, but good for perf)
      const nx = curr.xIdx + n.dx;
      const ny = curr.yIdx + n.dy;

      if (nx < 0 || nx >= xCoords.length || ny < 0 || ny >= yCoords.length)
        continue;

      const px = xCoords[nx];
      const py = yCoords[ny];

      // Allow reaching end point even if technically inside an obstacle bound
      if (
        (nx !== endXIdx || ny !== endYIdx) &&
        (nx !== startXIdx || ny !== startYIdx)
      ) {
        if (isBlocked(px, py)) continue;
      }

      // Prevent segments from crossing through obstacles
      let segmentBlocked = false;
      const minX = Math.min(xCoords[curr.xIdx], px);
      const maxX = Math.max(xCoords[curr.xIdx], px);
      const minY = Math.min(yCoords[curr.yIdx], py);
      const maxY = Math.max(yCoords[curr.yIdx], py);
      const isFromStart = curr.xIdx === startXIdx && curr.yIdx === startYIdx;
      const isToEnd = nx === endXIdx && ny === endYIdx;

      // We only need to check if the movement spans across an obstacle
      // If minX == maxX, it's a vertical segment. If minY == maxY, it's horizontal.
      if (!isFromStart && !isToEnd) {
        for (const o of obstacles) {
          if (
            minX < o.x + o.w + margin - BOUNDS_EPSILON &&
            maxX > o.x - margin + BOUNDS_EPSILON &&
            minY < o.y + o.h + margin - BOUNDS_EPSILON &&
            maxY > o.y - margin + BOUNDS_EPSILON
          ) {
            segmentBlocked = true;
            break;
          }
        }
      }
      if (segmentBlocked) continue;

      // Calculate cost
      // Base cost is distance
      const dist =
        Math.abs(px - xCoords[curr.xIdx]) + Math.abs(py - yCoords[curr.yIdx]);

      // Bend penalty
      const isBend = curr.dir !== 0 && curr.dir !== n.dir;
      const bendCost = isBend ? 1000 : 0;

      const g = curr.g + dist + bendCost;
      const h = Math.abs(px - end.x) + Math.abs(py - end.y);
      const f = g + h;
      const nextKey = getStateKey(nx, ny, n.dir);
      const bestKnown = bestG.get(nextKey);
      if (bestKnown !== undefined && g >= bestKnown) continue;

      bestG.set(nextKey, g);
      pushOpen({
        xIdx: nx,
        yIdx: ny,
        dir: n.dir,
        g,
        f,
        parent: curr,
      });
    }
  }

  if (!bestNode) {
    // Fallback if no path found (should be rare unless fully blocked)
    const warning = `routeAStar could not find an obstacle-free path from (${start.x}, ${start.y}) to (${end.x}, ${end.y}); using fallback midpoint route.`;
    return {
      points: [
        start,
        { x: start.x, y: (start.y + end.y) / 2 },
        { x: end.x, y: (start.y + end.y) / 2 },
        end,
      ],
      fallbackUsed: true,
      warning,
    };
  }

  // Reconstruct path
  const startSnapped = { x: xCoords[startXIdx], y: yCoords[startYIdx] };
  const endSnapped = { x: xCoords[endXIdx], y: yCoords[endYIdx] };
  const path: Point[] = [];

  // Note: start.x is always in xSet, so startSnapped.x === start.x.
  // This guarantees this intermediate point won't create a diagonal line.
  if (start.x !== startSnapped.x || start.y !== startSnapped.y) {
    path.push(start);
    path.push({ x: start.x, y: startSnapped.y });
  } else {
    path.push(start);
  }

  let curr: Node | null = bestNode;
  const revPath: Point[] = [];
  while (curr) {
    revPath.push({
      x: xCoords[curr.xIdx],
      y: yCoords[curr.yIdx],
    });
    curr = curr.parent;
  }
  revPath.reverse();

  for (let i = 0; i < revPath.length; i++) {
    // Avoid duplicating the start if it matches exactly
    if (
      i === 0 &&
      revPath[i].x === path[path.length - 1].x &&
      revPath[i].y === path[path.length - 1].y
    )
      continue;
    path.push(revPath[i]);
  }

  // Note: end.x is always in xSet, so endSnapped.x === end.x.
  // This guarantees this intermediate point won't create a diagonal line.
  if (end.x !== endSnapped.x || end.y !== endSnapped.y) {
    path.push({ x: end.x, y: endSnapped.y });
    path.push(end);
  } else {
    // Avoid duplicating end
    const last = path[path.length - 1];
    if (last.x !== end.x || last.y !== end.y) {
      path.push(end);
    }
  }

  return { points: path, fallbackUsed: false };
}
