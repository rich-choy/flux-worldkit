/**
 * Bridge creation and ecosystem policy layer
 * This layer handles world generation concerns like ecosystems, vertices, and bridge policies.
 * It uses pure pathfinding functions for the actual geometric calculations.
 */

import { findGridPath, canFindGridPath, type PathfindingConstraints } from './pure-pathfinding.js';
import type { WorldVertex, SpatialMetrics } from './types.js';
import { EcosystemName } from './types.js';

export interface BridgeCreationOptions {
  /** Whether to allow cross-ecosystem bridges */
  allowCrossEcosystem?: boolean;
  /** Maximum bridge length in grid steps */
  maxBridgeLength?: number;
  /** Ecosystem to assign to bridge vertices (defaults to source ecosystem) */
  bridgeEcosystem?: EcosystemName;
}

export interface BridgeResult {
  intermediateVertices: WorldVertex[];
  connections: Array<{ from: string; to: string }>;
  success: boolean;
  reason?: string;
}

/**
 * Extract ecosystem band for cross-ecosystem policy decisions
 */
function getEcosystemBand(ecosystem: EcosystemName): string {
  if (ecosystem === EcosystemName.MARSH_TROPICAL) return 'jungle';
  return ecosystem.split(':')[2]; // Extract ecosystem name (e.g., 'steppe', 'grassland')
}

/**
 * Determine which ecosystem a grid position belongs to based on column boundaries
 */
export function determineEcosystemFromGridX(gridX: number, metrics: SpatialMetrics): EcosystemName {
  const totalColumns = metrics.gridWidth;
  const baseColumnsPerEcosystem = Math.floor(totalColumns / 5);
  const remainderColumns = totalColumns % 5;

  const ecosystems = [
    EcosystemName.STEPPE_ARID,
    EcosystemName.GRASSLAND_TEMPERATE,
    EcosystemName.FOREST_TEMPERATE,
    EcosystemName.MOUNTAIN_ARID,
    EcosystemName.JUNGLE_TROPICAL
  ];

  let currentColumn = 0;
  for (let ecosystemIndex = 0; ecosystemIndex < ecosystems.length; ecosystemIndex++) {
    const startCol = currentColumn;
    const columnsForThisEcosystem = baseColumnsPerEcosystem + (ecosystemIndex < remainderColumns ? 1 : 0);
    const endCol = startCol + columnsForThisEcosystem;

    if (gridX >= startCol && gridX < endCol) {
      return ecosystems[ecosystemIndex];
    }

    currentColumn = endCol;
  }

  return EcosystemName.JUNGLE_TROPICAL; // Fallback
}

/**
 * Check ecosystem policy to see if a bridge is allowed
 */
function checkEcosystemPolicy(
  from: WorldVertex,
  to: WorldVertex,
  options: BridgeCreationOptions
): { allowed: boolean; reason?: string } {
  const sourceBand = getEcosystemBand(from.ecosystem);
  const targetBand = getEcosystemBand(to.ecosystem);

  // Same ecosystem band is always allowed
  if (sourceBand === targetBand) {
    return { allowed: true };
  }

  // Cross-ecosystem bridges require explicit permission
  if (!options.allowCrossEcosystem) {
    return {
      allowed: false,
      reason: `Cross-ecosystem bridge from ${sourceBand} to ${targetBand} not allowed by policy`
    };
  }

  return { allowed: true };
}

/**
 * Build occupancy map from existing vertices for collision detection
 */
function buildOccupancyMap(
  vertices: WorldVertex[],
  excludeIds: Set<string> = new Set()
): Set<string> {
  const occupied = new Set<string>();
  for (const vertex of vertices) {
    if (!excludeIds.has(vertex.id)) {
      occupied.add(`${vertex.gridX},${vertex.gridY}`);
    }
  }
  return occupied;
}

/**
 * Create bridge between two vertices using pure pathfinding + ecosystem policy
 */
export function createBridge(
  from: WorldVertex,
  to: WorldVertex,
  startVertexId: number,
  metrics: SpatialMetrics,
  existingVertices: WorldVertex[] = [],
  options: BridgeCreationOptions = {}
): BridgeResult {
  // 1. Check ecosystem policy first
  const policyCheck = checkEcosystemPolicy(from, to, options);
  if (!policyCheck.allowed) {
    return {
      intermediateVertices: [],
      connections: [],
      success: false,
      reason: policyCheck.reason
    };
  }

  // 2. Set up pure pathfinding constraints
  const occupiedPositions = buildOccupancyMap(existingVertices, new Set([from.id, to.id]));

  const constraints: PathfindingConstraints = {
    maxSteps: options.maxBridgeLength || 50,
    minX: 0,
    minY: 0,
    maxX: metrics.gridWidth,
    maxY: metrics.gridHeight,
    occupiedPositions
  };

  // 3. Use pure pathfinding to find the geometric path
  const path = findGridPath(
    { gridX: from.gridX, gridY: from.gridY },
    { gridX: to.gridX, gridY: to.gridY },
    constraints
  );

  if (path.length === 0) {
    return {
      intermediateVertices: [],
      connections: [],
      success: false,
      reason: `No valid path found from (${from.gridX},${from.gridY}) to (${to.gridX},${to.gridY})`
    };
  }

  // 4. Create world vertices and connections from the pure geometric path
  const intermediateVertices: WorldVertex[] = [];
  const connections: Array<{ from: string; to: string }> = [];

  let vertexId = startVertexId;
  let prevVertex = from;
  const bridgeEcosystem = options.bridgeEcosystem || from.ecosystem;

  // Create intermediate vertices (path excludes start and end points)
  for (const pathPoint of path.slice(0, -1)) { // Exclude the end point
    // Calculate world coordinates
    const worldX = metrics.placeMargin + pathPoint.gridX * metrics.placeSpacing;
    const worldY = metrics.placeMargin + pathPoint.gridY * metrics.placeSpacing;

    const intermediateVertex: WorldVertex = {
      id: `bridge-${vertexId}`,
      x: worldX,
      y: worldY,
      gridX: pathPoint.gridX,
      gridY: pathPoint.gridY,
      ecosystem: bridgeEcosystem,
      placeId: `flux:place:bridge-${vertexId}`
    };

    intermediateVertices.push(intermediateVertex);

    // Connect to previous vertex
    connections.push({
      from: prevVertex.id,
      to: intermediateVertex.id
    });

    prevVertex = intermediateVertex;
    vertexId++;
  }

  // Connect to the target vertex
  connections.push({
    from: prevVertex.id,
    to: to.id
  });

  return {
    intermediateVertices,
    connections,
    success: true
  };
}

/**
 * Check if a bridge can be created between two vertices (fast check without actually creating it)
 */
export function canCreateBridge(
  from: WorldVertex,
  to: WorldVertex,
  metrics: SpatialMetrics,
  existingVertices: WorldVertex[] = [],
  options: BridgeCreationOptions = {}
): boolean {
  // Check ecosystem policy
  const policyCheck = checkEcosystemPolicy(from, to, options);
  if (!policyCheck.allowed) {
    return false;
  }

  // Check pathfinding
  const occupiedPositions = buildOccupancyMap(existingVertices, new Set([from.id, to.id]));
  const constraints: PathfindingConstraints = {
    maxSteps: options.maxBridgeLength || 50,
    minX: 0,
    minY: 0,
    maxX: metrics.gridWidth,
    maxY: metrics.gridHeight,
    occupiedPositions
  };

  return canFindGridPath(
    { gridX: from.gridX, gridY: from.gridY },
    { gridX: to.gridX, gridY: to.gridY },
    constraints
  );
}
