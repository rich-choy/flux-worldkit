/**
 * Main World Generation Function
 * Implements continuous river flow with Gaussian ecosystem dithering
 */

import type {
  WorldGenerationConfig,
  WorldGenerationResult,
  SpatialMetrics,
  EcosystemBand,
  WorldVertex,
  RiverEdge,
  EcosystemType,
  DitheringStats,
  ConnectivityStats
} from './types';
import { PURE_RATIO, TRANSITION_RATIO } from './types';

// Default world configuration
const DEFAULT_CONFIG: Required<WorldGenerationConfig> = {
  worldWidthKm: 14.5,
  worldHeightKm: 9.0,
  branchingFactor: 1.0,
  meanderingFactor: 0.5,
  ditheringStrength: 1.0,
  gaussianSigma: 1.0,
  showZoneBoundaries: false,
  showFlowDirection: false,
  colorScheme: 'default',
  seed: Date.now()
};

// Ecosystem progression (West to East)
const ECOSYSTEM_PROGRESSION: EcosystemType[] = [
  'steppe',
  'grassland',
  'forest',
  'mountain',
  'jungle'
];

/**
 * Main world generation function
 */
export function generateWorld(config: WorldGenerationConfig = {}): WorldGenerationResult {
  console.log('🌍 Starting world generation with continuous river flow + dithering...');
  const startTime = performance.now();

  // Merge config with defaults
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Initialize random number generator
  const rng = createSeededRNG(fullConfig.seed);

  // Calculate spatial metrics
  const spatialMetrics = calculateSpatialMetrics(fullConfig);
  console.log(`📏 World dimensions: ${spatialMetrics.worldWidthMeters/1000}km × ${spatialMetrics.worldHeightMeters/1000}km`);
  console.log(`🗂️  Grid: ${spatialMetrics.gridWidth} × ${spatialMetrics.gridHeight}`);

  // PHASE 1: Define ecosystem bands (20% width each)
  console.log('\n🏭 Phase 1: Defining ecosystem bands...');
  const ecosystemBands = defineEcosystemBands(spatialMetrics);

  // PHASE 2: Generate continuous river flow with initial ecosystem assignment
  console.log('\n🌊 Phase 2: Generating continuous river flow...');
  const { vertices, edges } = generateRiverFlow(spatialMetrics, ecosystemBands, rng);

  // PHASE 3: Apply Gaussian dithering to transition zones
  console.log('\n🎲 Phase 3: Applying Gaussian ecosystem dithering...');
  const { ditheredVertices, ditheringStats } = applyEcosystemDithering(vertices, ecosystemBands, fullConfig, rng);

  // PHASE 4: Validate connectivity and ecosystem distribution
  console.log('\n✅ Phase 4: Validating connectivity and distribution...');
  const connectivityStats = validateConnectivity(ditheredVertices, edges);

  // PHASE 5: Generate places and exits (placeholder for now)
  console.log('\n🏗️  Phase 5: Generating places and exits...');
  // TODO: Convert vertices to places when needed

  // PHASE 6: Format output for React Viewport component
  console.log('\n🎨 Phase 6: Formatting visualization data...');
  const visualizationData = formatVisualizationData(ditheredVertices, edges, ecosystemBands, spatialMetrics);

  const generationTime = performance.now() - startTime;
  console.log(`\n🎉 World generation complete in ${generationTime.toFixed(1)}ms`);
  console.log(`📊 Generated ${ditheredVertices.length} vertices, ${edges.length} edges`);
  console.log(`🔗 Connectivity: ${connectivityStats.avgConnectionsPerVertex.toFixed(2)} avg connections per vertex`);

  return {
    vertices: ditheredVertices,
    edges,
    ecosystemBands,
    spatialMetrics,
    ditheringStats,
    connectivityStats,
    originVertex: ditheredVertices.find(v => v.isOrigin)!,
    boundaryLines: visualizationData.boundaryLines,
    config: fullConfig,
    generationTime,
    version: '1.0.0'
  };
}

/**
 * PHASE 1: Define ecosystem bands (20% width each)
 */
