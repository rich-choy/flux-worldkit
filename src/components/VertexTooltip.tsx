import React, { useState, useEffect, useRef } from 'react';
import type { WorldVertex } from '~/worldgen/types';
import type { Place } from 'flux-game';

interface VertexTooltipProps {
  vertex: WorldVertex
  place: Place
  position: { x: number; y: number }
  isVisible: boolean
  onClose: () => void
  onSave: (placeId: string, updates: { name?: string; description?: string }) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

interface ExitInfo {
  direction: string
  destinationId: string
  destinationName?: string
}

const VertexTooltip: React.FC<VertexTooltipProps> = ({
  vertex,
  place,
  position,
  isVisible,
  onSave,
  onMouseEnter,
  onMouseLeave
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({})

  const tooltipRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Helper function to convert Place name/description to string
  const getStringValue = (value: string | any): string => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && value.toString) return value.toString()
    return ''
  }

  // Reset editing state when vertex changes
  useEffect(() => {
    setIsEditing(false)
    setEditedName(getStringValue(place.name))
    setEditedDescription(getStringValue(place.description))
    setErrors({})
  }, [vertex.id, place.name, place.description])

  // Auto-focus name input when entering edit mode
  useEffect(() => {
    if (isEditing && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [isEditing])

  // Handle ESC key to cancel editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditing) {
        handleCancel()
      }
    }

    if (isEditing) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isEditing])

  const getEcosystemDisplay = (vertex: WorldVertex): string => {
    if (vertex.ecosystem.includes('marsh')) {
      return 'Marsh (within Jungle)'
    }
    return vertex.ecosystem.split(':')[2] || 'Unknown'
  }

  const getExitInfo = (place: Place): ExitInfo[] => {
    if (!place.exits) return []

    return Object.entries(place.exits).map(([direction, exit]) => ({
      direction,
      destinationId: exit.to,
      destinationName: undefined // TODO: Look up destination name if needed
    }))
  }

  const getPathfindingOrigin = (vertex: WorldVertex): string | null => {
    // Check if vertex was created by grid-aligned pathfinding
    if (vertex.id.includes('path-') || vertex.id.includes('bridge-')) {
      return 'Grid-aligned pathfinding'
    }
    return null
  }

  const validateForm = (): boolean => {
    const newErrors: { name?: string; description?: string } = {}

    if (!editedName.trim()) {
      newErrors.name = 'Name cannot be empty'
    } else if (editedName.length > 50) {
      newErrors.name = 'Name must be 50 characters or less'
    }

    if (editedDescription.length > 200) {
      newErrors.description = 'Description must be 200 characters or less'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditedName(getStringValue(place.name))
    setEditedDescription(getStringValue(place.description))
    setErrors({})
  }

  const handleSave = () => {
    if (!validateForm()) return

    onSave(place.id, {
      name: editedName.trim(),
      description: editedDescription.trim()
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedName(getStringValue(place.name))
    setEditedDescription(getStringValue(place.description))
    setErrors({})
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      // Let default tab behavior handle focus management
      return
    }

    if (e.key === 'Enter' && e.target === nameInputRef.current) {
      // Move from name field to description field
      e.preventDefault()
      const descriptionTextarea = tooltipRef.current?.querySelector('textarea')
      if (descriptionTextarea) {
        descriptionTextarea.focus()
      }
    }
  }

  const exitInfo = getExitInfo(place)
  const pathfindingOrigin = getPathfindingOrigin(vertex)
  const ecosystemDisplay = getEcosystemDisplay(vertex)

  if (!isVisible) return null

  return (
    <div
      ref={tooltipRef}
      className="absolute z-50 bg-gray-900 bg-opacity-95 text-white p-4 rounded-lg shadow-lg border border-gray-700 min-w-64 max-w-80"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -120%)', // Position above cursor
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold">
          {vertex.id.startsWith('bridge-') ? 'Bridge Vertex Details' : 'Vertex Details'}
        </h3>
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="text-blue-400 hover:text-blue-300 text-sm p-1"
            title="Edit place"
          >
            ✎
          </button>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2 text-sm">
        {/* ID */}
        <div>
          <span className="text-gray-400">ID:</span>
          <span className="ml-2 font-mono text-xs">{vertex.id}</span>
        </div>

        {/* Name */}
        <div>
          <span className="text-gray-400">Name:</span>
          {isEditing ? (
            <div className="mt-1">
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-gray-800 text-white px-2 py-1 rounded text-sm border border-gray-600 focus:border-blue-400 focus:outline-none"
                placeholder="Enter place name"
                maxLength={50}
              />
              {errors.name && <div className="text-red-400 text-xs mt-1">{errors.name}</div>}
              <div className="text-gray-500 text-xs mt-1">{editedName.length}/50</div>
            </div>
                     ) : (
             <span className="ml-2">{getStringValue(place.name) || 'Unnamed'}</span>
           )}
        </div>

        {/* Description */}
        <div>
          <span className="text-gray-400">Description:</span>
          {isEditing ? (
            <div className="mt-1">
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="w-full bg-gray-800 text-white px-2 py-1 rounded text-sm border border-gray-600 focus:border-blue-400 focus:outline-none resize-none"
                placeholder="Enter place description"
                rows={3}
                maxLength={200}
              />
              {errors.description && <div className="text-red-400 text-xs mt-1">{errors.description}</div>}
              <div className="text-gray-500 text-xs mt-1">{editedDescription.length}/200</div>
            </div>
                     ) : (
             <div className="ml-2 text-gray-300 text-xs">
               {getStringValue(place.description) || 'No description'}
             </div>
           )}
        </div>

        {/* Ecosystem */}
        <div>
          <span className="text-gray-400">Ecosystem:</span>
          <span className="ml-2 capitalize">{ecosystemDisplay}</span>
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

        {/* Exits */}
        {exitInfo.length > 0 && (
          <div>
            <span className="text-gray-400">Exits:</span>
            {isEditing && <span className="ml-2 text-gray-500 text-xs">(read-only in edit mode)</span>}
            <div className="ml-2 mt-1 space-y-1">
              {exitInfo.map((exit, index) => (
                <div key={index} className="text-xs">
                  <span className="text-green-400">•</span>
                  <span className="ml-1 capitalize">{exit.direction}</span>
                  <span className="text-gray-400 ml-1">→</span>
                  <span className="ml-1 font-mono text-xs">{exit.destinationId}</span>
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

      {/* Edit Mode Actions */}
      {isEditing && (
        <div className="flex justify-center space-x-2 mt-4 pt-3 border-t border-gray-700">
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

export default VertexTooltip
