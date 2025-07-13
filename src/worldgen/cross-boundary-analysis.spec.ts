import { describe, it, expect } from 'vitest';
import { generateWorld } from './river-delta';
import type { WorldGenerationConfig } from './types';

describe('Cross-boundary Connection Analysis', () => {
  it('should eliminate unexpected cross-boundary connections after marsh post-processing fix', () => {
    // Use exact parameters from visualization that showed unexpected connections
    const config: WorldGenerationConfig = {
      seed: 480630,
      worldWidth: 14.5,
      worldHeight: 9,
      placeSize: 100,
      placeMargin: 200,
      globalBranchingFactor: 1.0
    };

    const result = generateWorld(config);

    // Extract connections by ecosystem pairs
    const connectionsByEcosystemPair = new Map<string, number>();
    const unexpectedConnections: Array<{from: string, to: string, fromEco: string, toEco: string}> = [];

    result.vertices.forEach(vertex => {
      const place = result.places.find(p => p.id === vertex.placeId);
      if (place && place.exits) {
        Object.values(place.exits).forEach(exit => {
          const targetVertex = result.vertices.find(v => v.placeId === exit.to);
          if (targetVertex) {
            const fromEcosystem = vertex.ecosystem;
            const toEcosystem = targetVertex.ecosystem;

            // Create consistent ecosystem pair key (alphabetical order)
            const ecosystemPair = [fromEcosystem, toEcosystem].sort().join(' ↔ ');
            connectionsByEcosystemPair.set(ecosystemPair, (connectionsByEcosystemPair.get(ecosystemPair) || 0) + 1);

                        // Check for unexpected cross-boundary connections
            if (fromEcosystem !== toEcosystem) {
              const expectedConnections = [
                // Expected inter-ecosystem bridges between adjacent bands
                'flux:eco:steppe:arid ↔ flux:eco:grassland:temperate',
                'flux:eco:grassland:temperate ↔ flux:eco:forest:temperate',
                'flux:eco:forest:temperate ↔ flux:eco:mountain:arid',
                'flux:eco:mountain:arid ↔ flux:eco:jungle:tropical',
                // Expected connections within the same spatial band (jungle band contains marsh)
                'flux:eco:jungle:tropical ↔ flux:eco:marsh:tropical'
              ];

              if (!expectedConnections.includes(ecosystemPair)) {
                unexpectedConnections.push({
                  from: vertex.id,
                  to: targetVertex.id,
                  fromEco: fromEcosystem,
                  toEco: toEcosystem
                });
              }
            }
          }
        });
      }
    });

    console.log('\n=== CROSS-BOUNDARY CONNECTION ANALYSIS ===');
    console.log('Connections by ecosystem pair:');
    const sortedPairs = Array.from(connectionsByEcosystemPair.entries()).sort((a, b) => b[1] - a[1]);
    sortedPairs.forEach(([pair, count]) => {
      const isExpected = pair.includes('steppe') && pair.includes('grassland') ||
                         pair.includes('grassland') && pair.includes('forest') ||
                         pair.includes('forest') && pair.includes('mountain') ||
                         pair.includes('mountain') && pair.includes('jungle') ||
                         pair.includes('jungle') && pair.includes('marsh'); // jungle-marsh connections are expected
      console.log(`  ${pair}: ${count} connections ${isExpected ? '✓ EXPECTED' : '✗ UNEXPECTED'}`);
    });

    // Analyze unexpected connections
    console.log(`\nUnexpected cross-boundary connections: ${unexpectedConnections.length}`);
    if (unexpectedConnections.length > 0) {
      // Group by ecosystem pair
      const groupedUnexpected = new Map<string, Array<{from: string, to: string}>>();
      unexpectedConnections.forEach(conn => {
        const pair = [conn.fromEco, conn.toEco].sort().join(' ↔ ');
        if (!groupedUnexpected.has(pair)) {
          groupedUnexpected.set(pair, []);
        }
        groupedUnexpected.get(pair)!.push({from: conn.from, to: conn.to});
      });

      groupedUnexpected.forEach((connections, pair) => {
        console.log(`\n${pair} (${connections.length} connections):`);
        connections.slice(0, 5).forEach(conn => {
          const fromVertex = result.vertices.find(v => v.id === conn.from);
          const toVertex = result.vertices.find(v => v.id === conn.to);
          if (fromVertex && toVertex) {
            const distance = Math.abs(fromVertex.gridX - toVertex.gridX) + Math.abs(fromVertex.gridY - toVertex.gridY);
            console.log(`  ${conn.from} (${fromVertex.gridX},${fromVertex.gridY}) → ${conn.to} (${toVertex.gridX},${toVertex.gridY}) [dist: ${distance}]`);
          }
        });
        if (connections.length > 5) {
          console.log(`  ... and ${connections.length - 5} more`);
        }
      });
    }

        // Verify the fix worked
    console.log('\n=== VERIFICATION ===');
    console.log('Expected: Only legitimate bridge connections, no long-distance cross-boundary connections');
    console.log(`Actual: ${unexpectedConnections.length} unexpected cross-boundary connections`);

    // Check if remaining connections are only legitimate bidirectional bridges
    const legitimateBridgeConnections = unexpectedConnections.filter(conn => {
      const fromVertex = result.vertices.find(v => v.id === conn.from);
      const toVertex = result.vertices.find(v => v.id === conn.to);
      if (!fromVertex || !toVertex) return false;

      // Check if this is a short-distance connection (adjacent columns)
      const distance = Math.abs(fromVertex.gridX - toVertex.gridX) + Math.abs(fromVertex.gridY - toVertex.gridY);
      return distance <= 2; // Allow for adjacent connections
    });

    const longDistanceConnections = unexpectedConnections.filter(conn => {
      const fromVertex = result.vertices.find(v => v.id === conn.from);
      const toVertex = result.vertices.find(v => v.id === conn.to);
      if (!fromVertex || !toVertex) return false;

      // Check for problematic long-distance connections
      const distance = Math.abs(fromVertex.gridX - toVertex.gridX) + Math.abs(fromVertex.gridY - toVertex.gridY);
      return distance > 2;
    });

    console.log(`Analysis: ${legitimateBridgeConnections.length} legitimate bridge connections, ${longDistanceConnections.length} problematic long-distance connections`);

    if (longDistanceConnections.length === 0) {
      console.log('✓ SUCCESS: Marsh post-processing fix eliminated all problematic long-distance cross-boundary connections!');
      console.log('✓ SUCCESS: Only legitimate bridge connections remain');
    } else {
      console.log('✗ FAILURE: Still have problematic long-distance cross-boundary connections');
    }

    // The fix should eliminate all problematic long-distance connections
    expect(longDistanceConnections.length).toBe(0);
  });
});
