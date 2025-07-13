/**
 * River Delta-based world generation with 8-directional movement and golden ratio proportions
 */

import { createPlace, Direction, type Place, type PlaceURN } from 'flux-game';
import type {
  WorldGenerationConfig,
  WorldGenerationResult,
  WorldVertex,
  SpatialMetrics
} from './types';
import { EcosystemName, calculateSpatialMetrics, ECOSYSTEM_PROFILES } from './types';
import { createBridge } from './bridge-policy';

// Golden ratio constants for natural branching patterns
const GOLDEN_RATIO = 1.618033988749895;
const INVERSE_GOLDEN_RATIO = 1 / GOLDEN_RATIO; // ≈ 0.618

// New data structures for dual delta system
interface DeltaEdge {
  id: string;
  from: WorldVertex;
  to: WorldVertex;
  direction: 'eastward' | 'westward';
  ecosystem: EcosystemName;
}

/*
interface DeltaNode {
  id: string;
  x: number;
  y: number;
  ecosystem: EcosystemName;
  children: DeltaNode[];
  parent?: DeltaNode;
}
*/

interface DeltaConfig {
  ecosystem: EcosystemName;
  bandStart: number;
  bandEnd: number;
  branchingFactor: number;  // How many children per node
  maxDepth: number;         // How many levels deep
  verticalSpread: number;   // How much vertical variation
}




/**
 * Generate dense mesh connectivity instead of sparse deltas
 * Each vertex connects to multiple neighbors to ensure full connectivity
 */
function generateDenseEcosystemConnectivity(
  ecosystem: EcosystemName,
  vertices: WorldVertex[],
  _metrics: SpatialMetrics,
  rng: SeededRandom,
  globalBranchingFactor?: number
): DeltaEdge[] {
  const edges: DeltaEdge[] = [];

  if (vertices.length === 0) {
    return edges;
  }

  // Get ecosystem-specific parameters
  const deltaConfig = getDeltaConfig(ecosystem, 1.0, globalBranchingFactor);



  // Filter out bridge vertices - they should only be connected via grid-aligned pathfinding
  const regularVertices = vertices.filter(v => !v.id.startsWith('bridge-'));

  // Create a spatial lookup for fast neighbor finding (excluding bridge vertices)
  const spatialLookup = new Map<string, WorldVertex>();
  for (const vertex of regularVertices) {
    const key = `${vertex.gridX},${vertex.gridY}`;
    spatialLookup.set(key, vertex);
  }

  // For each regular vertex (excluding bridge vertices), connect to available neighbors
  for (const vertex of regularVertices) {
    let connectionsCreated = 0;
    // Use branching factor to determine target connections - allow very sparse patterns
    const targetConnections = Math.max(1, Math.min(6, Math.round(deltaConfig.branchingFactor + 1)));

    // Create directional bias - favor eastward connections for river delta flow
    const eastwardDirections = [[1, 0], [1, 1], [1, -1]];  // East, Southeast, Northeast
    const westwardDirections = [[-1, 0], [-1, 1], [-1, -1]]; // West, Southwest, Northwest
    const neutralDirections = [[0, 1], [0, -1]]; // North, South

    // Bias towards eastward flow (like river deltas flowing east)
    const biasedDirections = [
      ...eastwardDirections,
      ...eastwardDirections, // Double weight for eastward
      ...neutralDirections,
      ...westwardDirections
    ];

    // Randomize the biased direction order
    const shuffledDirections = [...biasedDirections].sort(() => rng.next() - 0.5);

    // Connection probability based on ecosystem characteristics - allow very sparse patterns
    const connectionProbability = Math.max(0.1, Math.min(0.9, deltaConfig.branchingFactor / 2.0));

    for (const [dx, dy] of shuffledDirections) {
      if (connectionsCreated >= targetConnections) break;

      const targetGridX = vertex.gridX + dx;
      const targetGridY = vertex.gridY + dy;
      const targetKey = `${targetGridX},${targetGridY}`;
      const targetVertex = spatialLookup.get(targetKey);

      if (targetVertex && targetVertex.id !== vertex.id) {
        // Check if this edge already exists in reverse
        const existingEdge = edges.find(e =>
          (e.from.id === vertex.id && e.to.id === targetVertex.id) ||
          (e.from.id === targetVertex.id && e.to.id === vertex.id)
        );

        if (!existingEdge) {
          // Apply directional bias to connection probability
          const isEastward = dx > 0;
          const isWestward = dx < 0;

          let biasedProbability = connectionProbability;
          if (isEastward) {
            biasedProbability *= 1.2; // 20% boost for eastward connections
          } else if (isWestward) {
            biasedProbability *= 0.8; // 20% reduction for westward connections
          }

          if (rng.next() < biasedProbability) {
            const direction = isEastward ? 'eastward' : 'westward';

        edges.push({
          id: `${vertex.id}-${targetVertex.id}`,
          from: vertex,
          to: targetVertex,
          direction: direction,
          ecosystem: ecosystem
        });

            connectionsCreated++;
        }
      }
    }
    }
  }

  console.log(`  Generated ${edges.length} dense mesh edges for ${ecosystem.split(':')[2]} (${vertices.length} vertices)`);
  return edges;
}

/**
 * Generate eastward delta edges within an ecosystem
 * Now uses dense mesh connectivity instead of sparse trees
 */
function generateEastwardDeltaEdges(
  ecosystem: EcosystemName,
  vertices: WorldVertex[],
  metrics: SpatialMetrics,
  rng: SeededRandom,
  globalBranchingFactor?: number
): DeltaEdge[] {
  return generateDenseEcosystemConnectivity(ecosystem, vertices, metrics, rng, globalBranchingFactor);
}

/**
 * Simple seeded random number generator
 * EXPORTED FOR TESTING ONLY - DO NOT USE IN PRODUCTION CODE
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 0x100000000;
    return this.seed / 0x100000000;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * Get delta configuration for each ecosystem type, scaled by desired world size
 */
function getDeltaConfig(
  ecosystem: EcosystemName,
  scaleFactor: number = 1.0,
  globalBranchingFactor?: number
): Omit<DeltaConfig, 'ecosystem' | 'bandStart' | 'bandEnd'> {
  const baseConfigs = {
    'flux:eco:steppe:arid': {
      branchingFactor: 1.5,  // Reduced for sparser macro-level connectivity
      maxDepth: 5,           // Increased from 4 for better spanning
      verticalSpread: 0.8    // Wide vertical spread
    },
    'flux:eco:grassland:temperate': {
      branchingFactor: 1.5,  // Reduced for sparser macro-level connectivity
      maxDepth: 5,           // Increased from 4 for better spanning
      verticalSpread: 0.7    // Wide vertical spread
    },
    'flux:eco:forest:temperate': {
      branchingFactor: 1.5,  // Reduced for sparser macro-level connectivity
      maxDepth: 4,           // Increased from 3 for better spanning
      verticalSpread: 0.6    // Moderate spread
    },
    'flux:eco:mountain:arid': {
      branchingFactor: 1.5,  // Reduced for sparser macro-level connectivity
      maxDepth: 4,           // Increased from 3 for better spanning
      verticalSpread: 0.4    // Limited spread
    },
    'flux:eco:jungle:tropical': {
      branchingFactor: 1.5,  // Reduced for sparser macro-level connectivity
      maxDepth: 4,           // Increased from 3 for better spanning
      verticalSpread: 0.5    // Moderate spread
    },
    'flux:eco:marsh:tropical': {
      branchingFactor: 1.5,  // Reduced for sparser macro-level connectivity
      maxDepth: 3,           // Increased from 2 for better spanning
      verticalSpread: 0.3    // Limited spread
    }
  };

  const baseConfig = baseConfigs[ecosystem] || baseConfigs['flux:eco:grassland:temperate'];

  // Use global branching factor if provided, otherwise use ecosystem-specific default
  const effectiveBranchingFactor = globalBranchingFactor ?? baseConfig.branchingFactor;

  // Scale the configuration based on desired world size
  // Increase depth and branching to generate more places
  const scaledDepth = Math.max(2, Math.min(10, Math.round(baseConfig.maxDepth * scaleFactor)));
  const scaledBranching = Math.max(0.1, Math.min(6, Math.round(effectiveBranchingFactor * scaleFactor * 10) / 10));

  return {
    branchingFactor: scaledBranching,
    maxDepth: scaledDepth,
    verticalSpread: baseConfig.verticalSpread
  };
}

