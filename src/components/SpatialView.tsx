import React, { useRef, useEffect, useState } from 'react';
import type { GeneratedWorld, GAEAPlace } from '@flux';
import type { Exit } from '~/lib/flux-wrapper';
import {
  getBiomeColor,
  getClimateColor,
  getEcosystemColor,
  getUniqueBiomes,
  getUniqueClimates,
  parseEcosystemURN
} from '~/lib/ecosystem-utils';

interface SpatialViewProps {
  world: GeneratedWorld
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
  biomes: Set<string>
  climates: Set<string>
}

export const SpatialView: React.FC<SpatialViewProps> = ({
  world,
  selectedPlace,
  onPlaceSelect,
  config,
  onConfigChange,
  onGenerateWorld,
  onExportWorldData,
  onExportGameFormat,
  isLoading
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [colorMode, setColorMode] = useState<ColorMode>('ecosystem')
  const [showEdges, setShowEdges] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    biomes: new Set(),
    climates: new Set()
  })

  // Get available taxonomic atoms from the world
  const ecosystems = world.places.map(p => p.ecology.ecosystem)
  const availableBiomes = getUniqueBiomes(ecosystems)
  const availableClimates = getUniqueClimates(ecosystems)

  useEffect(() => {
    renderSpatialView()
  }, [world, selectedPlace, colorMode, filters, showEdges])

  const getVisiblePlaces = () => {
    const canvas = canvasRef.current
    if (!canvas) return new Map()

    const rect = canvas.getBoundingClientRect()
    const worldRadius = world.config.topology.ecosystem_slices.outer_radius
    const centerX = world.config.topology.central_plateau.center[0]
    const centerY = world.config.topology.central_plateau.center[1]
    const scale = Math.min(rect.width, rect.height) / (worldRadius * 2.2)
    const offsetX = rect.width / 2 - centerX * scale
    const offsetY = rect.height / 2 - centerY * scale

    const visiblePlaces = new Map<string, { place: GAEAPlace, canvasX: number, canvasY: number }>()

    world.places.forEach(place => {
      if (!place.coordinates) return;

      // Apply filters - skip if place doesn't match active filters
      const atoms = parseEcosystemURN(place.ecology.ecosystem);
      if (atoms) {
        if (filters.biomes.size > 0 && !filters.biomes.has(atoms.biome)) {
          return;
        }
        if (filters.climates.size > 0 && !filters.climates.has(atoms.climate)) {
          return;
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
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()

    // Set canvas size
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    ctx.clearRect(0, 0, rect.width, rect.height)

    // Calculate world bounds
    const worldRadius = world.config.topology.ecosystem_slices.outer_radius
    const centerX = world.config.topology.central_plateau.center[0]
    const centerY = world.config.topology.central_plateau.center[1]

    // Scale and offset for canvas
    const scale = Math.min(rect.width, rect.height) / (worldRadius * 2.2)
    const offsetX = rect.width / 2 - centerX * scale
    const offsetY = rect.height / 2 - centerY * scale

    // Draw topology zones
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1

    // Central plateau
    ctx.beginPath()
    ctx.arc(
      centerX * scale + offsetX,
      centerY * scale + offsetY,
      world.config.topology.central_plateau.radius * scale,
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

    // Get visible places
    const visiblePlaces = getVisiblePlaces()

    // Draw edges (connections between places)
    if (showEdges) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 1

      visiblePlaces.forEach(({ place: fromPlace, canvasX: fromX, canvasY: fromY }) => {
        Object.entries(fromPlace.exits || {}).forEach(([direction, exit]) => {
          if (exit && (exit as Exit).to) {
            const toPlace = visiblePlaces.get((exit as Exit).to);
            if (toPlace) {
              ctx.beginPath()
              ctx.moveTo(fromX, fromY)
              ctx.lineTo(toPlace.canvasX, toPlace.canvasY)
              ctx.stroke()
            }
          }
        });
      });
    }

    // Draw places
    visiblePlaces.forEach(({ place, canvasX, canvasY }) => {
      // Place color based on selected color mode
      let color: string;
      switch (colorMode) {
        case 'biome':
          color = getBiomeColor(place.ecology.ecosystem);
          break;
        case 'climate':
          color = getClimateColor(place.ecology.ecosystem);
          break;
        case 'ecosystem':
        default:
          color = getEcosystemColor(place.ecology.ecosystem);
          break;
      }
      ctx.fillStyle = color

      // Highlight selected place
      if (selectedPlace && selectedPlace.id === place.id) {
        ctx.fillStyle = '#ffff00'
      }

      ctx.beginPath()
      ctx.arc(canvasX, canvasY, 3, 0, Math.PI * 2)
      ctx.fill()

      // G.A.E.A. intensity ring
      ctx.strokeStyle = `rgba(255, 0, 0, ${place.gaea_management.optimization_level})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(canvasX, canvasY, 5, 0, Math.PI * 2)
      ctx.stroke()
    })
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
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

      if (distanceFromClick < 8) {
        onPlaceSelect(place)
        return
      }
    }

    // If no place was clicked, deselect
    onPlaceSelect(null)
  }

  const toggleBiomeFilter = (biome: string) => {
    setFilters(prev => {
      const newBiomes = new Set(prev.biomes);
      if (newBiomes.has(biome)) {
        newBiomes.delete(biome);
      } else {
        newBiomes.add(biome);
      }
      return { ...prev, biomes: newBiomes };
    });
  }

  const toggleClimateFilter = (climate: string) => {
    setFilters(prev => {
      const newClimates = new Set(prev.climates);
      if (newClimates.has(climate)) {
        newClimates.delete(climate);
      } else {
        newClimates.add(climate);
      }
      return { ...prev, climates: newClimates };
    });
  }

  const clearAllFilters = () => {
    setFilters({ biomes: new Set(), climates: new Set() });
  }

  return (
    <div className="spatial-view relative">
      {/* Unified Controls Panel */}
      <div className="absolute top-2 left-2 z-10 bg-surface/90 backdrop-blur-sm border border-border rounded-lg p-4 max-w-xs">
        <div className="space-y-4">
          {/* Title */}
          <div>
            <h1 className="text-sm font-bold text-text-bright drop-shadow-lg">G.A.E.A. World Visualizer</h1>
            <p className="text-text-dim text-xs drop-shadow">Anti-equilibrium world generation</p>
          </div>

          {/* World Generation Controls */}
          <div className="border-t border-border pt-4">
            <div className="space-y-3">
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
                  Place Density: {Math.min(config.place_density || 0.004, 0.04).toFixed(4)} per km²
                </label>
                <input
                  type="range"
                  min="0.0004"
                  max="0.04"
                  step="0.0002"
                  value={Math.min(config.place_density || 0.004, 0.04)}
                  onChange={(e) => onConfigChange({ place_density: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="text-xs text-text-dim mt-1">
                  ~{Math.round(Math.min(config.place_density || 0.004, 0.04) * 250000)} places
                </div>
              </div>

              {/* Export Controls */}
              <div className="flex gap-2">
                <button
                  onClick={onExportWorldData}
                  disabled={!world}
                  className="flex-1 btn bg-surface border border-border hover:bg-surface/80 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  Export Data
                </button>
                <button
                  onClick={onExportGameFormat}
                  disabled={!world}
                  className="flex-1 btn bg-surface border border-border hover:bg-surface/80 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  Export Game
                </button>
              </div>
            </div>
          </div>

          {/* Color Mode Selection */}
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

          {/* Show Connections Toggle */}
          <div>
            <label className="flex items-center gap-2 text-sm text-text-bright">
              <input
                type="checkbox"
                checked={showEdges}
                onChange={(e) => setShowEdges(e.target.checked)}
                className="rounded"
              />
              Show connections
            </label>
          </div>

          {/* Biome Filters */}
          <div>
            <label className="text-sm font-medium text-text-bright mb-2 block">Biomes:</label>
            <div className="flex flex-wrap gap-1">
              {availableBiomes.map(biome => (
                <button
                  key={biome}
                  onClick={() => toggleBiomeFilter(biome)}
                  className={`px-2 py-1 text-xs rounded ${
                    filters.biomes.has(biome)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface border border-border hover:bg-surface/80'
                  }`}
                >
                  {biome}
                </button>
              ))}
            </div>
          </div>

          {/* Climate Filters */}
          <div>
            <label className="text-sm font-medium text-text-bright mb-2 block">Climates:</label>
            <div className="flex flex-wrap gap-1">
              {availableClimates.map(climate => (
                <button
                  key={climate}
                  onClick={() => toggleClimateFilter(climate)}
                  className={`px-2 py-1 text-xs rounded ${
                    filters.climates.has(climate)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface border border-border hover:bg-surface/80'
                  }`}
                >
                  {climate}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {(filters.biomes.size > 0 || filters.climates.size > 0) && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-text-dim hover:text-text-bright underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ width: '100%', height: '100%', cursor: 'pointer' }}
        />
      </div>
    </div>
  )
}
