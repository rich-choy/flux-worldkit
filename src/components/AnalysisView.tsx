import React from 'react'
import type { GeneratedWorld } from '@flux'

interface AnalysisViewProps {
  world: GeneratedWorld
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ world }) => {
  const totalExits = world.places.reduce((sum, place) =>
    sum + Object.keys(place.exits).length, 0
  )

  const ecosystemCounts = world.places.reduce((acc, place) => {
    const ecosystem = place.ecology.ecosystem
    acc[ecosystem] = (acc[ecosystem] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="analysis-view">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{world.places.length}</div>
          <div className="stat-label">Total Places</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalExits}</div>
          <div className="stat-label">Total Exits</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{world.infection_zones.length}</div>
          <div className="stat-label">Infection Zones</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{world.worshipper_territories.length}</div>
          <div className="stat-label">Worshipper Territories</div>
        </div>
      </div>

      <div className="ecosystem-breakdown">
        <h3>Ecosystem Distribution</h3>
        <div className="ecosystem-list">
          {Object.entries(ecosystemCounts).map(([ecosystem, count]) => (
            <div key={ecosystem} className="ecosystem-item">
              <span className="ecosystem-name">
                {ecosystem.split(':').pop()?.replace('_', ' ')}
              </span>
              <span className="ecosystem-count">{count}</span>
              <span className="ecosystem-percentage">
                ({((count / world.places.length) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="world-metrics">
        <h3>World Metrics</h3>
        <div className="metric-row">
          <span>Average Exits per Place:</span>
          <span>{(totalExits / world.places.length).toFixed(2)}</span>
        </div>
        <div className="metric-row">
          <span>World Radius:</span>
          <span>{world.config.topology.ecosystem_slices.outer_radius}km</span>
        </div>
        <div className="metric-row">
          <span>Place Density:</span>
          <span>{world.config.place_density} places/km²</span>
        </div>
        <div className="metric-row">
          <span>G.A.E.A. Intensity:</span>
          <span>{(world.config.gaea_intensity * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  )
}
