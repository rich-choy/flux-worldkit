// Web Worker for intensive fractal generation
// This runs off the main thread to prevent ANR

import {
  createFractalGenerator,
  generatePlacesFromSegments,
  type FractalGeneratorType,
  type FractalConfig,
  type WorldConstraints,
  type FractalSegment
} from './fractal-generators';

// Message types for worker communication
interface WorkerRequest {
  type: 'GENERATE_FRACTAL';
  payload: {
    fractalType: FractalGeneratorType;
    startPosition: [number, number];
    startDirection: number;
    trailSystemId: string;
    config: FractalConfig;
    constraints: WorldConstraints;
    placeDensity: number;
    randomSeed: number;
  };
}

interface WorkerResponse {
  type: 'FRACTAL_COMPLETE' | 'FRACTAL_ERROR' | 'FRACTAL_PROGRESS';
  payload: any;
}

// Graph layout configuration
interface LayoutConfig {
  worldRadius: number;
  repulsionStrength: number;
  attractionStrength: number;
  dampingFactor: number;
  iterations: number;
  convergenceThreshold: number;
  boundaryForce: number;
}

// Simple seeded random function for consistent results
function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % (2**32);
    return state / (2**32);
  };
}

// Force-directed layout algorithm for uniform spatial distribution
function applyForceDirectedLayout(
  segments: FractalSegment[],
  config: LayoutConfig,
  onProgress?: (progress: number) => void
): FractalSegment[] {
  console.log(`[Worker] Applying force-directed layout to ${segments.length} segments`);

  // Create vertex map for quick lookups
  const vertexMap = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  const connections = new Map<string, string[]>();

  // Initialize vertices with current positions and zero velocity
  segments.forEach(segment => {
    vertexMap.set(segment.id, {
      x: segment.position[0],
      y: segment.position[1],
      vx: 0,
      vy: 0
    });

    // Build connection graph
    if (segment.parentId) {
      if (!connections.has(segment.parentId)) {
        connections.set(segment.parentId, []);
      }
      if (!connections.has(segment.id)) {
        connections.set(segment.id, []);
      }
      connections.get(segment.parentId)!.push(segment.id);
      connections.get(segment.id)!.push(segment.parentId);
    }
  });

  const vertices = Array.from(vertexMap.keys());
  const numVertices = vertices.length;

  // Simulation parameters
  let temperature = Math.sqrt(config.worldRadius);
  const coolingRate = 1 - (1 / config.iterations);

  // Main simulation loop
  for (let iteration = 0; iteration < config.iterations; iteration++) {
    // Reset forces
    vertices.forEach(vertexId => {
      const vertex = vertexMap.get(vertexId)!;
      vertex.vx = 0;
      vertex.vy = 0;
    });

    // Calculate repulsive forces between all vertex pairs
    for (let i = 0; i < numVertices; i++) {
      for (let j = i + 1; j < numVertices; j++) {
        const v1 = vertexMap.get(vertices[i])!;
        const v2 = vertexMap.get(vertices[j])!;

        const dx = v1.x - v2.x;
        const dy = v1.y - v2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          // Repulsive force (inversely proportional to distance)
          const repulsiveForce = config.repulsionStrength / (distance * distance);
          const fx = (dx / distance) * repulsiveForce;
          const fy = (dy / distance) * repulsiveForce;

          v1.vx += fx;
          v1.vy += fy;
          v2.vx -= fx;
          v2.vy -= fy;
        }
      }
    }

    // Calculate attractive forces between connected vertices
    connections.forEach((neighbors, vertexId) => {
      const vertex = vertexMap.get(vertexId)!;

      neighbors.forEach(neighborId => {
        const neighbor = vertexMap.get(neighborId);
        if (!neighbor) return;

        const dx = neighbor.x - vertex.x;
        const dy = neighbor.y - vertex.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          // Attractive force (proportional to distance)
          const attractiveForce = config.attractionStrength * distance;
          const fx = (dx / distance) * attractiveForce;
          const fy = (dy / distance) * attractiveForce;

          vertex.vx += fx;
          vertex.vy += fy;
        }
      });
    });

    // Apply boundary forces to keep vertices within world radius
    vertices.forEach(vertexId => {
      const vertex = vertexMap.get(vertexId)!;
      const distanceFromCenter = Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y);

      if (distanceFromCenter > config.worldRadius * 0.9) {
        // Push vertex back toward center
        const boundaryForce = config.boundaryForce * (distanceFromCenter - config.worldRadius * 0.9);
        vertex.vx -= (vertex.x / distanceFromCenter) * boundaryForce;
        vertex.vy -= (vertex.y / distanceFromCenter) * boundaryForce;
      }
    });

    // Update positions with damping and temperature
    let maxDisplacement = 0;
    vertices.forEach(vertexId => {
      const vertex = vertexMap.get(vertexId)!;

      // Apply damping
      vertex.vx *= config.dampingFactor;
      vertex.vy *= config.dampingFactor;

      // Limit displacement by current temperature
      const displacement = Math.sqrt(vertex.vx * vertex.vx + vertex.vy * vertex.vy);
      maxDisplacement = Math.max(maxDisplacement, displacement);

      if (displacement > temperature) {
        vertex.vx = (vertex.vx / displacement) * temperature;
        vertex.vy = (vertex.vy / displacement) * temperature;
      }

      // Update position
      vertex.x += vertex.vx;
      vertex.y += vertex.vy;

      // Ensure vertex stays within world boundary
      const distanceFromCenter = Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y);
      if (distanceFromCenter > config.worldRadius) {
        vertex.x = (vertex.x / distanceFromCenter) * config.worldRadius;
        vertex.y = (vertex.y / distanceFromCenter) * config.worldRadius;
      }
    });

    // Cool the system
    temperature *= coolingRate;

    // Report progress
    if (onProgress && iteration % 50 === 0) {
      onProgress(0.7 + (iteration / config.iterations) * 0.2);
    }

    // Check for convergence
    if (maxDisplacement < config.convergenceThreshold) {
      console.log(`[Worker] Layout converged after ${iteration} iterations`);
      break;
    }
  }

  // Update segment positions with layout results
  return segments.map(segment => ({
    ...segment,
    position: [
      vertexMap.get(segment.id)!.x,
      vertexMap.get(segment.id)!.y
    ] as [number, number]
  }));
}

