import React from 'react'
import type { GeneratedWorld, GAEAPlace } from '@flux'

interface NetworkViewProps {
  world: GeneratedWorld
  selectedPlace: GAEAPlace | null
  onPlaceSelect: (place: GAEAPlace | null) => void
}

export const NetworkView: React.FC<NetworkViewProps> = ({
  world,
  selectedPlace,
  onPlaceSelect
}) => {
  // Suppress unused variable warnings for props we'll use later
  void world
  void selectedPlace
  void onPlaceSelect
  return (
    <div className="network-view">
      <div className="canvas-container">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa' }}>
          Network View - Coming Soon
          <br />
          <small>Will show force-directed graph of place connections</small>
        </div>
      </div>
    </div>
  )
}
