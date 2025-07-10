// Different tileset variants for various visual styles

export const createMinimalTileset = (): string => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = 'transparent'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const drawTile = (x: number, y: number, drawFn: (ctx: CanvasRenderingContext2D) => void) => {
    const tileX = x * 16
    const tileY = y * 16
    ctx.save()
    ctx.translate(tileX, tileY)
    drawFn(ctx)
    ctx.restore()
  }

  // Forest tiles - simple geometric patterns
  drawTile(0, 0, (ctx) => {
    ctx.fillStyle = '#1a7a1a'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#2d9a2d'
    ctx.fillRect(4, 4, 8, 8)
  })

  drawTile(1, 0, (ctx) => {
    ctx.fillStyle = '#1a7a1a'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#2d9a2d'
    ctx.fillRect(2, 2, 4, 4)
    ctx.fillRect(10, 10, 4, 4)
  })

  drawTile(2, 0, (ctx) => {
    ctx.fillStyle = '#1a7a1a'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#2d9a2d'
    ctx.fillRect(0, 8, 16, 8)
  })

  // Grassland tiles
  drawTile(3, 0, (ctx) => {
    ctx.fillStyle = '#9fcf4f'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#7eb33c'
    ctx.fillRect(0, 12, 16, 4)
  })

  drawTile(4, 0, (ctx) => {
    ctx.fillStyle = '#9fcf4f'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#7eb33c'
    ctx.fillRect(4, 8, 8, 8)
  })

  drawTile(5, 0, (ctx) => {
    ctx.fillStyle = '#9fcf4f'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#7eb33c'
    ctx.fillRect(0, 0, 8, 16)
  })

  // Mountain tiles
  drawTile(6, 0, (ctx) => {
    ctx.fillStyle = '#8b7355'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#654321'
    ctx.fillRect(4, 4, 8, 8)
  })

  drawTile(7, 0, (ctx) => {
    ctx.fillStyle = '#8b7355'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#654321'
    ctx.fillRect(0, 0, 16, 8)
  })

  drawTile(8, 0, (ctx) => {
    ctx.fillStyle = '#8b7355'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#654321'
    ctx.fillRect(2, 2, 12, 12)
  })

  // Wetland tiles
  drawTile(11, 0, (ctx) => {
    ctx.fillStyle = '#4a6b4a'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#3e5c3e'
    ctx.fillRect(4, 4, 8, 8)
  })

  drawTile(12, 0, (ctx) => {
    ctx.fillStyle = '#4a6b4a'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#3e5c3e'
    ctx.fillRect(0, 8, 16, 8)
  })

  // Water tiles
  drawTile(13, 0, (ctx) => {
    ctx.fillStyle = '#5ba3f5'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#4a90e2'
    ctx.fillRect(2, 2, 12, 12)
  })

  drawTile(14, 0, (ctx) => {
    ctx.fillStyle = '#5ba3f5'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#4a90e2'
    ctx.fillRect(0, 0, 8, 8)
    ctx.fillRect(8, 8, 8, 8)
  })

  // Unknown/fallback tile
  drawTile(15, 15, (ctx) => {
    ctx.fillStyle = '#666666'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#999999'
    ctx.fillRect(4, 4, 8, 8)
  })

  return canvas.toDataURL()
}

