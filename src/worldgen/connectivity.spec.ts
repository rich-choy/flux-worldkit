/**
 * Unit tests for spatial worldgen connectivity validation
 * Tests the spatial implementation in river-delta.ts
 */

import { describe, it, expect } from 'vitest';
import { EcosystemName, type WorldGenerationConfig, calculateSpatialMetrics } from './types.js';
import { generateWorld } from './river-delta.js';
import type { Place } from '@flux';
import { Direction, createExit } from '@flux';

// Simple test utilities
function createTestPlace(overrides: any = {}): Place {
  return {
    id: 'flux:place:test:default',
    name: 'Test Place',
    description: 'A test location',
    exits: {},
    entities: {},
    ecology: {
      ecosystem: 'flux:eco:grassland:temperate',
      temperature: [10, 25],
      pressure: [1005, 1020],
      humidity: [45, 70]
    },
    weather: {
      temperature: 20,
      pressure: 1013,
      humidity: 60,
      precipitation: 0,
      ppfd: 800,
      clouds: 30,
      ts: Date.now(),
      timescale: 1
    },
    ...overrides
  };
}

function createPlaceUrn(namespace: string, id: string): string {
  return `flux:place:${namespace}:${id}`;
}

// Test helper to create a test place with proper ecosystem data
function createTestPlaceWithEcosystem(id: string, name: string, ecosystem: EcosystemName): Place {
  return createTestPlace({
    id: createPlaceUrn('test', id),
    name,
    description: `A ${ecosystem} location`,
    ecology: {
      ecosystem: `flux:eco:${ecosystem}` as any,
      temperature: [10, 30],
      pressure: [1000, 1020],
      humidity: [40, 60]
    },
    weather: {
      temperature: 20,
      pressure: 1013,
      humidity: 50,
      precipitation: 0,
      ppfd: 1000,
      clouds: 20,
      ts: Date.now()
    },
    resources: {
      ts: Date.now(),
      nodes: {}
    }
  });
}

// Test helper to create bidirectional connection using proper exit creation
function connectPlaces(place1: Place, place2: Place, direction1: Direction, direction2: Direction): void {
  const exit1 = createExit({
    direction: direction1,
    label: `Path to ${place2.name}`,
    to: place2.id
  });

  const exit2 = createExit({
    direction: direction2,
    label: `Path to ${place1.name}`,
    to: place1.id
  });

  place1.exits[direction1] = exit1;
  place2.exits[direction2] = exit2;
}

// Test helper to check if graph is connected using BFS
function isGraphConnected(places: Place[]): boolean {
  const components = getConnectedComponents(places);
  return components.length <= 1;
}

// Test helper to get connected components
function getConnectedComponents(places: Place[]): Place[][] {
  const visited = new Set<string>();
  const components: Place[][] = [];

  for (const place of places) {
    if (!visited.has(place.id)) {
      const component: Place[] = [];
      const stack = [place];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current.id)) continue;

        visited.add(current.id);
        component.push(current);

        // Find all connected places
        for (const exit of Object.values(current.exits)) {
          const targetPlace = places.find(p => p.id === exit.to);
          if (targetPlace && !visited.has(targetPlace.id)) {
            stack.push(targetPlace);
          }
        }

        // Also check for reverse connections
        for (const otherPlace of places) {
          if (visited.has(otherPlace.id)) continue;
          for (const exit of Object.values(otherPlace.exits)) {
            if (exit.to === current.id) {
              stack.push(otherPlace);
              break;
            }
          }
        }
      }

      components.push(component);
    }
  }

  return components;
}

// Test helper to count total connections
function countTotalConnections(places: Place[]): number {
  return places.reduce((total, place) => total + Object.keys(place.exits).length, 0);
}

// Test helper to count connections for a specific place
function countPlaceConnections(place: Place): number {
  return Object.keys(place.exits).length;
}

// Test helper to check if two places are connected
function areConnected(place1: Place, place2: Place): boolean {
  return Object.values(place1.exits).some(exit => exit.to === place2.id) ||
         Object.values(place2.exits).some(exit => exit.to === place1.id);
}

