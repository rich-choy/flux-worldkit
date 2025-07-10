// Utility functions for parsing ecosystem URNs and taxonomic atoms

export interface TaxonomicAtoms {
  biome: string;        // e.g., "forest", "grassland", "mountain", "wetland"
  climate: string;      // e.g., "temperate", "forest"
}

/**
 * Parse ecosystem URN to extract biome and climate atoms
 * flux:eco:forest:temperate -> { biome: "forest", climate: "temperate" }
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
  wetland: '#20B2AA',     // Light sea green
} as const;

export const ClimateColors = {
  subtropical: '#FFB347',  // Peach for subtropical warmth
  tropical: '#FF6347',     // Tomato red for tropical heat
  forest: '#006400',       // Dark green (for mountain:forest)
  montane: '#8B4513',      // Saddle brown for montane
  alpine: '#A0522D',       // Sienna for alpine
  coniferous: '#228B22',   // Forest green for coniferous
} as const;

/**
 * Get color for a place based on biome
 */
export function getBiomeColor(ecosystem: string): string {
  const atoms = parseEcosystemURN(ecosystem);
  if (!atoms) return '#666';



  // Special case: mountain:forest should be a darker, richer green (dangerous central sanctuary)
  if (atoms.biome === 'mountain' && atoms.climate === 'forest') {
    return '#006400'; // Dark green - represents the perilous central plateau
  }

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
    'flux:eco:mountain:forest': '#228B22',
    'flux:eco:forest:coniferous': '#228B22',
    'flux:eco:forest:montane': '#32CD32',
    'flux:eco:mountain:alpine': '#8B4513',
    'flux:eco:grassland:subtropical': '#9ACD32',
    'flux:eco:wetland:tropical': '#20B2AA',
    'flux:eco:marsh:tropical': '#FF6347'
  };

  return ecosystemColors[ecosystem] || '#666';
}
