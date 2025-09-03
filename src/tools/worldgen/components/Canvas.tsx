import React, { useEffect, useRef, useState } from 'react'
import type { WorldGenerationResult, WorldVertex } from '../../../worldgen/types'
import { findShortestPathFromOrigin } from '../../../worldgen'
import type { Place, EcosystemURN, Biome } from 'flux-game'
import VertexTooltip from './VertexTooltip'

interface CanvasProps {
  world: WorldGenerationResult | null
  zoom: number
  panX: number
  panY: number
}

// Helper function to extract biome from ecosystem URN
function getBiomeFromURN(ecosystemURN: EcosystemURN): Biome {
  return ecosystemURN.split(':')[2] as Biome;
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
  'steppe': '#8b4513',         // Brown - earthy arid steppe
  'grassland': '#ffff00',      // Fully saturated yellow
  'forest': '#00ff00',         // Fully saturated green
  'mountain': '#ff0000',       // Red - rocky mountains
  'jungle': '#006400',         // Dark green - darker than forest
  'marsh': '#4682B4'           // Steel blue - wetland water
}

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

  // Path tracing state
  const [tracedPath, setTracedPath] = useState<string[]>([])
  const [pulseStartTime, setPulseStartTime] = useState<number>(0)
  const pathTraceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Animation frame for pulse effect
  const animationFrameRef = useRef<number | null>(null)

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

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = '#1d2021' // Gruvbox hard background
      ctx.fillRect(0, 0, dimensions.width, dimensions.height)

      // Draw world if available
      if (world && world.vertices?.length > 0) {
        drawWorld(ctx, world, dimensions.width, dimensions.height, zoom, panX, panY, tracedPath, pulseStartTime)
      }
    }

    // Initial draw
    draw()

    // Set up animation loop for pulse effect only if there's a traced path
    if (tracedPath.length > 0 && pulseStartTime > 0) {
      const animate = () => {
        draw()
        animationFrameRef.current = requestAnimationFrame(animate)
      }
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [world, dimensions.width, dimensions.height, zoom, panX, panY, tracedPath, pulseStartTime])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
      if (pathTraceTimeoutRef.current) {
        clearTimeout(pathTraceTimeoutRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Hit detection function
  const findVertexAtPosition = (canvasX: number, canvasY: number): WorldVertex | null => {
    if (!world) return null

    // Use the EXACT same transform function as drawWorld
    const availableCanvasHeight = dimensions.height

    const worldBounds = getWorldBounds(world.vertices)
    const scaleX = dimensions.width / worldBounds.width
    const scaleY = availableCanvasHeight / worldBounds.height
    const baseScale = Math.min(scaleX, scaleY) * 0.9 // 90% to add padding
    const scale = baseScale * zoom // Apply zoom multiplier

    // Calculate offset to center the world in the available space (below URN area)
    const worldCenterX = worldBounds.minX + worldBounds.width / 2
    const worldCenterY = worldBounds.minY + worldBounds.height / 2
    const canvasCenterX = dimensions.width / 2
    const canvasCenterY = (availableCanvasHeight / 2) - 25 // Center the graph vertically

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
        console.log('🖱️ Hovering over new vertex:', vertex.id, vertex.ecosystem, `(${vertex.gridX}, ${vertex.gridY})`)

        // Clear existing hover timeout
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current)
        }

        // Set new hover timeout (200ms delay)
        hoverTimeoutRef.current = setTimeout(() => {
          // Create a basic place object from vertex data for tooltip display
          const biome = getBiomeFromURN(vertex.ecosystem);
          const place = {
            id: vertex.id,
            urn: `flux:place:${biome}`,
            type: 'place',
            name: `${biome.charAt(0).toUpperCase() + biome.slice(1)} Location`,
            description: `A location in the ${biome} biome at coordinates (${vertex.gridX}, ${vertex.gridY}).`,
            exits: {},
            resources: {}
          } as unknown as Place;

          setHoveredVertex(vertex)
          setHoveredPlace(place)
          setTooltipPosition({ x: e.clientX, y: e.clientY })
          setIsTooltipVisible(true)
        }, 200)

                // Path tracing is now handled by click, not mouseover
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

      // Clear path trace timeout
      if (pathTraceTimeoutRef.current) {
        clearTimeout(pathTraceTimeoutRef.current)
        pathTraceTimeoutRef.current = null
      }

      // Don't immediately clear traced path - let it fade naturally

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

    // Don't clear path trace timeout - let animations complete
    // Path will naturally fade after the animation duration

    // Only hide tooltip if not hovered, with a delay to reduce flickering
    if (!isTooltipHovered) {
      hideTimeoutRef.current = setTimeout(() => {
        if (!isTooltipHovered) {
          setIsTooltipVisible(false)
          setHoveredVertex(null)
          setHoveredPlace(null)
        }
      }, 500) // Longer delay to reduce flickering
    }
  }

    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!world) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    const vertex = findVertexAtPosition(canvasX, canvasY)

    if (vertex) {
      // Clear previous traced path when starting new trace
      setTracedPath([])
      setPulseStartTime(0)

      // Start path tracing immediately on click
      if (world && world.vertices && world.edges) {
        console.log('🔍 Tracing path to vertex:', vertex.id, vertex.ecosystem, `(${vertex.gridX}, ${vertex.gridY})`)
        const path = findShortestPathFromOrigin(world.vertices, world.edges, vertex.id)
        console.log('📍 Found path:', path)
        if (path && path.length > 0) {
          setTracedPath(path)
          setPulseStartTime(Date.now())
          console.log('✨ Starting pulse animation with', path.length, 'vertices')

          // Path now persists until next click - no auto-clear timeout
        } else {
          console.log('❌ No path found')
        }
      }
    } else {
      // Clicked on empty space - clear any existing path
      console.log('🚫 Clicked on empty space - clearing path')
      setTracedPath([])
      setPulseStartTime(0)
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
        onClick={handleClick}
      />

      {/* Tooltip */}
      {isTooltipVisible && hoveredVertex && hoveredPlace && (
        <VertexTooltip
          vertex={hoveredVertex}
          place={hoveredPlace}
          position={tooltipPosition}
          isVisible={isTooltipVisible}
          onClose={() => setIsTooltipVisible(false)}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        />
      )}
    </div>
  )
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

