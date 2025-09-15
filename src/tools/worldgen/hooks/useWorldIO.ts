import { useState, useCallback } from 'react';
import type { WorldGenerationResult } from '~/worldgen/types';
import { downloadJSONL, exportWorldToJSONL } from '~/worldgen/export';
import { reconstructWorldFromJSONL } from '~/worldgen/import';

interface UseWorldIOReturn {
  exportWorld: (world: WorldGenerationResult, seed: number) => Promise<void>
  importWorld: (file: File) => Promise<WorldGenerationResult>
  isExporting: boolean
  isImporting: boolean
  error: string | null
  clearError: () => void
}

export const useWorldIO = (): UseWorldIOReturn => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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
      console.log('Exporting world to JSONL with origin URN format, seed:', seed);

      // Use the consolidated export function
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
      console.log(`World exported successfully with origin URN: ${filename} (content hash: ${hashHex})`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Export failed';
      console.error('Export failed:', err);
      setError(errorMsg);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const importWorld = useCallback(async (file: File): Promise<WorldGenerationResult> => {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!file.name.endsWith('.jsonl')) {
      throw new Error('Invalid file type. Please select a .jsonl file.');
    }

    setIsImporting(true);
    setError(null);

    try {
      console.log(`Importing world from ${file.name} (${file.size} bytes)`);
      const content = await file.text();
      const importedWorld = reconstructWorldFromJSONL(content);
      console.log('World imported successfully:', importedWorld);
      return importedWorld;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Import failed';
      console.error('Import failed:', err);
      setError(errorMsg);
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    exportWorld,
    importWorld,
    isExporting,
    isImporting,
    error,
    clearError
  };
};
