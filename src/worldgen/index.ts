/**
 * Worldgen Module - Continuous River Flow with Gaussian Ecosystem Dithering
 * Main entry point for the UI
 */

export { generateWorld, findPathFromOrigin, findShortestPathFromOrigin, findOriginVertex } from './generator';
export { exportWorldToJSONL, downloadJSONL } from './export';
export type {
  WorldGenerationConfig,
  WorldGenerationResult,
  SpatialMetrics,
  EcosystemBand,
  WorldVertex,
  RiverEdge,
  EcosystemType,
  DitheringStats,
  ConnectivityStats,
  ZoneType,
  EcosystemProbability,
  DitheringContext
} from './types';
export {
  GOLDEN_RATIO,
  PURE_RATIO,
  TRANSITION_RATIO
} from './types';
