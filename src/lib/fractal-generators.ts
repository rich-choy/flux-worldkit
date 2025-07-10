/**
 * Fractal generator types and basic implementation
 * This is a minimal implementation to support the world-generation-integration.ts
 */

export type FractalGeneratorType = 'lichtenberg' | 'mandelbrot' | 'river_delta' | 'neural_network';

export interface FractalConfig {
  segment_length: number;
  length_variation: number;
  trail_width: number;
  max_depth: number;
  // Additional config properties can be added here
  [key: string]: any;
}

export interface WorldConstraints {
  worldCenter: [number, number];
  worldRadius: number;
  maxDepth: number;
  growthLimit: number;
}

export interface FractalSegment {
  id: string;
  position: [number, number];
  parentId?: string;
  depth: number;
  angle: number;
  length: number;
}

export interface FractalGenerator {
  name: string;
  description: string;
  generateSegments(
    startPosition: [number, number],
    startDirection: number,
    trailSystemId: string,
    config: FractalConfig,
    random: () => number,
    constraints: WorldConstraints
  ): FractalSegment[];
}

// Basic Lichtenberg fractal generator
const lichtenbergGenerator: FractalGenerator = {
  name: 'Lichtenberg Fractal',
  description: 'Generates electrical discharge patterns',
  generateSegments(
    startPosition: [number, number],
    startDirection: number,
    trailSystemId: string,
    config: FractalConfig,
    random: () => number,
    _constraints: WorldConstraints
  ): FractalSegment[] {
    // Simple implementation - in practice this would use the real Lichtenberg algorithm
    const segments: FractalSegment[] = [];

    // Generate main segment
    segments.push({
      id: `${trailSystemId}_segment_0`,
      position: startPosition,
      depth: 0,
      angle: startDirection,
      length: config.segment_length
    });

    // Generate a few branch segments
    for (let i = 1; i < 5 && i < config.max_depth; i++) {
      const parent = segments[Math.floor(random() * segments.length)];
      const branchAngle = parent.angle + (random() - 0.5) * Math.PI / 2;
      const branchLength = config.segment_length * (1 - i * 0.2);

      segments.push({
        id: `${trailSystemId}_segment_${i}`,
        position: [
          parent.position[0] + Math.cos(branchAngle) * branchLength,
          parent.position[1] + Math.sin(branchAngle) * branchLength
        ],
        parentId: parent.id,
        depth: i,
        angle: branchAngle,
        length: branchLength
      });
    }

    return segments;
  }
};

// Registry of available generators
const generators: Record<FractalGeneratorType, FractalGenerator> = {
  lichtenberg: lichtenbergGenerator,
  mandelbrot: {
    name: 'Mandelbrot Fractal',
    description: 'Mathematical fractal patterns',
    generateSegments: lichtenbergGenerator.generateSegments // Simple fallback
  },
  river_delta: {
    name: 'River Delta',
    description: 'River-like branching patterns',
    generateSegments: lichtenbergGenerator.generateSegments // Simple fallback
  },
  neural_network: {
    name: 'Neural Network',
    description: 'Neural network-like patterns',
    generateSegments: lichtenbergGenerator.generateSegments // Simple fallback
  }
};

/**
 * Create a fractal generator of the specified type
 */
export function createFractalGenerator(type: FractalGeneratorType): FractalGenerator {
  return generators[type];
}
