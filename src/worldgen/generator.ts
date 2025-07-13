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
  ditheringStrength: 0.5,
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
  const { vertices, edges } = generateRiverFlow(spatialMetrics, ecosystemBands, fullConfig, rng);

  // PHASE 3: Apply Gaussian dithering to transition zones
  console.log('\n🎲 Phase 3: Applying Gaussian ecosystem dithering...');
  console.log(`🎲 Dithering strength: ${fullConfig.ditheringStrength} (${fullConfig.ditheringStrength === 0 ? 'no dithering' : fullConfig.ditheringStrength === 1 ? 'maximum dithering' : 'moderate dithering'})`);
  const { ditheredVertices, ditheringStats } = applyEcosystemDithering(vertices, ecosystemBands, fullConfig, rng);

  // PHASE 3.5: Apply eastern marsh zone
  console.log('\n🏞️  Phase 3.5: Applying eastern marsh zone...');
  const { marshVertices, marshStats } = applyEasternMarshZone(ditheredVertices);

  // PHASE 4: Validate connectivity and ecosystem distribution
  console.log('\n✅ Phase 4: Validating connectivity and distribution...');
  const connectivityStats = validateConnectivity(marshVertices, edges);

  // PHASE 5: Generate places and exits (placeholder for now)
  console.log('\n🏗️  Phase 5: Generating places and exits...');
  // TODO: Convert vertices to places when needed

  // PHASE 6: Format output for React Viewport component
  console.log('\n🎨 Phase 6: Formatting visualization data...');
  const visualizationData = formatVisualizationData(marshVertices, edges, ecosystemBands, spatialMetrics);

  const generationTime = performance.now() - startTime;
  console.log(`\n🎉 World generation complete in ${generationTime.toFixed(1)}ms`);
  console.log(`📊 Generated ${marshVertices.length} vertices, ${edges.length} edges`);
  console.log(`🔗 Connectivity: ${connectivityStats.avgConnectionsPerVertex.toFixed(2)} avg connections per vertex`);

  return {
    vertices: marshVertices,
    edges,
    ecosystemBands,
    spatialMetrics,
    ditheringStats,
    connectivityStats,
    originVertex: marshVertices.find(v => v.isOrigin)!,
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
  config: Required<WorldGenerationConfig>,
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
  console.log(`🌊 Branching factor: ${config.branchingFactor} (${config.branchingFactor === 0 ? 'no branching' : config.branchingFactor === 1 ? 'maximum branching' : 'moderate branching'})`);

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
        config,
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
  config: Required<WorldGenerationConfig>,
  rng: () => number,
  vertexMap: Map<string, WorldVertex>
): WorldVertex[] {
  const newVertices: WorldVertex[] = [];
  const centerY = Math.floor(metrics.gridHeight / 2);

  // Generate possible flow directions with vertical bias
  const possibleMoves = [
    { dx: 1, dy: -1 }, // northeast (diagonal)
    { dx: 1, dy: 0 },  // east (horizontal)
    { dx: 1, dy: 1 },  // southeast (diagonal)
    { dx: 0, dy: -1 }, // north (vertical)
    { dx: 0, dy: 1 }   // south (vertical)
  ];

  // Apply boundary collision bias
  const currentY = flowHead.gridY;
  const distanceFromTop = currentY;
  const distanceFromBottom = metrics.gridHeight - 1 - currentY;
  // const distanceFromCenter = Math.abs(currentY - centerY); // TODO: Use for advanced flow patterns

  // Bias toward center when near boundaries
  const centerBias = Math.max(0, 0.7 - Math.min(distanceFromTop, distanceFromBottom) / 10);

  // Filter and weight moves based on directional bias and boundary collision handling
  const weightedMoves = possibleMoves.map(move => {
    const newY = currentY + move.dy;
    let weight = 1.0;

    // Apply directional bias: favor vertical over diagonal, maintain eastward flow
    if (move.dx === 1 && move.dy === 0) {
      // Pure eastward movement - highest weight to maintain eastward flow
      weight *= 1.5;
    } else if (move.dx === 0 && (move.dy === -1 || move.dy === 1)) {
      // Pure vertical movement - high weight for vertical bias
      weight *= 1.2;
    } else if (move.dx === 1 && (move.dy === -1 || move.dy === 1)) {
      // Diagonal movement - reduced weight
      weight *= 0.6;
    }

    // Apply boundary collision bias
    if (newY <= 0 || newY >= metrics.gridHeight - 1) {
      weight *= 0.1; // Strongly discourage hitting boundaries
    } else if (newY <= 2 || newY >= metrics.gridHeight - 3) {
      weight *= 0.4; // Discourage getting close to boundaries
    }

    // Ensure eastward progression: if we're not at the target column yet,
    // slightly favor eastward moves to prevent stalling
    if (flowHead.gridX < targetCol - 1) {
      if (move.dx === 1) {
        weight *= 1.1; // Slight boost for eastward moves when far from target
      }
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

  // Select number of branches based on branching factor
  // branchingFactor 0.0 = always 1 branch, 1.0 = always 3 branches
  const branchRoll = rng();
  let numBranches = 1;

  if (config.branchingFactor > 0) {
    // Calculate probabilities based on branching factor
    const singleBranchProb = 1 - config.branchingFactor * 0.8; // 0.8 at max branching
    const doubleBranchProb = config.branchingFactor * 0.6; // 0.6 at max branching

    if (branchRoll < singleBranchProb) {
      numBranches = 1;
    } else if (branchRoll < singleBranchProb + doubleBranchProb) {
      numBranches = 2;
    } else {
      numBranches = 3;
    }
  }

  // Select moves based on weights
  const selectedMoves = selectWeightedMoves(weightedMoves, numBranches, rng);

  // Create vertices for selected moves
  for (const move of selectedMoves) {
    const newGridX = flowHead.gridX + move.dx;
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

  // Store original ecosystems before any dithering to prevent cascading effects
  const originalEcosystems = new Map<string, EcosystemType>();
  ditheredVertices.forEach(vertex => {
    originalEcosystems.set(vertex.id, vertex.ecosystem);
  });

  // Track which vertices have already been dithered to prevent multiple modifications
  const alreadyDithered = new Set<string>();

    ditheredVertices.forEach(vertex => {
    const originalEcosystem = originalEcosystems.get(vertex.id)!;

    // Find the band that corresponds to the vertex's ORIGINAL ecosystem
          const originalBand = bands.find(b => b.ecosystem === originalEcosystem)!;

    // Debug: (removed for production)

    // Apply boundary-based dithering to all vertices (boundary proximity prevents discrete bands)
    if (!alreadyDithered.has(vertex.id)) {
      const newEcosystem = applyGaussianDithering(vertex, originalBand, bands, config, rng, originalEcosystem);

      if (newEcosystem !== originalEcosystem) {
        vertex.ecosystem = newEcosystem;
        alreadyDithered.add(vertex.id);
        ditheredCount++;
      }
    }

    // Track statistics based on pure/transition zones for reporting
    const isInOriginalBand = vertex.x >= originalBand.startX && vertex.x < originalBand.endX;
    const isInOriginalPureZone = vertex.x >= originalBand.pureZoneStart && vertex.x <= originalBand.pureZoneEnd;
    const isInOriginalTransitionZone = isInOriginalBand && !isInOriginalPureZone;

    if (isInOriginalTransitionZone) {
      transitionZoneVertices++;
    } else {
      pureZoneVertices++;
    }

    ecosystemCounts[vertex.ecosystem]++;
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
 * PHASE 3.5: Apply eastern marsh zone - assign all vertices in easternmost column to marsh
 */
function applyEasternMarshZone(vertices: WorldVertex[]): {
  marshVertices: WorldVertex[],
  marshStats: { totalVertices: number; marshVertices: number; easternColumn: number }
} {
  console.log(`🏞️  Applying eastern marsh zone...`);

  const marshVertices: WorldVertex[] = vertices.map(vertex => ({ ...vertex }));

  // Find the easternmost column
  const easternColumn = Math.max(...vertices.map(v => v.gridX));

  // Count vertices in eastern column before conversion
  const easternVertices = vertices.filter(v => v.gridX === easternColumn);

  // Assign marsh ecosystem to all vertices in easternmost column
  let marshCount = 0;
  marshVertices.forEach(vertex => {
    if (vertex.gridX === easternColumn) {
      vertex.ecosystem = 'marsh';
      marshCount++;
    }
  });

  const marshStats = {
    totalVertices: vertices.length,
    marshVertices: marshCount,
    easternColumn
  };

  console.log(`🏞️  Eastern marsh zone applied: ${marshCount} vertices in column ${easternColumn} converted to marsh`);

  return { marshVertices, marshStats };
}

/**
 * Apply Gaussian dithering to a single vertex in a transition zone
 */
function applyGaussianDithering(
  vertex: WorldVertex,
  currentBand: EcosystemBand,
  allBands: EcosystemBand[],
  config: Required<WorldGenerationConfig>,
  rng: () => number,
  originalEcosystem: EcosystemType
): EcosystemType {
  // Find adjacent ecosystems
  const currentBandIndex = allBands.findIndex(b => b.ecosystem === currentBand.ecosystem);
  const adjacentEcosystems: EcosystemType[] = [];

  // Add previous ecosystem (westward)
  if (currentBandIndex > 0) {
    adjacentEcosystems.push(allBands[currentBandIndex - 1].ecosystem);
  }

  // Add next ecosystem (eastward)
  if (currentBandIndex < allBands.length - 1) {
    adjacentEcosystems.push(allBands[currentBandIndex + 1].ecosystem);
  }

  // Debug: (removed for production)

  // If no adjacent ecosystems, keep original
  if (adjacentEcosystems.length === 0) {
    return originalEcosystem;
  }

  // Calculate smooth transition probabilities based on distance to ecosystem boundaries
  const ecosystemProbabilities: { ecosystem: EcosystemType; probability: number }[] = [];

  // Base probability for staying in original ecosystem
  let originalProbability = 1.0;

      // Calculate transition probabilities to adjacent ecosystems
  adjacentEcosystems.forEach(adjEcosystem => {
    const adjBand = allBands.find(b => b.ecosystem === adjEcosystem)!;

    // Determine the boundary between current and adjacent ecosystem
    let boundaryX: number;
    let distanceToBoundary: number;
    let isInDitheringZone = false;

          if (adjBand.startX >= currentBand.endX) {
        // Adjacent band is to the right - boundary is at current band's right edge
        boundaryX = currentBand.endX;
        distanceToBoundary = boundaryX - vertex.x; // Distance from vertex to right boundary

        // Dithering zone extends 38% of band width from the boundary
        const ditheringZoneWidth = currentBand.width * 0.38;
        isInDitheringZone = distanceToBoundary >= 0 && distanceToBoundary <= ditheringZoneWidth;

      } else if (adjBand.endX <= currentBand.startX) {
        // Adjacent band is to the left - boundary is at current band's left edge
        boundaryX = currentBand.startX;
        distanceToBoundary = vertex.x - boundaryX; // Distance from vertex to left boundary

        // Dithering zone extends 38% of band width from the boundary
        const ditheringZoneWidth = currentBand.width * 0.38;
        isInDitheringZone = distanceToBoundary >= 0 && distanceToBoundary <= ditheringZoneWidth;

      } else {
        // This shouldn't happen with non-overlapping bands
        return;
      }

    // Debug: (removed for production)

    // Only apply transition probability if vertex is in the dithering zone
    if (!isInDitheringZone) {
      return;
    }

    // Debug: (removed for production)

    // Distance-based transition probability
    const maxTransitionDistance = currentBand.width * 0.38; // 38% of band width for transition
    const normalizedDistance = Math.min(Math.abs(distanceToBoundary) / maxTransitionDistance, 1.0);

    // Smooth transition curve: closer to boundary = higher transition probability
    const transitionStrength = config.ditheringStrength;
    const transitionProbability = transitionStrength * Math.exp(-Math.pow(normalizedDistance * 2, 2));

    ecosystemProbabilities.push({
      ecosystem: adjEcosystem,
      probability: transitionProbability
    });

    // Reduce original probability by transition probability
    originalProbability -= transitionProbability;
  });

  // Ensure probabilities are valid
  originalProbability = Math.max(0, originalProbability);

  // Add original ecosystem probability
  ecosystemProbabilities.push({
    ecosystem: originalEcosystem,
    probability: originalProbability
  });

  // Normalize probabilities to sum to 1
  const totalProbability = ecosystemProbabilities.reduce((sum, ep) => sum + ep.probability, 0);
  if (totalProbability > 0) {
    ecosystemProbabilities.forEach(ep => ep.probability /= totalProbability);
  }

  // Select ecosystem based on probabilities
  const rand = rng();
  let cumulativeProbability = 0;

  for (const ep of ecosystemProbabilities) {
    cumulativeProbability += ep.probability;
    if (rand < cumulativeProbability) {
      return ep.ecosystem;
    }
  }

  // Fallback to original ecosystem
  return originalEcosystem;
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
