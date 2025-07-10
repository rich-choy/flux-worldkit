import React, { useEffect, useRef } from 'react'
import type { WorldGenerationResult } from '@flux'

interface CanvasProps {
  world: WorldGenerationResult | null
  width: number
  height: number
}

// Gruvbox Dark Material colors for ecosystems
const ECOSYSTEM_COLORS = {
  'flux:eco:steppe:arid': '#d79921',        // Yellow - dry steppe
  'flux:eco:grassland:temperate': '#b8bb26', // Green - grassland
  'flux:eco:forest:temperate': '#689d6a',    // Aqua - forest
  'flux:eco:mountain:arid': '#928374',        // Gray - mountain
  'flux:eco:jungle:tropical': '#98971a',     // Dark green - jungle
  'flux:eco:marsh:tropical': '#8ec07c'       // Light aqua - marsh
}

export const Canvas: React.FC<CanvasProps> = ({ world, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#1d2021' // Gruvbox hard background
    ctx.fillRect(0, 0, width, height)

    // Draw ecosystem bands
    drawEcosystemBands(ctx, width, height)

    // Debug logging
    if (world) {
      console.log('Canvas: World data:', {
        places: world.places?.length || 0,
        vertices: world.vertices?.length || 0,
        hasVertices: !!world.vertices,
        firstVertex: world.vertices?.[0],
        firstPlace: world.places?.[0]
      })
    }

    // Draw world if available
    if (world && world.vertices?.length > 0) {
      drawWorld(ctx, world, width, height)
    } else if (world) {
      console.log('Canvas: World exists but no vertices array or empty vertices')
    }
  }, [world, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block"
    />
  )
}

const drawEcosystemBands = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const bandWidth = width / 5 // 5 ecosystem bands
  const ecosystems = [
    'flux:eco:steppe:arid',
    'flux:eco:grassland:temperate',
    'flux:eco:forest:temperate',
    'flux:eco:mountain:arid',
    'flux:eco:jungle:tropical'
  ]

  ecosystems.forEach((ecosystem, index) => {
    const x = index * bandWidth

    // Draw band background with low opacity
    ctx.fillStyle = ECOSYSTEM_COLORS[ecosystem as keyof typeof ECOSYSTEM_COLORS] + '20' // 20 = ~12% opacity
    ctx.fillRect(x, 0, bandWidth, height)

    // Draw band border
    ctx.strokeStyle = ECOSYSTEM_COLORS[ecosystem as keyof typeof ECOSYSTEM_COLORS] + '40' // 40 = ~25% opacity
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  })
}

const drawWorld = (ctx: CanvasRenderingContext2D, world: WorldGenerationResult, canvasWidth: number, canvasHeight: number) => {
  if (!world.vertices.length) return

  // Find world bounds from the vertices
  const worldBounds = getWorldBounds(world.vertices)
  console.log('Canvas: World bounds:', worldBounds)

  const scaleX = canvasWidth / worldBounds.width
  const scaleY = canvasHeight / worldBounds.height
  const scale = Math.min(scaleX, scaleY) * 0.9 // 90% to add padding

  console.log('Canvas: Scale calculations:', { scaleX, scaleY, finalScale: scale })

  // Calculate offset to center the world
  const worldCenterX = worldBounds.minX + worldBounds.width / 2
  const worldCenterY = worldBounds.minY + worldBounds.height / 2
  const canvasCenterX = canvasWidth / 2
  const canvasCenterY = canvasHeight / 2

  // Transform world coordinates to canvas coordinates
  const transform = (x: number, y: number) => ({
    x: (x - worldCenterX) * scale + canvasCenterX,
    y: (y - worldCenterY) * scale + canvasCenterY
  })

  // Test transformation
  const testVertex = world.vertices[0]
  const testCoords = transform(testVertex.x, testVertex.y)
  console.log('Canvas: Test transformation:', {
    worldCoords: { x: testVertex.x, y: testVertex.y },
    canvasCoords: testCoords
  })

  // Draw connections first (so they appear behind places)
  drawConnections(ctx, world, transform)

  // Draw places using vertex coordinates
  drawPlaces(ctx, world, transform)

  console.log('Canvas: Finished drawing world')
}

