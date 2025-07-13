# Worldgen Project Context

## Current Situation

We have a **terrain-driven world generation system** that creates connected graph networks representing game worlds. The system generates worlds with realistic spatial dimensions (14.5km × 9.0km default) containing thousands of interconnected places across different ecosystem types.

### What We Have Implemented

**Dense Mesh Connectivity System**:
- Each ecosystem uses dense mesh connectivity where vertices connect in all 8 cardinal directions
- Vertices have 2-5 connections on average for rich local exploration
- Current system has eastward bias (120% probability) but still allows westward connections (80% probability)
- All ecosystems receive this omnidirectional connectivity to eliminate isolated vertices

**Inter-ecosystem Bridge System**:
- ✅ **Bridge Policy**: Functional bridge creation between ecosystem boundaries
- ✅ **Bridge Generation**: Easternmost node of each ecosystem connects to westernmost origin of next ecosystem
- ✅ **Bridge Vertices**: Intermediate bridge vertices with proper grid-aligned pathfinding
- ✅ **Bridge Safeguards**: `addExitsToPlaces()` properly allows bridge connections

**Ecosystem Progression (West to East)**:
1. **Steppe (Arid)** → 2. **Grassland (Temperate)** → 3. **Forest (Temperate)** → 4. **Mountain (Arid)** → 5. **Jungle (Tropical)** → 6. **Marsh (Tropical)**

## The Desired Change

### Create Natural River Delta Flow Patterns

**Current Achievement**: Successfully implemented river delta fanout patterns with clear diagonal divergence from origin points.

**Solution Implemented**: Modified the `generateDenseEcosystemConnectivity` function to create realistic river delta flow patterns:

**Natural River Delta Connection Frequencies**:
- **Diagonal Eastward (NE, SE)**: High frequency (1.5) - strong divergent fanout flow
- **Straight East (E)**: Moderate frequency (0.6) - reduced to emphasize diagonal spread
- **North-South directions (N, S)**: Minimal frequency (0.2) - prevent dense mesh formation
- **All westward directions (W, NW, SW)**: Eliminated entirely - no upstream flow against main current

**Key Insights Learned**:
- **Excessive north-south connectivity** was creating dense mesh patterns instead of distinct channels
- **Diagonal bias over straight eastward** creates the characteristic fanout geometry
- **Minimal vertical variation** in main channels (10% vs 30%) keeps channels straighter
- **Eastward-preferring connectivity** in Step 4 avoids pure north-south connections

### Critical Requirements

**Origin Connection Rules**:
- Each ecosystem's origin (center line, westernmost point) must have exactly one eastward connection
- This eastward connection is mandatory and deterministic (not probabilistic)
- Origins can also receive bridge connections from the previous ecosystem band to the west
- Origins cannot have westward connections within their own ecosystem

**Connectivity Guarantees**:
- No disconnected subgraphs within any ecosystem
- All vertices must be connected to the main delta structure
- Use deterministic nearest-neighbor connections to ensure full connectivity

### Technical Implementation

**Refined Connection Pattern**:
```typescript
// Current: Simple eastward bias (120%) vs westward bias (80%)
const eastwardBias = 1.2;
const westwardBias = 0.8;

// New: Nuanced directional probabilities mimicking river delta behavior
const directionProbabilities = {
  // Eastward directions - high frequency (main flow)
  [1, 0]:   1.2,  // E - primary flow direction
  [1, 1]:   1.1,  // NE - strong eastward component
  [1, -1]:  1.1,  // SE - strong eastward component

  // Neutral directions - normal frequency (perpendicular branching)
  [0, 1]:   1.0,  // N - perpendicular to main flow
  [0, -1]:  1.0,  // S - perpendicular to main flow

  // All westward directions - eliminated (no upstream flow)
  [-1, 1]:  0.0,  // NW - completely blocked
  [-1, -1]: 0.0,  // SW - completely blocked
  [-1, 0]:  0.0   // W - completely blocked
};
```

**Benefits of Natural River Delta Flow**:
- **Realistic Flow Patterns**: Each ecosystem flows like a natural river delta
- **Logical Progression**: Movement within ecosystems follows natural water flow patterns
- **Maintained Connectivity**: Dense mesh still provides rich local exploration
- **Preserved Bridges**: Inter-ecosystem connections remain unchanged
- **Unidirectional Flow**: Pure eastward progression with no upstream movement

### What We Want to Achieve

1. **Natural River Delta Behavior**: Each ecosystem flows eastward with realistic tributary patterns
2. **Target Connection Density**: Aim for ~2-3 connections per vertex (reduced from current 2-5)
3. **Mandatory Origin Eastward Connection**: Each ecosystem origin must have exactly one connection (not probabilistic) that points `east`.
4. **No Disconnected Subgraphs**: Guarantee all vertices are connected to the delta structure
5. **Preserved Bridges**: Keep the current inter-ecosystem bridge system unchanged
6. **Single Connected Component**: Ensure the entire world remains fully connected
7. **Unidirectional Flow**: Eliminate all upstream flow for pure eastward river delta progression

### Current Code Location

The change needs to be made in `worldgen/src/worldgen/river-delta.ts` in the `generateDenseEcosystemConnectivity` function around lines 100-130, where the directional bias is currently implemented.

## Implementation Notes

- **Preserve existing bridge system**: Inter-ecosystem connections should remain unchanged
- **Maintain connectivity**: Ensure the new flow patterns don't create isolated vertices
- **Natural variation**: Allow some randomness in connection patterns while maintaining directional bias
- **Testing**: Verify that all ecosystems remain internally connected with the new flow patterns
