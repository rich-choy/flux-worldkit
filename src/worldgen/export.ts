/**
 * JSONL Export System for World Generation
 *
 * Exports generated worlds as JSONL files where each line contains a well-formed Place object
 * conforming to the game's Place type definition.
 */

import type { WorldGenerationResult, WorldVertex, EcosystemType } from './types';

// Place type definition (based on game/src/types/entity/place.ts)
export interface Place {
  id: string; // PlaceURN
  name: string;
  description: string;
  exits: Exits;
  entities: PlaceEntities;
  ecology: EcologicalProfile;
  weather: Weather;
  coordinates: [number, number];
}

// Supporting types
export interface Exit {
  direction: string;
  label: string;
  to: string; // PlaceURN
}

export type Exits = Partial<Record<string, Exit>>;
export type PlaceEntities = Record<string, any>; // Empty initially

export interface Weather {
  // FUNDAMENTAL INPUTS (sources of truth)
  temperature: number;    // °C
  pressure: number;       // hPa
  humidity: number;       // %

  // DERIVED OUTPUTS (computed from inputs)
  precipitation: number;  // mm/hour
  ppfd: number;          // μmol photons m⁻² s⁻¹
  clouds: number;        // %

  // METADATA
  ts: number;            // Unix timestamp
}

export interface EcologicalProfile {
  ecosystem: string;        // EcosystemURN
  temperature: [number, number]; // [min, max] range
  pressure: [number, number];    // [min, max] range
  humidity: [number, number];    // [min, max] range
}

// Ecological profiles for each ecosystem type
const ECOSYSTEM_ECOLOGICAL_PROFILES: Record<EcosystemType, EcologicalProfile> = {
  'steppe': {
    ecosystem: 'flux:eco:steppe:arid',
    temperature: [10.0, 40.0],    // Hot, dry climate
    pressure: [1000.0, 1030.0],   // High pressure systems
    humidity: [20.0, 60.0]        // Low humidity
  },
  'grassland': {
    ecosystem: 'flux:eco:grassland:temperate',
    temperature: [0.0, 35.0],     // Moderate temperature range
    pressure: [980.0, 1020.0],    // Variable pressure
    humidity: [40.0, 80.0]        // Moderate humidity
  },
  'forest': {
    ecosystem: 'flux:eco:forest:temperate',
    temperature: [5.0, 30.0],     // Mild, stable climate
    pressure: [990.0, 1020.0],    // Stable pressure
    humidity: [50.0, 90.0]        // Higher humidity
  },
  'mountain': {
    ecosystem: 'flux:eco:mountain:arid',
    temperature: [5.0, 25.0],     // Cooler at altitude
    pressure: [950.0, 1000.0],    // Low pressure (high altitude)
    humidity: [50.0, 90.0]        // Variable humidity
  },
  'jungle': {
    ecosystem: 'flux:eco:jungle:tropical',
    temperature: [20.0, 35.0],    // Hot, humid climate
    pressure: [1000.0, 1020.0],   // Stable tropical pressure
    humidity: [70.0, 95.0]        // High humidity
  },
  'marsh': {
    ecosystem: 'flux:eco:marsh:tropical',
    temperature: [15.0, 30.0],    // Warm, humid climate
    pressure: [1000.0, 1020.0],   // Stable pressure
    humidity: [80.0, 95.0]        // Very high humidity
  }
};

/**
 * Generate Place URN from ecosystem and coordinates
 * Format: flux:place:biome:x:y
 */
export function generatePlaceURN(ecosystemType: EcosystemType, coordinates: [number, number]): string {
  const [x, y] = coordinates;
  return `flux:place:${ecosystemType}:${x}:${y}`;
}

/**
 * Generate a human-readable name for a place
 */
