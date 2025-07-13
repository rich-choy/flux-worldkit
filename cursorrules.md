# Worldgen Project Context

## Current Situation

We have a **terrain-driven world generation system** that creates connected graph networks representing game worlds. The system generates worlds with realistic spatial dimensions (14.5km × 9.0km default) containing thousands of interconnected places across different ecosystem types.

### What we have implemented

**Dense Mesh River Delta Generator**:
- Generates a fully connected graph of places using dense mesh connectivity within each ecosystem
- Each vertex connects to 6-8 neighbors in the 8 cardinal directions (N, NE, E, SE, S, SW, W, NW)
- Edge directions are determined by the eight cardinal directions - nodes "snap" to a Cartesian grid
- Golden Ratio influences are preserved for aesthetic flow patterns
- All ecosystems receive dense mesh connectivity to eliminate isolated vertices

**Center Line Origin System:**
- **Delta Origins**: All river delta origins are vertically aligned along the horizontal center line of the world
- **Origin-Based Bridging**: Inter-ecosystem bridges connect from the closest node in the current ecosystem to the origin of the next ecosystem's delta
- **Tie-Breaking**: When multiple nodes are equidistant to an origin, ties are broken randomly
- **Reciprocal Connections**: All bridges create bidirectional exits between ecosystems

**Ecosystem Processing Pipeline:**
- **Pair-by-Pair Processing**: Each ecosystem pair (current → next) is processed independently
- **Internal Dense Mesh**: Each ecosystem gets dense mesh connectivity for internal traversal
- **Immediate Cleanup**: Orphaned subgraphs are dropped immediately after delta generation
- **Final Ecosystem Processing**: The last ecosystem (Jungle) gets explicit dense mesh processing
- **Bridge Preservation**: Vertices involved in inter-ecosystem bridges are protected from reassignment

**Ecosystem Progression (West to East):**
1. **Steppe (Arid)** - Brown
2. **Grassland (Temperate)** - Vibrant yellow
3. **Forest (Temperate)** - Vibrant green
4. **Mountain (Arid)** - Red
5. **Jungle (Tropical)** - Muted green
6. **Marsh (Tropical)** - Assigned to easternmost column of Jungle ecosystem only

## What We Want to Achieve

### Primary Goal: Single Connected Component
- **Full World Connectivity**: Every place must be reachable from every other place
- **No Orphaned Subgraphs**: Zero isolated components or floating nodes
- **Guaranteed Traversal**: West-to-east journey possible across all ecosystem boundaries
- **Dense Local Connectivity**: 2-5 connections per vertex for rich exploration within ecosystems

### Marsh Ecosystem Assignment
**Within the Jungle (easternmost) ecosystem only:**
1. Identify vertices in the easternmost column of the Jungle ecosystem
2. Assign `flux:eco:marsh:tropical` to those vertices (preserving bridge vertices)
3. Generate dense mesh connectivity within the marsh region
4. Maintain connection to the broader jungle ecosystem

### Technical Implementation
- **Dense Mesh Connectivity**: Each vertex attempts 6 connections to adjacent grid positions
- **Spatial Lookup**: Fast neighbor finding using grid coordinate hashing
- **Duplicate Edge Prevention**: Bidirectional edge checking to avoid redundant connections
- **Component Analysis**: BFS-based connected component detection and cleanup
- **Origin Detection**: Center line vertex identification with tolerance for grid alignment
