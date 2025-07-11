# Worldgen Project Context

## Problem Statement
We need to build a React-based visualization interface for a **terrain-driven world generation system** that prioritizes gameplay requirements over mathematical complexity. The current worldgen React application has a basic interface, but we need to create a functional UI that allows users to:

1. **Control World Generation Parameters** through an intuitive sidebar interface
2. **Visualize Generated Worlds** as an interactive graph overlaid on ecosystem bands
3. **Interact with a Simple, Terrain-Based Generation System** that puts gameplay first

## Core Design Philosophy: Discovery Over Design

### The Realization
The initial approach of using sophisticated Lichtenberg fractals was "designing rather than discovering" - creating mathematical complexity that doesn't directly serve the core gameplay requirements.

### What Actually Matters
Three simple terrain-based connectivity rules:
- **Open terrain (steppe, grassland)** = many possible connections
- **Difficult terrain (mountains, marsh)** = few, precious connections, many vertical in nature
- **Forests** = moderate connectivity, following natural paths with some interspersed mountains to serve as chaos generators

### River Delta Connectivity Pattern
Each ecosystem should have a **figurative "river delta"** connectivity pattern that:
- **Propagates from west to east** - branching dendritic patterns flowing across each ecosystem band
- **Connects ecosystems sequentially** - at least one tributary from each western delta connects to the origin of the next eastern delta
- **Follows terrain rules** - delta density and branching complexity varies by ecosystem type:
  - **Steppe/Grassland**: Dense, highly branched deltas (many tributaries)
  - **Forest**: Moderate branching with some mountain-disrupted patterns
  - **Mountain/Marsh**: Sparse, simple deltas (few precious tributaries)

**Note**: This is a figurative pattern for graph connectivity, not literal rivers. We want dendritic branching principles applied to place-to-place connections.

### Mountains as Chaos Generators
Drawing from the weather system's anti-equilibrium principles, mountains should serve as "chaos generators" that create:
- **Permanent gradients** that can never equilibrate
- **Amplification mechanisms** that enhance rather than dampen differences
- **Threshold effects** that create sudden state changes rather than smooth transitions

## Current Implementation Status

### What We Have - UPDATED
- **NEW: River Delta Generation System** (~400 lines) implementing the simplified terrain-based approach
- **Full West-to-East Stretching** - each delta spans from western edge to eastern edge of its ecosystem band
- **Terrain-Based Branching** - different branching patterns for each ecosystem type:
  - Steppe/Grassland: Dense, highly branched deltas (3 branches, 4 levels deep)
  - Forest: Moderate branching (2 branches, 3 levels deep)
  - Mountain/Marsh: Sparse, simple deltas (1 branch, 2 levels deep)
- **Sequential Ecosystem Connectivity** - easternmost tributaries connect to western origins of next ecosystem
- **Visualization infrastructure** with Canvas-based rendering
- **Web worker architecture** for non-blocking generation
- **Deterministic generation** with seeded random number generation

### REPLACED: Complex Lichtenberg System
- ~~**Working 1,900+ line implementation** with sophisticated multi-projection Lichtenberg system~~
- ~~Multi-projection ecosystem figures~~
- ~~Collision detection between projections~~
- ~~Eastward stretching transformations~~
- ~~Complex inter-ecosystem bridging~~
- ~~Sophisticated connectivity adjustment rules~~

**Decision Made**: We've replaced the complex fractal system with the direct terrain-based river delta approach that directly implements the three core rules.

## Requirements

### UI Layout & Theme
- **Gruvbox Dark Material** color scheme throughout the application
- **Main Viewport**: Canvas-based visualization area for displaying the generated world graph
- **Fixed Sidebar**: Left-side control panel that remains in position regardless of scroll
  - "Generate World" button to trigger world generation
  - Random Seed input field with a randomize button for reproducible world generation
  - "World Dimensions" controls for physical world size

### World Dimensions & Scale
- **Default Size**: San Francisco area (~130 km²) for 10,000 player capacity
- **Rectangular Shape**: Controllable aspect ratio, default 1.618:1 (golden ratio)
- **Orientation**: Rectangle runs lengthwise west to east (14.5 km × 9 km at default)
- **River Delta Flow**: Deltas flow west to east across the longer dimension for maximum branching space
- **Physical Meaning**: Each node = 100m × 100m (1 hectare) with terrain-based spacing

### Canvas Visualization
- **View Toggle Controls**: Two "pill" style buttons at the top right corner of the viewport:
  - "Graph" - shows the world visualization
  - "Analysis" - shows generation breakdown report
