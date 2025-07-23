/**
 * Worldgen Module - Continuous River Flow with Gaussian Ecosystem Dithering
 * Uses 50% bleeding proportions for extensive ecosystem transitions
 * Main entry point for the UI
 */

export { generateWorld, findPathFromOrigin, findShortestPathFromOrigin, findOriginVertex } from './generator';
export { exportWorldToJSONL, downloadJSONL } from './export';
export { reconstructWorldFromJSONL } from './import';
export type {
  WorldGenerationConfig,
  WorldGenerationResult,
  SpatialMetrics,
  EcosystemBand,
  WorldVertex,
  RiverEdge,

  DitheringStats,
  ConnectivityStats,
  ZoneType,
  EcosystemProbability,

} from './types';
export {
  PURE_RATIO,
  TRANSITION_RATIO
} from './types';