/*
function generateEcosystemDelta(
  config: DeltaConfig,
  rng: SeededRandom,
  worldHeight: number = 600,
  scaleFactor: number = 1.0
): DeltaNode {
  const deltaConfig = getDeltaConfig(config.ecosystem, scaleFactor);

  // Create the origin node at the western edge
  const origin: DeltaNode = {
    id: generateVertexId(rng),
    x: config.bandStart,
    y: worldHeight * 0.5, // Start at middle of world height
    ecosystem: config.ecosystem,
    children: []
  };

  // Generate branching structure
  generateBranches(origin, config, deltaConfig, rng, worldHeight, 0);

  return origin;
}
 */

/*
function generateBranches(
  node: DeltaNode,
  config: DeltaConfig,
  deltaConfig: Omit<DeltaConfig, 'ecosystem' | 'bandStart' | 'bandEnd'>,
  rng: SeededRandom,
  worldHeight: number,
  depth: number
): void {
  if (depth >= deltaConfig.maxDepth) return;

  const bandWidth = config.bandEnd - config.bandStart;
  const isLastLevel = (depth + 1) >= deltaConfig.maxDepth;

  // Ensure final level reaches the eastern edge
  const nextX = isLastLevel
    ? config.bandEnd  // Force final nodes to eastern edge
    : config.bandStart + (bandWidth * (depth + 1) / deltaConfig.maxDepth);

  // Determine number of children (with some randomness)
  const baseChildren = deltaConfig.branchingFactor;
  const childrenCount = Math.max(1, baseChildren + rng.nextInt(2) - 1);

  // Create children
  for (let i = 0; i < childrenCount; i++) {
    // Calculate vertical position with spread
    const verticalRange = worldHeight * deltaConfig.verticalSpread;
    const verticalOffset = rng.nextFloat(-verticalRange/2, verticalRange/2);
    const childY = Math.max(50, Math.min(worldHeight - 50, node.y + verticalOffset));

    const child: DeltaNode = {
      id: generateVertexId(rng),
      x: isLastLevel
        ? nextX + rng.nextFloat(-bandWidth * 0.05, bandWidth * 0.05)  // Small variation at eastern edge
        : nextX + rng.nextFloat(-bandWidth * 0.1, bandWidth * 0.1),   // Normal variation
      y: childY,
      ecosystem: config.ecosystem,
      children: [],
      parent: node
    };

    node.children.push(child);

    // Recursively generate branches
    generateBranches(child, config, deltaConfig, rng, worldHeight, depth + 1);
  }
}
*/

/**
 * Generate a unique vertex ID
 */
function generateVertexId(rng: SeededRandom): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(rng.nextInt(chars.length));
  }
  return `vertex_${result}`;
}

/**
 * Generate place name based on ecosystem
 */
function generatePlaceName(ecosystem: EcosystemName, id: string): string {
  const ecosystemType = ecosystem.split(':')[2];
  const shortId = id.split('_')[1]?.substring(0, 4) || 'unknown';

  switch (ecosystemType) {
    case 'steppe': return `Steppe Crossing ${shortId}`;
    case 'grassland': return `Grassland ${shortId}`;
    case 'forest': return `Forest Grove ${shortId}`;
    case 'mountain': return `Mountain Pass ${shortId}`;
    case 'jungle': return `Jungle Clearing ${shortId}`;
    case 'marsh': return `Marsh ${shortId}`;
    default: return `Unknown ${shortId}`;
  }
}

/**
 * Generate place description based on ecosystem
 */
function generatePlaceDescription(ecosystem: EcosystemName): string {
  const ecosystemType = ecosystem.split(':')[2];

  switch (ecosystemType) {
    case 'steppe': return 'Wide open grassland stretches to the horizon.';
    case 'grassland': return 'Rolling hills covered in tall grass.';
    case 'forest': return 'Dense trees create a canopy overhead.';
    case 'mountain': return 'Rocky peaks and narrow passes.';
    case 'jungle': return 'Thick vegetation and humid air.';
    case 'marsh': return 'Soggy ground and standing water.';
    default: return 'A mysterious location.';
  }
}

/**
 * Calculate direction from one point to another
 */
function calculateDirection(from: { x: number; y: number }, to: { x: number; y: number }): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Calculate angle in radians
  const angle = Math.atan2(dy, dx);

  // Convert to degrees (0-360)
  let degrees = (angle * 180) / Math.PI;
  if (degrees < 0) degrees += 360;

  // Map to 8 cardinal directions
  if (degrees >= 337.5 || degrees < 22.5) return Direction.EAST;
  if (degrees >= 22.5 && degrees < 67.5) return Direction.SOUTHEAST;
  if (degrees >= 67.5 && degrees < 112.5) return Direction.SOUTH;
  if (degrees >= 112.5 && degrees < 157.5) return Direction.SOUTHWEST;
  if (degrees >= 157.5 && degrees < 202.5) return Direction.WEST;
  if (degrees >= 202.5 && degrees < 247.5) return Direction.NORTHWEST;
  if (degrees >= 247.5 && degrees < 292.5) return Direction.NORTH;
  if (degrees >= 292.5 && degrees < 337.5) return Direction.NORTHEAST;

  return Direction.EAST; // fallback
}

/**
 * Calculate opposite direction
 */
function getOppositeDirection(direction: Direction): Direction {
  const opposites: Partial<Record<Direction, Direction>> = {
    [Direction.NORTH]: Direction.SOUTH,
    [Direction.SOUTH]: Direction.NORTH,
    [Direction.EAST]: Direction.WEST,
    [Direction.WEST]: Direction.EAST,
    [Direction.NORTHEAST]: Direction.SOUTHWEST,
    [Direction.SOUTHWEST]: Direction.NORTHEAST,
    [Direction.NORTHWEST]: Direction.SOUTHEAST,
    [Direction.SOUTHEAST]: Direction.NORTHWEST
  };
  return opposites[direction] || direction;
}

/**
 * Add exits to places based on connections with proper directions
 */