// Test helper to calculate average connections per ecosystem
function calculateEcosystemConnectivity(places: Place[], vertices?: any[]): Record<string, { count: number; avgConnections: number }> {
  const ecosystemStats: Record<string, { totalConnections: number; placeCount: number }> = {};

  // Create mapping from place ID to ecosystem if vertices are provided
  let placeToEcosystem: Map<string, string> | undefined;
  if (vertices) {
    placeToEcosystem = new Map();
    vertices.forEach(vertex => {
      placeToEcosystem!.set(vertex.placeId, vertex.ecosystem);
    });
  }

  for (const place of places) {
    // Get ecosystem from place ecology (test places) or vertex mapping (real places)
    const ecosystem = (place as any).ecology?.ecosystem ||
                      (placeToEcosystem?.get(place.id)) ||
                      'unknown';

    if (!ecosystemStats[ecosystem]) {
      ecosystemStats[ecosystem] = { totalConnections: 0, placeCount: 0 };
    }
    ecosystemStats[ecosystem].totalConnections += countPlaceConnections(place);
    ecosystemStats[ecosystem].placeCount++;
  }

  const result: Record<string, { count: number; avgConnections: number }> = {};
  for (const [ecosystem, stats] of Object.entries(ecosystemStats)) {
    result[ecosystem] = {
      count: stats.placeCount,
      avgConnections: stats.totalConnections / stats.placeCount
    };
  }

  return result;
}