// Handle messages from main thread
self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { type, payload } = event.data;

  try {
    if (type === 'GENERATE_FRACTAL') {
      const {
        fractalType,
        startPosition,
        startDirection,
        trailSystemId,
        config,
        constraints,
        placeDensity,
        randomSeed
      } = payload;

      // Create seeded random function
      const random = createSeededRandom(randomSeed);

      // Create fractal generator
      const generator = createFractalGenerator(fractalType);

      console.log(`[Worker] Generating ${fractalType} fractal with ${config.max_depth} max depth`);

      // Generate segments (this is the CPU-intensive part)
      let segments = generator.generateSegments(
        startPosition,
        startDirection,
        trailSystemId,
        config,
        random,
        constraints
      );

      // Send progress update
      self.postMessage({
        type: 'FRACTAL_PROGRESS',
        payload: { progress: 0.6, message: `Generated ${segments.length} segments` }
      } as WorkerResponse);

      // Apply force-directed layout for uniform distribution (only for intensive fractals)
      if (fractalType === 'extensive_lichtenberg' && segments.length > 50) {
        console.log(`[Worker] Applying spatial optimization for ${segments.length} segments`);

        const layoutConfig: LayoutConfig = {
          worldRadius: constraints.worldRadius,
          repulsionStrength: Math.max(500, segments.length * 0.5), // Scale with segment count
          attractionStrength: 0.1,
          dampingFactor: 0.85,
          iterations: Math.min(300, segments.length * 2), // Adaptive iteration count
          convergenceThreshold: 0.1,
          boundaryForce: 2.0
        };

        segments = applyForceDirectedLayout(segments, layoutConfig, (progress) => {
          self.postMessage({
            type: 'FRACTAL_PROGRESS',
            payload: { progress, message: 'Optimizing spatial distribution...' }
          } as WorkerResponse);
        });

        console.log(`[Worker] Spatial optimization complete`);
      }

      // Send progress update
      self.postMessage({
        type: 'FRACTAL_PROGRESS',
        payload: { progress: 0.9, message: `Generating ${segments.length} places` }
      } as WorkerResponse);

      // Generate places from segments
      const places = generatePlacesFromSegments(segments, placeDensity, random);

      // Send completion
      self.postMessage({
        type: 'FRACTAL_COMPLETE',
        payload: {
          segments,
          places,
          stats: {
            segmentCount: segments.length,
            placeCount: places.length,
            maxDepth: Math.max(...segments.map(s => s.depth)),
            layoutApplied: fractalType === 'extensive_lichtenberg' && segments.length > 50
          }
        }
      } as WorkerResponse);

    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    // Send error response
    self.postMessage({
      type: 'FRACTAL_ERROR',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' }
    } as WorkerResponse);
  }
});

// Export empty object to make this a module
export {};