export const createHighContrastTileset = (): string => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = 'transparent'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const drawTile = (x: number, y: number, drawFn: (ctx: CanvasRenderingContext2D) => void) => {
    const tileX = x * 16
    const tileY = y * 16
    ctx.save()
    ctx.translate(tileX, tileY)
    drawFn(ctx)
    ctx.restore()
  }

  // Forest tiles - high contrast
  drawTile(0, 0, (ctx) => {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#00ff00'
    ctx.fillRect(2, 2, 12, 12)
  })

  drawTile(1, 0, (ctx) => {
    ctx.fillStyle = '#004d00'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#00ff00'
    ctx.fillRect(0, 0, 8, 8)
    ctx.fillRect(8, 8, 8, 8)
  })

  drawTile(2, 0, (ctx) => {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#00ff00'
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(i * 4, 0, 2, 16)
    }
  })

  // Grassland tiles
  drawTile(3, 0, (ctx) => {
    ctx.fillStyle = '#ffff00'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#cccc00'
    ctx.fillRect(0, 12, 16, 4)
  })

  drawTile(4, 0, (ctx) => {
    ctx.fillStyle = '#ffff00'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#cccc00'
    ctx.fillRect(4, 4, 8, 8)
  })

  drawTile(5, 0, (ctx) => {
    ctx.fillStyle = '#ffff00'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#cccc00'
    for (let i = 0; i < 16; i += 2) {
      ctx.fillRect(i, 0, 1, 16)
    }
  })

  // Mountain tiles
  drawTile(6, 0, (ctx) => {
    ctx.fillStyle = '#8b4513'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(6, 2, 4, 4)
  })

  drawTile(7, 0, (ctx) => {
    ctx.fillStyle = '#654321'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 16, 8)
  })

  drawTile(8, 0, (ctx) => {
    ctx.fillStyle = '#8b4513'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(4, 0, 8, 16)
  })

  // Wetland tiles
  drawTile(11, 0, (ctx) => {
    ctx.fillStyle = '#006400'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#00ffff'
    ctx.fillRect(2, 2, 12, 12)
  })

  drawTile(12, 0, (ctx) => {
    ctx.fillStyle = '#006400'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#00ffff'
    ctx.fillRect(0, 8, 16, 8)
  })

  // Water tiles
  drawTile(13, 0, (ctx) => {
    ctx.fillStyle = '#0000ff'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#00bfff'
    ctx.fillRect(2, 2, 12, 12)
  })

  drawTile(14, 0, (ctx) => {
    ctx.fillStyle = '#0000ff'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#00bfff'
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(i * 4, 4, 2, 8)
    }
  })

  // Unknown/fallback tile
  drawTile(15, 15, (ctx) => {
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('?', 8, 11)
  })

  return canvas.toDataURL()
}

