import React, { useRef, useEffect, useState } from 'react';
import type { GeneratedWorld, GAEAPlace } from '@flux';
import {
  getBiomeColor, getUniqueBiomes,
  getUniqueClimates,
  parseEcosystemURN
} from '~/lib/ecosystem-utils';
import { createSimpleTileset } from '~/lib/simple-tileset';

// Place Tooltip Component
interface PlaceTooltipProps {
  place: GAEAPlace
  x: number
  y: number
  onClose: () => void
}

const PlaceTooltip: React.FC<PlaceTooltipProps> = ({ place, x, y, onClose }) => {
  const tooltipRef = useRef<HTMLDivElement>(null)

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
      className="fixed z-50 bg-surface/95 backdrop-blur-sm border border-border rounded-lg p-4 max-w-sm shadow-lg"
      style={{ left: x, top: y }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-text-dim hover:text-text-bright text-lg leading-none"
      >
        ×
      </button>

      <div className="space-y-3">
        {/* Place Header */}
        <div>
          <h3 className="text-lg font-bold text-text-bright mb-1">{place.name}</h3>
          <p className="text-text-dim text-sm">
            {typeof place.description === 'string' ? place.description : 'Generated description'}
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
            <div>
              <span className="text-text-dim">ID:</span>
              <span className="ml-1 text-text font-mono text-xs">{place.id}</span>
            </div>
            <div>
              <span className="text-text-dim">Coordinates:</span>
              <span className="ml-1 text-text font-mono text-xs">
                {place.coordinates ?
                  `(${place.coordinates[0].toFixed(1)}, ${place.coordinates[1].toFixed(1)})` :
                  'N/A'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Ecology */}
        <div className="border-t border-border pt-3">
          <h4 className="text-sm font-semibold text-text-bright mb-2">Ecology</h4>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-text-dim">Ecosystem:</span>
              <span className="ml-1 text-text">{place.ecology.ecosystem}</span>
            </div>
            <div>
              <span className="text-text-dim">Temperature:</span>
              <span className="ml-1 text-text">
                {place.ecology.temperature[0]}°C - {place.ecology.temperature[1]}°C
              </span>
            </div>
            <div>
              <span className="text-text-dim">Pressure:</span>
              <span className="ml-1 text-text">
                {place.ecology.pressure[0]} - {place.ecology.pressure[1]} hPa
              </span>
            </div>
            <div>
              <span className="text-text-dim">Humidity:</span>
              <span className="ml-1 text-text">
                {place.ecology.humidity[0]}% - {place.ecology.humidity[1]}%
              </span>
            </div>
          </div>
        </div>

        {/* Current Weather */}
        <div className="border-t border-border pt-3">
          <h4 className="text-sm font-semibold text-text-bright mb-2">Current Weather</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-text-dim">Temp:</span>
              <span className="ml-1 text-text">{place.weather.temperature.toFixed(1)}°C</span>
            </div>
            <div>
              <span className="text-text-dim">Pressure:</span>
              <span className="ml-1 text-text">{place.weather.pressure.toFixed(1)} hPa</span>
            </div>
            <div>
              <span className="text-text-dim">Humidity:</span>
              <span className="ml-1 text-text">{place.weather.humidity.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-text-dim">Rain:</span>
              <span className="ml-1 text-text">{place.weather.precipitation.toFixed(1)} mm</span>
            </div>
            <div>
              <span className="text-text-dim">PPFD:</span>
              <span className="ml-1 text-text">{place.weather.ppfd.toFixed(1)} μmol/m²/s</span>
            </div>
            <div>
              <span className="text-text-dim">Clouds:</span>
              <span className="ml-1 text-text">{place.weather.clouds.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* G.A.E.A. Management */}
        <div className="border-t border-border pt-3">
          <h4 className="text-sm font-semibold text-text-bright mb-2">G.A.E.A. Management</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-text-dim">Optimization:</span>
              <span className="ml-1 text-text">{place.gaea_management.optimization_level.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-text-dim">Predators:</span>
              <span className="ml-1 text-text">{place.gaea_management.apex_predator_density.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-text-dim">Resources:</span>
              <span className="ml-1 text-text">{place.gaea_management.resource_concentration.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-text-dim">Fungal:</span>
              <span className="ml-1 text-text">{place.gaea_management.fungal_cultivation_intensity.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-text-dim">Stability:</span>
              <span className="ml-1 text-text">{place.gaea_management.territorial_stability.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-text-dim">Worshippers:</span>
              <span className="ml-1 text-text">{place.gaea_management.worshipper_presence.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Exits */}
        {Object.keys(place.exits).length > 0 && (
          <div className="border-t border-border pt-3">
            <h4 className="text-sm font-semibold text-text-bright mb-2">Exits</h4>
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

        {/* Additional Info */}
        <div className="border-t border-border pt-3">
          <h4 className="text-sm font-semibold text-text-bright mb-2">Additional Info</h4>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-text-dim">Zone:</span>
              <span className="ml-1 text-text">{place.topology_zone}</span>
            </div>
            <div>
              <span className="text-text-dim">Distance from Center:</span>
              <span className="ml-1 text-text">{place.distance_from_center.toFixed(2)}</span>
            </div>
            {place.ecosystem_slice_id && (
              <div>
                <span className="text-text-dim">Ecosystem Slice:</span>
                <span className="ml-1 text-text">{place.ecosystem_slice_id}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Enhanced tile rendering using actual tileset
class SimpleTileRenderer {
  private tileset: HTMLImageElement | null = null
  private tileSize = 16
  private tilesLoaded = false

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const tilesetDataUrl = createSimpleTileset()
        const img = new Image()

        img.onload = () => {
          this.tileset = img
          this.tilesLoaded = true
          resolve()
        }

        img.onerror = () => {
          reject(new Error('Failed to load generated tileset'))
        }

        img.src = tilesetDataUrl
      } catch (error) {
        reject(error)
      }
    })
  }

  getTileCoords(place: GAEAPlace): { x: number; y: number } {
    const ecosystemData = parseEcosystemURN(place.ecology.ecosystem)

    if (!ecosystemData) {
      return { x: 15, y: 15 } // Unknown tile
    }

    const { biome, climate } = ecosystemData

    // Special case: forest:montane should render as forest (montane forest)
    if (biome === 'forest' && climate === 'montane') {
      const forestVariants = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]
      const forestIndex = this.hashPlace(place.id) % forestVariants.length
      return forestVariants[forestIndex]
    }

    // Special case: mountain:alpine should render as mountain
    if (biome === 'mountain' && climate === 'alpine') {
      const mountainVariants = [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }]
      const mountainIndex = this.hashPlace(place.id) % mountainVariants.length
      return mountainVariants[mountainIndex]
    }

    // Special case: crater:lake should render as water
    if (biome === 'crater' && climate === 'lake') {
      const waterVariants = [{ x: 13, y: 0 }, { x: 14, y: 0 }]
      const waterIndex = this.hashPlace(place.id) % waterVariants.length
      return waterVariants[waterIndex]
    }

    // Map biomes to tile coordinates
    switch (biome) {
      case 'forest':
        // Use variants for visual variety
        const forestVariants = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]
        const forestIndex = this.hashPlace(place.id) % forestVariants.length
        return forestVariants[forestIndex]

      case 'grassland':
        const grassVariants = [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }]
        const grassIndex = this.hashPlace(place.id) % grassVariants.length
        return grassVariants[grassIndex]

      case 'mountain':
        const mountainVariants = [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }]
        const mountainIndex = this.hashPlace(place.id) % mountainVariants.length
        return mountainVariants[mountainIndex]

      case 'wetland':
        // Wetland tiles (using swamp tiles for now)
        const wetlandVariants = [{ x: 11, y: 0 }, { x: 12, y: 0 }]
        const wetlandIndex = this.hashPlace(place.id) % wetlandVariants.length
        return wetlandVariants[wetlandIndex]

      case 'water':
        // Water/lake tiles
        const waterVariants = [{ x: 13, y: 0 }, { x: 14, y: 0 }]
        const waterIndex = this.hashPlace(place.id) % waterVariants.length
        return waterVariants[waterIndex]

      default:
        return { x: 15, y: 15 } // Fallback
    }
  }

  renderTile(
    ctx: CanvasRenderingContext2D,
    place: GAEAPlace,
    x: number,
    y: number,
    scale: number = 1
  ): void {
    if (!this.tileset || !this.tilesLoaded) {
      // Fallback rendering with ecosystem color
      const atoms = parseEcosystemURN(place.ecology.ecosystem)
      const color = atoms ? getBiomeColor(place.ecology.ecosystem) : '#888'

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, 4 * scale, 0, Math.PI * 2)
      ctx.fill()
      return
    }

    const { x: tileX, y: tileY } = this.getTileCoords(place)
    const sourceX = tileX * this.tileSize
    const sourceY = tileY * this.tileSize
    const destSize = this.tileSize * scale

    ctx.drawImage(
      this.tileset,
      sourceX, sourceY, this.tileSize, this.tileSize,
      x - destSize / 2, y - destSize / 2, destSize, destSize
    )
  }

  private hashPlace(placeId: string): number {
    let hash = 0
    for (let i = 0; i < placeId.length; i++) {
      const char = placeId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  isReady(): boolean {
    return this.tilesLoaded
  }
}

interface SpatialViewProps {
  world: GeneratedWorld | null
  selectedPlace: GAEAPlace | null
  onPlaceSelect: (place: GAEAPlace | null) => void
  config: any
  onConfigChange: (config: any) => void
  onGenerateWorld: () => void
  onExportWorldData: () => void
  onExportGameFormat: () => void
  isLoading: boolean
}

type ColorMode = 'ecosystem' | 'biome' | 'climate'

interface FilterState {
  atoms: Set<string>
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

export const SpatialView: React.FC<SpatialViewProps> = ({
  world,
  selectedPlace,
  onPlaceSelect,
  config,
  onConfigChange,
  onGenerateWorld,
  onExportWorldData,
  onExportGameFormat: _onExportGameFormat,
  isLoading
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [colorMode, setColorMode] = useState<ColorMode>('ecosystem')
  const [showGaeaRings, setShowGaeaRings] = useState(false)
  const [showFractalTrails, setShowFractalTrails] = useState(true)
  const [showFractalTerritories, setShowFractalTerritories] = useState(false)
  const [renderMode, setRenderMode] = useState<'tiles' | 'circles'>('circles')
  const [tileRenderer] = useState(() => new SimpleTileRenderer())
  const [filters, setFilters] = useState<FilterState>({
    atoms: new Set()
  })

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

  // Get available taxonomic atoms from the world (combining biomes and climates)
  const ecosystems = world?.places.map(p => p.ecology.ecosystem) || []
  const availableBiomes = getUniqueBiomes(ecosystems)
  const availableClimates = getUniqueClimates(ecosystems)
  const availableAtoms = [...new Set([...availableBiomes, ...availableClimates])].sort()

  // Initialize tiles
  useEffect(() => {
    const initializeTiles = async () => {
      try {
        await tileRenderer.initialize()
      } catch (error) {
        console.warn('Failed to load tileset:', error)
      }
    }
    initializeTiles()
  }, [tileRenderer])

  useEffect(() => {
    if (world) {
      renderSpatialView()
    }
  }, [world, selectedPlace, colorMode, filters, showGaeaRings, showFractalTrails, showFractalTerritories, viewState, renderMode])

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
      if (!place.coordinates) return;

      // Apply filters - skip if place doesn't match active filters
      if (filters.atoms.size > 0) {
        const atoms = parseEcosystemURN(place.ecology.ecosystem);
        if (atoms) {
          // Check if any selected atom matches either the biome or climate
          const hasMatchingAtom = filters.atoms.has(atoms.biome) || filters.atoms.has(atoms.climate);
          if (!hasMatchingAtom) {
            return;
          }
        } else {
          return; // Skip places without valid ecosystem data when filters are active
        }
      }

      const [x, y] = place.coordinates
      const canvasX = x * scale + offsetX
      const canvasY = y * scale + offsetY

      visiblePlaces.set(place.id, { place, canvasX, canvasY });
    });

    return visiblePlaces;
  }

  const renderSpatialView = () => {
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

    // Draw topology zones
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1

    // Central plateau
    ctx.beginPath()
    ctx.arc(
      centerX * scale + offsetX,
      centerY * scale + offsetY,
      world.config.topology.central_crater.radius * scale,
      0,
      Math.PI * 2
    )
    ctx.stroke()

    // Mountain ring
    ctx.beginPath()
    ctx.arc(
      centerX * scale + offsetX,
      centerY * scale + offsetY,
      world.config.topology.mountain_ring.outer_radius * scale,
      0,
      Math.PI * 2
    )
    ctx.stroke()

    // Ecosystem slices
    ctx.beginPath()
    ctx.arc(
      centerX * scale + offsetX,
      centerY * scale + offsetY,
      world.config.topology.ecosystem_slices.outer_radius * scale,
      0,
      Math.PI * 2
    )
    ctx.stroke()

        // Draw sophisticated Lichtenberg fractal trail network
    if (world.trail_network && world.trail_network.allSegments && showFractalTrails) {
      // Draw trail segments with branching hierarchy and color-coded systems
      const trailColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff']

      for (let i = 0; i < world.trail_network.trailSystems.length; i++) {
        const trailSystem = world.trail_network.trailSystems[i]
        const trailColor = trailColors[i % trailColors.length]

        // Draw trail segments for this system with sophisticated hierarchy
        for (const segment of trailSystem.segments) {
          const segmentX = segment.position[0] * scale + offsetX
          const segmentY = segment.position[1] * scale + offsetY

          if (segment.parentId) {
            const parent = world.trail_network.allSegments.find(s => s.id === segment.parentId)
            if (parent) {
              const parentX = parent.position[0] * scale + offsetX
              const parentY = parent.position[1] * scale + offsetY

              // Line thickness decreases with depth (branching level) - key fractal visualization
              const baseThickness = 3.0
              const lineWidth = Math.max(0.5, (baseThickness - segment.depth * 0.5) * viewState.zoom)

              // Alpha decreases with depth for organic hierarchy
              const alpha = Math.max(0.4, 1 - segment.depth * 0.15)

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

      // Draw intersection points with enhanced visibility
      if (world.trail_network.intersectionPoints) {
        ctx.fillStyle = '#ffffff'
        for (const intersection of world.trail_network.intersectionPoints) {
          const intX = intersection.position[0] * scale + offsetX
          const intY = intersection.position[1] * scale + offsetY

          ctx.beginPath()
          ctx.arc(intX, intY, 4 * viewState.zoom, 0, Math.PI * 2)
          ctx.fill()

          // Add black border for better visibility
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Draw trail territories with sophisticated visualization
      if (showFractalTerritories && world.trail_network.trailSystems) {
        const territoryColors = ['#ff664422', '#66ff4422', '#4466ff22', '#ffff4422', '#ff44ff22', '#44ffff22']
        for (let i = 0; i < world.trail_network.trailSystems.length; i++) {
          const trailSystem = world.trail_network.trailSystems[i]
          const territoryColor = territoryColors[i % territoryColors.length]

          // Draw territory influence zones around trail segments
          ctx.fillStyle = territoryColor
          for (const segment of trailSystem.segments) {
            const segmentX = segment.position[0] * scale + offsetX
            const segmentY = segment.position[1] * scale + offsetY

            ctx.beginPath()
            ctx.arc(segmentX, segmentY, 8 * viewState.zoom, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }

    // Get visible places
    const visiblePlaces = getVisiblePlaces()

    // Connection rendering is now handled by the Network view

    // Draw places using selected render mode
    visiblePlaces.forEach(({ place, canvasX, canvasY }) => {
      if (renderMode === 'tiles') {
        // Render as tile
        tileRenderer.renderTile(ctx, place, canvasX, canvasY, Math.max(0.5, viewState.zoom * 0.8))
      } else {
        // Render as colored circle (existing behavior)
        const atoms = parseEcosystemURN(place.ecology.ecosystem)
        const color = atoms ? getBiomeColor(place.ecology.ecosystem) : '#888'
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(canvasX, canvasY, 4 * viewState.zoom, 0, Math.PI * 2)
        ctx.fill()
      }

      // G.A.E.A. intensity ring (optional)
      if (showGaeaRings) {
        ctx.strokeStyle = `rgba(255, 0, 0, ${place.gaea_management.optimization_level})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(canvasX, canvasY, 5 * viewState.zoom, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Highlight selected place with border
      if (selectedPlace && selectedPlace.id === place.id) {
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(canvasX, canvasY, 8 * viewState.zoom, 0, Math.PI * 2)
        ctx.stroke()
      }
    })
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

      if (distanceFromClick < 8 * viewState.zoom) {
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

  const toggleAtomFilter = (atom: string) => {
    setFilters(prev => {
      const newAtoms = new Set(prev.atoms);
      if (newAtoms.has(atom)) {
        newAtoms.delete(atom);
      } else {
        newAtoms.add(atom);
      }
      return { atoms: newAtoms };
    });
  }

  const clearAllFilters = () => {
    setFilters({ atoms: new Set() });
  }

  const handleCloseTooltip = () => {
    setTooltip({ place: null, x: 0, y: 0 })
    onPlaceSelect(null)
  }

  return (
    <div className="spatial-view flex h-screen">
      {/* Sidebar Controls */}
      <div className="w-80 bg-surface border-r border-border flex-shrink-0 overflow-y-auto">
        <div className="p-4">
        {/* Share Button */}
        <button
          onClick={onExportWorldData}
          disabled={!world}
          className="absolute top-3 right-3 p-1.5 rounded-md bg-surface border border-border hover:bg-surface/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Export World Data"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-text-bright"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
            />
          </svg>
        </button>

        <div className="space-y-4">
          {/* Title */}
          <div className="pr-8">
            <h1 className="text-sm font-bold text-text-bright drop-shadow-lg">G.A.E.A. World Visualizer</h1>
            <p className="text-text-dim text-xs drop-shadow">Anti-equilibrium world generation</p>
          </div>

          {/* World Generation Controls */}
          <div className="border-t border-border pt-4">
            <div className="space-y-3">
              {/* Generation Info */}
              <div>
                <label className="text-sm font-medium text-text-bright mb-2 block">
                  ⚡ Lichtenberg Fractal Generation
                </label>
                <div className="text-xs text-text-dim">
                  Organic lightning channels from caldera rim
                </div>
              </div>

              {/* Generate World Button */}
              <button
                onClick={onGenerateWorld}
                disabled={isLoading}
                className="w-full btn bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Generating...' : 'Generate New World'}
              </button>

              {/* Place Density Control */}
              <div>
                <label className="text-sm font-medium text-text-bright mb-1 block">
                  Place Density: {(config.place_density || 5.0).toFixed(4)} per km²
                </label>
                <input
                  type="range"
                  min="0.0004"
                  max="10.0"
                  step="0.01"
                  value={config.place_density || 5.0}
                  onChange={(e) => onConfigChange({ place_density: parseFloat(e.target.value) })}
                  className="w-full"
                />
                                  <div className="text-xs text-text-dim mt-1">
                    {world ? `~${Math.round((config.place_density || 5.0) * Math.PI * Math.pow(world.config.topology.ecosystem_slices.outer_radius, 2))} places` : 'Generate world to see place count'}
                  </div>
              </div>
            </div>
          </div>



          {/* Rendering Mode Toggle */}
          <div className="border-t border-border pt-4">
            <label className="text-sm font-medium text-text-bright mb-2 block">Render Mode:</label>
            <div className="flex gap-1">
              {(['circles', 'tiles'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setRenderMode(mode)}
                  className={`px-3 py-1 text-xs rounded ${
                    renderMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface border border-border hover:bg-surface/80'
                  }`}
                >
                  {mode === 'circles' ? 'Circles' : 'Tiles'}
                </button>
              ))}
            </div>
          </div>

          {/* Color Mode Toggle */}
          <div className="border-t border-border pt-4">
            <label className="text-sm font-medium text-text-bright mb-2 block">Color by:</label>
            <div className="flex gap-1">
              {(['ecosystem', 'biome', 'climate'] as ColorMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setColorMode(mode)}
                  className={`px-3 py-1 text-xs rounded ${
                    colorMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface border border-border hover:bg-surface/80'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Display Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-text-bright">
              <input
                type="checkbox"
                checked={showGaeaRings}
                onChange={(e) => setShowGaeaRings(e.target.checked)}
                className="rounded"
              />
              Show G.A.E.A. rings
            </label>
            <label className="flex items-center gap-2 text-sm text-text-bright">
              <input
                type="checkbox"
                checked={showFractalTrails}
                onChange={(e) => setShowFractalTrails(e.target.checked)}
                className="rounded"
              />
              Show fractal trails
            </label>
            <label className="flex items-center gap-2 text-sm text-text-bright">
              <input
                type="checkbox"
                checked={showFractalTerritories}
                onChange={(e) => setShowFractalTerritories(e.target.checked)}
                className="rounded"
              />
              Show fractal territories
            </label>
          </div>

          {/* Ecosystem Atom Filters */}
          <div>
            <label className="text-sm font-medium text-text-bright mb-2 block">Ecosystem Atoms:</label>
            <div className="flex flex-wrap gap-1">
              {availableAtoms.map(atom => (
                <button
                  key={atom}
                  onClick={() => toggleAtomFilter(atom)}
                  className={`px-2 py-1 text-xs rounded ${
                    filters.atoms.has(atom)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface border border-border hover:bg-surface/80'
                  }`}
                >
                  {atom}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {filters.atoms.size > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-text-dim hover:text-text-bright underline"
            >
              Clear all filters
            </button>
          )}
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
              <p className="text-text-dim">Click "Generate New World" to create a world</p>
            </div>
          </div>
        )}

        {/* Camera Controls - Google Maps Style */}
        <div className="absolute bottom-2 right-2 z-10 bg-surface/95 backdrop-blur-sm border border-border rounded-lg overflow-hidden shadow-lg">
          <div className="flex flex-col">
            {/* Zoom In */}
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>

            {/* Zoom Out */}
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </button>

            {/* Reset View */}
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
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
