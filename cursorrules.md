# Worldgen Project Context

## New Vision: Continuous River Flow with Gaussian Ecosystem Dithering

We are building a **terrain-driven world generation system** that creates connected graph networks representing game worlds. The system generates worlds with realistic spatial dimensions (14.5km × 9.0km default) containing thousands of interconnected places with natural ecosystem transitions.

### Core Philosophy

**Decouple Connectivity from Ecosystem Boundaries**:
- Generate a single continuous river-like graph that flows west-to-east
- Assign ecosystems to vertices independently using probabilistic dithering
- Create natural ecosystem transitions instead of artificial hard boundaries

### The New Approach

#### Step 1: Define Ecosystem Bands
- Divide the world plane into 5 equal bands, each 20% of total width
- West to East: Steppe → Grassland → Forest → Mountain → Jungle
- These bands determine **initial ecosystem assignment** for vertices
- No connectivity constraints - purely spatial reference zones

#### Step 2: Generate Continuous River Flow
- Start with a single origin vertex at the westernmost column, vertically centered
- Generate a confluence-pattern river-like graph that propagates eastward
- Flow naturally through all 5 ecosystem regions without boundary constraints
- Continue until reaching the eastern boundary of the easternmost ecosystem
- Use natural river branching patterns (tributaries, deltas, confluence points)
- Each vertex gets **initial ecosystem assignment** based on which band it's in

#### Step 3: Ecosystem Dithering with Golden Ratio Proportions
- Take the initial ecosystem assignments from Step 2 (based on band location)
- Within each ecosystem band, use **golden ratio proportions**:
  - **Pure ecosystem zone**: 38.2% of band width (1 - φ + 1 = 0.382)
  - **Transition zone**: 61.8% of band width (φ - 1 = 0.618)
- For vertices in pure zones: keep original ecosystem assignment
- For vertices in transition zones: probabilistically reassign to adjacent ecosystem
- Distance from boundary center determines probability weights
- Creates natural ecosystem gradients instead of hard boundaries

**Example for 1000m bands:**
```
| A (382m pure) | A↔B dithering (618m) | B (382m pure) | B↔C dithering (618m) | C (382m pure) |
```

### Ecosystem Progression (West to East)
1. **Steppe (Arid)** → 2. **Grassland (Temperate)** → 3. **Forest (Temperate)** → 4. **Mountain (Arid)** → 5. **Jungle (Tropical)**
   - **Marsh (Tropical)** assigned to eastern boundary vertices post-generation

#### Ecosystem Taxonomy URNs
- `flux:eco:steppe:arid`
- `flux:eco:grassland:temperate`
- `flux:eco:forest:temperate`
- `flux:eco:mountain:arid`
- `flux:eco:jungle:tropical`

### Target Connectivity Patterns by Ecosystem
- **Steppe, Grassland**: 3.5 connections per vertex (dense exploration)
- **Forest**: 2.5 connections per vertex (moderate connectivity)
- **Mountain, Jungle**: 1.5 connections per vertex (sparse, with dead ends)

*Note: These are target biases for the connectivity fixing phase that will adjust the river network after dithering to achieve desired connection density per ecosystem.*

### Technical Requirements

#### Pure and Deterministic Logic
- **All algorithms must be pure functions**: No side effects, same input always produces same output
- **Deterministic behavior**: Given the same seed, world generation must produce identical results
- **Dependency injection for impurity**: Any sources of non-determinism (RNG, timestamps, etc.) must be injected as parameters
- **Seeded randomness**: All random operations must use a seeded pseudo-random number generator
- **No global state**: All state must be passed explicitly as function parameters
- **Testable and reproducible**: Every function should be easily unit-testable with predictable outputs

**Example of proper dependency injection:**
```typescript
// ✅ GOOD - Pure function with injected RNG
function generateRiverFlow(metrics: SpatialMetrics, bands: EcosystemBand[], rng: () => number): FlowResult {
  // Uses injected RNG for all random operations
}

// ❌ BAD - Impure function with internal randomness
function generateRiverFlow(metrics: SpatialMetrics, bands: EcosystemBand[]): FlowResult {
  const randomValue = Math.random(); // Non-deterministic!
  const timestamp = Date.now(); // Non-deterministic!
}
```

#### River Flow Generation
- **Origin**: Single vertex at westernmost column, vertically centered
- **Flow pattern**: Natural tributary/confluence patterns flowing eastward
- **Branching**: Organic splitting and merging of river channels
- **Grid alignment**: **MANDATORY** - All connections must be at exact 45-degree multiples (8-directional grid movement only)
  - Valid angles: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
  - Grid moves: E, NE, N, NW, W, SW, S, SE
  - **NO diagonal connections** except at these exact angles
  - **NO arbitrary angle connections** - all edges must align perfectly to grid
