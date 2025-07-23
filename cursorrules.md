# Worldgen JSONL Import/Export System

You are working on the **JSONL import/export functionality** for a MUD world generation system. The system must ensure that each place has a unique URN, as these URNs are used by the MUD server to create MUC Light rooms for spatial communication.

## Critical Requirements

### 1. **Unique Place URNs**
- Each place MUST have a unique URN
- No duplicate places are allowed in the JSONL file
- URN format must be either:
  - Origin: `flux:place:origin`
  - Regular: `flux:place:<ecosystem>:<x>:<y>`
- Coordinates in URN must match the `coordinates` array
- Validation must happen during both export and import

### 2. **MUD Server Integration**
- Each place URN maps to exactly one MUC Light room
- Duplicate URNs will cause MUC room creation failures
- The MUD server assumes URN uniqueness for room management

## Implementation Components

### 1. **Place Uniqueness Validation**
```typescript
function validatePlaceUniqueness(places: Place[]): void {
  const seenUrns = new Map<string, Place>();
  const duplicates: string[] = [];

  for (const place of places) {
    if (seenUrns.has(place.id)) {
      duplicates.push(place.id);
      const existing = seenUrns.get(place.id)!;
      console.error('Duplicate place found:', {
        urn: place.id,
        first: {
          coordinates: existing.coordinates,
          exits: Object.keys(existing.exits || {})
        },
        second: {
          coordinates: place.coordinates,
          exits: Object.keys(place.exits || {})
        }
      });
    } else {
      seenUrns.set(place.id, place);
    }
  }

  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate places found: ${duplicates.join(', ')}. ` +
      'Each place must have a unique URN for MUC room creation.'
    );
  }
}
```

### 2. **Export Validation**
```typescript
function exportWorldToJSONL(world: WorldGenerationResult): string[] {
  const places = world.vertices.map(vertexToPlace);

  // Validate before export
  validatePlaceUniqueness(places);

  return places.map(place => JSON.stringify(place));
}
```

### 3. **Import Validation**
```typescript
function parseJSONLFile(fileContent: string): Place[] {
  const lines = fileContent.trim().split('\n').filter(line => line.trim());
  const places = lines.map((line, index) => {
    try {
      return JSON.parse(line) as Place;
    } catch (error) {
      throw new Error(`Invalid JSONL line ${index + 1}: ${error.message}`);
    }
  });

  // Validate after parsing
  validatePlaceUniqueness(places);

  return places;
}
```

### 4. **Coordinate Validation**
```typescript
function validatePlaceCoordinates(place: Place): void {
  const isOrigin = place.id === 'flux:place:origin';

  if (!isOrigin) {
    const urnParts = place.id.split(':');
    if (urnParts.length !== 5) {
      throw new Error(`Invalid place URN format: ${place.id}`);
    }

    const [x, y] = place.coordinates;
    const urnX = parseInt(urnParts[3]);
    const urnY = parseInt(urnParts[4]);

    if (x !== urnX || y !== urnY) {
      throw new Error(
        `Coordinate mismatch in ${place.id}: ` +
        `URN coordinates [${urnX}, ${urnY}] ` +
        `don't match actual coordinates [${x}, ${y}]`
      );
    }
  }
}
```

## Error Messages

Provide clear error messages that help identify and fix issues:

```typescript
// Example error for duplicate places
"Duplicate places found: flux:place:mountain:21200:200. Each place must have a unique URN for MUC room creation."

// Example error for coordinate mismatch
"Coordinate mismatch in flux:place:forest:1000:2000: URN coordinates [1000, 2000] don't match actual coordinates [1000, 2500]"
```

## Testing Requirements

1. **Duplicate Detection**
   - Test with known duplicate places
   - Verify error messages are helpful
   - Check both export and import validation

2. **Coordinate Validation**
   - Test places with mismatched coordinates
   - Verify URN parsing is correct
   - Test special handling of origin place

3. **Round-trip Testing**
   - Export → Import → Export should preserve uniqueness
   - No duplicates should be created during conversion

## Success Criteria

- ✅ No duplicate places in exported JSONL
- ✅ Import fails fast on duplicate detection
- ✅ Clear error messages for fixing issues
- ✅ Coordinates always match URN values
- ✅ Origin place handled correctly
- ✅ MUD server can reliably create rooms

## Implementation Priority

1. Add uniqueness validation to both export and import
2. Add coordinate validation
3. Improve error messages
4. Add test cases for duplicates
5. Document validation requirements

Focus on preventing duplicate places to ensure reliable MUC room creation in the MUD server.