export function generatePlaceName(vertex: WorldVertex): string {
  const ecosystemNames = {
    'steppe': 'Steppe',
    'grassland': 'Grassland',
    'forest': 'Forest',
    'mountain': 'Mountain',
    'jungle': 'Jungle',
    'marsh': 'Marsh'
  };

  const baseName = ecosystemNames[vertex.ecosystem];

  // Add directional context
  if (vertex.gridX === 0) {
    return `${baseName} Origin`;
  }

  // Add descriptive modifiers based on position
  const modifiers = [
    'Northern', 'Southern', 'Eastern', 'Western',
    'Upper', 'Lower', 'Deep', 'High',
    'Dense', 'Open', 'Wild', 'Ancient'
  ];

  // Use coordinates to deterministically pick a modifier
  const modifierIndex = (vertex.gridX + vertex.gridY) % modifiers.length;
  return `${modifiers[modifierIndex]} ${baseName}`;
}

/**
 * Generate a description for a place
 */
export function generatePlaceDescription(vertex: WorldVertex): string {
  const descriptions = {
    'steppe': [
      'A vast expanse of arid grassland stretches to the horizon.',
      'Wind-swept plains dotted with hardy shrubs and scattered rocks.',
      'Rolling hills of dry grass wave gently in the constant breeze.',
      'A wide open steppe where the earth meets the endless sky.'
    ],
    'grassland': [
      'Lush green meadows extend in all directions.',
      'Rolling hills covered in tall grass sway in the gentle wind.',
      'A temperate grassland alive with wildflowers and birdsong.',
      'Fertile plains where grass grows thick and streams run clear.'
    ],
    'forest': [
      'Dense woodland with towering trees forms a natural canopy.',
      'A temperate forest where sunlight filters through the leaves.',
      'Ancient trees stand sentinel in this peaceful woodland.',
      'A forest grove where wildlife rustles through the undergrowth.'
    ],
    'mountain': [
      'Rocky peaks rise majestically against the sky.',
      'A mountainous region with steep slopes and stone outcroppings.',
      'High altitude terrain where the air is thin and crisp.',
      'Rugged mountain terrain carved by wind and weather.'
    ],
    'jungle': [
      'A dense tropical jungle teems with exotic life.',
      'Lush vegetation creates a humid, green paradise.',
      'A jungle canopy so thick that little sunlight reaches the ground.',
      'Tropical rainforest where vines hang like natural curtains.'
    ],
    'marsh': [
      'A wetland marsh where water and land meet.',
      'Boggy terrain with reeds and standing water.',
      'A marshy area where waterfowl nest among the cattails.',
      'Swampy ground where moss and lichen coat the trees.'
    ]
  };

  const options = descriptions[vertex.ecosystem];
  // Use coordinates to deterministically pick a description
  const descIndex = (vertex.gridX * 7 + vertex.gridY * 13) % options.length;
  return options[descIndex];
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
    let direction: string;
    if (dx === 0 && dy === 1) direction = 'north';
    else if (dx === 1 && dy === 1) direction = 'northeast';
    else if (dx === 1 && dy === 0) direction = 'east';
    else if (dx === 1 && dy === -1) direction = 'southeast';
    else if (dx === 0 && dy === -1) direction = 'south';
    else if (dx === -1 && dy === -1) direction = 'southwest';
    else if (dx === -1 && dy === 0) direction = 'west';
    else if (dx === -1 && dy === 1) direction = 'northwest';
    else direction = 'unknown';

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
 * Get ecological profile for an ecosystem type
 */
export function getEcologicalProfile(ecosystemType: EcosystemType): EcologicalProfile {
  return ECOSYSTEM_ECOLOGICAL_PROFILES[ecosystemType];
}

/**
 * Generate realistic weather for a vertex using seeded randomness
 */
export function generateRealisticWeather(vertex: WorldVertex, world: WorldGenerationResult, rng: () => number): Weather {
  const ecology = getEcologicalProfile(vertex.ecosystem);
  const [tempMin, tempMax] = ecology.temperature;
  const [pressureMin, pressureMax] = ecology.pressure;
  const [humidityMin, humidityMax] = ecology.humidity;

  // Generate base weather within ecological bounds
  const temperature = tempMin + (tempMax - tempMin) * rng();
  const pressure = pressureMin + (pressureMax - pressureMin) * rng();
  const humidity = humidityMin + (humidityMax - humidityMin) * rng();

  // Apply spatial coherence with neighbors
  const neighbors = world.edges
    .filter(edge => edge.fromVertexId === vertex.id || edge.toVertexId === vertex.id)
    .map(edge => edge.fromVertexId === vertex.id ? edge.toVertexId : edge.fromVertexId)
    .map(id => world.vertices.find(v => v.id === id))
    .filter(v => v !== undefined);

  // Calculate derived weather phenomena
  const precipitation = calculatePrecipitation(temperature, pressure, humidity);
  const ppfd = calculatePPFD(temperature, humidity, precipitation);
  const clouds = calculateCloudCover(humidity, pressure);

  return {
    temperature: Math.round(temperature * 10) / 10,
    pressure: Math.round(pressure * 10) / 10,
    humidity: Math.round(humidity * 10) / 10,
    precipitation: Math.round(precipitation * 100) / 100,
    ppfd: Math.round(ppfd * 10) / 10,
    clouds: Math.round(clouds * 10) / 10,
    ts: Date.now()
  };
}

/**
 * Calculate precipitation from atmospheric conditions
 */
function calculatePrecipitation(temperature: number, pressure: number, humidity: number): number {
  // Humidity provides base precipitation potential
  let humidityFactor = 0;
  if (humidity >= 50) {
    if (humidity < 70) humidityFactor = (humidity - 50) * 0.1;
    else if (humidity < 90) humidityFactor = (humidity - 50) * 0.3;
    else humidityFactor = (humidity - 50) * 0.5;
  }

  // Low pressure promotes precipitation
  let pressureFactor = 0.8;
  if (pressure > 1020) pressureFactor = 0.3;
  else if (pressure > 1000) pressureFactor = 0.8;
  else if (pressure > 980) pressureFactor = 1.2;
  else pressureFactor = 1.5;

  // Temperature affects precipitation efficiency
  let tempFactor = 1.0;
  if (temperature < -10) tempFactor = 0.3;
  else if (temperature < 5) tempFactor = 0.7;
  else if (temperature > 30) tempFactor = 0.6;

  return Math.max(0, humidityFactor * pressureFactor * tempFactor);
}

/**
 * Calculate Photosynthetic Photon Flux Density
 */
function calculatePPFD(temperature: number, humidity: number, precipitation: number): number {
  // Base PPFD varies with temperature (seasonal effect)
  const basePPFD = 400 + (temperature / 30) * 800; // 400-1200 range

  // Reduce PPFD with cloud cover (high humidity and precipitation)
  const cloudReduction = (humidity / 100) * 0.3 + (precipitation / 10) * 0.4;

  return Math.max(100, basePPFD * (1 - cloudReduction));
}

/**
 * Calculate cloud coverage from humidity and pressure
 */
function calculateCloudCover(humidity: number, pressure: number): number {
  // High humidity and low pressure promote cloud formation
  const humidityFactor = (humidity - 30) / 70; // 0-1 range
  const pressureFactor = (1020 - pressure) / 40; // 0-1 range for 980-1020 hPa

  const cloudCover = (humidityFactor + pressureFactor) * 50; // 0-100% range

  return Math.max(0, Math.min(100, cloudCover));
}

/**
 * Export world as JSONL string
 */
export function exportWorldToJSONL(world: WorldGenerationResult, rng: () => number): string {
  const places = world.vertices.map(vertex => {
    const coordinates: [number, number] = [vertex.x, vertex.y];
    const place: Place = {
      id: generatePlaceURN(vertex.ecosystem, coordinates),
      name: generatePlaceName(vertex),
      description: generatePlaceDescription(vertex),
      exits: convertVertexExitsToPlaceExits(vertex, world),
      entities: {}, // Empty initially
      ecology: getEcologicalProfile(vertex.ecosystem),
      weather: generateRealisticWeather(vertex, world, rng),
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