function defineEcosystemBands(metrics: SpatialMetrics): EcosystemBand[] {
  const bands: EcosystemBand[] = [];
  const bandWidth = metrics.worldWidthMeters / ECOSYSTEM_PROGRESSION.length;

  ECOSYSTEM_PROGRESSION.forEach((ecosystem, index) => {
    const startX = index * bandWidth;
    const endX = (index + 1) * bandWidth;
    const startCol = Math.floor(index * metrics.gridWidth / ECOSYSTEM_PROGRESSION.length);
    const endCol = Math.floor((index + 1) * metrics.gridWidth / ECOSYSTEM_PROGRESSION.length);

    // Calculate golden ratio zones
    const pureZoneWidth = bandWidth * PURE_RATIO; // 38.2%
    const transitionZoneWidth = bandWidth * TRANSITION_RATIO; // 61.8%

    // Pure zone is centered in the band
    const pureZoneStart = startX + (transitionZoneWidth / 2);
    const pureZoneEnd = pureZoneStart + pureZoneWidth;

    bands.push({
      ecosystem,
      startX,
      endX,
      startCol,
      endCol,
      width: bandWidth,
      pureZoneStart,
      pureZoneEnd,
      transitionZoneStart: startX,
      transitionZoneEnd: endX
    });
  });

  console.log(`🏭 Created ${bands.length} ecosystem bands:`);
  bands.forEach(band => {
    console.log(`  ${band.ecosystem}: ${band.startX.toFixed(0)}m-${band.endX.toFixed(0)}m (pure: ${band.pureZoneStart.toFixed(0)}m-${band.pureZoneEnd.toFixed(0)}m)`);
  });

  return bands;
}

/**
 * PHASE 2: Generate continuous river flow with initial ecosystem assignment
 */
function generateRiverFlow(
  metrics: SpatialMetrics,
  bands: EcosystemBand[],
  rng: () => number
): { vertices: WorldVertex[], edges: RiverEdge[] } {
  const vertices: WorldVertex[] = [];
  const edges: RiverEdge[] = [];
  const vertexMap = new Map<string, WorldVertex>();

  // Create origin vertex at westernmost column, vertically centered
  const originGridX = 0;
  const originGridY = Math.floor(metrics.gridHeight / 2);
  const originWorldX = metrics.placeMargin + originGridX * metrics.placeSpacing;
  const originWorldY = metrics.placeMargin + originGridY * metrics.placeSpacing;

  const originVertex: WorldVertex = {
    id: 'origin',
    x: originWorldX,
    y: originWorldY,
    gridX: originGridX,
    gridY: originGridY,
    ecosystem: 'steppe', // First ecosystem
    isOrigin: true,
    connections: []
  };

  vertices.push(originVertex);
  vertexMap.set(getVertexKey(originGridX, originGridY), originVertex);

  // Generate eastward flowing river network
  const activeFlowHeads: Array<{ gridX: number, gridY: number, parentId: string }> = [
    { gridX: originGridX, gridY: originGridY, parentId: 'origin' }
  ];

  console.log(`🌊 Starting river flow from origin at (${originGridX}, ${originGridY})`);

  // Propagate eastward column by column
  for (let currentCol = 1; currentCol < metrics.gridWidth; currentCol++) {
    const newFlowHeads: Array<{ gridX: number, gridY: number, parentId: string }> = [];

    // Process each active flow head
    for (const flowHead of activeFlowHeads) {
      // Generate new vertices for this flow head
      const newVertices = generateFlowFromHead(
        flowHead,
        currentCol,
        metrics,
        bands,
        rng,
        vertexMap
      );

      // Add new vertices to our collections
      for (const vertex of newVertices) {
        vertices.push(vertex);
        vertexMap.set(getVertexKey(vertex.gridX, vertex.gridY), vertex);

        // Create edge from parent to this vertex
        const parentVertex = vertexMap.get(getVertexKey(flowHead.gridX, flowHead.gridY))!;

        // Calculate distance and angle
        const dx = vertex.x - parentVertex.x;
        const dy = vertex.y - parentVertex.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI / 45) * 45; // Round to nearest 45 degrees

        // Determine flow direction based on angle
        const flowDirection = determineFlowDirection(angle);

        const edge: RiverEdge = {
          id: `${parentVertex.id}-${vertex.id}`,
          fromVertexId: parentVertex.id,
          toVertexId: vertex.id,
          flowDirection,
          distance,
          angle
        };
        edges.push(edge);

        // Update vertex connections
        parentVertex.connections.push(vertex.id);
        vertex.connections.push(parentVertex.id);

        // Add to next flow heads
        newFlowHeads.push({ gridX: vertex.gridX, gridY: vertex.gridY, parentId: vertex.id });
      }
    }

    // Update active flow heads for next column
    activeFlowHeads.length = 0;
    activeFlowHeads.push(...newFlowHeads);

    if (activeFlowHeads.length === 0) {
      console.log(`⚠️  No active flow heads at column ${currentCol}, stopping generation`);
      break;
    }
  }

  console.log(`🌊 Generated ${vertices.length} vertices and ${edges.length} edges`);
  console.log(`🌊 Final flow heads: ${activeFlowHeads.length}`);

  return { vertices, edges };
}

