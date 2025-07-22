import type { WorldGenerationResult, WorldVertex, WorldGenerationConfig, RiverEdge } from './types';
import type { Place } from '@flux';
import type { EcosystemURN } from '@flux';

interface WorldMetadata {
  version: string;
  ts: number;
  config: WorldGenerationConfig;
}

/**
 * Validates the imported world data
 */
function validateImportedWorld(world: WorldGenerationResult): void {
  // Basic structure validation
  if (!world.vertices || world.vertices.length === 0) {
    throw new Error('Invalid world: no vertices found');
  }

  if (!world.edges || world.edges.length === 0) {
    throw new Error('Invalid world: no edges found');
  }

  // Critical: Origin validation for MUD server compatibility
  if (!world.originVertex) {
    throw new Error('Invalid world: no origin vertex found - required for player spawning');
  }

  if (world.originVertex.placeId !== 'flux:place:origin') {
    throw new Error(`Invalid world: origin vertex has incorrect placeId: ${world.originVertex.placeId} (expected: flux:place:origin)`);
  }

  // Ensure origin place exists in vertices
  const hasOriginPlace = world.vertices.some(v => v.placeId === 'flux:place:origin');
  if (!hasOriginPlace) {
    throw new Error('Invalid world: origin place (flux:place:origin) not found in vertices - required for MUD server');
  }

  // Ecosystem validation
  const validEcosystems = [
    'flux:eco:steppe:arid',
    'flux:eco:grassland:temperate',
    'flux:eco:forest:temperate',
    'flux:eco:mountain:arid',
    'flux:eco:jungle:tropical',
    'flux:eco:marsh:tropical'
  ];

  for (const vertex of world.vertices) {
    if (!validEcosystems.includes(vertex.ecosystem)) {
      throw new Error(`Invalid world: vertex ${vertex.id} has invalid ecosystem URN: ${vertex.ecosystem}`);
    }
  }

  // Connectivity validation
  const vertexIds = new Set(world.vertices.map(v => v.id));
  for (const vertex of world.vertices) {
    for (const connectionId of vertex.connections) {
      if (!vertexIds.has(connectionId)) {
        throw new Error(`Invalid world: vertex ${vertex.id} has missing connection target: ${connectionId}`);
      }
    }
  }

  // Edge validation
  for (const edge of world.edges) {
    if (!vertexIds.has(edge.fromVertexId)) {
      throw new Error(`Invalid world: edge ${edge.id} has missing source vertex: ${edge.fromVertexId}`);
    }
    if (!vertexIds.has(edge.toVertexId)) {
      throw new Error(`Invalid world: edge ${edge.id} has missing target vertex: ${edge.toVertexId}`);
    }
  }

  // Config validation
  if (!world.config) {
    throw new Error('Invalid world: missing generation config');
  }

  // Version validation
  if (!world.version) {
    throw new Error('Invalid world: missing version');
  }
}

/**
 * Parses a JSONL file containing world data, where the first line is front matter
 * containing generation metadata.
 */
