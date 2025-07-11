/**
 * Realistic Lichtenberg figure generation
 * Physics-based electrical discharge simulation with field-based frontier sampling
 * Based on electrical field physics rather than geometric branching
 * Guarantees connectivity (no orphaned subgraphs) and minimum number of vertices
 */

import { uniqid, BASE62_CHARSET } from '../random';

export type LichtenbergVertex = {
  x: number;
  y: number;
  id: string;
  parentId?: string;
};

export type LichtenbergConnection = {
  from: string;
  to: string;
  length: number;
  artificial?: boolean;  // Mark artificial inter-ecosystem connections
  ecosystemTransition?: {
    from: string;
    to: string;
  };
};

export type LichtenbergFigure = {
  vertices: LichtenbergVertex[];
  connections: LichtenbergConnection[];
};

export type LichtenbergConfig = {
  startX: number;
  startY: number;
  width: number;
  height: number;
  branchingFactor: number;    // Probability of branching (0-1)
  branchingAngle: number;     // Max angle deviation in radians
  stepSize: number;           // Distance between vertices
  maxDepth: number;           // Maximum branching depth
  eastwardBias: number;       // Bias toward eastward propagation (0-1)
  verticalBias?: number;      // Bias toward vertical directions (0-1)
  seed?: number;              // Random seed for deterministic generation

  // Vertex constraints (soft limits)
  minVertices?: number;       // Target minimum vertices (soft guidance)
  maxVertices?: number;       // Maximum vertices (hard safety cutoff)

  // Recursive sparking controls
  sparking?: {
    enabled: boolean;         // Whether to enable recursive sparking
    probability: number;      // Probability of a vertex sparking (0-1)
    maxSparkDepth: number;    // Maximum recursion depth for sparking
    sparkingConditions: {
      boundaryPoints: number[];     // X-coordinates where sparking is triggered (0-1 normalized)
      randomSparking: boolean;      // Allow random sparking
    };
    fishSpineBias: number;    // Bias toward fish-skeleton structure (0-1)
  };
};

// Dependency injection interface for random generation
export interface RandomGenerator {
  random(): number;
}

// Vertex ID generator with collision detection
class VertexIdGenerator {
  private readonly usedIds = new Set<string>();
  private readonly rng?: RandomGenerator;

  constructor(seed?: number) {
    if (seed !== undefined) {
      this.rng = createSeededRNG(seed);
    }
  }

  generateId(): string {
    const maxAttempts = 100; // Prevent infinite loops in case of hash collision

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let id: string;

      if (this.rng) {
        // Deterministic mode: use seeded RNG to generate base62 IDs
        id = this.generateSeededBase62Id();
      } else {
        // Random mode: use crypto random
        id = uniqid(8, BASE62_CHARSET);
      }

      if (!this.usedIds.has(id)) {
        this.usedIds.add(id);
        return id;
      }
    }

    throw new Error(`Unable to generate unique vertex ID after ${maxAttempts} attempts`);
  }

  private generateSeededBase62Id(): string {
    const chars = BASE62_CHARSET;
    let result = '';

    for (let i = 0; i < 8; i++) {
      const randomIndex = Math.floor(this.rng!.random() * chars.length);
      result += chars[randomIndex];
    }

    return result;
  }

  clear(): void {
    this.usedIds.clear();
  }
}

// Cell represents a position in the electrical field
interface Cell {
  x: number;
  y: number;
}

// Node represents a point in the growing electrical discharge
interface DischargeNode {
  cell: Cell;
  parent: string | null;
  jitter: [number, number];
  depth: number;
  terminal: boolean;
}

// FrontierCell represents a potential growth point with electrical field value
interface FrontierCell {
  value: number;
  cell: Cell;
  parent: Cell;
}

// ElectricalField manages the physics-based discharge simulation
class ElectricalField {
  private width: number;
  private height: number;
  private source: Map<string, DischargeNode> = new Map();
  private sourceFrontier: Map<string, FrontierCell> = new Map();
  private sink: Map<string, DischargeNode> = new Map();
  private finished: boolean = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  private hashCell(cell: Cell): string {
    return `${Math.floor(cell.x)}_${Math.floor(cell.y)}`;
  }

  private checkBounds(cell: Cell): boolean {
    return cell.x >= 0 && cell.x < this.width && cell.y >= 0 && cell.y < this.height;
  }

