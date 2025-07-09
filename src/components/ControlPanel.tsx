import React from 'react'
import type { WorldGenerationConfig } from '@flux'

interface ControlPanelProps {
  config: WorldGenerationConfig
  onConfigChange: (newConfig: Partial<WorldGenerationConfig>) => void
  onGenerateWorld: () => void
  onExportWorldData: () => void
  onExportGameFormat: () => void
  isLoading: boolean
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  config,
  onConfigChange,
  onGenerateWorld,
  onExportWorldData,
  onExportGameFormat,
  isLoading
}) => {
  const handleSliderChange = (key: keyof WorldGenerationConfig, value: number) => {
    onConfigChange({ [key]: value })
  }

  const handleSeedChange = (value: number) => {
    onConfigChange({ random_seed: value })
  }

  const randomizeSeed = () => {
    const newSeed = Math.floor(Math.random() * 10000)
    handleSeedChange(newSeed)
  }

  return (
    <div className="controls-panel">
      <div className="control-group">
        <h3>World Configuration</h3>

        <div className="slider-control">
          <label>Random Seed</label>
          <input
            type="number"
            value={config.random_seed}
            min="0"
            max="10000"
            onChange={(e) => handleSeedChange(parseInt(e.target.value))}
          />
          <button className="btn secondary" onClick={randomizeSeed}>
            Randomize
          </button>
        </div>

        <div className="slider-control">
          <label>Place Density</label>
          <input
            type="range"
            min="0.01"
            max="5.0"
            step="0.05"
            value={config.place_density}
            onChange={(e) => handleSliderChange('place_density', parseFloat(e.target.value))}
          />
          <div className="slider-value">
            {config.place_density.toFixed(2)}
            <span className="text-text-dim text-xs ml-2">
              (~{Math.round(config.place_density * 2058)} places)
            </span>
          </div>
        </div>

        <div className="slider-control">
          <label>G.A.E.A. Intensity</label>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.1"
            value={config.gaea_intensity}
            onChange={(e) => handleSliderChange('gaea_intensity', parseFloat(e.target.value))}
          />
          <div className="slider-value">{config.gaea_intensity.toFixed(1)}</div>
        </div>

        <div className="slider-control">
          <label>Fungal Spread</label>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.1"
            value={config.fungal_spread_factor}
            onChange={(e) => handleSliderChange('fungal_spread_factor', parseFloat(e.target.value))}
          />
          <div className="slider-value">{config.fungal_spread_factor.toFixed(1)}</div>
        </div>

        <div className="slider-control">
          <label>Worshipper Density</label>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.1"
            value={config.worshipper_density}
            onChange={(e) => handleSliderChange('worshipper_density', parseFloat(e.target.value))}
          />
          <div className="slider-value">{config.worshipper_density.toFixed(1)}</div>
        </div>
      </div>

      <div className="control-group">
        <h3>Actions</h3>
        <div className="button-group">
          <button
            className="btn"
            onClick={onGenerateWorld}
            disabled={isLoading}
          >
            {isLoading ? 'Generating...' : 'Generate New World'}
          </button>
          <button className="btn secondary" onClick={onExportWorldData}>
            Export World Data
          </button>
          <button className="btn secondary" onClick={onExportGameFormat}>
            Export Game Format
          </button>
        </div>
      </div>
    </div>
  )
}
