/**
 * Unit tests to reproduce the bug where disconnected ecosystem subgraphs escape cleanup detection
 */

import { describe, it, expect } from 'vitest';
import { generateWorld } from './river-delta.js';
import type { WorldGenerationConfig } from './types.js';

describe('Inter-Ecosystem Connectivity Bug Reproduction', () => {

  it('BUG: Should connect all ecosystems but actually creates 5 disconnected components', () => {
    // This is the exact config from the debug output that shows the bug
    const config: WorldGenerationConfig = {
      worldWidth: 5.0,  // Small test world
      worldHeight: 3.0,
      placeSize: 100,
      placeMargin: 200,
      seed: 42
    };

    const result = generateWorld(config);

    // Check if we have the bug condition: multiple disconnected components
    const componentSizes = findConnectedComponentSizes(result.places);

    console.log(`Found ${componentSizes.length} connected components with sizes: [${componentSizes.join(', ')}]`);

    // The BUG: We expect 1 connected component but get 5 (one per ecosystem)
    // This reproduces the exact issue from the debug output
    expect(componentSizes.length).toBe(5); // This IS the bug - should be 1
    expect(componentSizes).toEqual([23, 21, 20, 20, 17]); // Actual sizes from test output

    // Verify these are ecosystem-sized components (the bug condition)
    for (const size of componentSizes) {
      expect(size).toBeGreaterThanOrEqual(10); // All are "large infrastructure" per cleanup logic
    }
  });

  it('BUG: dropOrphanedSubgraphs incorrectly preserves ecosystem-sized components', () => {
    const config: WorldGenerationConfig = {
      worldWidth: 5.0,
      worldHeight: 3.0,
      placeSize: 100,
      placeMargin: 200,
      seed: 42
    };

    const result = generateWorld(config);
    const componentSizes = findConnectedComponentSizes(result.places);

    // The cleanup logic preserves components ≥10 vertices as "large infrastructure"
    // But ecosystem components (17-23 vertices) qualify, creating the bug
    expect(componentSizes.every(size => size >= 10)).toBe(true);

    // This reveals the flawed logic: each ecosystem is preserved as "infrastructure"
    // when they should be dropped for being disconnected from the main graph
  });

  it('BUG: Inter-ecosystem connections exist but fail to connect graph components', () => {
    const config: WorldGenerationConfig = {
      worldWidth: 5.0,
      worldHeight: 3.0,
      placeSize: 100,
      placeMargin: 200,
      seed: 42
    };

    const result = generateWorld(config);

    // Find any connections between different ecosystems
    const interEcosystemConnections = findInterEcosystemConnections(result.places, result.vertices);

    console.log(`Found ${interEcosystemConnections.length} inter-ecosystem connections`);

    // The BUG: Inter-ecosystem connections ARE created (36 of them!)
    // But they somehow fail to actually connect the graph components
    expect(interEcosystemConnections.length).toBeGreaterThan(0); // Connections exist

    // Yet we still have 5 disconnected components - this is the real bug!
    const componentSizes = findConnectedComponentSizes(result.places);
    expect(componentSizes.length).toBe(5); // Still disconnected despite having connections!

    // This suggests the connections are created but not properly converted to Place exits
    // or there's a mismatch between vertex connections and place connections
  });

  it('BUG: Components escape cleanup despite having no spanning connections', () => {
    const config: WorldGenerationConfig = {
      worldWidth: 5.0,
      worldHeight: 3.0,
      placeSize: 100,
      placeMargin: 200,
      seed: 42
    };

    const result = generateWorld(config);
    const componentSizes = findConnectedComponentSizes(result.places);

    // Each component should span west-to-east to justify preservation, but they don't
    // They're preserved only because they're ≥10 vertices ("large infrastructure")

    expect(componentSizes.length).toBe(5); // Bug: 5 components preserved

    // None of these components actually span the traversal zones they claim to serve
    // This demonstrates the flawed heuristic in dropOrphanedSubgraphs
  });

  it('BUG ANALYSIS: Vertex connections vs Place exits mismatch', () => {
    const config: WorldGenerationConfig = {
      worldWidth: 5.0,
      worldHeight: 3.0,
      placeSize: 100,
      placeMargin: 200,
      seed: 42
    };

    const result = generateWorld(config);

    // Count total vertex-level connections that should exist
    const interEcosystemConnections = findInterEcosystemConnections(result.places, result.vertices);

    // Count actual place-level exits between ecosystems
    const ecosystemToPlaceIds = new Map<string, string[]>();
    result.vertices.forEach(vertex => {
      const ecosystem = vertex.ecosystem;
      if (!ecosystemToPlaceIds.has(ecosystem)) {
        ecosystemToPlaceIds.set(ecosystem, []);
      }
      ecosystemToPlaceIds.get(ecosystem)!.push(vertex.placeId);
    });

    let actualCrossEcosystemExits = 0;
    result.places.forEach(place => {
      const placeEcosystem = result.vertices.find(v => v.placeId === place.id)?.ecosystem;
      Object.values(place.exits || {}).forEach((exit: any) => {
        const targetPlace = result.places.find(p => p.id === exit.to);
        if (targetPlace) {
          const targetEcosystem = result.vertices.find(v => v.placeId === targetPlace.id)?.ecosystem;
          if (placeEcosystem && targetEcosystem && placeEcosystem !== targetEcosystem) {
            actualCrossEcosystemExits++;
          }
        }
      });
    });

    console.log(`Inter-ecosystem connections found: ${interEcosystemConnections.length}`);
    console.log(`Actual cross-ecosystem exits: ${actualCrossEcosystemExits}`);

    // The bug: connections should equal exits, but they don't match
    // This suggests the conversion from connections to exits is broken
  });
});