/**
 * Generate flow vertices from a single flow head
 */
function generateFlowFromHead(
  flowHead: { gridX: number, gridY: number, parentId: string },
  targetCol: number,
  metrics: SpatialMetrics,
  bands: EcosystemBand[],
  rng: () => number,
  vertexMap: Map<string, WorldVertex>
): WorldVertex[] {
  const newVertices: WorldVertex[] = [];
  const centerY = Math.floor(metrics.gridHeight / 2);

  // Generate possible flow directions (8-directional movement)
  const possibleMoves = [
    { dx: 1, dy: -1 }, // northeast
    { dx: 1, dy: 0 },  // east
    { dx: 1, dy: 1 }   // southeast
  ];

  // Apply boundary collision bias
  const currentY = flowHead.gridY;
  const distanceFromTop = currentY;
  const distanceFromBottom = metrics.gridHeight - 1 - currentY;
  // const distanceFromCenter = Math.abs(currentY - centerY); // TODO: Use for advanced flow patterns

  // Bias toward center when near boundaries
  const centerBias = Math.max(0, 0.7 - Math.min(distanceFromTop, distanceFromBottom) / 10);

  // Filter and weight moves based on boundary collision handling
  const weightedMoves = possibleMoves.map(move => {
    const newY = currentY + move.dy;
    let weight = 1.0;

    // Apply boundary collision bias
    if (newY <= 0 || newY >= metrics.gridHeight - 1) {
      weight *= 0.1; // Strongly discourage hitting boundaries
    } else if (newY <= 2 || newY >= metrics.gridHeight - 3) {
      weight *= 0.4; // Discourage getting close to boundaries
    }

    // Apply center bias when near boundaries
    if (centerBias > 0) {
      const moveTowardCenter = Math.sign(centerY - currentY);
      if (move.dy === moveTowardCenter) {
        weight *= (1 + centerBias);
      }
    }

    return { move, weight };
  });

  // Select number of branches (1-3 with lower probability for higher numbers)
  const branchRoll = rng();
  const numBranches = branchRoll < 0.6 ? 1 : branchRoll < 0.85 ? 2 : 3;

  // Select moves based on weights
  const selectedMoves = selectWeightedMoves(weightedMoves, numBranches, rng);

  // Create vertices for selected moves
  for (const move of selectedMoves) {
    const newGridX = targetCol;
    const newGridY = Math.max(0, Math.min(metrics.gridHeight - 1, currentY + move.dy));
    const vertexKey = getVertexKey(newGridX, newGridY);

    // Skip if vertex already exists
    if (vertexMap.has(vertexKey)) {
      continue;
    }

    const worldX = metrics.placeMargin + newGridX * metrics.placeSpacing;
    const worldY = metrics.placeMargin + newGridY * metrics.placeSpacing;

    // Determine ecosystem based on which band this vertex falls into
    const ecosystem = determineEcosystemForPosition(worldX, bands);

    const vertex: WorldVertex = {
      id: `v${newGridX}-${newGridY}`,
      x: worldX,
      y: worldY,
      gridX: newGridX,
      gridY: newGridY,
      ecosystem,
      isOrigin: false,
      connections: []
    };

    newVertices.push(vertex);
  }

  return newVertices;
}

/**
 * Select weighted moves based on probabilities
 */
function selectWeightedMoves(
  weightedMoves: Array<{ move: { dx: number, dy: number }, weight: number }>,
  numBranches: number,
  rng: () => number
): Array<{ dx: number, dy: number }> {
  const totalWeight = weightedMoves.reduce((sum, wm) => sum + wm.weight, 0);
  const selected: Array<{ dx: number, dy: number }> = [];

  for (let i = 0; i < numBranches && weightedMoves.length > 0; i++) {
    const roll = rng() * totalWeight;
    let currentWeight = 0;
    let selectedIndex = 0;

    for (let j = 0; j < weightedMoves.length; j++) {
      currentWeight += weightedMoves[j].weight;
      if (roll <= currentWeight) {
        selectedIndex = j;
        break;
      }
    }

    selected.push(weightedMoves[selectedIndex].move);
    weightedMoves.splice(selectedIndex, 1);
  }

  return selected;
}

