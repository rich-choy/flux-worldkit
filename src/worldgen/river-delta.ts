/**
 * River Delta World Generation
 * Simple dendritic branching patterns that flow west to east across ecosystem bands
 */

// import type { Place } from 'flux-game';
import type {
    WorldGenerationConfig,
    WorldGenerationResult,
    WorldVertex
} from './types';
import { ECOSYSTEM_PROFILES, EcosystemName } from './types';

// Minimal Place type for now
type Place = {
  id: string;
  exits: Record<string, { direction: string; to: string }>;
  entities: Record<string, any>;
  ecology: any;
  weather: any;
  name: string;
  description: string;
};

interface DeltaNode {
  id: string;
  x: number;
  y: number;
  ecosystem: EcosystemName;
  children: DeltaNode[];
  parent?: DeltaNode;
}

interface DeltaConfig {
  ecosystem: EcosystemName;
  bandStart: number;
  bandEnd: number;
  branchingFactor: number;  // How many children per node
  maxDepth: number;         // How many levels deep
  verticalSpread: number;   // How much vertical variation
}

/**
 * Simple seeded random number generator
 */
class SeededRandom {
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
  scaleFactor: number = 1.0
): Omit<DeltaConfig, 'ecosystem' | 'bandStart' | 'bandEnd'> {
  const baseConfigs = {
    'flux:eco:steppe:arid': {
      branchingFactor: 3,    // Dense branching for open terrain
      maxDepth: 4,           // Deep delta networks
      verticalSpread: 0.8    // Wide vertical spread
    },
    'flux:eco:grassland:temperate': {
      branchingFactor: 3,    // Dense branching for open terrain
      maxDepth: 4,           // Deep delta networks
      verticalSpread: 0.7    // Wide vertical spread
    },
    'flux:eco:forest:temperate': {
      branchingFactor: 2,    // Moderate branching
      maxDepth: 3,           // Moderate depth
      verticalSpread: 0.6    // Moderate spread
    },
    'flux:eco:mountain:arid': {
      branchingFactor: 1,    // Sparse branching for difficult terrain
      maxDepth: 2,           // Shallow networks
      verticalSpread: 0.4    // Limited spread
    },
    'flux:eco:jungle:tropical': {
      branchingFactor: 2,    // Moderate branching
      maxDepth: 3,           // Moderate depth
      verticalSpread: 0.5    // Moderate spread
    },
    'flux:eco:marsh:tropical': {
      branchingFactor: 1,    // Sparse branching for difficult terrain
      maxDepth: 2,           // Shallow networks
      verticalSpread: 0.3    // Limited spread
    }
  };

  const baseConfig = baseConfigs[ecosystem] || baseConfigs['flux:eco:grassland:temperate'];

  // Scale the configuration based on desired world size
  // Increase depth and branching to generate more places
  const scaledDepth = Math.max(2, Math.min(6, Math.round(baseConfig.maxDepth * scaleFactor)));
  const scaledBranching = Math.max(1, Math.min(4, Math.round(baseConfig.branchingFactor * scaleFactor)));

  return {
    branchingFactor: scaledBranching,
    maxDepth: scaledDepth,
    verticalSpread: baseConfig.verticalSpread
  };
}

/**
 * Generate a river delta for a single ecosystem
 */
