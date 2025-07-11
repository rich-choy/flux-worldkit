import React, { useState } from 'react';

interface ControlsProps {
  onGenerateWorld: (config: { minPlaces: number; seed: number }) => void
  isGenerating: boolean
}

const getRandomSeed = () => Math.floor(Math.random() * 1000000);

export const Controls: React.FC<ControlsProps> = ({ onGenerateWorld, isGenerating }) => {
  const [minPlaces, setMinPlaces] = useState(1000) // Initial value: 1000
  const [seed, setSeed] = useState(getRandomSeed());

  const handleGenerateClick = () => {
    console.log('Generate World button clicked! Config:', { minPlaces, seed })
    onGenerateWorld({ minPlaces, seed })
  }

  const handleRandomizeSeed = () => {
    const newSeed = getRandomSeed();
    console.log('Randomizing seed to:', newSeed);
    setSeed(newSeed);
  }

  const handlePlacesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('Places slider changed to:', newValue);
    setMinPlaces(newValue);
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
            Generate procedural worlds using Lichtenberg fractals
          </p>
        </div>

        {/* Controls Section */}
        <div className="flex items-center gap-6">
          {/* Places Input */}
          <div className="flex items-center gap-2">
            <label htmlFor="minPlaces" className="text-sm font-medium text-text whitespace-nowrap">
              Approx # of Places
            </label>
            <div className="flex items-center gap-2">
              <input
                id="minPlaces"
                type="range"
                min="100"
                max="9900"
                value={minPlaces}
                onChange={handlePlacesChange}
                className="w-32 h-2 bg-surface rounded-lg appearance-none cursor-pointer slider"
                disabled={isGenerating}
              />
              <span className="text-sm text-text-dim font-mono w-16 text-right">
                {minPlaces.toLocaleString()}
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