function parseJSONLFile(fileContent: string): { metadata: WorldMetadata; places: Place[] } {
  const lines = fileContent.trim().split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('Invalid JSONL file: must contain at least front matter and one place');
  }

  try {
    // First line is always front matter
    const metadata = JSON.parse(lines[0]) as WorldMetadata;

    // Remaining lines are places
    const places = lines.slice(1).map((line, index) => {
      try {
        return JSON.parse(line) as Place;
      } catch (error) {
        throw new Error(`Invalid JSONL line ${index + 2}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    return { metadata, places };
  } catch (error) {
    throw new Error(`Failed to parse front matter: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Converts a Place object back to a WorldVertex
 */
function convertPlaceToWorldVertex(place: Place): WorldVertex {
  // Handle different URN patterns (origin vs regular places)
  const isOrigin = place.id === 'flux:place:origin';
  let gridX: number, gridY: number;

  // Always get coordinates from the coordinates array
  gridX = place.coordinates[0];
  gridY = place.coordinates[1];

  if (!isOrigin) {
    // Verify coordinates match URN for non-origin places
    const urnParts = place.id.split(':');
    if (urnParts.length !== 5 || urnParts[0] !== 'flux' || urnParts[1] !== 'place') {
      throw new Error(`Invalid Place ID format: ${place.id}`);
    }

    const urnX = parseInt(urnParts[3]);
    const urnY = parseInt(urnParts[4]);

    if (isNaN(urnX) || isNaN(urnY)) {
      throw new Error(`Invalid coordinates in Place ID: ${place.id}`);
    }

    // Verify coordinates match
    if (urnX !== gridX || urnY !== gridY) {
      throw new Error(`Coordinates mismatch: URN [${urnX}, ${urnY}] vs coordinates [${gridX}, ${gridY}]`);
    }
  }

  // Extract connections from exits
  const connections = Object.values(place.exits || {}).map(exit => {
    // Find the vertex ID from the exit's URN
    if (exit.to === 'flux:place:origin') {
      return 'origin'; // Special case for origin vertex
    }
    const urnParts = exit.to.split(':');
    if (urnParts.length !== 5) {
      throw new Error(`Invalid exit URN format: ${exit.to}`);
    }
    return `${urnParts[3]}:${urnParts[4]}`; // Use coordinates as vertex ID
  });

  return {
    id: isOrigin ? 'origin' : `${gridX}:${gridY}`, // Use 'origin' for origin vertex
    placeId: place.id,
    x: place.coordinates[0],
    y: place.coordinates[1],
    gridX,
    gridY,
    ecosystem: place.ecosystem as EcosystemURN, // Type assertion since we know Place.ecosystem is already a valid EcosystemURN
    isOrigin,
    connections
  };
}

/**
 * Reconstructs edges between vertices
 */
function reconstructEdges(vertices: WorldVertex[]): RiverEdge[] {
  const edges: RiverEdge[] = [];
  const vertexMap = new Map(vertices.map(v => [v.id, v]));
  const processedEdges = new Set<string>();

  for (const vertex of vertices) {
    for (const connectionId of vertex.connections) {
      const targetVertex = vertexMap.get(connectionId);
      if (!targetVertex) {
        console.warn(`Missing connection target: ${connectionId}`);
        continue;
      }

      // Create unique edge ID (avoid duplicates)
      const edgeKey = [vertex.id, connectionId].sort().join('→');
      if (processedEdges.has(edgeKey)) continue;
      processedEdges.add(edgeKey);

      // Calculate edge properties
      const dx = targetVertex.x - vertex.x;
      const dy = targetVertex.y - vertex.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI / 45) * 45;

      // Determine flow direction from angle
      const flowDirection = angle === 0 ? 'eastward' :
                          angle === 90 ? 'northward' :
                          angle === 180 || angle === -180 ? 'westward' :
                          angle === -90 || angle === 270 ? 'southward' :
                          'diagonal';

      edges.push({
        id: `${vertex.id}→${connectionId}`,
        fromVertexId: vertex.id,
        toVertexId: connectionId,
        flowDirection,
        distance,
        angle
      });
    }
  }

  return edges;
}

/**
 * Reconstructs a complete WorldGenerationResult from JSONL data
 */
export function reconstructWorldFromJSONL(fileContent: string): WorldGenerationResult {
  console.log('Reconstructing world from JSONL...');

  // Parse the JSONL file
  const { metadata, places } = parseJSONLFile(fileContent);
  console.log(`Parsed ${places.length} places from JSONL`);

  // Convert places to vertices
  const vertices = places.map(convertPlaceToWorldVertex);
  console.log(`Converted to ${vertices.length} vertices`);

  // Find origin vertex
  const originVertex = vertices.find(v => v.isOrigin);
  if (!originVertex) {
    throw new Error('No origin vertex found in imported data');
  }

  // Reconstruct edges from vertex connections
  const edges = reconstructEdges(vertices);
  console.log(`Reconstructed ${edges.length} edges`);

  const world: WorldGenerationResult = {
    vertices,
    edges,
    ecosystemBands: [], // Not needed for visualization
    spatialMetrics: {
      worldWidthMeters: 0, // Not needed for visualization
      worldHeightMeters: 0,
      gridWidth: 0,
      gridHeight: 0,
      placeSpacing: 300,
      placeMargin: 150
    },
    ditheringStats: {
      totalVertices: vertices.length,
      pureZoneVertices: 0, // Not needed for visualization
      transitionZoneVertices: 0,
      ditheredVertices: 0,
      ecosystemCounts: {} as any // Not needed for visualization
    },
    connectivityStats: {
      totalVertices: vertices.length,
      totalEdges: edges.length,
      avgConnectionsPerVertex: edges.length / vertices.length,
      connectedComponents: 1, // Not needed for visualization
      ecosystemConnectivity: {} as any // Not needed for visualization
    },
    originVertex,
    boundaryLines: [], // Not needed for visualization
    config: metadata.config,
    generationTime: metadata.ts,
    version: metadata.version
  };

  // Validate the reconstructed world
  validateImportedWorld(world);

  return world;
}
