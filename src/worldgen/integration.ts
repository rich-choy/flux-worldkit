/**
 * World generation integration layer
 * Maps pure geometric Lichtenberg figures to world-specific concepts
 */

import { Place } from '~/types/entity/place';
import { EntityType } from '~/types/entity/entity';
import {
  LichtenbergVertex,
  LichtenbergConnection,
  LichtenbergFigure,
  LichtenbergConfig,
  generateLichtenbergFigure
} from '../lib/fractal/lichtenberg';
import {
  WorldGenerationConfig,
  WorldGenerationResult,
  EcosystemName,
  ECOSYSTEM_PROFILES,
  WorldVertex
} from './types';
import { Direction, PlaceURN } from '~/types';

/**
 * Simple seeded random number generator using Linear Congruential Generator
 * This ensures deterministic behavior across test runs
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

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Get connected components from raw graph data (vertices and connections)
 */
function getConnectedComponentsFromGraph(vertices: LichtenbergVertex[], connections: LichtenbergConnection[]): LichtenbergVertex[][] {
  const visited = new Set<string>();
  const components: LichtenbergVertex[][] = [];

  // Build adjacency map
  const adjacency = new Map<string, string[]>();
  connections.forEach(conn => {
    if (!adjacency.has(conn.from)) adjacency.set(conn.from, []);
    if (!adjacency.has(conn.to)) adjacency.set(conn.to, []);
    adjacency.get(conn.from)!.push(conn.to);
    adjacency.get(conn.to)!.push(conn.from);
  });

  for (const vertex of vertices) {
    const vertexId = vertex.id;
    if (visited.has(vertexId)) continue;

    const component: LichtenbergVertex[] = [];
    const queue = [vertexId];
    visited.add(vertexId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentVertex = vertices.find(v => v.id === currentId);

      if (currentVertex) {
        component.push(currentVertex);

        // Add connected vertices to queue
        const neighbors = adjacency.get(currentId) || [];
        neighbors.forEach(neighborId => {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        });
      }
    }

    components.push(component);
  }

  return components;
}

export function generateWorld(config: WorldGenerationConfig): WorldGenerationResult {
  const startTime = performance.now();
  console.time('generateWorld');

  const seededRandom = new SeededRandom(config.seed || 42);

  // Step 1: Generate ecosystem figures (should each be connected)
  console.time('Step 1: Generate ecosystem figures');
  const ecosystemFigures = generateEcosystemFigures(config);
  console.timeEnd('Step 1: Generate ecosystem figures');
  console.log(`\n=== STEP 1: Generated ${ecosystemFigures.length} ecosystem figures ===`);
  ecosystemFigures.forEach(figure => {
    console.log(`${figure.ecosystem}: ${figure.figure.vertices.length} vertices, ${figure.figure.connections.length} connections`);
    // Quick connectivity check for each ecosystem figure
    const components = getConnectedComponentsFromGraph(figure.figure.vertices, figure.figure.connections);
    console.log(`  → ${components.length} connected components (should be 1)`);


  });

  // Step 2: Connect ecosystem figures (inter-ecosystem connections)
  console.time('Step 2: Connect ecosystem figures');
  const { vertices, connections, config: geometricConfig } = connectEcosystemFigures(ecosystemFigures, config);
  console.timeEnd('Step 2: Connect ecosystem figures');
  console.log(`\n=== STEP 2: After inter-ecosystem connections ===`);
  console.log(`Total vertices: ${vertices.length}, Total connections: ${connections.length}`);
  const components = getConnectedComponentsFromGraph(vertices, connections);
  console.log(`Connected components: ${components.length} (should be 1 after inter-ecosystem bridging)`);



  // Step 3: Map vertices to ecosystems and create world vertices
  console.time('Step 3: Map vertices to ecosystems');
  const worldVertices = mapVerticesToEcosystems(vertices, geometricConfig);
  console.timeEnd('Step 3: Map vertices to ecosystems');
  console.log(`\n=== STEP 3: Mapped to world vertices ===`);
  console.log(`World vertices: ${worldVertices.length}`);

  // Step 4: Create places from vertices
  console.time('Step 4: Create places');
  const places = createPlacesFromVertices(worldVertices);
  console.timeEnd('Step 4: Create places');
  console.log(`\n=== STEP 4: Created places ===`);
  console.log(`Places created: ${places.length}`);

  // Step 5: Populate place exits from connections
  console.time('Step 5: Populate place exits');
  populatePlaceExits(places, connections);
  console.timeEnd('Step 5: Populate place exits');
  console.log(`\n=== STEP 5: After populating exits from ${connections.length} connections ===`);
  const connectionCount = countTotalConnections(places);
  console.log(`Places with exits populated: ${places.filter(p => Object.keys(p.exits).length > 0).length}/${places.length}`);
  console.log(`Total exit connections: ${connectionCount}`);

  // Check connectivity after basic setup
  console.time('Connectivity check');
  const basicComponents = getConnectedComponents(places);
  console.timeEnd('Connectivity check');
  console.log(`Connected components after basic setup: ${basicComponents.length} (should be 1)`);
  if (basicComponents.length > 1) {
    console.log(`Component sizes: [${basicComponents.map(c => c.length).join(', ')}]`);
  }

  // Step 6: Adjust ecosystem connectivity
  console.time('Step 6: Adjust ecosystem connectivity');
  adjustEcosystemConnectivity(places, seededRandom);
  console.timeEnd('Step 6: Adjust ecosystem connectivity');

  // Final statistics
  const stats = calculateConnectionStats(places);
  console.log(`\n=== FINAL RESULT ===`);
  console.log(`Final places: ${places.length}`);
  console.log(`Final connections: ${stats.total} total, ${stats.reciprocal} reciprocal`);
  const finalComponents = getConnectedComponents(places);
  console.log(`Final connected components: ${finalComponents.length}`);

  const totalTime = performance.now() - startTime;
  console.timeEnd('generateWorld');
  console.log(`Total generation time: ${totalTime.toFixed(2)}ms`);

  return {
    places,
    vertices: worldVertices,
    connections: stats,
    config
  };
}

/**
 * Configuration for multi-projection generation per ecosystem
 */
interface EcosystemProjectionConfig {
  projections: number[]; // Array of node ratios for each projection (e.g., [0.7, 0.3] for 70%/30% split)
  collisionThreshold: number; // Distance threshold for collision detection
}

/**
 * Get projection configuration for each ecosystem type
 */
function getEcosystemProjectionConfig(ecosystem: EcosystemName, worldSize: number = 1000): EcosystemProjectionConfig {
  // Scale collision thresholds based on world size for better adaptability
  const sizeScaling = Math.sqrt(worldSize / 1000);

  const baseConfigs = {
    [EcosystemName.STEPPE_ARID]: {
      projections: [0.6, 0.4], // Balanced dual projection
      baseThreshold: 15 // Reduced from 80 - keep connections local within bands
    },
    [EcosystemName.GRASSLAND_TEMPERATE]: {
      projections: [0.7, 0.3], // Dominant main projection
      baseThreshold: 12 // Reduced from 70 - keep connections local within bands
    },
    [EcosystemName.FOREST_TEMPERATE]: {
      projections: [0.8, 0.2], // Strong main projection for canopy effect
      baseThreshold: 10 // Reduced from 50 - keep connections local within bands
    },
    [EcosystemName.MOUNTAIN_ARID]: {
      projections: [1.0], // Single projection for sparse terrain
      baseThreshold: 0 // No collision detection needed
    },
    [EcosystemName.JUNGLE_TROPICAL]: {
      projections: [0.6, 0.4], // Balanced for dense undergrowth
      baseThreshold: 8 // Reduced from 40 - keep connections local within bands
    },
    [EcosystemName.MARSH_TROPICAL]: {
      projections: [1.0], // Single projection for treacherous terrain
      baseThreshold: 0 // No collision detection needed
    }
  };

  const config = baseConfigs[ecosystem] || baseConfigs[EcosystemName.GRASSLAND_TEMPERATE];

  return {
    projections: config.projections,
    collisionThreshold: config.baseThreshold > 0 ? Math.max(10, config.baseThreshold * sizeScaling) : 0
  };
}

/**
 * Merge multiple projections with intelligent collision detection
 */
