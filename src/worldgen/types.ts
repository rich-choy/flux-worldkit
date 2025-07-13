/**
 * World generation library types for geography.md-based world generation
 * Uses rectangular bands and river delta patterns for connectivity
 */

import type { Place } from 'flux-game';

// Define EcologicalProfile locally since it's not exported from flux-game
export type EcologicalProfile = {
  ecosystem: string;
  temperature: [number, number];
  pressure: [number, number];
  humidity: [number, number];
};

// Ecosystem names from geography.md specification
export const EcosystemName = {
  STEPPE_ARID: 'flux:eco:steppe:arid',
  GRASSLAND_TEMPERATE: 'flux:eco:grassland:temperate',
  FOREST_TEMPERATE: 'flux:eco:forest:temperate',
  MOUNTAIN_ARID: 'flux:eco:mountain:arid',
  JUNGLE_TROPICAL: 'flux:eco:jungle:tropical',
  MARSH_TROPICAL: 'flux:eco:marsh:tropical'
} as const;

export type EcosystemName = typeof EcosystemName[keyof typeof EcosystemName];

// World generation configuration - spatial approach
export type WorldGenerationConfig = {
  // Spatial dimensions in kilometers
  worldWidth: number;  // West-to-east dimension in km (longer dimension)
  worldHeight: number; // North-to-south dimension in km (shorter dimension)

  // Place geometry constants
  placeSize: number;   // Each place is placeSize x placeSize meters (default: 100m)
  placeMargin: number; // Margin around each place in meters (default: 200m)

  // Generation parameters
  seed?: number;       // Optional seed for deterministic generation
  globalBranchingFactor?: number; // Override branching factor for all ecosystems (default: 1.5)
}

// Default spatial configuration based on cursorrules.md
export const DEFAULT_SPATIAL_CONFIG: Omit<WorldGenerationConfig, 'seed'> = {
  worldWidth: 14.5,    // km - San Francisco area, golden ratio rectangle
  worldHeight: 9.0,    // km - San Francisco area, golden ratio rectangle
  placeSize: 100,      // meters - each place is 100m x 100m (1 hectare)
  placeMargin: 200     // meters - 200m margin on all sides (400m total spacing)
}

// Spatial calculation helpers
export type SpatialMetrics = {
  // World dimensions in meters
  worldWidthMeters: number;
  worldHeightMeters: number;

  // Place geometry
  placeSize: number;       // Size of each place in meters
  placeMargin: number;     // Margin around each place in meters

  // Place spacing (size + margin + margin = effective spacing)
  placeSpacing: number;

  // Grid dimensions (how many places fit)
  gridWidth: number;   // Number of places west-to-east
  gridHeight: number;  // Number of places north-to-south

  // Total places that fit in the spatial grid
  totalPlacesCapacity: number;

  // Ecosystem band dimensions
  ecosystemBandWidth: number;  // Width of each ecosystem band in meters
  ecosystemBandCount: number;  // Number of ecosystem bands (5)
}

// World generation result from .cursorrules.md
export type WorldGenerationResult = {
  places: Place[];
  vertices: WorldVertex[];  // Preserve original vertex coordinates for visualization
  connections: {
    reciprocal: number;
    total: number;
  };
  config: WorldGenerationConfig;
  ecosystemBoundaries: Array<{
    ecosystem: EcosystemName;
    startX: number;
    endX: number;
    startY: number;
    endY: number;
    columns: number;
  }>;
};