// Helper function to find connected component sizes using BFS
function findConnectedComponentSizes(places: any[]): number[] {
  const visited = new Set<string>();
  const componentSizes: number[] = [];

  for (const place of places) {
    if (!visited.has(place.id)) {
      const componentSize = bfsComponentSize(place, places, visited);
      if (componentSize > 0) {
        componentSizes.push(componentSize);
      }
    }
  }

  return componentSizes.sort((a, b) => b - a); // Sort descending
}

function bfsComponentSize(startPlace: any, allPlaces: any[], visited: Set<string>): number {
  const queue = [startPlace];
  let size = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;

    visited.add(current.id);
    size++;

    // Follow exits to connected places
    Object.values(current.exits || {}).forEach((exit: any) => {
      const targetPlace = allPlaces.find(p => p.id === exit.to);
      if (targetPlace && !visited.has(targetPlace.id)) {
        queue.push(targetPlace);
      }
    });
  }

  return size;
}

// Helper to find inter-ecosystem connections
function findInterEcosystemConnections(places: any[], vertices: any[]): Array<{from: string, to: string, fromEco: string, toEco: string}> {
  const placeToEcosystem = new Map<string, string>();
  vertices.forEach(vertex => {
    placeToEcosystem.set(vertex.placeId, vertex.ecosystem);
  });

  const interConnections: Array<{from: string, to: string, fromEco: string, toEco: string}> = [];

  places.forEach(place => {
    const fromEco = placeToEcosystem.get(place.id) || 'unknown';
    Object.values(place.exits || {}).forEach((exit: any) => {
      const targetPlace = places.find(p => p.id === exit.to);
      if (targetPlace) {
        const toEco = placeToEcosystem.get(targetPlace.id) || 'unknown';
        if (fromEco !== toEco) {
          interConnections.push({
            from: place.id,
            to: targetPlace.id,
            fromEco: fromEco.split(':')[2] || fromEco,
            toEco: toEco.split(':')[2] || toEco
          });
        }
      }
    });
  });

  return interConnections;
}
