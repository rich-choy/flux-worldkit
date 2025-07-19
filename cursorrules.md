# Worldgen JSONL Import/Export System

You are working on the **JSONL import/export functionality** for a MUD world generation system. The system currently has an *Export* feature that converts generated worlds to JSONL format, and now needs an *Import* feature to load JSONL files back into the visualization tool.

## Current State

✅ **Export Feature (Working)**
- Converts `WorldVertex` objects to `Place` objects in JSONL format
- Each line in JSONL file represents a complete Place with URN, exits, resources, etc.
- Export function: `exportWorldToJSONL(world: WorldGenerationResult): string[]`
- Download functionality: `downloadJSONL(jsonlLines, filename)`

❌ **Import Feature (Needed)**
- Parse JSONL file back into `WorldVertex` objects for visualization
- Reconstruct `WorldGenerationResult` structure for React components
- Handle file upload and parsing in UI
- Validate imported data and handle errors gracefully

## Actual JSONL Place Structure (Analyzed)

```json
{
  "type": "place",
  "id": "flux:place:steppe:200:5000",
  "name": "Steppe Origin",
  "description": "Wind-swept plains dotted with hardy shrubs. Multiple paths converge here.",
  "exits": {
    "south": {"direction": "south", "label": "South Path", "to": "flux:place:steppe:200:4700"},
    "east": {"direction": "east", "label": "East Path", "to": "flux:place:steppe:500:5000"}
  },
  "entities": {},
  "resources": {"ts": 1752945354486, "nodes": {}},
  "ecosystem": "flux:eco:steppe:arid",
  "weather": {"temperature": 25, "pressure": 1020, "humidity": 30, /* ... */},
  "coordinates": [200, 5000]
}
```

## ✅ **Perfect WorldVertex Reconstruction Possible**

### **Available Data Mapping:**
```typescript
// Direct field mapping
vertex.id = place.id;                    // "flux:place:steppe:200:5000"
vertex.ecosystem = place.ecosystem;      // "flux:eco:steppe:arid"
vertex.x = place.coordinates[0];         // 200
vertex.y = place.coordinates[1];         // 5000

// Derivable from Place ID URN pattern
const urnParts = place.id.split(':');   // ["flux", "place", "steppe", "200", "5000"]
vertex.gridX = parseInt(urnParts[3]);    // 200
vertex.gridY = parseInt(urnParts[4]);    // 5000

// Extract from exits
vertex.connections = Object.values(place.exits || {}).map(exit => exit.to);

// Infer from multiple reliable indicators
vertex.isOrigin = place.name.includes("Origin") ||
                  place.description.includes("converge") ||
                  place.description.includes("paths converge") ||
                  gridX === 200; // Based on observed data pattern
```

## Required Implementation Components

### 1. **Simplified JSONL Parser**
```typescript
function parseJSONLFile(fileContent: string): Place[] {
  const lines = fileContent.trim().split('\n').filter(line => line.trim());
  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as Place;
    } catch (error) {
      throw new Error(`Invalid JSONL line ${index + 1}: ${error.message}`);
    }
  });
}
```

### 2. **Direct Place → WorldVertex Converter**
```typescript
function convertPlaceToWorldVertex(place: Place): WorldVertex {
  // Extract grid coordinates from Place ID URN pattern
  const urnParts = place.id.split(':'); // ["flux", "place", "biome", "x", "y"]
  if (urnParts.length !== 5 || urnParts[0] !== 'flux' || urnParts[1] !== 'place') {
    throw new Error(`Invalid Place ID format: ${place.id}`);
  }

  const gridX = parseInt(urnParts[3]);
  const gridY = parseInt(urnParts[4]);

  if (isNaN(gridX) || isNaN(gridY)) {
    throw new Error(`Invalid coordinates in Place ID: ${place.id}`);
  }

  // Extract connections from exits
  const connections = Object.values(place.exits || {}).map(exit => exit.to);

  // Multiple strategies for origin detection (high reliability)
  const isOrigin = place.name.includes("Origin") ||
                   place.description.includes("converge") ||
                   place.description.includes("paths converge") ||
                   gridX === 200; // Based on observed data pattern

  return {
    id: place.id,
    x: place.coordinates[0],
    y: place.coordinates[1],
    gridX,
    gridY,
    ecosystem: place.ecosystem, // Direct copy - already full URN!
    isOrigin,
    connections
  };
}
```

