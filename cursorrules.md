# Prompt: World Graph Visualization - Interactive Vertex Tooltips & Editing

I am implementing interactive hover tooltips for vertices in the world graph visualization that provide detailed information and allow editing of place properties.

## Prompt Evolution

**This prompt will be updated as we discover new insights and requirements during implementation.** The problem space is emergent - as we build the feature, we'll learn more about the data relationships, user needs, and technical constraints. The prompt will be kept current to reflect our evolving understanding.

## Current Status: Basic Visualization

### ✅ Current Implementation

**Visualization Components:**
- `Canvas.tsx`: Main canvas component that renders the world graph
- `Viewport.tsx`: Handles zooming and panning
- `ZoomPanControls.tsx`: UI controls for navigation
- **Current Features**: Basic vertex and connection rendering with visual highlighting for bridge nodes

**Data Structure:**
- `WorldVertex`: Contains `id`, `x`, `y`, `gridX`, `gridY`, `ecosystem`, `placeId`
- `Place`: Contains `id`, `name`, `description`, `exits`, `ecology.ecosystem`
- **Relationship**: `WorldVertex.placeId` → `Place.id` (vertex references a place)
- **Bridge Highlighting**: Inter-ecosystem bridges are visually prominent (large, colored vertices)
- **Ecosystem Bands**: Vertices are assigned to ecosystem bands (grassland, forest, mountain, jungle, marsh)

**Special Cases:**
- **Marsh Vertices**: Have `ecosystem: EcosystemName.MARSH_TROPICAL` but exist within jungle boundaries
- **Bridge Vertices**: Created by `connectDisconnectedSubgraphs` for internal connectivity (IDs start with 'bridge-')
- **Inter-ecosystem Bridges**: Regular vertices that connect different ecosystem bands

### 🚨 **Current Limitation: No Vertex Interaction**

**Missing Functionality:**
- No way to inspect individual vertices
- No visibility into vertex properties
- No indication of pathfinding origins
- No exit information displayed
- No way to customize place names or descriptions

## Goal: Interactive Vertex Tooltips with Editing

### 🎯 Target Feature

**Interactive Hover Tooltip:**
```
┌─────────────────────────────────────┐
│ Vertex Details                  [✎] │
├─────────────────────────────────────┤
│ ID: grassland-delta-001             │
│ Name: [Rolling Prairie Hills    ]   │ ← Editable
│ Description: [A vast expanse of...] │ ← Editable
│ Ecosystem: Grassland                │
│ Position: (245, 180)                │
│ Grid: (12, 9)                       │
│                                     │
│ Exits:                              │
│ • North → forest-delta-023          │
│ • East → grassland-delta-002        │
│ • South → bridge-grassland-forest   │
│                                     │
│ Created by: Grid-aligned pathfinding │
│                                     │
│ [Save] [Cancel]                     │
└─────────────────────────────────────┘
```

**Information to Display:**
1. **Vertex Identity**: ID, editable name
2. **Place Properties**: Editable description
3. **Ecosystem Assignment**:
   - Normal case: Ecosystem band the vertex lives in
   - Special case: Marsh vertices show "Marsh (within Jungle)"
4. **Spatial Information**: World coordinates (x, y) and grid coordinates (gridX, gridY)
5. **Connectivity**: List of exits with directions and destination IDs
6. **Origin Context**: Whether created by grid-aligned DFS pathfinding (if determinable)

**Editing Capabilities:**
- **Name Editing**: Click to edit the place name (inline text input)
- **Description Editing**: Click to edit the place description (textarea)
- **Immediate Updates**: Changes reflect in the tooltip and world state
- **No Persistence Tracking**: Don't distinguish between generated vs user content

### 🔧 Implementation Requirements

**1. Hover Detection:**
- Mouse enter/leave events on vertex elements
- Proper coordinate transformation (screen space → world space)
- Debounced hover to prevent flickering
- Touch support for mobile devices

**2. Data Enrichment:**
- Merge `WorldVertex` data with corresponding `Place` data
- Access to exits information from Place objects
- Ecosystem display logic (handle marsh special case)
- Pathfinding origin detection (if context available)

**3. Editing Functionality:**
- **Edit Mode Toggle**: Click edit button or double-click fields
- **Inline Editing**: Text inputs for name, textarea for description
- **Save/Cancel**: Commit or discard changes
- **State Management**: Update Place objects in world state
- **Validation**: Ensure names aren't empty, reasonable length limits

**4. Tooltip Rendering:**
- Positioned near cursor but within viewport bounds
- Styled to match application theme
- Readable typography and spacing
- Responsive to different screen sizes
- Expandable for edit mode

**5. Performance Considerations:**
- Lightweight hover detection
- Efficient data lookups
- Smooth animations
- No impact on zoom/pan performance
- Efficient re-rendering on edits

### 🧩 Technical Architecture

**Component Structure:**
```
Canvas.tsx
├── Vertex rendering (existing)
├── Hover detection (new)
├── VertexTooltip component (new)
│   ├── ReadMode (display info)
│   ├── EditMode (editable fields)
│   └── Tooltip positioning logic
└── Place state management (new)
```

