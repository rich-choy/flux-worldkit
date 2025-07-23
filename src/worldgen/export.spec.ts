import { exportWorldToJSONL } from './export';
import { generateWorld } from './generator';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('World Export', () => {
  it('should detect duplicate places in world fixture', () => {
    // Load the problematic world fixture
    const fixturePath = join(__dirname, '../../worlds/448b45a6286652b3870659d3ccb1fef911866f187d623f85c8431e5ac38cf3dc.jsonl');
    const fixtureContent = readFileSync(fixturePath, 'utf-8');
    const lines = fixtureContent.trim().split('\n');

    // Parse the places (skip first line which is metadata)
    const places = lines.slice(1).map(line => JSON.parse(line));

    // Find duplicates by grouping places by their ID
    const placesByUrn = new Map<string, any[]>();
    places.forEach(place => {
      if (!placesByUrn.has(place.id)) {
        placesByUrn.set(place.id, []);
      }
      placesByUrn.get(place.id)!.push(place);
    });

    // Find URNs with more than one place
    const duplicates = Array.from(placesByUrn.entries())
      .filter(([_, places]) => places.length > 1);

    // Log the duplicates for analysis
    duplicates.forEach(([urn, places]) => {
      console.log(`Found duplicate URN: ${urn}`);
      places.forEach((place, i) => {
        console.log(`  Place ${i + 1}:`);
        console.log(`    Coordinates: [${place.coordinates.join(', ')}]`);
        console.log(`    Exits: ${Object.keys(place.exits).join(', ')}`);
      });
    });

    // We expect to find the known duplicate
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0][0]).toBe('flux:place:mountain:21200:200');
  });

  it('should prevent duplicate places during export', () => {
    // Get the world generation config from the fixture
    const fixturePath = join(__dirname, '../../worlds/448b45a6286652b3870659d3ccb1fef911866f187d623f85c8431e5ac38cf3dc.jsonl');
    const fixtureContent = readFileSync(fixturePath, 'utf-8');
    const lines = fixtureContent.trim().split('\n');

    // Parse the front matter to get the config
    const frontMatter = JSON.parse(lines[0]);
    const world = generateWorld(frontMatter.config);

    // Now modify the world to introduce a duplicate vertex
    const duplicateVertex = world.vertices.find(v =>
      v.x === 21200 && v.y === 200 && v.ecosystem === 'flux:eco:mountain:arid'
    );

    console.log('Looking for vertex at [21200, 200]');
    if (!duplicateVertex) {
      console.log('Vertex not found! Available vertices at x=21200:');
      world.vertices
        .filter(v => v.x === 21200)
        .forEach(v => console.log(`  y=${v.y}, ecosystem=${v.ecosystem}`));
    } else {
      console.log('Found vertex:', duplicateVertex);
    }

    // Add a duplicate of this vertex with proper connections
    const duplicateId = 'duplicate_' + duplicateVertex!.id;

    // Add the duplicate vertex
    world.vertices.push({
      ...duplicateVertex!,  // This will copy all properties including placeId
      id: duplicateId,
      connections: [...duplicateVertex!.connections]
    });

    // Update the connected vertex to point back to our duplicate
    const connectedVertex = world.vertices.find(v => v.id === duplicateVertex!.connections[0]);
    if (connectedVertex) {
      connectedVertex.connections.push(duplicateId);
    }

    // Add corresponding edges
    duplicateVertex!.connections.forEach(targetId => {
      world.edges.push({
        id: `${duplicateId}->${targetId}`,
        fromVertexId: duplicateId,
        toVertexId: targetId,
        flowDirection: 'eastward',  // Direction doesn't matter for the test
        distance: 300,              // Standard place spacing
        angle: 0
      });
    });

    // TODO: The exportWorldToJSONL function needs to be updated to validate for duplicate places
    // It should check that no two vertices would generate the same place URN:
    // - For regular places: same ecosystem + coordinates = duplicate
    // - For origin: multiple vertices with isOrigin = true
    // The validation should happen after mapping vertices to places but before generating JSONL
    expect(() => exportWorldToJSONL(world)).toThrow(/Duplicate places found/);
  });
});