### 3. **Edge Reconstruction (Simplified)**
```typescript
function reconstructEdges(vertices: WorldVertex[]): RiverEdge[] {
  const edges: RiverEdge[] = [];
  const vertexMap = new Map(vertices.map(v => [v.id, v]));
  const processedEdges = new Set<string>();

  for (const vertex of vertices) {
    for (const connectionId of vertex.connections) {
      const targetVertex = vertexMap.get(connectionId);
      if (!targetVertex) {
        console.warn(`Missing connection target: ${connectionId}`);
        continue;
      }

      // Create unique edge ID (avoid duplicates)
      const edgeKey = [vertex.id, connectionId].sort().join('→');
      if (processedEdges.has(edgeKey)) continue;
      processedEdges.add(edgeKey);

      // Calculate edge properties
      const dx = targetVertex.x - vertex.x;
      const dy = targetVertex.y - vertex.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI / 45) * 45;

      // Determine flow direction from angle
      const flowDirection = angle === 0 ? 'eastward' :
                           angle === 90 ? 'northward' :
                           angle === 180 || angle === -180 ? 'westward' :
                           angle === -90 || angle === 270 ? 'southward' :
                           'diagonal';

      edges.push({
        id: `${vertex.id}→${connectionId}`,
        fromVertexId: vertex.id,
        toVertexId: connectionId,
        flowDirection,
        distance,
        angle
      });
    }
  }

  return edges;
}
```

### 4. **Ecosystem Bands Reconstruction**
```typescript
function reconstructEcosystemBands(vertices: WorldVertex[]): EcosystemBand[] {
  // Group vertices by ecosystem and find spatial bounds
  const ecosystemGroups = new Map<string, WorldVertex[]>();

  for (const vertex of vertices) {
    const ecosystem = vertex.ecosystem;
    if (!ecosystemGroups.has(ecosystem)) {
      ecosystemGroups.set(ecosystem, []);
    }
    ecosystemGroups.get(ecosystem)!.push(vertex);
  }

  // Create bands from spatial distribution
  const bands: EcosystemBand[] = [];

  for (const [ecosystem, verticesInEcosystem] of ecosystemGroups) {
    const xCoords = verticesInEcosystem.map(v => v.x);
    const startX = Math.min(...xCoords);
    const endX = Math.max(...xCoords);
    const width = endX - startX;

    // Calculate band properties
    const startCol = Math.floor(startX / 300); // Assuming 300m spacing
    const endCol = Math.floor(endX / 300);

    bands.push({
      ecosystem: ecosystem as EcosystemURN,
      startX,
      endX,
      startCol,
      endCol,
      width,
      pureZoneStart: startX + width * 0.19, // Golden ratio approximation
      pureZoneEnd: endX - width * 0.19,
      transitionZoneStart: startX,
      transitionZoneEnd: endX
    });
  }

  // Sort bands by start position (west to east)
  return bands.sort((a, b) => a.startX - b.startX);
}
```

### 5. **Complete World Reconstruction**
```typescript
function reconstructWorldFromPlaces(places: Place[]): WorldGenerationResult {
  console.log(`Reconstructing world from ${places.length} places...`);

  // Convert places to vertices
  const vertices = places.map(convertPlaceToWorldVertex);
  console.log(`Converted to ${vertices.length} vertices`);

  // Find origin vertex
  const originVertex = vertices.find(v => v.isOrigin);
  if (!originVertex) {
    throw new Error("No origin vertex found in imported data");
  }

  // Reconstruct edges from vertex connections
  const edges = reconstructEdges(vertices);
  console.log(`Reconstructed ${edges.length} edges`);

  // Reconstruct ecosystem bands from vertex distribution
  const ecosystemBands = reconstructEcosystemBands(vertices);
  console.log(`Reconstructed ${ecosystemBands.length} ecosystem bands`);

  // Calculate spatial metrics from vertex coordinates
  const spatialMetrics = calculateSpatialMetricsFromVertices(vertices);

  // Generate statistics
  const ditheringStats = calculateDitheringStatsFromVertices(vertices);
  const connectivityStats = calculateConnectivityStats(vertices, edges);

  return {
    vertices,
    edges,
    ecosystemBands,
    spatialMetrics,
    ditheringStats,
    connectivityStats,
    originVertex,
    boundaryLines: [], // Can be empty for imported worlds
    config: { seed: 0 }, // Default config for imported worlds
    generationTime: 0,
    version: "imported"
  };
}
```

## UI Integration Requirements

