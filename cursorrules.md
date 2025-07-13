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

**Interactive Hover Tooltip - Read Mode:**
```
┌─────────────────────────────────────┐
│ Vertex Details                  [✎] │ ← Edit button (pencil icon)
├─────────────────────────────────────┤
│ ID: grassland-delta-001             │
│ Name: Rolling Prairie Hills         │
│ Description: A vast expanse of...   │
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
└─────────────────────────────────────┘
```

**Interactive Hover Tooltip - Edit Mode:**
```
┌─────────────────────────────────────┐
│ Editing Vertex Details              │
├─────────────────────────────────────┤
│ ID: grassland-delta-001             │
│ Name: [Rolling Prairie Hills    ]   │ ← Text input (auto-focused)
│ Description: ┌─────────────────────┐ │
│              │A vast expanse of... │ │ ← Textarea
│              │grassland stretching │ │
│              │to the horizon       │ │
│              └─────────────────────┘ │
│ Ecosystem: Grassland                │
│ Position: (245, 180)                │
│ Grid: (12, 9)                       │
│                                     │
│ Exits: (read-only in edit mode)     │
│ • North → forest-delta-023          │
│ • East → grassland-delta-002        │
│                                     │
│           [Save] [Cancel]           │
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
- **Modal Edit Mode**: Click edit button (pencil icon) to enter dedicated editing mode
- **Locked Tooltip**: Tooltip stays open during editing (doesn't disappear on mouse leave)
- **Name Editing**: Single-line text input with auto-focus
- **Description Editing**: Multi-line textarea with reasonable character limits
- **Explicit Save**: User must click Save button to commit changes
- **Cancel Option**: ESC key or Cancel button reverts to original values
- **Immediate Updates**: Saved changes reflect in the tooltip and world state
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

**3. Modal Editing Functionality:**
- **Edit Mode Toggle**: Click pencil icon in tooltip header
- **Tooltip Locking**: Prevent tooltip from closing during edit mode
- **Form Fields**: Text input for name, textarea for description
- **Validation**: Real-time feedback, prevent empty names
- **Save/Cancel**: Explicit buttons with clear actions
- **State Management**: Update Place objects in world state
- **Keyboard Navigation**: Tab order: Name → Description → Save → Cancel

**4. Tooltip Rendering:**
- Positioned near cursor but within viewport bounds
- Styled to match application theme
- Readable typography and spacing
- Responsive to different screen sizes
- Expandable for edit mode (larger textarea)

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
│   ├── ReadMode (display info + edit button)
│   ├── EditMode (form fields + save/cancel)
│   └── Tooltip positioning logic
└── Place state management (new)
```

**User Experience Flow:**
1. **Hover** → Tooltip appears with pencil icon in header
2. **Click Edit Button** → Tooltip transforms to edit mode:
   - Name becomes text input (auto-focused)
   - Description becomes textarea
   - Save/Cancel buttons appear
   - Tooltip locks in place (doesn't disappear on mouse leave)
3. **Edit Fields** → User can Tab between fields, type freely
4. **Save** → Brief success animation, return to read mode, changes persist
5. **Cancel/Escape** → Revert to original values, return to read mode
6. **Mouse Leave** → Tooltip disappears (unless in edit mode)

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
- **Visual Cue**: Pencil icon in tooltip header (always visible)
- **Mode Transition**: Smooth transformation from read to edit mode
- **Form Fields**:
  - Name: Single-line text input, auto-focused, ~50 character limit
  - Description: Multi-line textarea, ~200 character limit
- **Action Buttons**: Save/Cancel buttons at bottom, clear hierarchy
- **Feedback**: Visual feedback on successful save (green checkmark animation)
- **Validation**: Real-time character count, empty name warnings
- **Escape Handling**: ESC key always cancels edit mode

**Interaction Model:**
- **Hover Delay**: 200ms delay before showing tooltip
- **Edit Button**: Always visible pencil icon in tooltip header
- **Modal Editing**: Click edit button → tooltip enters locked edit mode
- **Tooltip Locking**: Tooltip stays open during editing (ignores mouse leave)
- **Save/Cancel**: Explicit buttons required to exit edit mode
- **Keyboard Shortcuts**:
  - Tab navigation between fields and buttons
  - ESC key cancels edit mode
  - Enter in name field moves focus to description
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

3. **Add Modal Editing**
   - Edit button in tooltip header
   - Form fields for name and description
   - Tooltip locking mechanism
   - Save/cancel logic

4. **Data Integration**
   - Merge vertex and place data
   - Ecosystem display formatting
   - Exit information extraction
   - Place object updates

5. **Visual Polish**
   - Smooth mode transitions
   - Success animations
   - Proper z-index layering
   - Theme integration
   - Loading states

6. **Testing**
   - Different vertex types (regular, bridge, marsh)
   - Edit mode functionality
   - Keyboard navigation
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
- Very long names/descriptions (truncation in read mode)
- Empty names (prevent saving, show validation error)
- Network errors during save (retry mechanism)

### 📈 Success Criteria

**✅ Functional Requirements:**
- Hover shows detailed vertex information
- Edit button is discoverable and accessible
- Modal editing provides focused editing experience
- Ecosystem assignment is clearly displayed
- Exit information is comprehensive and readable
- Pathfinding origin is indicated when available
- Name and description editing works smoothly
- Changes persist in world state after save
- Cancel/ESC properly reverts changes

**✅ Technical Requirements:**
- Smooth hover interactions
- No performance impact on visualization
- Responsive tooltip positioning
- Efficient editing workflow
- Proper state management
- Tooltip locking works correctly
- Form validation prevents invalid data

**✅ User Experience:**
- Information is immediately understandable
- Edit button is discoverable and intuitive
- Editing feels natural and focused
- Save/cancel actions are clear and predictable
- Tooltip doesn't interfere with navigation
- Visual consistency with existing design
- Works across different devices
- Keyboard navigation is smooth and logical

The goal is to create an informative and interactive hover system that provides detailed insights into each vertex while enabling focused, intentional editing of place properties through a polished modal interface.
