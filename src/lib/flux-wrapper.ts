// Direct imports from the game module - import from flux-game to avoid circular dependencies

/**
 * Generate a world using the flux game engine
 */
export async function generateWorld(config?: any): Promise<any> {
  try {
    const gameModule = await import('flux-game');

    if (gameModule.generateWorld) {
      const result = await gameModule.generateWorld(config);
      return result;
    } else {
      console.error('🌍 generateWorld function not found in flux-game module');
      throw new Error('generateWorld function not available');
    }
  } catch (error) {
    console.error('🌍 Failed to load flux-game module or execute generateWorld:', error);
    throw new Error(`generateWorld function not available: ${error}`);
  }
}

/**
 * Generate a world using Lichtenberg fractal patterns
 */
export async function generateLichtenbergWorld(config?: any): Promise<any> {
  try {
    const gameModule = await import('flux-game');

    if (gameModule.generateLichtenbergWorld) {
      // Create proper operations that route debug messages to console
      const operations = {
        random: () => Math.random(),
        timestamp: () => Date.now(),
        uniqid: () => Math.random().toString(36).substr(2, 9),
        debug: (...args: any[]) => {
          // Route debug messages to console with timestamp
          const timestamp = new Date().toISOString().substr(11, 12);
          console.log(`[${timestamp}] 🌊`, ...args);
        }
      };

      const result = await gameModule.generateLichtenbergWorld(config, undefined, operations);
      return result;
    } else {
      console.warn('⚡ generateLichtenbergWorld function not found, falling back to regular generation');
      return generateWorld(config);
    }
  } catch (error) {
    console.error('⚡ Failed to load flux-game module:', error);
    console.warn('⚡ Falling back to regular generation');
    return generateWorld(config);
  }
}