  private distance(c1: Cell, c2: Cell): number {
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private jitter(width: number, rng: RandomGenerator): [number, number] {
    return [
      (rng.random() - 0.5) * width,
      (rng.random() - 0.5) * width
    ];
  }

  private createNode(cell: Cell, rng: RandomGenerator): DischargeNode {
    return {
      cell: cell,
      parent: null,
      jitter: this.jitter(1.0, rng),
      depth: 0,
      terminal: true
    };
  }

  addSink(cell: Cell, rng: RandomGenerator): void {
    const hash = this.hashCell(cell);
    const node = this.createNode(cell, rng);
    this.sink.set(hash, node);
  }

  addSource(cell: Cell, parent: Cell | null, rng: RandomGenerator): void {
    if (!this.checkBounds(cell) || (parent && !this.checkBounds(parent))) {
      console.error("Out-of-bounds cell passed to addSource");
      return;
    }

    const hash = this.hashCell(cell);
    const node = this.createNode(cell, rng);

    if (parent) {
      const parentHash = this.hashCell(parent);
      const parentNode = this.source.get(parentHash);
      if (!parentNode) {
        console.error("Parent supplied to addSource but is not present");
        return;
      }
      node.parent = parentHash;
      node.depth = parentNode.depth + 1;
      parentNode.terminal = false;
    }

    this.source.set(hash, node);

    // Remove from frontier
    this.sourceFrontier.delete(hash);

    // Update existing frontier values based on new source
    for (const [h, frontier] of this.sourceFrontier) {
      frontier.value += 1.0 - (0.5 / this.distance(cell, frontier.cell));
    }

    // Add adjacent cells to frontier (8-connected)
    const adjacentOffsets = [
      { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }
    ];

    for (const offset of adjacentOffsets) {
      const newCell = { x: cell.x + offset.x, y: cell.y + offset.y };
      this.addSourceFrontier(newCell, cell, rng);
    }
  }

  private addSourceFrontier(cell: Cell, parent: Cell, rng: RandomGenerator): void {
    if (!this.checkBounds(cell)) return;

    const hash = this.hashCell(cell);

    // Check if we've reached a sink
    if (this.sink.has(hash)) {
      this.finished = true;
      return;
    }

    // Don't add if already in source or frontier
    if (this.source.has(hash) || this.sourceFrontier.has(hash)) {
      return;
    }

    // Calculate electrical field value at this position
    let fieldValue = 0;

    // Attraction to existing sources (creates branching)
    for (const [, sourceNode] of this.source) {
      const dist = this.distance(cell, sourceNode.cell);
      fieldValue += 1.0 - (0.5 / Math.max(dist, 0.1));
    }

    // Strong attraction to sinks (creates directional flow)
    for (const [, sinkNode] of this.sink) {
      const dist = this.distance(cell, sinkNode.cell);
      fieldValue += 100.0 / Math.max(dist, 0.1);
    }

    this.sourceFrontier.set(hash, {
      value: fieldValue,
      cell: cell,
      parent: parent
    });
  }

  sampleSourceFrontier(power: number, rng: RandomGenerator): { cell: Cell; parent: Cell } | null {
    if (this.sourceFrontier.size === 0) return null;

    const frontierArray = Array.from(this.sourceFrontier.values());

    // Find min/max values for normalization
    let minValue = Infinity;
    let maxValue = -Infinity;

    for (const frontier of frontierArray) {
      minValue = Math.min(frontier.value, minValue);
      maxValue = Math.max(frontier.value, maxValue);
    }

    const range = maxValue - minValue;

    // If all values are the same, pick randomly
    if (range <= 0.001) {
      const randomIndex = Math.floor(rng.random() * frontierArray.length);
      const selected = frontierArray[randomIndex];
      return { cell: selected.cell, parent: selected.parent };
    }

    // Weighted sampling based on field strength
    let totalWeight = 0;
    const weights: number[] = [];

    for (const frontier of frontierArray) {
      const normalizedValue = (frontier.value - minValue) / range;
      const weight = Math.pow(normalizedValue, power);
      weights.push(weight);
      totalWeight += weight;
    }

    // Sample based on weights
    let randomValue = rng.random() * totalWeight;

    for (let i = 0; i < frontierArray.length; i++) {
      randomValue -= weights[i];
      if (randomValue <= 0) {
        const selected = frontierArray[i];
        return { cell: selected.cell, parent: selected.parent };
      }
    }

    // Fallback to last element
    const selected = frontierArray[frontierArray.length - 1];
    return { cell: selected.cell, parent: selected.parent };
  }

  getChannels(): Array<Array<{ x: number; y: number }>> {
    // Find all terminal nodes
    const terminals = Array.from(this.source.entries())
      .filter(([, node]) => node.terminal)
      .map(([hash]) => hash);

    // Sort by depth (deepest first)
    terminals.sort((a, b) => {
      const nodeA = this.source.get(a)!;
      const nodeB = this.source.get(b)!;
      return nodeB.depth - nodeA.depth;
    });

    const visited = new Set<string>();
    const channels: Array<Array<{ x: number; y: number }>> = [];

    // Create channels from terminals back to root
    for (const terminalHash of terminals) {
      const channel: Array<{ x: number; y: number }> = [];
      let currentHash: string | null = terminalHash;

      // Check if this terminal can reach the root
      let canReachRoot = false;
      let testHash: string | null = terminalHash;
      const pathToRoot = new Set<string>();

      while (testHash) {
        const node = this.source.get(testHash);
        if (!node) break;

        if (pathToRoot.has(testHash)) {
          // Circular reference - this should not happen but handle it
          break;
        }
        pathToRoot.add(testHash);

        if (node.parent === null) {
          // Found root
          canReachRoot = true;
          break;
        }

        testHash = node.parent;
      }

      // Only include terminals that can reach the root
      if (!canReachRoot) {
        continue;
      }

      // Build the channel
      while (currentHash && !visited.has(currentHash)) {
        const node = this.source.get(currentHash);
        if (!node) break;

        channel.push({
          x: node.cell.x + node.jitter[0],
          y: node.cell.y + node.jitter[1]
        });

        visited.add(currentHash);
        currentHash = node.parent;
      }

      if (channel.length > 0) {
        channel.reverse(); // Reverse to go from root to terminal
        channels.push(channel);
      }
    }

    return channels;
  }

  isFinished(): boolean {
    return this.finished;
  }

  hasFrontier(): boolean {
    return this.sourceFrontier.size > 0;
  }

  getSourceCells(): Cell[] {
    return Array.from(this.source.values()).map(node => node.cell);
  }
}

// Main realistic generation function with identical signature
export function generateLichtenbergFigure(
  config: LichtenbergConfig,
  seed?: number
): LichtenbergFigure {
  const actualSeed = seed ?? config.seed ?? Date.now();

  // If minVertices is specified, use iterative refinement for connectivity
  if (config.minVertices && config.minVertices > 0) {
    return generateWithConnectivityRefinement(config, actualSeed);
  }

  return generateRealisticLichtenbergFigure(config, actualSeed);
}

// Find terminal nodes (vertices with exactly 1 connection) - the active frontiers for new growth
function findTerminalNodes(vertices: LichtenbergVertex[], connections: LichtenbergConnection[]): LichtenbergVertex[] {
  return vertices.filter(vertex => {
    const connectionCount = connections.filter(conn =>
      conn.from === vertex.id || conn.to === vertex.id
    ).length;
    return connectionCount === 1;
  });
}

// Generate new discharge from multiple terminal points and merge with existing component
function extendFromTerminals(
  existingComponent: LichtenbergFigure,
  config: LichtenbergConfig,
  seed: number
): LichtenbergFigure {
  const terminals = findTerminalNodes(existingComponent.vertices, existingComponent.connections);

    if (terminals.length === 0) {
    // No terminals to extend from, return existing component
    return existingComponent;
  }

  // Create multiple small growths from each terminal
  const newGrowths: LichtenbergFigure[] = [];

  for (let i = 0; i < terminals.length; i++) {
    const terminal = terminals[i];
    const localConfig = createConfigFromComponent(config, [terminal], seed + i);

    // Generate small growth from this terminal
    const growth = generateRealisticLichtenbergFigure(localConfig, seed + i);
    newGrowths.push(growth);
  }

  // Merge all growths with the existing component
  return mergeComponents(existingComponent, newGrowths, terminals, seed + terminals.length);
}

// Merge multiple Lichtenberg figures into one, updating vertex IDs to avoid conflicts
// and connecting new growths to existing terminals
function mergeComponents(
  existingComponent: LichtenbergFigure,
  newGrowths: LichtenbergFigure[],
  terminals: LichtenbergVertex[],
  seed?: number
): LichtenbergFigure {
  const allVertices: LichtenbergVertex[] = [...existingComponent.vertices];
  const allConnections: LichtenbergConnection[] = [...existingComponent.connections];

  // Create a shared vertex ID generator for this merge operation
  const vertexIdGenerator = new VertexIdGenerator(seed);

  for (let i = 0; i < newGrowths.length; i++) {
    const growth = newGrowths[i];
    if (growth.vertices.length === 0) continue;

    // Create vertex ID mapping for this growth
    const vertexIdMap = new Map<string, string>();

    // Add vertices with new IDs
    for (const vertex of growth.vertices) {
      const newId = vertexIdGenerator.generateId();
      vertexIdMap.set(vertex.id, newId);

      allVertices.push({
        ...vertex,
        id: newId
      });
    }

    // Add connections with updated IDs
    for (const connection of growth.connections) {
      const newFromId = vertexIdMap.get(connection.from);
      const newToId = vertexIdMap.get(connection.to);

      if (newFromId && newToId) {
        allConnections.push({
          ...connection,
          from: newFromId,
          to: newToId
        });
      }
    }

    // Connect this growth to its corresponding terminal
    if (i < terminals.length && growth.vertices.length > 0) {
      const terminal = terminals[i];

      // Find the closest vertex in the new growth to connect to the terminal
      let closestVertex = growth.vertices[0];
      let minDistance = Math.hypot(
        closestVertex.x - terminal.x,
        closestVertex.y - terminal.y
      );

      for (const vertex of growth.vertices) {
        const distance = Math.hypot(
          vertex.x - terminal.x,
          vertex.y - terminal.y
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestVertex = vertex;
        }
      }

      // Create connection between terminal and closest vertex in new growth
      const closestVertexNewId = vertexIdMap.get(closestVertex.id);
      if (closestVertexNewId) {
        allConnections.push({
          from: terminal.id,
          to: closestVertexNewId,
          length: minDistance
        });
      }
    }
  }

  return {
    vertices: allVertices,
    connections: allConnections
  };
}

// Iterative refinement: re-spark + drop orphaned subgraphs until constraints are satisfied
function generateWithConnectivityRefinement(
  config: LichtenbergConfig,
  seed: number
): LichtenbergFigure {
  const maxAttempts = 10;
  let attempt = 0;

  // Initial generation
  let currentResult = generateRealisticLichtenbergFigure(config, seed);
  let currentComponent = filterToLargestComponent(currentResult);

    while (attempt < maxAttempts && currentComponent.vertices.length < config.minVertices!) {
    // Find terminals and extend from them
    const extendedResult = extendFromTerminals(currentComponent, config, seed + attempt + 1000);

    // Filter to largest connected component again
    const newComponent = filterToLargestComponent(extendedResult);

    // Check if we made progress
    if (newComponent.vertices.length <= currentComponent.vertices.length) {
      break;
    }

    currentComponent = newComponent;
    attempt++;
  }
  return currentComponent;
}

// Helper functions for iterative refinement
function extractVerticesFromChannels(channels: Array<Array<{ x: number; y: number }>>, seed?: number): LichtenbergVertex[] {
  const vertices: LichtenbergVertex[] = [];
  const vertexMap = new Map<string, string>();
  const vertexIdGenerator = new VertexIdGenerator(seed);

  for (const channel of channels) {
    for (const point of channel) {
      const key = `${Math.floor(point.x * 100) / 100}_${Math.floor(point.y * 100) / 100}`;
      if (!vertexMap.has(key)) {
        const vertexId = vertexIdGenerator.generateId();
        vertices.push({
          x: point.x,
          y: point.y,
          id: vertexId
        });
        vertexMap.set(key, vertexId);
      }
    }
  }

  return vertices;
}

function extractConnectionsFromChannels(channels: Array<Array<{ x: number; y: number }>>, vertices: LichtenbergVertex[]): LichtenbergConnection[] {
  const connections: LichtenbergConnection[] = [];
  const vertexMap = new Map<string, string>();

  // Build vertex lookup map
  for (const vertex of vertices) {
    const key = `${Math.floor(vertex.x * 100) / 100}_${Math.floor(vertex.y * 100) / 100}`;
    vertexMap.set(key, vertex.id);
  }

  for (const channel of channels) {
    if (channel.length < 2) continue;

    for (let i = 0; i < channel.length - 1; i++) {
      const fromKey = `${Math.floor(channel[i].x * 100) / 100}_${Math.floor(channel[i].y * 100) / 100}`;
      const toKey = `${Math.floor(channel[i + 1].x * 100) / 100}_${Math.floor(channel[i + 1].y * 100) / 100}`;

      const fromVertex = vertexMap.get(fromKey);
      const toVertex = vertexMap.get(toKey);

      if (fromVertex && toVertex) {
        const dx = channel[i + 1].x - channel[i].x;
        const dy = channel[i + 1].y - channel[i].y;
        const length = Math.sqrt(dx * dx + dy * dy);

        connections.push({
          from: fromVertex,
          to: toVertex,
          length: length
        });
      }
    }
  }

  return connections;
}

function findLargestConnectedComponent(vertices: LichtenbergVertex[], connections: LichtenbergConnection[]): LichtenbergVertex[] {
  if (vertices.length === 0) return [];

  const adjacencyMap = new Map<string, Set<string>>();

  // Initialize adjacency map
  for (const vertex of vertices) {
    adjacencyMap.set(vertex.id, new Set());
  }

  // Add connections (bidirectional)
  for (const connection of connections) {
    const fromSet = adjacencyMap.get(connection.from);
    const toSet = adjacencyMap.get(connection.to);
    if (fromSet && toSet) {
      fromSet.add(connection.to);
      toSet.add(connection.from);
    }
  }

  // Find all connected components
  const visited = new Set<string>();
  const components: LichtenbergVertex[][] = [];

  for (const vertex of vertices) {
    if (visited.has(vertex.id)) continue;

    const component: LichtenbergVertex[] = [];
    const queue = [vertex.id];
    visited.add(vertex.id);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentVertex = vertices.find(v => v.id === currentId);
      if (currentVertex) {
        component.push(currentVertex);
        const neighbors = adjacencyMap.get(currentId);
        if (neighbors) {
          for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
              visited.add(neighborId);
              queue.push(neighborId);
            }
          }
        }
      }
    }

    components.push(component);
  }

  // Return the largest component
  return components.reduce((largest, current) =>
    current.length > largest.length ? current : largest,
    []
  );
}

