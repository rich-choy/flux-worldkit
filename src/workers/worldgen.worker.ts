// Web Worker for World Generation - Updated for river delta system
import { generateWorld } from '../worldgen/river-delta'
import type { WorldGenerationConfig, WorldGenerationResult } from '../worldgen/types'

// Debug: Log what we imported to verify types
console.log('Worker: Imported generateWorld function:', typeof generateWorld)

export interface WorldGenerationMessage {
  type: 'GENERATE_WORLD'
  payload: {
    minPlaces: number
    seed: number
  }
}

export interface WorldGenerationResponse {
  type: 'WORLD_GENERATED' | 'GENERATION_ERROR'
  payload: WorldGenerationResult | string
}

// Listen for messages from the main thread
self.addEventListener('message', (event: MessageEvent<WorldGenerationMessage>) => {
  const { type, payload } = event.data

  if (type === 'GENERATE_WORLD') {
    try {
      // Create world generation config
      const config: WorldGenerationConfig = {
        minPlaces: payload.minPlaces,
        maxPlaces: payload.minPlaces * 2, // Allow up to 2x the min places
        worldAspectRatio: 1.618, // Golden ratio as specified
        seed: payload.seed, // Pass the seed for deterministic generation
        lichtenberg: {
          minVertices: Math.max(10, Math.floor(payload.minPlaces / 5)), // Ensure reasonable minimum
          maxChainLength: 15 // Reasonable max chain length
        }
      }

      // Generate the world
      console.log('Worker: Generating world with config:', config)
      const world = generateWorld(config)
      console.log('Worker: World generated successfully:', world)

      // Debug: Check what we're about to send
      console.log('Worker: About to send result:', {
        hasPlaces: !!world.places,
        placesCount: world.places?.length || 0,
        hasVertices: !!world.vertices,
        verticesCount: world.vertices?.length || 0,
        hasConnections: !!world.connections,
        hasConfig: !!world.config,
        samplePlace: world.places?.[0],
        sampleVertex: world.vertices?.[0]
      })

      // Send the result back to the main thread
      const response: WorldGenerationResponse = {
        type: 'WORLD_GENERATED',
        payload: world
      }
      self.postMessage(response)

    } catch (error) {
      console.error('Worker: World generation failed:', error)

      // Send error back to main thread
      const response: WorldGenerationResponse = {
        type: 'GENERATION_ERROR',
        payload: error instanceof Error ? error.message : 'Unknown error occurred'
      }
      self.postMessage(response)
    }
  }
})

// Export empty object to make this a module
export {}
