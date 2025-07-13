import React, { useEffect, useRef, useState } from 'react'
import type { WorldGenerationResult, WorldVertex } from '~/worldgen/types'
import type { Place } from 'flux-game'
import VertexTooltip from './VertexTooltip'

interface CanvasProps {
  world: WorldGenerationResult | null
  zoom: number
  panX: number
  panY: number
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

// Ecosystem-specific node colors - fully saturated
const NODE_COLORS = {
  'flux:eco:steppe:arid': '#ff0000',         // Fully saturated red
  'flux:eco:grassland:temperate': '#ffff00', // Fully saturated yellow
  'flux:eco:forest:temperate': '#00ff00',    // Fully saturated green
  'flux:eco:mountain:arid': '#ff0000',       // Fully saturated red (same as steppe)
  'flux:eco:jungle:tropical': '#00ff00',     // Fully saturated green (same as forest)
  'flux:eco:marsh:tropical': '#8b4513'       // Brownish green (saddle brown)
}

// Reserved space at the top for ecosystem URNs
const URN_AREA_HEIGHT = 28

export const Canvas: React.FC<CanvasProps> = ({ world, zoom, panX, panY }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Hover detection state
  const [hoveredVertex, setHoveredVertex] = useState<WorldVertex | null>(null)
  const [hoveredPlace, setHoveredPlace] = useState<Place | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [isTooltipHovered, setIsTooltipHovered] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle container resizing
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect()
      setDimensions({
        width: rect.width,
        height: rect.height
      })
    }

    // Initial size
    updateDimensions()

    // Set up ResizeObserver to watch for container size changes
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(container)

