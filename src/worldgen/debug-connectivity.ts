/**
 * Debug script to analyze connectivity and spatial positioning issues
 */

import { generateWorld } from './river-delta.js';
import { calculateSpatialMetrics, type WorldGenerationConfig } from './types.js';

// Simple connectivity analysis
function analyzeConnectivity(places: any[], vertices: any[]) {
  console.log('\n=== CONNECTIVITY ANALYSIS ===');
  console.log(`Total places: ${places.length}`);

  // Create mapping from place ID to vertex ecosystem
  const placeToEcosystem = new Map<string, string>();
  vertices.forEach(vertex => {
    placeToEcosystem.set(vertex.placeId, vertex.ecosystem);
  });

  // Count exits per place
  const exitCounts = places.map(place => Object.keys(place.exits).length);
  const totalExits = exitCounts.reduce((sum, count) => sum + count, 0);
  const avgExits = totalExits / places.length;

  console.log(`Total exits: ${totalExits}`);
  console.log(`Average exits per place: ${avgExits.toFixed(2)}`);
  console.log(`Places with 0 exits: ${exitCounts.filter(c => c === 0).length}`);
  console.log(`Places with 1 exit: ${exitCounts.filter(c => c === 1).length}`);
  console.log(`Places with 2+ exits: ${exitCounts.filter(c => c >= 2).length}`);

  // Check for broken exit references
  const placeIds = new Set(places.map(p => p.id));
  let brokenExits = 0;

  places.forEach(place => {
    Object.values(place.exits).forEach((exit: any) => {
      if (!placeIds.has(exit.to)) {
        brokenExits++;
      }
    });
  });

  console.log(`Broken exit references: ${brokenExits}`);

  // Analyze inter-ecosystem connections specifically
  console.log('\n=== INTER-ECOSYSTEM CONNECTIONS ===');
  let interEcosystemExits = 0;
  let intraEcosystemExits = 0;
  const interEcosystemSamples: Array<{from: string, to: string, fromEco: string, toEco: string}> = [];

  places.forEach(place => {
    const fromEco = placeToEcosystem.get(place.id) || 'unknown';
    Object.values(place.exits).forEach((exit: any) => {
      const targetPlace = places.find(p => p.id === exit.to);
      if (targetPlace) {
        const toEco = placeToEcosystem.get(targetPlace.id) || 'unknown';
        if (fromEco === toEco) {
          intraEcosystemExits++;
        } else {
          interEcosystemExits++;
          if (interEcosystemSamples.length < 5) {
            interEcosystemSamples.push({
              from: place.id,
              to: targetPlace.id,
              fromEco: fromEco.split(':')[2] || fromEco,
              toEco: toEco.split(':')[2] || toEco
            });
          }
        }
      }
    });
  });

  console.log(`Intra-ecosystem exits: ${intraEcosystemExits}`);
  console.log(`Inter-ecosystem exits: ${interEcosystemExits}`);
    console.log('Sample inter-ecosystem connections:');
  interEcosystemSamples.forEach(sample => {
    console.log(`  ${sample.fromEco} -> ${sample.toEco}: ${sample.from} -> ${sample.to}`);
  });

  // Detailed connectivity analysis
  const components = getConnectedComponents(places);
  console.log(`\nConnected components: ${components.length}`);
  console.log(`Largest component: ${Math.max(...components.map(c => c.length))} places`);
  console.log(`Component sizes: [${components.map(c => c.length).sort((a, b) => b - a).join(', ')}]`);

  // Analyze connectivity by ecosystem
  console.log('\nConnectivity by ecosystem:');
  const ecosystemStats: Record<string, {total: number, connected: number, avgExits: number}> = {};

  const largestComponent = components.reduce((max, comp) => comp.length > max.length ? comp : max, components[0]);
  const connectedIds = new Set(largestComponent.map(p => p.id));

  places.forEach(place => {
    const ecosystem = placeToEcosystem.get(place.id) || 'unknown';
    if (!ecosystemStats[ecosystem]) {
      ecosystemStats[ecosystem] = {total: 0, connected: 0, avgExits: 0};
    }
    ecosystemStats[ecosystem].total++;
    ecosystemStats[ecosystem].avgExits += Object.keys(place.exits).length;
    if (connectedIds.has(place.id)) {
      ecosystemStats[ecosystem].connected++;
    }
  });

  Object.entries(ecosystemStats).forEach(([ecosystem, stats]) => {
    const connectivityRate = (stats.connected / stats.total * 100).toFixed(1);
    const avgExits = (stats.avgExits / stats.total).toFixed(2);
    console.log(`  ${ecosystem}: ${stats.connected}/${stats.total} (${connectivityRate}%) connected, ${avgExits} avg exits`);
  });
}

