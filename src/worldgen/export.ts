/**
 * JSONL Export System for World Generation
 *
 * Exports generated worlds as JSONL files where each line contains a well-formed Place object
 * conforming to the game's Place type definition.
 */

import type { Place, Exits, EcosystemURN, Weather, Biome, PlaceURN } from '@flux';
import { EntityType, ECOLOGICAL_PROFILES, Direction } from '@flux';
import type { WorldGenerationResult, WorldVertex } from './types';

// Helper function to extract biome from ecosystem URN
function getBiomeFromURN(ecosystemURN: EcosystemURN): Biome {
  return ecosystemURN.split(':')[2] as Biome;
}

/**
 * Generate Place URN from ecosystem and coordinates
 * Format: flux:place:biome:x:y
 */
export function generatePlaceURN(ecosystemURN: EcosystemURN, coordinates: [number, number]): PlaceURN {
  const [x, y] = coordinates;
  // Extract biome from ecosystem URN (e.g., "flux:eco:steppe:arid" -> "steppe")
  const biome = getBiomeFromURN(ecosystemURN);
  return `flux:place:${biome}:${x}:${y}`;
}

/**
 * Generate human-readable name for a place
 */
export function generatePlaceName(vertex: WorldVertex): string {
  // Extract biome from ecosystem URN
  const biome = getBiomeFromURN(vertex.ecosystem);
  const ecosystemNames = {
    'steppe': 'Steppe',
    'grassland': 'Grassland',
    'forest': 'Forest',
    'mountain': 'Mountain',
    'jungle': 'Jungle',
    'marsh': 'Marsh'
  };

  const baseName = ecosystemNames[biome as keyof typeof ecosystemNames];

  // Add directional context
  if (vertex.gridX === 0) {
    return `${baseName} Origin`;
  }

  // Add descriptive modifiers based on position
  const modifiers = [
    'Northern', 'Southern', 'Eastern', 'Western',
    'Upper', 'Lower', 'Deep', 'High',
    'Remote', 'Central', 'Outer', 'Inner'
  ];

  const modifier = modifiers[vertex.id.length % modifiers.length];
  return `${modifier} ${baseName}`;
}

/**
 * Generate descriptive text for a place
 */
export function generatePlaceDescription(vertex: WorldVertex): string {
  const biome = getBiomeFromURN(vertex.ecosystem);

  const descriptions = {
    'steppe': [
      'A vast expanse of grassland stretches to the horizon.',
      'Wind-swept plains dotted with hardy shrubs.',
      'Rolling hills covered in golden grass.',
      'An open prairie under an endless sky.',
      'Dry grassland with scattered wildflowers.'
    ],
    'grassland': [
      'Lush green meadows sway in the breeze.',
      'Rich farmland with fertile soil.',
      'Temperate plains alive with wildlife.',
      'Rolling hills carpeted in emerald grass.',
      'A pastoral landscape of gentle slopes.'
    ],
    'forest': [
      'Towering trees form a verdant canopy overhead.',
      'Ancient woods filled with dappled sunlight.',
      'Dense woodland teeming with life.',
      'A cathedral of mighty oaks and elms.',
      'Misty forest paths wind between massive trunks.'
    ],
    'mountain': [
      'Jagged peaks pierce the clouds above.',
      'Rocky crags and steep mountain slopes.',
      'Alpine terrain with treacherous paths.',
      'Windswept heights overlooking the world below.',
      'Barren stone faces and narrow ledges.'
    ],
    'jungle': [
      'Thick vines and lush foliage block the sun.',
      'Humid air hangs heavy in the dense undergrowth.',
      'Exotic birds call from the tangled canopy.',
      'Steam rises from the rich jungle floor.',
      'Massive trees draped in hanging moss.'
    ],
    'marsh': [
      'Murky waters reflect the cloudy sky.',
      'Cattails and reeds sway in the wetland breeze.',
      'Soggy ground squelches underfoot.',
      'Mist rises from the stagnant pools.',
      'Water lilies float on the dark surface.'
    ]
  };

  const options = descriptions[biome as keyof typeof descriptions];
  const baseDescription = options[vertex.id.length % options.length];

  // Add contextual details based on connections
  let contextualDetails = '';

  // Add flow context if near water or rivers
  if (vertex.connections.length > 2) {
    contextualDetails += ' Multiple paths converge here.';
  } else if (vertex.connections.length === 1) {
    contextualDetails += ' This appears to be a dead end.';
  }

  return baseDescription + contextualDetails;
}