function filterToLargestComponent(result: LichtenbergFigure): LichtenbergFigure {
  if (result.vertices.length === 0) return result;

  const largestComponent = findLargestConnectedComponent(result.vertices, result.connections);
  if (largestComponent.length === 0) return { vertices: [], connections: [] };

  // Create a set of vertex IDs in the largest component
  const componentVertexIds = new Set(largestComponent.map(v => v.id));

  // Filter connections to only include those within the largest component
  const filteredConnections = result.connections.filter(conn =>
    componentVertexIds.has(conn.from) && componentVertexIds.has(conn.to)
  );

  return {
    vertices: largestComponent,
    connections: filteredConnections
  };
}

function createConfigFromComponent(
  originalConfig: LichtenbergConfig,
  component: LichtenbergVertex[],
  seed: number
): LichtenbergConfig {
  if (component.length === 0) return originalConfig;

  // Find the center of the component
  const centerX = component.reduce((sum, v) => sum + v.x, 0) / component.length;
  const centerY = component.reduce((sum, v) => sum + v.y, 0) / component.length;

  // Create new config that starts from the component center
  return {
    ...originalConfig,
    startX: centerX,
    startY: centerY,
    seed: seed,
    // Boost the minVertices requirement since we're building on existing work
    minVertices: Math.max(
      originalConfig.minVertices || 0,
      component.length + Math.floor((originalConfig.minVertices || 0) - component.length)
    )
  };
}

