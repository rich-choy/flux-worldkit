// Example integration of pluggable fractal generators into world generation
import {
    createFractalGenerator,
    type FractalGenerator,
    type FractalGeneratorType,
    type WorldConstraints,
    type FractalConfig
} from './fractal-generators'
// Simple seeded random function
function createSeededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % (2**32)
    return state / (2**32)
  }
}

export interface WorldGenerationConfig {
  fractal_generator: FractalGeneratorType
  fractal_config: FractalConfig
  world_size: number
  trail_count: number
  random_seed: number
  // ... other config
}

export function generateWorldWithFractalDependency(config: WorldGenerationConfig) {
  // Inject the fractal generator as a dependency
  const fractalGenerator: FractalGenerator = createFractalGenerator(config.fractal_generator)
  const random = createSeededRandom(config.random_seed)

  const worldConstraints: WorldConstraints = {
    worldCenter: [0, 0],
    worldRadius: config.world_size / 2,
    maxDepth: config.fractal_config.max_depth,
    growthLimit: config.world_size * 0.4
  }

  console.log(`Using fractal generator: ${fractalGenerator.name}`)
  console.log(`Description: ${fractalGenerator.description}`)

  // Generate trail systems using the injected fractal generator
  const trailSystems = []
  for (let i = 0; i < config.trail_count; i++) {
    const startPosition: [number, number] = [
      (random() - 0.5) * config.world_size * 0.1,
      (random() - 0.5) * config.world_size * 0.1
    ]
    const startDirection = random() * Math.PI * 2
    const trailSystemId = `trail_system_${i}`

    // THIS IS THE KEY: We inject the fractal equation as a dependency
    const segments = fractalGenerator.generateSegments(
      startPosition,
      startDirection,
      trailSystemId,
      config.fractal_config,
      random,
      worldConstraints
    )

    trailSystems.push({
      id: trailSystemId,
      generator: fractalGenerator.name,
      segments,
      centerPosition: startPosition
    })
  }

  return {
    trailSystems,
    generator: fractalGenerator.name,
    totalSegments: trailSystems.reduce((sum, ts) => sum + ts.segments.length, 0)
  }
}

// Example usage with different fractal generators
export const FRACTAL_PRESETS = {
  // Organic lightning-like patterns
  lichtenberg: {
    fractal_generator: 'lichtenberg' as FractalGeneratorType,
    fractal_config: {
      segment_length: 3.0,
      length_variation: 0.3,
      trail_width: 0.5,
      max_depth: 4,
      // Lichtenberg-specific config
      breakdown_probability: 0.6,
      field_strength_decay: 0.2,
      stochastic_factor: 0.8,
      angular_dispersion: Math.PI / 3,
      preferred_growth_bias: 0.1
    }
  },

  // Mathematical precise patterns
  mandelbrot: {
    fractal_generator: 'mandelbrot' as FractalGeneratorType,
    fractal_config: {
      segment_length: 3.0,
      length_variation: 0.1,
      trail_width: 0.5,
      max_depth: 5,
      // Mandelbrot-specific config
      branching_factor: 2.0,
      branching_angle: Math.PI / 3,
      decay_factor: 0.7
    }
  },

  // River-like patterns
  river_delta: {
    fractal_generator: 'river_delta' as FractalGeneratorType,
    fractal_config: {
      segment_length: 4.0,
      length_variation: 0.4,
      trail_width: 0.8,
      max_depth: 6,
      // River-specific config
      flow_rate_decay: 0.6,
      erosion_threshold: 0.2,
      confluence_probability: 0.3
    }
  },

  // Neural network-like patterns
  neural_network: {
    fractal_generator: 'neural_network' as FractalGeneratorType,
    fractal_config: {
      segment_length: 2.5,
      length_variation: 0.5,
      trail_width: 0.3,
      max_depth: 5,
      // Neural network-specific config would go here
    }
  }
}

// Easy way to switch between fractal types
export function createWorldWithFractalType(
  fractalType: FractalGeneratorType,
  worldSize: number = 100,
  trailCount: number = 3,
  randomSeed: number = 42
) {
  const preset = FRACTAL_PRESETS[fractalType as keyof typeof FRACTAL_PRESETS]

  const config: WorldGenerationConfig = {
    ...preset,
    world_size: worldSize,
    trail_count: trailCount,
    random_seed: randomSeed
  }

  return generateWorldWithFractalDependency(config)
}

// Demo function showing how easy it is to test different fractal types
export function compareGenerators() {
  console.log('\n=== Comparing Fractal Generators ===')

  const generators: FractalGeneratorType[] = ['lichtenberg', 'mandelbrot', 'river_delta']

  generators.forEach(generatorType => {
    const world = createWorldWithFractalType(generatorType, 50, 2, 123)
    console.log(`${generatorType}: ${world.totalSegments} segments generated`)
  })
}
