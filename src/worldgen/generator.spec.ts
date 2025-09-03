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

    // Verify origin vertex exists and has valid ecosystem (may be dithered)
    const originVertex = world.vertices.find(v => v.isOrigin);
    expect(originVertex).toBeDefined();
    expect(originVertex!.gridX).toBe(0);
    expect(['flux:eco:steppe:arid', 'flux:eco:grassland:temperate']).toContain(originVertex!.ecosystem);

    // Verify all vertices have valid ecosystems (including marsh from eastern post-processing)
    const validEcosystems = [
      'flux:eco:steppe:arid',
      'flux:eco:grassland:temperate',
      'flux:eco:forest:temperate',
      'flux:eco:mountain:arid',
      'flux:eco:jungle:tropical',
      'flux:eco:marsh:tropical'
    ];
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
  });

  it('should apply effective ecosystem dithering and avoid uniform bands', () => {
    const world = generateWorld({ seed: 12345 });

    // Verify that dithering is happening
    const { ditheringStats } = world;
    expect(ditheringStats.ditheredVertices).toBeGreaterThan(0);
    expect(ditheringStats.ditheredVertices).toBeLessThan(ditheringStats.transitionZoneVertices);

    // Verify ecosystem distribution has natural variation
    const ecosystemCounts = ditheringStats.ecosystemCounts;
    expect(ecosystemCounts['flux:eco:steppe:arid']).toBeGreaterThan(0);
    expect(ecosystemCounts['flux:eco:grassland:temperate']).toBeGreaterThan(0);
    expect(ecosystemCounts['flux:eco:forest:temperate']).toBeGreaterThan(0);
    expect(ecosystemCounts['flux:eco:mountain:arid']).toBeGreaterThan(0);
    expect(ecosystemCounts['flux:eco:jungle:tropical']).toBeGreaterThan(0);

    // Verify ecosystems appear in adjacent bands (natural transitions)
    const steppeVertices = world.vertices.filter(v => v.ecosystem === 'flux:eco:steppe:arid');
    const grasslandVertices = world.vertices.filter(v => v.ecosystem === 'flux:eco:grassland:temperate');
    const forestVertices = world.vertices.filter(v => v.ecosystem === 'flux:eco:forest:temperate');
    const mountainVertices = world.vertices.filter(v => v.ecosystem === 'flux:eco:mountain:arid');
    const jungleVertices = world.vertices.filter(v => v.ecosystem === 'flux:eco:jungle:tropical');

    // Check for ecosystem mixing in transition zones
    const steppeInGrasslandZone = steppeVertices.some(v => v.x >= 2900 && v.x < 5800);
    const grasslandInSteppeZone = grasslandVertices.some(v => v.x >= 0 && v.x < 2900);
    const forestInGrasslandZone = forestVertices.some(v => v.x >= 2900 && v.x < 5800);
    const mountainInForestZone = mountainVertices.some(v => v.x >= 5800 && v.x < 8700);
    const jungleInMountainZone = jungleVertices.some(v => v.x >= 8700 && v.x < 11600);

    // At least some ecosystems should mix with their neighbors
    const hasNaturalTransitions = [
      steppeInGrasslandZone,
      grasslandInSteppeZone,
      forestInGrasslandZone,
      mountainInForestZone,
      jungleInMountainZone
    ].filter(Boolean).length >= 3; // At least 3 transition zones should show mixing

    expect(hasNaturalTransitions).toBe(true);

    // Log statistics for debugging
    console.log('✅ Ecosystem dithering test passed!');
    console.log('📊 Ecosystem mixing in transition zones:');
    console.log(`  Steppe in Grassland: ${steppeInGrasslandZone}`);
    console.log(`  Grassland in Steppe: ${grasslandInSteppeZone}`);
    console.log(`  Forest in Grassland: ${forestInGrasslandZone}`);
    console.log(`  Mountain in Forest: ${mountainInForestZone}`);
    console.log(`  Jungle in Mountain: ${jungleInMountainZone}`);
    console.log(`📊 Dithered vertices: ${ditheringStats.ditheredVertices}/${ditheringStats.transitionZoneVertices} (${(ditheringStats.ditheredVertices / ditheringStats.transitionZoneVertices * 100).toFixed(1)}%)`);
  });

  it('should only dither ecosystems into adjacent ecosystems', () => {
    const world = generateWorld({ seed: 54321 });

    // Group vertices by their current ecosystem
    const verticesByEcosystem = world.vertices.reduce((acc, vertex) => {
      if (!acc[vertex.ecosystem]) acc[vertex.ecosystem] = [];
      acc[vertex.ecosystem].push(vertex);
      return acc;
    }, {} as Record<string, typeof world.vertices>);

    // Check that ecosystems don't appear in completely wrong spatial zones
    const bands = world.ecosystemBands;

    // Mountain vertices should only appear in mountain, forest, or jungle bands (not in steppe/grassland)
    const mountainVertices = verticesByEcosystem['flux:eco:mountain:arid'] || [];
    const mountainInWrongZones = mountainVertices.filter(v => {
      // Get the band this vertex is in
      const band = bands.find(b => v.x >= b.startX && v.x < b.endX);
      // Mountain should only appear in its own band or adjacent bands (forest, jungle)
      return band && !['flux:eco:mountain:arid', 'flux:eco:forest:temperate', 'flux:eco:jungle:tropical'].includes(band.ecosystem);
    });

    expect(mountainInWrongZones.length).toBe(0);

    // Steppe vertices should only appear in steppe or grassland bands (not in mountain/jungle)
    const steppeVertices = verticesByEcosystem['flux:eco:steppe:arid'] || [];
    const steppeInWrongZones = steppeVertices.filter(v => {
      const band = bands.find(b => v.x >= b.startX && v.x < b.endX);
      return band && !['flux:eco:steppe:arid', 'flux:eco:grassland:temperate'].includes(band.ecosystem);
    });

    expect(steppeInWrongZones.length).toBe(0);

    // Forest vertices should only appear in forest or adjacent bands (grassland, mountain)
    const forestVertices = verticesByEcosystem['flux:eco:forest:temperate'] || [];
    const forestInWrongZones = forestVertices.filter(v => {
      const band = bands.find(b => v.x >= b.startX && v.x < b.endX);
      return band && !['flux:eco:grassland:temperate', 'flux:eco:forest:temperate', 'flux:eco:mountain:arid'].includes(band.ecosystem);
    });

    expect(forestInWrongZones.length).toBe(0);

    console.log('✅ Ecosystem adjacency test passed!');
    console.log(`📊 Mountain vertices: ${mountainVertices.length} (all in valid zones)`);
    console.log(`📊 Steppe vertices: ${steppeVertices.length} (all in valid zones)`);
    console.log(`📊 Forest vertices: ${forestVertices.length} (all in valid zones)`);
  });



  it('should detect impossible ecosystem transitions', () => {
    // Use seed 786385 to reproduce the exact issue from the visualization
    const world = generateWorld({ seed: 786385 });

    // Check for impossible transitions by examining spatial distribution
    const steppeVertices = world.vertices.filter(v => v.ecosystem === 'flux:eco:steppe:arid');
    const mountainVertices = world.vertices.filter(v => v.ecosystem === 'flux:eco:mountain:arid');

    // Find any mountain vertices that appear in the steppe band (impossible transition)
    const mountainInSteppeBand = mountainVertices.filter(v => v.x < 2900); // Steppe band is 0-2900m

    console.log(`🔍 Debug: Mountain vertices in steppe band: ${mountainInSteppeBand.length}`);
    if (mountainInSteppeBand.length > 0) {
      console.log(`🔍 First mountain vertex in steppe band:`, mountainInSteppeBand[0]);
    }

    // Find any steppe vertices that appear in the mountain band (also impossible)
    const steppeInMountainBand = steppeVertices.filter(v => v.x >= 8700 && v.x < 11600); // Mountain band is 8700-11600m

    console.log(`🔍 Debug: Steppe vertices in mountain band: ${steppeInMountainBand.length}`);
    if (steppeInMountainBand.length > 0) {
      console.log(`🔍 First steppe vertex in mountain band:`, steppeInMountainBand[0]);
    }

    // These should be impossible with proper adjacency constraints
    expect(mountainInSteppeBand.length).toBe(0);
    expect(steppeInMountainBand.length).toBe(0);
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
    const expectedEcosystems = [
      'flux:eco:steppe:arid',
      'flux:eco:grassland:temperate',
      'flux:eco:forest:temperate',
      'flux:eco:mountain:arid',
      'flux:eco:jungle:tropical'
    ];
    expect(world.ecosystemBands.map(b => b.ecosystem)).toEqual(expectedEcosystems);

    // Verify band proportions (each should be ~20% of world width)
    const worldWidth = world.spatialMetrics.worldWidthMeters;
    const expectedBandWidth = worldWidth / 5;

    world.ecosystemBands.forEach(band => {
      expect(Math.abs(band.width - expectedBandWidth)).toBeLessThan(10); // Within 10m tolerance
    });

    console.log('✅ Ecosystem bands test passed!');
  });

  it('should prevent discrete vertical bands and respect spatial constraints', () => {
    // Use seed 11435 which previously showed discrete vertical band issue
    const world = generateWorld({
      seed: 11435,
      worldWidthKm: 14.5,
      worldHeightKm: 9.0,
      branchingFactor: 1.0
    });

    // Check that mountain vertices don't form discrete vertical bands in non-adjacent ecosystems
    const mountainVertices = world.vertices.filter(v => v.ecosystem === 'flux:eco:mountain:arid');

    // Mountain vertices should only appear in or near the mountain band (8700m-11600m)
    // They can dither into adjacent forest (5800m-8700m) or jungle (11600m-14500m) bands
    // But should NOT appear in steppe (0m-2900m) or grassland (2900m-5800m) bands

    const mountainInSteppeBand = mountainVertices.filter(v => v.x < 2900); // Steppe band
    const mountainInGrasslandBand = mountainVertices.filter(v => v.x >= 2900 && v.x < 5800); // Grassland band
    const mountainInForestBand = mountainVertices.filter(v => v.x >= 5800 && v.x < 8700); // Forest band (adjacent - OK)
    const mountainInMountainBand = mountainVertices.filter(v => v.x >= 8700 && v.x < 11600); // Mountain band (original - OK)
    const mountainInJungleBand = mountainVertices.filter(v => v.x >= 11600 && v.x < 14500); // Jungle band (adjacent - OK)

    console.log(`🔍 Mountain vertex distribution across bands:`);
    console.log(`  Steppe band (0-2900m): ${mountainInSteppeBand.length} vertices`);
    console.log(`  Grassland band (2900-5800m): ${mountainInGrasslandBand.length} vertices`);
    console.log(`  Forest band (5800-8700m): ${mountainInForestBand.length} vertices`);
    console.log(`  Mountain band (8700-11600m): ${mountainInMountainBand.length} vertices`);
    console.log(`  Jungle band (11600-14500m): ${mountainInJungleBand.length} vertices`);

    // Mountain vertices should NOT appear in steppe or grassland bands (not adjacent)
    expect(mountainInSteppeBand.length).toBe(0);
    expect(mountainInGrasslandBand.length).toBe(0);

    // Mountain vertices should be concentrated in their original band
    expect(mountainInMountainBand.length).toBeGreaterThan(0);

    // Check that all ecosystems follow similar spatial constraints
    const ecosystems = [
      'flux:eco:steppe:arid',
      'flux:eco:grassland:temperate',
      'flux:eco:forest:temperate',
      'flux:eco:mountain:arid',
      'flux:eco:jungle:tropical'
    ];
    const bandRanges = [
      { start: 0, end: 2900 },      // flux:eco:steppe:arid
      { start: 2900, end: 5800 },   // flux:eco:grassland:temperate
      { start: 5800, end: 8700 },   // flux:eco:forest:temperate
      { start: 8700, end: 11600 },  // flux:eco:mountain:arid
      { start: 11600, end: 14500 }  // flux:eco:jungle:tropical
    ];

    ecosystems.forEach((ecosystem, index) => {
      const vertices = world.vertices.filter(v => v.ecosystem === ecosystem);
      const bandRange = bandRanges[index];

      // Check that vertices don't appear in bands that are more than 1 step away
      const invalidVertices = vertices.filter(v => {
        const adjacentBands = [];
        if (index > 0) adjacentBands.push(bandRanges[index - 1]); // Previous band
        if (index < bandRanges.length - 1) adjacentBands.push(bandRanges[index + 1]); // Next band

        const isInOriginalBand = v.x >= bandRange.start && v.x < bandRange.end;
        const isInAdjacentBand = adjacentBands.some(band => v.x >= band.start && v.x < band.end);

        return !isInOriginalBand && !isInAdjacentBand;
      });

      expect(invalidVertices.length).toBe(0);
      console.log(`✅ ${ecosystem} vertices: ${vertices.length} total, all within valid spatial constraints`);
    });

    console.log('✅ Discrete vertical band prevention test passed!');
  });



  it.each([
    { ditheringStrength: 0.0, description: 'no dithering' },
    { ditheringStrength: 0.25, description: 'light dithering' },
    { ditheringStrength: 0.5, description: 'moderate dithering' },
    { ditheringStrength: 0.75, description: 'heavy dithering' },
    { ditheringStrength: 1.0, description: 'maximum dithering' }
  ])('should respect dithering strength setting: $ditheringStrength ($description)', ({ ditheringStrength, description }) => {
    const world = generateWorld({
      seed: 12345,
      worldWidthKm: 14.5,
      worldHeightKm: 9.0,
      branchingFactor: 1.0,
      ditheringStrength
    });

    const ditheringStats = world.ditheringStats;
    const ditheringRate = ditheringStats.ditheredVertices / ditheringStats.transitionZoneVertices;

    console.log(`🎲 Dithering strength ${ditheringStrength} (${description}):`);
    console.log(`  Dithered vertices: ${ditheringStats.ditheredVertices}/${ditheringStats.transitionZoneVertices} (${(ditheringRate * 100).toFixed(1)}%)`);
    console.log(`  Pure zone vertices: ${ditheringStats.pureZoneVertices}`);
    console.log(`  Transition zone vertices: ${ditheringStats.transitionZoneVertices}`);

    // Verify basic constraints
    expect(ditheringStats.ditheredVertices).toBeGreaterThanOrEqual(0);
    expect(ditheringStats.ditheredVertices).toBeLessThanOrEqual(ditheringStats.transitionZoneVertices);

    // Verify dithering strength affects the results
    if (ditheringStrength === 0.0) {
      expect(ditheringStats.ditheredVertices).toBe(0);
    } else {
      expect(ditheringStats.ditheredVertices).toBeGreaterThan(0);
    }

    // Verify ecosystem adjacency still respected
    const ecosystems = ['flux:eco:steppe:arid', 'flux:eco:grassland:temperate', 'flux:eco:forest:temperate', 'flux:eco:mountain:arid', 'flux:eco:jungle:tropical'];
    const bandRanges = [
      { start: 0, end: 2900 },      // steppe
      { start: 2900, end: 5800 },   // grassland
      { start: 5800, end: 8700 },   // forest
      { start: 8700, end: 11600 },  // mountain
      { start: 11600, end: 14500 }  // jungle
    ];

    ecosystems.forEach((ecosystem, index) => {
      const vertices = world.vertices.filter(v => v.ecosystem === ecosystem);
      const bandRange = bandRanges[index];

      const invalidVertices = vertices.filter(v => {
        const adjacentBands = [];
        if (index > 0) adjacentBands.push(bandRanges[index - 1]);
        if (index < bandRanges.length - 1) adjacentBands.push(bandRanges[index + 1]);

        const isInOriginalBand = v.x >= bandRange.start && v.x < bandRange.end;
        const isInAdjacentBand = adjacentBands.some(band => v.x >= band.start && v.x < band.end);

        return !isInOriginalBand && !isInAdjacentBand;
      });

      expect(invalidVertices.length).toBe(0);
    });
  });

  it('should detect URN/ecosystem data integrity violations', () => {
    // Use the exact parameters from .cursorrules.md that reproduce the issue
    const config = {
      worldWidthKm: 31,
      worldHeightKm: 13,
      branchingFactor: 0.6,
      meanderingFactor: 0.5,
      ditheringStrength: 0.5,
      showZoneBoundaries: false,
      showFlowDirection: false,
      colorScheme: 'default' as const,
      seed: 674288
    };

    const world = generateWorld(config);

    // Helper function to extract biome from ecosystem URN
    function getBiomeFromEcosystemURN(ecosystemURN: string): string {
      return ecosystemURN.split(':')[2];
    }

    // Helper function to extract biome from place URN
    function getBiomeFromPlaceURN(placeURN: string): string {
      return placeURN.split(':')[2];
    }

    // Check for URN/ecosystem mismatches
    const integrityViolations: Array<{
      vertex: any,
      urnBiome: string,
      ecosystemBiome: string,
      placeUrn: string,
      ecosystem: string
    }> = [];

    world.vertices.forEach(vertex => {
      // Skip origin vertex - it has a special URN by design
      if (vertex.isOrigin) {
        return;
      }

      const urnBiome = getBiomeFromPlaceURN(vertex.placeId);
      const ecosystemBiome = getBiomeFromEcosystemURN(vertex.ecosystem);

      if (urnBiome !== ecosystemBiome) {
        integrityViolations.push({
          vertex,
          urnBiome,
          ecosystemBiome,
          placeUrn: vertex.placeId,
          ecosystem: vertex.ecosystem
        });
      }
    });

    // Log detailed information about violations
    console.log(`🔍 URN/Ecosystem Integrity Analysis:`);
    console.log(`  Total vertices: ${world.vertices.length}`);
    console.log(`  Integrity violations: ${integrityViolations.length}`);

    if (integrityViolations.length > 0) {
      console.log(`🚨 DEFECT REPRODUCED! Found ${integrityViolations.length} URN/ecosystem mismatches:`);

      // Show first few violations as examples
      const samplesToShow = Math.min(5, integrityViolations.length);
      for (let i = 0; i < samplesToShow; i++) {
        const violation = integrityViolations[i];
        console.log(`  ${i + 1}. URN: ${violation.placeUrn} (claims "${violation.urnBiome}")`);
        console.log(`     Ecosystem: ${violation.ecosystem} (actually "${violation.ecosystemBiome}")`);
        console.log(`     Coordinates: (${violation.vertex.x}, ${violation.vertex.y})`);
      }

      // Group violations by type
      const violationsByType = integrityViolations.reduce((acc, violation) => {
        const key = `${violation.urnBiome} → ${violation.ecosystemBiome}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(violation);
        return acc;
      }, {} as Record<string, typeof integrityViolations>);

      console.log(`🔍 Violation patterns:`);
      Object.entries(violationsByType).forEach(([pattern, violations]) => {
        console.log(`  ${pattern}: ${violations.length} cases`);
      });

      // Check for the specific jungle→forest mismatch mentioned in .cursorrules.md
      const jungleForestViolations = integrityViolations.filter(v =>
        v.urnBiome === 'jungle' && v.ecosystemBiome === 'forest'
      );

      if (jungleForestViolations.length > 0) {
        console.log(`🎯 Found the specific jungle→forest violations mentioned in the bug report!`);
        console.log(`  Count: ${jungleForestViolations.length}`);
        jungleForestViolations.slice(0, 3).forEach((violation, i) => {
          console.log(`  Example ${i + 1}: ${violation.placeUrn} → ${violation.ecosystem}`);
        });
      }
    }

    // This test SHOULD FAIL initially, proving the defect exists
    // After we implement the fix, this assertion should pass
    expect(integrityViolations.length).toBe(0); // This will fail and reproduce the defect
  });
});