const drawWorld = (ctx: CanvasRenderingContext2D, world: WorldGenerationResult, canvasWidth: number, canvasHeight: number, zoom: number, panX: number, panY: number, tracedPath: string[] = [], pulseStartTime: number = 0) => {
  if (!world.vertices.length) return

  // Reserve space at the top for URN labels
  const availableCanvasHeight = canvasHeight

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
  const canvasCenterY = (availableCanvasHeight / 2) - 25 // Center the graph vertically

  // Transform world coordinates to canvas coordinates (with zoom and pan)
  const transform = (x: number, y: number) => ({
    x: (x - worldCenterX) * scale + canvasCenterX + panX,
    y: (y - worldCenterY) * scale + canvasCenterY + panY
  })

  // Draw ecosystem bands first (background)
  drawEcosystemBands(ctx, world, transform)



  // Draw connections second (so they appear behind places)
  drawConnections(ctx, world, transform, tracedPath, pulseStartTime)

  // Draw places last (so they appear on top)
  drawVertices(ctx, world, transform, tracedPath, pulseStartTime)
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

// Helper function to create a lighter, more transparent version of a color for pulse effects
const createPulseColor = (baseColor: string, brightness: number = 1): string => {
  // Remove # if present
  const hex = baseColor.replace('#', '')

  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)

  // Lighten the color by mixing with white
  const lightR = Math.min(255, Math.round(r + (255 - r) * 0.4 * brightness))
  const lightG = Math.min(255, Math.round(g + (255 - g) * 0.4 * brightness))
  const lightB = Math.min(255, Math.round(b + (255 - b) * 0.4 * brightness))

  return `rgb(${lightR}, ${lightG}, ${lightB})`
}

