/**
 * Pure geometric pathfinding functions
 * These functions only care about coordinates, grid constraints, and movement rules.
 * They know nothing about ecosystems, vertices, or world generation policies.
 */

export interface GridCoords {
  gridX: number;
  gridY: number;
}

export interface PathfindingConstraints {
  /** Maximum number of pathfinding steps before giving up */
  maxSteps?: number;
  /** Minimum bounds (inclusive) */
  minX?: number;
  minY?: number;
  /** Maximum bounds (exclusive) */
  maxX?: number;
  maxY?: number;
  /** Set of occupied grid positions as "x,y" strings */
  occupiedPositions?: Set<string>;
}

/**
 * Pure geometric pathfinding using greedy diagonal-first approach
 * This function ONLY cares about coordinates and movement constraints.
 * It knows nothing about ecosystems or world generation.
 */
export function findGridPath(
  start: GridCoords,
  end: GridCoords,
  constraints: PathfindingConstraints = {}
): GridCoords[] {
  const {
    maxSteps = 100,
    minX = 0,
    minY = 0,
    maxX = Infinity,
    maxY = Infinity,
    occupiedPositions = new Set()
  } = constraints;

  // If start and end are the same, return empty path
  if (start.gridX === end.gridX && start.gridY === end.gridY) {
    return [];
  }

  const path: GridCoords[] = [];
  let currentX = start.gridX;
  let currentY = start.gridY;
  let steps = 0;

  while ((currentX !== end.gridX || currentY !== end.gridY) && steps < maxSteps) {
    const deltaX = end.gridX - currentX;
    const deltaY = end.gridY - currentY;

    let nextX = currentX;
    let nextY = currentY;

    // Prefer diagonal movement when possible (maintains 45-degree angles)
    if (deltaX !== 0 && deltaY !== 0) {
      nextX += Math.sign(deltaX);
      nextY += Math.sign(deltaY);
    } else if (deltaX !== 0) {
      nextX += Math.sign(deltaX);
    } else if (deltaY !== 0) {
      nextY += Math.sign(deltaY);
    }

    // Check bounds
    if (nextX < minX || nextY < minY || nextX >= maxX || nextY >= maxY) {
      break; // Can't continue, out of bounds
    }

    // Check collision
    const nextKey = `${nextX},${nextY}`;
    if (occupiedPositions.has(nextKey)) {
      break; // Can't continue, collision
    }

    // Move to next position
    currentX = nextX;
    currentY = nextY;
    path.push({ gridX: currentX, gridY: currentY });

    steps++;
  }

  // Return path only if we successfully reached the target
  if (currentX === end.gridX && currentY === end.gridY) {
    return path;
  } else {
    return []; // Failed to reach target
  }
}

/**
 * Check if a path can be found between two points without actually creating it
 * Useful for fast connectivity checks
 */
export function canFindGridPath(
  start: GridCoords,
  end: GridCoords,
  constraints: PathfindingConstraints = {}
): boolean {
  return findGridPath(start, end, constraints).length > 0 ||
         (start.gridX === end.gridX && start.gridY === end.gridY);
}

/**
 * Calculate the Manhattan distance between two grid coordinates
 * The Manhattan distance is the sum of the absolute differences of the x and y coordinates. Imagine navigating city blocks.
 */
export function manhattanDistance(a: GridCoords, b: GridCoords): number {
  return Math.abs(a.gridX - b.gridX) + Math.abs(a.gridY - b.gridY);
}

/**
 * Calculate the Chebyshev distance (diagonal distance) between two grid coordinates
 * The Chebyshev distance is the maximum of the absolute differences of the x and y coordinates. Imagine navigating a chessboard.
 */
export function chebyshevDistance(a: GridCoords, b: GridCoords): number {
  return Math.max(Math.abs(a.gridX - b.gridX), Math.abs(a.gridY - b.gridY));
}
