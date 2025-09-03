/**
 * Main World Generation Function
 * Implements continuous river flow with Gaussian ecosystem dithering
 * Uses Golden Ratio bleeding proportions for natural ecosystem transitions
 */

import type {
  WorldGenerationConfig,
  WorldGenerationResult,
  SpatialMetrics,
  EcosystemBand,
  WorldVertex,
  RiverEdge,
  DitheringStats,
  ConnectivityStats
} from './types';
import { PURE_RATIO, TRANSITION_RATIO, ECOSYSTEM_URNS } from './types';
import type { EcosystemURN } from '@flux';
import { Direction } from '@flux';
import type { PlaceURN } from '@flux';
import { generatePlaceURN } from './export';

// Add type definitions at the top
interface ConnectivityState {
  vertices: WorldVertex[];
  edges: RiverEdge[];
  stats: {
    connectivity: Record<EcosystemURN, number>;
    edgesAdded: number;
    edgesRemoved: number;
    iteration: number;
    improvement: number;
  };
}

interface ConnectivityAction {
  type: 'ADD_EDGE' | 'REMOVE_EDGE' | 'REVERT_CHANGES';
  ecosystem?: EcosystemURN;
  fromVertex?: WorldVertex;
  toVertex?: WorldVertex;
}

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

// Ecosystem progression (West to East) - using the first 5 URNs
const ECOSYSTEM_PROGRESSION: readonly EcosystemURN[] = ECOSYSTEM_URNS.slice(0, 5);

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

  // PHASE 2.5: Apply diagonal intersection rule (convert X patterns to squares)
  console.log('\n🔲 Phase 2.5: Applying diagonal intersection rule...');
  const { processedVertices, processedEdges, squaresCreated } = applyDiagonalIntersectionRule(vertices, edges);
  console.log(`🔲 Diagonal intersection rule created ${squaresCreated} squares`);

  // PHASE 3: Apply Gaussian dithering to transition zones
  console.log('\n🎲 Phase 3: Applying Gaussian ecosystem dithering...');
  console.log(`🎲 Dithering strength: ${fullConfig.ditheringStrength} (${fullConfig.ditheringStrength === 0 ? 'no dithering' : fullConfig.ditheringStrength === 1 ? 'maximum dithering' : 'moderate dithering'})`);
  const { ditheredVertices, ditheringStats } = applyEcosystemDithering(processedVertices, ecosystemBands, fullConfig, rng);

  // PHASE 3.5: Adjust connectivity per ecosystem
  console.log('\n🔗 Phase 3.5: Adjusting connectivity per ecosystem...');
  const { connectivityVertices, adjustedEdges } = adjustEcosystemConnectivity(ditheredVertices, processedEdges, rng, spatialMetrics);

  // PHASE 3.6: Apply eastern marsh zone
  console.log('\n🏞️  Phase 3.6: Applying eastern marsh zone...');
  const { marshVertices } = applyEasternMarshZone(connectivityVertices);

  // PHASE 3.7: Generate Place URNs after ecosystem finalization
  console.log('\n🏗️  Phase 3.7: Generating Place URNs after ecosystem finalization...');
  const finalVertices = generatePlaceURNsAfterEcosystemFinalization(marshVertices);

  // PHASE 4: Validate connectivity and ecosystem distribution
  console.log('\n✅ Phase 4: Validating connectivity and distribution...');
  const connectivityStats = validateConnectivity(finalVertices, adjustedEdges);

  // PHASE 5: Generate places and exits (placeholder for now)
  console.log('\n🏗️  Phase 5: Generating places and exits...');
  // TODO: Convert vertices to places when needed

  // PHASE 6: Format output for React Viewport component
  console.log('\n🎨 Phase 6: Formatting visualization data...');
  const visualizationData = formatVisualizationData(finalVertices, adjustedEdges, ecosystemBands, spatialMetrics);

  const generationTime = performance.now() - startTime;
  console.log(`\n🎉 World generation complete in ${generationTime.toFixed(1)}ms`);
  console.log(`📊 Generated ${finalVertices.length} vertices, ${adjustedEdges.length} edges`);
  console.log(`🔗 Connectivity: ${connectivityStats.avgConnectionsPerVertex.toFixed(2)} avg connections per vertex`);

  return {
    vertices: finalVertices,
    edges: adjustedEdges,
    ecosystemBands,
    spatialMetrics,
    ditheringStats,
    connectivityStats,
    originVertex: finalVertices.find(v => v.isOrigin)!,
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
    const endCol = Math.ceil((index + 1) * metrics.gridWidth / ECOSYSTEM_PROGRESSION.length);

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
    placeId: 'flux:place:origin',
    x: originWorldX,
    y: originWorldY,
    gridX: originGridX,
    gridY: originGridY,
    ecosystem: ECOSYSTEM_URNS[0], // First ecosystem (steppe)
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

    // Ensure eastward progression: progressively increase eastward bias as we approach the boundary
    const distanceFromEasternBoundary = metrics.gridWidth - 1 - flowHead.gridX;

    if (flowHead.gridX < targetCol) {
      if (move.dx === 1) {
        // Scale eastward bias based on proximity to eastern boundary
        if (distanceFromEasternBoundary <= 2) {
          // Very close to boundary - strong eastward bias
          weight *= 3.0;
        } else if (distanceFromEasternBoundary <= 5) {
          // Approaching boundary - moderate eastward bias
          weight *= 2.0;
        } else {
          // Far from boundary - slight eastward bias
          weight *= 1.3;
        }
      } else if (move.dx === 0 && distanceFromEasternBoundary <= 2) {
        // Reduce vertical move weight when very close to boundary
        weight *= 0.3;
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
      placeId: '' as PlaceURN, // URN will be generated after ecosystem finalization
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
function determineEcosystemForPosition(worldX: number, bands: EcosystemBand[]): EcosystemURN {
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
 * Apply diagonal intersection rule: Convert X patterns to squares
 * When two diagonal edges intersect and form a perfect 2x2 square,
 * add the missing orthogonal connections to complete the square.
 */
function applyDiagonalIntersectionRule(
  vertices: WorldVertex[],
  edges: RiverEdge[]
): {
  processedVertices: WorldVertex[],
  processedEdges: RiverEdge[],
  squaresCreated: number
} {
  console.log('🔲 Applying diagonal intersection rule...');

  const processedVertices: WorldVertex[] = vertices.map(v => ({
    ...v,
    connections: [...v.connections]
  }));

  const processedEdges: RiverEdge[] = [...edges];

  // Create vertex lookup map for efficient access
  const vertexMap = new Map<string, WorldVertex>();
  processedVertices.forEach(v => vertexMap.set(v.id, v));

  // Find all diagonal edges
  const diagonalEdges = processedEdges.filter(edge => {
    const angle = Math.abs(edge.angle);
    return angle === 45 || angle === 135 || angle === 225 || angle === 315;
  });

  console.log(`🔍 Found ${diagonalEdges.length} diagonal edges to analyze`);

  let squaresCreated = 0;

  // Find all potential 2x2 squares by checking diagonal edge intersections
  for (let i = 0; i < diagonalEdges.length; i++) {
    for (let j = i + 1; j < diagonalEdges.length; j++) {
      const edge1 = diagonalEdges[i];
      const edge2 = diagonalEdges[j];

      // Check if these edges could form part of a 2x2 square
      const squareVertices = findSquareVertices(edge1, edge2, vertexMap);

      if (squareVertices) {
        const { topLeft } = squareVertices;

        // Check if this is a valid 2x2 square with diagonal intersections
        if (isValidDiagonalIntersection(edge1, edge2, squareVertices)) {
          // Add the missing orthogonal connections
          const addedConnections = addOrthogonalConnections(
            squareVertices,
            processedVertices,
            processedEdges,
            vertexMap
          );

          if (addedConnections > 0) {
            squaresCreated++;
            console.log(`🔲 Created square at (${topLeft.gridX},${topLeft.gridY}) - added ${addedConnections} connections`);
          }
        }
      }
    }
  }

  console.log(`🔲 Diagonal intersection rule complete: ${squaresCreated} squares created`);

  return {
    processedVertices,
    processedEdges,
    squaresCreated
  };
}

/**
 * Find the four vertices that would form a 2x2 square from two diagonal edges
 */
function findSquareVertices(
  edge1: RiverEdge,
  edge2: RiverEdge,
  vertexMap: Map<string, WorldVertex>
): {
  topLeft: WorldVertex,
  topRight: WorldVertex,
  bottomLeft: WorldVertex,
  bottomRight: WorldVertex
} | null {
  const vertex1A = vertexMap.get(edge1.fromVertexId);
  const vertex1B = vertexMap.get(edge1.toVertexId);
  const vertex2A = vertexMap.get(edge2.fromVertexId);
  const vertex2B = vertexMap.get(edge2.toVertexId);

  if (!vertex1A || !vertex1B || !vertex2A || !vertex2B) {
    return null;
  }

  // Collect all four vertices involved in the two edges
  const allVertices = [vertex1A, vertex1B, vertex2A, vertex2B];

  // Remove duplicates (in case edges share vertices)
  const uniqueVertices = allVertices.filter((v, index, arr) =>
    arr.findIndex(other => other.id === v.id) === index
  );

  // We need exactly 4 vertices for a square
  if (uniqueVertices.length !== 4) {
    return null;
  }

  // Find the bounding box
  const minX = Math.min(...uniqueVertices.map(v => v.gridX));
  const maxX = Math.max(...uniqueVertices.map(v => v.gridX));
  const minY = Math.min(...uniqueVertices.map(v => v.gridY));
  const maxY = Math.max(...uniqueVertices.map(v => v.gridY));

  // Check if this forms a valid 2x2 square (difference of 1 in both dimensions)
  if (maxX - minX !== 1 || maxY - minY !== 1) {
    return null;
  }

  // Find vertices at each corner
  const topLeft = uniqueVertices.find(v => v.gridX === minX && v.gridY === minY);
  const topRight = uniqueVertices.find(v => v.gridX === maxX && v.gridY === minY);
  const bottomLeft = uniqueVertices.find(v => v.gridX === minX && v.gridY === maxY);
  const bottomRight = uniqueVertices.find(v => v.gridX === maxX && v.gridY === maxY);

  if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
    return null;
  }

  return { topLeft, topRight, bottomLeft, bottomRight };
}

/**
 * Check if two diagonal edges form a valid X intersection in the square
 */
function isValidDiagonalIntersection(
  edge1: RiverEdge,
  edge2: RiverEdge,
  square: {
    topLeft: WorldVertex,
    topRight: WorldVertex,
    bottomLeft: WorldVertex,
    bottomRight: WorldVertex
  }
): boolean {
  // Get the vertices for each edge
  const edge1Vertices = [edge1.fromVertexId, edge1.toVertexId];
  const edge2Vertices = [edge2.fromVertexId, edge2.toVertexId];

  // Check if we have the two diagonal connections for an X pattern
  // Diagonal 1: topLeft to bottomRight
  const hasDiagonal1 =
    (edge1Vertices.includes(square.topLeft.id) && edge1Vertices.includes(square.bottomRight.id)) ||
    (edge2Vertices.includes(square.topLeft.id) && edge2Vertices.includes(square.bottomRight.id));

  // Diagonal 2: topRight to bottomLeft
  const hasDiagonal2 =
    (edge1Vertices.includes(square.topRight.id) && edge1Vertices.includes(square.bottomLeft.id)) ||
    (edge2Vertices.includes(square.topRight.id) && edge2Vertices.includes(square.bottomLeft.id));

  return hasDiagonal1 && hasDiagonal2;
}

/**
 * Add the missing orthogonal connections to complete the square
 */
function addOrthogonalConnections(
  square: {
    topLeft: WorldVertex,
    topRight: WorldVertex,
    bottomLeft: WorldVertex,
    bottomRight: WorldVertex
  },
  _vertices: WorldVertex[],
  edges: RiverEdge[],
  vertexMap: Map<string, WorldVertex>
): number {
  let addedConnections = 0;

  // Define the orthogonal connections needed for a complete square
  const orthogonalConnections = [
    { from: square.topLeft, to: square.topRight, angle: 0 },      // horizontal top
    { from: square.topRight, to: square.bottomRight, angle: 90 }, // vertical right
    { from: square.bottomRight, to: square.bottomLeft, angle: 180 }, // horizontal bottom
    { from: square.bottomLeft, to: square.topLeft, angle: 270 }   // vertical left
  ];

  for (const connection of orthogonalConnections) {
    const fromVertex = vertexMap.get(connection.from.id);
    const toVertex = vertexMap.get(connection.to.id);

    if (!fromVertex || !toVertex) continue;

    // Check if connection already exists
    if (fromVertex.connections.includes(toVertex.id)) {
      continue;
    }

    // Add the connection to both vertices
    fromVertex.connections.push(toVertex.id);
    toVertex.connections.push(fromVertex.id);

    // Calculate distance and flow direction
    const dx = toVertex.x - fromVertex.x;
    const dy = toVertex.y - fromVertex.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const flowDirection = determineFlowDirection(connection.angle);

    // Create the edge
    const newEdge: RiverEdge = {
      id: `${fromVertex.id}-${toVertex.id}`,
      fromVertexId: fromVertex.id,
      toVertexId: toVertex.id,
      flowDirection,
      distance,
      angle: connection.angle
    };

    edges.push(newEdge);
    addedConnections++;
  }

  return addedConnections;
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
  const ecosystemCounts = {} as Record<EcosystemURN, number>;
  ECOSYSTEM_URNS.forEach(urn => {
    ecosystemCounts[urn] = 0;
  });

  // Store original ecosystems before any dithering to prevent cascading effects
  const originalEcosystems = new Map<string, EcosystemURN>();
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
    const isInOriginalPureZone = isInOriginalBand && vertex.x >= originalBand.pureZoneStart && vertex.x <= originalBand.pureZoneEnd;

    // A vertex is in a transition zone if:
    // 1. It's in its original band but outside the pure zone, OR
    // 2. It's outside its original band entirely (dithered into another band)
    if (isInOriginalPureZone) {
      pureZoneVertices++;
    } else {
      transitionZoneVertices++;
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

  // Assign marsh ecosystem to all vertices in easternmost column
  let marshCount = 0;
  marshVertices.forEach(vertex => {
    if (vertex.gridX === easternColumn) {
      vertex.ecosystem = ECOSYSTEM_URNS[ECOSYSTEM_URNS.length - 1];
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
 * Memoized helper to calculate ecosystem connectivity
 */
const createConnectivityCalculator = () => {
  const cache = new Map<string, Record<EcosystemURN, number>>();

  return {
    calculate: (vertices: WorldVertex[]): Record<EcosystemURN, number> => {
      // Create cache key from vertex connections
      const cacheKey = vertices.map(v => `${v.id}:[${v.connections.sort().join(',')}]`).join('|');

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!;
      }

      const result = calculateEcosystemConnectivity(vertices);
      cache.set(cacheKey, result);
      return result;
    },

    // Invalidate cache when graph structure changes significantly
    invalidate: () => cache.clear()
  };
};

/**
 * Memoized helper to find potential neighbors for a vertex
 */
const createNeighborFinder = () => {
  const cache = new Map<string, WorldVertex[]>();

  return (vertex: WorldVertex, vertices: WorldVertex[], maxDistance: number = 1): WorldVertex[] => {
    const cacheKey = `${vertex.id}:${maxDistance}`;

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const neighbors = vertices.filter(v =>
      v.id !== vertex.id &&
      !vertex.connections.includes(v.id) &&
      Math.abs(v.x - vertex.x) <= maxDistance &&
      Math.abs(v.y - vertex.y) <= maxDistance
    );

    cache.set(cacheKey, neighbors);
    return neighbors;
  };
};

/**
 * Memoized score calculator
 */
const createScoreCalculator = () => {
  const cache = new Map<string, number>();

  return (current: Record<EcosystemURN, number>, target: Record<EcosystemURN, number>): number => {
    const cacheKey = JSON.stringify({ current, target });

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const deltas = Object.entries(target).map(([eco, targetValue]) => {
      const currentValue = current[eco as EcosystemURN] || 0;
      return Math.abs(targetValue - currentValue);
    });

    const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
    const score = 1 / (1 + avgDelta);

    cache.set(cacheKey, score);
    return score;
  };
};

/**
 * Reducer function that iteratively improves ecosystem connectivity
 */
// @ts-expect-error
function connectivityReducer(
  state: ConnectivityState,
  action: ConnectivityAction,
  // @ts-expect-error
  rng: () => number,
  calculators: {
    connectivity: ReturnType<typeof createConnectivityCalculator>;
    neighbors: ReturnType<typeof createNeighborFinder>;
    score: ReturnType<typeof createScoreCalculator>;
  }
): ConnectivityState {
  switch (action.type) {
    case 'ADD_EDGE': {
      const { ecosystem, fromVertex, toVertex } = action;
      if (!ecosystem || !fromVertex || !toVertex) return state;

      // Calculate edge properties
      const dx = toVertex.x - fromVertex.x;
      const dy = toVertex.y - fromVertex.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Determine flow direction
      let flowDirection: RiverEdge['flowDirection'] = 'diagonal';
      if (angle === 0) flowDirection = 'eastward';
      else if (angle === 90) flowDirection = 'northward';
      else if (angle === 180) flowDirection = 'westward';
      else if (angle === 270) flowDirection = 'southward';

      // Create new edge
      const newEdge: RiverEdge = {
        id: `${fromVertex.id}->${toVertex.id}`,
        fromVertexId: fromVertex.id,
        toVertexId: toVertex.id,
        flowDirection,
        distance,
        angle
      };

      // Update connections
      const newVertices = state.vertices.map(v => {
        if (v.id === fromVertex.id) {
          return {
            ...v,
            connections: [...v.connections, toVertex.id]
          };
        }
        if (v.id === toVertex.id) {
          return {
            ...v,
            connections: [...v.connections, fromVertex.id]
          };
        }
        return v;
      });

      // Calculate new connectivity using memoized calculator
      const connectivity = calculators.connectivity.calculate(newVertices);

      return {
        vertices: newVertices,
        edges: [...state.edges, newEdge],
        stats: {
          ...state.stats,
          edgesAdded: state.stats.edgesAdded + 1,
          connectivity
        }
      };
    }

    case 'REMOVE_EDGE': {
      const { fromVertex, toVertex } = action;
      if (!fromVertex || !toVertex) return state;

      // Remove edge
      const newEdges = state.edges.filter(e =>
        !(e.fromVertexId === fromVertex.id && e.toVertexId === toVertex.id) &&
        !(e.fromVertexId === toVertex.id && e.toVertexId === fromVertex.id)
      );

      // Update connections
      const newVertices = state.vertices.map(v => {
        if (v.id === fromVertex.id) {
          return {
            ...v,
            connections: v.connections.filter(c => c !== toVertex.id)
          };
        }
        if (v.id === toVertex.id) {
          return {
            ...v,
            connections: v.connections.filter(c => c !== fromVertex.id)
          };
        }
        return v;
      });

      // Calculate new connectivity using memoized calculator
      const connectivity = calculators.connectivity.calculate(newVertices);

      return {
        vertices: newVertices,
        edges: newEdges,
        stats: {
          ...state.stats,
          edgesRemoved: state.stats.edgesRemoved + 1,
          connectivity
        }
      };
    }

    case 'REVERT_CHANGES': {
      // Invalidate caches on revert
      calculators.connectivity.invalidate();

      return {
        ...state,
        stats: {
          ...state.stats,
          improvement: 0
        }
      };
    }

    default:
      return state;
  }
}

/**
 * Get the cardinal direction between two vertices
 */
function getCardinalDirection(from: WorldVertex, to: WorldVertex): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // For diagonal directions, ensure we have exact 45-degree angles
  const isDiagonal = Math.abs(dx) === Math.abs(dy);

  // Pure cardinal directions
  if (dx === 0 && dy > 0) return Direction.NORTH;
  if (dx === 0 && dy < 0) return Direction.SOUTH;
  if (dy === 0 && dx > 0) return Direction.EAST;
  if (dy === 0 && dx < 0) return Direction.WEST;

  // Diagonal directions (exactly 45 degrees)
  if (isDiagonal) {
    if (dx > 0 && dy > 0) return Direction.NORTHEAST;
    if (dx > 0 && dy < 0) return Direction.SOUTHEAST;
    if (dx < 0 && dy > 0) return Direction.NORTHWEST;
    if (dx < 0 && dy < 0) return Direction.SOUTHWEST;
  }

  return Direction.UNKNOWN;
}

/**
 * Convert Direction to RiverEdge flow direction
 */
function directionToFlowDirection(direction: Direction): RiverEdge['flowDirection'] {
  switch (direction) {
    case Direction.NORTH: return 'northward';
    case Direction.SOUTH: return 'southward';
    case Direction.EAST: return 'eastward';
    case Direction.WEST: return 'westward';
    case Direction.NORTHEAST:
    case Direction.NORTHWEST:
    case Direction.SOUTHEAST:
    case Direction.SOUTHWEST:
      return 'diagonal';
    default:
      return 'diagonal';  // Default to diagonal for unknown directions
  }
}

/**
 * Find best neighbor for a vertex based on cardinal directions
 */
function findBestNeighbor(
  vertex: WorldVertex,
  candidates: WorldVertex[],
  preferredDirections: Direction[],
  gridSize: number
): WorldVertex | undefined {
  // Calculate maximum connection radius
  const maxRadius = gridSize * 2 * Math.sqrt(2);

  // Filter candidates by radius first
  const inRangeNeighbors = candidates.filter(v => {
    const dx = v.x - vertex.x;
    const dy = v.y - vertex.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= maxRadius;
  });

  // Group candidates by their direction from vertex
  const byDirection = inRangeNeighbors.reduce((acc, candidate) => {
    const direction = getCardinalDirection(vertex, candidate);
    if (!acc[direction]) acc[direction] = [];
    acc[direction].push(candidate);
    return acc;
  }, {} as Record<Direction, WorldVertex[]>);

  // Try preferred directions first
  for (const direction of preferredDirections) {
    if (byDirection[direction]?.length > 0) {
      // Choose closest neighbor in this direction
      return byDirection[direction].sort((a, b) => {
        const distA = Math.abs(a.x - vertex.x) + Math.abs(a.y - vertex.y);
        const distB = Math.abs(b.x - vertex.x) + Math.abs(b.y - vertex.y);
        return distA - distB;
      })[0];
    }
  }

  // If no preferred directions available, try exact diagonals
  const diagonalDirections = [
    Direction.NORTHEAST,
    Direction.SOUTHEAST,
    Direction.SOUTHWEST,
    Direction.NORTHWEST
  ];

  for (const direction of diagonalDirections) {
    if (byDirection[direction]?.length > 0) {
      return byDirection[direction][0];  // Already sorted by distance above
    }
  }

  return undefined;
}

/**
 * Adjusts ecosystem connectivity by adding edges until targets are met
 */
function adjustEcosystemConnectivity(
  vertices: WorldVertex[],
  edges: RiverEdge[],
  _rng: () => number,
  spatialMetrics: SpatialMetrics
): {
  connectivityVertices: WorldVertex[],
  adjustedEdges: RiverEdge[],
  connectivityStats: {
    originalConnectivity: Record<EcosystemURN, number>,
    targetConnectivity: Record<EcosystemURN, number>,
    adjustedConnectivity: Record<EcosystemURN, number>,
    edgesAdded: number,
    edgesRemoved: number
  }
} {
  console.log(`🔗 Adjusting ecosystem connectivity...`);

  // Target connectivity per ecosystem - using the same pattern as calculateEcosystemConnectivity
  const TARGET_CONNECTIVITY: Record<EcosystemURN, number> = {} as Record<EcosystemURN, number>;

  // Set specific targets for ecosystems used in world generation
  TARGET_CONNECTIVITY['flux:eco:steppe:arid'] = 3.0;
  TARGET_CONNECTIVITY['flux:eco:grassland:temperate'] = 3.0;
  TARGET_CONNECTIVITY['flux:eco:forest:temperate'] = 2.0;
  TARGET_CONNECTIVITY['flux:eco:mountain:arid'] = 1.5;
  TARGET_CONNECTIVITY['flux:eco:jungle:tropical'] = 1.5;
  TARGET_CONNECTIVITY['flux:eco:marsh:tropical'] = 1.0;

  // Create working copies (URNs are already properly generated)
  let workingVertices = vertices.map(v => ({
    id: v.id,
    placeId: v.placeId, // Use the already-generated URN
    x: v.x,
    y: v.y,
    gridX: v.gridX,
    gridY: v.gridY,
    ecosystem: v.ecosystem,
    isOrigin: v.isOrigin,
    connections: [...v.connections],
    metadata: v.metadata
  }));
  let workingEdges = [...edges];
  let edgesAdded = 0;

  // Calculate initial connectivity
  const originalConnectivity = calculateEcosystemConnectivity(workingVertices);
  console.log(`🔗 Original connectivity:`, originalConnectivity);

  // Process each ecosystem in order of most connections needed
  const ecosystems = Object.entries(TARGET_CONNECTIVITY)
    .sort(([, a], [, b]) => b - a)
    .map(([eco]) => eco as EcosystemURN);

  for (const ecosystem of ecosystems) {
    const target = TARGET_CONNECTIVITY[ecosystem];
    if (!target) continue; // Skip ecosystems not in our target map

    let current = calculateEcosystemConnectivity(workingVertices)[ecosystem] || 0;

    // Get vertices for this ecosystem
    const ecosystemVertices = workingVertices.filter(v => v.ecosystem === ecosystem);
    if (ecosystemVertices.length === 0) continue;

    console.log(`🔗 ${ecosystem}: ${current.toFixed(2)} → ${target}`);

    // Add edges until we reach target or can't add more
    while (current < target) {
      // Find vertex with fewest connections
      const vertex = ecosystemVertices
        .sort((a, b) => a.connections.length - b.connections.length)[0];

      // Find potential neighbors within the expanded radius
      const potentialNeighbors = workingVertices.filter(v =>
        v.id !== vertex.id &&
        !vertex.connections.includes(v.id)
      );

      // Prefer cardinal directions based on ecosystem
      const preferredDirections = ecosystem === 'flux:eco:mountain:arid'
        ? [Direction.NORTH, Direction.SOUTH] // Mountains prefer vertical connections
        : [Direction.EAST, Direction.WEST];  // Other ecosystems prefer horizontal connections

      // Find best neighbor based on preferred directions
      const neighbor = findBestNeighbor(vertex, potentialNeighbors, preferredDirections, spatialMetrics.placeSpacing);
      if (!neighbor) break;

      // Calculate edge properties
      const direction = getCardinalDirection(vertex, neighbor);
      const flowDirection = directionToFlowDirection(direction);
      const dx = neighbor.x - vertex.x;
      const dy = neighbor.y - vertex.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Add edge
      const newEdge: RiverEdge = {
        id: `${vertex.id}->${neighbor.id}`,
        fromVertexId: vertex.id,
        toVertexId: neighbor.id,
        flowDirection,
        distance,
        angle
      };

      // Update connections
      vertex.connections.push(neighbor.id);
      neighbor.connections.push(vertex.id);
      workingEdges.push(newEdge);
      edgesAdded++;

      // Recalculate connectivity
      current = calculateEcosystemConnectivity(workingVertices)[ecosystem] || 0;
    }
  }

  const adjustedConnectivity = calculateEcosystemConnectivity(workingVertices);
  console.log(`\n🔗 Final connectivity:`, adjustedConnectivity);
  console.log(`🔗 Connectivity adjustment complete: +${edgesAdded} edges`);

  return {
    connectivityVertices: workingVertices,
    adjustedEdges: workingEdges,
    connectivityStats: {
      originalConnectivity,
      targetConnectivity: TARGET_CONNECTIVITY,
      adjustedConnectivity,
      edgesAdded,
      edgesRemoved: 0  // We never remove edges
    }
  };
}

/**
 * Calculate a score for how close current connectivity is to target
 * Returns a value between 0 and 1, where 1 is perfect
 */
// @ts-expect-error
function calculateConnectivityScore(
  current: Record<EcosystemURN, number>,
  target: Record<EcosystemURN, number>
): number {
  const deltas = Object.entries(target).map(([eco, targetValue]) => {
    const currentValue = current[eco as EcosystemURN] || 0;
    return Math.abs(targetValue - currentValue);
  });

  const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  return 1 / (1 + avgDelta);  // Convert to 0-1 score where 1 is perfect
}

/**
 * Calculate average connectivity per ecosystem
 */
function calculateEcosystemConnectivity(vertices: WorldVertex[]): Record<EcosystemURN, number> {
  const ecosystemStats: Record<string, { totalConnections: number, vertexCount: number }> = {};

  vertices.forEach(vertex => {
    const ecosystem = vertex.ecosystem;
    if (!ecosystemStats[ecosystem]) {
      ecosystemStats[ecosystem] = { totalConnections: 0, vertexCount: 0 };
    }
    ecosystemStats[ecosystem].totalConnections += vertex.connections.length;
    ecosystemStats[ecosystem].vertexCount += 1;
  });

  const result: Record<EcosystemURN, number> = {} as Record<EcosystemURN, number>;
  Object.entries(ecosystemStats).forEach(([ecosystem, stats]) => {
    result[ecosystem as EcosystemURN] = stats.vertexCount > 0 ? stats.totalConnections / stats.vertexCount : 0;
  });

  return result;
}

/**
 * Add edges within an ecosystem to increase connectivity
 */
// @ts-expect-error
function addEcosystemEdges(
  ecosystemVertices: WorldVertex[],
  _allVertices: WorldVertex[],
  edges: RiverEdge[],
  targetCount: number,
  rng: () => number
): number {
  let edgesAdded = 0;
  const maxDistance = 600; // Maximum distance for new edges (2x place spacing)

  for (let i = 0; i < targetCount && edgesAdded < targetCount; i++) {
    // Pick two random vertices in this ecosystem
    const vertex1 = ecosystemVertices[Math.floor(rng() * ecosystemVertices.length)];
    const vertex2 = ecosystemVertices[Math.floor(rng() * ecosystemVertices.length)];

    if (vertex1.id === vertex2.id) continue;
    if (vertex1.connections.includes(vertex2.id)) continue; // Already connected

    // Check distance
    const distance = Math.sqrt(
      Math.pow(vertex1.x - vertex2.x, 2) +
      Math.pow(vertex1.y - vertex2.y, 2)
    );

    if (distance <= maxDistance) {
      // Add bidirectional connection
      vertex1.connections.push(vertex2.id);
      vertex2.connections.push(vertex1.id);

      // Create edge object
      const dx = vertex2.x - vertex1.x;
      const dy = vertex2.y - vertex1.y;
      const angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI / 45) * 45;

      edges.push({
        id: `conn-${vertex1.id}-${vertex2.id}`,
        fromVertexId: vertex1.id,
        toVertexId: vertex2.id,
        flowDirection: determineFlowDirection(angle),
        distance,
        angle
      });

      edgesAdded++;
    }
  }

  return edgesAdded;
}

/**
 * Remove edges within an ecosystem to decrease connectivity
 */
// @ts-expect-error
function removeEcosystemEdges(
  ecosystemVertices: WorldVertex[],
  allVertices: WorldVertex[],
  edges: RiverEdge[],
  targetCount: number,
  rng: () => number
): number {
  let edgesRemoved = 0;
  const vertexMap = new Map(allVertices.map(v => [v.id, v]));

  for (let i = 0; i < targetCount && edgesRemoved < targetCount; i++) {
    // Find removable edges (edges that don't break connectivity)
    const removableEdges = edges.filter(edge => {
      const fromVertex = vertexMap.get(edge.fromVertexId);
      const toVertex = vertexMap.get(edge.toVertexId);

      return fromVertex && toVertex &&
             fromVertex.ecosystem === toVertex.ecosystem && // Same ecosystem
             ecosystemVertices.some(v => v.id === fromVertex.id) && // In target ecosystem
             fromVertex.connections.length > 1 && // From vertex has multiple connections
             toVertex.connections.length > 1 && // To vertex has multiple connections
             !fromVertex.isOrigin && !toVertex.isOrigin; // Don't disconnect origin
    });

    if (removableEdges.length === 0) break;

    // Pick random removable edge
    const edgeToRemove = removableEdges[Math.floor(rng() * removableEdges.length)];
    const fromVertex = vertexMap.get(edgeToRemove.fromVertexId)!;
    const toVertex = vertexMap.get(edgeToRemove.toVertexId)!;

    // Remove bidirectional connection
    fromVertex.connections = fromVertex.connections.filter(id => id !== toVertex.id);
    toVertex.connections = toVertex.connections.filter(id => id !== fromVertex.id);

    // Remove edge
    const edgeIndex = edges.findIndex(e => e.id === edgeToRemove.id);
    if (edgeIndex >= 0) {
      edges.splice(edgeIndex, 1);
      edgesRemoved++;
    }
  }

  return edgesRemoved;
}

/**
 * Verify that the graph remains connected from the origin
 */
// @ts-expect-error
function verifyGraphConnectivity(vertices: WorldVertex[], _edges: RiverEdge[]): boolean {
  const origin = vertices.find(v => v.isOrigin);
  if (!origin) return false;

  const visited = new Set<string>();
  const queue = [origin.id];
  visited.add(origin.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentVertex = vertices.find(v => v.id === currentId);
    if (!currentVertex) continue;

    for (const connectionId of currentVertex.connections) {
      if (!visited.has(connectionId)) {
        visited.add(connectionId);
        queue.push(connectionId);
      }
    }
  }

  const reachableVertices = visited.size;
  const totalVertices = vertices.length;
  const connectivityRatio = reachableVertices / totalVertices;

  console.log(`🔗 Connectivity check: ${reachableVertices}/${totalVertices} vertices reachable (${(connectivityRatio * 100).toFixed(1)}%)`);

  return connectivityRatio >= 0.95; // Allow for some isolated vertices, but most should be connected
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
  originalEcosystem: EcosystemURN
): EcosystemURN {
  // Find adjacent ecosystems
  const currentBandIndex = allBands.findIndex(b => b.ecosystem === currentBand.ecosystem);
  const adjacentEcosystems: EcosystemURN[] = [];

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
  const ecosystemProbabilities: { ecosystem: EcosystemURN; probability: number }[] = [];

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

        // Dithering zone extends 50% of band width from the boundary
        const ditheringZoneWidth = currentBand.width * 0.5;
        isInDitheringZone = distanceToBoundary >= 0 && distanceToBoundary <= ditheringZoneWidth;

      } else if (adjBand.endX <= currentBand.startX) {
        // Adjacent band is to the left - boundary is at current band's left edge
        boundaryX = currentBand.startX;
        distanceToBoundary = vertex.x - boundaryX; // Distance from vertex to left boundary

        // Dithering zone extends 50% of band width from the boundary
        const ditheringZoneWidth = currentBand.width * 0.5;
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
    const maxTransitionDistance = currentBand.width * 0.5; // 50% of band width for transition
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
      [ECOSYSTEM_URNS[0]]: { count: 0, avgConnections: 0 }, // steppe
      [ECOSYSTEM_URNS[1]]: { count: 0, avgConnections: 0 }, // grassland
      [ECOSYSTEM_URNS[2]]: { count: 0, avgConnections: 0 }, // forest
      [ECOSYSTEM_URNS[3]]: { count: 0, avgConnections: 0 }, // mountain
      [ECOSYSTEM_URNS[4]]: { count: 0, avgConnections: 0 }, // jungle
      [ECOSYSTEM_URNS[5]]: { count: 0, avgConnections: 0 }  // marsh
    } as Record<EcosystemURN, { count: number; avgConnections: number }>
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

  const gridWidth = Math.ceil((worldWidthMeters - 2 * placeMargin) / placeSpacing);
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

/**
 * Find path from origin vertex to target vertex using DFS
 * Returns the path as an array of vertex IDs from origin to target
 */
export function findPathFromOrigin(
  vertices: WorldVertex[],
  edges: RiverEdge[],
  targetVertexId: string
): string[] | null {
  if (!vertices || vertices.length === 0) {
    console.log('🚫 No vertices provided to findPathFromOrigin');
    return null;
  }

  // Find the origin vertex (should be at gridX: 0, gridY: center)
  const originVertex = vertices.find(v => v.gridX === 0);
  if (!originVertex) {
    console.log('🚫 No origin vertex found (gridX === 0)');
    console.log('Available vertices gridX range:', Math.min(...vertices.map(v => v.gridX)), 'to', Math.max(...vertices.map(v => v.gridX)));
    return null;
  }

  console.log('🎯 Origin vertex found:', originVertex.id, `(${originVertex.gridX}, ${originVertex.gridY})`);

  // Early exit if target is the origin
  if (originVertex.id === targetVertexId) {
    console.log('✅ Target is origin, returning single vertex path');
    return [originVertex.id];
  }

  // Build adjacency map for efficient lookups
  const adjacencyMap = new Map<string, Set<string>>();

  // Initialize adjacency map
  vertices.forEach(vertex => {
    adjacencyMap.set(vertex.id, new Set<string>());
  });

  // Populate adjacency map from edges
  edges.forEach(edge => {
    const fromSet = adjacencyMap.get(edge.fromVertexId);
    const toSet = adjacencyMap.get(edge.toVertexId);

    if (fromSet && toSet) {
      fromSet.add(edge.toVertexId);
      toSet.add(edge.fromVertexId);
    }
  });

  // DFS to find path
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(currentVertexId: string): boolean {
    if (visited.has(currentVertexId)) return false;

    visited.add(currentVertexId);
    path.push(currentVertexId);

    // Found target
    if (currentVertexId === targetVertexId) {
      return true;
    }

    // Explore neighbors
    const neighbors = adjacencyMap.get(currentVertexId);
    if (neighbors) {
      for (const neighborId of neighbors) {
        if (dfs(neighborId)) {
          return true;
        }
      }
    }

    // Backtrack
    path.pop();
    return false;
  }

    // Start DFS from origin
  console.log('🔍 Starting DFS from origin to target:', targetVertexId);
  console.log('📊 Graph has', vertices.length, 'vertices and', edges.length, 'edges');

  if (dfs(originVertex.id)) {
    console.log('✅ Path found with', path.length, 'vertices:', path);
    return path;
  }

  console.log('❌ No path found from origin to target');
  return null; // No path found
}

/**
 * Find the SHORTEST path from origin to target using BFS
 */
export function findShortestPathFromOrigin(
  vertices: WorldVertex[],
  edges: RiverEdge[],
  targetVertexId: string
): string[] | null {
  if (!vertices || vertices.length === 0) {
    console.log('🚫 No vertices provided to findShortestPathFromOrigin');
    return null;
  }

  // Find the origin vertex (should be at gridX: 0, gridY: center)
  const originVertex = vertices.find(v => v.gridX === 0);
  if (!originVertex) {
    console.log('🚫 No origin vertex found (gridX === 0)');
    return null;
  }

  // Early exit if target is the origin
  if (originVertex.id === targetVertexId) {
    return [originVertex.id];
  }

  // Build adjacency map for efficient lookups
  const adjacencyMap = new Map<string, Set<string>>();

  // Initialize adjacency map
  vertices.forEach(vertex => {
    adjacencyMap.set(vertex.id, new Set<string>());
  });

  // Populate adjacency map from edges
  edges.forEach(edge => {
    const fromSet = adjacencyMap.get(edge.fromVertexId);
    const toSet = adjacencyMap.get(edge.toVertexId);

    if (fromSet && toSet) {
      fromSet.add(edge.toVertexId);
      toSet.add(edge.fromVertexId);
    }
  });

  // BFS to find shortest path
  const queue: string[] = [originVertex.id];
  const visited = new Set<string>([originVertex.id]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const currentVertexId = queue.shift()!;

    // Found target - reconstruct path
    if (currentVertexId === targetVertexId) {
      const path: string[] = [];
      let current = targetVertexId;

      while (current !== undefined) {
        path.unshift(current);
        current = parent.get(current)!;
      }

      console.log('✅ Shortest path found with', path.length, 'vertices:', path);
      return path;
    }

    // Explore neighbors
    const neighbors = adjacencyMap.get(currentVertexId);
    if (neighbors) {
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          parent.set(neighborId, currentVertexId);
          queue.push(neighborId);
        }
      }
    }
  }

  console.log('❌ No path found from origin to target');
  return null; // No path found
}

/**
 * Generate Place URNs after all ecosystem modifications are complete
 * This ensures URNs match the final ecosystem assignments
 */
function generatePlaceURNsAfterEcosystemFinalization(vertices: WorldVertex[]): WorldVertex[] {
  console.log('🏗️  Generating Place URNs for finalized ecosystems...');

  let originCount = 0;
  let urnCount = 0;

  const finalVertices = vertices.map(vertex => {
    if (vertex.isOrigin) {
      originCount++;
      return {
        ...vertex,
        placeId: 'flux:place:origin' as PlaceURN
      };
    } else {
      urnCount++;
      return {
        ...vertex,
        placeId: generatePlaceURN(vertex.ecosystem, [vertex.x, vertex.y])
      };
    }
  });

  console.log(`🏗️  Generated ${urnCount} Place URNs + ${originCount} origin URNs`);
  return finalVertices;
}

/**
 * Find the origin vertex for a given world
 */
export function findOriginVertex(vertices: WorldVertex[]): WorldVertex | null {
  if (!vertices || vertices.length === 0) return null;

  // Origin vertex should be at gridX: 0 (westernmost column)
  return vertices.find(v => v.gridX === 0) || null;
}
