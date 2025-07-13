import React, { useEffect, useRef, useState } from 'react'
import type { WorldGenerationResult, WorldVertex } from '../worldgen/types'
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
  'steppe': '#d79921',        // Yellow - dry steppe
  'grassland': '#b8bb26',     // Green - grassland
  'forest': '#689d6a',        // Aqua - forest
  'mountain': '#928374',      // Gray - mountain
  'jungle': '#98971a',        // Dark green - jungle
  'marsh': '#8ec07c'          // Light aqua - marsh
}

// Ecosystem-specific node colors - fully saturated
const NODE_COLORS = {
  'steppe': '#ff0000',         // Fully saturated red
  'grassland': '#ffff00',      // Fully saturated yellow
  'forest': '#00ff00',         // Fully saturated green
  'mountain': '#ff0000',       // Fully saturated red (same as steppe)
  'jungle': '#00ff00',         // Fully saturated green (same as forest)
  'marsh': '#8b4513'           // Brownish green (saddle brown)
}

// Map ecosystem types to URNs for display
const ECOSYSTEM_URNS = {
  'steppe': 'flux:eco:steppe:arid',
  'grassland': 'flux:eco:grassland:temperate',
  'forest': 'flux:eco:forest:temperate',
  'mountain': 'flux:eco:mountain:arid',
  'jungle': 'flux:eco:jungle:tropical',
  'marsh': 'flux:eco:marsh:tropical'
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
          // Note: In the new structure, vertices don't have separate places
          const place = null
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

  // Handle vertex updates from tooltip (placeholder - no editable places in new structure)
  const handlePlaceUpdate = (vertexId: string, updates: { name?: string; description?: string }) => {
    if (!world) return

    // Note: In the new structure, vertices don't have separate editable places
    // This functionality would need to be implemented differently if needed
    console.log('Vertex update requested:', vertexId, updates)
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
  world.ecosystemBands.forEach((band) => {
    // Calculate horizontal position based on ecosystem band
    const leftX = transform(band.startX, 0).x
    const rightX = transform(band.endX, 0).x
    const labelX = leftX + (rightX - leftX) / 2

    // Only draw if the label would be visible on canvas
    if (labelX >= 0 && labelX <= canvasWidth) {
      // Draw ecosystem label with prominent styling
      ctx.fillStyle = '#ebdbb2' // Gruvbox light text color
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Create a solid black background for maximum legibility
      const urnText = ECOSYSTEM_URNS[band.ecosystem as keyof typeof ECOSYSTEM_URNS]
      const textMetrics = ctx.measureText(urnText)
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
      ctx.fillText(urnText, labelX, urnY)
    }
  })
}

const drawEcosystemBands = (ctx: CanvasRenderingContext2D, world: WorldGenerationResult, transform: (x: number, y: number) => { x: number; y: number }) => {
  // Use actual ecosystem bands from world generation
  world.ecosystemBands.forEach((band) => {
    // Transform world coordinates to canvas coordinates
    // Ecosystem bands span the full height of the world
    const topLeft = transform(band.startX, 0)
    const bottomRight = transform(band.endX, world.spatialMetrics.worldHeightMeters)

    const canvasX = topLeft.x
    const canvasY = topLeft.y
    const canvasWidth = bottomRight.x - topLeft.x
    const canvasHeight = bottomRight.y - topLeft.y

    // Draw band background with low opacity
    ctx.fillStyle = ECOSYSTEM_COLORS[band.ecosystem as keyof typeof ECOSYSTEM_COLORS] + '20' // 20 = ~12% opacity
    ctx.fillRect(canvasX, canvasY, canvasWidth, canvasHeight)

    // Draw band border
    ctx.strokeStyle = ECOSYSTEM_COLORS[band.ecosystem as keyof typeof ECOSYSTEM_COLORS] + '40' // 40 = ~25% opacity
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
  drawVertices(ctx, world, transform)
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

// Update the drawConnections function to use world.edges instead of world.connections
const drawConnections = (
  ctx: CanvasRenderingContext2D,
  world: WorldGenerationResult,
  transform: (x: number, y: number) => { x: number; y: number }
) => {
  // Create a vertex map for efficient lookup
  const vertexMap = new Map<string, WorldVertex>()
  world.vertices.forEach(vertex => {
    vertexMap.set(vertex.id, vertex)
  })

  // Draw edges (river connections)
  world.edges.forEach(edge => {
    const fromVertex = vertexMap.get(edge.fromVertexId)
    const toVertex = vertexMap.get(edge.toVertexId)

    if (!fromVertex || !toVertex) return

    const fromPos = transform(fromVertex.x, fromVertex.y)
    const toPos = transform(toVertex.x, toVertex.y)

    // Draw connection line
    ctx.strokeStyle = '#458588' // Gruvbox blue for river connections
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(fromPos.x, fromPos.y)
    ctx.lineTo(toPos.x, toPos.y)
    ctx.stroke()

    // Draw flow direction arrow if enabled
    if (world.config.showFlowDirection) {
      const arrowSize = 8
      const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x)
      const arrowX = toPos.x - arrowSize * Math.cos(angle)
      const arrowY = toPos.y - arrowSize * Math.sin(angle)

      ctx.fillStyle = '#458588'
      ctx.beginPath()
      ctx.moveTo(toPos.x, toPos.y)
      ctx.lineTo(arrowX - arrowSize * 0.3 * Math.cos(angle - Math.PI / 6), arrowY - arrowSize * 0.3 * Math.sin(angle - Math.PI / 6))
      ctx.lineTo(arrowX - arrowSize * 0.3 * Math.cos(angle + Math.PI / 6), arrowY - arrowSize * 0.3 * Math.sin(angle + Math.PI / 6))
      ctx.closePath()
      ctx.fill()
    }
  })
}

// Update the drawPlaces function to draw vertices instead
const drawVertices = (
  ctx: CanvasRenderingContext2D,
  world: WorldGenerationResult,
  transform: (x: number, y: number) => { x: number; y: number }
) => {
  world.vertices.forEach(vertex => {
    const pos = transform(vertex.x, vertex.y)

    // Draw vertex circle
    const radius = vertex.isOrigin ? 8 : 6
    ctx.fillStyle = NODE_COLORS[vertex.ecosystem as keyof typeof NODE_COLORS] || '#d79921'
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI)
    ctx.fill()

    // Draw border
    ctx.strokeStyle = vertex.isOrigin ? '#fb4934' : '#1d2021' // Red for origin, dark for others
    ctx.lineWidth = vertex.isOrigin ? 3 : 2
    ctx.stroke()

    // Draw vertex ID for debugging (small text)
    if (world.config.showFlowDirection) {
      ctx.fillStyle = '#ebdbb2'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(vertex.id, pos.x, pos.y + radius + 12)
    }
  })
}
