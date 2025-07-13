import { generateWorld } from './generator';

describe('River Flow Generation', () => {
  it('should generate a continuous eastward-flowing river network', () => {
    const config = {
      worldWidthKm: 14.5,
      worldHeightKm: 9.0,
      seed: 12345
    };

    const world = generateWorld(config);

    // Verify basic structure
    expect(world.vertices.length).toBeGreaterThan(0);
    expect(world.edges.length).toBeGreaterThan(0);
    expect(world.ecosystemBands.length).toBe(5);

    // Verify origin vertex exists
    const originVertex = world.vertices.find(v => v.isOrigin);
    expect(originVertex).toBeDefined();
    expect(originVertex!.gridX).toBe(0);
    expect(originVertex!.ecosystem).toBe('steppe');

    // Verify all vertices have valid ecosystems
    const validEcosystems = ['steppe', 'grassland', 'forest', 'mountain', 'jungle'];
    world.vertices.forEach(vertex => {
      expect(validEcosystems).toContain(vertex.ecosystem);
    });

    // Verify edges have proper 45-degree angles
    world.edges.forEach(edge => {
      expect(Math.abs(edge.angle % 45)).toBe(0); // Use Math.abs to handle -0 vs +0
      expect(edge.distance).toBeGreaterThan(0);
    });

    // Verify eastward flow progression
    const xPositions = world.vertices.map(v => v.gridX).sort((a, b) => a - b);
    expect(xPositions[0]).toBe(0); // Origin at x=0
    expect(xPositions[xPositions.length - 1]).toBeGreaterThan(0); // Flow reaches east

    console.log('✅ River flow generation test passed!');
    console.log(`Generated ${world.vertices.length} vertices, ${world.edges.length} edges`);
    console.log(`Ecosystem distribution:`, world.ditheringStats.ecosystemCounts);
  });

  it('should respect boundary collision handling', () => {
    const config = {
      worldWidthKm: 14.5,
      worldHeightKm: 9.0,
      seed: 12345
    };

    const world = generateWorld(config);

    // Count vertices at boundaries
    const maxY = Math.max(...world.vertices.map(v => v.gridY));
    const topBoundaryVertices = world.vertices.filter(v => v.gridY === 0);
    const bottomBoundaryVertices = world.vertices.filter(v => v.gridY === maxY);

    // Should have some boundary vertices but not excessive wall-hugging
    const totalVertices = world.vertices.length;
    const boundaryVertices = topBoundaryVertices.length + bottomBoundaryVertices.length;
    const boundaryRatio = boundaryVertices / totalVertices;

    expect(boundaryRatio).toBeLessThan(0.3); // Less than 30% at boundaries
    console.log(`✅ Boundary collision handling test passed! (${(boundaryRatio * 100).toFixed(1)}% at boundaries)`);
  });

  it('should generate proper ecosystem bands', () => {
    const config = {
      worldWidthKm: 14.5,
      worldHeightKm: 9.0,
      seed: 12345
    };

    const world = generateWorld(config);

    // Verify ecosystem progression
    const expectedEcosystems = ['steppe', 'grassland', 'forest', 'mountain', 'jungle'];
    expect(world.ecosystemBands.map(b => b.ecosystem)).toEqual(expectedEcosystems);

    // Verify band proportions (each should be ~20% of world width)
    const worldWidth = world.spatialMetrics.worldWidthMeters;
    const expectedBandWidth = worldWidth / 5;

    world.ecosystemBands.forEach(band => {
      expect(Math.abs(band.width - expectedBandWidth)).toBeLessThan(10); // Within 10m tolerance
    });

    console.log('✅ Ecosystem bands test passed!');
  });
});