/**
 * Determine ecosystem type based on world position
 */
function determineEcosystemForPosition(worldX: number, bands: EcosystemBand[]): EcosystemType {
  for (const band of bands) {
    if (worldX >= band.startX && worldX < band.endX) {
      return band.ecosystem;
    }
  }
  // Default to last ecosystem if somehow outside bounds
  return bands[bands.length - 1].ecosystem;
}

/**
 * Generate vertex key for map lookups
 */
function getVertexKey(gridX: number, gridY: number): string {
  return `${gridX},${gridY}`;
}

/**
 * Determine flow direction based on angle (for eastward-flowing river)
 */
function determineFlowDirection(angle: number): 'eastward' | 'westward' | 'northward' | 'southward' | 'diagonal' {
  const normalizedAngle = ((angle % 360) + 360) % 360; // Normalize to 0-360

  // Cardinal directions
  if (normalizedAngle === 0) return 'eastward';
  if (normalizedAngle === 90) return 'northward';
  if (normalizedAngle === 180) return 'westward';
  if (normalizedAngle === 270) return 'southward';

  // Diagonal directions - for eastward flowing river, these are all diagonal
  if (normalizedAngle === 45 || normalizedAngle === 315) return 'diagonal'; // NE, SE
  if (normalizedAngle === 135 || normalizedAngle === 225) return 'diagonal'; // NW, SW

  // For any other angle, return diagonal (shouldn't happen with grid alignment)
  return 'diagonal';
}

/**
 * PHASE 3: Apply Gaussian dithering to transition zones
 */
function applyEcosystemDithering(
  vertices: WorldVertex[],
  bands: EcosystemBand[],
  config: Required<WorldGenerationConfig>,
  rng: () => number
): { ditheredVertices: WorldVertex[], ditheringStats: DitheringStats } {
  console.log(`🎲 Applying Gaussian ecosystem dithering...`);

  const ditheredVertices: WorldVertex[] = vertices.map(vertex => ({ ...vertex }));
  let pureZoneVertices = 0;
  let transitionZoneVertices = 0;
  let ditheredCount = 0;

  // Initialize ecosystem counts
  const ecosystemCounts: Record<EcosystemType, number> = {
    steppe: 0,
    grassland: 0,
    forest: 0,
    mountain: 0,
    jungle: 0,
    marsh: 0
  };

  ditheredVertices.forEach(vertex => {
    // Find which band this vertex belongs to
    const band = bands.find(b => vertex.x >= b.startX && vertex.x < b.endX);
    if (!band) {
      // Keep original ecosystem if somehow outside bands
      ecosystemCounts[vertex.ecosystem]++;
      return;
    }

    // Determine if vertex is in pure zone or transition zone
    const isInPureZone = vertex.x >= band.pureZoneStart && vertex.x <= band.pureZoneEnd;

    if (isInPureZone) {
      // Pure zone: keep original ecosystem assignment
      pureZoneVertices++;
      ecosystemCounts[vertex.ecosystem]++;
    } else {
      // Transition zone: apply Gaussian dithering
      transitionZoneVertices++;

      const originalEcosystem = vertex.ecosystem;
      const newEcosystem = applyGaussianDithering(vertex, band, bands, config, rng);

      if (newEcosystem !== originalEcosystem) {
        vertex.ecosystem = newEcosystem;
        ditheredCount++;
      }

      ecosystemCounts[vertex.ecosystem]++;
    }
  });

  const ditheringStats: DitheringStats = {
    totalVertices: vertices.length,
    pureZoneVertices,
    transitionZoneVertices,
    ditheredVertices: ditheredCount,
    ecosystemCounts
  };

  console.log(`🎲 Dithering complete: ${ditheredCount}/${transitionZoneVertices} transition vertices modified`);
  console.log(`🎲 Pure zones: ${pureZoneVertices}, Transition zones: ${transitionZoneVertices}`);

  return { ditheredVertices, ditheringStats };
}

