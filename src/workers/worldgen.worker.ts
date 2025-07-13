// Web Worker for World Generation - Updated for river delta system
import { generateWorld } from '../worldgen/index'
import type { WorldGenerationConfig, WorldGenerationResult } from '../worldgen/index'

// Debug: Log what we imported to verify types
console.log('Worker: Imported generateWorld function:', typeof generateWorld)

export interface WorldGenerationMessage {
  type: 'GENERATE_WORLD'
  payload: WorldGenerationConfig
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
      // Use the config directly from the payload
      const config: WorldGenerationConfig = payload

      // Generate the world
      console.log('Worker: Generating world with config:', config)
      const world = generateWorld(config)
      console.log('Worker: World generated successfully:', {
        vertices: world.vertices?.length || 0,
        edges: world.edges?.length || 0,
        worldSize: `${config.worldWidthKm}x${config.worldHeightKm}km`
      })

      // Debug: Check what we're about to send
      console.log('Worker: About to send result:', {
        hasVertices: !!world.vertices,
        verticesCount: world.vertices?.length || 0,
        hasEdges: !!world.edges,
        edgesCount: world.edges?.length || 0,
        hasConfig: !!world.config,
        sampleVertex: world.vertices?.[0],
        sampleEdge: world.edges?.[0]
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
