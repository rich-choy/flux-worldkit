/**
 * JSONL Export System for World Generation
 *
 * Exports generated worlds as JSONL files where each line contains a well-formed Place object
 * conforming to the game's Place type definition.
 */

import type { Place, Exits, EcosystemURN, Biome, PlaceURN } from '@flux';
import { EntityType, Direction } from '@flux';
import type { WorldGenerationResult, WorldVertex, WorldGenerationConfig } from './types';

export type WorldExportMetadata = {
  version: string;
  ts: number;
  config: WorldGenerationConfig;
}

// Helper function to extract biome from ecosystem URN
function getBiomeFromURN(ecosystemURN: EcosystemURN): Biome {
  return ecosystemURN.split(':')[2] as Biome;
}

/**
 * Generates the front matter line for the JSONL export containing generation parameters
 */
function generateFrontMatter(
  world: WorldGenerationResult,
  now = Date.now(),
): string {
  const metadata: WorldExportMetadata = {
    version: world.version,
    ts: now,
    config: world.config
  };
  return JSON.stringify(metadata);
}

/**
 * Generate a URN for a place based on its ecosystem and coordinates
 */
export function generatePlaceURN(ecosystem: EcosystemURN, coordinates: [number, number]): PlaceURN {
  const [x, y] = coordinates;
  const biome = getBiomeFromURN(ecosystem);
  return `flux:place:${biome}:${x}:${y}` as PlaceURN;
}

/**
 * Generate a descriptive name for a place based on its vertex properties
 */
export function generatePlaceName(vertex: WorldVertex): string {
  const biome = getBiomeFromURN(vertex.ecosystem);
  const isOrigin = vertex.isOrigin;

  if (isOrigin) {
    return "Home base";
  }

  const biomeNames = {
    steppe: ["Windswept Plains", "Arid Steppes", "Rolling Plains"],
    grassland: ["Verdant Fields", "Grassy Meadows", "Open Plains"],
    forest: ["Dense Woods", "Ancient Forest", "Shaded Grove"],
    mountain: ["Rocky Heights", "Mountain Pass", "Craggy Peaks"],
    jungle: ["Thick Jungle", "Dense Rainforest", "Tropical Grove"],
    marsh: ["Murky Wetlands", "Misty Marsh", "Foggy Swamp"]
  };

  const names = biomeNames[biome] || ["Unknown Region"];
  const index = Math.abs(vertex.x * vertex.y) % names.length;
  return names[index];
}

/**
 * Generate a descriptive description for a place based on its vertex properties
 */
export function generatePlaceDescription(vertex: WorldVertex): string {
  const biome = getBiomeFromURN(vertex.ecosystem);
  const isOrigin = vertex.isOrigin;

  if (isOrigin) {
    return "The home base of the player. This is the starting point for all players.";
  }

  const biomeDescriptions = {
    steppe: "Dry grasslands stretch endlessly toward the horizon.",
    grassland: "Lush grass sways gently in the breeze.",
    forest: "Ancient trees tower overhead, their branches forming a dense canopy.",
    mountain: "Jagged rocks and steep cliffs dominate the landscape.",
    jungle: "Thick vegetation and exotic plants fill every direction.",
    marsh: "Mist hangs over the waterlogged ground."
  };

  return biomeDescriptions[biome] || "An unexplored region awaits.";
}

/**
 * Convert vertex connections to place exits
 */
