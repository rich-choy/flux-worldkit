import React, { useEffect, useState } from 'react'
import type { WorldGenerationResult } from '~/worldgen/types'
import type { ViewMode } from '~/App'
import { Canvas } from './Canvas'
import { ZoomPanControls } from './ZoomPanControls'

interface ViewportProps {
  world: WorldGenerationResult | null
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export const Viewport: React.FC<ViewportProps> = ({
  world,
  viewMode,
  onViewModeChange
}) => {
  return (
    <div className="h-full bg-background relative">
      {/* Floating View Mode Controls */}
      <div className="absolute top-6 right-6 z-50 flex gap-2">
        <button
          onClick={() => onViewModeChange('graph')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent border shadow-lg ${
            viewMode === 'graph'
              ? 'bg-accent text-background border-accent'
              : 'bg-surface text-text hover:bg-surface-bright border-border'
          }`}
        >
          Graph
        </button>
        <button
          onClick={() => onViewModeChange('analysis')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent border shadow-lg ${
            viewMode === 'analysis'
              ? 'bg-accent text-background border-accent'
              : 'bg-surface text-text hover:bg-surface-bright border-border'
          }`}
        >
          Analysis
        </button>
      </div>

      {/* Main Content Area */}
      <div className="h-full">
        {viewMode === 'graph' ? (
          <GraphView world={world} />
        ) : (
          <AnalysisView world={world} />
        )}
      </div>
    </div>
  )
}

interface GraphViewProps {
  world: WorldGenerationResult | null
}

const GraphView: React.FC<GraphViewProps> = ({ world }) => {
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)

  // Reset zoom and pan when world changes
  useEffect(() => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }, [world])

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5)) // Max zoom 5x
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1)) // Min zoom 0.1x
  }

  const handlePanUp = () => {
    setPanY(prev => prev + 50)
  }

  const handlePanDown = () => {
    setPanY(prev => prev - 50)
  }

  const handlePanLeft = () => {
    setPanX(prev => prev + 50)
  }

  const handlePanRight = () => {
    setPanX(prev => prev - 50)
  }

  const handleResetView = () => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }

  return (
    <div className="h-full w-full flex items-start justify-start relative">
      <Canvas
        world={world}
        zoom={zoom}
        panX={panX}
        panY={panY}
      />
      {!world && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-text-bright mb-2">
              No World Generated
            </h3>
            <p className="text-text-dim">
              Use the menu above to generate a world and see it visualized here
            </p>
          </div>
        </div>
      )}
      {world && (
        <ZoomPanControls
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onPanUp={handlePanUp}
          onPanDown={handlePanDown}
          onPanLeft={handlePanLeft}
          onPanRight={handlePanRight}
          onResetView={handleResetView}
        />
      )}
    </div>
  )
}

interface AnalysisViewProps {
  world: WorldGenerationResult | null
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ world }) => {
  if (!world) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-text-bright mb-2">
            No Analysis Available
          </h3>
          <p className="text-text-dim">
            Generate a world to see detailed analysis
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-text-bright mb-4">
            Input Parameters
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-dim">World Width:</span>
              <span className="ml-2 text-text">{world.config.worldWidth} km</span>
            </div>
            <div>
              <span className="text-text-dim">World Height:</span>
              <span className="ml-2 text-text">{world.config.worldHeight} km</span>
            </div>
            <div>
              <span className="text-text-dim">Place Size:</span>
              <span className="ml-2 text-text">{world.config.placeSize} m</span>
            </div>
            <div>
              <span className="text-text-dim">Place Margin:</span>
              <span className="ml-2 text-text">{world.config.placeMargin} m</span>
            </div>
            <div>
              <span className="text-text-dim">Seed:</span>
              <span className="ml-2 text-text">{world.config.seed || 'Random'}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-text-bright mb-4">
            Generation Results
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-dim">Total Places:</span>
              <span className="ml-2 text-text">{world.places.length}</span>
            </div>
            <div>
              <span className="text-text-dim">Total Connections:</span>
              <span className="ml-2 text-text">{world.connections.total}</span>
            </div>
            <div>
              <span className="text-text-dim">Reciprocal Connections:</span>
              <span className="ml-2 text-text">{world.connections.reciprocal}</span>
            </div>
            <div>
              <span className="text-text-dim">Avg Connections/Place:</span>
              <span className="ml-2 text-text">
                {world.places.length > 0 ? (world.connections.total / world.places.length).toFixed(2) : '0'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-text-bright mb-4">
            Ecosystem Distribution
          </h3>
          <div className="space-y-2 text-sm">
            {(() => {
              // Calculate ecosystem distribution
              const ecosystemCounts = world.places.reduce((acc: Record<string, number>, place: any) => {
                const ecosystem = place.ecology.ecosystem
                acc[ecosystem] = (acc[ecosystem] || 0) + 1
                return acc
              }, {} as Record<string, number>)

              const totalPlaces = world.places.length

              return Object.entries(ecosystemCounts).map(([ecosystem, count]) => {
                const percentage = ((count / totalPlaces) * 100).toFixed(1)
                const ecosystemName = ecosystem.split(':').pop()?.replace(/([a-z])([A-Z])/g, '$1 $2') || ecosystem

                return (
                  <div key={ecosystem} className="flex justify-between">
                    <span className="text-text-dim capitalize">{ecosystemName}:</span>
                    <span className="text-text">{count} places ({percentage}%)</span>
                  </div>
                )
              });
            })()}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-text-bright mb-4">
            Connection Analysis
          </h3>
          <div className="space-y-2 text-sm">
            {(() => {
              // Calculate connections per ecosystem
              const ecosystemConnections = world.places.reduce((acc: Record<string, { total: number; places: number }>, place: any) => {
                const ecosystem = place.ecology.ecosystem
                const exitCount = Object.keys(place.exits || {}).length

                if (!acc[ecosystem]) {
                  acc[ecosystem] = { total: 0, places: 0 }
                }
                acc[ecosystem].total += exitCount
                acc[ecosystem].places += 1

                return acc
              }, {} as Record<string, { total: number; places: number }>)

              return Object.entries(ecosystemConnections).map(([ecosystem, data]) => {
                const avgConnections = data.places > 0 ? (data.total / data.places).toFixed(1) : '0'
                const ecosystemName = ecosystem.split(':').pop()?.replace(/([a-z])([A-Z])/g, '$1 $2') || ecosystem

                return (
                  <div key={ecosystem} className="flex justify-between">
                    <span className="text-text-dim capitalize">{ecosystemName}:</span>
                    <span className="text-text">{avgConnections} avg connections</span>
                  </div>
                )
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
