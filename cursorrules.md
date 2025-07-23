# FSP: PlaceGraph Spatial Indexing and Connectivity Rules

## 🎯 **Core Principles**

1. **Grid-Based Spacing**
   - Each place occupies a square grid cell of size `placeSpacing × placeSpacing`
   - Places can connect to neighbors within a radius of `placeSpacing * 2 * √2`
   - This allows connections up to 2 grid cells away in any direction

2. **Ecosystem-Specific Connectivity**
   - Mountains prefer vertical (N/S) connections
   - Other ecosystems prefer horizontal (E/W) connections
   - Target connectivity varies by ecosystem:
     - Steppe/Grassland: 3.0 (high connectivity for open terrain)
     - Forest: 2.0 (moderate connectivity)
     - Mountain/Jungle: 1.5 (lower connectivity due to terrain)
     - Marsh: 1.0 (lowest connectivity due to water barriers)

3. **Connection Rules**
   - Connections must be at 45-degree angles (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
   - Distance is calculated using Euclidean distance
   - Prefer closer neighbors when multiple options exist
   - Never remove existing connections, only add new ones

## 🔬 **Implementation Details**

### Connection Process
1. Sort ecosystems by target connectivity (highest first)
2. For each ecosystem:
   - Find vertices with fewest connections
   - Look for neighbors within expanded radius
   - Prefer ecosystem-specific directions
   - Add connections until target connectivity reached

### Distance Calculations
```typescript
const maxRadius = gridSize * 2 * Math.sqrt(2);
const distance = Math.sqrt(dx * dx + dy * dy);
const angle = Math.atan2(dy, dx) * (180 / Math.PI);
```

### Direction Preferences
```typescript
// Mountains prefer vertical connections
const mountainDirections = [Direction.NORTH, Direction.SOUTH];

// Other ecosystems prefer horizontal connections
const defaultDirections = [Direction.EAST, Direction.WEST];

// Fall back to diagonals if preferred directions unavailable
const diagonalDirections = [
  Direction.NORTHEAST,
  Direction.SOUTHEAST,
  Direction.SOUTHWEST,
  Direction.NORTHWEST
];
```

## 🎯 **Validation Criteria**

1. **Connectivity Targets**
   - Each ecosystem should reach its target connectivity
   - Or get as close as possible within distance constraints

2. **Direction Preferences**
   - Mountain regions should show predominantly N/S connections
   - Other regions should show predominantly E/W connections
   - Diagonal connections should only appear when necessary

3. **Distance Constraints**
   - No connections beyond `gridSize * 2 * √2`
   - Prefer closer neighbors over distant ones
   - All angles must be multiples of 45 degrees

4. **Graph Properties**
   - Graph should remain connected
   - No duplicate connections
   - No self-connections
   - Bidirectional connections only

## 🔄 **Integration with Weather System**

The expanded connection radius ensures:
1. Mountains can influence places up to 2 grid cells away
2. Weather effects can propagate through the graph naturally
3. No artificial barriers created by too-strict connectivity rules

This implementation balances:
- Natural terrain-based connectivity patterns
- Sufficient graph density for weather propagation
- Geometric constraints for clean visualization
- Performance considerations in pathfinding