export function convertVertexExitsToPlaceExits(vertex: WorldVertex, world: WorldGenerationResult): Exits {
  const exits: Exits = {};

  // Map from angle to cardinal direction
  const angleToDirection: Record<number, Direction> = {
    0: Direction.EAST,
    45: Direction.NORTHEAST,
    90: Direction.NORTH,
    135: Direction.NORTHWEST,
    180: Direction.WEST,
    225: Direction.SOUTHWEST,
    270: Direction.SOUTH,
    315: Direction.SOUTHEAST,
    [-45]: Direction.SOUTHEAST,
    [-90]: Direction.SOUTH,
    [-135]: Direction.SOUTHWEST,
    [-180]: Direction.WEST
  };

  // Find all edges connected to this vertex
  const connectedEdges = world.edges.filter(
    edge => edge.fromVertexId === vertex.id || edge.toVertexId === vertex.id
  );

  for (const edge of connectedEdges) {
    const isFrom = edge.fromVertexId === vertex.id;
    const connectedId = isFrom ? edge.toVertexId : edge.fromVertexId;
    const connectedVertex = world.vertices.find(v => v.id === connectedId);

    if (!connectedVertex) continue;

    // Calculate angle between vertices
    const dx = connectedVertex.x - vertex.x;
    const dy = connectedVertex.y - vertex.y;
    const angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI / 45) * 45;
    const direction = angleToDirection[angle];

    if (!direction) continue;

    const directionKey = direction.toLowerCase() as keyof Exits;

    // Generate proper PlaceURN for the connected vertex
    const targetURN = connectedVertex.isOrigin
      ? 'flux:place:origin' as PlaceURN
      : generatePlaceURN(connectedVertex.ecosystem, [connectedVertex.x, connectedVertex.y]);

    exits[directionKey] = {
      direction: directionKey,
      label: `${direction.charAt(0).toUpperCase() + direction.slice(1).toLowerCase()} Path`,
      to: targetURN
    };
  }

  return exits;
}

/**
 * Export world as JSONL string with special handling for origin URN
 */
export function exportWorldToJSONL(world: WorldGenerationResult): string {
  // First, identify the origin vertex
  const originVertex = world.vertices.find(v => v.isOrigin);
  if (!originVertex) {
    throw new Error('No origin vertex found in world - required for MUD server compatibility');
  }

  // Generate the original origin URN to map from old to new
  const originalOriginURN = generatePlaceURN(originVertex.ecosystem, [originVertex.x, originVertex.y]);
  const newOriginURN = 'flux:place:origin' as PlaceURN;

  console.log(`Mapping origin place: ${originalOriginURN} → ${newOriginURN}`);

  // Create Place objects for all vertices
  const places = world.vertices.map(vertex => {
    const coordinates: [number, number] = [vertex.x, vertex.y];
    const isOrigin = vertex.isOrigin;

    // Generate the place ID - special case for origin
    const placeId = isOrigin ? newOriginURN : generatePlaceURN(vertex.ecosystem, coordinates);

    // Store the generated URN in the vertex for exit reference
    vertex.placeId = placeId;

    const place: Place = {
      type: EntityType.PLACE,
      id: placeId,
      name: generatePlaceName(vertex),
      description: generatePlaceDescription(vertex),
      exits: convertVertexExitsToPlaceExits(vertex, world),
      entities: {},
      resources: { ts: Date.now(), nodes: {} },
      ecosystem: vertex.ecosystem,
      coordinates: coordinates,
    } as unknown as Place; // We are intentionally leaving out some fields
    return place;
  });

  // Validate: No duplicate places
  const placesByUrn = new Map<string, Place[]>();
  places.forEach(place => {
    if (!placesByUrn.has(place.id)) {
      placesByUrn.set(place.id, []);
    }
    placesByUrn.get(place.id)!.push(place);
  });

  // Find any URNs with more than one place
  const duplicates = Array.from(placesByUrn.entries())
    .filter(([_, places]) => places.length > 1);

  if (duplicates.length > 0) {
    const duplicateDetails = duplicates.map(([urn, places]) => {
      const details = places.map((place, i) =>
        `    Place ${i + 1}: coordinates=[${place.coordinates.join(', ')}], exits=${Object.keys(place.exits).join(', ')}`
      ).join('\n');
      return `  ${urn}:\n${details}`;
    }).join('\n');

    throw new Error(
      'Duplicate places found - each place must have a unique URN:\n' +
      duplicateDetails
    );
  }

  // Generate front matter as first line
  const frontMatter = generateFrontMatter(world);

  // Convert places to JSONL, with front matter as first line
  return frontMatter + '\n' + places.map(place => JSON.stringify(place)).join('\n');
}

/**
 * Trigger file download in browser
 */
export function downloadJSONL(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