- **Graph View**:
  - **Ecosystem Background**: Rectangle divided into 5 vertical bands (west to east) representing:
    - Steppe (Arid) - westernmost band
    - Grassland (Temperate)
    - Forest (Temperate)
    - Mountain (Arid)
    - Jungle (Tropical) - easternmost band
    - Each band colored distinctly using Gruvbox Dark Material palette
  - **Place Graph Overlay**: Display the generated world as a network graph superimposed on the ecosystem bands
  - **River Delta Networks**: Show dendritic branching patterns flowing west to east across each ecosystem band
  - **Edge Visualization**: Draw lines between connected places to show the world's connectivity structure
  - **Spatial Alignment**: Places should align with their appropriate ecosystem bands based on their x-coordinates
- **Analysis View**:
  - **World Dimensions**: Display actual km dimensions and total area
  - **Input Parameters**: Display the configuration used for world generation
  - **Node Distribution by Ecosystem**: Show count and percentage of places in each ecosystem
  - **Average Connections per Node**: Calculate and display connectivity statistics by ecosystem
  - **Cross-World Traversal**: Show estimated nodes to traverse from west to east edge

### Technical Integration
- Connect the React UI to the existing world generation system (exposed as `@flux`)
- **Web Worker Architecture**: World generation must execute in a web worker to prevent blocking the main thread during computation
- Maintain the performance-first, functional programming approach established in the codebase

### Terrain-Based Connectivity Requirements
Different terrain types should have vastly different traversability and connection patterns:

**Target Connectivity Levels (avg connections per place):**
- **Steppe (Arid)**: ~4.0 connections - Wide open spaces, excellent visibility
- **Grassland (Temperate)**: ~3.2 connections - Open terrain allows many paths
- **Forest (Temperate)**: ~2.8 connections - Trees create barriers but trails exist, with mountain chaos nodes
- **Jungle (Tropical)**: ~2.4 connections - Dense vegetation with some paths
- **Mountain (Arid)**: ~1.6 connections - Rugged terrain severely limits passage, many vertical connections
- **Marsh (Tropical)**: ~2.0 connections - Difficult terrain, very limited paths

**Implementation Strategy:**
**River Delta Generation Approach - IMPLEMENTED:**
1. **Delta Origins**: Place origin nodes at the western edge of each ecosystem ✅
2. **Branching Generation**: Create dendritic branching patterns flowing eastward across the longer dimension (14.5 km), with branch density based on terrain type ✅
3. **Full Band Stretching**: Ensure final tributary nodes reach the eastern edge of each ecosystem band (2.9 km wide bands) ✅
4. **Inter-Ecosystem Bridging**: Connect the easternmost tributaries of each delta to the western origins of the next ecosystem ✅
5. **Rectangular World**: Generate worlds with controllable aspect ratio (default 1.618:1) for optimal river delta development ✅
6. **Physical Scale**: Map to real dimensions (~130 km² San Francisco scale) for 10,000 player capacity ✅
7. **Terrain Modification**: Apply chaos generators (mountains) to create unpredictable routing within the delta patterns 🔄

## Cross-World Traversal
- **West-to-East Journey**: ~85-95 nodes across 14.5 km (longer dimension)
- **Per Ecosystem Band**: ~17-19 nodes per 2.9 km band
- **MUD Scale**: 2-3 minutes of pure movement, perfect for text-based gameplay
- **Expedition Scale**: 2-3 day journey with stealth, rest, and resource gathering

## Current Focus
- **River Delta Visualization**: Test and refine the Canvas rendering of the new delta-based world generation
- **Chaos Generator Integration**: Implement mountain "chaos generators" that disrupt predictable delta patterns
- **Performance Optimization**: Ensure the simplified system maintains high performance
- **Connectivity Validation**: Verify that the new system achieves the target connectivity levels per ecosystem

## Key Constraints
- Pure functions preferred over object-oriented programming
- Where we use pure functions, we inject all sources of impurity
- Prioritize algorithmic efficiency and performance
- All code must be immediately runnable
- Unit tests should be pure and deterministic
- Use tilde (~) path alias for `src` directory references and `@flux` for flux-game imports
- Apply Gruvbox Dark Material theme consistently throughout the UI
- **Vite Server Management**: The Vite development server runs continuously on `localhost:5173`. Request server restart when needed rather than attempting to manage the server process directly

## Open Questions
1. **Simplify vs Enhance**: Should we replace the complex fractal system with a direct terrain-based approach, or continue refining the current implementation?
2. **Chaos Integration**: How should mountain "chaos generators" create unpredictable but balanced connectivity patterns?
3. **Discovery Process**: What aspects of world generation should emerge from simple rules rather than be explicitly designed?
