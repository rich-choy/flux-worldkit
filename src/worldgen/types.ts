import type { EcosystemURN, PlaceURN } from '@flux';

/**
 * Types for Continuous River Flow + Gaussian Ecosystem Dithering Worldgen System
 * Uses Golden Ratio bleeding proportions for natural ecosystem transitions
 */

// Dithering constants for 50-50 split between pure and transition zones
export const PURE_RATIO = 0.5;
export const TRANSITION_RATIO = 0.5;

// Complete ecosystem URN progression (West to East)
export const ECOSYSTEM_URNS = [
  'flux:eco:steppe:arid',
  'flux:eco:grassland:temperate',
  'flux:eco:forest:temperate',
  'flux:eco:mountain:arid',
  'flux:eco:jungle:tropical',
  'flux:eco:marsh:tropical'
] as const satisfies readonly EcosystemURN[];

// Spatial metrics for world generation
export interface SpatialMetrics {
  worldWidthMeters: number;
  worldHeightMeters: number;
  gridWidth: number;
  gridHeight: number;
  placeSpacing: number;
  placeMargin: number;
}

// Ecosystem band definition
export interface EcosystemBand {
  ecosystem: EcosystemURN;
  startX: number;
  endX: number;
  startCol: number;
  endCol: number;
  width: number;
  pureZoneStart: number;
  pureZoneEnd: number;
  transitionZoneStart: number;
  transitionZoneEnd: number;
}

// Vertex in the river flow network
export interface WorldVertex {
  id: string;
  placeId: PlaceURN;
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  ecosystem: EcosystemURN;
  isOrigin: boolean;
  connections: string[]; // IDs of connected vertices
  metadata?: {
    pathfindingOrigin?: WorldVertex;
  };
}

// Edge representing river flow
export interface RiverEdge {
  id: string;
  fromVertexId: string;
  toVertexId: string;
  flowDirection: 'eastward' | 'westward' | 'northward' | 'southward' | 'diagonal';
  distance: number;
  angle: number; // Must be multiple of 45 degrees
}

// Dithering statistics
export interface DitheringStats {
  totalVertices: number;
  pureZoneVertices: number;
  transitionZoneVertices: number;
  ditheredVertices: number;
  ecosystemCounts: Record<EcosystemURN, number>;
}

// Connectivity statistics
export interface ConnectivityStats {
  totalVertices: number;
  totalEdges: number;
  avgConnectionsPerVertex: number;
  connectedComponents: number;
  ecosystemConnectivity: Record<EcosystemURN, {
    count: number;
    avgConnections: number;
  }>;
}

// Configuration for world generation
export interface WorldGenerationConfig {
  // World dimensions
  worldWidthKm?: number;
  worldHeightKm?: number;

  // River flow parameters
  branchingFactor?: number;
  meanderingFactor?: number;

  // Dithering parameters
  ditheringStrength?: number;

  // Visualization options
  showZoneBoundaries?: boolean;
  showFlowDirection?: boolean;
  colorScheme?: 'default' | 'terrain' | 'flow';

  // Generation seed
  seed?: number;
}

// Complete world generation result
export interface WorldGenerationResult {
  // Core data
  vertices: WorldVertex[];
  edges: RiverEdge[];
  ecosystemBands: EcosystemBand[];
  spatialMetrics: SpatialMetrics;

  // Statistics
  ditheringStats: DitheringStats;
  connectivityStats: ConnectivityStats;

  // Visualization data
  originVertex: WorldVertex;
  boundaryLines: Array<{
    x: number;
    ecosystem: EcosystemURN;
    type: 'band' | 'pure' | 'transition';
  }>;

  // Weather data (computed on-demand for export)
  smoothedWeather?: Map<string, { temperature: number; pressure: number; humidity: number }>;

  // Metadata
  config: WorldGenerationConfig;
  generationTime: number;
  version: string;
}

// Zone type for dithering algorithm
export type ZoneType = 'pure' | 'transition';

// Ecosystem probability for dithering
export interface EcosystemProbability {
  ecosystem: EcosystemURN;
  probability: number;
}
