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
    temperature: [15.0, 35.0],    // Hot, continental climate
    pressure: [1010.0, 1030.0],   // High pressure systems
    humidity: [15.0, 45.0]        // Arid conditions
  },
  'grassland': {
    ecosystem: 'flux:eco:grassland:temperate',
    temperature: [0.0, 40.0],     // Extreme seasonal range
    pressure: [980.0, 1020.0],    // Variable pressure systems
    humidity: [35.0, 65.0]        // Moderate humidity
  },
  'forest': {
    ecosystem: 'flux:eco:forest:temperate',
    temperature: [5.0, 30.0],     // Mild, stable climate
    pressure: [990.0, 1020.0],    // Stable pressure
    humidity: [55.0, 85.0]        // Forest moisture retention
  },
  'mountain': {
    ecosystem: 'flux:eco:mountain:arid',
    temperature: [-5.0, 25.0],    // Alpine temperature variation
    pressure: [950.0, 990.0],     // Low pressure (high altitude)
    humidity: [10.0, 35.0]        // Arid mountain conditions
  },
  'jungle': {
    ecosystem: 'flux:eco:jungle:tropical',
    temperature: [20.0, 35.0],    // Consistently hot tropical
    pressure: [1000.0, 1020.0],   // Stable tropical pressure
    humidity: [75.0, 95.0]        // High tropical humidity
  },
  'marsh': {
    ecosystem: 'flux:eco:marsh:tropical',
    temperature: [10.0, 30.0],    // Cooler wetland temperatures
    pressure: [1020.0, 1040.0],   // Higher pressure (below sea level)
    humidity: [85.0, 100.0]       // Saturated wetland conditions
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
 * Apply spatial smoothing to weather parameters using neighbor averaging
 * This creates realistic atmospheric transitions across the world graph
 */
function applySpatialWeatherSmoothing(
  world: WorldGenerationResult,
  rng: () => number,
  iterations: number = 3,
  smoothingFactor: number = 0.3
): Map<string, { temperature: number; pressure: number; humidity: number }> {

  // Initialize weather map with gradient-based values
  const weatherMap = new Map<string, { temperature: number; pressure: number; humidity: number }>();

  // First pass: Calculate initial gradient-based weather for all vertices
  for (const vertex of world.vertices) {
    const initialWeather = calculateSpatialWeatherGradients(vertex, world);
    weatherMap.set(vertex.id, { ...initialWeather });
  }

  // Apply iterative neighbor smoothing
  for (let iteration = 0; iteration < iterations; iteration++) {
    const newWeatherMap = new Map(weatherMap); // Copy current state

    for (const vertex of world.vertices) {
      const neighbors = getNeighborVertices(vertex, world);
      const currentWeather = weatherMap.get(vertex.id)!;

      if (neighbors.length === 0) {
        // No neighbors - keep current values
        continue;
      }

      // Calculate neighbor averages
      const neighborAverages = {
        temperature: 0,
        pressure: 0,
        humidity: 0
      };

      let totalWeight = 0;

      for (const neighbor of neighbors) {
        const neighborWeather = weatherMap.get(neighbor.id);
        if (!neighborWeather) continue;

        // Distance-based weighting (closer neighbors have more influence)
        const distance = Math.sqrt(
          Math.pow(vertex.x - neighbor.x, 2) + Math.pow(vertex.y - neighbor.y, 2)
        );
        const weight = 1.0 / (1.0 + distance * 0.1); // Inverse distance weighting

        neighborAverages.temperature += neighborWeather.temperature * weight;
        neighborAverages.pressure += neighborWeather.pressure * weight;
        neighborAverages.humidity += neighborWeather.humidity * weight;
        totalWeight += weight;
      }

      if (totalWeight > 0) {
        // Normalize by total weight
        neighborAverages.temperature /= totalWeight;
        neighborAverages.pressure /= totalWeight;
        neighborAverages.humidity /= totalWeight;

        // Blend current values with neighbor averages
        const blendedWeather = {
          temperature: currentWeather.temperature * (1 - smoothingFactor) +
                      neighborAverages.temperature * smoothingFactor,
          pressure: currentWeather.pressure * (1 - smoothingFactor) +
                   neighborAverages.pressure * smoothingFactor,
          humidity: currentWeather.humidity * (1 - smoothingFactor) +
                   neighborAverages.humidity * smoothingFactor
        };

        // Apply ecological constraints to prevent unrealistic values
        const ecology = getEcologicalProfile(vertex.ecosystem);
        const constrainedWeather = {
          temperature: constrainToEcologicalBounds(blendedWeather.temperature, ecology.temperature, rng),
          pressure: constrainToEcologicalBounds(blendedWeather.pressure, ecology.pressure, rng),
          humidity: constrainToEcologicalBounds(blendedWeather.humidity, ecology.humidity, rng)
        };

        newWeatherMap.set(vertex.id, constrainedWeather);
      }
    }

    // Update weather map for next iteration
    weatherMap.clear();
    for (const [key, value] of newWeatherMap) {
      weatherMap.set(key, value);
    }
  }

  return weatherMap;
}

/**
 * Generate realistic weather for a vertex using spatial smoothing
 */
export function generateRealisticWeather(vertex: WorldVertex, world: WorldGenerationResult, rng: () => number): Weather {
  // Check if we already computed smoothed weather for this world
  if (!world.smoothedWeather) {
    console.log('Computing spatially smoothed weather for world...');
    world.smoothedWeather = applySpatialWeatherSmoothing(world, rng);
    console.log(`Weather smoothing complete for ${world.vertices.length} vertices`);
  }

  // Get smoothed weather values
  const smoothedWeather = world.smoothedWeather.get(vertex.id);

  // Fallback to gradient-based weather if smoothing failed
  const baseWeather = smoothedWeather || calculateSpatialWeatherGradients(vertex, world);

  const { temperature, pressure, humidity } = baseWeather;

  // Calculate derived weather phenomena
  const precipitation = calculatePrecipitation(temperature, pressure, humidity);
  const ppfd = calculatePPFD(temperature, humidity, precipitation);
  const clouds = calculateCloudCover(humidity, pressure);

  // Generate deterministic timestamp based on vertex position and world seed
  // This ensures same vertex always gets same timestamp for reproducibility
  const baseTimestamp = 1699123456789; // Fixed base timestamp
  const positionSeed = vertex.x * 1000 + vertex.y;
  const ts = baseTimestamp + (positionSeed * 3600000); // Offset by hours based on position

  return {
    temperature: Math.round(temperature * 10) / 10, // Round to 1 decimal
    pressure: Math.round(pressure * 10) / 10,
    humidity: Math.round(humidity * 10) / 10,
    precipitation: Math.round(precipitation * 100) / 100, // Round to 2 decimals
    ppfd: Math.round(ppfd),
    clouds: Math.round(clouds),
    ts
  };
}

/**
 * Calculate spatial weather gradients based on world position
 */
function calculateSpatialWeatherGradients(vertex: WorldVertex, world: WorldGenerationResult): {
  temperature: number;
  pressure: number;
  humidity: number;
} {
  // Find world boundaries
  const minX = Math.min(...world.vertices.map(v => v.x));
  const maxX = Math.max(...world.vertices.map(v => v.x));
  const minY = Math.min(...world.vertices.map(v => v.y));
  const maxY = Math.max(...world.vertices.map(v => v.y));

  // Normalize position (0.0 to 1.0)
  const normalizedX = (vertex.x - minX) / (maxX - minX);
  const normalizedY = (vertex.y - minY) / (maxY - minY);

  // TEMPERATURE GRADIENT: Increases west to east (steppe -> jungle)
  // Base range: 0°C to 40°C across the world
  const baseTemperature = 0 + (40 * normalizedX);

  // Add north-south variation (cooler at extremes, warmer in middle)
  const latitudinalEffect = Math.sin(normalizedY * Math.PI) * 10; // ±10°C variation
  const temperature = baseTemperature + latitudinalEffect;

  // PRESSURE GRADIENT: Varies with "elevation" and position
  // Base sea level pressure, modified by ecosystem-implied elevation
  const basePressure = 1013.25;

  // West-east pressure gradient (higher pressure systems in west)
  const longitudinalPressure = basePressure + (20 * (1 - normalizedX));

  // Add topographic variation (mountains = lower pressure)
  const topographicEffect = getTopographicPressureEffect(vertex, world);
  const pressure = longitudinalPressure + topographicEffect;

  // HUMIDITY GRADIENT: Increases west to east (arid -> tropical)
  // Base range: 10% to 95% across the world
  const baseHumidity = 10 + (85 * normalizedX);

  // Add coastal/inland effects and topographic moisture
  const moistureEffect = getTopographicMoistureEffect(vertex, world);
  const humidity = Math.min(100, Math.max(0, baseHumidity + moistureEffect));

  return { temperature, pressure, humidity };
}

/**
 * Get pressure effect from topographic position
 */
function getTopographicPressureEffect(vertex: WorldVertex, world: WorldGenerationResult): number {
  // Mountains have lower pressure due to elevation
  if (vertex.ecosystem === 'mountain') {
    return -30; // -30 hPa for mountain elevation
  }

  // Marshes have higher pressure if below sea level
  if (vertex.ecosystem === 'marsh') {
    return +20; // +20 hPa for below sea level
  }

  // Check if surrounded by mountains (in valley)
  const neighbors = getNeighborVertices(vertex, world);
  const mountainNeighbors = neighbors.filter(n => n.ecosystem === 'mountain').length;
  const totalNeighbors = neighbors.length;

  if (totalNeighbors > 0 && mountainNeighbors / totalNeighbors > 0.5) {
    return -10; // Valley effect
  }

  return 0;
}

/**
 * Get moisture effect from topographic position
 */
function getTopographicMoistureEffect(vertex: WorldVertex, world: WorldGenerationResult): number {
  // Marshes have maximum moisture
  if (vertex.ecosystem === 'marsh') {
    return +15; // Extra humid
  }

  // Mountains create rain shadows (drier)
  if (vertex.ecosystem === 'mountain') {
    return -20; // Rain shadow effect
  }

  // Forest creates local humidity
  if (vertex.ecosystem === 'forest') {
    return +10; // Forest moisture retention
  }

  // Check for windward/leeward effects
  const neighbors = getNeighborVertices(vertex, world);
  const westNeighbors = neighbors.filter(n => n.x < vertex.x);
  const mountainsToWest = westNeighbors.filter(n => n.ecosystem === 'mountain').length;

  if (mountainsToWest > 0) {
    return -15; // Leeward (rain shadow) effect
  }

  return 0;
}

/**
 * Get neighboring vertices
 */
function getNeighborVertices(vertex: WorldVertex, world: WorldGenerationResult): WorldVertex[] {
  return world.edges
    .filter(edge => edge.fromVertexId === vertex.id || edge.toVertexId === vertex.id)
    .map(edge => edge.fromVertexId === vertex.id ? edge.toVertexId : edge.fromVertexId)
    .map(id => world.vertices.find(v => v.id === id))
    .filter(v => v !== undefined) as WorldVertex[];
}

/**
 * Constrain gradient value to ecological bounds with some randomness
 */
function constrainToEcologicalBounds(gradientValue: number, bounds: [number, number], rng: () => number): number {
  const [min, max] = bounds;

  // If gradient is within bounds, use it with slight randomness
  if (gradientValue >= min && gradientValue <= max) {
    const variation = (max - min) * 0.1; // 10% variation
    return gradientValue + (rng() - 0.5) * variation;
  }

  // If gradient is outside bounds, pull it toward bounds but allow some overshoot
  const overshoot = (max - min) * 0.05; // 5% overshoot allowed
  const constrainedMin = min - overshoot;
  const constrainedMax = max + overshoot;

  const constrained = Math.min(constrainedMax, Math.max(constrainedMin, gradientValue));
  return constrained + (rng() - 0.5) * overshoot;
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