**Data Flow:**
1. Mouse enters vertex → Identify vertex from coordinates
2. Look up vertex data from `WorldVertex[]` array
3. Find corresponding `Place` object using `vertex.placeId`
4. Determine ecosystem display string
5. Check for pathfinding origin indicators
6. Render tooltip with formatted information
7. **Edit Mode**: Allow modification of `place.name` and `place.description`
8. **Save Changes**: Update Place object in world state

**State Management:**
- `hoveredVertex: WorldVertex | null` - Currently hovered vertex
- `hoveredPlace: Place | null` - Corresponding place data
- `tooltipPosition: {x: number, y: number}` - Tooltip screen coordinates
- `isEditing: boolean` - Whether tooltip is in edit mode
- `editedName: string` - Temporary name during editing
- `editedDescription: string` - Temporary description during editing

### 📊 Data Processing

**Place Data Lookup:**
```typescript
function getPlaceData(vertex: WorldVertex, places: Place[]): Place | null {
  return places.find(p => p.id === vertex.placeId) || null;
}
```

**Ecosystem Display Logic:**
```typescript
function getEcosystemDisplay(vertex: WorldVertex): string {
  if (vertex.ecosystem === EcosystemName.MARSH_TROPICAL) {
    return "Marsh (within Jungle)";
  }
  return vertex.ecosystem.split(':')[2]; // Extract ecosystem name
}
```

**Exit Information:**
```typescript
function getExitInfo(place: Place, places: Place[]): ExitInfo[] {
  if (!place?.exits) return [];

  return Object.entries(place.exits).map(([direction, exit]) => ({
    direction,
    destinationId: exit.to,
    destinationName: places.find(p => p.id === exit.to)?.name
  }));
}
```

**Place Updates:**
```typescript
function updatePlace(placeId: string, updates: {name?: string, description?: string}) {
  // Update the Place object in the world state
  // This will reflect immediately in the visualization
}
```

### 🎨 UI/UX Considerations

**Tooltip Design:**
- **Background**: Semi-transparent dark background
- **Typography**: Monospace font for IDs, readable font for text
- **Colors**: Ecosystem-appropriate color coding
- **Animation**: Smooth fade-in/out transitions
- **Positioning**: Smart placement to avoid viewport edges

**Edit Mode Design:**
- **Visual Cue**: Edit button (pencil icon) in tooltip header
- **Inline Fields**: Text input for name, textarea for description
- **Action Buttons**: Save/Cancel buttons at bottom
- **Feedback**: Visual feedback on successful save
- **Escape Handling**: ESC key cancels edit mode

**Interaction Model:**
- **Hover Delay**: 200ms delay before showing tooltip
- **Hover Exit**: Immediate hide on mouse leave (unless editing)
- **Edit Mode**: Tooltip stays open during editing
- **Zoom Behavior**: Tooltip hides during zoom/pan operations
- **Bridge Vertices**: Special styling for bridge vertex tooltips

### 🚀 Implementation Steps

1. **Add Hover Detection**
   - Mouse event handlers on vertex elements
   - Coordinate transformation utilities
   - Hover state management

2. **Create Tooltip Component**
   - `VertexTooltip.tsx` component with read/edit modes
   - Tooltip positioning logic
   - Responsive styling

3. **Data Integration**
   - Merge vertex and place data
   - Ecosystem display formatting
   - Exit information extraction

4. **Add Editing Functionality**
   - Edit mode toggle
   - Inline form fields
   - Save/cancel logic
   - State updates

5. **Visual Polish**
   - Smooth animations
   - Proper z-index layering
   - Theme integration
   - Loading states

6. **Testing**
   - Different vertex types (regular, bridge, marsh)
   - Edit mode functionality
   - Various screen sizes
   - Performance under different zoom levels

### 🔍 Special Cases to Handle

**Bridge Vertices:**
- Show "Bridge Vertex" in tooltip header
- Indicate it's for internal connectivity
- Highlight that it connects disconnected subgraphs
- Allow editing of bridge vertex names/descriptions

**Marsh Vertices:**
- Display "Marsh (within Jungle)" for ecosystem
- Explain the special positioning
- Full editing capabilities

**Inter-ecosystem Bridges:**
- Highlight that these connect different ecosystem bands
- Show both source and destination ecosystems
- Full editing capabilities

**Edge Cases:**
- Vertices with no exits
- Vertices with missing place data
- Vertices at viewport boundaries
- Very long names/descriptions
- Empty names (require validation)

### 📈 Success Criteria

**✅ Functional Requirements:**
- Hover shows detailed vertex information
- Ecosystem assignment is clearly displayed
- Exit information is comprehensive and readable
- Pathfinding origin is indicated when available
- Name and description editing works smoothly
- Changes persist in world state

**✅ Technical Requirements:**
- Smooth hover interactions
- No performance impact on visualization
- Responsive tooltip positioning
- Efficient editing workflow
- Proper state management

**✅ User Experience:**
- Information is immediately understandable
- Editing feels natural and intuitive
- Tooltip doesn't interfere with navigation
- Visual consistency with existing design
- Works across different devices

The goal is to create an informative and interactive hover system that provides detailed insights into each vertex while enabling quick customization of place properties, turning the visualization into a world-building tool.
