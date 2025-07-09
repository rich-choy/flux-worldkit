// Utility functions for parsing ecosystem URNs and taxonomic atoms

export interface TaxonomicAtoms {
  biome: string;        // e.g., "forest", "grassland", "mountain"
  climate: string;      // e.g., "temperate", "alpine", "arid"
}

/**
 * Parse ecosystem URN to extract biome and climate atoms
 * flux:eco:forest:alpine -> { biome: "forest", climate: "alpine" }
 */
export function parseEcosystemURN(ecosystem: string): TaxonomicAtoms | null {
  const parts = ecosystem.split(':');

  if (parts.length < 4) {
    console.warn(`Invalid ecosystem URN: ${ecosystem}`);
    return null;
  }

  return {
    biome: parts[2],
    climate: parts[3]
  };
}

/**
 * Get all unique biomes from a list of ecosystem URNs
 */
export function getUniqueBiomes(ecosystems: string[]): string[] {
  const biomes = new Set<string>();

  ecosystems.forEach(ecosystem => {
    const atoms = parseEcosystemURN(ecosystem);
    if (atoms) {
      biomes.add(atoms.biome);
    }
  });

  return Array.from(biomes).sort();
}

/**
 * Get all unique climates from a list of ecosystem URNs
 */
export function getUniqueClimates(ecosystems: string[]): string[] {
  const climates = new Set<string>();

  ecosystems.forEach(ecosystem => {
    const atoms = parseEcosystemURN(ecosystem);
    if (atoms) {
      climates.add(atoms.climate);
    }
  });

  return Array.from(climates).sort();
}

// Color schemes for different taxonomic atoms
export const BiomeColors = {
  forest: '#228B22',      // Forest green
  grassland: '#9ACD32',   // Yellow green
  mountain: '#8B4513',    // Saddle brown
} as const;

export const ClimateColors = {
  temperate: '#4169E1',   // Royal blue
  alpine: '#9370DB',      // Medium purple
  arid: '#FF8C00',        // Dark orange
  forest: '#006400',      // Dark green (for mountain:forest)
} as const;

/**
 * Get color for a place based on biome
 */
export function getBiomeColor(ecosystem: string): string {
  const atoms = parseEcosystemURN(ecosystem);
  if (!atoms) return '#666';

  return BiomeColors[atoms.biome as keyof typeof BiomeColors] || '#666';
}

/**
 * Get color for a place based on climate
 */
export function getClimateColor(ecosystem: string): string {
  const atoms = parseEcosystemURN(ecosystem);
  if (!atoms) return '#666';

  return ClimateColors[atoms.climate as keyof typeof ClimateColors] || '#666';
}

/**
 * Get color using original ecosystem-specific colors
 */
export function getEcosystemColor(ecosystem: string): string {
  const ecosystemColors: Record<string, string> = {
    'flux:eco:mountain:alpine': '#8B4513',
    'flux:eco:mountain:forest': '#228B22',
    'flux:eco:forest:temperate': '#32CD32',
    'flux:eco:grassland:temperate': '#9ACD32',
    'flux:eco:grassland:arid': '#F0E68C'
  };

  return ecosystemColors[ecosystem] || '#666';
}
