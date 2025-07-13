/**
 * Exhaustive unit tests for createGridAlignedPath function
 * Testing all edge cases to identify bugs in the grid alignment logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGridAlignedPath,
  SeededRandom,
  getEcosystemBoundary,
  determineEcosystemFromGridX
} from './river-delta';
import type { WorldVertex, SpatialMetrics } from './types';
import { EcosystemName, calculateSpatialMetrics } from './types';

describe('createGridAlignedPath', () => {
  let metrics: SpatialMetrics;
  let rng: SeededRandom;

  beforeEach(() => {
    metrics = calculateSpatialMetrics({
      worldWidth: 14.5,
      worldHeight: 9.0,
      placeSize: 100,
      placeMargin: 200
    });
    rng = new SeededRandom(42);
  });

    // Helper function to create test vertices with correct coordinates for each ecosystem
  const createVertex = (
    id: string,
    gridX: number,
    gridY: number,
    ecosystem: EcosystemName
  ): WorldVertex => ({
    id,
    x: metrics.placeMargin + gridX * metrics.placeSpacing,
    y: metrics.placeMargin + gridY * metrics.placeSpacing,
    gridX,
    gridY,
    ecosystem,
    placeId: `flux:place:${id}`
  });

  // Helper function to get safe coordinates within an ecosystem
  const getSafeCoordinates = (ecosystem: EcosystemName): { startX: number; endX: number } => {
    const boundary = getEcosystemBoundary(ecosystem, metrics);
    return {
      startX: boundary.startCol + 2, // 2 columns from start
      endX: boundary.endCol - 3      // 3 columns from end
    };
  };

  // Helper function to calculate angle between two grid points
  const calculateGridAngle = (from: {gridX: number, gridY: number}, to: {gridX: number, gridY: number}): number => {
    const deltaX = to.gridX - from.gridX;
    const deltaY = to.gridY - from.gridY;
    const angleRad = Math.atan2(deltaY, deltaX);
    const angleDeg = angleRad * (180 / Math.PI);
    return ((angleDeg % 360) + 360) % 360; // Normalize to 0-360
  };

  // Helper function to check if angle is a multiple of 45 degrees
  const isValidGridAngle = (angle: number): boolean => {
    const normalized = ((angle % 360) + 360) % 360;
    const remainder = normalized % 45;
    return Math.abs(remainder) < 1e-10 || Math.abs(remainder - 45) < 1e-10;
  };

  // Helper function to get valid 45-degree angles
  const getValidAngles = (): number[] => [0, 45, 90, 135, 180, 225, 270, 315];

  describe('Cross-Ecosystem Behavior', () => {
    it('should return direct connection for cross-ecosystem paths', () => {
      const fromVertex = createVertex('from', 5, 5, EcosystemName.STEPPE_ARID);
      const toVertex = createVertex('to', 25, 10, EcosystemName.JUNGLE_TROPICAL);

      const result = createGridAlignedPath(
        fromVertex,
        toVertex,
        EcosystemName.STEPPE_ARID,
        1,
        metrics,
        rng
      );

      // Should create direct connection with no intermediates
      expect(result.intermediateVertices).toHaveLength(0);
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0]).toEqual({
        from: fromVertex.id,
        to: toVertex.id
      });
    });

    it('should not create intermediate vertices across ecosystem boundaries', () => {
      // Test every ecosystem boundary
      const ecosystems = [
        EcosystemName.STEPPE_ARID,
        EcosystemName.GRASSLAND_TEMPERATE,
        EcosystemName.FOREST_TEMPERATE,
        EcosystemName.MOUNTAIN_ARID,
        EcosystemName.JUNGLE_TROPICAL
      ];

      for (let i = 0; i < ecosystems.length - 1; i++) {
        const currentEco = ecosystems[i];
        const nextEco = ecosystems[i + 1];

        const boundary = getEcosystemBoundary(currentEco, metrics);
        const fromVertex = createVertex('from', boundary.endCol - 1, 5, currentEco);
        const toVertex = createVertex('to', boundary.endCol + 5, 5, nextEco);

        const result = createGridAlignedPath(
          fromVertex,
          toVertex,
          currentEco,
          1,
          metrics,
          rng
        );

        expect(result.intermediateVertices).toHaveLength(0);
        expect(result.connections).toHaveLength(1);
      }
    });
  });

    describe('Same Ecosystem Paths', () => {
    const ecosystem = EcosystemName.FOREST_TEMPERATE;

    it('should handle identical positions', () => {
      const safeCoords = getSafeCoordinates(ecosystem); // forest: columns 20-29, so safe range 22-26
      const vertex = createVertex('same', safeCoords.startX, 10, ecosystem);

      const result = createGridAlignedPath(
        vertex,
        vertex,
        ecosystem,
        1,
        metrics,
        rng
      );

      expect(result.intermediateVertices).toHaveLength(0);
      expect(result.connections).toHaveLength(0);
    });

        it('should handle adjacent positions (1 step)', () => {
      const safeCoords = getSafeCoordinates(ecosystem);
      const startX = safeCoords.startX + 2; // Use middle of safe range
      const fromVertex = createVertex('from', startX, 10, ecosystem);

      // Test all 8 cardinal directions
      const directions = [
        { name: 'East', gridX: startX + 1, gridY: 10 },
        { name: 'Southeast', gridX: startX + 1, gridY: 11 },
        { name: 'South', gridX: startX, gridY: 11 },
        { name: 'Southwest', gridX: startX - 1, gridY: 11 },
        { name: 'West', gridX: startX - 1, gridY: 10 },
        { name: 'Northwest', gridX: startX - 1, gridY: 9 },
        { name: 'North', gridX: startX, gridY: 9 },
        { name: 'Northeast', gridX: startX + 1, gridY: 9 }
      ];

      directions.forEach(dir => {
        const toVertex = createVertex('to', dir.gridX, dir.gridY, ecosystem);

        const result = createGridAlignedPath(
          fromVertex,
          toVertex,
          ecosystem,
          1,
          metrics,
          rng
        );

        // Adjacent positions should have no intermediates
        expect(result.intermediateVertices).toHaveLength(0);
        expect(result.connections).toHaveLength(1);
        expect(result.connections[0]).toEqual({
          from: fromVertex.id,
          to: toVertex.id
        });
      });
    });

    it('should create proper diagonal paths', () => {
      const safeCoords = getSafeCoordinates(ecosystem);
      const startX = safeCoords.startX;
      const fromVertex = createVertex('from', startX, 10, ecosystem);
      const toVertex = createVertex('to', startX + 5, 15, ecosystem); // Pure diagonal (5 steps)

      const result = createGridAlignedPath(
        fromVertex,
        toVertex,
        ecosystem,
        1,
        metrics,
        rng
      );

      // Should create 4 intermediate vertices (excluding start and end)
      expect(result.intermediateVertices).toHaveLength(4);
      expect(result.connections).toHaveLength(5); // 4 intermediates + 1 final connection

      // Verify path goes diagonally
      let currentX = fromVertex.gridX;
      let currentY = fromVertex.gridY;

      result.intermediateVertices.forEach((vertex, index) => {
        currentX += 1; // Should move diagonally
        currentY += 1;
        expect(vertex.gridX).toBe(currentX);
        expect(vertex.gridY).toBe(currentY);
        expect(vertex.ecosystem).toBe(ecosystem);
        expect(vertex.id).toBe(`bridge-${index + 1}`);
      });
    });

    it('should create proper orthogonal paths', () => {
      const safeCoords = getSafeCoordinates(ecosystem);
      const startX = safeCoords.startX;
      const testCases = [
        { name: 'Horizontal East', from: [startX, 10], to: [startX + 5, 10] },
        { name: 'Horizontal West', from: [startX + 5, 10], to: [startX, 10] },
        { name: 'Vertical South', from: [startX, 10], to: [startX, 15] },
        { name: 'Vertical North', from: [startX, 15], to: [startX, 10] }
      ];

      testCases.forEach(testCase => {
        const fromVertex = createVertex('from', testCase.from[0], testCase.from[1], ecosystem);
        const toVertex = createVertex('to', testCase.to[0], testCase.to[1], ecosystem);

        const result = createGridAlignedPath(
          fromVertex,
          toVertex,
          ecosystem,
          1,
          metrics,
          rng
        );

        // Should create 4 intermediate vertices
        expect(result.intermediateVertices).toHaveLength(4);
        expect(result.connections).toHaveLength(5);

        // Verify all connections maintain 45-degree constraint
        let prevVertex = fromVertex;

        result.intermediateVertices.forEach(currentVertex => {
          const connection = result.connections.find(c => c.from === prevVertex.id && c.to === currentVertex.id);
          expect(connection).toBeDefined();

          const angle = calculateGridAngle(prevVertex, currentVertex);
          expect(isValidGridAngle(angle)).toBe(true);

          prevVertex = currentVertex;
        });

        // Check final connection
        const finalConnection = result.connections.find(c => c.to === toVertex.id);
        expect(finalConnection).toBeDefined();
      });
    });

    it('should create L-shaped paths correctly', () => {
      const safeCoords = getSafeCoordinates(ecosystem);
      const startX = safeCoords.startX;
      const fromVertex = createVertex('from', startX, 10, ecosystem);
      const toVertex = createVertex('to', startX + 5, 13, ecosystem); // 5 east, 3 south

      const result = createGridAlignedPath(
        fromVertex,
        toVertex,
        ecosystem,
        1,
        metrics,
        rng
      );

      // Should prefer diagonal movement first, then orthogonal
      // 3 diagonal moves (SE), then 2 orthogonal moves (E)
      expect(result.intermediateVertices).toHaveLength(7); // Total path length - 1
      expect(result.connections).toHaveLength(8);

      // Verify path correctness
      let currentX = fromVertex.gridX;
      let currentY = fromVertex.gridY;

      // First 3 moves should be diagonal (southeast)
      for (let i = 0; i < 3; i++) {
        const vertex = result.intermediateVertices[i];
        currentX += 1;
        currentY += 1;
        expect(vertex.gridX).toBe(currentX);
        expect(vertex.gridY).toBe(currentY);
      }

      // Next 2 moves should be orthogonal (east)
      for (let i = 3; i < 5; i++) {
        const vertex = result.intermediateVertices[i];
        currentX += 1;
        expect(vertex.gridX).toBe(currentX);
        expect(vertex.gridY).toBe(currentY);
      }
    });

    it('should maintain 45-degree angles for all connections', () => {
      const safeCoords = getSafeCoordinates(ecosystem);
      const startX = safeCoords.startX;
      const testPaths = [
        { from: [startX, 5], to: [startX + 5, 10] },   // Diagonal NE
        { from: [startX, 5], to: [startX + 5, 1] },    // L-shaped
        { from: [startX + 2, 5], to: [startX - 1, 8] },     // L-shaped opposite
        { from: [startX, 5], to: [startX + 5, 5] },    // Horizontal
        { from: [startX, 5], to: [startX, 12] },    // Vertical
        { from: [startX + 3, 10], to: [startX, 7] }    // Diagonal SW
      ];

      testPaths.forEach((path, pathIndex) => {
        const fromVertex = createVertex('from', path.from[0], path.from[1], ecosystem);
        const toVertex = createVertex('to', path.to[0], path.to[1], ecosystem);

        const result = createGridAlignedPath(
          fromVertex,
          toVertex,
          ecosystem,
          1,
          metrics,
          rng
        );

        // Build complete path including start and end
        const fullPath = [fromVertex, ...result.intermediateVertices, toVertex];

        // Check every connection in the path
        for (let i = 0; i < fullPath.length - 1; i++) {
          const from = fullPath[i];
          const to = fullPath[i + 1];

          const angle = calculateGridAngle(from, to);
          const isValid = isValidGridAngle(angle);

          if (!isValid) {
            console.error(`Path ${pathIndex}: Invalid angle ${angle}° between (${from.gridX},${from.gridY}) and (${to.gridX},${to.gridY})`);
            console.error(`Valid angles are: ${getValidAngles().join(', ')}`);
          }

          expect(isValid).toBe(true);
        }
      });
    });
  });

  describe('Boundary Respect', () => {
    it('should stop at ecosystem boundaries within same ecosystem paths', () => {
      // Create path that would cross boundary if not stopped
      const boundary = getEcosystemBoundary(EcosystemName.FOREST_TEMPERATE, metrics);
      const fromVertex = createVertex('from', boundary.endCol - 2, 10, EcosystemName.FOREST_TEMPERATE);
      const toVertex = createVertex('to', boundary.endCol + 3, 10, EcosystemName.FOREST_TEMPERATE);

      const result = createGridAlignedPath(
        fromVertex,
        toVertex,
        EcosystemName.FOREST_TEMPERATE,
        1,
        metrics,
        rng
      );

      // Should only create intermediates up to the boundary
      result.intermediateVertices.forEach(vertex => {
        expect(vertex.gridX).toBeLessThan(boundary.endCol);
        expect(vertex.ecosystem).toBe(EcosystemName.FOREST_TEMPERATE);
      });
    });

    it('should respect ecosystem assignment for intermediate vertices', () => {
      const ecosystem = EcosystemName.GRASSLAND_TEMPERATE;
      const fromVertex = createVertex('from', 10, 10, ecosystem);
      const toVertex = createVertex('to', 15, 15, ecosystem);

      const result = createGridAlignedPath(
        fromVertex,
        toVertex,
        ecosystem,
        1,
        metrics,
        rng
      );

      result.intermediateVertices.forEach(vertex => {
        expect(vertex.ecosystem).toBe(ecosystem);

        // Verify ecosystem assignment matches grid position
        const expectedEcosystem = determineEcosystemFromGridX(vertex.gridX, metrics);
        // If they differ, it means we crossed a boundary (which shouldn't happen)
        if (expectedEcosystem !== ecosystem) {
          console.error(`Vertex at gridX=${vertex.gridX} has ecosystem ${vertex.ecosystem} but should be ${expectedEcosystem}`);
        }
      });
    });
  });

  describe('Connection Sequence', () => {
    it('should create proper connection chain', () => {
      const fromVertex = createVertex('from', 5, 5, EcosystemName.STEPPE_ARID);
      const toVertex = createVertex('to', 10, 8, EcosystemName.STEPPE_ARID);

      const result = createGridAlignedPath(
        fromVertex,
        toVertex,
        EcosystemName.STEPPE_ARID,
        100,
        metrics,
        rng
      );

      if (result.intermediateVertices.length > 0) {
        // First connection should be from source to first intermediate
        expect(result.connections[0].from).toBe(fromVertex.id);
        expect(result.connections[0].to).toBe(result.intermediateVertices[0].id);

        // Intermediate connections should chain properly
        for (let i = 1; i < result.intermediateVertices.length; i++) {
          expect(result.connections[i].from).toBe(result.intermediateVertices[i - 1].id);
          expect(result.connections[i].to).toBe(result.intermediateVertices[i].id);
        }

        // Final connection should be from last intermediate to target
        const lastConnection = result.connections[result.connections.length - 1];
        expect(lastConnection.to).toBe(toVertex.id);
        expect(lastConnection.from).toBe(result.intermediateVertices[result.intermediateVertices.length - 1].id);
      }
    });

    it('should use correct vertex IDs based on startVertexId', () => {
      const fromVertex = createVertex('from', 5, 5, EcosystemName.MOUNTAIN_ARID);
      const toVertex = createVertex('to', 8, 8, EcosystemName.MOUNTAIN_ARID);

      const result = createGridAlignedPath(
        fromVertex,
        toVertex,
        EcosystemName.MOUNTAIN_ARID,
        500,
        metrics,
        rng
      );

      result.intermediateVertices.forEach((vertex, index) => {
        expect(vertex.id).toBe(`bridge-${500 + index}`);
        expect(vertex.placeId).toBe(`flux:place:bridge-${500 + index}`);
      });
    });
  });

  describe('World Coordinate Calculation', () => {
    it('should calculate correct world coordinates from grid coordinates', () => {
      const fromVertex = createVertex('from', 5, 5, EcosystemName.JUNGLE_TROPICAL);
      const toVertex = createVertex('to', 8, 8, EcosystemName.JUNGLE_TROPICAL);

      const result = createGridAlignedPath(
        fromVertex,
        toVertex,
        EcosystemName.JUNGLE_TROPICAL,
        1,
        metrics,
        rng
      );

      result.intermediateVertices.forEach(vertex => {
        const expectedX = metrics.placeMargin + vertex.gridX * metrics.placeSpacing;
        const expectedY = metrics.placeMargin + vertex.gridY * metrics.placeSpacing;

        expect(vertex.x).toBe(expectedX);
        expect(vertex.y).toBe(expectedY);
      });
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle negative grid coordinates', () => {
      // This shouldn't happen in normal usage, but test defensive behavior
      const fromVertex: WorldVertex = {
        id: 'from',
        x: 0,
        y: 0,
        gridX: -1,
        gridY: -1,
        ecosystem: EcosystemName.STEPPE_ARID,
        placeId: 'flux:place:from'
      };
      const toVertex = createVertex('to', 2, 2, EcosystemName.STEPPE_ARID);

      const result = createGridAlignedPath(
        fromVertex,
        toVertex,
        EcosystemName.STEPPE_ARID,
        1,
        metrics,
        rng
      );

      // Should still work and maintain 45-degree constraints
      expect(result.connections.length).toBeGreaterThan(0);

      // Verify angles are still valid
      const fullPath = [fromVertex, ...result.intermediateVertices, toVertex];
      for (let i = 0; i < fullPath.length - 1; i++) {
        const angle = calculateGridAngle(fullPath[i], fullPath[i + 1]);
        expect(isValidGridAngle(angle)).toBe(true);
      }
    });

    it('should handle large distances', () => {
      const fromVertex = createVertex('from', 5, 5, EcosystemName.GRASSLAND_TEMPERATE);
      const toVertex = createVertex('to', 25, 20, EcosystemName.GRASSLAND_TEMPERATE);

      const result = createGridAlignedPath(
        fromVertex,
        toVertex,
        EcosystemName.GRASSLAND_TEMPERATE,
        1,
        metrics,
        rng
      );

      // Should handle large paths without issues
      expect(result.intermediateVertices.length).toBeGreaterThan(10);

      // All connections should still maintain 45-degree constraint
      const fullPath = [fromVertex, ...result.intermediateVertices, toVertex];
      for (let i = 0; i < fullPath.length - 1; i++) {
        const angle = calculateGridAngle(fullPath[i], fullPath[i + 1]);
        expect(isValidGridAngle(angle)).toBe(true);
      }
    });

        it('should handle single-step movements in all directions', () => {
      const startX = getSafeCoordinates(EcosystemName.FOREST_TEMPERATE).startX + 2;
      const fromVertex = createVertex('from', startX, 10, EcosystemName.FOREST_TEMPERATE);

      // Test all 8 single-step directions
      const singleSteps = [
        [1, 0], [-1, 0], [0, 1], [0, -1],  // Cardinal
        [1, 1], [1, -1], [-1, 1], [-1, -1] // Diagonal
      ];

      singleSteps.forEach(([dx, dy]) => {
        const toVertex = createVertex('to', startX + dx, 10 + dy, EcosystemName.FOREST_TEMPERATE);

        const result = createGridAlignedPath(
          fromVertex,
          toVertex,
          EcosystemName.FOREST_TEMPERATE,
          1,
          metrics,
          rng
        );

        // Single steps should have no intermediates
        expect(result.intermediateVertices).toHaveLength(0);
        expect(result.connections).toHaveLength(1);
        expect(result.connections[0]).toEqual({
          from: fromVertex.id,
          to: toVertex.id
        });
      });
    });
  });

  describe('Regression Tests', () => {
    it('should not create direct long-distance connections', () => {
      // This is the core bug: function creates direct connections instead of step-by-step paths
      const fromVertex = createVertex('from', 5, 5, EcosystemName.MOUNTAIN_ARID);
      const toVertex = createVertex('to', 15, 12, EcosystemName.MOUNTAIN_ARID);

      const result = createGridAlignedPath(
        fromVertex,
        toVertex,
        EcosystemName.MOUNTAIN_ARID,
        1,
        metrics,
        rng
      );

      // For a path from (5,5) to (15,12), we should have intermediate steps
      // Distance is 10 horizontally, 7 vertically - should NOT be a direct connection
      expect(result.intermediateVertices.length).toBeGreaterThan(0);

      // Verify no connection skips more than 1 grid cell
      const fullPath = [fromVertex, ...result.intermediateVertices, toVertex];
      for (let i = 0; i < fullPath.length - 1; i++) {
        const from = fullPath[i];
        const to = fullPath[i + 1];

        const deltaX = Math.abs(to.gridX - from.gridX);
        const deltaY = Math.abs(to.gridY - from.gridY);

        // Each step should move at most 1 cell in each direction
        expect(deltaX).toBeLessThanOrEqual(1);
        expect(deltaY).toBeLessThanOrEqual(1);

        // And at least one direction should move
        expect(deltaX + deltaY).toBeGreaterThan(0);
      }
    });
  });
});

// Additional helper function tests
describe('Helper Functions', () => {
  let metrics: SpatialMetrics;

  beforeEach(() => {
    metrics = calculateSpatialMetrics({
      worldWidth: 14.5,
      worldHeight: 9.0,
      placeSize: 100,
      placeMargin: 200
    });
  });

  describe('getEcosystemBoundary', () => {
    it('should return correct boundaries for all ecosystems', () => {
      const ecosystems = [
        EcosystemName.STEPPE_ARID,
        EcosystemName.GRASSLAND_TEMPERATE,
        EcosystemName.FOREST_TEMPERATE,
        EcosystemName.MOUNTAIN_ARID,
        EcosystemName.JUNGLE_TROPICAL
      ];

      console.log(`\nGrid dimensions: ${metrics.gridWidth} x ${metrics.gridHeight}`);
      console.log('Ecosystem boundaries:');

      let totalColumns = 0;
      ecosystems.forEach(ecosystem => {
        const boundary = getEcosystemBoundary(ecosystem, metrics);
        const name = ecosystem.split(':')[2];
        console.log(`  ${name}: columns ${boundary.startCol}-${boundary.endCol-1} (${boundary.endCol - boundary.startCol} cols)`);

        expect(boundary.startCol).toBeGreaterThanOrEqual(0);
        expect(boundary.endCol).toBeGreaterThan(boundary.startCol);
        expect(boundary.endCol).toBeLessThanOrEqual(metrics.gridWidth);
        totalColumns += (boundary.endCol - boundary.startCol);
      });

      console.log(`Test position (10,10) is in: ${determineEcosystemFromGridX(10, metrics).split(':')[2]}`);
      console.log(`Test position (11,10) is in: ${determineEcosystemFromGridX(11, metrics).split(':')[2]}`);

      expect(totalColumns).toBe(metrics.gridWidth);
    });

    it('should handle marsh ecosystem correctly', () => {
      const marshBoundary = getEcosystemBoundary(EcosystemName.MARSH_TROPICAL, metrics);
      const jungleBoundary = getEcosystemBoundary(EcosystemName.JUNGLE_TROPICAL, metrics);

      expect(marshBoundary).toEqual(jungleBoundary);
    });
  });

  describe('determineEcosystemFromGridX', () => {
    it('should return correct ecosystem for each grid column', () => {
      for (let gridX = 0; gridX < metrics.gridWidth; gridX++) {
        const ecosystem = determineEcosystemFromGridX(gridX, metrics);
        expect(ecosystem).toBeDefined();

        // Verify the ecosystem boundary contains this gridX
        const boundary = getEcosystemBoundary(ecosystem, metrics);
        expect(gridX).toBeGreaterThanOrEqual(boundary.startCol);
        expect(gridX).toBeLessThan(boundary.endCol);
      }
    });

    it('should handle edge cases for grid boundaries', () => {
      expect(determineEcosystemFromGridX(0, metrics)).toBe(EcosystemName.STEPPE_ARID);
      expect(determineEcosystemFromGridX(metrics.gridWidth - 1, metrics)).toBe(EcosystemName.JUNGLE_TROPICAL);
      expect(determineEcosystemFromGridX(metrics.gridWidth, metrics)).toBe(EcosystemName.JUNGLE_TROPICAL); // Out of bounds fallback
    });
  });

  describe('SeededRandom', () => {
    it('should generate deterministic sequences', () => {
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(42);

      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('should generate different sequences for different seeds', () => {
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(123);

      let differences = 0;
      for (let i = 0; i < 100; i++) {
        if (rng1.next() !== rng2.next()) {
          differences++;
        }
      }

      expect(differences).toBeGreaterThan(90); // Should be different most of the time
    });

    it('should generate numbers in correct ranges', () => {
      const rng = new SeededRandom(42);

      // Test next() range [0, 1)
      for (let i = 0; i < 100; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }

      // Test nextInt() range
      const rng2 = new SeededRandom(42);
      for (let i = 0; i < 100; i++) {
        const value = rng2.nextInt(10);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(10);
        expect(Number.isInteger(value)).toBe(true);
      }

      // Test nextFloat() range
      const rng3 = new SeededRandom(42);
      for (let i = 0; i < 100; i++) {
        const value = rng3.nextFloat(5, 15);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThan(15);
      }
    });
  });
});
