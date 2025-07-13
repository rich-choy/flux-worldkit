/**
 * Types for Continuous River Flow + Gaussian Ecosystem Dithering Worldgen System
 */

// Golden ratio constants for natural proportions
export const GOLDEN_RATIO = 0.618;
export const PURE_RATIO = 1 - GOLDEN_RATIO; // 0.382
export const TRANSITION_RATIO = GOLDEN_RATIO; // 0.618

// Ecosystem types
export type EcosystemType =
  | 'steppe'
  | 'grassland'
  | 'forest'
  | 'mountain'
  | 'jungle'
  | 'marsh';

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
  ecosystem: EcosystemType;
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
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  ecosystem: EcosystemType;
  isOrigin: boolean;
  connections: string[]; // IDs of connected vertices
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
  ecosystemCounts: Record<EcosystemType, number>;
}

// Connectivity statistics
export interface ConnectivityStats {
  totalVertices: number;
  totalEdges: number;
  avgConnectionsPerVertex: number;
  connectedComponents: number;
  ecosystemConnectivity: Record<EcosystemType, {
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
  gaussianSigma?: number;

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
    ecosystem: EcosystemType;
    type: 'band' | 'pure' | 'transition';
  }>;

  // Metadata
  config: WorldGenerationConfig;
  generationTime: number;
  version: string;
}

// Zone type for dithering algorithm
export type ZoneType = 'pure' | 'transition';

// Ecosystem probability for dithering
export interface EcosystemProbability {
  ecosystem: EcosystemType;
  probability: number;
}

// Dithering context
export interface DitheringContext {
  vertex: WorldVertex;
  band: EcosystemBand;
  zoneType: ZoneType;
  distanceFromBoundary: number;
  adjacentEcosystems: EcosystemType[];
  probabilities: EcosystemProbability[];
}
