import React, { useState, useMemo } from 'react';
import { DEFAULT_SPATIAL_CONFIG, calculateSpatialMetrics } from '~/worldgen/types';
import type { WorldGenerationConfig } from '~/worldgen/types';

interface ControlsProps {
  onGenerateWorld: (config: WorldGenerationConfig) => void
  isGenerating: boolean
}

const getRandomSeed = () => Math.floor(Math.random() * 1000000);

export const Controls: React.FC<ControlsProps> = ({ onGenerateWorld, isGenerating }) => {
  const [worldWidth, setWorldWidth] = useState(DEFAULT_SPATIAL_CONFIG.worldWidth) // 14.5 km
  const [worldHeight, setWorldHeight] = useState(DEFAULT_SPATIAL_CONFIG.worldHeight) // 9.0 km
  const [branchingFactor, setBranchingFactor] = useState(1.0); // Default branching factor
  const [seed, setSeed] = useState(getRandomSeed());

  // Calculate spatial metrics for display
  const spatialMetrics = useMemo(() => {
    const config: WorldGenerationConfig = {
      worldWidth,
      worldHeight,
      placeSize: DEFAULT_SPATIAL_CONFIG.placeSize,
      placeMargin: DEFAULT_SPATIAL_CONFIG.placeMargin,
      seed
    }
    return calculateSpatialMetrics(config)
  }, [worldWidth, worldHeight, seed])

  const handleGenerateClick = () => {
    const config: WorldGenerationConfig = {
      worldWidth,
      worldHeight,
      placeSize: DEFAULT_SPATIAL_CONFIG.placeSize,
      placeMargin: DEFAULT_SPATIAL_CONFIG.placeMargin,
      seed,
      globalBranchingFactor: branchingFactor
    }
    console.log('Generate World button clicked! Config:', config)
    onGenerateWorld(config)
  }

  const handleRandomizeSeed = () => {
    const newSeed = getRandomSeed();
    console.log('Randomizing seed to:', newSeed);
    setSeed(newSeed);
  }

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('World width changed to:', newValue);
    setWorldWidth(newValue);
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('World height changed to:', newValue);
    setWorldHeight(newValue);
  }

  const handleBranchingFactorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('Branching factor changed to:', newValue);
    setBranchingFactor(newValue);
  }

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('Seed input changed to:', newValue);
    setSeed(newValue);
  }

  return (
    <div className="bg-surface border-b border-border p-4 shadow-sm">
      <div className="flex items-center justify-between gap-8">
        {/* Title Section */}
        <div className="flex-shrink-0">
          <h2 className="text-xl font-semibold text-text-bright">World Generation</h2>
          <p className="text-text-dim text-xs">
            Generate spatial worlds using river delta patterns
          </p>
          <p className="text-text-dim text-xs mt-1">
            Capacity: ~{spatialMetrics.totalPlacesCapacity.toLocaleString()} places ({spatialMetrics.gridWidth}×{spatialMetrics.gridHeight} grid)
          </p>
        </div>

        {/* Controls Section */}
        <div className="flex items-center gap-6">
          {/* World Width Input */}
          <div className="flex items-center gap-2">
            <label htmlFor="worldWidth" className="text-sm font-medium text-text whitespace-nowrap">
              Width (km)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="worldWidth"
                type="range"
                min="5"
                max="50"
                step="0.5"
                value={worldWidth}
                onChange={handleWidthChange}
                className="w-32 h-2 bg-surface rounded-lg appearance-none cursor-pointer slider"
                disabled={isGenerating}
              />
              <span className="text-sm text-text-dim font-mono w-16 text-right">
                {worldWidth.toFixed(1)}
              </span>
            </div>
          </div>

          {/* World Height Input */}
          <div className="flex items-center gap-2">
            <label htmlFor="worldHeight" className="text-sm font-medium text-text whitespace-nowrap">
              Height (km)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="worldHeight"
                type="range"
                min="3"
                max="30"
                step="0.5"
                value={worldHeight}
                onChange={handleHeightChange}
                className="w-32 h-2 bg-surface rounded-lg appearance-none cursor-pointer slider"
                disabled={isGenerating}
              />
              <span className="text-sm text-text-dim font-mono w-16 text-right">
                {worldHeight.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Branching Factor Input */}
          <div className="flex items-center gap-2">
            <label htmlFor="branchingFactor" className="text-sm font-medium text-text whitespace-nowrap">
              Branching Factor
            </label>
            <div className="flex items-center gap-2">
              <input
                id="branchingFactor"
                type="range"
                min="0.1"
                max="1.5"
                step="0.1"
                value={branchingFactor}
                onChange={handleBranchingFactorChange}
                className="w-32 h-2 bg-surface rounded-lg appearance-none cursor-pointer slider"
                disabled={isGenerating}
              />
              <span className="text-sm text-text-dim font-mono w-16 text-right">
                {branchingFactor.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Seed Input */}
          <div className="flex items-center gap-2">
            <label htmlFor="seed" className="text-sm font-medium text-text whitespace-nowrap">
              Random Seed
            </label>
            <div className="flex gap-1">
              <input
                id="seed"
                type="number"
                value={seed}
                onChange={handleSeedChange}
                className="input w-24 text-sm"
                disabled={isGenerating}
              />
              <button
                onClick={handleRandomizeSeed}
                disabled={isGenerating}
                className="btn btn-secondary px-2 py-1 text-sm"
                title="Randomize seed"
              >
                🎲
              </button>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateClick}
            disabled={isGenerating}
            className="btn btn-primary px-6 py-2 text-sm whitespace-nowrap"
          >
            {isGenerating ? 'Generating...' : 'Generate World'}
          </button>
        </div>
      </div>
    </div>
  )
}