/**
 * Apply Gaussian dithering to a single vertex in a transition zone
 */
function applyGaussianDithering(
  vertex: WorldVertex,
  currentBand: EcosystemBand,
  allBands: EcosystemBand[],
  config: Required<WorldGenerationConfig>,
  rng: () => number
): EcosystemType {
  // Find adjacent ecosystems
  const currentBandIndex = allBands.indexOf(currentBand);
  const adjacentEcosystems: EcosystemType[] = [];

  // Add previous ecosystem (westward)
  if (currentBandIndex > 0) {
    adjacentEcosystems.push(allBands[currentBandIndex - 1].ecosystem);
  }

  // Add next ecosystem (eastward)
  if (currentBandIndex < allBands.length - 1) {
    adjacentEcosystems.push(allBands[currentBandIndex + 1].ecosystem);
  }

  // If no adjacent ecosystems, keep current
  if (adjacentEcosystems.length === 0) {
    return vertex.ecosystem;
  }

  // Calculate distance from band center
  const bandCenter = (currentBand.startX + currentBand.endX) / 2;
  const distanceFromCenter = Math.abs(vertex.x - bandCenter);
  const maxDistanceFromCenter = currentBand.width / 2;
  const normalizedDistance = distanceFromCenter / maxDistanceFromCenter;

  // Apply Gaussian probability based on distance and dithering strength
  const gaussianFactor = Math.exp(-Math.pow(normalizedDistance / config.gaussianSigma, 2));
  const ditheringProbability = config.ditheringStrength * (1 - gaussianFactor);

  // Decide whether to dither
  if (rng() < ditheringProbability) {
    // Choose which adjacent ecosystem to switch to
    const targetEcosystem = adjacentEcosystems[Math.floor(rng() * adjacentEcosystems.length)];
    return targetEcosystem;
  }

  // Keep original ecosystem
  return vertex.ecosystem;
}

/**
 * PHASE 4: Validate connectivity and ecosystem distribution
 */
function validateConnectivity(vertices: WorldVertex[], edges: RiverEdge[]): ConnectivityStats {
  console.log(`✅ TODO: Implement connectivity validation`);

  // Placeholder stats
  const connectivityStats: ConnectivityStats = {
    totalVertices: vertices.length,
    totalEdges: edges.length,
    avgConnectionsPerVertex: 0,
    connectedComponents: 1,
    ecosystemConnectivity: {
      steppe: { count: 0, avgConnections: 0 },
      grassland: { count: 0, avgConnections: 0 },
      forest: { count: 0, avgConnections: 0 },
      mountain: { count: 0, avgConnections: 0 },
      jungle: { count: 0, avgConnections: 0 },
      marsh: { count: 0, avgConnections: 0 }
    }
  };

  return connectivityStats;
}

/**
 * PHASE 6: Format visualization data for React Viewport
 */
function formatVisualizationData(
  _vertices: WorldVertex[],
  _edges: RiverEdge[],
  bands: EcosystemBand[],
  _metrics: SpatialMetrics
) {
  const boundaryLines = bands.flatMap(band => [
    { x: band.startX, ecosystem: band.ecosystem, type: 'band' as const },
    { x: band.pureZoneStart, ecosystem: band.ecosystem, type: 'pure' as const },
    { x: band.pureZoneEnd, ecosystem: band.ecosystem, type: 'pure' as const },
    { x: band.endX, ecosystem: band.ecosystem, type: 'transition' as const }
  ]);

  return { boundaryLines };
}

/**
 * Calculate spatial metrics for world generation
 */
function calculateSpatialMetrics(config: Required<WorldGenerationConfig>): SpatialMetrics {
  const worldWidthMeters = config.worldWidthKm * 1000;
  const worldHeightMeters = config.worldHeightKm * 1000;

  // Use 300m spacing between places (from original system)
  const placeSpacing = 300;
  const placeMargin = 200;

  const gridWidth = Math.floor((worldWidthMeters - 2 * placeMargin) / placeSpacing);
  const gridHeight = Math.floor((worldHeightMeters - 2 * placeMargin) / placeSpacing);

  return {
    worldWidthMeters,
    worldHeightMeters,
    gridWidth,
    gridHeight,
    placeSpacing,
    placeMargin
  };
}

/**
 * Create a seeded random number generator
 */
function createSeededRNG(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % (2 ** 32);
    return state / (2 ** 32);
  };
}