// Update the drawConnections function to use world.edges instead of world.connections
const drawConnections = (
  ctx: CanvasRenderingContext2D,
  world: WorldGenerationResult,
  transform: (x: number, y: number) => { x: number; y: number },
  tracedPath: string[] = [],
  pulseStartTime: number = 0,
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

    // Check if this edge is part of the traced path
    const isTracedEdge = tracedPath.length > 0 &&
      tracedPath.includes(fromVertex.id) &&
      tracedPath.includes(toVertex.id) &&
      Math.abs(tracedPath.indexOf(fromVertex.id) - tracedPath.indexOf(toVertex.id)) === 1

    // Calculate edge color based on connected vertices
    const fromBiome = getBiomeFromURN(fromVertex.ecosystem);
    const toBiome = getBiomeFromURN(toVertex.ecosystem);
    const fromVertexColor = NODE_COLORS[fromBiome as keyof typeof NODE_COLORS] || '#83a598'
    const toVertexColor = NODE_COLORS[toBiome as keyof typeof NODE_COLORS] || '#83a598'

    let edgeColor: string
    if (fromVertex.ecosystem === toVertex.ecosystem) {
      // Same ecosystem - use muted version of that color
      edgeColor = muteColor(fromVertexColor)
    } else {
      // Different ecosystems - blend the colors and then mute
      const blendedColor = blendColors(fromVertexColor, toVertexColor)
      edgeColor = muteColor(blendedColor)
    }

    // Draw connection line
    ctx.strokeStyle = edgeColor
    ctx.lineWidth = 2

            // Add pulse effect for traced edges
    if (isTracedEdge && pulseStartTime > 0) {
      const currentTime = Date.now()
      const elapsedTime = currentTime - pulseStartTime

      // Calculate propagation delay based on position in path
      const fromIndex = tracedPath.indexOf(fromVertex.id)
      const toIndex = tracedPath.indexOf(toVertex.id)
      const edgeIndex = Math.min(fromIndex, toIndex) // Use the earlier vertex in the path
      const propagationDelay = edgeIndex * 50 // 50ms delay per step
      const adjustedElapsedTime = elapsedTime - propagationDelay



      // Only show pulse if enough time has passed for this edge
      if (adjustedElapsedTime > 0) {
        const pulseSpeed = 1000 // milliseconds for one pulse cycle
        const pulsePhase = Math.min(adjustedElapsedTime / pulseSpeed, 1.0) // Cap at 1.0 to prevent looping

        // Create pulsing effect with a brighter color (no looping)
        const pulseBrightness = 0.5 + 0.5 * Math.sin(pulsePhase * Math.PI * 2)
        const pulseAlpha = 0.3 + 0.2 * pulseBrightness // Reduced opacity range

        // Draw pulse background
        ctx.save()
        ctx.globalAlpha = pulseAlpha
        const fromBiome = getBiomeFromURN(fromVertex.ecosystem);
      const fromVertexColor = NODE_COLORS[fromBiome as keyof typeof NODE_COLORS] || '#83a598'
        ctx.strokeStyle = createPulseColor(fromVertexColor, pulseBrightness) // Use vertex-specific color
        ctx.lineWidth = 8 + 4 * pulseBrightness // Consistent pixel size regardless of zoom
        ctx.beginPath()
        ctx.moveTo(fromPos.x, fromPos.y)
        ctx.lineTo(toPos.x, toPos.y)
        ctx.stroke()
        ctx.restore()
      }
    }
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
  transform: (x: number, y: number) => { x: number; y: number },
  tracedPath: string[] = [],
  pulseStartTime: number = 0,
) => {


  world.vertices.forEach(vertex => {
    const pos = transform(vertex.x, vertex.y)

    // Check if this vertex is part of the traced path
    const isTracedVertex = tracedPath.includes(vertex.id)

            // Draw pulse effect for traced vertices
    if (isTracedVertex && pulseStartTime > 0) {
      const currentTime = Date.now()
      const elapsedTime = currentTime - pulseStartTime

      // Calculate propagation delay based on position in path
      const vertexIndex = tracedPath.indexOf(vertex.id)
      const propagationDelay = vertexIndex * 50 // 50ms delay per step
      const adjustedElapsedTime = elapsedTime - propagationDelay

      // Only show pulse if enough time has passed for this vertex
      if (adjustedElapsedTime > 0) {
        const pulseSpeed = 1000 // milliseconds for one pulse cycle
        const pulsePhase = Math.min(adjustedElapsedTime / pulseSpeed, 1.0) // Cap at 1.0 to prevent looping

        // Create pulsing effect with expanding circle (no looping)
        const pulseBrightness = 0.5 + 0.5 * Math.sin(pulsePhase * Math.PI * 2)
        const pulseAlpha = 0.2 + 0.3 * pulseBrightness // Reduced opacity range
        const baseRadius = (15 + 8 * pulseBrightness) * 0.618     // Base radius range (61.8% of original)
        const pulseRadius = baseRadius // Keep consistent pixel size regardless of zoom



        // Draw pulse halo
        ctx.save()
        ctx.globalAlpha = pulseAlpha
        const biome = getBiomeFromURN(vertex.ecosystem);
    const vertexColor = NODE_COLORS[biome as keyof typeof NODE_COLORS] || '#83a598'
        ctx.fillStyle = createPulseColor(vertexColor, pulseBrightness) // Use vertex-specific color
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, pulseRadius, 0, 2 * Math.PI)
        ctx.fill()
        ctx.restore()
      }
    }

    // Draw vertex circle
    const radius = vertex.isOrigin ? 8 : 6
    const biome = getBiomeFromURN(vertex.ecosystem);
    ctx.fillStyle = NODE_COLORS[biome as keyof typeof NODE_COLORS] || '#d79921'
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
