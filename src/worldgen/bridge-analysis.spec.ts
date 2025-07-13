import { describe, it, expect } from 'vitest';
import { generateWorld } from './river-delta';
import { EcosystemName } from './types';
import type { WorldGenerationConfig } from './types';

describe('Bridge Analysis', () => {
  it('should distinguish between inter-ecosystem and intra-ecosystem bridges', () => {
    const config: WorldGenerationConfig = {
      seed: 480630,
      worldWidth: 14.5,
      worldHeight: 9,
      placeSize: 100,
      placeMargin: 200,
      globalBranchingFactor: 1.0
    };

    const result = generateWorld(config);

    // Analyze bridge vertices
    const bridgeVertices = result.vertices.filter(v => v.id.startsWith('bridge-'));
    const interEcosystemBridges: Array<{vertex: any, connections: string[]}> = [];
    const intraEcosystemBridges: Array<{vertex: any, connections: string[]}> = [];

    bridgeVertices.forEach(vertex => {
      const place = result.places.find(p => p.id === vertex.placeId);
      if (place && place.exits) {
        const connections = Object.values(place.exits).map(exit => exit.to);

        // Check if this bridge connects different ecosystem bands
        let connectsDifferentBands = false;
        const vertexBand = getEcosystemBand(vertex.ecosystem);

        for (const exitTo of connections) {
          const targetVertex = result.vertices.find(v => v.placeId === exitTo);
          if (targetVertex) {
            const targetBand = getEcosystemBand(targetVertex.ecosystem);
            if (targetBand !== vertexBand) {
              connectsDifferentBands = true;
              break;
            }
          }
        }

        if (connectsDifferentBands) {
          interEcosystemBridges.push({vertex, connections});
        } else {
          intraEcosystemBridges.push({vertex, connections});
        }
      }
    });

    console.log('\n=== BRIDGE ANALYSIS ===');
    console.log(`Total bridge vertices: ${bridgeVertices.length}`);
    console.log(`Inter-ecosystem bridges: ${interEcosystemBridges.length}`);
    console.log(`Intra-ecosystem bridges: ${intraEcosystemBridges.length}`);

    // Log inter-ecosystem bridges
    if (interEcosystemBridges.length > 0) {
      console.log('\nInter-ecosystem bridges:');
      interEcosystemBridges.forEach((bridge, i) => {
        console.log(`  ${i+1}. ${bridge.vertex.id} (${bridge.vertex.ecosystem}) - ${bridge.connections.length} connections`);
      });
    }

    // Log intra-ecosystem bridges
    if (intraEcosystemBridges.length > 0) {
      console.log('\nIntra-ecosystem bridges:');
      intraEcosystemBridges.forEach((bridge, i) => {
        console.log(`  ${i+1}. ${bridge.vertex.id} (${bridge.vertex.ecosystem}) - ${bridge.connections.length} connections`);
      });
    }

    // Also check for regular vertices that act as bridges
    const regularBridgeVertices = result.vertices.filter(v =>
      !v.id.startsWith('bridge-') &&
      result.places.find(p => p.id === v.placeId)
    ).filter(vertex => {
      const place = result.places.find(p => p.id === vertex.placeId);
      if (!place || !place.exits) return false;

      const vertexBand = getEcosystemBand(vertex.ecosystem);

      for (const exit of Object.values(place.exits)) {
        const targetVertex = result.vertices.find(v => v.placeId === exit.to);
        if (targetVertex) {
          const targetBand = getEcosystemBand(targetVertex.ecosystem);
          if (targetBand !== vertexBand) {
            return true;
          }
        }
      }
      return false;
    });

    console.log(`\nRegular vertices acting as bridges: ${regularBridgeVertices.length}`);
    regularBridgeVertices.forEach((vertex, i) => {
      console.log(`  ${i+1}. ${vertex.id} (${vertex.ecosystem}) at (${vertex.gridX},${vertex.gridY})`);
    });

    // Verify we have exactly 4 inter-ecosystem bridges (N-1 for 5 bands)
    expect(interEcosystemBridges.length + regularBridgeVertices.length).toBe(8); // 4 bridges × 2 vertices each
  });
});

// Helper function to get ecosystem band (same as in Canvas.tsx)
function getEcosystemBand(ecosystem: string): string {
  switch (ecosystem) {
    case EcosystemName.STEPPE_ARID:
      return 'steppe';
    case EcosystemName.GRASSLAND_TEMPERATE:
      return 'grassland';
    case EcosystemName.FOREST_TEMPERATE:
      return 'forest';
    case EcosystemName.MOUNTAIN_ARID:
      return 'mountain';
    case EcosystemName.JUNGLE_TROPICAL:
    case EcosystemName.MARSH_TROPICAL:
      return 'jungle'; // marsh is within jungle band
    default:
      return 'unknown';
  }
}
