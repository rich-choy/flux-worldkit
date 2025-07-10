# Worldgen Project Context

## Problem Statement
We need to build a React-based visualization interface for the sophisticated Lichtenberg fractal-based world generation system. The current worldgen React application has only a basic "Hello World" placeholder, but we need to create a functional UI that allows users to:

1. **Control World Generation Parameters** through an intuitive sidebar interface
2. **Visualize Generated Worlds** as an interactive graph overlaid on ecosystem bands
3. **Interact with the World Generation System** that's already implemented in the `flux-game` package

## Requirements

### UI Layout & Theme
- **Gruvbox Dark Material** color scheme throughout the application
- **Main Viewport**: Canvas-based visualization area for displaying the generated world graph
- **Fixed Sidebar**: Left-side control panel that remains in position regardless of scroll
  - "Generate World" button to trigger world generation
  - Random Seed input field with a randomize button for reproducible world generation
  - "Approx # of Places" input field to control world size

### Canvas Visualization
- **View Toggle Controls**: Two "pill" style buttons at the top right corner of the viewport:
  - "Graph" - shows the world visualization
  - "Analysis" - shows generation breakdown report
- **Graph View**:
  - **Ecosystem Background**: Rectangle evenly divided into 5 vertical bands (20% each) representing:
    - Steppe (Arid) - western band
    - Grassland (Temperate)
    - Forest (Temperate)
    - Mountain (Arid)
    - Jungle (Tropical) - eastern band
    - Each band colored distinctly using Gruvbox Dark Material palette
  - **Place Graph Overlay**: Display the generated world as a network graph superimposed on the ecosystem bands
  - **Edge Visualization**: Draw lines between connected places to show the world's connectivity structure
  - **Spatial Alignment**: Places should align with their appropriate ecosystem bands based on their x-coordinates
- **Analysis View**:
  - **Input Parameters**: Display the configuration used for world generation
  - **Node Distribution by Ecosystem**: Show count and percentage of places in each ecosystem
  - **Average Connections per Node**: Calculate and display connectivity statistics by ecosystem

### Technical Integration
- Connect the React UI to the existing `flux-game` world generation system (exposed as `@flux`)
- Use the sophisticated multi-ecosystem Lichtenberg fractal generation described in worldgen.md
- **Physics-Based Lichtenberg Algorithm**: Implemented realistic electrical discharge simulation with field-based frontier sampling for natural lightning-like patterns (replaces geometric branching)
- Maintain the performance-first, functional programming approach established in the codebase
- **Web Worker Architecture**: World generation must execute in a web worker to prevent blocking the main thread during computation

### Ecosystem-Specific Connectivity Requirements
Different terrain types should have vastly different traversability and connection patterns:

**Target Connectivity Levels (avg connections per place):**
- **Grassland (Temperate)**: ~3.0 connections - Open terrain allows many paths
- **Steppe (Arid)**: ~3.0 connections - Wide open spaces, good visibility
- **Forest (Temperate)**: ~2.2 connections - Trees create barriers but trails exist
- **Swamp/Marsh (Tropical)**: ~1.8 connections - Difficult terrain, limited paths
- **Mountain (Arid)**: ~1.4 connections - Rugged terrain severely limits passage

**Implementation Strategy - Hybrid Connectivity Adjustment:**
1. **Base Generation**: Use uniform Lichtenberg fractals to ensure graph connectivity
2. **Post-Processing Phase**: Adjust connections based on ecosystem characteristics:
   - **Additive**: Add proximity-based connections in open ecosystems (grassland, steppe)
   - **Selective Removal**: Remove connections in difficult terrain (mountains, swamps) while preserving graph connectivity
   - **Distance-Aware**: Use ecosystem-specific connection ranges (grassland: 180m, mountain: 60m)
3. **Connectivity Preservation**: Maintain graph connectivity throughout all adjustments to ensure world accessibility

## Current Focus
- **Ecosystem Connectivity System**: Implementing post-processing connectivity adjustments to achieve realistic terrain-based traversability patterns
- **Visualization Interface**: Complete worldgen visualization with ecosystem band backgrounds and place graph overlay
- **Physics-Based Lichtenberg Generation**: Realistic lightning-like fractal patterns using electrical field simulation

## Key Constraints
- Pure functions preferred over object-oriented programming
- Where we use pure functions, we inject all sources of impurity
- Prioritize algorithmic efficiency and performance
- All code must be immediately runnable
- Unit tests should be pure and deterministic
- Use tilde (~) path alias for `src` directory references and `@flux` for flux-game imports
- Apply Gruvbox Dark Material theme consistently throughout the UI
- **Vite Server Management**: The Vite development server runs continuously on `localhost:5173`. Request server restart when needed rather than attempting to manage the server process directly