    // Fallback: also listen to window resize
    window.addEventListener('resize', updateDimensions)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])

  // Draw canvas when world or display parameters change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#1d2021' // Gruvbox hard background
    ctx.fillRect(0, 0, dimensions.width, dimensions.height)

    // Draw world if available
    if (world && world.vertices?.length > 0) {
                  // Debug complete - bridge rule violations confirmed:
      // 1. Mountain bridging to Forest instead of Jungle (wrong ecosystem progression)
      // 2. Bridge vertex 4000m off center line (should be ±150m)
      // 3. Backward connection (NW instead of E)

      drawWorld(ctx, world, dimensions.width, dimensions.height, zoom, panX, panY)
    }
  }, [world, dimensions.width, dimensions.height, zoom, panX, panY])

  // Hit detection function
  const findVertexAtPosition = (canvasX: number, canvasY: number): WorldVertex | null => {
    if (!world) return null

    // Use the EXACT same transform function as drawWorld
    const worldBounds = getWorldBounds(world.vertices)
    const scaleX = dimensions.width / worldBounds.width
    const scaleY = dimensions.height / worldBounds.height
    const baseScale = Math.min(scaleX, scaleY) * 0.9 // 90% to add padding
    const scale = baseScale * zoom // Apply zoom multiplier

    // Calculate offset to center the world
    const worldCenterX = worldBounds.minX + worldBounds.width / 2
    const worldCenterY = worldBounds.minY + worldBounds.height / 2
    const canvasCenterX = dimensions.width / 2
    const canvasCenterY = dimensions.height / 2

    // Transform world coordinates to canvas coordinates (with zoom and pan)
    const transform = (x: number, y: number) => ({
      x: (x - worldCenterX) * scale + canvasCenterX + panX,
      y: (y - worldCenterY) * scale + canvasCenterY + panY
    })

    // Check each vertex for hit
    for (const vertex of world.vertices) {
      const screenPos = transform(vertex.x, vertex.y)
      const distance = Math.sqrt(
        Math.pow(canvasX - screenPos.x, 2) + Math.pow(canvasY - screenPos.y, 2)
      )

      // Use a larger hit radius for easier hovering
      const hitRadius = 8
      if (distance <= hitRadius) {
        return vertex
      }
    }

    return null
  }

  // Mouse event handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!world) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    const vertex = findVertexAtPosition(canvasX, canvasY)

    if (vertex) {
      // Found a vertex under cursor
      // Cancel any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }

      if (vertex !== hoveredVertex) {
        // Clear existing hover timeout
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current)
        }

        // Set new hover timeout (200ms delay)
        hoverTimeoutRef.current = setTimeout(() => {
          const place = world.places.find(p => p.id === vertex.placeId)
          if (place) {
            setHoveredVertex(vertex)
            setHoveredPlace(place)
            setTooltipPosition({ x: e.clientX, y: e.clientY })
            setIsTooltipVisible(true)
          }
        }, 200)
      } else {
        // Same vertex, update tooltip position
        setTooltipPosition({ x: e.clientX, y: e.clientY })
      }
    } else {
      // No vertex under cursor, start hide timeout unless tooltip is hovered
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }

      if (!isTooltipHovered) {
        // Add delay before hiding tooltip to allow moving to it
        hideTimeoutRef.current = setTimeout(() => {
          setIsTooltipVisible(false)
          setHoveredVertex(null)
          setHoveredPlace(null)
        }, 300)
      }
    }
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }

    // Only hide immediately if tooltip is not hovered
    if (!isTooltipHovered) {
      setIsTooltipVisible(false)
      setHoveredVertex(null)
      setHoveredPlace(null)
    } else {
      // Start hide timeout to hide when mouse leaves tooltip
      hideTimeoutRef.current = setTimeout(() => {
        if (!isTooltipHovered) {
          setIsTooltipVisible(false)
          setHoveredVertex(null)
          setHoveredPlace(null)
        }
      }, 300)
    }
  }

  // Handle place updates from tooltip
  const handlePlaceUpdate = (placeId: string, updates: { name?: string; description?: string }) => {
    if (!world) return

    // Find and update the place
    const placeIndex = world.places.findIndex(p => p.id === placeId)
    if (placeIndex !== -1) {
      const updatedPlace = { ...world.places[placeIndex] }
      if (updates.name !== undefined) {
        updatedPlace.name = updates.name
      }
      if (updates.description !== undefined) {
        updatedPlace.description = updates.description
      }

      // Update the place in the world (this is a direct mutation for now)
      world.places[placeIndex] = updatedPlace

      // Update the hovered place state
      setHoveredPlace(updatedPlace)
    }
  }

  // Handle tooltip hover to keep it visible
  const handleTooltipMouseEnter = () => {
    setIsTooltipHovered(true)
    // Cancel any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  const handleTooltipMouseLeave = () => {
    setIsTooltipHovered(false)
    // Start hide timeout
    hideTimeoutRef.current = setTimeout(() => {
      setIsTooltipVisible(false)
      setHoveredVertex(null)
      setHoveredPlace(null)
    }, 300)
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{ minWidth: '100%', minHeight: '100%' }}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block w-full h-full"
        style={{ width: '100%', height: '100%' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Tooltip */}
      {isTooltipVisible && hoveredVertex && hoveredPlace && (
        <VertexTooltip
          vertex={hoveredVertex}
          place={hoveredPlace}
          position={tooltipPosition}
          isVisible={isTooltipVisible}
          onClose={() => setIsTooltipVisible(false)}
          onSave={handlePlaceUpdate}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        />
      )}
    </div>
  )
}