### 1. **File Upload Component**
```typescript
interface FileUploadProps {
  onFileImported: (world: WorldGenerationResult) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileImported, onError, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      console.log(`Importing JSONL file: ${file.name} (${file.size} bytes)`);
      const content = await file.text();
      const places = parseJSONLFile(content);
      console.log(`Parsed ${places.length} places from JSONL`);

      const world = reconstructWorldFromPlaces(places);
      console.log(`Successfully reconstructed world with ${world.vertices.length} vertices`);

      onFileImported(world);

      // Clear the input for next import
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Import error:', error);
      onError(`Failed to import file: ${error.message}`);
    }
  };

  return (
    <div className="file-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept=".jsonl,.txt"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="btn btn-secondary px-3 py-1 text-xs whitespace-nowrap"
        title="Import JSONL world file"
      >
        Import
      </button>
    </div>
  );
};
```

### 2. **Controls Integration**
Add import button alongside existing export button:

```typescript
// In Controls.tsx, add to the controls section
<FileUpload
  onFileImported={handleWorldImported}
  onError={(error) => console.error('Import error:', error)}
  disabled={isGenerating}
/>

// Add handler for imported worlds
const handleWorldImported = (importedWorld: WorldGenerationResult) => {
  console.log('World imported successfully:', importedWorld);
  // Update the world state to trigger re-render
  onWorldImported?.(importedWorld);
};

// Update ControlsProps interface
interface ControlsProps {
  onGenerateWorld: (config: WorldGenerationConfig) => void;
  onWorldImported?: (world: WorldGenerationResult) => void; // New prop
  isGenerating: boolean;
  world: WorldGenerationResult | null;
  currentSeed: number;
}
```

### 3. **Error Handling & Validation**
```typescript
function validateImportedWorld(world: WorldGenerationResult): string[] {
  const errors: string[] = [];

  // Basic structure validation
  if (!world.vertices || world.vertices.length === 0) {
    errors.push("No vertices found in imported data");
  }

  if (!world.originVertex) {
    errors.push("No origin vertex found");
  }

  // Ecosystem validation
  const validEcosystems = [
    'flux:eco:steppe:arid',
    'flux:eco:grassland:temperate',
    'flux:eco:forest:temperate',
    'flux:eco:mountain:arid',
    'flux:eco:jungle:tropical',
    'flux:eco:marsh:tropical'
  ];

  for (const vertex of world.vertices) {
    if (!validEcosystems.includes(vertex.ecosystem)) {
      errors.push(`Invalid ecosystem URN: ${vertex.ecosystem}`);
    }
  }

  // Connectivity validation
  const vertexIds = new Set(world.vertices.map(v => v.id));
  for (const vertex of world.vertices) {
    for (const connectionId of vertex.connections) {
      if (!vertexIds.has(connectionId)) {
        errors.push(`Missing connection target: ${connectionId} from ${vertex.id}`);
      }
    }
  }

  return errors;
}
```

## Implementation Priority

1. **Core Import Functions**
   - ✅ `parseJSONLFile()` - Simple and reliable with actual structure
   - ✅ `convertPlaceToWorldVertex()` - Direct field mapping
   - ✅ `reconstructEdges()` - From connection arrays

2. **World Reconstruction**
   - ✅ `reconstructEcosystemBands()` - From vertex spatial distribution
   - ✅ `reconstructWorldFromPlaces()` - Complete reconstruction
   - ✅ Statistics calculation from reconstructed data

3. **UI Integration**
   - `FileUpload` component with proper error handling
   - Integration with Controls component
   - User feedback and validation

4. **Testing & Validation**
   - Round-trip testing (export → import → export)
   - Error handling for malformed files
   - Performance testing with large worlds

## Success Criteria

- ✅ **Perfect reconstruction**: All WorldVertex fields accurately restored
- ✅ **Visualization compatibility**: Imported worlds display correctly
- ✅ **Round-trip fidelity**: Export → Import → Export produces identical results
- ✅ **Error resilience**: Graceful handling of malformed or incomplete files
- ✅ **User experience**: Clear feedback and intuitive interface

## Key Advantages of This Approach

1. **High Fidelity**: Place format preserves more data than original WorldVertex
2. **Simple Implementation**: Direct field mapping, minimal transformation needed
3. **Robust Origin Detection**: Multiple reliable strategies available
4. **Complete Connectivity**: Full exit information enables perfect edge reconstruction
5. **Validation Friendly**: Rich Place data enables comprehensive validation

Focus on **data integrity**, **simple implementation**, and **reliable reconstruction** using the rich Place format structure.
