import React, { useState, useMemo } from 'react';
import type { WorldGenerationConfig } from '../worldgen/types';

interface ControlsProps {
  onGenerateWorld: (config: WorldGenerationConfig) => void
  isGenerating: boolean
}

const getRandomSeed = () => Math.floor(Math.random() * 1000000);

export const Controls: React.FC<ControlsProps> = ({ onGenerateWorld, isGenerating }) => {
  const [worldWidthKm, setWorldWidthKm] = useState(14.5) // 14.5 km
  const [worldHeightKm, setWorldHeightKm] = useState(9.0) // 9.0 km
  const [branchingFactor, setBranchingFactor] = useState(1.0); // Default branching factor
  const [ditheringStrength, setDitheringStrength] = useState(1.0); // Default dithering strength
  const [showZoneBoundaries, setShowZoneBoundaries] = useState(false); // Show ecosystem boundaries
  const [showFlowDirection, setShowFlowDirection] = useState(false); // Show flow direction arrows
  const [seed, setSeed] = useState(getRandomSeed());

  // Calculate grid dimensions for display
  const gridDimensions = useMemo(() => {
    const placeSpacing = 300; // 300m spacing
    const placeMargin = 200; // 200m margin
    const worldWidthMeters = worldWidthKm * 1000;
    const worldHeightMeters = worldHeightKm * 1000;
    const gridWidth = Math.floor((worldWidthMeters - 2 * placeMargin) / placeSpacing);
    const gridHeight = Math.floor((worldHeightMeters - 2 * placeMargin) / placeSpacing);
    return { gridWidth, gridHeight };
  }, [worldWidthKm, worldHeightKm])

  const handleGenerateClick = () => {
    const config: WorldGenerationConfig = {
      worldWidthKm,
      worldHeightKm,
      branchingFactor,
      ditheringStrength,
      showZoneBoundaries,
      showFlowDirection,
      seed
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
    setWorldWidthKm(newValue);
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('World height changed to:', newValue);
    setWorldHeightKm(newValue);
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
            Grid: {gridDimensions.gridWidth}×{gridDimensions.gridHeight} ({(gridDimensions.gridWidth * gridDimensions.gridHeight).toLocaleString()} vertices)
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
                value={worldWidthKm}
                onChange={handleWidthChange}
                className="w-32 h-2 bg-surface rounded-lg appearance-none cursor-pointer slider"
                disabled={isGenerating}
              />
              <span className="text-sm text-text-dim font-mono w-16 text-right">
                {worldWidthKm.toFixed(1)}
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
                value={worldHeightKm}
                onChange={handleHeightChange}
                className="w-32 h-2 bg-surface rounded-lg appearance-none cursor-pointer slider"
                disabled={isGenerating}
              />
              <span className="text-sm text-text-dim font-mono w-16 text-right">
                {worldHeightKm.toFixed(1)}
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