function addExitsToPlaces(places: Place[], connections: Array<{from: string, to: string}>, vertices: WorldVertex[]): void {
  // Create lookup map for places by vertex ID (not place ID)
  const placeMap = new Map<string, Place>();
  places.forEach(place => {
    // Extract vertex ID from place ID: flux:place:vertex_abc123 -> vertex_abc123
    const vertexId = place.id.split(':')[2];
      placeMap.set(vertexId, place);
  });

  // Create vertex lookup for calculating directions using actual coordinates
  const vertexMap = new Map<string, { x: number; y: number }>();
  vertices.forEach(vertex => {
    vertexMap.set(vertex.id, { x: vertex.x, y: vertex.y });
  });

  let successfulConnections = 0;
  let failedConnections = 0;

  console.log(`Processing ${connections.length} connections...`);

  connections.forEach(({ from, to }) => {
    const fromPlace = placeMap.get(from);
    const toPlace = placeMap.get(to);

    if (fromPlace && toPlace) {
      // Get coordinates for direction calculation
      const fromCoords = vertexMap.get(from);
      const toCoords = vertexMap.get(to);

      if (fromCoords && toCoords) {
        // Calculate proper directions
        const forwardDirection = calculateDirection(fromCoords, toCoords);
        const reverseDirection = getOppositeDirection(forwardDirection);

        // Create forward connection (from -> to)
        fromPlace.exits[forwardDirection] = {
          direction: forwardDirection,
          label: `To ${toPlace.name}`,
          to: toPlace.id
        };

        // Create reverse connection (to -> from) for bidirectional connectivity
        toPlace.exits[reverseDirection] = {
          direction: reverseDirection,
          label: `To ${fromPlace.name}`,
          to: fromPlace.id
        };
      } else {
        // Fallback to simple east/west if coordinates not available
        fromPlace.exits[Direction.EAST] = {
          direction: Direction.EAST,
          label: `To ${toPlace.name}`,
        to: toPlace.id
      };

        toPlace.exits[Direction.WEST] = {
          direction: Direction.WEST,
          label: `To ${fromPlace.name}`,
          to: fromPlace.id
        };
}

      successfulConnections++;
    } else {
      console.log(`  FAILED CONNECTION: ${from} -> ${to} (fromPlace: ${!!fromPlace}, toPlace: ${!!toPlace})`);
      failedConnections++;
    }
  });

  console.log(`Successful connections: ${successfulConnections}, Failed: ${failedConnections}`);
}

/**
 * Connect disconnected subgraphs within an ecosystem by growing the graph node-by-node
 * This ensures connectivity while preserving 45-degree angle constraints
 * All disconnected components connect to the eastward delta (easternmost vertices) to maintain west-to-east flow
 */
