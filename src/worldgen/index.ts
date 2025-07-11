/**
 * World generation library for geography.md-based world generation
 * Main entry point for world generation functionality
 */

export { generateWorld } from './integration';
export * from './types';

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
export function generateEcosystemSlice(ecosystem: any) {
  // This is a placeholder - the actual implementation would generate
  // a single ecosystem band for testing purposes
  throw new Error('generateEcosystemSlice not yet implemented');
}