// Get connected components using BFS
function getConnectedComponents(places: any[]): any[][] {
  const visited = new Set<string>();
  const components: any[][] = [];

  for (const place of places) {
    if (!visited.has(place.id)) {
      const component: any[] = [];
      const queue = [place];
      visited.add(place.id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);

        // Follow exits
        Object.values(current.exits).forEach((exit: any) => {
          const targetPlace = places.find(p => p.id === exit.to);
          if (targetPlace && !visited.has(targetPlace.id)) {
            visited.add(targetPlace.id);
            queue.push(targetPlace);
          }
        });

        // Also check reverse connections
        places.forEach(otherPlace => {
          if (visited.has(otherPlace.id)) return;
          Object.values(otherPlace.exits).forEach((exit: any) => {
            if (exit.to === current.id) {
              visited.add(otherPlace.id);
              queue.push(otherPlace);
            }
          });
        });
      }

      components.push(component);
    }
  }

  return components;
}

// Analyze spatial positioning
function analyzeSpatialPositioning(vertices: any[], config: WorldGenerationConfig) {
  console.log('\n=== SPATIAL POSITIONING ANALYSIS ===');
  const metrics = calculateSpatialMetrics(config);

  console.log(`World: ${config.worldWidth}km × ${config.worldHeight}km`);
  console.log(`Expected capacity: ${metrics.totalPlacesCapacity} places`);
  console.log(`Actual places: ${vertices.length}`);
  console.log(`Capacity ratio: ${(vertices.length / metrics.totalPlacesCapacity * 100).toFixed(1)}%`);

  // Check position bounds
  const outOfBounds = vertices.filter(v =>
    v.x < 0 || v.x > metrics.worldWidthMeters ||
    v.y < 0 || v.y > metrics.worldHeightMeters
  );
  console.log(`Places outside world bounds: ${outOfBounds.length}`);

  if (outOfBounds.length > 0) {
    console.log('First 5 out-of-bounds places:');
    outOfBounds.slice(0, 5).forEach(v => {
      console.log(`  ${v.id}: (${v.x}, ${v.y}) ecosystem: ${v.ecosystem}`);
    });
  }

  // Check ecosystem distribution
  const ecosystemCounts: Record<string, number> = {};
  vertices.forEach(v => {
    ecosystemCounts[v.ecosystem] = (ecosystemCounts[v.ecosystem] || 0) + 1;
  });

  console.log('\nEcosystem distribution:');
  Object.entries(ecosystemCounts).forEach(([ecosystem, count]) => {
    const percentage = (count / vertices.length * 100).toFixed(1);
    console.log(`  ${ecosystem}: ${count} places (${percentage}%)`);
  });
}

// Main debug function
function debugGeneration() {
  console.log('=== WORLDGEN CONNECTIVITY DEBUG ===');

  const config: WorldGenerationConfig = {
    worldWidth: 5.0,  // Small test world
    worldHeight: 3.0,
    placeSize: 100,
    placeMargin: 200,
    seed: 42
  };

  console.log('\nGenerating world...');
  const result = generateWorld(config);

  analyzeSpatialPositioning(result.vertices, config);
  analyzeConnectivity(result.places, result.vertices);

  console.log('\n=== RAW DATA SAMPLE ===');
  console.log('First 3 vertices:');
  result.vertices.slice(0, 3).forEach(v => {
    console.log(`  ${v.id}: pos(${v.x}, ${v.y}) grid(${v.gridX}, ${v.gridY}) ecosystem: ${v.ecosystem}`);
  });

  console.log('First 3 places with exits:');
  result.places.slice(0, 3).forEach((p: any) => {
    const exitCount = Object.keys(p.exits).length;
    const exitTargets = Object.values(p.exits).map((e: any) => e.to);
    console.log(`  ${p.id}: ${exitCount} exits -> [${exitTargets.join(', ')}]`);
  });

  console.log('\n=== DEBUG COMPLETE ===');
}

// Run debug if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugGeneration();
}

export { debugGeneration };