const drawEcosystemUrns = (ctx: CanvasRenderingContext2D, world: WorldGenerationResult, canvasWidth: number, transform: (x: number, y: number) => { x: number; y: number }) => {
  const urnY = URN_AREA_HEIGHT - 8 // Position with top margin, closer to bottom of URN area

  // Draw URNs in the dedicated space at the top
  world.ecosystemBoundaries.forEach((boundary) => {
    // Calculate horizontal position based on ecosystem boundary
    const leftX = transform(boundary.startX, 0).x
    const rightX = transform(boundary.endX, 0).x
    const labelX = leftX + (rightX - leftX) / 2

    // Only draw if the label would be visible on canvas
    if (labelX >= 0 && labelX <= canvasWidth) {
      // Draw ecosystem label with prominent styling
      ctx.fillStyle = '#ebdbb2' // Gruvbox light text color
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Create a solid black background for maximum legibility
      const textMetrics = ctx.measureText(boundary.ecosystem)
      const textWidth = textMetrics.width
      const textHeight = 16 // Slightly larger for bold text
      const padding = 8

      ctx.fillStyle = '#000000' // Solid black background
      ctx.fillRect(labelX - textWidth / 2 - padding, urnY - textHeight / 2 - padding / 2, textWidth + padding * 2, textHeight + padding)

      // Draw a subtle border around the black background
      ctx.strokeStyle = '#333333'
      ctx.lineWidth = 1
      ctx.strokeRect(labelX - textWidth / 2 - padding, urnY - textHeight / 2 - padding / 2, textWidth + padding * 2, textHeight + padding)

      // Draw the text on top
      ctx.fillStyle = '#ebdbb2' // Gruvbox light text color
      ctx.fillText(boundary.ecosystem, labelX, urnY)
    }
  })
}

const drawEcosystemBands = (ctx: CanvasRenderingContext2D, world: WorldGenerationResult, transform: (x: number, y: number) => { x: number; y: number }) => {
  // Use actual ecosystem boundaries from world generation
  world.ecosystemBoundaries.forEach((boundary) => {
    // Transform world coordinates to canvas coordinates
    const topLeft = transform(boundary.startX, boundary.startY)
    const bottomRight = transform(boundary.endX, boundary.endY)

    const canvasX = topLeft.x
    const canvasY = topLeft.y
    const canvasWidth = bottomRight.x - topLeft.x
    const canvasHeight = bottomRight.y - topLeft.y

    // Draw band background with low opacity
    ctx.fillStyle = ECOSYSTEM_COLORS[boundary.ecosystem as keyof typeof ECOSYSTEM_COLORS] + '20' // 20 = ~12% opacity
    ctx.fillRect(canvasX, canvasY, canvasWidth, canvasHeight)

    // Draw band border
    ctx.strokeStyle = ECOSYSTEM_COLORS[boundary.ecosystem as keyof typeof ECOSYSTEM_COLORS] + '40' // 40 = ~25% opacity
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(canvasX, canvasY)
    ctx.lineTo(canvasX, canvasY + canvasHeight)
    ctx.stroke()
  })
}