const getWorldBounds = (vertices: any[]) => {
  const xs = vertices.map(v => v.x)
  const ys = vertices.map(v => v.y)

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

const drawConnections = (
  ctx: CanvasRenderingContext2D,
  world: WorldGenerationResult,
  transform: (x: number, y: number) => { x: number; y: number }
) => {
  ctx.strokeStyle = '#fff' // White for high visibility
  ctx.lineWidth = 2 // Thicker lines
  ctx.globalAlpha = 0.8 // More opaque

  // Create a map of place IDs to vertex coordinates for quick lookup
  const vertexMap = new Map<string, { x: number; y: number }>()
  world.vertices.forEach(vertex => {
    const placeId = `flux:place:${vertex.id}`
    vertexMap.set(placeId, { x: vertex.x, y: vertex.y })
  })

  console.log('Canvas: Drawing connections:', {
    totalPlaces: world.places.length,
    vertexMapSize: vertexMap.size
  })

  let connectionCount = 0
  let placesWithExits = 0

  // Draw connections between places based on exits
  world.places.forEach((place, index) => {
    if (place.exits && Object.keys(place.exits).length > 0) {
      placesWithExits++
      const fromVertex = vertexMap.get(place.id)
      if (!fromVertex) return

      const fromCoords = transform(fromVertex.x, fromVertex.y)

      Object.values(place.exits).forEach(exit => {
        const toVertex = vertexMap.get(exit.to)
        if (toVertex) {
          const toCoords = transform(toVertex.x, toVertex.y)

          ctx.beginPath()
          ctx.moveTo(fromCoords.x, fromCoords.y)
          ctx.lineTo(toCoords.x, toCoords.y)
          ctx.stroke()

          connectionCount++

          // Log first few connections
          if (connectionCount <= 3) {
            console.log(`Canvas: Drew connection ${connectionCount}:`, {
              from: place.id,
              to: exit.to,
              fromCoords,
              toCoords
            })
          }
        }
      })
    }
  })

  console.log('Canvas: Connection summary:', {
    placesWithExits,
    totalConnections: connectionCount,
    connectionStyle: ctx.strokeStyle,
    lineWidth: ctx.lineWidth,
    alpha: ctx.globalAlpha
  })

  ctx.globalAlpha = 1.0
}

const drawPlaces = (
  ctx: CanvasRenderingContext2D,
  world: WorldGenerationResult,
  transform: (x: number, y: number) => { x: number; y: number }
) => {
  // Create a map of place IDs to vertices for coordinates
  const vertexMap = new Map<string, any>()
  world.vertices.forEach(vertex => {
    const placeId = `flux:place:${vertex.id}`
    vertexMap.set(placeId, vertex)
  })

  console.log('Canvas: Drawing places:', {
    totalPlaces: world.places.length,
    totalVertices: world.vertices.length,
    vertexMapSize: vertexMap.size,
    samplePlaceId: world.places[0]?.id,
    sampleVertexInMap: vertexMap.has(world.places[0]?.id || ''),
    samplePlaceExits: world.places[0]?.exits,
    samplePlaceExitsCount: Object.keys(world.places[0]?.exits || {}).length
  })

  let drawnCount = 0

  world.places.forEach((place, index) => {
    const vertex = vertexMap.get(place.id)
    if (!vertex) {
      if (index < 3) { // Log first few misses
        console.log('Canvas: No vertex found for place:', place.id)
      }
      return
    }

    const coords = transform(vertex.x, vertex.y)

    // Get ecosystem color
    const ecosystemColor = ECOSYSTEM_COLORS[place.ecology.ecosystem as keyof typeof ECOSYSTEM_COLORS] || '#ebdbb2'

    // Draw place node
    ctx.fillStyle = ecosystemColor
    ctx.beginPath()
    ctx.arc(coords.x, coords.y, 3, 0, 2 * Math.PI)
    ctx.fill()

    // Draw border
    ctx.strokeStyle = '#fbf1c7' // Gruvbox foreground 0
    ctx.lineWidth = 1
    ctx.stroke()

    drawnCount++

    // Log first few drawn places
    if (index < 3) {
      console.log(`Canvas: Drew place ${index}:`, {
        placeId: place.id,
        ecosystem: place.ecology.ecosystem,
        worldCoords: { x: vertex.x, y: vertex.y },
        canvasCoords: coords,
        color: ecosystemColor
      })
    }
  })

  console.log('Canvas: Total places drawn:', drawnCount)
}
