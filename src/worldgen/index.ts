/**
 * World generation library for geography.md-based world generation
 * Main entry point for world generation functionality
 */

// Main worldgen exports
export type { WorldGenerationConfig, WorldGenerationResult } from './types';
export { DEFAULT_SPATIAL_CONFIG } from './types';
export { generateWorld } from './river-delta';

// Default configuration for world generation
export const DEFAULT_WORLD_CONFIG = {
  minPlaces: 100,
  maxPlaces: 200,
  worldAspectRatio: 1.618 as const,
  lichtenberg: {
    minVertices: 30,
    maxChainLength: 15
  }
};

// Placeholder for generateEcosystemSlice function (referenced in test)
// This function would generate a single ecosystem slice for testing
export function generateEcosystemSlice() {
  // Function body for ecosystem slice generation
  return {
    places: [],
    connections: []
  };
}