function mergeProjectionsWithCollisionDetection(
  projections: LichtenbergFigure[],
  collisionThreshold: number
): LichtenbergFigure {
  if (projections.length === 1) {
    return projections[0];
  }

  let allVertices: LichtenbergVertex[] = [];
  let allConnections: LichtenbergConnection[] = [];

  // Collect all vertices and connections - they already have unique IDs from individual projection generation
  for (let projIndex = 0; projIndex < projections.length; projIndex++) {
    const projection = projections[projIndex];

    // Add vertices as-is - they already have unique IDs
    allVertices.push(...projection.vertices);

    // Add connections as-is - they reference the correct vertex IDs
    allConnections.push(...projection.connections);
  }

  // Detect collisions and create merger connections
  if (collisionThreshold > 0) {
    const mergerConnections = detectCollisionsAndCreateConnections(
      allVertices,
      collisionThreshold,
      true // Merging mode: prioritize connectivity over performance
    );
    allConnections.push(...mergerConnections);
  }

  return {
    vertices: allVertices,
    connections: allConnections
  };
}

/**
 * Calculate world statistics for adaptive behavior
 */
function calculateWorldStats(vertices: LichtenbergVertex[]): { density: number; bounds: { minX: number; maxX: number; minY: number; maxY: number } } {
  if (vertices.length === 0) {
    return { density: 0, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
  }

  const bounds = {
    minX: Math.min(...vertices.map(v => v.x)),
    maxX: Math.max(...vertices.map(v => v.x)),
    minY: Math.min(...vertices.map(v => v.y)),
    maxY: Math.max(...vertices.map(v => v.y))
  };

  const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
  const density = area > 0 ? vertices.length / area : 0;

  return { density, bounds };
}

/**
 * Calculate adaptive connection limits based on world characteristics
 */
function calculateConnectionLimits(vertexCount: number, density: number): { maxConnectionsPerVertex: number; targetConnectionRatio: number } {
  // Base connection limit (minimum viable connectivity)
  const baseLimit = 4;

  // Scale with world size (larger worlds can handle more connections)
  const sizeScaling = Math.min(2, Math.log10(vertexCount) / 2);

  // Scale with density (denser worlds need fewer connections per vertex)
  const densityScaling = density > 0 ? Math.max(0.5, 1 / Math.sqrt(density * 1000)) : 1;

  const maxConnectionsPerVertex = Math.ceil(baseLimit * sizeScaling * densityScaling);
  const targetConnectionRatio = Math.min(0.8, 0.3 + (vertexCount / 1000) * 0.2);

  return { maxConnectionsPerVertex, targetConnectionRatio };
}

/**
 * Calculate optimal grid size for spatial partitioning
 */
function calculateOptimalGridSize(threshold: number, density: number): number {
  // Base grid size proportional to collision threshold
  const baseSize = threshold * 1.2;

  // Adjust based on density (higher density = smaller grids for better partitioning)
  const densityAdjustment = density > 0 ? Math.max(0.8, 1 / Math.sqrt(density * 100)) : 1;

  return baseSize * densityAdjustment;
}

/**
 * Detect collisions between vertices and create merger connections
 * Adaptive version that scales with world size and density
 * @param vertices - Array of vertices to check for collisions
 * @param threshold - Distance threshold for collision detection
 * @param mergingMode - If true, prioritize connectivity over performance (for projection merging)
 */
function detectCollisionsAndCreateConnections(
  vertices: LichtenbergVertex[],
  threshold: number,
  mergingMode: boolean = false
): LichtenbergConnection[] {
  const connections: LichtenbergConnection[] = [];

  // Calculate world characteristics for adaptive behavior
  const worldStats = calculateWorldStats(vertices);

      // Adaptive connection limits based on world density and size
  const connectionConfig = mergingMode
    ? { maxConnectionsPerVertex: 6, targetConnectionRatio: 0.3 } // Conservative limits even during merging to preserve structure
    : calculateConnectionLimits(vertices.length, worldStats.density);
  const vertexConnectionCount = new Map<string, number>();

  // Adaptive grid sizing based on threshold and world density
  const gridSize = calculateOptimalGridSize(threshold, worldStats.density);
  const grid = new Map<string, LichtenbergVertex[]>();

  // Populate the grid
  vertices.forEach(vertex => {
    const gridX = Math.floor(vertex.x / gridSize);
    const gridY = Math.floor(vertex.y / gridSize);
    const gridKey = `${gridX},${gridY}`;

    if (!grid.has(gridKey)) {
      grid.set(gridKey, []);
    }
    grid.get(gridKey)!.push(vertex);
  });

  // Process each grid cell
  grid.forEach((cellVertices, cellKey) => {
    const [gridX, gridY] = cellKey.split(',').map(Number);

    // Check within the same cell
    for (let i = 0; i < cellVertices.length; i++) {
      for (let j = i + 1; j < cellVertices.length; j++) {
        const vertex1 = cellVertices[i];
        const vertex2 = cellVertices[j];

        // Skip if either vertex already has too many connections
        const count1 = vertexConnectionCount.get(vertex1.id) || 0;
        const count2 = vertexConnectionCount.get(vertex2.id) || 0;
        if (count1 >= connectionConfig.maxConnectionsPerVertex || count2 >= connectionConfig.maxConnectionsPerVertex) {
          continue;
        }

        const distance = Math.sqrt(
          Math.pow(vertex2.x - vertex1.x, 2) +
          Math.pow(vertex2.y - vertex1.y, 2)
        );

        if (distance <= threshold) {
          // Connection from vertex1 to vertex2
          connections.push({
            from: vertex1.id,
            to: vertex2.id,
            length: distance,
            artificial: true // Mark as artificial merger connection
          });

          // Reciprocal connection from vertex2 to vertex1
          connections.push({
            from: vertex2.id,
            to: vertex1.id,
            length: distance,
            artificial: true // Mark as artificial merger connection
          });

          // Update connection counts
          vertexConnectionCount.set(vertex1.id, count1 + 1);
          vertexConnectionCount.set(vertex2.id, count2 + 1);
        }
      }
    }

    // Check adjacent cells (only right and down to avoid duplicate checks)
    const adjacentOffsets = [[1, 0], [0, 1], [1, 1], [1, -1]];

    for (const [dx, dy] of adjacentOffsets) {
      const adjKey = `${gridX + dx},${gridY + dy}`;
      const adjVertices = grid.get(adjKey);

      if (adjVertices) {
        for (const vertex1 of cellVertices) {
          for (const vertex2 of adjVertices) {
            // Skip if either vertex already has too many connections
            const count1 = vertexConnectionCount.get(vertex1.id) || 0;
            const count2 = vertexConnectionCount.get(vertex2.id) || 0;
            if (count1 >= connectionConfig.maxConnectionsPerVertex || count2 >= connectionConfig.maxConnectionsPerVertex) {
              continue;
            }

            const distance = Math.sqrt(
              Math.pow(vertex2.x - vertex1.x, 2) +
              Math.pow(vertex2.y - vertex1.y, 2)
            );

            if (distance <= threshold) {
              // Connection from vertex1 to vertex2
              connections.push({
                from: vertex1.id,
                to: vertex2.id,
                length: distance,
                artificial: true // Mark as artificial merger connection
              });

              // Reciprocal connection from vertex2 to vertex1
              connections.push({
                from: vertex2.id,
                to: vertex1.id,
                length: distance,
                artificial: true // Mark as artificial merger connection
              });

              // Update connection counts
              vertexConnectionCount.set(vertex1.id, count1 + 1);
              vertexConnectionCount.set(vertex2.id, count2 + 1);
            }
          }
        }
      }
    }
  });

  return connections;
}

/**
 * Apply eastward stretching transformation to first projection
 * Scales x-coordinates so the easternmost node is near the eastern edge of the ecosystem
 * Returns the scaling factor applied for collision threshold adjustment
 */
function applyEastwardStretchingTransformation(
  figure: LichtenbergFigure,
  bandWidth: number
): number {
  if (figure.vertices.length === 0) return 1.0;

  // Find the easternmost x-coordinate in the projection
  const eastmostX = Math.max(...figure.vertices.map(v => v.x));

  // If the projection is already at or beyond the target, no scaling needed
  if (eastmostX <= 0) return 1.0;

  // Target position: 90% of band width (leave 10% margin from eastern edge)
  const targetX = bandWidth * 0.9;

  // Calculate scaling factor
  const scaleFactor = targetX / eastmostX;

  // Apply scaling to all vertices' x-coordinates
  figure.vertices.forEach(vertex => {
    vertex.x *= scaleFactor;
  });

  return scaleFactor;
}

/**
 * Generate multiple Lichtenberg projections for each ecosystem band with intelligent merging
 */
function generateEcosystemFigures(config: WorldGenerationConfig): EcosystemFigure[] {
  const worldWidth = 1000;
  const worldHeight = worldWidth / config.worldAspectRatio;
  const bandWidth = worldWidth / 5; // 5 ecosystem bands

  const ecosystemBands = [
    EcosystemName.STEPPE_ARID,
    EcosystemName.GRASSLAND_TEMPERATE,
    EcosystemName.FOREST_TEMPERATE,
    EcosystemName.MOUNTAIN_ARID,
    EcosystemName.JUNGLE_TROPICAL
  ];

  const baseSeed = config.seed || 42;

  return ecosystemBands.map((ecosystem, index) => {
    const startX = index * bandWidth;
    const endX = (index + 1) * bandWidth;

    // Each ecosystem gets roughly equal share of total places
    const targetPlaces = Math.floor(config.minPlaces / 5);
    const maxPlaces = Math.floor((config.maxPlaces || config.minPlaces * 2) / 5);

    // Get multi-projection configuration for this ecosystem
    const projectionConfig = getEcosystemProjectionConfig(ecosystem, worldWidth);
    const projections: LichtenbergFigure[] = [];
    let adjustedCollisionThreshold = projectionConfig.collisionThreshold;

    // Generate multiple projections for this ecosystem
    for (let projIndex = 0; projIndex < projectionConfig.projections.length; projIndex++) {
      const projectionRatio = projectionConfig.projections[projIndex];
      const projectionPlaces = Math.floor(targetPlaces * projectionRatio);
      const projectionMaxPlaces = Math.floor(maxPlaces * projectionRatio);

        const lichtenbergConfig: LichtenbergConfig = {
      startX: 0, // Start at beginning of band
      startY: worldHeight / 2,
      width: bandWidth,
      height: worldHeight,
      branchingFactor: 0.8, // Higher branching for more places
      branchingAngle: Math.PI / 2,
      stepSize: 60, // Smaller steps for more density
      maxDepth: 20, // Higher depth for more coverage
      eastwardBias: 0.7,
      verticalBias: 0.0,
      seed: baseSeed + index + (projIndex * 1000), // Different seed per projection

      minVertices: Math.max(3, projectionPlaces), // Ensure minimum places per projection
      maxVertices: Math.max(projectionMaxPlaces, 15), // Ensure reasonable maximum

      sparking: {
        enabled: true,
        probability: 0.6,
        maxSparkDepth: 3,
        sparkingConditions: {
          boundaryPoints: [],
          randomSparking: true
        },
        fishSpineBias: 0.7
      }
    };

    const figure = generateLichtenbergFigure(lichtenbergConfig);

      // Apply eastward stretching transformation to ALL projections for consistent scaling
      const scaleFactor = applyEastwardStretchingTransformation(figure, bandWidth);

      // Scale collision threshold proportionally for the first projection only (since threshold applies to all)
      if (projIndex === 0) {
        adjustedCollisionThreshold = projectionConfig.collisionThreshold * scaleFactor;
      }

      projections.push(figure);
    }

    // Merge projections with intelligent collision detection using the adjusted threshold
    const mergedFigure = mergeProjectionsWithCollisionDetection(
      projections,
      adjustedCollisionThreshold
    );

    // Offset vertices to absolute world coordinates
    const offsetVertices = mergedFigure.vertices.map((vertex: LichtenbergVertex) => ({
      ...vertex,
      x: vertex.x + startX,
      ecosystem
    }));

    return {
      ecosystem,
      figure: {
        vertices: offsetVertices,
        connections: mergedFigure.connections
      },
      bandStart: startX,
      bandEnd: endX,
      config: {
        startX: 0,
        startY: worldHeight / 2,
        width: bandWidth,
        height: worldHeight,
        branchingFactor: 0.8,
        branchingAngle: Math.PI / 2,
        stepSize: 60,
        maxDepth: 20,
        eastwardBias: 0.7,
        verticalBias: 0.0,
        seed: baseSeed + index,
        minVertices: Math.max(3, targetPlaces),
        maxVertices: Math.max(maxPlaces, 15)
      }
    };
  });
}

/**
 * Find the origin vertex in an ecosystem (closest to the band start position)
 */
function findOriginVertex(ecosystemFigure: EcosystemFigure): LichtenbergVertex {
  const bandStart = ecosystemFigure.bandStart;
  const worldHeight = 1000 / 2; // worldHeight / 2 from the original config

  // Find vertex closest to the band start position (bandStart, worldHeight/2)
  return ecosystemFigure.figure.vertices.reduce((closest: any, vertex: any) => {
    const closestDistance = Math.sqrt(
      Math.pow(closest.x - bandStart, 2) +
      Math.pow(closest.y - worldHeight, 2)
    );

    const vertexDistance = Math.sqrt(
      Math.pow(vertex.x - bandStart, 2) +
      Math.pow(vertex.y - worldHeight, 2)
    );

    return vertexDistance < closestDistance ? vertex : closest;
  });
}

/**
 * Connect adjacent ecosystem figures by linking easternmost vertices to origin vertices
 */
function connectEcosystemFigures(
  ecosystemFigures: EcosystemFigure[],
  config: WorldGenerationConfig
): { vertices: LichtenbergVertex[]; connections: LichtenbergConnection[]; config: LichtenbergConfig } {
  let allVertices: LichtenbergVertex[] = [];
  let allConnections: LichtenbergConnection[] = [];

  // Collect all vertices and connections from individual figures
  // IDs are already unique thanks to base62 random ID generation
  ecosystemFigures.forEach(ecosystemFigure => {
    allVertices.push(...ecosystemFigure.figure.vertices);
    allConnections.push(...ecosystemFigure.figure.connections);
  });

  // Connect adjacent ecosystems with robust multi-component bridging
  for (let i = 0; i < ecosystemFigures.length - 1; i++) {
    const westEcosystem = ecosystemFigures[i];
    const eastEcosystem = ecosystemFigures[i + 1];

    // Get all connected components in both ecosystems
    const westComponents = getConnectedComponentsFromGraph(westEcosystem.figure.vertices, westEcosystem.figure.connections);
    const eastComponents = getConnectedComponentsFromGraph(eastEcosystem.figure.vertices, eastEcosystem.figure.connections);

    // Connect multiple components for robust inter-ecosystem bridging
    const connectionCount = 1; // Only create ONE bridge per ecosystem pair

    for (let compIndex = 0; compIndex < connectionCount; compIndex++) {
      // Use the largest components for the most stable bridging
      const westComponent = westComponents[0]; // Largest component first
      const eastComponent = eastComponents[0]; // Largest component first

      // Find best vertices to connect between components
      const eastmostWest = westComponent.reduce((eastmost: any, vertex: any) =>
      vertex.x > eastmost.x ? vertex : eastmost
    );

      const westmostEast = eastComponent.reduce((westmost: any, vertex: any) =>
      vertex.x < westmost.x ? vertex : westmost
    );

      // Create bidirectional connection between ecosystems
    const distance = Math.sqrt(
      Math.pow(westmostEast.x - eastmostWest.x, 2) +
      Math.pow(westmostEast.y - eastmostWest.y, 2)
    );

      // Connection from west component's easternmost to east component's westernmost
    allConnections.push({
      from: eastmostWest.id,
      to: westmostEast.id,
      length: distance,
      artificial: true, // Mark as artificial inter-ecosystem connection
      ecosystemTransition: {
        from: westEcosystem.ecosystem,
        to: eastEcosystem.ecosystem
      }
    });

      // Reciprocal connection from east component's westernmost to west component's easternmost
      allConnections.push({
        from: westmostEast.id,
        to: eastmostWest.id,
        length: distance,
        artificial: true, // Mark as artificial inter-ecosystem connection
        ecosystemTransition: {
          from: eastEcosystem.ecosystem,
          to: westEcosystem.ecosystem
        }
      });
    }
  }

  // Create a combined config for the result
  const combinedConfig: LichtenbergConfig = {
    startX: 0,
    startY: 500,
    width: 1000,
    height: 1000 / config.worldAspectRatio,
    branchingFactor: 0.7,
    branchingAngle: Math.PI / 3,
    stepSize: 80,
    maxDepth: 15,
    eastwardBias: 0.8,
    seed: config.seed || 42,
    minVertices: config.minPlaces,
    maxVertices: config.maxPlaces
  };

  return {
    vertices: allVertices,
    connections: allConnections,
    config: combinedConfig
  };
}

// Type for ecosystem-specific figures
type EcosystemFigure = {
  ecosystem: EcosystemName;
  figure: LichtenbergFigure;
  bandStart: number;
  bandEnd: number;
  config: LichtenbergConfig;
};

/**
 * Convert WorldGenerationConfig to pure geometric LichtenbergConfig
 */
function createGeometricConfig(config: WorldGenerationConfig): LichtenbergConfig {
  const worldWidth = 1000; // Arbitrary units - will be scaled to Places
  const worldHeight = worldWidth / config.worldAspectRatio;

    return {
    startX: 0, // Start at the west edge
    startY: worldHeight / 2,
    width: worldWidth,
    height: worldHeight,
    branchingFactor: 0.98, // Maximum branching to ensure coverage
    branchingAngle: Math.PI, // Very wide angles for maximum spread
    stepSize: 200, // Very large steps to ensure we cross ecosystem boundaries
    maxDepth: 40, // Very high depth to ensure we reach the eastern edge
    eastwardBias: 0.95, // Maximum eastward bias to ensure crossing all bands
    verticalBias: 0.0,
    seed: 42,

    // Apply vertex constraints from config
    minVertices: config.lichtenberg.minVertices,
    maxVertices: config.maxPlaces,

    // Enable sparking with ecosystem boundaries - force sparking at boundaries
    sparking: {
      enabled: true,
      probability: 0.9, // Maximum sparking probability
      maxSparkDepth: 6, // Deep sparking to ensure coverage
      sparkingConditions: {
        // Spark at ecosystem boundaries (geography.md vertical bands)
        boundaryPoints: [0.2, 0.4, 0.6, 0.8], // Between the 5 bands
        randomSparking: true
      },
      fishSpineBias: 0.9 // Maximum fish spine to ensure eastward progression
    }
  };
}

/**
 * Map pure geometric vertices to world vertices with ecosystems
 * Uses geography.md ecosystem band structure
 */
function mapVerticesToEcosystems(vertices: LichtenbergVertex[], config: LichtenbergConfig): WorldVertex[] {
  return vertices.map(vertex => {
    const ecosystem = determineEcosystem(vertex.x, vertex.y, config);
    return {
      ...vertex,
      ecosystem
    };
  });
}

/**
 * Determine ecosystem based on position using geography.md bands
 * 5 vertical bands: steppe:arid → grassland:temperate → forest:temperate → mountain:arid → jungle:tropical
 * With marsh:tropical interspersed in the eastern band (13% dithering)
 */
function determineEcosystem(x: number, y: number, config: LichtenbergConfig): EcosystemName {
  const normalizedX = x / config.width; // 0 to 1, west to east

  // Define the 5 ecosystem bands based on geography.md
  if (normalizedX < 0.2) {
    return EcosystemName.STEPPE_ARID;
  } else if (normalizedX < 0.4) {
    return EcosystemName.GRASSLAND_TEMPERATE;
  } else if (normalizedX < 0.6) {
    return EcosystemName.FOREST_TEMPERATE;
  } else if (normalizedX < 0.8) {
    return EcosystemName.MOUNTAIN_ARID;
  } else {
    // Eastern band - mostly jungle with 13% marsh dithering
    const hash = hashPosition(x, y);
    if (hash % 100 < 13) {
      return EcosystemName.MARSH_TROPICAL;
    }
    return EcosystemName.JUNGLE_TROPICAL;
  }
}

/**
 * Simple position-based hash for consistent marsh dithering
 */
function hashPosition(x: number, y: number): number {
  const xInt = Math.floor(x);
  const yInt = Math.floor(y);
  return (xInt * 73 + yInt * 37) % 1000;
}

/**
 * Convert world vertices to full Place objects
 */
function createPlacesFromVertices(worldVertices: WorldVertex[]): Place[] {
  return worldVertices.map(vertex => {
    const ecologicalProfile = ECOSYSTEM_PROFILES[vertex.ecosystem];

    // Convert geometric coordinates to world coordinates (100x100m Places)
    const worldX = Math.floor(vertex.x);
    const worldY = Math.floor(vertex.y);

    const place: Place = {
      id: `flux:place:${vertex.id}`,
      type: EntityType.PLACE,
      name: generatePlaceName(vertex.ecosystem, vertex.id),
      description: generatePlaceDescription(vertex.ecosystem),
      exits: {}, // Will be populated by connection analysis
      entities: {}, // No entities initially
      ecology: ecologicalProfile,
      weather: {
        temperature: ecologicalProfile.temperature[0], // Start with min temperature
        pressure: ecologicalProfile.pressure[0], // Start with min pressure
        humidity: ecologicalProfile.humidity[0], // Start with min humidity
        precipitation: 0, // Will be computed
        ppfd: 0, // Will be computed
        clouds: 0, // Will be computed
        ts: Date.now()
      },
      resources: {
        ts: Date.now(),
        nodes: {} // No resource nodes initially
      }
    };

    return place;
  });
}

/**
 * Generate a name for a place based on its ecosystem
 */
function generatePlaceName(ecosystem: EcosystemName, id: string): string {
  const prefixes = {
    [EcosystemName.STEPPE_ARID]: ['Windswept', 'Barren', 'Dry'],
    [EcosystemName.GRASSLAND_TEMPERATE]: ['Rolling', 'Green', 'Meadow'],
    [EcosystemName.FOREST_TEMPERATE]: ['Wooded', 'Shaded', 'Grove'],
    [EcosystemName.MOUNTAIN_ARID]: ['Rocky', 'Peak', 'Crag'],
    [EcosystemName.JUNGLE_TROPICAL]: ['Dense', 'Verdant', 'Canopy'],
    [EcosystemName.MARSH_TROPICAL]: ['Misty', 'Muddy', 'Boggy']
  };

  const suffixes = {
    [EcosystemName.STEPPE_ARID]: ['Plateau', 'Plain', 'Mesa'],
    [EcosystemName.GRASSLAND_TEMPERATE]: ['Field', 'Meadow', 'Prairie'],
    [EcosystemName.FOREST_TEMPERATE]: ['Grove', 'Glade', 'Thicket'],
    [EcosystemName.MOUNTAIN_ARID]: ['Peak', 'Ridge', 'Outcrop'],
    [EcosystemName.JUNGLE_TROPICAL]: ['Jungle', 'Canopy', 'Understory'],
    [EcosystemName.MARSH_TROPICAL]: ['Marsh', 'Wetland', 'Swamp']
  };

  // Extract numeric part from vertex ID (e.g., "vertex_123" -> "123")
  const numericId = id.replace(/[^0-9]/g, '');
  const idNumber = parseInt(numericId) || 0;

  const prefix = prefixes[ecosystem][idNumber % prefixes[ecosystem].length];
  const suffix = suffixes[ecosystem][Math.floor(idNumber / 10) % suffixes[ecosystem].length];

  return `${prefix} ${suffix}`;
}

/**
 * Generate a description for a place based on its ecosystem
 */
function generatePlaceDescription(ecosystem: EcosystemName): string {
  const descriptions = {
    [EcosystemName.STEPPE_ARID]: 'A dry, windswept expanse of hardy grasses and scattered shrubs under an endless sky.',
    [EcosystemName.GRASSLAND_TEMPERATE]: 'Rolling green hills dotted with wildflowers sway gently in the temperate breeze.',
    [EcosystemName.FOREST_TEMPERATE]: 'Tall deciduous trees create a canopy of dappled shade over the forest floor.',
    [EcosystemName.MOUNTAIN_ARID]: 'Jagged rocky peaks rise toward the sky, their surfaces scoured by wind and weather.',
    [EcosystemName.JUNGLE_TROPICAL]: 'Dense tropical vegetation creates a humid, verdant maze of vines and massive trees.',
    [EcosystemName.MARSH_TROPICAL]: 'Murky waters weave between patches of soggy ground and tangled wetland vegetation.'
  };

  return descriptions[ecosystem];
}



/**
 * Populate Place exits from Lichtenberg connections
 * Converts geometric connections between vertices into navigable exits between places
 */
function populatePlaceExits(places: Place[], connections: LichtenbergConnection[]): void {
  // Create a map from vertex ID to place for quick lookup
  const placeMap = new Map<string, Place>();
  places.forEach(place => {
    // Extract vertex ID from place ID (flux:place:vertex_123 -> vertex_123)
    const vertexId = place.id.replace('flux:place:', '');
    placeMap.set(vertexId, place);
  });

  // Available directions for connections (excluding UP/DOWN for ground-level connections)
  const connectionDirections = [
    Direction.NORTH,
    Direction.SOUTH,
    Direction.EAST,
    Direction.WEST,
    Direction.NORTHEAST,
    Direction.NORTHWEST,
    Direction.SOUTHEAST,
    Direction.SOUTHWEST,
  ];

  let successful = 0;
  let skipped = 0;
  let missingPlaces = 0;
  let overflowHandled = 0;
  let directFailures = 0;
  let overflowFailures = 0;

  // Sort connections by priority (ecosystem transitions first to preserve inter-ecosystem connectivity)
  const sortedConnections = connections.sort((a, b) => {
    if (a.ecosystemTransition && !b.ecosystemTransition) return -1;
    if (!a.ecosystemTransition && b.ecosystemTransition) return 1;
    return 0;
  });

  // Pre-compute relay places by ecosystem to avoid repeated filtering
  const relayPlacesByEcosystem = computeRelayPlacesByEcosystem(places);

  // TWO-PHASE APPROACH: Ensure every place gets at least 1 exit before saturation

  // Phase 1: Connect isolated places (priority to places with 0 exits)
  console.log(`  Phase 1: Ensuring minimum connectivity...`);
  let phase1Successful = 0;
  const placesProcessedInPhase1 = new Set<string>();

  sortedConnections.forEach((connection) => {
    const fromPlace = placeMap.get(connection.from);
    const toPlace = placeMap.get(connection.to);

    if (!fromPlace || !toPlace) {
      missingPlaces++;
      return;
    }

    // Phase 1: Only connect if at least one place has 0 exits
    const fromExits = Object.keys(fromPlace.exits).length;
    const toExits = Object.keys(toPlace.exits).length;

    if (fromExits === 0 || toExits === 0) {
      // Try direct connection first
      if (createDirectConnection(fromPlace, toPlace, connectionDirections)) {
        phase1Successful++;
        return;
      }

      // For isolated places, try harder with overflow handling
      if (handleConnectionOverflow(fromPlace, toPlace, relayPlacesByEcosystem, connectionDirections)) {
        phase1Successful++;
        return;
      }
    }
  });

  console.log(`  Phase 1 complete: ${phase1Successful} connections created for isolated places`);

  // Phase 2: Fill remaining capacity (regular connection processing)
  console.log(`  Phase 2: Filling remaining capacity...`);
  let phase2Successful = 0;

  sortedConnections.forEach((connection) => {
    const fromPlace = placeMap.get(connection.from);
    const toPlace = placeMap.get(connection.to);

    if (!fromPlace || !toPlace) {
      return; // Already counted in Phase 1
    }

    // Skip if already connected in Phase 1
    if (hasExistingConnection(fromPlace, toPlace)) {
      return;
    }

    // Try direct connection first
    if (createDirectConnection(fromPlace, toPlace, connectionDirections)) {
      phase2Successful++;
      return;
    }

    // Direct connection failed
    directFailures++;

    // For overflow handling, only try for ecosystem transitions or if we haven't exceeded quota
    const isImportantConnection = connection.ecosystemTransition || overflowHandled < 1000;

    if (isImportantConnection && handleConnectionOverflow(fromPlace, toPlace, relayPlacesByEcosystem, connectionDirections)) {
      overflowHandled++;
      return;
    }

    // Track if overflow was attempted but failed
    if (isImportantConnection) {
      overflowFailures++;
    }

    // If both failed, skip this connection
    skipped++;
  });

  successful = phase1Successful + phase2Successful;
  console.log(`  Phase 2 complete: ${phase2Successful} additional connections created`);

  console.log(`Populated exits for ${places.length} places from ${connections.length} connections`);
  console.log(`  Successful: ${successful}, Overflow handled: ${overflowHandled}, Skipped: ${skipped}, Missing places: ${missingPlaces}`);
  console.log(`  Failure breakdown: Direct failures: ${directFailures}, Overflow failures: ${overflowFailures}`);

  // Debug: Count places with different exit counts
  const exitCounts = new Map<number, number>();
  places.forEach(place => {
    const exitCount = Object.keys(place.exits).length;
    exitCounts.set(exitCount, (exitCounts.get(exitCount) || 0) + 1);
  });

  console.log(`  Exit distribution:`);
  Array.from(exitCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([exitCount, placeCount]) => {
      console.log(`    ${exitCount} exits: ${placeCount} places`);
    });

  // Debug: Show which places have no exits
  const placesWithNoExits = places.filter(place => Object.keys(place.exits).length === 0);
  if (placesWithNoExits.length > 0) {
    console.log(`  Places with NO exits (${placesWithNoExits.length}):`, placesWithNoExits.slice(0, 5).map(p => p.id));

    // Debug: Quick check if isolated places have connections in the data
    const isolatedVertexIds = placesWithNoExits.slice(0, 3).map(place => place.id.replace('flux:place:', ''));
    console.log(`  Sample isolated places connection counts:`);
    isolatedVertexIds.forEach(vertexId => {
      const connectionsFrom = connections.filter(c => c.from === vertexId).length;
      const connectionsTo = connections.filter(c => c.to === vertexId).length;
      console.log(`    ${vertexId}: ${connectionsFrom} out, ${connectionsTo} in`);
    });
  }
}

/**
 * Pre-compute relay places by ecosystem for efficiency
 */
function computeRelayPlacesByEcosystem(places: Place[]): Map<string, Place[]> {
  const relayPlacesByEcosystem = new Map<string, Place[]>();

  // Group places by ecosystem
  const placesByEcosystem = new Map<string, Place[]>();
  places.forEach(place => {
    const ecosystem = place.ecology.ecosystem;
    if (!placesByEcosystem.has(ecosystem)) {
      placesByEcosystem.set(ecosystem, []);
    }
    placesByEcosystem.get(ecosystem)!.push(place);
  });

  // For each ecosystem, find potential relay places
  placesByEcosystem.forEach((ecosystemPlaces, ecosystem) => {
    const relayPlaces = ecosystemPlaces
      .filter(place => Object.keys(place.exits).length < 6) // Not too saturated
      .sort((a, b) => Object.keys(a.exits).length - Object.keys(b.exits).length) // Least connected first
      .slice(0, 10); // Limit to top 10 candidates per ecosystem

    relayPlacesByEcosystem.set(ecosystem, relayPlaces);
  });

  return relayPlacesByEcosystem;
}

/**
 * Try to create a direct connection between two places
 */
function createDirectConnection(fromPlace: Place, toPlace: Place, connectionDirections: Direction[]): boolean {
  // Find available directions for both places
  const fromUsedDirections = new Set(Object.keys(fromPlace.exits) as Direction[]);
  const toUsedDirections = new Set(Object.keys(toPlace.exits) as Direction[]);

  // Find a direction pair that works for both places
  for (const direction of connectionDirections) {
    const reverse = getOppositeDirection(direction);

    if (!fromUsedDirections.has(direction) && !toUsedDirections.has(reverse)) {
      // Create exit from fromPlace to toPlace
      fromPlace.exits[direction] = {
        direction: direction,
        label: `Path to ${toPlace.name}`,
        to: toPlace.id as PlaceURN
      };

      // Create reverse exit from toPlace to fromPlace
      toPlace.exits[reverse] = {
        direction: reverse,
        label: `Path to ${fromPlace.name}`,
        to: fromPlace.id as PlaceURN
      };

      return true;
    }
  }

  return false;
}

/**
 * Handle connection overflow by finding relay places (optimized version)
 */
function handleConnectionOverflow(
  fromPlace: Place,
  toPlace: Place,
  relayPlacesByEcosystem: Map<string, Place[]>,
  connectionDirections: Direction[]
): boolean {
  // Get relay candidates from relevant ecosystems
  const fromEcosystem = fromPlace.ecology.ecosystem;
  const toEcosystem = toPlace.ecology.ecosystem;

  const relayPlaces = [
    ...(relayPlacesByEcosystem.get(fromEcosystem) || []),
    ...(relayPlacesByEcosystem.get(toEcosystem) || [])
  ];

  // Try only the first few relay candidates to avoid performance issues
  const candidateCount = Math.min(3, relayPlaces.length);

  for (let i = 0; i < candidateCount; i++) {
    const relay = relayPlaces[i];

    // Skip if it's one of our source/destination places
    if (relay.id === fromPlace.id || relay.id === toPlace.id) {
      continue;
    }

    // Check if relay can connect to both places
    if (canCreateConnection(relay, fromPlace, connectionDirections) &&
        canCreateConnection(relay, toPlace, connectionDirections)) {

      // Create connections: fromPlace ↔ relay ↔ toPlace
      if (createDirectConnection(fromPlace, relay, connectionDirections) &&
          createDirectConnection(relay, toPlace, connectionDirections)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a connection can be created between two places
 */
function canCreateConnection(place1: Place, place2: Place, connectionDirections: Direction[]): boolean {
  const place1UsedDirections = new Set(Object.keys(place1.exits) as Direction[]);
  const place2UsedDirections = new Set(Object.keys(place2.exits) as Direction[]);

  for (const direction of connectionDirections) {
    const reverse = getOppositeDirection(direction);

    if (!place1UsedDirections.has(direction) && !place2UsedDirections.has(reverse)) {
      return true;
    }
  }

  return false;
}

/**
 * Get opposite direction for bidirectional connections
 */
function getOppositeDirection(direction: Direction): Direction {
  const opposites: Record<Direction, Direction> = {
        [Direction.NORTH]: Direction.SOUTH,
        [Direction.SOUTH]: Direction.NORTH,
        [Direction.EAST]: Direction.WEST,
        [Direction.WEST]: Direction.EAST,
        [Direction.NORTHEAST]: Direction.SOUTHWEST,
        [Direction.NORTHWEST]: Direction.SOUTHEAST,
        [Direction.SOUTHEAST]: Direction.NORTHWEST,
        [Direction.SOUTHWEST]: Direction.NORTHEAST,
        [Direction.UP]: Direction.DOWN,
        [Direction.DOWN]: Direction.UP,
        [Direction.IN]: Direction.OUT,
        [Direction.OUT]: Direction.IN,
        [Direction.FORWARD]: Direction.BACKWARD,
        [Direction.BACKWARD]: Direction.FORWARD,
        [Direction.LEFT]: Direction.RIGHT,
        [Direction.RIGHT]: Direction.LEFT,
        [Direction.UNKNOWN]: Direction.UNKNOWN,
      };

  return opposites[direction] || Direction.UNKNOWN;
}

/**
 * Adjust ecosystem-specific connectivity patterns
 * Implements hybrid approach: additive for open terrain, selective removal for difficult terrain
 */
function adjustEcosystemConnectivity(places: Place[], seededRandom: SeededRandom): void {
  console.log('Adjusting ecosystem-specific connectivity...');

  // Check if this is a highly fragmented world
  const initialComponents = getConnectedComponents(places);
  const isHighlyFragmented = initialComponents.length > 50;

  if (isHighlyFragmented) {
    console.log(`Highly fragmented world detected (${initialComponents.length} components). Skipping expensive proximity connections.`);
    // Skip expensive proximity connections for highly fragmented worlds
    // Go straight to global bridging which is more effective
    ensureGlobalConnectivity(places, seededRandom);
    return;
  }

  // Group places by ecosystem for processing
  const placesByEcosystem = groupPlacesByEcosystem(places);

  // Apply ecosystem-specific adjustments (only for less fragmented worlds)
  Object.entries(placesByEcosystem).forEach(([ecosystem, ecosystemPlaces]) => {
    const ecosystemName = ecosystem as EcosystemName;
    applyEcosystemConnectivityRules(ecosystemPlaces, ecosystemName, placesByEcosystem, seededRandom);
  });

  // CRITICAL: Ensure global connectivity by bridging disconnected components
  ensureGlobalConnectivity(places, seededRandom);

  const finalConnectionCount = countTotalConnections(places);
  console.log(`Connectivity adjustment complete. Final connections: ${finalConnectionCount}`);
}

/**
 * Group places by their ecosystem for targeted processing
 */
function groupPlacesByEcosystem(places: Place[]): Record<string, Place[]> {
  const grouped: Record<string, Place[]> = {};

  places.forEach(place => {
    const ecosystem = place.ecology.ecosystem;
    if (!grouped[ecosystem]) {
      grouped[ecosystem] = [];
    }
    grouped[ecosystem].push(place);
  });

  return grouped;
}

/**
 * Apply connectivity rules specific to each ecosystem type
 * Focus on ADDING connections only, since natural Lichtenberg base is sparse (~1.8-1.9)
 */
function applyEcosystemConnectivityRules(
  ecosystemPlaces: Place[],
  ecosystem: EcosystemName,
  placesByEcosystem: Record<string, Place[]>,
  seededRandom: SeededRandom
): void {
  const connectivityConfig = getEcosystemConnectivityConfig(ecosystem);

  console.log(`Enhancing ${ecosystem}: ${ecosystemPlaces.length} places, target ~${connectivityConfig.targetConnectionsPerPlace} connections/place (adding to natural ~1.9 base)`);

  // Add proximity connections to enhance sparse natural Lichtenberg connectivity
  if (connectivityConfig.addProximityConnections) {
    const eligiblePlaces = getEligibleConnectionPlaces(ecosystem, placesByEcosystem);
    const allPlaces = Object.values(placesByEcosystem).flat();

    // Limit the scope to prevent performance issues
    const limitedAllPlaces = allPlaces.slice(0, 500); // Cap to 500 places for performance

    addProximityConnections(ecosystemPlaces, connectivityConfig.connectionRange, limitedAllPlaces, eligiblePlaces, seededRandom);
  }

  // No connection removal - we only add to the natural sparse base
}

/**
 * Get eligible places for connection based on ecosystem adjacency
 */
function getEligibleConnectionPlaces(
  ecosystem: EcosystemName,
  placesByEcosystem: Record<string, Place[]>
): Place[] {
  const eligiblePlaces: Place[] = [];

  // Always include places from the same ecosystem
  const sameEcosystemPlaces = placesByEcosystem[ecosystem] || [];
  eligiblePlaces.push(...sameEcosystemPlaces);

  // Define ecosystem adjacency (based on the 5-band layout: Steppe, Grassland, Forest, Mountain, Jungle)
  const adjacencyMap: Record<EcosystemName, EcosystemName[]> = {
    [EcosystemName.STEPPE_ARID]: [EcosystemName.GRASSLAND_TEMPERATE],
    [EcosystemName.GRASSLAND_TEMPERATE]: [EcosystemName.STEPPE_ARID, EcosystemName.FOREST_TEMPERATE],
    [EcosystemName.FOREST_TEMPERATE]: [EcosystemName.GRASSLAND_TEMPERATE, EcosystemName.MOUNTAIN_ARID],
    [EcosystemName.MOUNTAIN_ARID]: [EcosystemName.FOREST_TEMPERATE, EcosystemName.JUNGLE_TROPICAL],
    [EcosystemName.JUNGLE_TROPICAL]: [EcosystemName.MOUNTAIN_ARID, EcosystemName.MARSH_TROPICAL],
    [EcosystemName.MARSH_TROPICAL]: [EcosystemName.JUNGLE_TROPICAL] // Marsh is dithered within jungle
  };

  // Add places from adjacent ecosystems (but limit to prevent over-connection)
  const adjacentEcosystems = adjacencyMap[ecosystem] || [];
  adjacentEcosystems.forEach(adjacentEcosystem => {
    const adjacentPlaces = placesByEcosystem[adjacentEcosystem] || [];
    // Only add a subset of adjacent places to prevent over-connection
    const maxAdjacentConnections = Math.min(5, adjacentPlaces.length);
    eligiblePlaces.push(...adjacentPlaces.slice(0, maxAdjacentConnections));
  });

  return eligiblePlaces;
}

/**
 * Get connectivity configuration for each ecosystem type
 * Focus on ADDING connections only, since natural Lichtenberg connectivity is ~1.8-1.9
 */
function getEcosystemConnectivityConfig(ecosystem: EcosystemName): {
  targetConnectionsPerPlace: number;
  connectionRange: number;
  addProximityConnections: boolean;
  removeConnections: boolean;
} {
  const configs = {
    [EcosystemName.GRASSLAND_TEMPERATE]: {
      targetConnectionsPerPlace: 3.5, // High connectivity for open terrain
      connectionRange: 3, // 3 hops: creates shortcuts across open terrain
      addProximityConnections: true,
      removeConnections: false // Never remove from natural sparse base
    },
    [EcosystemName.STEPPE_ARID]: {
      targetConnectionsPerPlace: 4.0, // Highest connectivity for wide open spaces
      connectionRange: 4, // 4 hops: very long-range connections possible
      addProximityConnections: true,
      removeConnections: false
    },
    [EcosystemName.FOREST_TEMPERATE]: {
      targetConnectionsPerPlace: 2.8, // Moderate enhancement over natural ~1.9
      connectionRange: 2, // 2 hops: some trails through trees
      addProximityConnections: true,
      removeConnections: false
    },
    [EcosystemName.MARSH_TROPICAL]: {
      targetConnectionsPerPlace: 2.0, // Minimal enhancement - keep natural sparsity
      connectionRange: 1, // 1 hop: very limited additional paths
      addProximityConnections: false,
      removeConnections: false
    },
    [EcosystemName.MOUNTAIN_ARID]: {
      targetConnectionsPerPlace: 2.1, // Minimal enhancement for difficult terrain
      connectionRange: 1, // 1 hop: rugged terrain limits passage
      addProximityConnections: false,
      removeConnections: false
    },
    [EcosystemName.JUNGLE_TROPICAL]: {
      targetConnectionsPerPlace: 2.6, // Moderate enhancement with some paths
      connectionRange: 2, // 2 hops: paths through dense vegetation
      addProximityConnections: true,
      removeConnections: false
    }
  };

  return configs[ecosystem] || configs[EcosystemName.GRASSLAND_TEMPERATE];
}

/**
 * Add proximity-based connections for open terrain ecosystems
 * Now uses graph distance (hops) instead of geographic distance
 */
function addProximityConnections(ecosystemPlaces: Place[], maxHops: number, allPlaces: Place[], eligiblePlaces: Place[], seededRandom: SeededRandom): void {
  let connectionsAdded = 0;

  // Pre-compute place lookup map for O(1) access
  const placeMap = new Map<string, Place>();
  allPlaces.forEach(place => placeMap.set(place.id, place));

  // Pre-compute eligible places set for O(1) lookup
  const eligibleSet = new Set(eligiblePlaces.map(p => p.id));

  // Limit the number of places we try to connect to avoid exponential growth
  const maxPlacesToProcess = Math.min(ecosystemPlaces.length, 50);
  const placesToProcess = ecosystemPlaces.slice(0, maxPlacesToProcess);

  placesToProcess.forEach(place => {
    // Limit connections per place to avoid saturation
    const currentConnections = Object.keys(place.exits).length;
    if (currentConnections >= 6) {
      return; // Skip places that are already well-connected
    }

    // Find nearby places within the ecosystem's hop range (optimized version)
    const nearbyPlaces = findNearbyPlacesOptimized(place, placeMap, maxHops, eligibleSet, seededRandom);

    let connectionsForThisPlace = 0;
    const maxConnectionsPerPlace = 2; // Limit to prevent over-connectivity

    for (const nearbyPlace of nearbyPlaces) {
      if (connectionsForThisPlace >= maxConnectionsPerPlace) {
        break;
      }

      if (!hasExistingConnection(place, nearbyPlace)) {
        if (createBidirectionalConnection(place, nearbyPlace, seededRandom)) {
          connectionsAdded++;
          connectionsForThisPlace++;
        }
        }
      }
  });

  if (connectionsAdded > 0) {
    console.log(`  Added ${connectionsAdded} proximity connections`);
  }
}

/**
 * Optimized version of findNearbyPlaces that uses pre-computed maps
 */
function findNearbyPlacesOptimized(
  place: Place,
  placeMap: Map<string, Place>,
  maxHops: number,
  eligibleSet: Set<string>,
  seededRandom: SeededRandom
): Place[] {
  // BFS to find places within hop distance
  const visited = new Set<string>();
  const queue: Array<{placeId: string, hops: number}> = [];
  const reachablePlaces: Place[] = [];

  queue.push({placeId: place.id, hops: 0});
  visited.add(place.id);

  // Limit search to prevent exponential explosion
  let processedNodes = 0;
  const maxNodesToProcess = 100;

  while (queue.length > 0 && processedNodes < maxNodesToProcess) {
    const {placeId, hops} = queue.shift()!;
    processedNodes++;

    const currentPlace = placeMap.get(placeId);
    if (!currentPlace) continue;

    // If we're within hop range and this place is eligible, add it
    if (hops > 0 && hops <= maxHops && eligibleSet.has(placeId)) {
      reachablePlaces.push(currentPlace);
    }

    // Continue searching if we haven't exceeded max hops
    if (hops < maxHops) {
      // Follow existing connections
      Object.values(currentPlace.exits).forEach(exit => {
        const connectedPlaceId = exit.to;
        if (!visited.has(connectedPlaceId)) {
          visited.add(connectedPlaceId);
          queue.push({placeId: connectedPlaceId, hops: hops + 1});
        }
      });
    }
  }

  // Return limited set to prevent over-connectivity
  return seededRandom.shuffle(reachablePlaces).slice(0, 2);
}

/**
 * Remove excess connections to achieve target connectivity for difficult terrain
 */
function removeExcessConnections(ecosystemPlaces: Place[], targetConnectionsPerPlace: number, allPlaces: Place[], seededRandom: SeededRandom): void {
  let connectionsRemoved = 0;
  let connectionsPreserved = 0;

  ecosystemPlaces.forEach(place => {
    const currentConnections = Object.keys(place.exits).length;
    const excessConnections = currentConnections - targetConnectionsPerPlace;

    if (excessConnections > 0) {
      const connectionsToRemove = Math.floor(excessConnections);
      const initialConnections = currentConnections;

      removeRandomConnections(place, connectionsToRemove, allPlaces, seededRandom);

      const finalConnections = Object.keys(place.exits).length;
      const actuallyRemoved = initialConnections - finalConnections;
      const preserved = connectionsToRemove - actuallyRemoved;

      connectionsRemoved += actuallyRemoved;
      connectionsPreserved += preserved;
    }
  });

  if (connectionsRemoved > 0 || connectionsPreserved > 0) {
    console.log(`  Removed ${connectionsRemoved} excess connections, preserved ${connectionsPreserved} bridge connections`);
  }
}

/**
 * Find places within graph hop distance (relationship distance)
 * This creates realistic connections by following existing paths
 */
function findNearbyPlaces(place: Place, allPlaces: Place[], maxHops: number, eligiblePlaces: Place[], seededRandom: SeededRandom): Place[] {
  // BFS to find places within hop distance
  const visited = new Set<string>();
  const queue: Array<{place: Place, hops: number}> = [];
  const reachablePlaces: Place[] = [];

  queue.push({place: place, hops: 0});
  visited.add(place.id);

  while (queue.length > 0) {
    const {place: currentPlace, hops} = queue.shift()!;

    // If we're within hop range and this place is eligible, add it
    if (hops > 0 && hops <= maxHops && eligiblePlaces.includes(currentPlace)) {
      reachablePlaces.push(currentPlace);
    }

    // Continue searching if we haven't exceeded max hops
    if (hops < maxHops) {
      // Follow existing connections
      Object.values(currentPlace.exits).forEach(exit => {
        const connectedPlace = allPlaces.find(p => p.id === exit.to);
        if (connectedPlace && !visited.has(connectedPlace.id)) {
          visited.add(connectedPlace.id);
          queue.push({place: connectedPlace, hops: hops + 1});
        }
      });
    }
  }

  return seededRandom.shuffle(reachablePlaces).slice(0, 3); // Limit to 3 connections to prevent over-connectivity
}

/**
 * Check if two places already have a connection
 */
function hasExistingConnection(place1: Place, place2: Place): boolean {
  return Object.values(place1.exits).some(exit => exit.to === place2.id);
}

/**
 * Create bidirectional connection between two places
 */
function createBidirectionalConnection(place1: Place, place2: Place, seededRandom: SeededRandom): boolean {
  // Check if already connected
  if (hasExistingConnection(place1, place2)) {
    return false;
  }

  // Find available directions
  const availableDirections = [
    Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST,
    Direction.NORTHEAST, Direction.NORTHWEST, Direction.SOUTHEAST, Direction.SOUTHWEST
  ];

  const usedDirections1 = Object.keys(place1.exits) as Direction[];
  const usedDirections2 = Object.keys(place2.exits) as Direction[];

  const availableForPlace1 = availableDirections.filter(dir => !usedDirections1.includes(dir));
  const availableForPlace2 = availableDirections.filter(dir => !usedDirections2.includes(dir));

  // Try to find compatible directions
  if (availableForPlace1.length > 0 && availableForPlace2.length > 0) {
    const direction1 = availableForPlace1[seededRandom.nextInt(availableForPlace1.length)];
    const direction2 = getOppositeDirection(direction1);

    if (availableForPlace2.includes(direction2)) {
      place1.exits[direction1] = {
        direction: direction1,
        label: `Path to ${place2.name}`,
        to: place2.id as PlaceURN
      };

      place2.exits[direction2] = {
        direction: direction2,
        label: `Path to ${place1.name}`,
        to: place1.id as PlaceURN
      };

      return true;
    }
  }

  return false;
}



/**
 * Ensure the entire world graph is connected by bridging disconnected components
 */
function ensureGlobalConnectivity(places: Place[], seededRandom: SeededRandom): void {
  let components = getConnectedComponents(places);

  if (components.length <= 1) {
    return; // Already connected
  }

  console.log(`Found ${components.length} disconnected components. Bridging them...`);

  let bridgeConnections = 0;
  let iterations = 0;
  const maxIterations = 5; // Prevent infinite loops

  // Continue bridging until we have 1 component or hit max iterations
  while (components.length > 1 && iterations < maxIterations) {
    iterations++;

    // Sort components by size (largest first)
    components.sort((a, b) => b.length - a.length);
    const mainComponent = components[0];

    // For highly fragmented worlds, use simple star topology
    if (components.length > 50) {
      // Connect ALL components to the main component
      const connectionsThisIteration = components.length - 1;
      const maxConnections = Math.min(connectionsThisIteration, 100); // Cap for performance

      for (let i = 1; i <= maxConnections; i++) {
        if (i < components.length && bridgeComponentsOptimized(mainComponent, components[i], seededRandom)) {
          bridgeConnections++;
        }
      }
    } else {
      // Normal bridging for smaller fragmentation
      const maxConnections = Math.min(components.length - 1, 50);

      for (let i = 1; i <= maxConnections; i++) {
        if (i < components.length && bridgeComponentsOptimized(mainComponent, components[i], seededRandom)) {
          bridgeConnections++;
        }
      }
    }

    // Recalculate components to see progress
    components = getConnectedComponents(places);
    console.log(`  Iteration ${iterations}: ${components.length} components remaining`);
  }

  console.log(`  Bridged ${bridgeConnections} disconnected components`);

  // Final check
  const finalComponents = getConnectedComponents(places);
  if (finalComponents.length > 1) {
    console.log(`  Warning: Still have ${finalComponents.length} disconnected components after bridging`);
  }
}

/**
 * Optimized version of bridge components that limits search scope
 */
function bridgeComponentsOptimized(component1: Place[], component2: Place[], seededRandom: SeededRandom): boolean {
  // Try to find a good connection between the components
  // Prefer places that have available direction slots
  const candidates1 = component1.filter(place => Object.keys(place.exits).length < 7).slice(0, 5);
  const candidates2 = component2.filter(place => Object.keys(place.exits).length < 7).slice(0, 5);

  // If no good candidates, use any places (but limit the search)
  const places1 = candidates1.length > 0 ? candidates1 : component1.slice(0, 3);
  const places2 = candidates2.length > 0 ? candidates2 : component2.slice(0, 3);

  // Try to create a bridge connection with limited attempts
  const maxAttempts = Math.min(5, places1.length * places2.length);
  let attempts = 0;

  for (const place1 of places1) {
    for (const place2 of places2) {
      if (attempts >= maxAttempts) {
        return false;
      }
      attempts++;

      if (createBidirectionalConnectionOptimized(place1, place2, seededRandom)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Optimized version of createBidirectionalConnection with fewer direction checks
 */
function createBidirectionalConnectionOptimized(place1: Place, place2: Place, seededRandom: SeededRandom): boolean {
  // Check if already connected
  if (hasExistingConnection(place1, place2)) {
    return false;
  }

  // Quick check - if both places are saturated, don't try
  if (Object.keys(place1.exits).length >= 8 || Object.keys(place2.exits).length >= 8) {
    return false;
  }

  // Find available directions (prioritize cardinal directions)
  const availableDirections = [
    Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST,
    Direction.NORTHEAST, Direction.NORTHWEST, Direction.SOUTHEAST, Direction.SOUTHWEST
  ];

  const usedDirections1 = new Set(Object.keys(place1.exits) as Direction[]);
  const usedDirections2 = new Set(Object.keys(place2.exits) as Direction[]);

  // Find first available direction pair
  for (const direction of availableDirections) {
    const oppositeDirection = getOppositeDirection(direction);

    if (!usedDirections1.has(direction) && !usedDirections2.has(oppositeDirection)) {
      // Create the connection
      place1.exits[direction] = {
        direction: direction,
        label: `Path to ${place2.name}`,
        to: place2.id as PlaceURN
      };

      place2.exits[oppositeDirection] = {
        direction: oppositeDirection,
        label: `Path to ${place1.name}`,
        to: place1.id as PlaceURN
      };

      return true;
    }
  }

  return false;
}

/**
 * Get all connected components in the graph
 */
export function getConnectedComponents(places: Place[]): Place[][] {
    const visited = new Set<string>();
  const components: Place[][] = [];

    for (const place of places) {
    if (visited.has(place.id)) continue;

        const component: Place[] = [];
    const queue = [place.id];
    visited.add(place.id);

        while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentPlace = places.find(p => p.id === currentId);

      if (currentPlace) {
        component.push(currentPlace);

        // Add all connected places to the queue
        Object.values(currentPlace.exits).forEach(exit => {
          if (!visited.has(exit.to)) {
            visited.add(exit.to);
            queue.push(exit.to);
          }
        });
      }
        }

        components.push(component);
  }

  return components;
}

/**
 * Bridge two components by creating a connection between them
 */
function bridgeComponents(component1: Place[], component2: Place[], seededRandom: SeededRandom): boolean {
  // Try to find a good connection between the components
  // Prefer places that have available direction slots
  const candidates1 = component1.filter(place => Object.keys(place.exits).length < 8);
  const candidates2 = component2.filter(place => Object.keys(place.exits).length < 8);

  // If no candidates with available slots, use any places
  const places1 = candidates1.length > 0 ? candidates1 : component1;
  const places2 = candidates2.length > 0 ? candidates2 : component2;

  // Try to create a bridge connection with more attempts
  const maxAttempts = Math.max(20, Math.min(places1.length * places2.length, 100));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const place1 = places1[attempt % places1.length];
    const place2 = places2[Math.floor(attempt / places1.length) % places2.length];

    if (createBidirectionalConnection(place1, place2, seededRandom)) {
      return true;
    }
  }

  // Fallback: try to force a connection by overriding existing connections if necessary
  if (places1.length > 0 && places2.length > 0) {
    const place1 = places1[0];
    const place2 = places2[0];

    // If both places have all directions occupied, free up one direction
    if (Object.keys(place1.exits).length >= 8 && Object.keys(place2.exits).length >= 8) {
      // Remove one random connection from each place
      const directions1 = Object.keys(place1.exits) as Direction[];
      const directions2 = Object.keys(place2.exits) as Direction[];

      if (directions1.length > 0 && directions2.length > 0) {
        const dirToRemove1 = directions1[seededRandom.nextInt(directions1.length)];
        const dirToRemove2 = directions2[seededRandom.nextInt(directions2.length)];

        delete place1.exits[dirToRemove1];
        delete place2.exits[dirToRemove2];

        // Now try to create the bridge connection
        return createBidirectionalConnection(place1, place2, seededRandom);
      }
    }
  }

  return false;
}

/**
 * Remove random connections from a place while preserving connectivity
 */
function removeRandomConnections(place: Place, count: number, allPlaces?: Place[], seededRandom: SeededRandom = new SeededRandom(42)): void {
  const exitDirections = Object.keys(place.exits) as Direction[];

  // Always preserve at least one connection to maintain basic connectivity
  const maxRemovable = Math.max(0, exitDirections.length - 1);
  const toRemove = Math.min(count, maxRemovable);

  if (toRemove <= 0) return;

  // Shuffle directions for random removal
  const shuffledDirections = seededRandom.shuffle([...exitDirections]);

  let removed = 0;
  for (const direction of shuffledDirections) {
    if (removed >= toRemove) break;

    const exit = place.exits[direction];
    if (!exit) continue;

    // Remove connection from both sides to maintain bidirectionality
    delete place.exits[direction];

    // Find and remove the reverse connection
    if (allPlaces) {
      const targetPlace = allPlaces.find(p => p.id === exit.to);
      if (targetPlace) {
        const reverseDirection = getOppositeDirection(direction);
        if (targetPlace.exits[reverseDirection] && targetPlace.exits[reverseDirection].to === place.id) {
          delete targetPlace.exits[reverseDirection];
        }
      }
    }

    removed++;
  }
}

/**
 * Count total connections across all places
 */
function countTotalConnections(places: Place[]): number {
  return places.reduce((total, place) => total + Object.keys(place.exits).length, 0);
}



/**
 * Calculate connection statistics from places (updated signature)
 */
function calculateConnectionStats(places: Place[]): { reciprocal: number; total: number } {
  const totalConnections = countTotalConnections(places);

  // For now, assume all connections are reciprocal (bidirectional)
  // In a real implementation, we'd analyze actual bidirectionality
  return {
    reciprocal: Math.floor(totalConnections / 2), // Each bidirectional connection counts as 2 exits
    total: totalConnections
  };
}