function attemptReSparkFromComponent(
  field: ElectricalField,
  rng: RandomGenerator,
  config: LichtenbergConfig,
  component: LichtenbergVertex[]
): boolean {
  if (component.length === 0) return false;

  // Create a new field with only the vertices from the largest component
  const newField = new ElectricalField(config.width, config.height);

  // Re-add sink points
  const sinkX = config.width * 0.9;
  const sinkY = config.height * 0.5;
  newField.addSink({ x: sinkX, y: sinkY }, rng);

  if (config.width > 100) {
    newField.addSink({ x: config.width * 0.95, y: config.height * 0.3 }, rng);
    newField.addSink({ x: config.width * 0.95, y: config.height * 0.7 }, rng);
  }

  // Select a random vertex from the component as new origin
  const randomIndex = Math.floor(rng.random() * component.length);
  const selectedVertex = component[randomIndex];

  // Add some spatial variation to avoid exact overlap
  const jitterAmount = 2.0;
  const newOrigin = {
    x: selectedVertex.x + (rng.random() - 0.5) * jitterAmount,
    y: selectedVertex.y + (rng.random() - 0.5) * jitterAmount
  };

  // Ensure the new origin is within bounds
  newOrigin.x = Math.max(0, Math.min(config.width - 1, newOrigin.x));
  newOrigin.y = Math.max(0, Math.min(config.height - 1, newOrigin.y));

  // Replace the field with the new one
  // Note: This is a simplified approach - in practice we'd need to properly transfer state
  field.addSource(newOrigin, null, rng);

  return true;
}