/**
 * Convert WorldVertex connections to Place exits
 */
export function convertVertexExitsToPlaceExits(vertex: WorldVertex, world: WorldGenerationResult): Exits {
  const exits: Exits = {};

  // Find all edges connected to this vertex
  const connectedEdges = world.edges.filter(edge =>
    edge.fromVertexId === vertex.id || edge.toVertexId === vertex.id
  );

  connectedEdges.forEach(edge => {
    const isFromVertex = edge.fromVertexId === vertex.id;
    const otherVertexId = isFromVertex ? edge.toVertexId : edge.fromVertexId;
    const otherVertex = world.vertices.find(v => v.id === otherVertexId);

    if (!otherVertex) return;

    // Calculate direction from current vertex to other vertex
    const dx = otherVertex.gridX - vertex.gridX;
    const dy = otherVertex.gridY - vertex.gridY;

    // Map to cardinal/diagonal directions
    let direction: Direction;
    if (dx === 0 && dy === 1) direction = Direction.NORTH;
    else if (dx === 1 && dy === 1) direction = Direction.NORTHEAST;
    else if (dx === 1 && dy === 0) direction = Direction.EAST;
    else if (dx === 1 && dy === -1) direction = Direction.SOUTHEAST;
    else if (dx === 0 && dy === -1) direction = Direction.SOUTH;
    else if (dx === -1 && dy === -1) direction = Direction.SOUTHWEST;
    else if (dx === -1 && dy === 0) direction = Direction.WEST;
    else if (dx === -1 && dy === 1) direction = Direction.NORTHWEST;
    else direction = Direction.UNKNOWN;

    const targetUrn = generatePlaceURN(otherVertex.ecosystem, [otherVertex.x, otherVertex.y]);

    exits[direction] = {
      direction: direction,
      label: `${direction.charAt(0).toUpperCase() + direction.slice(1)} Path`,
      to: targetUrn
    };
  });

  return exits;
}

/**
 * Generate simple weather using midpoint values from ECOLOGICAL_PROFILES
 */
export function generateSimpleWeather(vertex: WorldVertex): Weather {
  const ecology = ECOLOGICAL_PROFILES[vertex.ecosystem];

  // Calculate midpoint values from ecological profile ranges
  const temperature = (ecology.temperature[0] + ecology.temperature[1]) / 2;
  const pressure = (ecology.pressure[0] + ecology.pressure[1]) / 2;
  const humidity = (ecology.humidity[0] + ecology.humidity[1]) / 2;

  // Simple derived values based on fundamentals
  const precipitation = humidity > 70 ? (humidity - 70) * 0.2 : 0; // mm/hour
  const ppfd = temperature > 0 ? 800 + (temperature * 10) : 200; // μmol photons m⁻² s⁻¹
  const clouds = humidity > 50 ? (humidity - 50) * 1.5 : 10; // %

  // Generate deterministic timestamp based on vertex position
  const baseTimestamp = 1699123456789;
  const positionSeed = vertex.x * 1000 + vertex.y;
  const ts = baseTimestamp + (positionSeed * 3600000);

  return {
    temperature: Math.round(temperature * 10) / 10,
    pressure: Math.round(pressure * 10) / 10,
    humidity: Math.round(humidity * 10) / 10,
    precipitation: Math.round(precipitation * 100) / 100,
    ppfd: Math.round(ppfd),
    clouds: Math.round(Math.min(100, clouds)),
    ts
  };
}

/**
 * Export world as JSONL string
 */
export function exportWorldToJSONL(world: WorldGenerationResult): string {
  const places = world.vertices.map(vertex => {
    const coordinates: [number, number] = [vertex.x, vertex.y];
    const place: Place = {
      type: EntityType.PLACE,
      id: generatePlaceURN(vertex.ecosystem, coordinates),
      name: generatePlaceName(vertex),
      description: generatePlaceDescription(vertex),
      exits: convertVertexExitsToPlaceExits(vertex, world),
      entities: {},
      resources: { ts: Date.now(), nodes: {} },
      ecosystem: vertex.ecosystem, // Use the URN directly
      weather: generateSimpleWeather(vertex),
      coordinates: coordinates
    };
    return place;
  });

  return places.map(place => JSON.stringify(place)).join('\n');
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
