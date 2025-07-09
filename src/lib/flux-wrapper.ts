// Simple wrapper to convert CommonJS flux-game to ESM
import type { GeneratedWorld, WorldGenerationConfig } from '@flux';

export type { Exit } from '@flux';

let fluxGameModule: any = null;

async function getFluxGame() {
  if (!fluxGameModule) {
    fluxGameModule = await import('flux-game');
  }
  return fluxGameModule.default || fluxGameModule;
}

export async function generateWorld(config: WorldGenerationConfig): Promise<GeneratedWorld> {
  const FluxGame = await getFluxGame();
  return FluxGame.generateWorld(config);
}

export async function getDefaultWorldConfig(): Promise<WorldGenerationConfig> {
  const FluxGame = await getFluxGame();
  return FluxGame.DEFAULT_WORLD_CONFIG;
}
