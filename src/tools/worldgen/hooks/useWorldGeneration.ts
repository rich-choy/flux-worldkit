import { useState, useRef, useCallback } from 'react';
import type { WorldGenerationResult, WorldGenerationConfig } from '~/worldgen/types';
import type { WorldGenerationMessage, WorldGenerationResponse } from '~/workers/worldgen.worker';

interface UseWorldGenerationReturn {
  generateWorld: (config: WorldGenerationConfig) => Promise<WorldGenerationResult>
  isGenerating: boolean
  error: string | null
  clearError: () => void
}

export const useWorldGeneration = (): UseWorldGenerationReturn => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)

  // Initialize worker lazily
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      // Add cache-busting timestamp to force worker reload
      const workerUrl = new URL('~/workers/worldgen.worker.ts', import.meta.url)
      workerUrl.searchParams.set('t', Date.now().toString())

      workerRef.current = new Worker(
        workerUrl,
        { type: 'module' }
      )
    }
    return workerRef.current
  }, [])

  const generateWorld = useCallback(async (config: WorldGenerationConfig): Promise<WorldGenerationResult> => {
    setIsGenerating(true)
    setError(null)

    const worker = getWorker()

    return new Promise((resolve, reject) => {
      // Set up message handler
      const handleMessage = (event: MessageEvent<WorldGenerationResponse>) => {
        const { type, payload } = event.data

        if (type === 'WORLD_GENERATED') {
          setIsGenerating(false)
          worker.removeEventListener('message', handleMessage)

          // Debug logging to see what we received
          const worldResult = payload as WorldGenerationResult
          console.log('Hook: Received world from worker:', {
            hasVertices: !!worldResult.vertices,
            verticesCount: worldResult.vertices?.length || 0,
            hasEdges: !!worldResult.edges,
            edgesCount: worldResult.edges?.length || 0,
            hasConfig: !!worldResult.config,
            hasStats: !!worldResult.ditheringStats,
            fullResult: worldResult
          })

          resolve(worldResult)
        } else if (type === 'GENERATION_ERROR') {
          setIsGenerating(false)
          setError(payload as string)
          worker.removeEventListener('message', handleMessage)
          reject(new Error(payload as string))
        }
      }

      // Set up error handler
      const handleError = (error: ErrorEvent) => {
        setIsGenerating(false)
        setError(error.message)
        worker.removeEventListener('message', handleMessage)
        worker.removeEventListener('error', handleError)
        reject(error)
      }

      worker.addEventListener('message', handleMessage)
      worker.addEventListener('error', handleError)

      // Send generation request
      const message: WorldGenerationMessage = {
        type: 'GENERATE_WORLD',
        payload: config
      }
      worker.postMessage(message)
    })
  }, [getWorker])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    generateWorld,
    isGenerating,
    error,
    clearError
  }
}
