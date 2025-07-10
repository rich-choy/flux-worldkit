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
- Maintain the performance-first, functional programming approach established in the codebase

## Current Focus
- Implementing the complete worldgen visualization interface with ecosystem band backgrounds and place graph overlay

## Key Constraints
- No object-oriented programming - use pure functions only
- Prioritize algorithmic efficiency (O(N) or better complexity preferred)
- All code must be immediately runnable
- Unit tests should be pure and deterministic
- Use tilde (~) path alias for `src` directory references and `@flux` for flux-game imports
- Apply Gruvbox Dark Material theme consistently throughout the UI