export const createRetroTileset = (): string => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = 'transparent'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const drawTile = (x: number, y: number, drawFn: (ctx: CanvasRenderingContext2D) => void) => {
    const tileX = x * 16
    const tileY = y * 16
    ctx.save()
    ctx.translate(tileX, tileY)
    drawFn(ctx)
    ctx.restore()
  }

  // Forest tiles - retro pixel art style
  drawTile(0, 0, (ctx) => {
    ctx.fillStyle = '#2d5016'
    ctx.fillRect(0, 0, 16, 16)
    // Pixelated tree
    ctx.fillStyle = '#68b32d'
    ctx.fillRect(7, 12, 2, 4)
    ctx.fillRect(5, 8, 6, 6)
    ctx.fillRect(6, 6, 4, 4)
    ctx.fillRect(7, 4, 2, 4)
  })

  drawTile(1, 0, (ctx) => {
    ctx.fillStyle = '#2d5016'
    ctx.fillRect(0, 0, 16, 16)
    // Multiple small trees
    ctx.fillStyle = '#68b32d'
    ctx.fillRect(2, 10, 4, 4)
    ctx.fillRect(10, 6, 4, 4)
    ctx.fillRect(6, 2, 4, 4)
  })

  drawTile(2, 0, (ctx) => {
    ctx.fillStyle = '#2d5016'
    ctx.fillRect(0, 0, 16, 16)
    // Dense forest pattern
    ctx.fillStyle = '#68b32d'
    ctx.fillRect(0, 8, 16, 8)
    ctx.fillRect(4, 4, 8, 8)
    ctx.fillStyle = '#4a7c2a'
    ctx.fillRect(2, 6, 12, 4)
  })

  // Grassland tiles
  drawTile(3, 0, (ctx) => {
    ctx.fillStyle = '#7eb33c'
    ctx.fillRect(0, 0, 16, 16)
    // Pixel grass
    ctx.fillStyle = '#9fcf4f'
    for (let i = 0; i < 16; i += 2) {
      ctx.fillRect(i, 12, 1, 4)
    }
  })

  drawTile(4, 0, (ctx) => {
    ctx.fillStyle = '#7eb33c'
    ctx.fillRect(0, 0, 16, 16)
    // Grass with flowers
    ctx.fillStyle = '#9fcf4f'
    ctx.fillRect(0, 12, 16, 4)
    ctx.fillStyle = '#ff69b4'
    ctx.fillRect(4, 8, 2, 2)
    ctx.fillRect(10, 6, 2, 2)
  })

  drawTile(5, 0, (ctx) => {
    ctx.fillStyle = '#7eb33c'
    ctx.fillRect(0, 0, 16, 16)
    // Rolling hills
    ctx.fillStyle = '#9fcf4f'
    ctx.fillRect(0, 6, 8, 10)
    ctx.fillRect(8, 8, 8, 8)
  })

  // Mountain tiles
  drawTile(6, 0, (ctx) => {
    ctx.fillStyle = '#654321'
    ctx.fillRect(0, 0, 16, 16)
    // Pixelated mountain
    ctx.fillStyle = '#8b7355'
    ctx.fillRect(6, 8, 4, 8)
    ctx.fillRect(7, 4, 2, 8)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(7, 4, 2, 2)
  })

  drawTile(7, 0, (ctx) => {
    ctx.fillStyle = '#654321'
    ctx.fillRect(0, 0, 16, 16)
    // Rocky terrain
    ctx.fillStyle = '#8b7355'
    ctx.fillRect(2, 6, 12, 10)
    ctx.fillRect(4, 2, 8, 8)
  })

  drawTile(8, 0, (ctx) => {
    ctx.fillStyle = '#654321'
    ctx.fillRect(0, 0, 16, 16)
    // Mountain slope
    ctx.fillStyle = '#8b7355'
    for (let i = 0; i < 16; i++) {
      ctx.fillRect(i, 16 - i, 1, i)
    }
  })

  // Wetland tiles
  drawTile(11, 0, (ctx) => {
    ctx.fillStyle = '#3e5c3e'
    ctx.fillRect(0, 0, 16, 16)
    // Swamp water
    ctx.fillStyle = '#4a6b4a'
    ctx.fillRect(2, 2, 12, 12)
    // Lily pads
    ctx.fillStyle = '#2d4a2d'
    ctx.fillRect(4, 4, 2, 2)
    ctx.fillRect(10, 8, 2, 2)
  })

  drawTile(12, 0, (ctx) => {
    ctx.fillStyle = '#3e5c3e'
    ctx.fillRect(0, 0, 16, 16)
    // Murky water
    ctx.fillStyle = '#4a6b4a'
    ctx.fillRect(0, 8, 16, 8)
    ctx.fillStyle = '#2d4a2d'
    ctx.fillRect(6, 4, 4, 8)
  })

  // Water tiles
  drawTile(13, 0, (ctx) => {
    ctx.fillStyle = '#4a90e2'
    ctx.fillRect(0, 0, 16, 16)
    // Clear water
    ctx.fillStyle = '#5ba3f5'
    ctx.fillRect(2, 2, 12, 12)
    // Ripples
    ctx.fillStyle = '#6bb6ff'
    ctx.fillRect(4, 6, 8, 2)
    ctx.fillRect(6, 10, 4, 2)
  })

  drawTile(14, 0, (ctx) => {
    ctx.fillStyle = '#4a90e2'
    ctx.fillRect(0, 0, 16, 16)
    // Animated water effect
    ctx.fillStyle = '#5ba3f5'
    ctx.fillRect(1, 1, 14, 14)
    ctx.fillStyle = '#6bb6ff'
    ctx.fillRect(3, 3, 10, 10)
  })

  // Unknown/fallback tile
  drawTile(15, 15, (ctx) => {
    ctx.fillStyle = '#666666'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('?', 8, 11)
  })

  return canvas.toDataURL()
}
