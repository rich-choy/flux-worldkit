import { useState, useCallback } from 'react';
import type { WorldGenerationResult } from '../worldgen/types';
import {
  downloadJSONL,
  generatePlaceURN,
  generatePlaceName,
  generatePlaceDescription,
  convertVertexExitsToPlaceExits,
  generateSimpleWeather
} from '../worldgen/export';
import type { Place } from '@flux';
import { EntityType } from '@flux';

/**
 * Custom export function that assigns the origin place the special URN 'flux:place:origin'
 * and updates all exit references accordingly for MUD server compatibility.
 */
function exportWorldToJSONLWithOriginURN(world: WorldGenerationResult): string {
  // First, identify the origin vertex
  const originVertex = world.vertices.find(v => v.isOrigin);
  if (!originVertex) {
    throw new Error('No origin vertex found in world - required for MUD server compatibility');
  }

  // Generate the original origin URN to map from old to new
  const originalOriginURN = generatePlaceURN(originVertex.ecosystem, [originVertex.x, originVertex.y]);
  const newOriginURN = 'flux:place:origin';

  console.log(`Mapping origin place: ${originalOriginURN} → ${newOriginURN}`);

  // Create Place objects for all vertices
  const places = world.vertices.map(vertex => {
    const coordinates: [number, number] = [vertex.x, vertex.y];
    const isOrigin = vertex.isOrigin;

    // Generate the place ID - special case for origin
    const placeId = isOrigin ? newOriginURN : generatePlaceURN(vertex.ecosystem, coordinates);

    const weather = generateSimpleWeather(vertex);

    const place: Place = {
      type: EntityType.PLACE,
      id: placeId,
      name: generatePlaceName(vertex),
      description: generatePlaceDescription(vertex),
      exits: convertVertexExitsToPlaceExits(vertex, world),
      entities: {},
      resources: { ts: Date.now(), nodes: {} },
      ecosystem: vertex.ecosystem,
      weather: weather,
      coordinates: coordinates
    };
    return place;
  });

  // Update all exit references to use the new origin URN
  places.forEach(place => {
    Object.values(place.exits).forEach(exit => {
      if (exit.to === originalOriginURN) {
        exit.to = newOriginURN;
        console.log(`Updated exit reference: ${originalOriginURN} → ${newOriginURN}`);
      }
    });
  });

  // Verify the origin place exists
  const originPlace = places.find(p => p.id === newOriginURN);
  if (!originPlace) {
    throw new Error('Failed to create origin place with correct URN');
  }

  console.log(`Successfully created origin place: ${newOriginURN} at coordinates [${originPlace.coordinates[0]}, ${originPlace.coordinates[1]}]`);

  return places.map(place => JSON.stringify(place)).join('\n');
}

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
      console.log('Exporting world to JSONL with origin URN format, seed:', seed);

      // Use the custom export function that handles origin URN
      const jsonlContent = exportWorldToJSONLWithOriginURN(world);

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
