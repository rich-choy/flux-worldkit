import type { GAEAPlace } from '@flux'

interface DetailViewProps {
  selectedPlace: GAEAPlace | null
}

export const DetailView = ({ selectedPlace }: DetailViewProps) => {
  if (!selectedPlace) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-text-dim mb-2">No Place Selected</h3>
          <p className="text-text-dim">Select a place from the Spatial or Network view to see detailed information</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="space-y-6">
        {/* Place Header */}
        <div className="card">
          <h2 className="text-2xl font-bold text-text-bright mb-2">{selectedPlace.name}</h2>
          <p className="text-text mb-4">{selectedPlace.description}</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-dim">ID:</span>
              <span className="ml-2 text-text font-mono">{selectedPlace.id}</span>
            </div>
            <div>
              <span className="text-text-dim">Coordinates:</span>
              <span className="ml-2 text-text font-mono">
                ({selectedPlace.x.toFixed(2)}, {selectedPlace.y.toFixed(2)})
              </span>
            </div>
          </div>
        </div>

        {/* Ecology Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-bright mb-3">Ecology</h3>
          <div className="space-y-2">
            <div>
              <span className="text-text-dim">Ecosystem:</span>
              <span className="ml-2 text-text">{selectedPlace.ecology.ecosystem}</span>
            </div>
            <div>
              <span className="text-text-dim">Temperature Range:</span>
              <span className="ml-2 text-text">
                {selectedPlace.ecology.temperature_range.min}°C - {selectedPlace.ecology.temperature_range.max}°C
              </span>
            </div>
            <div>
              <span className="text-text-dim">Pressure Range:</span>
              <span className="ml-2 text-text">
                {selectedPlace.ecology.pressure_range.min} - {selectedPlace.ecology.pressure_range.max} hPa
              </span>
            </div>
            <div>
              <span className="text-text-dim">Humidity Range:</span>
              <span className="ml-2 text-text">
                {selectedPlace.ecology.humidity_range.min}% - {selectedPlace.ecology.humidity_range.max}%
              </span>
            </div>
          </div>
        </div>

        {/* Current Weather */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-bright mb-3">Current Weather</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-dim">Temperature:</span>
              <span className="ml-2 text-text">{selectedPlace.weather.temperature.toFixed(1)}°C</span>
            </div>
            <div>
              <span className="text-text-dim">Pressure:</span>
              <span className="ml-2 text-text">{selectedPlace.weather.pressure.toFixed(1)} hPa</span>
            </div>
            <div>
              <span className="text-text-dim">Humidity:</span>
              <span className="ml-2 text-text">{selectedPlace.weather.humidity.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-text-dim">Precipitation:</span>
              <span className="ml-2 text-text">{selectedPlace.weather.precipitation.toFixed(1)} mm</span>
            </div>
            <div>
              <span className="text-text-dim">PPFD:</span>
              <span className="ml-2 text-text">{selectedPlace.weather.ppfd.toFixed(1)} μmol/m²/s</span>
            </div>
            <div>
              <span className="text-text-dim">Cloud Cover:</span>
              <span className="ml-2 text-text">{selectedPlace.weather.clouds.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* G.A.E.A. Management */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-bright mb-3">G.A.E.A. Management</h3>
          <div className="space-y-2">
            <div>
              <span className="text-text-dim">Intensity:</span>
              <span className="ml-2 text-text">{selectedPlace.gaea.management_intensity.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-text-dim">Stability:</span>
              <span className="ml-2 text-text">{selectedPlace.gaea.stability_factor.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-text-dim">Efficiency:</span>
              <span className="ml-2 text-text">{selectedPlace.gaea.efficiency_rating.toFixed(3)}</span>
            </div>
          </div>
        </div>

        {/* Cordyceps Habitat */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-bright mb-3">Cordyceps Habitat</h3>
          <div className="space-y-2">
            <div>
              <span className="text-text-dim">Shade Level:</span>
              <span className="ml-2 text-text">{selectedPlace.cordyceps.shade_level.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-text-dim">Humidity Factor:</span>
              <span className="ml-2 text-text">{selectedPlace.cordyceps.humidity_factor.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-text-dim">Infection Risk:</span>
              <span className="ml-2 text-text">{selectedPlace.cordyceps.infection_risk.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-text-dim">Cultivation Suitability:</span>
              <span className="ml-2 text-text">{selectedPlace.cordyceps.cultivation_suitability.toFixed(3)}</span>
            </div>
          </div>
        </div>

        {/* Worshipper Behavior */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-bright mb-3">Worshipper Behavior</h3>
          <div className="space-y-2">
            <div>
              <span className="text-text-dim">Territorial Strength:</span>
              <span className="ml-2 text-text">{selectedPlace.worshipper.territorial_strength.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-text-dim">Ritual Intensity:</span>
              <span className="ml-2 text-text">{selectedPlace.worshipper.ritual_intensity.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-text-dim">Mobility Pattern:</span>
              <span className="ml-2 text-text">{selectedPlace.worshipper.mobility_pattern.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-text-dim">Aggression Level:</span>
              <span className="ml-2 text-text">{selectedPlace.worshipper.aggression_level.toFixed(3)}</span>
            </div>
          </div>
        </div>

        {/* Exits */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-bright mb-3">Exits</h3>
          {Object.keys(selectedPlace.exits).length === 0 ? (
            <p className="text-text-dim">No exits from this place</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(selectedPlace.exits).map(([direction, exit]) => (
                <div key={direction} className="border-l-2 border-accent pl-3">
                  <div className="font-medium text-text">{direction}</div>
                  <div className="text-sm text-text-dim">{exit.label}</div>
                  <div className="text-xs text-text-dim font-mono">{exit.to}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resources */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-bright mb-3">Resources</h3>
          <div className="space-y-2">
            <div>
              <span className="text-text-dim">Available:</span>
              <span className="ml-2 text-text">{selectedPlace.resources.available.length} types</span>
            </div>
            <div>
              <span className="text-text-dim">Capacity:</span>
              <span className="ml-2 text-text">{selectedPlace.resources.capacity}</span>
            </div>
            <div>
              <span className="text-text-dim">Production Rate:</span>
              <span className="ml-2 text-text">{selectedPlace.resources.production_rate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
