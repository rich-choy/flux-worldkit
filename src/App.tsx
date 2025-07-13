import { useState } from 'react';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { Controls } from '~/components/Controls';
import { Viewport } from '~/components/Viewport';
import { useWorldGeneration } from '~/hooks/useWorldGeneration';
import type { WorldGenerationResult, WorldGenerationConfig } from '~/worldgen/types';

export type ViewMode = 'graph' | 'analysis'

function App() {
  const [world, setWorld] = useState<WorldGenerationResult | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('graph')
  const { generateWorld, isGenerating, clearError } = useWorldGeneration()

  const handleGenerateWorld = async (config: WorldGenerationConfig) => {
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