describe('Spatial Worldgen Connectivity Validation', () => {
  describe('Graph Connectivity Detection', () => {
    it('should detect connected simple chain', () => {
      const places = [
        createTestPlaceWithEcosystem('place1', 'Forest A', EcosystemName.FOREST_TEMPERATE),
        createTestPlaceWithEcosystem('place2', 'Forest B', EcosystemName.FOREST_TEMPERATE),
        createTestPlaceWithEcosystem('place3', 'Forest C', EcosystemName.FOREST_TEMPERATE)
      ];

      // A -> B -> C
      connectPlaces(places[0], places[1], Direction.EAST, Direction.WEST);
      connectPlaces(places[1], places[2], Direction.EAST, Direction.WEST);

      expect(isGraphConnected(places)).toBe(true);
    });

    it('should detect disconnected graph', () => {
      const places = [
        createTestPlaceWithEcosystem('place1', 'Forest A', EcosystemName.FOREST_TEMPERATE),
        createTestPlaceWithEcosystem('place2', 'Forest B', EcosystemName.FOREST_TEMPERATE),
        createTestPlaceWithEcosystem('place3', 'Forest C', EcosystemName.FOREST_TEMPERATE),
        createTestPlaceWithEcosystem('place4', 'Forest D', EcosystemName.FOREST_TEMPERATE)
      ];

      // A -> B  (isolated from C -> D)
      connectPlaces(places[0], places[1], Direction.EAST, Direction.WEST);
      connectPlaces(places[2], places[3], Direction.EAST, Direction.WEST);

      expect(isGraphConnected(places)).toBe(false);
    });

    it('should handle single node as connected', () => {
      const places = [createTestPlaceWithEcosystem('place1', 'Forest A', EcosystemName.FOREST_TEMPERATE)];
      expect(isGraphConnected(places)).toBe(true);
    });

    it('should handle empty graph', () => {
      expect(isGraphConnected([])).toBe(true);
    });
  });

  describe('Spatial World Generation', () => {
    it('should generate a connected world with proper spatial positioning', () => {
      const config: WorldGenerationConfig = {
        worldWidth: 5.0,  // 5km x 3km small world
        worldHeight: 3.0,
        placeSize: 100,
        placeMargin: 200,
        seed: 42
      };

      const result = generateWorld(config);
      const metrics = calculateSpatialMetrics(config);

      console.log(`Generated ${result.places.length} places in ${config.worldWidth}km × ${config.worldHeight}km world`);
      console.log(`Expected capacity: ${metrics.totalPlacesCapacity} places`);

      // Basic structural tests
      expect(result.places.length).toBeGreaterThan(0);
      expect(result.places).toHaveLength(result.vertices.length);

      // All places should have basic properties
      result.places.forEach(place => {
        expect(place.name).toBeDefined();
        expect(place.description).toBeDefined();
        expect(place.id).toBeDefined();
      });

      // Graph should be connected
      expect(isGraphConnected(result.places as any)).toBe(true);

      // Should have reasonable connection density
      const totalConnections = countTotalConnections(result.places);
      const averageConnections = totalConnections / result.places.length;
      expect(averageConnections).toBeGreaterThan(1); // At least some connections
      expect(averageConnections).toBeLessThan(8); // Not too dense

      // Should have spatial positioning
      result.vertices.forEach(vertex => {
        expect(vertex.x).toBeGreaterThanOrEqual(0);
        expect(vertex.y).toBeGreaterThanOrEqual(0);
        expect(vertex.x).toBeLessThanOrEqual(config.worldWidth * 1000);
        expect(vertex.y).toBeLessThanOrEqual(config.worldHeight * 1000);
        expect(vertex.gridX).toBeGreaterThanOrEqual(0);
        expect(vertex.gridY).toBeGreaterThanOrEqual(0);
      });
    });

    it('should meet target connectivity levels per ecosystem', () => {
      const config: WorldGenerationConfig = {
        worldWidth: 14.5,  // Default size from cursorrules.md
        worldHeight: 9.0,
        placeSize: 100,
        placeMargin: 200,
        seed: 123
      };

      const result = generateWorld(config);
      const ecosystemStats = calculateEcosystemConnectivity(result.places, result.vertices);

      console.log('Ecosystem connectivity stats:', ecosystemStats);

      // Target connectivity levels from cursorrules.md
      const targetConnectivity = {
        'flux:eco:steppe:arid': 4.0,
        'flux:eco:grassland:temperate': 3.2,
        'flux:eco:forest:temperate': 2.8,
        'flux:eco:jungle:tropical': 2.4,
        'flux:eco:mountain:arid': 1.6,
        'flux:eco:marsh:tropical': 2.0
      };

      // Check that we have some representation of each ecosystem
      const ecosystemsPresent = Object.keys(ecosystemStats);
      expect(ecosystemsPresent.length).toBeGreaterThan(3);

      // Check connectivity levels (allow some tolerance for randomness)
      for (const [ecosystem, stats] of Object.entries(ecosystemStats)) {
        const target = targetConnectivity[ecosystem as keyof typeof targetConnectivity];
        if (target) {
          console.log(`${ecosystem}: ${stats.avgConnections.toFixed(2)} connections (target: ${target})`);
          // Allow 30% tolerance for randomness and small world effects
          expect(stats.avgConnections).toBeGreaterThan(target * 0.7);
          expect(stats.avgConnections).toBeLessThan(target * 1.5);
        }
      }

      // Overall graph should be connected
      expect(isGraphConnected(result.places)).toBe(true);
    });

    it('should handle different spatial world sizes', () => {
      const smallConfig: WorldGenerationConfig = {
        worldWidth: 3.0,
        worldHeight: 2.0,
        placeSize: 100,
        placeMargin: 200,
        seed: 999
      };

      const largeConfig: WorldGenerationConfig = {
        worldWidth: 20.0,
        worldHeight: 12.0,
        placeSize: 100,
        placeMargin: 200,
        seed: 999
      };

      const smallResult = generateWorld(smallConfig);
      const largeResult = generateWorld(largeConfig);

      console.log(`Small world: ${smallResult.places.length} places`);
      console.log(`Large world: ${largeResult.places.length} places`);

      // Both should be connected regardless of size
      expect(isGraphConnected(smallResult.places)).toBe(true);
      expect(isGraphConnected(largeResult.places)).toBe(true);

      // Large world should have more places than small world
      expect(largeResult.places.length).toBeGreaterThan(smallResult.places.length);

      // Should have reasonable spatial constraints
      const smallMetrics = calculateSpatialMetrics(smallConfig);
      const largeMetrics = calculateSpatialMetrics(largeConfig);

      // Places should be positioned within world bounds
      smallResult.vertices.forEach(vertex => {
        expect(vertex.x).toBeLessThanOrEqual(smallMetrics.worldWidthMeters);
        expect(vertex.y).toBeLessThanOrEqual(smallMetrics.worldHeightMeters);
      });

      largeResult.vertices.forEach(vertex => {
        expect(vertex.x).toBeLessThanOrEqual(largeMetrics.worldWidthMeters);
        expect(vertex.y).toBeLessThanOrEqual(largeMetrics.worldHeightMeters);
      });
    });

    it('should maintain deterministic generation with same seed', () => {
      const config: WorldGenerationConfig = {
        worldWidth: 8.0,
        worldHeight: 5.0,
        placeSize: 100,
        placeMargin: 200,
        seed: 456
      };

      // Generate the same world twice
      const result1 = generateWorld(config);
      const result2 = generateWorld(config);

      // Should produce identical results
      expect(result1.places.length).toBe(result2.places.length);
      expect(isGraphConnected(result1.places)).toBe(true);
      expect(isGraphConnected(result2.places)).toBe(true);

      // Connection counts should be identical (deterministic)
      expect(countTotalConnections(result1.places)).toBe(countTotalConnections(result2.places));

      // Vertices should be positioned identically
      expect(result1.vertices.length).toBe(result2.vertices.length);
      for (let i = 0; i < result1.vertices.length; i++) {
        expect(result1.vertices[i].x).toBe(result2.vertices[i].x);
        expect(result1.vertices[i].y).toBe(result2.vertices[i].y);
        expect(result1.vertices[i].ecosystem).toBe(result2.vertices[i].ecosystem);
      }
    });
  });

  describe('Connection Management', () => {
    it('should preserve bidirectional connections', () => {
      const places = [
        createTestPlaceWithEcosystem('place1', 'Forest A', EcosystemName.FOREST_TEMPERATE),
        createTestPlaceWithEcosystem('place2', 'Forest B', EcosystemName.FOREST_TEMPERATE),
        createTestPlaceWithEcosystem('place3', 'Forest C', EcosystemName.FOREST_TEMPERATE)
      ];

      // Create triangle with bidirectional connections using non-conflicting directions
      connectPlaces(places[0], places[1], Direction.EAST, Direction.WEST);
      connectPlaces(places[1], places[2], Direction.NORTH, Direction.SOUTH);
      connectPlaces(places[2], places[0], Direction.SOUTHWEST, Direction.NORTHEAST);

      // Verify bidirectional connections exist
      expect(areConnected(places[0], places[1])).toBe(true);
      expect(areConnected(places[1], places[2])).toBe(true);
      expect(areConnected(places[2], places[0])).toBe(true);

      // Each place should have exactly 2 connections
      expect(countPlaceConnections(places[0])).toBe(2);
      expect(countPlaceConnections(places[1])).toBe(2);
      expect(countPlaceConnections(places[2])).toBe(2);
    });

    it('should handle unidirectional connections', () => {
      const places = [
        createTestPlaceWithEcosystem('place1', 'Forest A', EcosystemName.FOREST_TEMPERATE),
        createTestPlaceWithEcosystem('place2', 'Forest B', EcosystemName.FOREST_TEMPERATE)
      ];

      // Create unidirectional connection using proper exit creation
      const exit = createExit({
        direction: Direction.EAST,
        label: `Path to ${places[1].name}`,
        to: places[1].id
      });
      places[0].exits[Direction.EAST] = exit;

      expect(countPlaceConnections(places[0])).toBe(1);
      expect(countPlaceConnections(places[1])).toBe(0);
      expect(isGraphConnected(places)).toBe(true); // Still connected via BFS
    });

    it('should properly structure exit objects', () => {
      const places = [
        createTestPlaceWithEcosystem('place1', 'Forest A', EcosystemName.FOREST_TEMPERATE),
        createTestPlaceWithEcosystem('place2', 'Forest B', EcosystemName.FOREST_TEMPERATE)
      ];

      connectPlaces(places[0], places[1], Direction.NORTH, Direction.SOUTH);

      // Check that exits are properly structured
      const northExit = places[0].exits[Direction.NORTH];
      const southExit = places[1].exits[Direction.SOUTH];

      expect(northExit).toBeDefined();
      expect(northExit!.direction).toBe(Direction.NORTH);
      expect(northExit!.to).toBe(places[1].id);
      expect(northExit!.label).toBeDefined();

      expect(southExit).toBeDefined();
      expect(southExit!.direction).toBe(Direction.SOUTH);
      expect(southExit!.to).toBe(places[0].id);
      expect(southExit!.label).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single place gracefully', () => {
      const places = [createTestPlaceWithEcosystem('place1', 'Forest A', EcosystemName.FOREST_TEMPERATE)];

      expect(isGraphConnected(places)).toBe(true);
      expect(countTotalConnections(places)).toBe(0);
    });

    it('should handle empty place list', () => {
      const places: Place[] = [];

      expect(isGraphConnected(places)).toBe(true);
      expect(countTotalConnections(places)).toBe(0);
    });

    it('should handle minimal spatial world', () => {
      const config: WorldGenerationConfig = {
        worldWidth: 1.0,   // 1km x 1km minimal world
        worldHeight: 1.0,
        placeSize: 100,
        placeMargin: 200,
        seed: 789
      };

      const result = generateWorld(config);
      const metrics = calculateSpatialMetrics(config);

      console.log(`Minimal world: ${result.places.length} places (capacity: ${metrics.totalPlacesCapacity})`);

      expect(result.places.length).toBeGreaterThan(0);
      expect(isGraphConnected(result.places)).toBe(true);
    });
  });
});
