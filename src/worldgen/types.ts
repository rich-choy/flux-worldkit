/**
 * World generation library types for geography.md-based world generation
 * Uses rectangular bands and Lichtenberg figures for connectivity
 */

import type { Place, EcologicalProfile } from '@flux';

// Ecosystem names from geography.md specification
export enum EcosystemName {
  STEPPE_ARID = 'flux:eco:steppe:arid',
  GRASSLAND_TEMPERATE = 'flux:eco:grassland:temperate',
  FOREST_TEMPERATE = 'flux:eco:forest:temperate',
  MOUNTAIN_ARID = 'flux:eco:mountain:arid',
  JUNGLE_TROPICAL = 'flux:eco:jungle:tropical',
  MARSH_TROPICAL = 'flux:eco:marsh:tropical'
}

// World generation configuration from .cursorrules.md
export type WorldGenerationConfig = {
  minPlaces: number;
  maxPlaces?: number;
  worldAspectRatio: 1.618; // The ratio of the world's length to its width
  seed?: number;           // Optional seed for deterministic generation
  lichtenberg: {
    minVertices: number;     // Minimum number of vertices in the Lichtenberg figure
    maxChainLength: number;  // Maximum length of any single chain/branch
    };
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

// Re-export pure geometric types from the fractal library
export type { LichtenbergVertex, LichtenbergConnection, LichtenbergFigure, LichtenbergConfig } from '../lib/fractal/lichtenberg';

// World-specific vertex (adds ecosystem to pure geometric vertex)
export type WorldVertex = {
  x: number;
  y: number;
  id: string;
  parentId?: string;
  ecosystem: EcosystemName;
};

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