// Ecosystem profiles for the 6 geography.md ecosystems
export const ECOSYSTEM_PROFILES: Record<EcosystemName, EcologicalProfile> = {
  [EcosystemName.STEPPE_ARID]: {
    ecosystem: 'flux:eco:steppe:arid',
    temperature: [15.0, 35.0],          // Hot, dry steppe climate
    pressure: [1000.0, 1020.0],         // Standard atmospheric pressure
    humidity: [20.0, 45.0]              // Low humidity (arid conditions)
  },
  [EcosystemName.GRASSLAND_TEMPERATE]: {
    ecosystem: 'flux:eco:grassland:temperate',
    temperature: [10.0, 25.0],          // Temperate grassland climate
    pressure: [1005.0, 1020.0],         // Standard atmospheric pressure
    humidity: [45.0, 70.0]              // Moderate humidity
  },
  [EcosystemName.FOREST_TEMPERATE]: {
    ecosystem: 'flux:eco:forest:temperate',
    temperature: [8.0, 22.0],           // Temperate forest climate
    pressure: [1000.0, 1020.0],         // Standard atmospheric pressure
    humidity: [65.0, 85.0]              // High humidity (forest conditions)
  },
  [EcosystemName.MOUNTAIN_ARID]: {
    ecosystem: 'flux:eco:mountain:arid',
    temperature: [-5.0, 15.0],          // Cold mountain climate
    pressure: [850.0, 950.0],           // Low pressure (high altitude)
    humidity: [25.0, 55.0]              // Low to moderate humidity (arid mountains)
  },
  [EcosystemName.JUNGLE_TROPICAL]: {
    ecosystem: 'flux:eco:jungle:tropical',
    temperature: [20.0, 35.0],          // Hot tropical climate
    pressure: [1005.0, 1020.0],         // Standard atmospheric pressure
    humidity: [75.0, 95.0]              // Very high humidity (tropical jungle)
  },
  [EcosystemName.MARSH_TROPICAL]: {
    ecosystem: 'flux:eco:marsh:tropical',
    temperature: [22.0, 32.0],          // Warm tropical marsh climate
    pressure: [1010.0, 1025.0],         // Slightly higher pressure (lower elevation)
    humidity: [85.0, 100.0]             // Very high humidity (marsh conditions)
  }
};

// World-specific vertex with spatial positioning
export type WorldVertex = {
  // Spatial coordinates in meters from world origin (0,0 = northwest corner)
  x: number;        // West-to-east position in meters
  y: number;        // North-to-south position in meters

  // Grid coordinates (which grid cell this vertex occupies)
  gridX: number;    // Grid column (0 to gridWidth-1)
  gridY: number;    // Grid row (0 to gridHeight-1)

  // Identification
  id: string;
  parentId?: string;
  placeId: string; // The corresponding place ID for this vertex

  // Ecosystem assignment
  ecosystem: EcosystemName;
};

// Helper function to calculate spatial metrics from config
export function calculateSpatialMetrics(config: WorldGenerationConfig): SpatialMetrics {
  const worldWidthMeters = config.worldWidth * 1000;  // Convert km to meters
  const worldHeightMeters = config.worldHeight * 1000;

  // Center-to-center spacing when margins collapse:
  // Place A: [margin][place][collapsed margin][place][margin] = margin + place + margin + place + margin
  // Distance from A center to B center = place/2 + margin + place/2 = place + margin
  const placeSpacing = config.placeSize + config.placeMargin;  // 100m + 200m = 300m

  // Calculate how many places fit in each dimension
  // Need to account for the outer margins: first place needs margin, then spacing between centers
  const gridWidth = Math.floor((worldWidthMeters - 2 * config.placeMargin) / placeSpacing) + 1;
  const gridHeight = Math.floor((worldHeightMeters - 2 * config.placeMargin) / placeSpacing) + 1;

  // Total capacity
  const totalPlacesCapacity = gridWidth * gridHeight;

  // Ecosystem bands (5 bands spanning the width)
  const ecosystemBandCount = 5;
  const ecosystemBandWidth = worldWidthMeters / ecosystemBandCount;

  return {
    worldWidthMeters,
    worldHeightMeters,
    placeSize: config.placeSize,
    placeMargin: config.placeMargin,
    placeSpacing,
    gridWidth,
    gridHeight,
    totalPlacesCapacity,
    ecosystemBandWidth,
    ecosystemBandCount
  };
}

// Band-based world structure from geography.md
export type EcosystemBand = {
  ecosystem: EcosystemName;
  startX: number;  // Normalized 0-1 position
  endX: number;    // Normalized 0-1 position
  width: number;   // Percentage of world width
};

export type WorldBands = {
  bands: EcosystemBand[];
  totalWidth: number;
  totalHeight: number;
};
