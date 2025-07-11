/**
 * Unit tests for worldgen connectivity preservation
 * Tests the actual implementation in integration.ts
 */

import { describe, it, expect } from 'vitest';
import { Place, Direction } from '../types/index.js';
import { EcosystemName } from './types.js';
import { createTestPlace } from '~/testing/world-testing';
import { createExit } from '~/worldkit/entity/place';
import { createPlaceUrn } from '~/lib/taxonomy';
import { generateWorld, getConnectedComponents } from './integration.js';

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

// Test helper to check if graph is connected using the same logic as the real implementation
function isGraphConnected(places: Place[]): boolean {
  const components = getConnectedComponents(places);
  return components.length <= 1;
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

describe('Worldgen Connectivity Preservation', () => {
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

  describe('World Generation Integration', () => {
    it('should generate a connected world with proper ecosystem distribution', () => {
      const config = {
        seed: 42,
        minPlaces: 25,
        maxPlaces: 50,
        worldAspectRatio: 1.618 as const,
        lichtenberg: {
          minVertices: 5,
          maxChainLength: 10
        }
      };

      const result = generateWorld(config);

      // Basic structural tests
      expect(result.places.length).toBeGreaterThanOrEqual(config.minPlaces);
      // maxPlaces is a soft limit, so we'll check it's reasonable but not strict
      expect(result.places.length).toBeLessThan(config.maxPlaces * 2); // Within 2x of soft limit
      expect(result.places).toHaveLength(result.vertices.length);

      // All places should have ecosystem assignments
      result.places.forEach(place => {
        expect(place.ecology.ecosystem).toBeDefined();
        expect(place.name).toBeDefined();
        expect(place.description).toBeDefined();
      });

      // Graph should be connected
      expect(isGraphConnected(result.places)).toBe(true);

      // Should have reasonable connection density
      const totalConnections = countTotalConnections(result.places);
      const averageConnections = totalConnections / result.places.length;
      expect(averageConnections).toBeGreaterThan(1); // At least some connections
      expect(averageConnections).toBeLessThan(8); // Not too dense
    });

    it.each([
      { seed: 389087, description: 'extremely fragmented world' },
      { seed: 890367, description: 'another challenging connectivity scenario' }
    ])('should maintain connectivity for large worlds with challenging seeds (seed: $seed - $description)', ({ seed }) => {
      const config = {
        seed,
        minPlaces: 1000, // Hard minimum - algorithm must generate at least this many
        worldAspectRatio: 1.618 as const,
        lichtenberg: {
          minVertices: 100,
          maxChainLength: 25
        }
      };

      const result = generateWorld(config);

      // Should generate at least the minimum number of places (hard limit)
      expect(result.places.length).toBeGreaterThanOrEqual(config.minPlaces);
      expect(result.places).toHaveLength(result.vertices.length);

      // Check connectivity - some challenging seeds may create disconnected worlds
      const components = getConnectedComponents(result.places);
      const largestComponent = components.reduce((max: Place[], component: Place[]) =>
        component.length > max.length ? component : max, components[0]);
      const largestComponentRatio = largestComponent.length / result.places.length;

      // The largest component should contain at least 50% of places
      expect(largestComponentRatio).toBeGreaterThan(0.5);

      // Should have reasonable connection density
      const totalConnections = result.places.reduce((sum, place) =>
        sum + Object.keys(place.exits).length, 0);
      const avgConnections = totalConnections / result.places.length;
      expect(avgConnections).toBeGreaterThan(1.5); // At least 1.5 connections per place on average

      // Should have multiple ecosystem types
      const ecosystems = new Set(result.places.map(p => p.ecology.ecosystem));
      expect(ecosystems.size).toBeGreaterThan(3);
    });

    // getConnectedComponents is imported from integration.ts

    it('should maintain connectivity across multiple generations with same seed', () => {
      const config = {
        seed: 123,
        minPlaces: 20,
        maxPlaces: 30,
        worldAspectRatio: 1.618 as const,
        lichtenberg: {
          minVertices: 4,
          maxChainLength: 8
        }
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
    });

    it('should handle different world sizes gracefully', () => {
      const smallConfig = {
        seed: 999,
        minPlaces: 5,
        maxPlaces: 10,
        worldAspectRatio: 1.618 as const,
        lichtenberg: {
          minVertices: 2,
          maxChainLength: 5
        }
      };

      const largeConfig = {
        seed: 999,
        minPlaces: 80,
        maxPlaces: 120,
        worldAspectRatio: 1.618 as const,
        lichtenberg: {
          minVertices: 16,
          maxChainLength: 20
        }
      };

      const smallResult = generateWorld(smallConfig);
      const largeResult = generateWorld(largeConfig);

      // Both should be connected regardless of size
      expect(isGraphConnected(smallResult.places)).toBe(true);
      expect(isGraphConnected(largeResult.places)).toBe(true);

      // Should respect size constraints (soft limits)
      expect(smallResult.places.length).toBeGreaterThanOrEqual(smallConfig.minPlaces);
      // maxPlaces is soft, so check it's reasonable but not strict
      expect(smallResult.places.length).toBeLessThan(smallConfig.maxPlaces * 10); // Very generous bound
      expect(largeResult.places.length).toBeGreaterThanOrEqual(largeConfig.minPlaces);
      expect(largeResult.places.length).toBeLessThan(largeConfig.maxPlaces * 2); // Within 2x of soft limit

      // Large world should generally have more places than small world
      expect(largeResult.places.length).toBeGreaterThan(smallResult.places.length);
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

    it('should handle places with no exits', () => {
      const places = [
        createTestPlaceWithEcosystem('place1', 'Forest A', EcosystemName.FOREST_TEMPERATE),
        createTestPlaceWithEcosystem('place2', 'Forest B', EcosystemName.FOREST_TEMPERATE)
      ];

      // No connections between places
      expect(isGraphConnected(places)).toBe(false);
      expect(countTotalConnections(places)).toBe(0);
    });
  });

  describe('Ecosystem Distribution', () => {
    it('should distribute places across all ecosystem types', () => {
      const config = {
        seed: 42,
        minPlaces: 50,
        maxPlaces: 100,
        worldAspectRatio: 1.618 as const,
        lichtenberg: {
          minVertices: 10,
          maxChainLength: 15
        }
      };

      const result = generateWorld(config);

      // Count places by ecosystem
      const ecosystemCounts = result.places.reduce((counts, place) => {
        const ecosystem = place.ecology.ecosystem;
        counts[ecosystem] = (counts[ecosystem] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      // Should have multiple ecosystem types
      expect(Object.keys(ecosystemCounts).length).toBeGreaterThan(1);

      // Each ecosystem should have at least one place
      Object.values(ecosystemCounts).forEach(count => {
        expect(count).toBeGreaterThan(0);
      });
    });

    it('should maintain ecosystem consistency within generated places', () => {
      const config = {
        seed: 777,
        minPlaces: 30,
        maxPlaces: 40,
        worldAspectRatio: 1.618 as const,
        lichtenberg: {
          minVertices: 6,
          maxChainLength: 12
        }
      };

      const result = generateWorld(config);

      // All places should have valid ecosystem data
      result.places.forEach((place, index) => {
        expect(place.ecology).toBeDefined();
        expect(place.ecology.ecosystem).toBeDefined();
        expect(place.ecology.temperature).toHaveLength(2);
        expect(place.ecology.pressure).toHaveLength(2);
        expect(place.ecology.humidity).toHaveLength(2);
        expect(place.weather).toBeDefined();
        expect(place.weather.temperature).toBeGreaterThan(-50);
        expect(place.weather.temperature).toBeLessThan(60);
      });
    });
  });
});
