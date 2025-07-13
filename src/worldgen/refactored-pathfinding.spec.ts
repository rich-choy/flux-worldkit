/**
 * Unit tests for the refactored pathfinding architecture
 * This demonstrates the clean separation between pure geometric pathfinding
 * and ecosystem policy enforcement
 */

import { describe, it, expect } from 'vitest';
import { findGridPath, manhattanDistance, chebyshevDistance, type GridCoords } from './pure-pathfinding.js';
import { createBridge, determineEcosystemFromGridX } from './bridge-policy.js';
import { EcosystemName } from './types.js';
import type { WorldVertex, SpatialMetrics } from './types.js';

describe('Pure Geometric Pathfinding', () => {

  it('should find simple horizontal path', () => {
    const start: GridCoords = { gridX: 0, gridY: 5 };
    const end: GridCoords = { gridX: 3, gridY: 5 };

    const path = findGridPath(start, end);

    expect(path).toEqual([
      { gridX: 1, gridY: 5 },
      { gridX: 2, gridY: 5 },
      { gridX: 3, gridY: 5 }
    ]);
  });

  it('should find diagonal path', () => {
    const start: GridCoords = { gridX: 0, gridY: 0 };
    const end: GridCoords = { gridX: 2, gridY: 2 };

    const path = findGridPath(start, end);

    expect(path).toEqual([
      { gridX: 1, gridY: 1 },
      { gridX: 2, gridY: 2 }
    ]);
  });

  it('should respect collision constraints', () => {
    const start: GridCoords = { gridX: 0, gridY: 0 };
    const end: GridCoords = { gridX: 2, gridY: 0 };
    const occupiedPositions = new Set(['1,0']); // Block the direct path

    const path = findGridPath(start, end, { occupiedPositions });

    // Should find alternative path or fail
    if (path.length > 0) {
      // Verify no path step uses occupied position
      for (const step of path) {
        expect(occupiedPositions.has(`${step.gridX},${step.gridY}`)).toBe(false);
      }
      expect(path[path.length - 1]).toEqual({ gridX: 2, gridY: 0 });
    }
  });

  it('should respect bounds constraints', () => {
    const start: GridCoords = { gridX: 0, gridY: 0 };
    const end: GridCoords = { gridX: 5, gridY: 0 };

    const path = findGridPath(start, end, {
      minX: 0,
      minY: 0,
      maxX: 3,  // Limit grid width
      maxY: 5
    });

    expect(path).toEqual([]); // Should fail - can't reach destination within bounds
  });

  it('should have no ecosystem knowledge whatsoever', () => {
    // This pathfinder should work even across "ecosystem boundaries"
    // It doesn't know what ecosystems are!
    const start: GridCoords = { gridX: 1, gridY: 1 }; // "steppe"
    const end: GridCoords = { gridX: 4, gridY: 1 };   // "jungle"

    const path = findGridPath(start, end);

    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ gridX: 4, gridY: 1 });
  });

});

