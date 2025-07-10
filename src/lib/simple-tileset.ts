// Simple inline tileset for terrain visualization
// This creates basic 16x16 pixel sprites as data URLs

export const createSimpleTileset = (): string => {
  const canvas = document.createElement('canvas')
  canvas.width = 256  // 16 tiles x 16 pixels
  canvas.height = 256 // 16 tiles x 16 pixels
  const ctx = canvas.getContext('2d')!

  // Clear the canvas
  ctx.fillStyle = '#transparent'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Helper function to draw a tile at grid position
  const drawTile = (x: number, y: number, drawFn: (ctx: CanvasRenderingContext2D, tileX: number, tileY: number) => void) => {
    const tileX = x * 16
    const tileY = y * 16
    ctx.save()
    ctx.translate(tileX, tileY)
    drawFn(ctx, tileX, tileY)
    ctx.restore()
  }

  // Forest tiles (0,0), (1,0), (2,0)
  drawTile(0, 0, (ctx) => {
    // Dark green base
    ctx.fillStyle = '#0d4f0d'
    ctx.fillRect(0, 0, 16, 16)
    // Tree trunk
    ctx.fillStyle = '#4d2d1a'
    ctx.fillRect(6, 10, 4, 6)
    // Tree crown
    ctx.fillStyle = '#1a7a1a'
    ctx.beginPath()
    ctx.arc(8, 8, 6, 0, Math.PI * 2)
    ctx.fill()
    // Highlight
    ctx.fillStyle = '#2d9a2d'
    ctx.beginPath()
    ctx.arc(6, 6, 3, 0, Math.PI * 2)
    ctx.fill()
  })

  drawTile(1, 0, (ctx) => {
    // Variant forest tile
    ctx.fillStyle = '#0d4f0d'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#1a7a1a'
    ctx.fillRect(2, 2, 6, 6)
    ctx.fillRect(8, 8, 6, 6)
    ctx.fillStyle = '#2d9a2d'
    ctx.fillRect(0, 10, 4, 4)
    ctx.fillRect(12, 4, 4, 4)
  })

  drawTile(2, 0, (ctx) => {
    // Dense forest
    ctx.fillStyle = '#0a3d0a'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#1a7a1a'
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(i * 4, (i % 2) * 8, 4, 8)
    }
  })

  // Grassland tiles (3,0), (4,0), (5,0)
  drawTile(3, 0, (ctx) => {
    // Light green base
    ctx.fillStyle = '#7eb33c'
    ctx.fillRect(0, 0, 16, 16)
    // Grass blades
    ctx.fillStyle = '#9fcf4f'
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(i * 2, 14, 1, 2)
      ctx.fillRect(i * 2 + 4, 12, 1, 4)
    }
  })

  drawTile(4, 0, (ctx) => {
    // Grassland with flowers
    ctx.fillStyle = '#7eb33c'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#9fcf4f'
    ctx.fillRect(0, 12, 16, 4)
    // Small flowers
    ctx.fillStyle = '#ff6b9d'
    ctx.fillRect(3, 10, 2, 2)
    ctx.fillRect(11, 8, 2, 2)
    ctx.fillStyle = '#ffeb3b'
    ctx.fillRect(7, 9, 2, 2)
  })

  drawTile(5, 0, (ctx) => {
    // Rolling grassland
    ctx.fillStyle = '#7eb33c'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#9fcf4f'
    ctx.fillRect(0, 8, 16, 8)
    ctx.fillStyle = '#6fa72c'
    ctx.fillRect(0, 4, 16, 4)
  })

  // Mountain tiles (6,0), (7,0), (8,0)
  drawTile(6, 0, (ctx) => {
    // Mountain peak
    ctx.fillStyle = '#654321'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#8b7355'
    ctx.beginPath()
    ctx.moveTo(0, 16)
    ctx.lineTo(8, 4)
    ctx.lineTo(16, 16)
    ctx.fill()
    // Snow cap
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(6, 6)
    ctx.lineTo(8, 4)
    ctx.lineTo(10, 6)
    ctx.fill()
  })

  drawTile(7, 0, (ctx) => {
    // Rocky mountain
    ctx.fillStyle = '#5a4a3a'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#8b7355'
    ctx.fillRect(2, 8, 12, 8)
    ctx.fillRect(4, 4, 8, 8)
    ctx.fillStyle = '#a0906d'
    ctx.fillRect(6, 2, 4, 8)
  })

  drawTile(8, 0, (ctx) => {
    // Mountain slope
    ctx.fillStyle = '#654321'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#8b7355'
    ctx.beginPath()
    ctx.moveTo(0, 16)
    ctx.lineTo(0, 8)
    ctx.lineTo(16, 12)
    ctx.lineTo(16, 16)
    ctx.fill()
  })

  // Desert/Arid tiles (9,0), (10,0)
  drawTile(9, 0, (ctx) => {
    // Sandy desert
    ctx.fillStyle = '#f4d03f'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#f7dc6f'
    ctx.fillRect(2, 2, 12, 4)
    ctx.fillRect(0, 8, 16, 4)
    ctx.fillStyle = '#f1c40f'
    ctx.fillRect(4, 12, 8, 4)
  })

  drawTile(10, 0, (ctx) => {
    // Desert with cactus
    ctx.fillStyle = '#f4d03f'
    ctx.fillRect(0, 0, 16, 16)
    // Cactus
    ctx.fillStyle = '#27ae60'
    ctx.fillRect(7, 6, 2, 10)
    ctx.fillRect(3, 8, 2, 4)
    ctx.fillRect(11, 10, 2, 4)
  })

  // Swamp tiles (11,0), (12,0)
  drawTile(11, 0, (ctx) => {
    // Swampy water
    ctx.fillStyle = '#3e5c3e'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#4a6b4a'
    ctx.fillRect(2, 2, 12, 12)
    // Lily pads
    ctx.fillStyle = '#2d4a2d'
    ctx.fillRect(3, 4, 3, 2)
    ctx.fillRect(10, 8, 3, 2)
    ctx.fillRect(5, 11, 3, 2)
  })

  drawTile(12, 0, (ctx) => {
    // Swamp with dead tree
    ctx.fillStyle = '#3e5c3e'
    ctx.fillRect(0, 0, 16, 16)
    // Dead tree
    ctx.fillStyle = '#2c1810'
    ctx.fillRect(7, 8, 2, 8)
    ctx.fillRect(4, 4, 8, 2)
    ctx.fillRect(2, 6, 4, 1)
    ctx.fillRect(10, 6, 4, 1)
  })

  // Water tiles (13,0), (14,0)
  drawTile(13, 0, (ctx) => {
    // Clear lake water
    ctx.fillStyle = '#4a90e2'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#5ba3f5'
    ctx.fillRect(2, 2, 12, 12)
    // Water ripples
    ctx.fillStyle = '#6bb6ff'
    ctx.fillRect(4, 4, 8, 2)
    ctx.fillRect(6, 8, 4, 2)
    ctx.fillRect(3, 12, 10, 1)
  })

  drawTile(14, 0, (ctx) => {
    // Lake water with reflection
    ctx.fillStyle = '#4a90e2'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#5ba3f5'
    ctx.fillRect(1, 1, 14, 14)
    // Lighter reflection areas
    ctx.fillStyle = '#7ac7ff'
    ctx.fillRect(2, 2, 6, 6)
    ctx.fillRect(10, 8, 4, 4)
    // Subtle waves
    ctx.fillStyle = '#6bb6ff'
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(i * 4, 6 + (i % 2), 3, 1)
    }
  })

  // Unknown/fallback tile (15,15)
  drawTile(15, 15, (ctx) => {
    // Question mark pattern
    ctx.fillStyle = '#666666'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('?', 8, 11)
  })

  return canvas.toDataURL()
}
