import { useState } from 'react';
import { Controls } from '~/tools/worldgen/components/Controls';
import { Viewport } from '~/tools/worldgen/components/Viewport';
import { useWorldGeneration } from '~/hooks/useWorldGeneration';
import type { WorldGenerationResult, WorldGenerationConfig } from '~/worldgen/types';

export type ViewMode = 'graph' | 'analysis';

export function WorldGenTool() {
  const [world, setWorld] = useState<WorldGenerationResult | null>(null);
  const [currentSeed, setCurrentSeed] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const { generateWorld, isGenerating, clearError } = useWorldGeneration();

  const handleGenerateWorld = async (config: WorldGenerationConfig) => {
    console.log('WorldGenTool: handleGenerateWorld called with config:', config);
    try {
      clearError();
      const generatedWorld = await generateWorld(config);
      setWorld(generatedWorld);
      setCurrentSeed(config.seed || 0); // Track the seed used for generation
      console.log('World generated successfully:', generatedWorld);
    } catch (error) {
      console.error('World generation failed:', error);
      // Error is already handled by the hook
    }
  };

  const handleWorldImported = (importedWorld: WorldGenerationResult) => {
    console.log('WorldGenTool: handleWorldImported called with world:', importedWorld);
    setWorld(importedWorld);
    setCurrentSeed(importedWorld.config.seed || 0); // Track the seed from the imported world
  };

  return (
    <div className="worldgen-tool h-full flex flex-col">
      {/* Top Menu Bar */}
      <Controls
        onGenerateWorld={handleGenerateWorld}
        onWorldImported={handleWorldImported}
        isGenerating={isGenerating}
        world={world}
        currentSeed={currentSeed}
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
  );
}