describe('Ecosystem Policy Layer', () => {

  const mockMetrics: SpatialMetrics = {
    worldWidthMeters: 1500,
    worldHeightMeters: 900,
    placeSize: 100,
    placeMargin: 200,
    placeSpacing: 300,
    gridWidth: 5,
    gridHeight: 3,
    totalPlacesCapacity: 15,
    ecosystemBandWidth: 300,
    ecosystemBandCount: 5
  };

  const steppeVertex: WorldVertex = {
    id: 'steppe-1',
    x: 200, y: 200,
    gridX: 0, gridY: 0,
    ecosystem: EcosystemName.STEPPE_ARID,
    placeId: 'flux:place:steppe-1'
  };

  const jungleVertex: WorldVertex = {
    id: 'jungle-1',
    x: 600, y: 200,
    gridX: 4, gridY: 0,
    ecosystem: EcosystemName.JUNGLE_TROPICAL,
    placeId: 'flux:place:jungle-1'
  };

  it('should enforce ecosystem policy by default', () => {
    const result = createBridge(steppeVertex, jungleVertex, 1000, mockMetrics);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Cross-ecosystem bridge from steppe to jungle not allowed by policy');
  });

  it('should allow cross-ecosystem bridges when explicitly permitted', () => {
    const result = createBridge(
      steppeVertex,
      jungleVertex,
      1000,
      mockMetrics,
      [],
      { allowCrossEcosystem: true }
    );

    expect(result.success).toBe(true);
    expect(result.intermediateVertices.length).toBeGreaterThan(0);
    expect(result.connections.length).toBeGreaterThan(0);
  });

  it('should determine correct ecosystem from grid position', () => {
    expect(determineEcosystemFromGridX(0, mockMetrics)).toBe(EcosystemName.STEPPE_ARID);
    expect(determineEcosystemFromGridX(1, mockMetrics)).toBe(EcosystemName.GRASSLAND_TEMPERATE);
    expect(determineEcosystemFromGridX(4, mockMetrics)).toBe(EcosystemName.JUNGLE_TROPICAL);
  });

  it('should create bridges within same ecosystem without issues', () => {
    const steppeVertex2: WorldVertex = {
      id: 'steppe-2',
      x: 300, y: 200,
      gridX: 1, gridY: 0,
      ecosystem: EcosystemName.STEPPE_ARID,
      placeId: 'flux:place:steppe-2'
    };

    const result = createBridge(steppeVertex, steppeVertex2, 1000, mockMetrics);

    expect(result.success).toBe(true);
  });

});

describe('BUG FIX: Cross-ecosystem bridge creation', () => {

  it('FIXED: Can now create cross-ecosystem bridges when policy allows', () => {
    const mockMetrics: SpatialMetrics = {
      worldWidthMeters: 1500,
      worldHeightMeters: 900,
      placeSize: 100,
      placeMargin: 200,
      placeSpacing: 300,
      gridWidth: 5,
      gridHeight: 3,
      totalPlacesCapacity: 15,
      ecosystemBandWidth: 300,
      ecosystemBandCount: 5
    };

    const steppeVertex: WorldVertex = {
      id: 'steppe-origin',
      x: 200, y: 200,
      gridX: 0, gridY: 0,
      ecosystem: EcosystemName.STEPPE_ARID,
      placeId: 'flux:place:steppe-origin'
    };

    const jungleVertex: WorldVertex = {
      id: 'jungle-destination',
      x: 600, y: 200,
      gridX: 4, gridY: 0,
      ecosystem: EcosystemName.JUNGLE_TROPICAL,
      placeId: 'flux:place:jungle-destination'
    };

    // This should now work with the refactored architecture
    const result = createBridge(
      steppeVertex,
      jungleVertex,
      2000,
      mockMetrics,
      [],
      { allowCrossEcosystem: true }  // Policy explicitly allows it
    );

    expect(result.success).toBe(true);
    expect(result.intermediateVertices.length).toBeGreaterThan(0);
    expect(result.connections.length).toBeGreaterThan(0);

    // Verify the path actually connects the ecosystems
    expect(result.connections[0].from).toBe('steppe-origin');
    expect(result.connections[result.connections.length - 1].to).toBe('jungle-destination');

    console.log(`✅ Bridge created with ${result.intermediateVertices.length} intermediate vertices and ${result.connections.length} connections`);
  });

});

describe('Utility Functions', () => {

  it('should calculate Manhattan distance correctly', () => {
    const a: GridCoords = { gridX: 0, gridY: 0 };
    const b: GridCoords = { gridX: 3, gridY: 4 };

    expect(manhattanDistance(a, b)).toBe(7);
  });

  it('should calculate Chebyshev distance correctly', () => {
    const a: GridCoords = { gridX: 0, gridY: 0 };
    const b: GridCoords = { gridX: 3, gridY: 4 };

    expect(chebyshevDistance(a, b)).toBe(4);
  });

});