- **Connectivity**: Single connected component (no disconnected subgraphs)
- **Boundary collision handling**: When river flow hits the y-axis boundaries (horizontal walls), apply bias to direct flow back toward center to prevent excessive wall-hugging

#### Ecosystem Dithering Algorithm
```typescript
// For each vertex at position (x, y):
// 1. Determine which ecosystem region(s) it falls into
// 2. Calculate distance from nearest ecosystem boundary
// 3. Apply Gaussian probability based on distance
// 4. Assign ecosystem probabilistically

const GOLDEN_RATIO = 0.618;
const PURE_RATIO = 1 - GOLDEN_RATIO; // 0.382
const TRANSITION_RATIO = GOLDEN_RATIO; // 0.618

function calculateEcosystemProbability(vertex: Vertex, ecosystemBoundaries: Boundary[]): EcosystemProbability {
  // Implementation determines Gaussian weights based on distance from boundaries
}
```

#### Golden Ratio Proportions
- **Pure zones**: 38.2% of each ecosystem band width
- **Transition zones**: 61.8% of each ecosystem band width
- **Natural feel**: Golden ratio creates aesthetically pleasing proportions
- **Smooth transitions**: Gaussian distribution prevents abrupt ecosystem changes

### Benefits of This Approach

1. **Natural Ecosystem Boundaries**: No artificial hard lines between biomes
2. **Continuous River System**: Single flowing network instead of disconnected bands
3. **Realistic Geography**: Ecosystems transition gradually like in nature
4. **Flexible Connectivity**: River flow independent of ecosystem assignments
5. **Golden Ratio Aesthetics**: Natural proportions that feel organic
6. **Emergent Complexity**: Simple rules create complex, natural-looking worlds

### Visualization Integration Requirements

**Existing UI Infrastructure**:
The worldgen system must integrate with the existing React visualization interface:

```typescript
// Required types for UI compatibility
export interface WorldGenerationConfig {
  // Configuration parameters for river flow + dithering
}

export interface WorldGenerationResult {
  // Output format for Viewport visualization
}

// UI expects this interface
const { generateWorld, isGenerating, clearError } = useWorldGeneration()
const generatedWorld = await generateWorld(config)  // WorldGenerationResult
```

**Visualization Modes**:
- **Graph Mode**: Display the continuous river connectivity network
  - Show vertices as nodes with ecosystem color-coding
  - Display edges as river flow connections
  - Highlight the west-to-east flow patterns
  - Show tributary/confluence patterns

- **Analysis Mode**: Show ecosystem dithering results and statistics
  - Visualize golden ratio zone boundaries (38.2% pure, 61.8% transition)
  - Display ecosystem distribution patterns
  - Show connectivity density by ecosystem type
  - Highlight isolated ecosystem pockets (especially mountains)

**Output Format Requirements**:
- **Vertex data**: Position, ecosystem assignment, connectivity
- **Edge data**: River flow connections with directional information
- **Metadata**: Ecosystem boundaries, dithering statistics, connectivity metrics
- **Visualization hints**: Color schemes, zone overlays, flow animations

### Implementation Strategy

1. **Phase 1**: Define 5 ecosystem bands (20% width each)
2. **Phase 2**: Generate continuous west-to-east river flow vertex graph with initial ecosystem assignment depending on its ecosystem band containment
3. **Phase 3**: Apply Gaussian dithering to reassign ecosystems to vertices in transition zones
4. **Phase 4**: Validate connectivity and ecosystem distribution
5. **Phase 5**: Generate places and exits from final vertex graph
6. **Phase 6**: Format output for React Viewport component visualization

### Success Criteria

**Core Algorithm**:
- **Single connected component**: All vertices reachable from origin
- **Natural transitions**: Smooth ecosystem gradients, no hard boundaries
- **Golden ratio proportions**: 38.2% pure zones, 61.8% transition zones
- **River-like flow**: Realistic tributary and confluence patterns
- **Target connectivity**: Appropriate connection density per ecosystem type
- **Grid alignment**: All connections at 45-degree multiples

**Visualization Integration**:
- **UI compatibility**: Works seamlessly with existing React Viewport component
- **Type safety**: Proper TypeScript interfaces for WorldGenerationConfig and WorldGenerationResult
- **Graph visualization**: River network displays clearly with ecosystem color-coding
- **Analysis visualization**: Dithering results and statistics render correctly
- **Performance**: Generates and renders worlds efficiently in browser environment
- **User experience**: Smooth integration with existing UI controls and workflows

---

## Implementation Notes

- **Start simple**: Begin with basic west-to-east flow, add complexity incrementally
- **Test continuously**: Validate connectivity and ecosystem distribution at each step
- **Preserve river metaphor**: All connectivity decisions should feel like natural water flow
- **Embrace emergence**: Let complex patterns arise from simple rules
- **Visualize early**: Ensure each phase produces visualization-friendly output for debugging and validation
- **UI-first approach**: Design data structures that work well with the existing React Viewport component
