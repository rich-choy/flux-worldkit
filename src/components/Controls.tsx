import React, { useState, useMemo } from 'react';
import type { WorldGenerationConfig, WorldGenerationResult } from '../worldgen/types';
import { exportWorldToJSONL, downloadJSONL } from '../worldgen/export';

interface ControlsProps {
  onGenerateWorld: (config: WorldGenerationConfig) => void
  isGenerating: boolean
  world: WorldGenerationResult | null
  currentSeed: number
}

const getRandomSeed = () => Math.floor(Math.random() * 1000000);

// Simple seeded RNG for deterministic exports (matching generator.ts)
function createSeededRNG(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2**32;
    return state / 2**32;
  };
}

export const Controls: React.FC<ControlsProps> = ({ onGenerateWorld, isGenerating, world, currentSeed }) => {
  const [worldWidthKm, setWorldWidthKm] = useState(14.5) // 14.5 km
  const [worldHeightKm, setWorldHeightKm] = useState(9.0) // 9.0 km
  const [branchingFactor, setBranchingFactor] = useState(1.0); // Default branching factor
  const [ditheringStrength, setDitheringStrength] = useState(0.5); // Default dithering strength
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

  const handleExportClick = async () => {
    if (!world) {
      console.error('No world to export');
      return;
    }

    try {
      // Use the same seed as the world generation for deterministic exports
      const exportSeed = currentSeed || seed;
      const rng = createSeededRNG(exportSeed);

      console.log('Exporting world to JSONL with seed:', exportSeed);
      const jsonlContent = exportWorldToJSONL(world, rng);

      // Compute SHA-256 hash of the content for deterministic filename
      const encoder = new TextEncoder();
      const data = encoder.encode(jsonlContent);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Use first 16 characters of hash for filename (64-bit collision resistance)
      const hashPrefix = hashHex.substring(0, 16);
      const filename = `world-${hashPrefix}.jsonl`;

      downloadJSONL(jsonlContent, filename);
      console.log(`World exported successfully: ${filename} (content hash: ${hashHex})`);
    } catch (error) {
      console.error('Export failed:', error);
    }
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

  const handleDitheringStrengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('Dithering strength changed to:', newValue);
    setDitheringStrength(newValue);
  }

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('Seed input changed to:', newValue);
    setSeed(newValue);
  }

  return (
    <div className="bg-surface border-b border-border p-2 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        {/* Title Section */}
        <div className="flex-shrink-0">
          <h2 className="text-lg font-semibold text-text-bright">World Generation</h2>
          <p className="text-text-dim text-xs">
            {gridDimensions.gridWidth}×{gridDimensions.gridHeight} grid ({(gridDimensions.gridWidth * gridDimensions.gridHeight).toLocaleString()} vertices)
          </p>
        </div>

        {/* Controls Section */}
        <div className="flex items-center gap-3">
          {/* World Width Input */}
          <div className="flex items-center gap-1">
            <label htmlFor="worldWidth" className="text-xs font-medium text-text whitespace-nowrap">
              Width
            </label>
            <input
              id="worldWidth"
              type="range"
              min="5"
              max="50"
              step="0.5"
              value={worldWidthKm}
              onChange={handleWidthChange}
              className="w-20 h-1 bg-surface rounded-lg appearance-none cursor-pointer slider"
              disabled={isGenerating}
            />
            <span className="text-xs text-text-dim font-mono w-8 text-right">
              {worldWidthKm.toFixed(1)}
            </span>
          </div>

          {/* World Height Input */}
          <div className="flex items-center gap-1">
            <label htmlFor="worldHeight" className="text-xs font-medium text-text whitespace-nowrap">
              Height
            </label>
            <input
              id="worldHeight"
              type="range"
              min="3"
              max="30"
              step="0.5"
              value={worldHeightKm}
              onChange={handleHeightChange}
              className="w-20 h-1 bg-surface rounded-lg appearance-none cursor-pointer slider"
              disabled={isGenerating}
            />
            <span className="text-xs text-text-dim font-mono w-8 text-right">
              {worldHeightKm.toFixed(1)}
            </span>
          </div>

          {/* Branching Factor Input */}
          <div className="flex items-center gap-1">
            <label htmlFor="branchingFactor" className="text-xs font-medium text-text whitespace-nowrap">
              Branching
            </label>
            <input
              id="branchingFactor"
              type="range"
              min="0.1"
              max="1.5"
              step="0.1"
              value={branchingFactor}
              onChange={handleBranchingFactorChange}
              className="w-20 h-1 bg-surface rounded-lg appearance-none cursor-pointer slider"
              disabled={isGenerating}
            />
            <span className="text-xs text-text-dim font-mono w-8 text-right">
              {branchingFactor.toFixed(1)}
            </span>
          </div>

          {/* Dithering Strength Input */}
          <div className="flex items-center gap-1">
            <label htmlFor="ditheringStrength" className="text-xs font-medium text-text whitespace-nowrap">
              Dithering
            </label>
            <input
              id="ditheringStrength"
              type="range"
              min="0.0"
              max="1.0"
              step="0.1"
              value={ditheringStrength}
              onChange={handleDitheringStrengthChange}
              className="w-20 h-1 bg-surface rounded-lg appearance-none cursor-pointer slider"
              disabled={isGenerating}
            />
            <span className="text-xs text-text-dim font-mono w-8 text-right">
              {ditheringStrength.toFixed(1)}
            </span>
          </div>

          {/* Seed Input */}
          <div className="flex items-center gap-1">
            <label htmlFor="seed" className="text-xs font-medium text-text whitespace-nowrap">
              Seed
            </label>
            <input
              id="seed"
              type="number"
              value={seed}
              onChange={handleSeedChange}
              className="input w-16 text-xs"
              disabled={isGenerating}
            />
            <button
              onClick={handleRandomizeSeed}
              disabled={isGenerating}
              className="btn btn-secondary px-1 py-0 text-xs"
              title="Randomize seed"
            >
              🎲
            </button>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateClick}
            disabled={isGenerating}
            className="btn btn-primary px-3 py-1 text-xs whitespace-nowrap"
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>

          {/* Export Button */}
          <button
            onClick={handleExportClick}
            disabled={isGenerating || !world}
            className="btn btn-secondary px-3 py-1 text-xs whitespace-nowrap"
            title="Export world to JSONL"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