const drawWorld = (ctx: CanvasRenderingContext2D, world: WorldGenerationResult, canvasWidth: number, canvasHeight: number, zoom: number, panX: number, panY: number) => {
  if (!world.vertices.length) return

  // Reserve space at the top for URN labels
  const availableCanvasHeight = canvasHeight - URN_AREA_HEIGHT

  // Find world bounds from the vertices
  const worldBounds = getWorldBounds(world.vertices)

  const scaleX = canvasWidth / worldBounds.width
  const scaleY = availableCanvasHeight / worldBounds.height
  const baseScale = Math.min(scaleX, scaleY) * 0.9 // 90% to add padding
  const scale = baseScale * zoom // Apply zoom multiplier

  // Calculate offset to center the world in the available space (below URN area)
  const worldCenterX = worldBounds.minX + worldBounds.width / 2
  const worldCenterY = worldBounds.minY + worldBounds.height / 2
  const canvasCenterX = canvasWidth / 2
  const canvasCenterY = URN_AREA_HEIGHT + (availableCanvasHeight / 2) - 25 // Position graph closer to URN area

  // Transform world coordinates to canvas coordinates (with zoom and pan)
  const transform = (x: number, y: number) => ({
    x: (x - worldCenterX) * scale + canvasCenterX + panX,
    y: (y - worldCenterY) * scale + canvasCenterY + panY
  })

  // Test transformation
  const testVertex = world.vertices[0]
  const testCoords = transform(testVertex.x, testVertex.y)

  // Draw ecosystem bands first (background)
  drawEcosystemBands(ctx, world, transform)

  // Draw ecosystem URNs in the dedicated space at the top
  drawEcosystemUrns(ctx, world, canvasWidth, transform)

  // Draw connections second (so they appear behind places)
  drawConnections(ctx, world, transform)

  // Draw places last (so they appear on top)
  drawPlaces(ctx, world, transform)
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

// Helper function to blend two colors
const blendColors = (color1: string, color2: string): string => {
  const hex1 = color1.replace('#', '')
  const hex2 = color2.replace('#', '')

  const r1 = parseInt(hex1.substring(0, 2), 16)
  const g1 = parseInt(hex1.substring(2, 4), 16)
  const b1 = parseInt(hex1.substring(4, 6), 16)

  const r2 = parseInt(hex2.substring(0, 2), 16)
  const g2 = parseInt(hex2.substring(2, 4), 16)
  const b2 = parseInt(hex2.substring(4, 6), 16)

  const r = Math.round((r1 + r2) / 2)
  const g = Math.round((g1 + g2) / 2)
  const b = Math.round((b1 + b2) / 2)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Helper function to mute a color (make it less vibrant)
const muteColor = (color: string): string => {
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Reduce saturation by blending with gray
  const gray = 128
  const factor = 0.6 // Muting factor

  const mutedR = Math.round(r * (1 - factor) + gray * factor)
  const mutedG = Math.round(g * (1 - factor) + gray * factor)
  const mutedB = Math.round(b * (1 - factor) + gray * factor)

  return `#${mutedR.toString(16).padStart(2, '0')}${mutedG.toString(16).padStart(2, '0')}${mutedB.toString(16).padStart(2, '0')}`
}

// Helper function to map ecosystem to ecosystem band (marsh is part of jungle band)
const getEcosystemBand = (ecosystem: string): string => {
  if (ecosystem.includes('steppe')) return 'steppe'
  if (ecosystem.includes('grassland')) return 'grassland'
  if (ecosystem.includes('forest')) return 'forest'
  if (ecosystem.includes('mountain')) return 'mountain'
  if (ecosystem.includes('jungle') || ecosystem.includes('marsh')) return 'jungle'
  return 'unknown'
}

const drawConnections = (
  ctx: CanvasRenderingContext2D,
  world: WorldGenerationResult,
  transform: (x: number, y: number) => { x: number; y: number }
) => {
  ctx.lineWidth = 1 // Thinner lines
  ctx.globalAlpha = 0.62 // 62% opacity as specified

  // Create a map of place IDs to vertex coordinates and ecosystems for quick lookup
  const vertexMap = new Map<string, { x: number; y: number; ecosystem: string }>()
  world.vertices.forEach(vertex => {
    // Use the placeId directly from the vertex
    vertexMap.set(vertex.placeId, { x: vertex.x, y: vertex.y, ecosystem: vertex.ecosystem })
  })

  // Drawing connections between places based on exits

  let connectionCount = 0
  let placesWithExits = 0
  let failedLookups = 0

  // Draw connections between places based on exits
  world.places.forEach((place) => {
    if (place.exits && Object.keys(place.exits).length > 0) {
      placesWithExits++
      const fromVertex = vertexMap.get(place.id)
      if (!fromVertex) {
        failedLookups++
        return
      }

      const fromCoords = transform(fromVertex.x, fromVertex.y)

      Object.values(place.exits).forEach((exit: any) => {
        const toVertex = vertexMap.get(exit.to)
        if (toVertex) {
          const toCoords = transform(toVertex.x, toVertex.y)

          // Get colors for both ecosystems
          const fromColor = NODE_COLORS[fromVertex.ecosystem as keyof typeof NODE_COLORS] || '#ebdbb2'
          const toColor = NODE_COLORS[toVertex.ecosystem as keyof typeof NODE_COLORS] || '#ebdbb2'

          // Create composite color for the edge
          let edgeColor: string
          if (fromVertex.ecosystem === toVertex.ecosystem) {
            // Same ecosystem - use muted version of the ecosystem color
            edgeColor = muteColor(fromColor)
          } else {
            // Different ecosystems - blend the colors and mute
            const blendedColor = blendColors(fromColor, toColor)
            edgeColor = muteColor(blendedColor)
          }

          // Check if this is an inter-ecosystem-BAND connection (not just inter-ecosystem)
          const fromBand = getEcosystemBand(fromVertex.ecosystem)
          const toBand = getEcosystemBand(toVertex.ecosystem)
          const isInterBandConnection = fromBand !== toBand

          // Use thicker line for inter-ecosystem-BAND connections
          if (isInterBandConnection) {
            ctx.strokeStyle = edgeColor;
            ctx.lineWidth = 2.5; // Much thicker line for inter-band connections
            ctx.beginPath();
            ctx.moveTo(fromCoords.x, fromCoords.y);
            ctx.lineTo(toCoords.x, toCoords.y);
            ctx.stroke();
          } else {
            ctx.strokeStyle = edgeColor;
            ctx.lineWidth = 1; // Normal line width for same band
            ctx.beginPath();
            ctx.moveTo(fromCoords.x, fromCoords.y);
            ctx.lineTo(toCoords.x, toCoords.y);
            ctx.stroke();
          }

          connectionCount++
        } else {
          failedLookups++
        }
      })
    }
  })

  // Connection drawing complete

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
    // Use the placeId directly from the vertex
    vertexMap.set(vertex.placeId, vertex)
  })

  // Drawing places based on vertices

  let drawnCount = 0
  let bridgeNodeCount = 0

  world.places.forEach((place, index) => {
    const vertex = vertexMap.get(place.id)
    if (!vertex) {
      return
    }

    const coords = transform(vertex.x, vertex.y)

    // Check if this is an inter-ecosystem-BAND bridge node (not just inter-ecosystem)
    // Only highlight REGULAR vertices that connect different ecosystem bands
    // Exclude intra-ecosystem bridge vertices (those with id starting with 'bridge-')
    const placeEcosystem = vertex.ecosystem
    const placeBand = getEcosystemBand(placeEcosystem)
    let isBridgeNode = false

    // Only consider regular vertices (not intra-ecosystem bridge vertices) for bridge highlighting
    if (!vertex.id.startsWith('bridge-') && place.exits && Object.keys(place.exits).length > 0) {
      for (const exit of Object.values(place.exits)) {
        const targetVertex = vertexMap.get((exit as any).to)
        if (targetVertex) {
          const targetBand = getEcosystemBand(targetVertex.ecosystem)
          if (targetBand !== placeBand) {
            isBridgeNode = true
            break
          }
        }
      }
    }

    if (isBridgeNode) {
      bridgeNodeCount++
    }

    // Get ecosystem color for the node from the vertex data
    const nodeColor = NODE_COLORS[vertex.ecosystem as keyof typeof NODE_COLORS] || '#ebdbb2'

    // Use larger radius and enhanced styling for bridge nodes
    const radius = isBridgeNode ? 6 : 3
    const borderWidth = isBridgeNode ? 2 : 1

    // Draw place node
    ctx.fillStyle = nodeColor
    ctx.beginPath()
    ctx.arc(coords.x, coords.y, radius, 0, 2 * Math.PI)
    ctx.fill()

    // Draw border with enhanced styling for bridge nodes
    ctx.strokeStyle = isBridgeNode ? '#fe8019' : '#fbf1c7' // Orange for bridges, normal color for others
    ctx.lineWidth = borderWidth
    ctx.stroke()

    // Add an extra inner ring for bridge nodes to make them more prominent
    if (isBridgeNode) {
      ctx.strokeStyle = '#fbf1c7'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(coords.x, coords.y, radius - 1.5, 0, 2 * Math.PI)
      ctx.stroke()
    }

    drawnCount++
  })

  // Finished drawing places
}
