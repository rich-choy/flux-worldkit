import React, { useRef, useEffect, useState } from 'react'
import type { GeneratedWorld, GAEAPlace, Exit } from '@flux'

interface NetworkViewProps {
  world: GeneratedWorld
  selectedPlace: GAEAPlace | null
  onPlaceSelect: (place: GAEAPlace | null) => void
}

interface ViewState {
  zoom: number
  panX: number
  panY: number
}

interface TooltipState {
  place: GAEAPlace | null
  x: number
  y: number
}

// Place Tooltip Component
interface PlaceTooltipProps {
  place: GAEAPlace
  x: number
  y: number
  onClose: () => void
}

const PlaceTooltip: React.FC<PlaceTooltipProps> = ({ place, x, y, onClose }) => {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const connectionCount = Object.keys(place.exits).length

  // Position tooltip to avoid going off-screen
  useEffect(() => {
    if (!tooltipRef.current) return

    const tooltip = tooltipRef.current
    const rect = tooltip.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let adjustedX = x
    let adjustedY = y

    // Adjust horizontal position
    if (x + rect.width > viewportWidth - 20) {
      adjustedX = x - rect.width - 20
    }

    // Adjust vertical position
    if (y + rect.height > viewportHeight - 20) {
      adjustedY = y - rect.height - 20
    }

    // Ensure minimum margins
    adjustedX = Math.max(10, adjustedX)
    adjustedY = Math.max(10, adjustedY)

    tooltip.style.left = `${adjustedX}px`
    tooltip.style.top = `${adjustedY}px`
  }, [x, y])

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 p-3 bg-surface/95 backdrop-blur-sm border border-border rounded-lg shadow-lg max-w-xs"
      style={{ left: x, top: y }}
    >
      <button
        onClick={onClose}
        className="absolute top-1 right-1 text-text-dim hover:text-text-bright transition-colors"
      >
        ×
      </button>

      <div className="space-y-2">
        <div>
          <h3 className="font-bold text-text-bright">{place.name}</h3>
          <p className="text-xs text-text-dim">{typeof place.description === 'string' ? place.description : ''}</p>
        </div>

        <div className="space-y-1 text-sm">
          <div>
            <span className="text-text-dim">Ecosystem:</span>
            <span className="ml-1 text-text">{place.ecology.ecosystem.split(':').pop()?.replace('_', ' ')}</span>
          </div>
          <div>
            <span className="text-text-dim">Connections:</span>
            <span className="ml-1 text-text font-bold">{connectionCount}</span>
          </div>
          <div>
            <span className="text-text-dim">Zone:</span>
            <span className="ml-1 text-text">{place.topology_zone}</span>
          </div>
        </div>

        {Object.keys(place.exits).length > 0 && (
          <div className="border-t border-border pt-2">
            <h4 className="text-sm font-semibold text-text-bright mb-1">Connected to:</h4>
            <div className="space-y-1 text-xs">
              {Object.entries(place.exits).map(([direction, exit]) => (
                <div key={direction} className="border-l-2 border-accent pl-2">
                  <div className="font-medium text-text">{direction}</div>
                  <div className="text-text-dim">{exit.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const NetworkView: React.FC<NetworkViewProps> = ({
  world,
  selectedPlace,
  onPlaceSelect
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Zoom and pan state
  const [viewState, setViewState] = useState<ViewState>({
    zoom: 1,
    panX: 0,
    panY: 0
  })

  // Pan state for mouse dragging
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragStartPan, setDragStartPan] = useState({ x: 0, y: 0 })

  // Tooltip state
  const [tooltip, setTooltip] = useState<TooltipState>({
    place: null,
    x: 0,
    y: 0
  })

  useEffect(() => {
    if (world) {
      renderNetworkView()
    }
  }, [world, selectedPlace, viewState])

    // Calculate connectivity color based on number of connections
  // const getConnectivityColor = (connectionCount: number, minConnections: number, maxConnections: number): string => {
  //   if (maxConnections === minConnections) return '#666'

  //   // Normalize to 0-1 range based on actual min/max
  //   const ratio = (connectionCount - minConnections) / (maxConnections - minConnections)

  //   // Interpolate between blue (cool, low connections) and red (hot, high connections)
  //   const r = Math.round(255 * ratio)
  //   const g = Math.round(255 * (1 - Math.abs(ratio - 0.5) * 2)) // Peak at middle
  //   const b = Math.round(255 * (1 - ratio))

  //   return `rgb(${r}, ${g}, ${b})`
  // }

  const getVisiblePlaces = () => {
    const canvas = canvasRef.current
    if (!canvas || !world) return new Map()

    const rect = canvas.getBoundingClientRect()
    const worldRadius = world.config.topology.ecosystem_slices.outer_radius
    const centerX = world.config.topology.central_crater.center[0]
    const centerY = world.config.topology.central_crater.center[1]
    const baseScale = Math.min(rect.width, rect.height) / (worldRadius * 2.2)
    const scale = baseScale * viewState.zoom
    const offsetX = rect.width / 2 - centerX * scale + viewState.panX
    const offsetY = rect.height / 2 - centerY * scale + viewState.panY

    const visiblePlaces = new Map<string, { place: GAEAPlace, canvasX: number, canvasY: number }>()

    world.places.forEach(place => {
      if (!place.coordinates) return

      const [x, y] = place.coordinates
      const canvasX = x * scale + offsetX
      const canvasY = y * scale + offsetY

      visiblePlaces.set(place.id, { place, canvasX, canvasY })
    })

    return visiblePlaces
  }

  const renderNetworkView = () => {
    const canvas = canvasRef.current
    if (!canvas || !world) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()

    // Set canvas size
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    ctx.clearRect(0, 0, rect.width, rect.height)

    // Calculate world bounds with zoom and pan
    const worldRadius = world.config.topology.ecosystem_slices.outer_radius
    const centerX = world.config.topology.central_crater.center[0]
    const centerY = world.config.topology.central_crater.center[1]

    // Scale and offset for canvas with zoom and pan
    const baseScale = Math.min(rect.width, rect.height) / (worldRadius * 2.2)
    const scale = baseScale * viewState.zoom
    const offsetX = rect.width / 2 - centerX * scale + viewState.panX
    const offsetY = rect.height / 2 - centerY * scale + viewState.panY

    // Draw ecosystem boundaries (HUD overlay)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    // Central crater boundary
    ctx.beginPath()
    ctx.arc(
      centerX * scale + offsetX,
      centerY * scale + offsetY,
      world.config.topology.central_crater.radius * scale,
      0,
      Math.PI * 2
    )
    ctx.stroke()

    // Mountain ring boundaries
    ctx.beginPath()
    ctx.arc(
      centerX * scale + offsetX,
      centerY * scale + offsetY,
      world.config.topology.mountain_ring.inner_radius * scale,
      0,
      Math.PI * 2
    )
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(
      centerX * scale + offsetX,
      centerY * scale + offsetY,
      world.config.topology.mountain_ring.outer_radius * scale,
      0,
      Math.PI * 2
    )
    ctx.stroke()

    // Outer ecosystem boundary
    ctx.beginPath()
    ctx.arc(
      centerX * scale + offsetX,
      centerY * scale + offsetY,
      world.config.topology.ecosystem_slices.outer_radius * scale,
      0,
      Math.PI * 2
    )
    ctx.stroke()

    // Draw fractal trail network instead of pizza slice boundaries
    if (world.trail_network && world.trail_network.allSegments) {
      // Draw trail segments with branching hierarchy
      const trailColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff']

      for (let i = 0; i < world.trail_network.trailSystems.length; i++) {
        const trailSystem = world.trail_network.trailSystems[i]
        const trailColor = trailColors[i % trailColors.length]

        // Draw trail segments for this system
        for (const segment of trailSystem.segments) {
          const segmentX = segment.position[0] * scale + offsetX
          const segmentY = segment.position[1] * scale + offsetY

          if (segment.parentId) {
            const parent = world.trail_network.allSegments.find(s => s.id === segment.parentId)
            if (parent) {
              const parentX = parent.position[0] * scale + offsetX
              const parentY = parent.position[1] * scale + offsetY

              // Line thickness decreases with depth (branching level)
              const lineWidth = Math.max(0.5, 3 - segment.depth * 0.5)
              const alpha = Math.max(0.3, 1 - segment.depth * 0.2)

              ctx.strokeStyle = trailColor.replace(')', `, ${alpha})`)
              ctx.lineWidth = lineWidth
              ctx.beginPath()
              ctx.moveTo(parentX, parentY)
              ctx.lineTo(segmentX, segmentY)
              ctx.stroke()
            }
          }
        }
      }

      // Draw intersection points
      if (world.trail_network.intersectionPoints) {
        ctx.fillStyle = '#ffffff'
        for (const intersection of world.trail_network.intersectionPoints) {
          const intX = intersection.position[0] * scale + offsetX
          const intY = intersection.position[1] * scale + offsetY

          ctx.beginPath()
          ctx.arc(intX, intY, 4 * viewState.zoom, 0, Math.PI * 2)
          ctx.fill()

          // Add border
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }
    }

    // Get visible places for rendering
    const visiblePlaces = getVisiblePlaces()

    // Draw trail territory connections instead of exit-based connections
    if (world.trail_network && world.trail_network.trailSystems) {
      const territoryColors = ['#ff664488', '#66ff4488', '#4466ff88', '#ffff4488', '#ff44ff88', '#44ffff88']

      for (let i = 0; i < world.trail_network.trailSystems.length; i++) {
        const trailSystem = world.trail_network.trailSystems[i]
        const territoryColor = territoryColors[i % territoryColors.length]

        // Draw connections between places in the same trail territory
        const territoryPlaces = world.places.filter(p => p.trail_territory_id === trailSystem.id)

        for (const place of territoryPlaces) {
          const placePos = visiblePlaces.get(place.id)
          if (!placePos) continue

          // Connect to nearby places in the same territory
          for (const otherPlace of territoryPlaces) {
            if (place.id === otherPlace.id) continue

            const otherPlacePos = visiblePlaces.get(otherPlace.id)
            if (!otherPlacePos) continue

            // Only draw if they're actually connected via exits
            if (Object.values(place.exits).some(exit => (exit as Exit).to === otherPlace.id)) {
              ctx.strokeStyle = territoryColor
              ctx.lineWidth = 1
              ctx.beginPath()
              ctx.moveTo(placePos.canvasX, placePos.canvasY)
              ctx.lineTo(otherPlacePos.canvasX, otherPlacePos.canvasY)
              ctx.stroke()
            }
          }
        }
      }
    }

        // Draw places colored by trail territory
    visiblePlaces.forEach(({ place, canvasX, canvasY }) => {
      let color = '#666666' // Default color for places without trail territory

      // Color by trail territory
      if (world.trail_network && place.trail_territory_id) {
        const trailSystemIndex = world.trail_network.trailSystems.findIndex(ts => ts.id === place.trail_territory_id)
        if (trailSystemIndex !== -1) {
          const territoryColors = ['#ff6666', '#66ff66', '#6666ff', '#ffff66', '#ff66ff', '#66ffff']
          color = territoryColors[trailSystemIndex % territoryColors.length]
        }
      }

      // Draw dot - sized based on connection count
      const connectionCount = Object.keys(place.exits).length
      const dotSize = Math.max(1, 1 + connectionCount * 0.3) * viewState.zoom

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(canvasX, canvasY, dotSize, 0, Math.PI * 2)
      ctx.fill()

      // Add subtle border for better visibility
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Highlight selected place
      if (selectedPlace && selectedPlace.id === place.id) {
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(canvasX, canvasY, Math.max(2, 3 * viewState.zoom), 0, Math.PI * 2)
        ctx.stroke()
      }
    })

    // Draw trail territory legend
    drawTrailTerritoryLegend(ctx, rect)
  }

  const drawTrailTerritoryLegend = (ctx: CanvasRenderingContext2D, rect: DOMRect) => {
    if (!world.trail_network) return

    const legendX = rect.width - 150
    const legendY = 20
    const legendWidth = 120
    const legendHeight = Math.max(80, 20 + world.trail_network.trailSystems.length * 25)

    // Legend background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight)

    // Legend border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight)

    // Legend title
    ctx.fillStyle = '#fff'
    ctx.font = '12px sans-serif'
    ctx.fillText('Trail Territories', legendX + 10, legendY + 20)

    // Trail territory colors
    const territoryColors = ['#ff6666', '#66ff66', '#6666ff', '#ffff66', '#ff66ff', '#66ffff']

    for (let i = 0; i < world.trail_network.trailSystems.length; i++) {
      const color = territoryColors[i % territoryColors.length]
      const yPos = legendY + 35 + i * 20

      // Draw color swatch
      ctx.fillStyle = color
      ctx.fillRect(legendX + 10, yPos - 8, 12, 12)

      // Draw label
      ctx.fillStyle = '#fff'
      ctx.font = '10px sans-serif'
      ctx.fillText(`Trail ${i + 1}`, legendX + 28, yPos)
    }
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Don't handle click if we were dragging
    if (isDragging) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top

    // Find clicked place from visible places
    const visiblePlaces = getVisiblePlaces()
    for (const { place, canvasX, canvasY } of visiblePlaces.values()) {
      const dx = clickX - canvasX
      const dy = clickY - canvasY
      const distanceFromClick = Math.sqrt(dx * dx + dy * dy)

      if (distanceFromClick < Math.max(3, 2.5 * viewState.zoom)) {
        onPlaceSelect(place)
        // Show tooltip at click position
        setTooltip({
          place,
          x: event.clientX,
          y: event.clientY
        })
        return
      }
    }

    // If no place was clicked, deselect and hide tooltip
    onPlaceSelect(null)
    setTooltip({ place: null, x: 0, y: 0 })
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    setDragStart({ x: event.clientX, y: event.clientY })
    setDragStartPan({ x: viewState.panX, y: viewState.panY })
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return

    const deltaX = event.clientX - dragStart.x
    const deltaY = event.clientY - dragStart.y

    setViewState(prev => ({
      ...prev,
      panX: dragStartPan.x + deltaX,
      panY: dragStartPan.y + deltaY
    }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    // Zoom towards mouse cursor
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.1, Math.min(5, viewState.zoom * zoomFactor))

    // Calculate pan adjustment to zoom towards mouse
    const zoomChange = newZoom / viewState.zoom
    const newPanX = mouseX - (mouseX - viewState.panX) * zoomChange
    const newPanY = mouseY - (mouseY - viewState.panY) * zoomChange

    setViewState({
      zoom: newZoom,
      panX: newPanX,
      panY: newPanY
    })
  }

  const resetView = () => {
    setViewState({
      zoom: 1,
      panX: 0,
      panY: 0
    })
  }

  const handleCloseTooltip = () => {
    setTooltip({ place: null, x: 0, y: 0 })
    onPlaceSelect(null)
  }

  return (
    <div className="network-view flex h-screen">
      {/* Sidebar */}
      <div className="w-80 bg-surface border-r border-border flex-shrink-0 overflow-y-auto">
        <div className="p-4">
          <div className="space-y-4">
            {/* Title */}
            <div>
              <h1 className="text-sm font-bold text-text-bright">Network View</h1>
              <p className="text-text-dim text-xs">Place connectivity visualization</p>
            </div>

            {/* Info */}
            <div className="border-t border-border pt-4">
              <div className="space-y-3 text-sm">
                <div className="bg-surface/50 p-3 rounded border border-border">
                  <h3 className="font-semibold text-text-bright mb-2">How to read this view:</h3>
                  <ul className="space-y-1 text-xs text-text-dim">
                    <li>• <span className="text-red-400">Red dots</span> = highly connected places</li>
                    <li>• <span className="text-blue-400">Blue dots</span> = less connected places</li>
                    <li>• <span className="text-white opacity-30">Gray lines</span> = connections between places</li>
                    <li>• <span className="text-white opacity-10">Faint boundaries</span> = ecosystem zones</li>
                  </ul>
                </div>

                {world && (
                  <div className="bg-surface/50 p-3 rounded border border-border">
                    <h3 className="font-semibold text-text-bright mb-2">World Statistics:</h3>
                    <div className="space-y-1 text-xs text-text-dim">
                      <div>Total places: {world.places.length}</div>
                      <div>Total connections: {world.places.reduce((sum, p) => sum + Object.keys(p.exits).length, 0)}</div>
                      <div>Avg connections per place: {(world.places.reduce((sum, p) => sum + Object.keys(p.exits).length, 0) / world.places.length).toFixed(2)}</div>
                      <div>Min connections: {Math.min(...world.places.map(p => Object.keys(p.exits).length))}</div>
                      <div>Max connections: {Math.max(...world.places.map(p => Object.keys(p.exits).length))}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative">
        {world ? (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleCanvasClick}
            onWheel={handleWheel}
            className="w-full h-full"
            style={{
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-text-dim mb-2">No world generated</h3>
              <p className="text-text-dim">Generate a world in the Spatial view to see the network</p>
            </div>
          </div>
        )}

        {/* Camera Controls */}
        <div className="absolute bottom-2 right-2 z-10 bg-surface/95 backdrop-blur-sm border border-border rounded-lg overflow-hidden shadow-lg">
          <div className="flex flex-col">
            <button
              onClick={() => setViewState(prev => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.25) }))}
              className="p-2 hover:bg-surface/80 transition-colors border-b border-border"
              title="Zoom In"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-text-bright"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>

            <button
              onClick={() => setViewState(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom * 0.8) }))}
              className="p-2 hover:bg-surface/80 transition-colors border-b border-border"
              title="Zoom Out"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-text-bright"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>

            <button
              onClick={resetView}
              className="p-2 hover:bg-surface/80 transition-colors"
              title="Reset View"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-text-bright"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Instructions */}
        <div className="absolute bottom-2 left-2 z-10 bg-surface/90 backdrop-blur-sm border border-border rounded-lg p-2">
          <div className="text-xs text-text-dim space-y-1">
            <div>🖱️ <strong>Drag:</strong> Pan around</div>
            <div>🌀 <strong>Scroll:</strong> Zoom in/out</div>
            <div>👆 <strong>Click:</strong> Select place</div>
          </div>
        </div>

        {/* Place Tooltip */}
        {tooltip.place && (
          <PlaceTooltip
            place={tooltip.place}
            x={tooltip.x}
            y={tooltip.y}
            onClose={handleCloseTooltip}
          />
        )}
      </div>
    </div>
  )
}
