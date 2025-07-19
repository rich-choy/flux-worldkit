import { useState, useCallback } from 'react';
import type { WorldGenerationResult } from '../worldgen/types';
import { exportWorldToJSONL, downloadJSONL } from '../worldgen/export';

interface UseWorldExportReturn {
  exportWorld: (world: WorldGenerationResult, seed: number) => Promise<void>
  isExporting: boolean
  error: string | null
  clearError: () => void
}

export const useWorldExport = (): UseWorldExportReturn => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportWorld = useCallback(async (world: WorldGenerationResult, seed: number) => {
    if (!world) {
      const errorMsg = 'No world to export';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      console.log('Exporting world to JSONL with seed:', seed);
      const jsonlContent = exportWorldToJSONL(world);

      // Compute SHA-256 hash of the content for deterministic filename
      const encoder = new TextEncoder();
      const data = encoder.encode(jsonlContent);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Use full SHA-256 hash for filename (256-bit content integrity)
      const filename = `${hashHex}.jsonl`;

      downloadJSONL(jsonlContent, filename);
      console.log(`World exported successfully: ${filename} (content hash: ${hashHex})`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Export failed';
      console.error('Export failed:', err);
      setError(errorMsg);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    exportWorld,
    isExporting,
    error,
    clearError
  };
};
