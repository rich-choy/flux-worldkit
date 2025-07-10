// Domain types file that re-exports flux-game worldgen functionality

// Re-export functions from flux-wrapper
export {
  generateWorld,
  generateLichtenbergWorld
} from '~/lib/flux-wrapper';

/**
 * Get the default world configuration - implemented directly to avoid circular dependencies
 */
export async function getDefaultWorldConfig(): Promise<any> {
  console.log('⚙️ getDefaultWorldConfig called from domain.ts');
  try {
    console.log('⚙️ Attempting to import flux-game module directly...');
    const gameModule = await import('flux-game');
    console.log('⚙️ flux-game module imported successfully');

    if (gameModule.DEFAULT_WORLD_CONFIG) {
      console.log('⚙️ DEFAULT_WORLD_CONFIG found');
      return gameModule.DEFAULT_WORLD_CONFIG;
    } else {
      console.error('⚙️ DEFAULT_WORLD_CONFIG not found in flux-game module');
      // Return a minimal default config as fallback
      const fallbackConfig = {
        topology: {
          central_crater: { center: [0, 0], radius: 6.4, elevation: -200 },
          mountain_ring: { inner_radius: 6.4, outer_radius: 25.0, elevation: 1500 },
          ecosystem_slices: { outer_radius: 50.0, slice_count: 8 }
        },
        place_density: 0.1,
        ecosystem_distribution: {
          'flux:ecosystem:forest:temperate': 0.25,
          'flux:ecosystem:grassland:savanna': 0.25,
          'flux:ecosystem:mountain:alpine': 0.2,
          'flux:ecosystem:forest:coniferous': 0.15,
          'flux:ecosystem:forest:montane': 0.15
        }
      };
      console.log('⚙️ Using fallback config:', fallbackConfig);
      return fallbackConfig;
    }
  } catch (error) {
    console.error('⚙️ Failed to load flux-game module:', error);
    // Return a minimal default config as fallback
    const fallbackConfig = {
      topology: {
        central_crater: { center: [0, 0], radius: 6.4, elevation: -200 },
        mountain_ring: { inner_radius: 6.4, outer_radius: 25.0, elevation: 1500 },
        ecosystem_slices: { outer_radius: 50.0, slice_count: 8 }
      },
      place_density: 0.1,
      ecosystem_distribution: {
        'flux:ecosystem:forest:temperate': 0.25,
        'flux:ecosystem:grassland:savanna': 0.25,
        'flux:ecosystem:mountain:alpine': 0.2,
        'flux:ecosystem:forest:coniferous': 0.15,
        'flux:ecosystem:forest:montane': 0.15
      }
    };
    console.log('⚙️ Using fallback config due to error:', fallbackConfig);
    return fallbackConfig;
  }
}

// Re-export types that are available from flux-game
export type {
  Exit,
  Place,
  GAEAPlace,
  GeneratedWorld,
  WorldGenerationConfig,
  EcosystemName,
  WorldGenOptions,
  PlaceURN,
  PotentiallyImpureOperations
} from 'flux-game';

// Define commonly used types locally to avoid import issues
export const Direction = {
  NORTH: 'north',
  SOUTH: 'south',
  EAST: 'east',
  WEST: 'west',
  NORTHEAST: 'northeast',
  NORTHWEST: 'northwest',
  SOUTHEAST: 'southeast',
  SOUTHWEST: 'southwest',
  UP: 'up',
  DOWN: 'down',
  UNKNOWN: 'unknown'
} as const;

export const EntityType = {
  ACTOR: 'actor',
  PLACE: 'place',
  ITEM: 'item',
  EFFECT: 'effect',
  ORGANIZATION: 'organization',
  PARTY: 'party'
} as const;
