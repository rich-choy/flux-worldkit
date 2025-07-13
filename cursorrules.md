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

**Bridge Creation System**:
- ✅ **Bridge Policy**: `bridge-policy.ts` with `createBridge()` function that can create cross-ecosystem bridges
- ✅ **Bridge Generation**: Inter-ecosystem bridges are created with `allowCrossEcosystem: true` in the generator
- ✅ **Bridge Vertices**: Intermediate bridge vertices with `bridge-` prefixed IDs are properly generated
- ❌ **Critical Safeguard Issue**: `addExitsToPlaces()` has "STRICT ECOSYSTEM BOUNDARY ENFORCEMENT" that blocks bridge connections

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

## The Current Problem

### Root Cause: Safeguard in `addExitsToPlaces`

The issue is in `river-delta.ts` lines 443-463. The `addExitsToPlaces` function has a **"STRICT ECOSYSTEM BOUNDARY ENFORCEMENT"** safeguard that:

- ✅ **Allows**: Same-ecosystem connections
- ✅ **Allows**: Jungle ↔ Marsh connections only
- ❌ **BLOCKS**: All other cross-ecosystem connections (including legitimate bridge connections)

This means:
1. Bridge vertices and connections are created successfully
2. But when converting connections to place exits, the safeguard blocks them
3. Result: Bridges exist but are not traversable

### What We Need to Fix

**Update the safeguard** in `addExitsToPlaces` to allow legitimate bridge connections:
- Bridge vertices (those with `id.startsWith('bridge-')`)
- Connections that are part of the authorized inter-ecosystem bridge system
- Maintain protection against unauthorized cross-ecosystem connections

## What We Want to Achieve

### Primary Goal: Single Connected Component
- **Full World Connectivity**: Every place must be reachable from every other place
- **No Orphaned Subgraphs**: Zero isolated components or floating nodes
- **Guaranteed Traversal**: West-to-east journey possible across all ecosystem boundaries via bridges
- **Dense Local Connectivity**: 2-5 connections per vertex for rich exploration within ecosystems

### Bridge Connection Solution
**Modify the safeguard in `addExitsToPlaces` to allow:**
1. **Bridge Vertex Connections**: Any connection involving vertices with `id.startsWith('bridge-')`
2. **Authorized Cross-Ecosystem Bridges**: Connections between ecosystem origins and easternmost nodes
3. **Existing Jungle-Marsh Connections**: Preserve current jungle↔marsh allowance
4. **Block Unauthorized Connections**: Maintain protection against random cross-ecosystem connections

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
- **Bridge Safeguard Fix**: Update `addExitsToPlaces` to allow legitimate bridge connections while blocking unauthorized ones