function generateEcosystemDelta(
  config: DeltaConfig,
  rng: SeededRandom,
  worldHeight: number = 600
): DeltaNode {
  const deltaConfig = getDeltaConfig(config.ecosystem);

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

/**
 * Recursively generate branches for a delta
 */
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
 * Convert delta tree to flat arrays of vertices and connections
 */
function flattenDelta(delta: DeltaNode): { vertices: WorldVertex[], connections: Array<{from: string, to: string}> } {
  const vertices: WorldVertex[] = [];
  const connections: Array<{from: string, to: string}> = [];

  function traverse(node: DeltaNode): void {
    // Add vertex
    vertices.push({
      id: node.id,
      x: node.x,
      y: node.y,
      ecosystem: node.ecosystem
    });

    // Add connections to children
    for (const child of node.children) {
      connections.push({
        from: node.id,
        to: child.id
      });
      traverse(child);
    }
  }

  traverse(delta);
  return { vertices, connections };
}

/**
 * Create places from delta vertices
 */
function createPlacesFromVertices(vertices: WorldVertex[]): Place[] {
  return vertices.map(vertex => ({
    id: `flux:place:${vertex.ecosystem.split(':')[2]}:${vertex.id}`,
    exits: {},
    entities: {},
    ecology: ECOSYSTEM_PROFILES[vertex.ecosystem],
    weather: {
      temperature: 20,
      pressure: 1013,
      humidity: 60,
      precipitation: 0,
      ppfd: 800,
      clouds: 30,
      ts: Date.now(),
      timescale: 1
    },
    name: generatePlaceName(vertex.ecosystem, vertex.id),
    description: generatePlaceDescription(vertex.ecosystem)
  }));
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
 * Add exits to places based on connections
 */
function addExitsToPlaces(places: Place[], connections: Array<{from: string, to: string}>): void {
  const placeMap = new Map<string, Place>();

  // Build lookup map
  places.forEach(place => {
    const vertexId = place.id.split(':').pop();
    if (vertexId) {
      placeMap.set(vertexId, place);
    }
  });

  // Add exits
  connections.forEach(({ from, to }) => {
    const fromPlace = placeMap.get(from);
    const toPlace = placeMap.get(to);

    if (fromPlace && toPlace) {
      // Simple directional logic - eastward connections are "east"
      const direction = fromPlace.id < toPlace.id ? 'east' : 'west';

      fromPlace.exits[direction] = {
        direction: direction as any,
        to: toPlace.id
      };
    }
  });
}

/**
 * Main river delta world generation function
 */
export function generateWorld(config: WorldGenerationConfig): WorldGenerationResult {
  const rng = new SeededRandom(config.seed || 42);

  // Define ecosystem bands (west to east)
  const ecosystems: EcosystemName[] = [
    EcosystemName.STEPPE_ARID,
    EcosystemName.GRASSLAND_TEMPERATE,
    EcosystemName.FOREST_TEMPERATE,
    EcosystemName.MOUNTAIN_ARID,
    EcosystemName.JUNGLE_TROPICAL
  ];

  const worldWidth = 1000;
  const worldHeight = 600;
  const bandWidth = worldWidth / ecosystems.length;

  let allVertices: WorldVertex[] = [];
  let allConnections: Array<{from: string, to: string}> = [];
  let lastEasternNodes: DeltaNode[] = [];

  // Generate delta for each ecosystem
  ecosystems.forEach((ecosystem, index) => {
    const deltaConfig: DeltaConfig = {
      ecosystem,
      bandStart: index * bandWidth,
      bandEnd: (index + 1) * bandWidth,
      ...getDeltaConfig(ecosystem)
    };

    const delta = generateEcosystemDelta(deltaConfig, rng, worldHeight);
    const { vertices, connections } = flattenDelta(delta);

    allVertices.push(...vertices);
    allConnections.push(...connections);

    // Find easternmost nodes for inter-ecosystem connections
    const easternNodes = findEasternmostNodes(delta);

    // Connect to previous ecosystem's eastern nodes
    if (lastEasternNodes.length > 0) {
      const bridgeConnections = createInterEcosystemBridges(lastEasternNodes, easternNodes, rng);
      allConnections.push(...bridgeConnections);
    }

    lastEasternNodes = easternNodes;
  });

  // Create places from vertices
  const places = createPlacesFromVertices(allVertices);

  // Add exits based on connections
  addExitsToPlaces(places, allConnections);

  return {
    places,
    vertices: allVertices,
    connections: {
      total: allConnections.length,
      reciprocal: allConnections.length // For now, assume all connections are reciprocal
    },
    config
  };
}

/**
 * Find easternmost nodes in a delta
 */
function findEasternmostNodes(delta: DeltaNode): DeltaNode[] {
  const easternNodes: DeltaNode[] = [];

  function traverse(node: DeltaNode): void {
    if (node.children.length === 0) {
      // This is a leaf node (easternmost)
      easternNodes.push(node);
    }

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(delta);
  return easternNodes;
}

/**
 * Create bridges between ecosystems
 */
function createInterEcosystemBridges(
  westernNodes: DeltaNode[],
  easternNodes: DeltaNode[],
  rng: SeededRandom
): Array<{from: string, to: string}> {
  const bridges: Array<{from: string, to: string}> = [];

  // Create at least one bridge, up to min(westernNodes.length, easternNodes.length)
  const bridgeCount = Math.max(1, Math.min(westernNodes.length, easternNodes.length));

  for (let i = 0; i < bridgeCount; i++) {
    const westernNode = westernNodes[i % westernNodes.length];
    const easternNode = easternNodes[i % easternNodes.length];

    bridges.push({
      from: westernNode.id,
      to: easternNode.id
    });
  }

  return bridges;
}