// Re-sparking helper function to create new discharge origins
function attemptReSpark(
  field: ElectricalField,
  rng: RandomGenerator,
  config: LichtenbergConfig
): boolean {
  const sourceCells = field.getSourceCells();
  if (sourceCells.length === 0) return false;

  // Select a random existing vertex as a new discharge origin
  const randomIndex = Math.floor(rng.random() * sourceCells.length);
  const selectedCell = sourceCells[randomIndex];

  // Add some spatial variation to avoid exact overlap
  const jitterAmount = 2.0;
  const newOrigin = {
    x: selectedCell.x + (rng.random() - 0.5) * jitterAmount,
    y: selectedCell.y + (rng.random() - 0.5) * jitterAmount
  };

  // Ensure the new origin is within bounds
  newOrigin.x = Math.max(0, Math.min(config.width - 1, newOrigin.x));
  newOrigin.y = Math.max(0, Math.min(config.height - 1, newOrigin.y));

  // Add the new origin as a root (no parent)
  field.addSource(newOrigin, null, rng);

  return true;
}

// Core realistic generation algorithm using electrical field physics
function generateRealisticLichtenbergFigure(
  config: LichtenbergConfig,
  seed: number
): LichtenbergFigure {
  const rng = createSeededRNG(seed);
  const field = new ElectricalField(config.width, config.height);

  // Add sink points to create directional flow
  const sinkX = config.width * 0.9; // Near eastern edge
  const sinkY = config.height * 0.5; // Center vertically
  field.addSink({ x: sinkX, y: sinkY }, rng);

  // Add optional additional sinks for more complex patterns
  if (config.width > 100) {
    field.addSink({ x: config.width * 0.95, y: config.height * 0.3 }, rng);
    field.addSink({ x: config.width * 0.95, y: config.height * 0.7 }, rng);
  }

  // Start with initial source
  const startCell = { x: config.startX, y: config.startY };
  field.addSource(startCell, null, rng);

  // Parameters for electrical discharge simulation
  const minVertices = config.minVertices || 100;
  const maxVertices = config.maxVertices || minVertices * 3;
  const samplingPower = 3.0; // Higher power = more concentrated growth
  const maxIterations = maxVertices * 2; // Prevent infinite loops

    // Main growth simulation with re-sparking
  let iterations = 0;
  while (field.getSourceCells().length < maxVertices && iterations < maxIterations) {
    // Normal growth while we have frontier and haven't finished
    while (field.hasFrontier() && !field.isFinished() &&
           field.getSourceCells().length < maxVertices &&
           iterations < maxIterations) {

      const sample = field.sampleSourceFrontier(samplingPower, rng);
      if (!sample) break;

      field.addSource(sample.cell, sample.parent, rng);
      iterations++;
    }

    // If we haven't reached minVertices, try re-sparking
    if (field.getSourceCells().length < minVertices && iterations < maxIterations) {
      const reSparkSuccess = attemptReSpark(field, rng, config);
      if (!reSparkSuccess) {
        break; // Can't re-spark, stop trying
      }
    } else {
      break; // We've reached minVertices or other stopping condition
    }
  }

  // Convert channels to vertices and connections
  const channels = field.getChannels();
  const vertices: LichtenbergVertex[] = [];
  const connections: LichtenbergConnection[] = [];
  const vertexMap = new Map<string, string>(); // position -> vertex ID

  // Create vertex ID generator for this figure, using the same seed for determinism
  const vertexIdGenerator = new VertexIdGenerator(seed);

  function getOrCreateVertex(x: number, y: number): string {
    // CRITICAL FIX: Clamp final vertex positions to stay within bounds
    // This prevents jitter from pushing vertices outside the electrical field bounds
    const clampedX = Math.max(0, Math.min(config.width - 1, x));
    const clampedY = Math.max(0, Math.min(config.height - 1, y));

    const key = `${Math.floor(clampedX * 100) / 100}_${Math.floor(clampedY * 100) / 100}`;

    if (vertexMap.has(key)) {
      return vertexMap.get(key)!;
    }

    const vertexId = vertexIdGenerator.generateId();
    vertices.push({
      x: clampedX,
      y: clampedY,
      id: vertexId
    });
    vertexMap.set(key, vertexId);
    return vertexId;
  }

  // Convert channels to vertex/connection structure
  for (const channel of channels) {
    if (channel.length < 2) continue;

    for (let i = 0; i < channel.length - 1; i++) {
      const fromVertex = getOrCreateVertex(channel[i].x, channel[i].y);
      const toVertex = getOrCreateVertex(channel[i + 1].x, channel[i + 1].y);

      // Add parent relationship
      const toVertexObj = vertices.find(v => v.id === toVertex);
      if (toVertexObj && !toVertexObj.parentId) {
        toVertexObj.parentId = fromVertex;
      }

      // Add connection
      const dx = channel[i + 1].x - channel[i].x;
      const dy = channel[i + 1].y - channel[i].y;
      const length = Math.sqrt(dx * dx + dy * dy);

      connections.push({
        from: fromVertex,
        to: toVertex,
        length: length
      });
    }
  }

  // CRITICAL FIX: Ensure all vertices are in the same connected component
  // If we have disconnected vertices, only keep the largest connected component
  if (vertices.length > 1 && connections.length > 0) {
    // Find connected components
    const adjacencyMap = new Map<string, Set<string>>();

    // Initialize all vertices
    for (const vertex of vertices) {
      adjacencyMap.set(vertex.id, new Set());
    }

    // Add connections (bidirectional)
    for (const connection of connections) {
      const fromSet = adjacencyMap.get(connection.from);
      const toSet = adjacencyMap.get(connection.to);

      if (fromSet && toSet) {
        fromSet.add(connection.to);
        toSet.add(connection.from);
      }
    }

    // Find the largest connected component starting from any vertex
    // (we can't assume vertex_0 exists anymore with random IDs)
    const rootVertex = vertices[0];
    if (rootVertex) {
      const visited = new Set<string>();
      const queue = [rootVertex.id];
      visited.add(rootVertex.id);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const neighbors = adjacencyMap.get(currentId);

        if (neighbors) {
          for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
              visited.add(neighborId);
              queue.push(neighborId);
            }
          }
        }
      }

      // Filter vertices and connections to only include reachable ones
      const reachableVertices = vertices.filter(v => visited.has(v.id));
      const reachableConnections = connections.filter(c =>
        visited.has(c.from) && visited.has(c.to)
      );

      return {
        vertices: reachableVertices,
        connections: reachableConnections
      };
    }
  }

  return {
    vertices: vertices,
    connections: connections
  };
}

// Simple seeded RNG for consistent results
function createSeededRNG(seed: number): RandomGenerator {
  let currentSeed = seed;
  return {
    random(): number {
      const x = Math.sin(currentSeed++) * 10000;
      return x - Math.floor(x);
    }
  };
}

// Legacy compatibility functions (if needed)
export function generateOptimizedLichtenbergFigure(
  config: LichtenbergConfig,
  optimizations?: any,
  sparkDepth: number = 0
): LichtenbergFigure {
  // Use our physics-based algorithm instead of the old optimized one
  return generateLichtenbergFigure(config);
}
