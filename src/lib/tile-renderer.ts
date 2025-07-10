// Tile rendering system for roguelike/JRPG style terrain visualization
import type { GAEAPlace } from '@flux'
import { parseEcosystemURN } from './ecosystem-utils'

export interface TilesetInfo {
  image: HTMLImageElement
  tileSize: number
  tilesPerRow: number
  loaded: boolean
}

export interface TileMapping {
  [key: string]: {
    x: number
    y: number
    variants?: Array<{ x: number; y: number }>
  }
}

// Default tile mappings for common terrain types
// Using a 16x16 tileset layout as reference
const DEFAULT_TILE_MAPPING: TileMapping = {
  // Biome-based mappings
  forest: { x: 0, y: 0, variants: [{ x: 1, y: 0 }, { x: 2, y: 0 }] },
  grassland: { x: 3, y: 0, variants: [{ x: 4, y: 0 }, { x: 5, y: 0 }] },
  mountain: { x: 6, y: 0, variants: [{ x: 7, y: 0 }, { x: 8, y: 0 }] },
  wetland: { x: 9, y: 0, variants: [{ x: 10, y: 0 }, { x: 11, y: 0 }] },
  desert: { x: 12, y: 0, variants: [{ x: 13, y: 0 }] },
  swamp: { x: 14, y: 0, variants: [{ x: 15, y: 0 }] },
  marsh: { x: 14, y: 0, variants: [{ x: 15, y: 0 }] }, // Similar to swamp for now

  // Climate modifiers (overlays or variants)
  subtropical: { x: 0, y: 1 },
  tropical: { x: 1, y: 1 },
  forest_coniferous: { x: 2, y: 1 },
  grassland_subtropical: { x: 3, y: 1 },
  wetland_tropical: { x: 4, y: 1 },

  // Fallback
  unknown: { x: 15, y: 15 }
}

export class TileRenderer {
  private tilesets: Map<string, TilesetInfo> = new Map()
  private tileMapping: TileMapping = DEFAULT_TILE_MAPPING

  constructor() {
    // Constructor - tile operations handled inline
  }

  async loadTileset(name: string, imagePath: string, tileSize: number = 16): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        const tilesPerRow = Math.floor(img.width / tileSize)
        this.tilesets.set(name, {
          image: img,
          tileSize,
          tilesPerRow,
          loaded: true
        })
        resolve()
      }

      img.onerror = () => {
        reject(new Error(`Failed to load tileset: ${imagePath}`))
      }

      img.src = imagePath
    })
  }

  getTileForPlace(place: GAEAPlace): { tilesetName: string; tileX: number; tileY: number } {
    const ecosystemData = parseEcosystemURN(place.ecology.ecosystem)

    if (!ecosystemData) {
      return { tilesetName: 'default', tileX: 15, tileY: 15 } // Unknown tile
    }

    const { biome, climate } = ecosystemData

    // Try specific biome+climate combination first
    const specificKey = `${biome}_${climate}`
    if (this.tileMapping[specificKey]) {
      const tile = this.tileMapping[specificKey]
      return { tilesetName: 'default', tileX: tile.x, tileY: tile.y }
    }

    // Fall back to biome
    if (this.tileMapping[biome]) {
      const tile = this.tileMapping[biome]

      // Use variant if available (for visual variety)
      if (tile.variants && tile.variants.length > 0) {
        const hash = this.hashString(place.id)
        const variantIndex = hash % (tile.variants.length + 1)

        if (variantIndex > 0) {
          const variant = tile.variants[variantIndex - 1]
          return { tilesetName: 'default', tileX: variant.x, tileY: variant.y }
        }
      }

      return { tilesetName: 'default', tileX: tile.x, tileY: tile.y }
    }

    // Ultimate fallback
    return { tilesetName: 'default', tileX: 15, tileY: 15 }
  }

  renderTile(
    ctx: CanvasRenderingContext2D,
    tilesetName: string,
    tileX: number,
    tileY: number,
    destX: number,
    destY: number,
    scale: number = 1
  ): void {
    const tileset = this.tilesets.get(tilesetName)
    if (!tileset || !tileset.loaded) {
      // Fallback to colored circle if tileset not available
      this.renderFallbackTile(ctx, destX, destY, scale)
      return
    }

    const sourceX = tileX * tileset.tileSize
    const sourceY = tileY * tileset.tileSize
    const destSize = tileset.tileSize * scale

    ctx.drawImage(
      tileset.image,
      sourceX, sourceY, tileset.tileSize, tileset.tileSize,
      destX - destSize / 2, destY - destSize / 2, destSize, destSize
    )
  }

  renderPlace(
    ctx: CanvasRenderingContext2D,
    place: GAEAPlace,
    x: number,
    y: number,
    scale: number = 1
  ): void {
    const { tilesetName, tileX, tileY } = this.getTileForPlace(place)
    this.renderTile(ctx, tilesetName, tileX, tileY, x, y, scale)
  }

  private renderFallbackTile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number
  ): void {
    // Render a simple colored circle as fallback
    ctx.fillStyle = '#888'
    ctx.beginPath()
    ctx.arc(x, y, 3 * scale, 0, Math.PI * 2)
    ctx.fill()
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  updateTileMapping(mapping: Partial<TileMapping>): void {
    Object.entries(mapping).forEach(([key, value]) => {
      if (value !== undefined) {
        this.tileMapping[key] = value
      }
    })
  }

  getTilesetInfo(name: string): TilesetInfo | undefined {
    return this.tilesets.get(name)
  }

  isReady(tilesetName: string = 'default'): boolean {
    const tileset = this.tilesets.get(tilesetName)
    return tileset?.loaded ?? false
  }
}
