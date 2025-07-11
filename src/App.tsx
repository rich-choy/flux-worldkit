import { useState } from 'react';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { Controls } from '~/components/Controls';
import { Viewport } from '~/components/Viewport';
import { useWorldGeneration } from '~/hooks/useWorldGeneration';
import type { WorldGenerationResult } from '~/worldgen/types';

export type ViewMode = 'graph' | 'analysis'

function App() {
  const [world, setWorld] = useState<WorldGenerationResult | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('graph')
  const { generateWorld, isGenerating, error, clearError } = useWorldGeneration()

  const handleGenerateWorld = async (config: {
    minPlaces: number
    seed: number
  }) => {
    console.log('App: handleGenerateWorld called with config:', config)
    try {
      clearError()
      const generatedWorld = await generateWorld(config)
      setWorld(generatedWorld)
      console.log('World generated successfully:', generatedWorld)
    } catch (error) {
      console.error('World generation failed:', error)
      // Error is already handled by the hook
    }
  }

  return (
    <ErrorBoundary>
      <div className="app-container h-screen flex flex-col">
        {/* Top Menu Bar */}
        <Controls
          onGenerateWorld={handleGenerateWorld}
          isGenerating={isGenerating}
        />

        {/* View Toggle Controls */}
        <div className="border-b border-border px-6 py-3 flex justify-end">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('graph')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                viewMode === 'graph'
                  ? 'bg-accent text-background'
                  : 'bg-background text-text hover:bg-secondary'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode('analysis')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                viewMode === 'analysis'
                  ? 'bg-accent text-background'
                  : 'bg-background text-text hover:bg-secondary'
              }`}
            >
              Analysis
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          <Viewport
            world={world}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App
