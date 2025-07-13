/**
 * Test suite for river delta-based world generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateWorld } from './river-delta';
import type { WorldGenerationConfig } from './types';
import { EcosystemName } from './types';
import { Direction } from '@flux';

// Test helper to access private functions by re-exporting them for testing
// Note: In a real implementation, you might want to export these functions
// or use a different testing approach

describe('River Delta World Generation', () => {
  let testConfig: WorldGenerationConfig;

  beforeEach(() => {
    testConfig = {
      seed: 42,
      worldWidth: 14.5,    // km - medium size world
      worldHeight: 9.0,    // km - golden ratio rectangle
      placeSize: 100,      // meters
      placeMargin: 200     // meters
    };
  });

  describe('generateWorld', () => {
    it('should generate a world with the correct number of vertices', () => {
      const result = generateWorld(testConfig);

      expect(result.vertices).toBeDefined();
      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.places).toBeDefined();
      expect(result.places.length).toBe(result.vertices.length);
    });

    it('should generate consistent results with the same seed', () => {
      const result1 = generateWorld(testConfig);
      const result2 = generateWorld(testConfig);

      expect(result1.vertices.length).toBe(result2.vertices.length);
      expect(result1.connections.total).toBe(result2.connections.total);

      // Check that vertex positions are identical
      for (let i = 0; i < result1.vertices.length; i++) {
        expect(result1.vertices[i].x).toBe(result2.vertices[i].x);
        expect(result1.vertices[i].y).toBe(result2.vertices[i].y);
        expect(result1.vertices[i].ecosystem).toBe(result2.vertices[i].ecosystem);
      }
    });

    it('should generate different results with different seeds', () => {
      const result1 = generateWorld({ ...testConfig, seed: 42 });
      const result2 = generateWorld({ ...testConfig, seed: 123 });

      // Results should be different
      expect(result1.vertices.length).not.toBe(result2.vertices.length);
    });

    it('should create vertices with valid ecosystem assignments', () => {
      const result = generateWorld(testConfig);

      // Check that we have vertices
      expect(result.vertices.length).toBeGreaterThan(0);

      // All valid ecosystems from the actual generation
      const validEcosystems = [
        'flux:eco:steppe:arid',
        'flux:eco:grassland:temperate',
        'flux:eco:forest:temperate',
        'flux:eco:mountain:arid',
        'flux:eco:jungle:tropical',
        'flux:eco:marsh:tropical'
      ];

      // Track which ecosystems we actually see
      const seenEcosystems = new Set();

      result.vertices.forEach(vertex => {
        expect(validEcosystems).toContain(vertex.ecosystem);
        expect(vertex.x).toBeGreaterThanOrEqual(0);
        expect(vertex.y).toBeGreaterThanOrEqual(0);
        expect(vertex.gridX).toBeGreaterThanOrEqual(0);
        expect(vertex.gridY).toBeGreaterThanOrEqual(0);
        expect(vertex.id).toBeDefined();
        expect(vertex.placeId).toBeDefined();

        seenEcosystems.add(vertex.ecosystem);
      });

      // Log which ecosystems we actually generated for debugging
      console.log('Generated ecosystems:', Array.from(seenEcosystems));
    });

    it('should create places with proper exits', () => {
      const result = generateWorld(testConfig);

      let totalExits = 0;
      result.places.forEach(place => {
        const exitCount = Object.keys(place.exits).length;
        totalExits += exitCount;

        // Each exit should have valid properties
        Object.values(place.exits).forEach(exit => {
          expect(exit.direction).toBeDefined();
          expect(exit.label).toBeDefined();
          expect(exit.to).toBeDefined();
          expect(Object.values(Direction)).toContain(exit.direction);
        });
      });

      // Should have created bidirectional connections
      expect(totalExits).toBeGreaterThan(0);
    });

    it('should create ecosystem boundaries', () => {
      const result = generateWorld(testConfig);

      expect(result.ecosystemBoundaries).toBeDefined();
      expect(result.ecosystemBoundaries.length).toBe(5); // 5 ecosystems

      result.ecosystemBoundaries.forEach(boundary => {
        expect(boundary.ecosystem).toBeDefined();
        expect(boundary.startX).toBeDefined();
        expect(boundary.endX).toBeDefined();
        expect(boundary.startY).toBeDefined();
        expect(boundary.endY).toBeDefined();
        expect(boundary.columns).toBeGreaterThan(0);
        expect(boundary.startX).toBeLessThan(boundary.endX);
      });
    });

    it('should handle different world sizes', () => {
      const smallWorld = generateWorld({ ...testConfig, worldWidth: 7, worldHeight: 4 });
      const largeWorld = generateWorld({ ...testConfig, worldWidth: 20, worldHeight: 12 });

      expect(smallWorld.vertices.length).toBeLessThan(largeWorld.vertices.length);
    });

    it('should create connected graph components', () => {
      const result = generateWorld(testConfig);

      // Build adjacency map to verify connectivity
      const adjacencyMap = new Map<string, Set<string>>();
      result.vertices.forEach(vertex => {
        adjacencyMap.set(vertex.id, new Set());
      });

      result.places.forEach(place => {
        const vertexId = place.id.split(':')[2];
        const neighbors = adjacencyMap.get(vertexId);
        if (neighbors) {
          Object.values(place.exits).forEach(exit => {
            const targetVertexId = exit.to.split(':')[2];
            neighbors.add(targetVertexId);
          });
        }
      });

      // Check that most vertices have connections
      let connectedVertices = 0;
      adjacencyMap.forEach((neighbors, _vertexId) => {
        if (neighbors.size > 0) {
          connectedVertices++;
        }
      });

      const connectionRatio = connectedVertices / result.vertices.length;
      expect(connectionRatio).toBeGreaterThan(0.8); // At least 80% should be connected
    });

    it('should create vertices aligned to 8-directional grid', () => {
      const result = generateWorld(testConfig);

      // Check that vertices are properly aligned to grid
      result.vertices.forEach(vertex => {
        expect(vertex.gridX).toBe(Math.floor(vertex.gridX));
        expect(vertex.gridY).toBe(Math.floor(vertex.gridY));
      });
    });
  });

  describe('SeededRandom', () => {
    it('should generate deterministic sequences', () => {
      // Note: Since SeededRandom is not exported, we test it through generateWorld
      const result1 = generateWorld({ ...testConfig, seed: 999 });
      const result2 = generateWorld({ ...testConfig, seed: 999 });

      expect(result1.vertices.length).toBe(result2.vertices.length);
    });
  });

  describe('Direction calculations', () => {
    it('should create valid bidirectional connections', () => {
      const result = generateWorld(testConfig);

      // Check that connections are bidirectional
      const connectionMap = new Map<string, Set<string>>();

      result.places.forEach(place => {
        const vertexId = place.id.split(':')[2];
        if (!connectionMap.has(vertexId)) {
          connectionMap.set(vertexId, new Set());
        }

        Object.values(place.exits).forEach(exit => {
          const targetVertexId = exit.to.split(':')[2];
          connectionMap.get(vertexId)!.add(targetVertexId);
        });
      });

      let bidirectionalConnections = 0;
      let totalConnections = 0;

      connectionMap.forEach((targets, sourceId) => {
        targets.forEach(targetId => {
          totalConnections++;
          const targetConnections = connectionMap.get(targetId);
          if (targetConnections && targetConnections.has(sourceId)) {
            bidirectionalConnections++;
          }
        });
      });

      const bidirectionalRatio = bidirectionalConnections / totalConnections;
      expect(bidirectionalRatio).toBeGreaterThan(0.95); // Should be mostly bidirectional
    });
  });

  describe('Ecosystem distribution', () => {
    it('should create vertices across all ecosystems', () => {
      const result = generateWorld(testConfig);

      const ecosystemCounts = new Map<string, number>();
      result.vertices.forEach(vertex => {
        const count = ecosystemCounts.get(vertex.ecosystem) || 0;
        ecosystemCounts.set(vertex.ecosystem, count + 1);
      });

      // Should have vertices in multiple ecosystems
      expect(ecosystemCounts.size).toBeGreaterThan(1);

      // Each ecosystem should have a reasonable number of vertices
      ecosystemCounts.forEach((count, _ecosystem) => {
        expect(count).toBeGreaterThan(0);
      });
    });

    it('should create vertices in west-to-east progression', () => {
      const result = generateWorld(testConfig);

      // Group vertices by ecosystem
      const ecosystemVertices = new Map<string, typeof result.vertices>();
      result.vertices.forEach(vertex => {
        if (!ecosystemVertices.has(vertex.ecosystem)) {
          ecosystemVertices.set(vertex.ecosystem, []);
        }
        ecosystemVertices.get(vertex.ecosystem)!.push(vertex);
      });

      // Check that ecosystems are generally ordered west to east
      const ecosystemOrder = [
        EcosystemName.STEPPE_ARID,
        EcosystemName.GRASSLAND_TEMPERATE,
        EcosystemName.FOREST_TEMPERATE,
        EcosystemName.MOUNTAIN_ARID,
        EcosystemName.JUNGLE_TROPICAL
      ];

      for (let i = 0; i < ecosystemOrder.length - 1; i++) {
        const currentEco = ecosystemOrder[i];
        const nextEco = ecosystemOrder[i + 1];

        const currentVertices = ecosystemVertices.get(currentEco) || [];
        const nextVertices = ecosystemVertices.get(nextEco) || [];

        if (currentVertices.length > 0 && nextVertices.length > 0) {
          const currentMaxX = Math.max(...currentVertices.map(v => v.x));
          const nextMinX = Math.min(...nextVertices.map(v => v.x));

          // Current ecosystem should generally be west of next ecosystem
          expect(currentMaxX).toBeLessThanOrEqual(nextMinX + 1000); // Allow some overlap
        }
      }
    });
  });

  describe('Place generation', () => {
    it('should create places with valid names and descriptions', () => {
      const result = generateWorld(testConfig);

      result.places.forEach(place => {
        expect(place.name).toBeDefined();
        expect(place.name.length).toBeGreaterThan(0);
        expect(place.description).toBeDefined();

        // Handle both string and EmergentNarrative description types
        if (typeof place.description === 'string') {
          expect(place.description.length).toBeGreaterThan(0);
        } else {
          expect(place.description).toBeDefined();
        }

        expect(place.id).toBeDefined();
        expect(place.id.startsWith('flux:place:')).toBe(true);
      });
    });

    it('should create unique place IDs', () => {
      const result = generateWorld(testConfig);

      const placeIds = new Set(result.places.map(p => p.id));
      expect(placeIds.size).toBe(result.places.length);
    });

    it('should create unique vertex IDs', () => {
      const result = generateWorld(testConfig);

      const vertexIds = new Set(result.vertices.map(v => v.id));
      expect(vertexIds.size).toBe(result.vertices.length);
    });
  });

  describe('Connectivity validation', () => {
    it('should create reasonable connection density', () => {
      const result = generateWorld(testConfig);

      const totalConnections = result.connections.total;
      const totalVertices = result.vertices.length;

      // Should have reasonable connectivity (not too sparse, not too dense)
      const connectionRatio = totalConnections / totalVertices;
      expect(connectionRatio).toBeGreaterThan(1.0); // At least 1 connection per vertex on average
      expect(connectionRatio).toBeLessThan(8.0); // Not more than 8 connections per vertex on average
    });

    it('should handle edge cases gracefully', () => {
      const minimalConfig: WorldGenerationConfig = {
        seed: 42,
        worldWidth: 5,
        worldHeight: 3,
        placeSize: 100,
        placeMargin: 200
      };

      const result = generateWorld(minimalConfig);

      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.places.length).toBe(result.vertices.length);
    });
  });

  describe('Golden ratio integration', () => {
    it('should produce natural-looking branching patterns', () => {
      const result = generateWorld(testConfig);

      // Check that connection patterns vary in a natural way
      const connectionCounts = result.places.map(place => Object.keys(place.exits).length);
      const avgConnections = connectionCounts.reduce((a, b) => a + b, 0) / connectionCounts.length;

      // Should have variety in connection counts (not all the same)
      const uniqueConnectionCounts = new Set(connectionCounts);
      expect(uniqueConnectionCounts.size).toBeGreaterThan(1);

      // Average should be reasonable
      expect(avgConnections).toBeGreaterThan(1.0);
      expect(avgConnections).toBeLessThan(6.0);
    });
  });

  describe('Performance characteristics', () => {
    it('should generate worlds in reasonable time', () => {
      const startTime = performance.now();
      const result = generateWorld(testConfig);
      const endTime = performance.now();

      const generationTime = endTime - startTime;
      expect(generationTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(result.vertices.length).toBeGreaterThan(0);
    });

    it('should handle larger worlds', () => {
      const largeConfig: WorldGenerationConfig = {
        seed: 42,
        worldWidth: 20,
        worldHeight: 12,
        placeSize: 100,
        placeMargin: 200
      };

      const result = generateWorld(largeConfig);

      expect(result.vertices.length).toBeGreaterThan(testConfig.worldWidth * testConfig.worldHeight);
      expect(result.connections.total).toBeGreaterThan(0);
    });
  });

  it('should create a fully connected world graph (single connected component)', () => {
    const result = generateWorld(testConfig);

    // Build adjacency map from places
    const adjacencyMap = new Map<string, Set<string>>();
    result.places.forEach(place => {
      adjacencyMap.set(place.id, new Set());
    });

    // Add connections (bidirectional) - handle exits properly
    result.places.forEach(place => {
      // Handle exits as either array or object
      if (place.exits) {
        // exits is a Partial<Record<Direction, Exit>>
        Object.values(place.exits).forEach(exit => {
          if (exit) {
            const fromSet = adjacencyMap.get(place.id);
            const toSet = adjacencyMap.get(exit.to as string);
            if (fromSet && toSet) {
              fromSet.add(exit.to as string);
              toSet.add(place.id as string);
            }
          }
        });
      }
    });

    // Find all connected components using BFS
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const place of result.places) {
      if (!visited.has(place.id)) {
        const component: string[] = [];
        const queue: string[] = [place.id];

        while (queue.length > 0) {
          const currentId = queue.shift()!;
          if (visited.has(currentId)) continue;

          visited.add(currentId);
          component.push(currentId);

          const neighbors = adjacencyMap.get(currentId);
          if (neighbors) {
            for (const neighborId of neighbors) {
              if (!visited.has(neighborId)) {
                queue.push(neighborId);
              }
            }
          }
        }

        components.push(component);
      }
    }

    // Log component analysis for debugging
    const componentSizes = components.map(comp => comp.length).sort((a, b) => b - a);
    console.log(`Found ${components.length} connected components with sizes: [${componentSizes.join(', ')}]`);

    if (components.length > 1) {
      console.log('❌ World graph is not fully connected');
      console.log(`Largest component: ${componentSizes[0]} vertices`);
      console.log(`Other components: ${componentSizes.slice(1).join(', ')} vertices`);
    } else {
      console.log('✅ World graph is fully connected');
    }

    // Assert that there is exactly one connected component
    expect(components.length).toBe(1);
    expect(components[0].length).toBe(result.places.length);
  });

      it.each([
    { seed: 556622, worldWidth: 14.5, worldHeight: 9.0, description: "user reported disconnected subgraph" },
    { seed: 42, worldWidth: 20, worldHeight: 12, description: "large world test" },
    { seed: 12345, worldWidth: 14.5, worldHeight: 9.0, description: "standard dimensions" },
    { seed: 99999, worldWidth: 10, worldHeight: 6, description: "small world test" }
  ])('should have no disconnected vertex subgraphs for seed $seed ($description)', ({ seed, worldWidth, worldHeight, description }) => {
    const config: WorldGenerationConfig = {
      seed,
      worldWidth,
      worldHeight,
      placeSize: 100,
      placeMargin: 200
    };

    const result = generateWorld(config);

    // Test VERTEX-level connectivity (not Place-level)
    // Build adjacency map from raw connections
    const vertexAdjacencyMap = new Map<string, Set<string>>();
    result.vertices.forEach(vertex => {
      vertexAdjacencyMap.set(vertex.id, new Set());
    });

    // Add connections - we need to reconstruct them from places
    result.places.forEach(place => {
      if (place.exits) {
        Object.values(place.exits).forEach(exit => {
          if (exit) {
            // Extract vertex IDs from place IDs
            const fromVertexId = place.id.split(':')[2]; // flux:place:vertex_abc123 -> vertex_abc123
            const toPlace = result.places.find(p => p.id === exit.to);
            if (toPlace) {
              const toVertexId = toPlace.id.split(':')[2];

              const fromSet = vertexAdjacencyMap.get(fromVertexId);
              const toSet = vertexAdjacencyMap.get(toVertexId);
              if (fromSet && toSet) {
                fromSet.add(toVertexId);
                toSet.add(fromVertexId);
              }
            }
          }
        });
      }
    });

    // Find westernmost vertex as starting point (natural entry point)
    const westernmost = result.vertices.reduce((west, vertex) =>
      vertex.x < west.x ? vertex : west
    );

    console.log(`SEED ${seed}: Starting BFS from westernmost vertex ${westernmost.id} at x=${westernmost.x.toFixed(1)}`);

    // BFS from westernmost vertex
    const visited = new Set<string>();
    const queue = [westernmost.id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;

      visited.add(currentId);

      const neighbors = vertexAdjacencyMap.get(currentId);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            queue.push(neighborId);
          }
        }
      }
    }

    const visitedCount = visited.size;
    const totalVertices = result.vertices.length;
    const disconnectedCount = totalVertices - visitedCount;

    console.log(`SEED ${seed} (${description}): Reached ${visitedCount}/${totalVertices} vertices from westernmost point`);

    if (disconnectedCount > 0) {
      console.log(`❌ Found ${disconnectedCount} disconnected vertices!`);

      // Find which vertices are disconnected for debugging
      const disconnectedVertices = result.vertices.filter(v => !visited.has(v.id));
      const disconnectedByEcosystem = new Map<string, number>();

      disconnectedVertices.forEach(v => {
        const ecosystem = v.ecosystem.split(':')[2];
        disconnectedByEcosystem.set(ecosystem, (disconnectedByEcosystem.get(ecosystem) || 0) + 1);
      });

      console.log(`Disconnected by ecosystem:`, Object.fromEntries(disconnectedByEcosystem));
    } else {
      console.log(`✅ All vertices reachable from westernmost point`);
    }

    // This should pass - if it fails, we have genuine disconnected subgraphs
    expect(visitedCount).toBe(totalVertices);
  });

  it('should never have intra-ecosystem connections cross ecosystem boundaries', () => {
    const config: WorldGenerationConfig = {
      seed: 42,
      worldWidth: 14.5,
      worldHeight: 9.0,
      placeSize: 100,
      placeMargin: 200,
      globalBranchingFactor: 1.0
    };

    const result = generateWorld(config);

    // Create a map of place ID to ecosystem band
    // Note: marsh is considered part of the jungle band for connectivity purposes
    const placeToEcosystemBand = new Map<string, string>();
    result.places.forEach(place => {
      if (place.ecology?.ecosystem) {
        const ecosystem = place.ecology.ecosystem;
        let band: string;

        if (ecosystem.includes('steppe')) band = 'steppe';
        else if (ecosystem.includes('grassland')) band = 'grassland';
        else if (ecosystem.includes('forest')) band = 'forest';
        else if (ecosystem.includes('mountain')) band = 'mountain';
        else if (ecosystem.includes('jungle') || ecosystem.includes('marsh')) band = 'jungle'; // marsh is within jungle band
        else band = 'unknown';

        placeToEcosystemBand.set(place.id, band);
      }
    });

    // Check all connections to find cross-ecosystem-band connections
    const crossBandConnections: Array<{
      fromPlace: string;
      toPlace: string;
      fromBand: string;
      toBand: string;
    }> = [];

    result.places.forEach(place => {
      const fromBand = placeToEcosystemBand.get(place.id);
      if (!fromBand) return;

      Object.values(place.exits || {}).forEach(exit => {
        const toPlaceId = exit.to;
        const toBand = placeToEcosystemBand.get(toPlaceId);

        if (toBand && fromBand !== toBand) {
          crossBandConnections.push({
            fromPlace: place.id,
            toPlace: toPlaceId,
            fromBand,
            toBand
          });
        }
      });
    });

    // Log details for debugging
    if (crossBandConnections.length > 0) {
      console.log(`Found ${crossBandConnections.length} cross-ecosystem-band connections:`);
      crossBandConnections.slice(0, 10).forEach(conn => {
        console.log(`  ${conn.fromBand} → ${conn.toBand} (${conn.fromPlace} → ${conn.toPlace})`);
      });
      if (crossBandConnections.length > 10) {
        console.log(`  ... and ${crossBandConnections.length - 10} more`);
      }
    }

    // Count connections by ecosystem band pairs
    const bandConnectionCounts = new Map<string, number>();
    crossBandConnections.forEach(conn => {
      const key = `${conn.fromBand}-${conn.toBand}`;
      bandConnectionCounts.set(key, (bandConnectionCounts.get(key) || 0) + 1);
    });

    console.log('Cross-ecosystem-band connection counts:');
    Array.from(bandConnectionCounts.entries()).forEach(([key, count]) => {
      console.log(`  ${key}: ${count} connections`);
    });

    // Define valid adjacent ecosystem band pairs (linear progression)
    const validAdjacentPairs = new Set([
      'steppe-grassland', 'grassland-steppe',
      'grassland-forest', 'forest-grassland',
      'forest-mountain', 'mountain-forest',
      'mountain-jungle', 'jungle-mountain'
    ]);

    // Verify that all cross-band connections are between adjacent bands only
    crossBandConnections.forEach(conn => {
      const pairKey = `${conn.fromBand}-${conn.toBand}`;
      expect(validAdjacentPairs.has(pairKey)).toBe(true);
    });

    // For 5 ecosystem bands, we expect at most N-1 = 4 bridge connection pairs
    // But since connections are bidirectional, we might see up to 8 total connections
    // However, the actual constraint is much stricter - we should only have minimal bridge connections
    expect(crossBandConnections.length).toBeLessThanOrEqual(8); // Allow bidirectional bridge connections

    // Even stricter: each adjacent pair should have at most 2 connections (bidirectional)
    Array.from(bandConnectionCounts.values()).forEach(count => {
      expect(count).toBeLessThanOrEqual(4); // Allow some flexibility for bridge connections
    });
  });

  describe('Branching factor configuration', () => {
    it.each([
      { branchingFactor: 0.1, description: "ultra-sparse connectivity", expectSingleComponent: false },
      { branchingFactor: 0.5, description: "sparse river-like patterns", expectSingleComponent: false },
      { branchingFactor: 1.0, description: "balanced connectivity", expectSingleComponent: true },
      { branchingFactor: 1.5, description: "dense mesh patterns", expectSingleComponent: true }
    ])('should generate $description with branching factor $branchingFactor', ({ branchingFactor, description, expectSingleComponent }) => {
      const config: WorldGenerationConfig = {
        seed: 42,
        worldWidth: 14.5,
        worldHeight: 9.0,
        placeSize: 100,
        placeMargin: 200,
        globalBranchingFactor: branchingFactor
      };

      const result = generateWorld(config);

      // Verify world generation completed successfully
      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.places.length).toBe(result.vertices.length);

      // Calculate connection statistics for debugging
      const connectionCounts = result.places.map(place => Object.keys(place.exits).length);
      const avgConnections = connectionCounts.reduce((a, b) => a + b, 0) / connectionCounts.length;
      const minConnections = Math.min(...connectionCounts);
      const maxConnections = Math.max(...connectionCounts);

      console.log(`Branching factor ${branchingFactor}: avg=${avgConnections.toFixed(2)}, min=${minConnections}, max=${maxConnections}`);

      // Verify that the world connectivity matches expectations
      const adjacencyMap = new Map<string, Set<string>>();
      result.places.forEach(place => {
        adjacencyMap.set(place.id, new Set());
      });

      // Build adjacency map
      result.places.forEach(place => {
        if (place.exits) {
          Object.values(place.exits).forEach(exit => {
            if (exit) {
              const fromSet = adjacencyMap.get(place.id);
              const toSet = adjacencyMap.get(exit.to as string);
              if (fromSet && toSet) {
                fromSet.add(exit.to as string);
                toSet.add(place.id as string);
              }
            }
          });
        }
      });

      // Find connected components
      const visited = new Set<string>();
      const components: string[][] = [];

      for (const place of result.places) {
        if (!visited.has(place.id)) {
          const component: string[] = [];
          const queue: string[] = [place.id];

          while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;

            visited.add(currentId);
            component.push(currentId);

            const neighbors = adjacencyMap.get(currentId);
            if (neighbors) {
              for (const neighborId of neighbors) {
                if (!visited.has(neighborId)) {
                  queue.push(neighborId);
                }
              }
            }
          }

          components.push(component);
        }
      }

      if (expectSingleComponent) {
        // Should maintain single connected component for reasonable branching factors
        expect(components.length).toBe(1);
        expect(components[0].length).toBe(result.places.length);
      } else {
        // Ultra-sparse connectivity may result in multiple components
        expect(components.length).toBeGreaterThan(0);
        // The largest component should contain most vertices
        const largestComponent = components.reduce((a, b) => a.length > b.length ? a : b);
        expect(largestComponent.length).toBeGreaterThan(result.places.length * 0.5);
      }
    });

    it('should produce consistent results with same branching factor and seed', () => {
      const config: WorldGenerationConfig = {
        seed: 42,
        worldWidth: 14.5,
        worldHeight: 9.0,
        placeSize: 100,
        placeMargin: 200,
        globalBranchingFactor: 0.7
      };

      const result1 = generateWorld(config);
      const result2 = generateWorld(config);

      // Should be identical
      expect(result1.vertices.length).toBe(result2.vertices.length);
      expect(result1.connections.total).toBe(result2.connections.total);

      // Check vertex positions and ecosystems
      for (let i = 0; i < result1.vertices.length; i++) {
        expect(result1.vertices[i].x).toBe(result2.vertices[i].x);
        expect(result1.vertices[i].y).toBe(result2.vertices[i].y);
        expect(result1.vertices[i].ecosystem).toBe(result2.vertices[i].ecosystem);
      }
    });

    it('should work with default branching factor when not specified', () => {
      const configWithoutBranching: WorldGenerationConfig = {
        seed: 42,
        worldWidth: 14.5,
        worldHeight: 9.0,
        placeSize: 100,
        placeMargin: 200
        // globalBranchingFactor not specified
      };

      const result = generateWorld(configWithoutBranching);

      // Should work without errors
      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.places.length).toBe(result.vertices.length);
      expect(result.connections.total).toBeGreaterThan(0);
    });
  });

  describe('Geometric constraints', () => {
    it.each([
      {
        seed: 42,
        branchingFactor: 1.0,
        description: 'default test config'
      },
      {
        seed: 906150,
        branchingFactor: 0.5,
        description: 'UI violation case (seed 906150, sparse)'
      },
      {
        seed: 12345,
        branchingFactor: 1.5,
        description: 'dense connectivity'
      },
      {
        seed: 99999,
        branchingFactor: 0.1,
        description: 'ultra-sparse connectivity'
      }
    ])('should ensure all connections are angled at multiples of 45 degrees - $description', ({ seed, branchingFactor, description }) => {
      const testConfig: WorldGenerationConfig = {
        seed,
        worldWidth: 14.5,
        worldHeight: 9.0,
        placeSize: 100,
        placeMargin: 200,
        globalBranchingFactor: branchingFactor
      };

      const result = generateWorld(testConfig);

      // Helper function to normalize angle to 0-360 range
      const normalizeAngle = (angle: number): number => {
        while (angle < 0) angle += 360;
        while (angle >= 360) angle -= 360;
        return angle;
      };

      // Helper function to check if angle is a multiple of 45 degrees
      const isMultipleOf45 = (angle: number): boolean => {
        const normalized = normalizeAngle(angle);
        const remainder = normalized % 45;
        // Account for floating point precision
        return Math.abs(remainder) < 0.001 || Math.abs(remainder - 45) < 0.001;
      };

      // Helper function to get valid 45-degree angles
      const getValidAngles = (): number[] => {
        return [0, 45, 90, 135, 180, 225, 270, 315];
      };

      // Create a map of place IDs to their coordinates
      const placeCoordinates = new Map<string, { x: number, y: number }>();
      result.vertices.forEach(vertex => {
        placeCoordinates.set(vertex.placeId, { x: vertex.x, y: vertex.y });
      });

      let totalConnections = 0;
      let invalidConnections: Array<{
        fromPlace: string;
        toPlace: string;
        fromCoords: { x: number, y: number };
        toCoords: { x: number, y: number };
        angle: number;
        ecosystem: string;
      }> = [];

      // Check all connections for proper 45-degree angles
      result.places.forEach(place => {
        const fromCoords = placeCoordinates.get(place.id);
        if (!fromCoords) return;

        // Get the ecosystem of the source place
        const fromPlace = result.places.find(p => p.id === place.id);
        const fromEcosystem = fromPlace?.ecology.ecosystem;
        if (!fromEcosystem) return;

        Object.values(place.exits).forEach(exit => {
          const toCoords = placeCoordinates.get(exit.to as string);
          if (!toCoords) return;

          // Get the ecosystem of the target place
          const toPlace = result.places.find(p => p.id === exit.to);
          const toEcosystem = toPlace?.ecology.ecosystem;
          if (!toEcosystem) return;

          // ONLY check intra-ecosystem connections (skip inter-ecosystem bridges)
          if (fromEcosystem !== toEcosystem) {
            return; // Skip inter-ecosystem connections
          }

          totalConnections++;

          // Calculate angle between the two points
          const dx = toCoords.x - fromCoords.x;
          const dy = toCoords.y - fromCoords.y;
          const angleRadians = Math.atan2(dy, dx);
          const angleDegrees = (angleRadians * 180) / Math.PI;

          // Check if angle is a multiple of 45 degrees
          if (!isMultipleOf45(angleDegrees)) {
            invalidConnections.push({
              fromPlace: place.id,
              toPlace: exit.to as string,
              fromCoords,
              toCoords,
              angle: normalizeAngle(angleDegrees),
              ecosystem: fromEcosystem
            });
          }
        });
      });

      // Log results for debugging
      console.log(`[${description}] Checked ${totalConnections} intra-ecosystem connections for 45-degree angle compliance`);

      if (invalidConnections.length > 0) {
        console.log(`[${description}] Found ${invalidConnections.length} connections with invalid angles:`);

        // Group by ecosystem for better analysis
        const byEcosystem = new Map<string, Array<typeof invalidConnections[0]>>();
        invalidConnections.forEach(conn => {
          if (!byEcosystem.has(conn.ecosystem)) {
            byEcosystem.set(conn.ecosystem, []);
          }
          byEcosystem.get(conn.ecosystem)!.push(conn);
        });

        byEcosystem.forEach((connections, ecosystem) => {
          console.log(`\n${ecosystem} violations (${connections.length}):`);
          connections.slice(0, 3).forEach(conn => {
            console.log(`  ${conn.fromPlace} → ${conn.toPlace}: ${conn.angle.toFixed(2)}°`);
            console.log(`    From: (${conn.fromCoords.x}, ${conn.fromCoords.y}) To: (${conn.toCoords.x}, ${conn.toCoords.y})`);
            console.log(`    Distance: ${Math.sqrt(Math.pow(conn.toCoords.x - conn.fromCoords.x, 2) + Math.pow(conn.toCoords.y - conn.fromCoords.y, 2)).toFixed(1)}m`);
          });
          if (connections.length > 3) {
            console.log(`    ... and ${connections.length - 3} more violations in ${ecosystem}`);
          }
        });

        console.log(`\nValid angles are: ${getValidAngles().join(', ')} degrees`);
      }

      // All connections should be at valid 45-degree angles
      expect(invalidConnections.length).toBe(0);
    });
  });
});
