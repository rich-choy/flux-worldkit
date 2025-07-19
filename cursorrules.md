# Worldgen MUD Room Generation System

You are working on a **terrain-driven world generation system** for a MUD (Multi-User Dungeon) that creates connected graph networks representing game worlds with realistic spatial dimensions and ecosystem transitions.

## System Overview

This TypeScript/React system generates worlds by:

1. **Creating ecosystem bands** - 5 equal west-to-east bands (Steppe → Grassland → Forest → Mountain → Jungle)
2. **Generating continuous river flow** - Single connected graph flowing west-to-east through all ecosystems
3. **Applying ecosystem dithering** - bleeding between adjacent ecosystems for natural transitions (Golden Ratio)
4. **Exporting to JSONL** - Game-compatible Place objects with weather data from ecological profiles

## Core Architecture

### Types and URNs
- **ONLY use `EcosystemURN`** from `@flux` package (format: `flux:eco:${biome}:${climate}`)
- **ELIMINATE all `EcosystemType`** - use URNs throughout the codebase
- All coordinates use grid-aligned positions (45-degree multiples only)
- Deterministic generation with seeded randomness
- Pure functions with dependency injection

### Ecosystem URNs (Complete Set)
```typescript
const ECOSYSTEM_URNS = [
  'flux:eco:steppe:arid',
  'flux:eco:grassland:temperate',
  'flux:eco:forest:temperate',
  'flux:eco:mountain:arid',
  'flux:eco:jungle:tropical',
  'flux:eco:marsh:tropical'
] as const satisfies EcosystemURN[];
```

### Key Interfaces
```typescript
interface WorldVertex {
  id: string;
  x: number; y: number;
  gridX: number; gridY: number;
  ecosystem: EcosystemURN; // Always URN, never string
  isOrigin: boolean;
  connections: string[];
}

interface EcosystemBand {
  ecosystem: EcosystemURN; // Always URN
  startX: number; endX: number;
  // ... other properties
}
```

### Weather Generation (Simplified)
- Import `ECOLOGICAL_PROFILES` from `@flux` package
- Use **midpoint values** from ecological profile ranges
- No complex weather physics - just pick middle of temperature/pressure/humidity ranges
- Example: `temperature: [15.0, 35.0]` → use `25.0`

## Development Rules

### Code Quality
- **Pure functions only** - No side effects, deterministic outputs
- **Type safety** - Strict TypeScript, proper imports from `@flux`
- **Grid alignment** - All connections at 45-degree multiples (8-directional movement)
- **Connected graphs** - Single connected component, no isolated vertices
- **Seeded randomness** - Inject RNG functions as parameters

### Ecosystem Logic
- **50% bleeding** - Adjacent ecosystems penetrate 50% into neighboring bands
- **Minimal pure zones** - Only center columns remain purely one ecosystem
- **Natural transitions** - Gaussian probability distribution for ecosystem assignment
- **Target connectivity** - Varying connection density per ecosystem type

### Export Requirements
- **JSONL format** - Each line is a valid Place object
- **Simplified weather** - Use midpoint of `ECOLOGICAL_PROFILES` ranges
- **URN generation** - Place URNs derived from ecosystem biomes: `flux:place:${biome}:${x}:${y}`
- **Browser download** - UI integration with download button

## Common Tasks

### Refactoring from EcosystemType to EcosystemURN
1. **Remove all EcosystemType definitions** - eliminate the union type completely
2. **Replace with EcosystemURN imports** from `@flux` package
3. **Update all interfaces** to use EcosystemURN instead of EcosystemType
4. **Convert hardcoded strings** like `'steppe'` to `'flux:eco:steppe:arid'`
5. **Fix Record types** from `Record<EcosystemType, X>` to `Record<EcosystemURN, X>`

### Debugging Generation Issues
1. Verify grid alignment (45-degree multiples only)
2. Check connectivity (single connected component)
3. Validate ecosystem distribution (50% bleeding)
4. Test export format (valid JSONL)

### Performance Optimization
1. Use efficient graph algorithms
2. Minimize React re-renders during generation
3. Stream large world exports
4. Cache ecosystem calculations

## Error Patterns to Avoid

- ❌ Using EcosystemType anywhere in the codebase
- ❌ String literals like `'steppe'` instead of URNs
- ❌ Non-grid-aligned connections (arbitrary angles)
- ❌ Disconnected graph components
- ❌ Missing dependency injection for randomness
- ❌ Complex weather calculations instead of simple midpoints
- ❌ Missing type imports from `@flux` package

## Success Criteria

- ✅ **Zero references to EcosystemType** - completely eliminated
- ✅ All ecosystem references use proper URN format
- ✅ Generated graphs are fully connected
- ✅ Ecosystem bleeding creates natural transitions
- ✅ JSONL export produces valid Place objects with midpoint weather
- ✅ UI visualization works smoothly
- ✅ All tests pass with deterministic results

## Implementation Priority

1. **Remove EcosystemType** from types.ts completely
2. **Update all interfaces** to use EcosystemURN
3. **Fix generator.ts** to use URNs throughout
4. **Update export.ts** to import ECOLOGICAL_PROFILES from @flux
5. **Replace all hardcoded ecosystem strings** with URNs
6. **Test and validate** the complete refactoring

Focus on **complete URN adoption**, **simplified weather generation**, and **elimination of legacy EcosystemType** for a clean, maintainable codebase that integrates seamlessly with the MUD game system.
