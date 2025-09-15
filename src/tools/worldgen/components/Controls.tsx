import React, { useState } from 'react';
import type { WorldGenerationConfig, WorldGenerationResult } from '~/worldgen/types';
import { useWorldIO } from '~/tools/worldgen/hooks/useWorldIO';
import { FileImportModal } from './FileImportModal';

interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface ControlsProps {
  onGenerateWorld: (config: WorldGenerationConfig) => void;
  onWorldImported: (world: WorldGenerationResult) => void;
  isGenerating: boolean;
  world: WorldGenerationResult | null;
  currentSeed: number;
}

function getRandomSeed() {
  return Math.floor(Math.random() * 1_000_000);
}

export const Controls: React.FC<ControlsProps> = ({
  onGenerateWorld,
  onWorldImported,
  isGenerating,
  world,
  currentSeed
}) => {
  const [worldWidthKm, setWorldWidthKm] = useState(31.0); // 31.0 km
  const [worldHeightKm, setWorldHeightKm] = useState(11.0); // 11.0 km
  const [branchingFactor, setBranchingFactor] = useState(0.6); // Default branching factor
  const [seed, setSeed] = useState(getRandomSeed());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Use the world IO hook
  const { exportWorld, importWorld, isExporting, isImporting, clearError } = useWorldIO();

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000); // Remove after 5 seconds
  };

  const handleGenerateClick = () => {
    const config: WorldGenerationConfig = {
      worldWidthKm,
      worldHeightKm,
      branchingFactor,
      ditheringStrength: 0.5, // Fixed value
      seed
    };
    console.log('Generate World button clicked! Config:', config);
    onGenerateWorld(config);
  };

  const handleRandomizeSeed = () => {
    const newSeed = getRandomSeed();
    console.log('Randomizing seed to:', newSeed);
    setSeed(newSeed);
  };

  const handleExportClick = async () => {
    if (!world) {
      console.error('No world to export');
      return;
    }

    try {
      // Use the same seed as the world generation for deterministic exports
      const exportSeed = currentSeed || seed;
      await exportWorld(world, exportSeed);
      showToast('success', 'World exported successfully');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleFileSelected = async (file: File) => {
    try {
      clearError();
      const importedWorld = await importWorld(file);
      onWorldImported(importedWorld);
      showToast('success', 'World imported successfully');
    } catch (err) {
      // Error is already handled by the hook
      console.error('Failed to import world:', err);
      showToast('error', err instanceof Error ? err.message : 'Import failed');
    }
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('World width changed to:', newValue);
    setWorldWidthKm(newValue);
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('World height changed to:', newValue);
    setWorldHeightKm(newValue);
  };

  const handleBranchingFactorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('Branching factor changed to:', newValue);
    setBranchingFactor(newValue);
  };

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    console.log('Seed input changed to:', newValue);
    setSeed(newValue);
  };

  return (
    <>
      <div className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <label htmlFor="worldWidth" className="text-base font-medium text-text whitespace-nowrap">
                Width (km)
              </label>
              <input
                id="worldWidth"
                type="range"
                min="20.0"
                max="40.0"
                step="0.5"
                value={worldWidthKm}
                onChange={handleWidthChange}
                className="w-32 h-2 bg-surface rounded-lg appearance-none cursor-pointer slider"
                disabled={isGenerating}
              />
              <span className="text-base text-text-dim font-mono w-14 text-right">
                {worldWidthKm.toFixed(1)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="worldHeight" className="text-base font-medium text-text whitespace-nowrap">
                Height (km)
              </label>
              <input
                id="worldHeight"
                type="range"
                min="8.0"
                max="14.0"
                step="0.5"
                value={worldHeightKm}
                onChange={handleHeightChange}
                className="w-32 h-2 bg-surface rounded-lg appearance-none cursor-pointer slider"
                disabled={isGenerating}
              />
              <span className="text-base text-text-dim font-mono w-14 text-right">
                {worldHeightKm.toFixed(1)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="branchingFactor" className="text-base font-medium text-text whitespace-nowrap">
                Branching
              </label>
              <input
                id="branchingFactor"
                type="range"
                min="0.4"
                max="1.0"
                step="0.1"
                value={branchingFactor}
                onChange={handleBranchingFactorChange}
                className="w-32 h-2 bg-surface rounded-lg appearance-none cursor-pointer slider"
                disabled={isGenerating}
              />
              <span className="text-base text-text-dim font-mono w-14 text-right">
                {branchingFactor.toFixed(1)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="seed" className="text-base font-medium text-text whitespace-nowrap">
                Seed
              </label>
              <input
                id="seed"
                type="number"
                value={seed}
                onChange={handleSeedChange}
                className="input w-28 text-base"
                disabled={isGenerating}
              />
              <button
                onClick={handleRandomizeSeed}
                disabled={isGenerating}
                className="btn btn-secondary px-2 py-1 text-base"
                title="Randomize seed"
              >
                🎲
              </button>
            </div>

            <div className="h-8 w-px bg-border mx-2" /> {/* Vertical divider */}

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateClick}
                disabled={isGenerating}
                className="btn btn-primary px-5 py-2 text-base whitespace-nowrap"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                disabled={isGenerating || isImporting}
                className="btn btn-secondary px-5 py-2 text-base whitespace-nowrap"
                title="Import world from JSONL"
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>

              <button
                onClick={handleExportClick}
                disabled={isGenerating || !world || isExporting}
                className="btn btn-secondary px-5 py-2 text-base whitespace-nowrap"
                title="Export world to JSONL"
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-6 py-3 rounded-lg shadow-lg text-base font-medium transition-opacity duration-200 ${
              toast.type === 'success'
                ? 'bg-success/10 text-success border border-success/20'
                : 'bg-danger/10 text-danger border border-danger/20'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Import Modal */}
      <FileImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onFileSelected={handleFileSelected}
      />
    </>
  );
};
