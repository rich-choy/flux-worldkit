import React from 'react';
import type { WorldVertex } from '~/worldgen/types';
import type { Place, Exit } from 'flux-game';

interface VertexTooltipProps {
  vertex: WorldVertex
  place: Place
  position: { x: number; y: number }
  isVisible: boolean
  onClose: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

const VertexTooltip: React.FC<VertexTooltipProps> = ({
  vertex,
  place,
  position,
  isVisible,
  onMouseEnter,
  onMouseLeave
}) => {
  // Helper function to convert Place name/description to string
  const getStringValue = (value: string | any): string => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && value.toString) return value.toString()
    return ''
  }

  // Helper function to get exit information
  const getExitInfo = (place: Place): Exit[] => {
    if (!place.exits) return []
    return Object.values(place.exits);
  }

  // Helper function to get pathfinding origin information
  const getPathfindingOrigin = (vertex: WorldVertex): string | null => {
    // Check if vertex was created by pathfinding (based on naming convention)
    if (vertex.id.includes('path-') || vertex.id.includes('bridge-')) {
      return 'Grid-aligned pathfinding'
    }
    return null
  }

  const exitInfo = getExitInfo(place)
  const pathfindingOrigin = getPathfindingOrigin(vertex)

  if (!isVisible) return null

  return (
    <div
      className="absolute z-50 bg-gray-900 bg-opacity-95 text-white p-4 rounded-lg shadow-lg border border-gray-700 min-w-64 max-w-80"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -120%)', // Position above cursor
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Content */}
      <div className="space-y-2 text-sm">
        {/* Place ID (PlaceURN) */}
        <div>
          <span className="text-gray-400">Place ID:</span>
          <span className="ml-2 font-mono text-xs">{(place as any).urn || place.id}</span>
        </div>

        {/* Ecosystem URN */}
        <div>
          <span className="text-gray-400">Ecosystem:</span>
          <span className="ml-2 font-mono text-xs">{vertex.ecosystem}</span>
        </div>

        {/* Position */}
        <div>
          <span className="text-gray-400">Position:</span>
          <span className="ml-2 font-mono text-xs">
            ({Math.round(vertex.x)}, {Math.round(vertex.y)})
          </span>
        </div>

        {/* Grid */}
        <div>
          <span className="text-gray-400">Grid:</span>
          <span className="ml-2 font-mono text-xs">
            ({vertex.gridX}, {vertex.gridY})
          </span>
        </div>

        {/* Name */}
        <div>
          <span className="text-gray-400">Name:</span>
          <span className="ml-2">{getStringValue(place.name)}</span>
        </div>

        {/* Description */}
        <div>
          <span className="text-gray-400">Description:</span>
          <div className="ml-2 mt-1 text-gray-300 max-h-20 overflow-y-auto">
            {getStringValue(place.description)}
          </div>
        </div>

        {/* Exits */}
        {exitInfo.length > 0 && (
          <div>
            <span className="text-gray-400">Exits:</span>
            <div className="ml-2 mt-1 space-y-1">
              {exitInfo.map((exit, index) => (
                <div key={index} className="text-xs">
                  <span className="text-green-400">•</span>
                  <span className="ml-1 capitalize">{exit.direction}</span>
                  <span className="text-gray-400 ml-1">→</span>
                  <span className="ml-1 font-mono text-xs">{exit.to}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pathfinding Origin */}
        {pathfindingOrigin && (
          <div>
            <span className="text-gray-400">Created by:</span>
            <span className="ml-2 text-yellow-400 text-xs">{pathfindingOrigin}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default VertexTooltip
