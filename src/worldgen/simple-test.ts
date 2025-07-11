/**
 * Simple test to verify world generation works
 */

import { generateWorld } from './integration';

console.log('🌍 Testing World Generation...');

try {
  const world = generateWorld({
    minPlaces: 100,
    maxPlaces: 200,
    worldAspectRatio: 1.618,
    lichtenberg: {
      minVertices: 100,
      maxChainLength: 15
    }
  });

  console.log('✅ World generation successful!');
  console.log(`Generated ${world.places.length} places`);
  console.log(`Connections: ${world.connections.total} total, ${world.connections.reciprocal} reciprocal`);

  // Show ecosystem distribution
  const ecosystemCounts = world.places.reduce((acc, place) => {
    const ecosystem = place.ecology.ecosystem;
    acc[ecosystem] = (acc[ecosystem] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Ecosystem distribution:');
  Object.entries(ecosystemCounts).forEach(([ecosystem, count]) => {
    console.log(`  ${ecosystem}: ${count} places`);
  });

  // Show distribution percentages
  const totalPlaces = world.places.length;
  console.log('\nEcosystem percentages:');
  Object.entries(ecosystemCounts).forEach(([ecosystem, count]) => {
    const percentage = ((count / totalPlaces) * 100).toFixed(1);
    console.log(`  ${ecosystem}: ${percentage}% (${count}/${totalPlaces})`);
  });

  // Show first few places from each ecosystem
  console.log('\nSample places by ecosystem:');
  Object.keys(ecosystemCounts).forEach(ecosystem => {
    const placesInEcosystem = world.places.filter(p => p.ecology.ecosystem === ecosystem);
    if (placesInEcosystem.length > 0) {
      console.log(`  ${ecosystem}: ${placesInEcosystem[0].name}`);
    }
  });

} catch (error) {
  console.log('❌ Error:', error);
}