function connectDisconnectedSubgraphs(
  vertices: WorldVertex[],
  connections: Array<{from: string, to: string}>,
  ecosystem: EcosystemName,
  metrics: SpatialMetrics,
  rng: SeededRandom
): Array<{from: string, to: string}> {
  if (vertices.length === 0) return connections;

  // IMPORTANT: Only work with vertices from the specified ecosystem
  // This prevents bridge vertices from connecting to other ecosystems
  const ecosystemVertices = vertices.filter(v => v.ecosystem === ecosystem);

  if (ecosystemVertices.length === 0) return connections;

  // Find all connected components within this ecosystem only
  const adjacencyMap = new Map<string, Set<string>>();
  ecosystemVertices.forEach(v => adjacencyMap.set(v.id, new Set()));

  // Only include connections between vertices in the same ecosystem
  connections.forEach(conn => {
    const fromVertex = ecosystemVertices.find(v => v.id === conn.from);
    const toVertex = ecosystemVertices.find(v => v.id === conn.to);

    if (fromVertex && toVertex && fromVertex.ecosystem === ecosystem && toVertex.ecosystem === ecosystem) {
      adjacencyMap.get(conn.from)?.add(conn.to);
      adjacencyMap.get(conn.to)?.add(conn.from);
    }
  });

  const visited = new Set<string>();
  const components: string[][] = [];

  const bfs = (startId: string): string[] => {
    const component: string[] = [];
    const queue = [startId];
    visited.add(startId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      const neighbors = adjacencyMap.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return component;
  };

  ecosystemVertices.forEach(v => {
    if (!visited.has(v.id)) {
      const component = bfs(v.id);
      components.push(component);
    }
  });

  console.log(`Found ${components.length} connected components in ${ecosystem.split(':')[2]}`);

  if (components.length <= 1) {
    return connections; // Already connected
  }

  // Find the eastward delta component (easternmost vertices) within the same ecosystem only
  const vertexMap = new Map<string, WorldVertex>();
  ecosystemVertices.forEach(v => vertexMap.set(v.id, v));

  let eastwardDeltaComponent: string[] | null = null;
  let eastmostX = -Infinity;

  for (const component of components) {
    const componentVertices = component.map(id => vertexMap.get(id)!);
    const componentEastmostX = Math.max(...componentVertices.map(v => v.x));

    if (componentEastmostX > eastmostX) {
      eastmostX = componentEastmostX;
      eastwardDeltaComponent = component;
    }
  }

  if (!eastwardDeltaComponent) {
    console.log(`Warning: Could not find eastward delta component, using largest component instead`);
    eastwardDeltaComponent = components.reduce((largest, current) =>
      current.length > largest.length ? current : largest
    );
  }

  console.log(`Eastward delta component has ${eastwardDeltaComponent.length} vertices, connecting all other components to it`);

  // Connect each disconnected component to the eastward delta using grid-aligned paths
  const bridgeConnections = [...connections];
  const newVertices: WorldVertex[] = [...vertices];
  let nextVertexId = Math.max(...vertices.map(v => parseInt(v.id.split('-')[1]) || 0)) + 1;

  for (const component of components) {
    if (component === eastwardDeltaComponent) continue; // Skip the main component

    console.log(`Connecting component (${component.length} vertices) to eastward delta via grid-aligned path`);

    // Find the closest vertex in this component to the eastward delta
    const componentVertices = component.map(id => vertexMap.get(id)!);
    const deltaVertices = eastwardDeltaComponent.map(id => vertexMap.get(id)!);

    let minDistance = Infinity;
    let bestComponentVertex: WorldVertex | null = null;
    let bestDeltaVertex: WorldVertex | null = null;

    for (const compVertex of componentVertices) {
      for (const deltaVertex of deltaVertices) {
        // CRITICAL: Only connect within the same ecosystem
        if (compVertex.ecosystem !== ecosystem || deltaVertex.ecosystem !== ecosystem) {
          continue;
        }

        const distance = Math.sqrt(
          Math.pow(compVertex.x - deltaVertex.x, 2) +
          Math.pow(compVertex.y - deltaVertex.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          bestComponentVertex = compVertex;
          bestDeltaVertex = deltaVertex;
        }
      }
    }

        if (bestComponentVertex && bestDeltaVertex) {
      // For marsh ecosystem, use jungle band for pathfinding since marsh is within jungle
      const pathfindingEcosystem = ecosystem === EcosystemName.MARSH_TROPICAL
        ? EcosystemName.JUNGLE_TROPICAL
        : ecosystem;

      // Create a grid-aligned path between the vertices
      const path = createGridAlignedPath(
        bestComponentVertex,
        bestDeltaVertex,
        pathfindingEcosystem,
        nextVertexId,
        metrics
      );

      // Add new intermediate vertices to our vertex list
      for (const pathVertex of path.intermediateVertices) {
        newVertices.push(pathVertex);
        vertexMap.set(pathVertex.id, pathVertex);
        nextVertexId++;
      }

      // Add the path connections
      bridgeConnections.push(...path.connections);
    }
  }

  // Update the original vertices array (this is a bit of a hack, but maintains the interface)
  vertices.splice(0, vertices.length, ...newVertices);

  console.log(`Total connections after bridge creation: ${bridgeConnections.length}`);
  return bridgeConnections;
}

/**
 * Simple grid-aligned pathfinding that prioritizes diagonal moves first, then orthogonal
 * This is much simpler than DFS and should work for most cases
 * EXPORTED FOR TESTING ONLY - DO NOT USE IN PRODUCTION CODE
 */
export function findGridAlignedPathDFS(
  start: { gridX: number; gridY: number },
  end: { gridX: number; gridY: number },
  ecosystem: EcosystemName,
  metrics: SpatialMetrics,
  occupiedPositions: Set<string>
): Array<{ gridX: number; gridY: number }> {

  const path: Array<{ gridX: number; gridY: number }> = [];
  let currentX = start.gridX;
  let currentY = start.gridY;

  // For debugging
  console.log(`Finding path from (${start.gridX},${start.gridY}) to (${end.gridX},${end.gridY}) in ${ecosystem.split(':')[2]}`);

  let steps = 0;
  const maxSteps = 100; // Prevent infinite loops

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

    // Check if this position is valid
    const nextKey = `${nextX},${nextY}`;

    // Check collision
    if (occupiedPositions.has(nextKey)) {
      console.log(`Path blocked by collision at (${nextX},${nextY})`);
      break; // Can't continue, collision
    }

    // Check ecosystem boundary - but allow within the same ecosystem band
    const nextEcosystem = determineEcosystemFromGridX(nextX, metrics);

    // Convert ecosystems to bands (marsh is part of jungle band)
    const getEcosystemBand = (ecosystem: EcosystemName): string => {
      if (ecosystem === EcosystemName.MARSH_TROPICAL) return 'jungle';
      return ecosystem.split(':')[2];
    };

    const currentBand = getEcosystemBand(ecosystem);
    const nextBand = getEcosystemBand(nextEcosystem);

    if (currentBand !== nextBand) {
      console.log(`Path stopped at ecosystem boundary: ${ecosystem.split(':')[2]} → ${nextEcosystem.split(':')[2]} at (${nextX},${nextY})`);
      break; // Can't continue, boundary crossing
    }

    // Check bounds
    if (nextX < 0 || nextY < 0 || nextX >= metrics.gridWidth || nextY >= metrics.gridHeight) {
      console.log(`Path stopped at world boundary at (${nextX},${nextY})`);
      break; // Can't continue, out of bounds
    }

    // Move to next position
    currentX = nextX;
    currentY = nextY;
    path.push({ gridX: currentX, gridY: currentY });

    steps++;
  }

  if (steps >= maxSteps) {
    console.log(`Path finding exceeded max steps (${maxSteps}), aborting`);
    return []; // Failed due to too many steps
  }

  if (currentX === end.gridX && currentY === end.gridY) {
    console.log(`Path found with ${path.length} steps`);
    return path; // Successfully reached target
  } else {
    console.log(`Path failed to reach target, stopped at (${currentX},${currentY})`);
    return []; // Failed to reach target
  }
}

/**
 * Create a grid-aligned path between two vertices, maintaining 45-degree angles
 * EXPORTED FOR TESTING ONLY - DO NOT USE IN PRODUCTION CODE
 */
export function createGridAlignedPath(
  from: WorldVertex,
  to: WorldVertex,
  _ecosystem: EcosystemName,
  startVertexId: number,
  metrics: SpatialMetrics
): {
  intermediateVertices: WorldVertex[];
  connections: Array<{from: string, to: string}>;
} {
  const intermediateVertices: WorldVertex[] = [];
  const connections: Array<{from: string, to: string}> = [];

  // Determine ecosystem boundaries for the source vertex's ecosystem
  const sourceEcosystem = from.ecosystem;

  // If the target vertex is in a different ecosystem band, we can still create connections within the same band
  // (e.g., marsh is part of jungle band, so connections are allowed)
  const getEcosystemBand = (ecosystem: EcosystemName): string => {
    if (ecosystem === EcosystemName.MARSH_TROPICAL) return 'jungle';
    return ecosystem.split(':')[2]; // Extract ecosystem name (e.g., 'steppe', 'grassland')
  };

  const sourceBand = getEcosystemBand(sourceEcosystem);
  const targetBand = getEcosystemBand(to.ecosystem);

  // Only refuse connections across different ecosystem bands
  if (sourceBand !== targetBand) {
    console.log(`Refusing to create cross-band connection from ${sourceBand} to ${targetBand} - should use bridge mechanism only`);
    return { intermediateVertices, connections }; // Return empty - no connection created
  }

  // Both vertices are in the same ecosystem, so we can create grid-aligned path
  const startGridX = from.gridX;
  const startGridY = from.gridY;
  const endGridX = to.gridX;
  const endGridY = to.gridY;

  // If start and end are the same, no path needed
  if (startGridX === endGridX && startGridY === endGridY) {
    return { intermediateVertices, connections };
  }

  // Build occupancy map to detect collisions (we need to pass existing vertices)
  // For now, we'll assume no collisions, but this is where we'd check
  const occupiedPositions = new Set<string>();
  // TODO: Pass existing vertices and populate occupiedPositions

  // Use DFS pathfinding with backtracking and 45-degree constraint
  const path = findGridAlignedPathDFS(
    { gridX: startGridX, gridY: startGridY },
    { gridX: endGridX, gridY: endGridY },
    sourceEcosystem,
    metrics,
    occupiedPositions
  );

  // If no valid path found, skip connection rather than creating invalid direct connection
  if (path.length === 0) {
    console.log(`No valid grid-aligned path found from (${startGridX},${startGridY}) to (${endGridX},${endGridY}), skipping connection to preserve 45-degree constraint`);
    return { intermediateVertices, connections }; // Return empty - no connection created
  }

  // Create intermediate vertices for the path (excluding start and end)
  let vertexId = startVertexId;
  let prevVertex = from;

  // DFS path includes the end vertex, so we exclude it from intermediate vertices
  for (let i = 0; i < path.length - 1; i++) {
    const pathPoint = path[i];

    // Calculate world coordinates from grid coordinates using same method as existing vertices
    const worldX = metrics.placeMargin + pathPoint.gridX * metrics.placeSpacing;
    const worldY = metrics.placeMargin + pathPoint.gridY * metrics.placeSpacing;

    // All intermediate vertices should have the same ecosystem as the source vertex
    // since DFS respects ecosystem boundaries
    const intermediateVertex: WorldVertex = {
      id: `bridge-${vertexId}`,
      x: worldX,
      y: worldY,
      gridX: pathPoint.gridX,
      gridY: pathPoint.gridY,
      ecosystem: sourceEcosystem,
      placeId: `flux:place:bridge-${vertexId}`
    };

    intermediateVertices.push(intermediateVertex);

    // Connect to the previous vertex
    connections.push({
      from: prevVertex.id,
      to: intermediateVertex.id
    });

    prevVertex = intermediateVertex;
    vertexId++;
  }

  // Connect the last intermediate vertex (or the starting vertex if no intermediates) to the target
  connections.push({
    from: prevVertex.id,
    to: to.id
  });

  return { intermediateVertices, connections };
}

/**
 * Get the column boundary for a specific ecosystem
 * EXPORTED FOR TESTING ONLY - DO NOT USE IN PRODUCTION CODE
 */
export function getEcosystemBoundary(ecosystem: EcosystemName, metrics: SpatialMetrics): { startCol: number; endCol: number } {
  const ecosystems = [
    EcosystemName.STEPPE_ARID,
    EcosystemName.GRASSLAND_TEMPERATE,
    EcosystemName.FOREST_TEMPERATE,
    EcosystemName.MOUNTAIN_ARID,
    EcosystemName.JUNGLE_TROPICAL
  ];

  const totalColumns = metrics.gridWidth;
  const baseColumnsPerEcosystem = Math.floor(totalColumns / ecosystems.length);
  const remainderColumns = totalColumns % ecosystems.length;

  let currentColumn = 0;
  for (let ecosystemIndex = 0; ecosystemIndex < ecosystems.length; ecosystemIndex++) {
    const startCol = currentColumn;
    const columnsForThisEcosystem = baseColumnsPerEcosystem + (ecosystemIndex < remainderColumns ? 1 : 0);
    const endCol = startCol + columnsForThisEcosystem;

    if (ecosystems[ecosystemIndex] === ecosystem) {
      return { startCol, endCol };
    }

    currentColumn = endCol;
  }

  // Fallback for marsh (which is part of jungle)
  if (ecosystem === EcosystemName.MARSH_TROPICAL) {
    return getEcosystemBoundary(EcosystemName.JUNGLE_TROPICAL, metrics);
  }

  // Should not reach here, but return a safe default
  return { startCol: 0, endCol: totalColumns };
}

/**
 * Determine the correct ecosystem for a vertex based on its grid X position
 * This ensures intermediate vertices respect ecosystem band boundaries
 * EXPORTED FOR TESTING ONLY - DO NOT USE IN PRODUCTION CODE
 */
export function determineEcosystemFromGridX(gridX: number, metrics: SpatialMetrics): EcosystemName {
  // Calculate ecosystem boundaries based on the same logic used in generateWorld
  const totalColumns = metrics.gridWidth;
  const baseColumnsPerEcosystem = Math.floor(totalColumns / 5);
  const remainderColumns = totalColumns % 5;

  // Distribute columns across ecosystems (same as in generateWorld)
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

  // Fallback to the last ecosystem if somehow out of bounds
  return EcosystemName.JUNGLE_TROPICAL;
}



/**
 * Process a single ecosystem pair to create inter-ecosystem connectivity
 */
function processEcosystemPair(
  currentEcosystem: EcosystemName,
  nextEcosystem: EcosystemName,
  currentVertices: WorldVertex[],
  nextVertices: WorldVertex[],
  metrics: SpatialMetrics,
  rng: SeededRandom,
  globalBranchingFactor?: number
): {
  intersectionNodes: WorldVertex[];
  deltaConnections: Array<{from: string, to: string}>;
  connectedVertices: WorldVertex[];
  connectedConnections: Array<{from: string, to: string}>;
} {
  console.log(`\n=== PROCESSING ECOSYSTEM PAIR: ${currentEcosystem.split(':')[2]} → ${nextEcosystem.split(':')[2]} ===`);

  // IMPORTANT: Save original vertices before creating bridge vertices
  // We'll only use original vertices for inter-ecosystem connections
  const originalCurrentVertices = [...currentVertices];

  // 1. Generate eastward delta from current ecosystem's western origin
  console.log(`Generating eastward delta from ${currentEcosystem.split(':')[2]}...`);
  const eastwardEdges = generateEastwardDeltaEdges(currentEcosystem, currentVertices, metrics, rng, globalBranchingFactor);
  console.log(`Generated ${eastwardEdges.length} eastward edges`);

  // Analyze eastward delta spanning
  analyzeDeltaSpanning(currentEcosystem, currentVertices, eastwardEdges, 'eastward');

  // 2. Convert delta edges to connections
  const deltaConnections: Array<{from: string, to: string}> = eastwardEdges.map(edge => ({
    from: edge.from.id,
    to: edge.to.id
  }));

  console.log(`Created ${deltaConnections.length} delta connections`);

  // 3. Connect disconnected subgraphs instead of dropping them
  // NOTE: This modifies currentVertices to include new bridge vertices
  console.log(`Connecting disconnected subgraphs in ${currentEcosystem.split(':')[2]}...`);
  const intraEcosystemConnections = connectDisconnectedSubgraphs(currentVertices, deltaConnections, currentEcosystem, metrics, rng);
  console.log(`Connected: ${currentVertices.length} vertices preserved with ${intraEcosystemConnections.length} total connections`);

  // 4. Next ecosystem vertices are used as-is for bridging (they'll be connected when they become current)
  const cleanedNextVertices = nextVertices;
  console.log(`Next ecosystem vertices for bridging: ${cleanedNextVertices.length}`);

  // 5. Create inter-ecosystem bridge connections between main components
  // CRITICAL: Use ORIGINAL vertices only (not bridge vertices) for inter-ecosystem connections
  console.log(`Creating inter-ecosystem bridge connections...`);
  const bridgeConnections: Array<{from: string, to: string}> = [];
  let bridgeVertices: WorldVertex[] = []; // Collect bridge vertices for later inclusion

  if (originalCurrentVertices.length > 0 && cleanedNextVertices.length > 0) {
    // Find the origin of the NEXT ecosystem's delta (as per user specification)
    const nextDeltaOrigin = findDeltaOrigin(cleanedNextVertices, nextEcosystem, metrics);
    if (!nextDeltaOrigin) {
      console.warn(`Warning: Could not find origin for next ecosystem delta. Cannot create bridge.`);
      return {
        intersectionNodes: [],
        deltaConnections,
        connectedVertices: [...currentVertices, ...cleanedNextVertices],
        connectedConnections: [...intraEcosystemConnections]
      };
  }

    // Find the easternmost node in the ORIGINAL current ecosystem vertices to the next ecosystem's origin
    // This ensures bridges start from the proper easternmost column
    const easternmostNodeToOrigin = findEasternmostNodeToOrigin(originalCurrentVertices, currentEcosystem, metrics);
    if (!easternmostNodeToOrigin) {
      console.warn(`Warning: Could not find a node in current ecosystem to bridge to next origin. Cannot create bridge.`);
      return {
        intersectionNodes: [],
        deltaConnections,
        connectedVertices: [...currentVertices, ...cleanedNextVertices],
        connectedConnections: [...intraEcosystemConnections]
      };
  }

        // Use the new createBridge function which allows cross-ecosystem connections
    console.log(`Creating inter-ecosystem bridge from ${easternmostNodeToOrigin.id} (${easternmostNodeToOrigin.ecosystem.split(':')[2]}) to ${nextDeltaOrigin.id} (${nextDeltaOrigin.ecosystem.split(':')[2]})`);

    // Generate a unique vertex ID for any intermediate bridge vertices
    const bridgeVertexId = Math.floor(Math.random() * 1000000);

    const bridgeResult = createBridge(
      easternmostNodeToOrigin,
      nextDeltaOrigin,
      bridgeVertexId,
      metrics,
      [...currentVertices, ...cleanedNextVertices], // Pass existing vertices for collision detection
      { allowCrossEcosystem: true } // Policy explicitly allows cross-ecosystem bridges
    );

    // Collect bridge vertices and connections for later inclusion
    if (bridgeResult.success) {
      // Collect intermediate bridge vertices
      bridgeVertices = bridgeResult.intermediateVertices;
      // Add step-by-step bridge connections
      bridgeConnections.push(...bridgeResult.connections);

      console.log(`✅ Successfully created inter-ecosystem bridge: ${bridgeResult.intermediateVertices.length} intermediate vertices, ${bridgeResult.connections.length} connections`);
      console.log(`Bridge distance: ${Math.round(nextDeltaOrigin.x - easternmostNodeToOrigin.x)}m`);
    } else {
      console.log(`❌ Failed to create inter-ecosystem bridge: ${bridgeResult.reason}`);
    }
  } else {
    console.log(`Warning: Cannot create bridge - one ecosystem has no vertices after cleanup`);
  }

  // 6. Combine ALL vertices (including bridge vertices) and all connections
  const connectedVertices = [...currentVertices, ...cleanedNextVertices, ...bridgeVertices];
  const connectedConnections = [...intraEcosystemConnections, ...bridgeConnections];

  console.log(`Pair result: ${connectedVertices.length} vertices, ${connectedConnections.length} connections`);
  console.log(`=== ECOSYSTEM PAIR COMPLETE ===\n`);

  return {
    intersectionNodes: [], // No intersection nodes with direct bridging
    deltaConnections,
    connectedVertices,
    connectedConnections
  };
}

/**
 * Create places from vertices, preserving their spatial and ecological information
 */
function createPlacesFromVertices(vertices: WorldVertex[]): Place[] {
  return vertices.map((vertex): Place => {
    const placeId: PlaceURN = `flux:place:${vertex.id}`; // Use canonical URN format

    return createPlace({ id: placeId }, (place) => {
      return {
        ...place,
        name: generatePlaceName(vertex.ecosystem, vertex.id),
        description: generatePlaceDescription(vertex.ecosystem),
        ecology: {
          ecosystem: vertex.ecosystem,
          // Use the ecosystem profile for default values
          temperature: ECOSYSTEM_PROFILES[vertex.ecosystem].temperature,
          pressure: ECOSYSTEM_PROFILES[vertex.ecosystem].pressure,
          humidity: ECOSYSTEM_PROFILES[vertex.ecosystem].humidity
        },
        // TODO: add sensible `weather`
        exits: {
          // Start with empty exits - they'll be populated by addExitsToPlaces
        }
      };
    });
  });
}



/**
 * Diagnostic function to analyze delta spanning behavior
 */
function analyzeDeltaSpanning(
  ecosystem: EcosystemName,
  vertices: WorldVertex[],
  edges: DeltaEdge[],
  direction: 'eastward' | 'westward'
): void {
  if (vertices.length === 0) {
    console.log(`  ${direction} delta spanning: No vertices in ecosystem`);
    return;
  }

  // Calculate ecosystem bounds
  const minGridX = Math.min(...vertices.map(v => v.gridX));
  const maxGridX = Math.max(...vertices.map(v => v.gridX));
  const ecosystemWidth = maxGridX - minGridX + 1;

  // Find source vertices (vertices that have outgoing edges)
  const sourceVertexIds = new Set(edges.map(e => e.from.id));
  const sourceVertices = vertices.filter(v => sourceVertexIds.has(v.id));

  if (sourceVertices.length === 0) {
    console.log(`  ${direction} delta spanning: No source vertices found`);
    return;
  }

  // Calculate source distribution
  const sourceMinGridX = Math.min(...sourceVertices.map(v => v.gridX));
  const sourceMaxGridX = Math.max(...sourceVertices.map(v => v.gridX));
  const sourceSpan = sourceMaxGridX - sourceMinGridX + 1;

  // Calculate target vertices (vertices that are targets of edges)
  const targetVertexIds = new Set(edges.map(e => e.to.id));
  const targetVertices = vertices.filter(v => targetVertexIds.has(v.id));

  let targetSpan = 0;
  let targetMinGridX = 0;
  let targetMaxGridX = 0;

  if (targetVertices.length > 0) {
    targetMinGridX = Math.min(...targetVertices.map(v => v.gridX));
    targetMaxGridX = Math.max(...targetVertices.map(v => v.gridX));
    targetSpan = targetMaxGridX - targetMinGridX + 1;
  }

  console.log(`  ${direction} delta spanning analysis for ${ecosystem.split(':')[2]}:`);
  console.log(`    Ecosystem: columns ${minGridX}-${maxGridX} (width: ${ecosystemWidth})`);
  console.log(`    Sources: columns ${sourceMinGridX}-${sourceMaxGridX} (span: ${sourceSpan}/${ecosystemWidth})`);
  console.log(`    Targets: columns ${targetMinGridX}-${targetMaxGridX} (span: ${targetSpan}/${ecosystemWidth})`);
  console.log(`    Edges: ${edges.length}`);

  // Check if spanning is adequate


  if (direction === 'eastward') {
    // Eastward should start from western edge
    const startsFromWest = sourceMinGridX === minGridX;
    const reachesEast = targetMaxGridX >= minGridX + Math.floor(ecosystemWidth * 0.7);
    console.log(`    ✓ Eastward quality: starts from west=${startsFromWest}, reaches east=${reachesEast}`);
  } else {
    // Westward should start from eastern edge
    const startsFromEast = sourceMaxGridX === maxGridX;
    const reachesWest = targetMinGridX <= maxGridX - Math.floor(ecosystemWidth * 0.7);
    console.log(`    ✓ Westward quality: starts from east=${startsFromEast}, reaches west=${reachesWest}`);
  }
}

/**
 * Find the origin of an ecosystem's delta - the westernmost node at the standard origin y-coordinate
 */
function findDeltaOrigin(
  vertices: WorldVertex[],
  _ecosystem: EcosystemName,
  metrics: SpatialMetrics
): WorldVertex | undefined {
  if (vertices.length === 0) return undefined;

  // All delta origins are vertically aligned at the middle of the world height
  const originY = metrics.worldHeightMeters / 2;
  const tolerance = metrics.placeSpacing / 2; // Allow some tolerance for grid alignment

  // Find vertices near the origin y-coordinate
  const originCandidates = vertices.filter(v =>
    Math.abs(v.y - originY) <= tolerance
  );

  if (originCandidates.length === 0) {
    // Fallback: find the vertex closest to the origin y-coordinate
    const closestToOriginY = vertices.reduce((closest, vertex) =>
      Math.abs(vertex.y - originY) < Math.abs(closest.y - originY) ? vertex : closest
    );
    return closestToOriginY;
  }

  // Among candidates at the origin y-coordinate, find the westernmost (leftmost)
  const origin = originCandidates.reduce((westmost, vertex) =>
    vertex.x < westmost.x ? vertex : westmost
  );

  return origin;
}



/**
 * Find the closest node in the easternmost column of the ecosystem for bridge creation
 * This ensures bridges always start from the proper easternmost column
 */
function findEasternmostNodeToOrigin(
  currentVertices: WorldVertex[],
  ecosystem: EcosystemName,
  metrics: SpatialMetrics
): WorldVertex | undefined {
  if (currentVertices.length === 0) return undefined;

  // Get ecosystem boundary to find easternmost column
  const boundary = getEcosystemBoundary(ecosystem, metrics);
  const easternmostCol = boundary.endCol - 1; // Last column of ecosystem

  // Filter vertices to only those in the easternmost column
  const easternmostVertices = currentVertices.filter(v => v.gridX === easternmostCol);

  if (easternmostVertices.length === 0) {
    console.warn(`Warning: No vertices found in easternmost column ${easternmostCol} for ${ecosystem}`);
    return undefined;
  }

  // Among easternmost vertices, find the one closest to vertical center (best bridge placement)
  const verticalCenter = Math.floor(metrics.gridHeight / 2);
  const verticesWithCenterDistance = easternmostVertices.map(vertex => ({
    vertex,
    centerDistance: Math.abs(vertex.gridY - verticalCenter)
  }));

  // Find minimum distance from center
  const minCenterDistance = Math.min(...verticesWithCenterDistance.map(vd => vd.centerDistance));

  // Get all vertices with minimum center distance
  const bestVertices = verticesWithCenterDistance
    .filter(vd => vd.centerDistance === minCenterDistance)
    .map(vd => vd.vertex);

  // Return the first one (deterministic selection)
  return bestVertices[0];
}

/**
 * Main spatial river delta world generation function
 */
export function generateWorld(config: WorldGenerationConfig): WorldGenerationResult {
  const rng = new SeededRandom(config.seed || 42);

  // Calculate world metrics using the helper function
  const metrics = calculateSpatialMetrics(config);

  console.log(`Generating world: ${metrics.worldWidthMeters/1000}km × ${metrics.worldHeightMeters/1000}km`);
  console.log(`Grid: ${metrics.gridWidth} × ${metrics.gridHeight} (${metrics.gridWidth * metrics.gridHeight} potential places)`);

  // Define west-to-east ecosystem progression using flux URNs (5 main ecosystems)
  const ecosystems: EcosystemName[] = [
    EcosystemName.STEPPE_ARID,
    EcosystemName.GRASSLAND_TEMPERATE,
    EcosystemName.FOREST_TEMPERATE,
    EcosystemName.MOUNTAIN_ARID,
    EcosystemName.JUNGLE_TROPICAL
    // MARSH_TROPICAL will be assigned to eastern boundary places post-generation
  ];

  // Calculate columns per ecosystem (dividing by 5 instead of 6)
  const totalColumns = metrics.gridWidth;
  const baseColumnsPerEcosystem = Math.floor(totalColumns / ecosystems.length);
  const remainderColumns = totalColumns % ecosystems.length;

  console.log(`Distributing ${totalColumns} columns across ${ecosystems.length} ecosystems`);

  // Generate places for each ecosystem using spatial grid approach
  let currentColumn = 0;
  const ecosystemBoundaries: Array<{
    ecosystem: EcosystemName;
    startX: number;
    endX: number;
    startY: number;
    endY: number;
    columns: number;
  }> = [];

  const verticesByEcosystem = new Map<EcosystemName, WorldVertex[]>();

  ecosystems.forEach((ecosystem, ecosystemIndex) => {
    const startCol = currentColumn;
    const columnsForThisEcosystem = baseColumnsPerEcosystem + (ecosystemIndex < remainderColumns ? 1 : 0);
    const endCol = startCol + columnsForThisEcosystem;
    currentColumn = endCol;

    // Calculate world boundaries for this ecosystem
    const startX = metrics.placeMargin + startCol * metrics.placeSpacing;
    const endX = metrics.placeMargin + endCol * metrics.placeSpacing;
    const startY = metrics.placeMargin;
    const endY = metrics.worldHeightMeters - metrics.placeMargin;

    ecosystemBoundaries.push({
      ecosystem,
      startX,
      endX,
      startY,
      endY,
      columns: columnsForThisEcosystem
    });

    console.log(`${ecosystem.split(':')[2]}: columns ${startCol}-${endCol-1} (${columnsForThisEcosystem} cols), world X: ${startX/1000}km - ${endX/1000}km`);

    const ecosystemVertices: WorldVertex[] = [];

    // Create river delta pattern within this ecosystem's spatial bounds
    for (let col = startCol; col < endCol; col++) {
      for (let row = 0; row < metrics.gridHeight; row++) {
        // Calculate probability based on ecosystem connectivity target and delta shape
        let placeProbability = 0.3; // Base probability

        // Uniform probability across all ecosystems for consistent connectivity
        placeProbability = 0.5; // 50% probability for all ecosystems

        // Add river delta flow pattern using golden ratio proportions
        const verticalCenter = metrics.gridHeight / 2;
        const verticalDistanceFromCenter = Math.abs(row - verticalCenter) / verticalCenter;

        // Use golden ratio to create natural flow concentration
        const flowBonus = (1 - Math.pow(verticalDistanceFromCenter, INVERSE_GOLDEN_RATIO)) * 0.3;

        // Golden ratio eastward flow gradient
        const eastwardProgress = (col - startCol) / (endCol - startCol);
        const eastwardBonus = Math.pow(eastwardProgress, INVERSE_GOLDEN_RATIO) * 0.2;

        placeProbability += flowBonus + eastwardBonus;
        placeProbability = Math.min(0.8, placeProbability); // Cap at 80%

        if (rng.next() < placeProbability) {
          // Calculate world position from grid coordinates - snap to 8-directional grid
          const worldX = metrics.placeMargin + col * metrics.placeSpacing;
          const worldY = metrics.placeMargin + row * metrics.placeSpacing;

          const vertexId = generateVertexId(rng);
          const placeId = `flux:place:${vertexId}`;

          const vertex: WorldVertex = {
            id: vertexId,
            x: worldX,
            y: worldY,
            gridX: col,
            gridY: row,
            ecosystem: ecosystem,
            placeId: placeId
          };

          ecosystemVertices.push(vertex);
        }
      }
    }

    verticesByEcosystem.set(ecosystem, ecosystemVertices);
    console.log(`Generated ${ecosystemVertices.length} vertices for ${ecosystem.split(':')[2]}`);
  });

  // Process ecosystem pairs using the new per-pair approach
  console.log('\n=== STARTING PER-ECOSYSTEM PAIR PROCESSING ===');

  let allVertices: WorldVertex[] = [];
  let allConnections: Array<{from: string, to: string}> = [];

  // Process each ecosystem pair, using cleaned vertices from previous steps
  for (let i = 0; i < ecosystems.length - 1; i++) {
    const currentEcosystem = ecosystems[i];
    const nextEcosystem = ecosystems[i + 1];
    const currentVertices = verticesByEcosystem.get(currentEcosystem)!;
    const nextVertices = verticesByEcosystem.get(nextEcosystem)!;

    const pairResult = processEcosystemPair(
      currentEcosystem,
      nextEcosystem,
      currentVertices,
      nextVertices,
      metrics,
      rng,
      config.globalBranchingFactor
    );

    // UPDATE: Store cleaned vertices back in the ecosystem map for next iteration
    // This ensures each ecosystem uses the cleaned vertices from the previous step
    const cleanedCurrentVertices = pairResult.connectedVertices.filter(v => v.ecosystem === currentEcosystem);
    const cleanedNextVertices = pairResult.connectedVertices.filter(v => v.ecosystem === nextEcosystem);

    verticesByEcosystem.set(currentEcosystem, cleanedCurrentVertices);
    verticesByEcosystem.set(nextEcosystem, cleanedNextVertices);

    // Accumulate results from this pair
    // Note: We need to avoid duplicating vertices that appear in multiple pairs
    const existingVertexIds = new Set(allVertices.map(v => v.id));
    const newVertices = pairResult.connectedVertices.filter(v => !existingVertexIds.has(v.id));

    allVertices.push(...newVertices);
    allConnections.push(...pairResult.connectedConnections);

    // Debug: Log bridge connections specifically
    const bridgeConnections = pairResult.connectedConnections.filter(conn =>
      pairResult.connectedVertices.some(v => v.id === conn.from && v.ecosystem === currentEcosystem) &&
      pairResult.connectedVertices.some(v => v.id === conn.to && v.ecosystem === nextEcosystem)
    );
    console.log(`DEBUG: Added ${bridgeConnections.length} bridge connections for ${currentEcosystem.split(':')[2]}-${nextEcosystem.split(':')[2]}`);
  }

  // CRITICAL FIX: Process the final ecosystem for internal connectivity
  // The pair processing loop only handles n-1 ecosystems, leaving the last one unprocessed
  const finalEcosystem = ecosystems[ecosystems.length - 1];
  const finalEcosystemVertices = verticesByEcosystem.get(finalEcosystem)!;

  if (finalEcosystemVertices.length > 0) {
    console.log(`\n=== PROCESSING FINAL ECOSYSTEM: ${finalEcosystem.split(':')[2]} ===`);
    console.log(`Generating dense mesh connectivity for final ecosystem...`);

    // Generate dense mesh connectivity for the final ecosystem
    const finalEcosystemEdges = generateDenseEcosystemConnectivity(
      finalEcosystem,
      finalEcosystemVertices,
      metrics,
      rng,
      config.globalBranchingFactor
    );

    // Convert to connections
    const finalEcosystemConnections = finalEcosystemEdges.map(edge => ({
      from: edge.from.id,
      to: edge.to.id
    }));

    // If the two river deltas don't intersect, force a connection between them
    console.log(`Connecting disconnected subgraphs in final ecosystem...`);
    const connectedFinalConnections = connectDisconnectedSubgraphs(
      finalEcosystemVertices,
      finalEcosystemConnections,
      finalEcosystem,
      metrics,
      rng
    );

    // Update the ecosystem map with all vertices (no vertices dropped)
    verticesByEcosystem.set(finalEcosystem, finalEcosystemVertices);

    // Add to overall results
  const existingVertexIds = new Set(allVertices.map(v => v.id));
    const newFinalVertices = finalEcosystemVertices.filter(v => !existingVertexIds.has(v.id));

    allVertices.push(...newFinalVertices);
    allConnections.push(...connectedFinalConnections);

    console.log(`Final ecosystem processed: ${finalEcosystemVertices.length} vertices, ${connectedFinalConnections.length} connections`);
    console.log(`=== FINAL ECOSYSTEM COMPLETE ===\n`);
  }

  console.log(`\n=== FINAL RESULT: ${allVertices.length} vertices, ${allConnections.length} connections ===`);

  // Debug: Analyze final connections by ecosystem pairs and track bridge vertices
  const connectionsByEcosystem = new Map<string, number>();
  const bridgeVertexIds = new Set<string>();

  allConnections.forEach(conn => {
    const fromVertex = allVertices.find(v => v.id === conn.from);
    const toVertex = allVertices.find(v => v.id === conn.to);
    if (fromVertex && toVertex) {
      if (fromVertex.ecosystem !== toVertex.ecosystem) {
        const key = `${fromVertex.ecosystem.split(':')[2]}-${toVertex.ecosystem.split(':')[2]}`;
        connectionsByEcosystem.set(key, (connectionsByEcosystem.get(key) || 0) + 1);

        // Mark these vertices as bridge vertices - don't reassign to marsh
        bridgeVertexIds.add(fromVertex.id);
        bridgeVertexIds.add(toVertex.id);
      }
    }
  });

  console.log(`DEBUG: Inter-ecosystem connections:`, Object.fromEntries(connectionsByEcosystem));
  console.log(`DEBUG: Bridge vertices to preserve: ${bridgeVertexIds.size}`);

  // NO GLOBAL CLEANUP: If connectDisconnectedSubgraphs works correctly per-ecosystem,
  // then there should be zero orphaned subgraphs. Dropping vertices would be a bug.
  console.log('\n=== FINAL VERTEX COUNT ===');
  console.log(`Final result: ${allVertices.length} vertices, ${allConnections.length} connections`);

  const finalVertices = allVertices;
  const finalConnections = allConnections;

  // Create places from cleaned vertices
  const places = createPlacesFromVertices(finalVertices);

  // TRUST THE PROCESS: Use ALL connections without any filtering
  console.log(`Using all ${finalConnections.length} connections without filtering`);

  // Add exits based on ALL connections
  addExitsToPlaces(places, finalConnections, finalVertices);

  // TRUE POST-PROCESSING: Assign MARSH_TROPICAL to eastern boundary places
  // This happens AFTER all connectivity is established, so marsh vertices inherit jungle connectivity
  console.log('\n=== ASSIGNING MARSH ECOSYSTEM TO EASTERN BOUNDARY (TRUE POST-PROCESSING) ===');

  // Find the Jungle ecosystem boundaries
  const jungleEcosystem = EcosystemName.JUNGLE_TROPICAL;
  const jungleVertices = finalVertices.filter(v => v.ecosystem === jungleEcosystem);

  if (jungleVertices.length === 0) {
    console.log('No jungle vertices found for marsh assignment');
  } else {
    // Find the easternmost column within the Jungle ecosystem only
    const jungleMaxGridX = Math.max(...jungleVertices.map(v => v.gridX));

    let marshVerticesCount = 0;

    finalVertices.forEach(vertex => {
      // Assign marsh ecosystem to vertices at the easternmost column of the Jungle ecosystem only
      // AND do not reassign vertices that are part of inter-ecosystem bridges
      if (vertex.ecosystem === jungleEcosystem &&
          vertex.gridX === jungleMaxGridX &&
          !bridgeVertexIds.has(vertex.id)) {
        vertex.ecosystem = EcosystemName.MARSH_TROPICAL;
        marshVerticesCount++;
      }
    });

    console.log(`Assigned ${marshVerticesCount} vertices to marsh ecosystem within jungle's eastern boundary`);
    console.log(`Jungle easternmost column: ${jungleMaxGridX}`);
    console.log(`Preserved ${bridgeVertexIds.size} bridge vertices from reassignment`);
    console.log(`Marsh vertices inherit connectivity from their jungle vertex state`);
  }

  console.log(`Generated ${finalVertices.length} places in ${metrics.worldWidthMeters/1000}km × ${metrics.worldHeightMeters/1000}km world`);

  // Debug: Analyze connectivity after exit creation
  const ecosystemConnectivity = calculateEcosystemConnectivity(places, finalVertices);
  console.log('Ecosystem connectivity stats:', ecosystemConnectivity);

  // Debug: Check specific ecosystem connections
  Object.entries(ecosystemConnectivity).forEach(([ecosystem, stats]) => {
    const targetConnections = getTargetConnections(ecosystem);
    if (targetConnections > 0) {
      console.log(`${ecosystem}: ${stats.avgConnections.toFixed(2)} connections (target: ${targetConnections})`);
    }
  });

  return {
    places: places as any, // TODO: Fix Place type import from flux-game
    vertices: finalVertices,
    connections: {
      total: finalConnections.length,
      reciprocal: finalConnections.length // For now, assume all connections are reciprocal
    },
    config,
    ecosystemBoundaries: ecosystemBoundaries
  };
}

// Helper function to calculate target connections per ecosystem
function getTargetConnections(ecosystem: string): number {
  switch (ecosystem) {
    case 'flux:eco:steppe:arid': return 4;
    case 'flux:eco:grassland:temperate': return 3.2;
    case 'flux:eco:forest:temperate': return 2.8;
    case 'flux:eco:mountain:arid': return 2.4;
    case 'flux:eco:jungle:tropical': return 2.8;
    case 'flux:eco:marsh:tropical': return 2;
    default: return 0;
  }
}

// Helper function to calculate ecosystem connectivity (moving from test file)
function calculateEcosystemConnectivity(places: any[], vertices?: any[]): Record<string, { count: number; avgConnections: number }> {
  const ecosystemStats: Record<string, { totalConnections: number; placeCount: number }> = {};

  // Create mapping from place ID to ecosystem if vertices are provided
  let placeToEcosystem: Map<string, string> | undefined;
  if (vertices) {
    placeToEcosystem = new Map();
    vertices.forEach(vertex => {
      placeToEcosystem!.set(vertex.placeId, vertex.ecosystem);
    });
  }

  for (const place of places) {
    // Get ecosystem from place ecology (test places) or vertex mapping (real places)
    const ecosystem = (place as any).ecology?.ecosystem ||
                      (placeToEcosystem?.get(place.id)) ||
                      'unknown';

    if (!ecosystemStats[ecosystem]) {
      ecosystemStats[ecosystem] = { totalConnections: 0, placeCount: 0 };
    }
    ecosystemStats[ecosystem].totalConnections += Object.keys(place.exits || {}).length;
    ecosystemStats[ecosystem].placeCount++;
  }

  const result: Record<string, { count: number; avgConnections: number }> = {};
  for (const [ecosystem, stats] of Object.entries(ecosystemStats)) {
    result[ecosystem] = {
      count: stats.placeCount,
      avgConnections: stats.totalConnections / stats.placeCount
    };
  }

  return result;
}
