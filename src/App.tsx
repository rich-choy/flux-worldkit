import { useState, useEffect } from 'react'
import type { GeneratedWorld, GAEAPlace, WorldGenerationConfig } from '@flux'

// Import components
import { SpatialView } from './components/SpatialView'
import { NetworkView } from './components/NetworkView'
import { AnalysisView } from './components/AnalysisView'
import { DetailView } from './components/DetailView'
import { ViewTabs } from './components/ViewTabs'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ErrorBoundary } from './components/ErrorBoundary'

export type ViewType = 'spatial' | 'network' | 'analysis' | 'detail'

interface AppState {
  currentWorld: GeneratedWorld | null
  selectedPlace: GAEAPlace | null
  currentView: ViewType
  isLoading: boolean
  config: WorldGenerationConfig
}

const DEFAULT_CONFIG: WorldGenerationConfig = {
  topology: {
    central_plateau: {
      center: [0, 0],
      radius: 6.4,
      elevation: 2000
    },
    mountain_ring: {
      inner_radius: 6.4,
      outer_radius: 10.2,
      elevation_range: [2500, 4000]
    },
    ecosystem_slices: {
      slice_count: 3,
      outer_radius: 25.6,
      elevation_range: [500, 1500]
    }
  },
  ecosystem_distribution: {
    'flux:eco:forest:temperate': 0.40,
    'flux:eco:grassland:temperate': 0.30,
    'flux:eco:grassland:arid': 0.05,
    'flux:eco:mountain:alpine': 0.15,
    'flux:eco:mountain:forest': 0.10
  },
  gaea_intensity: 0.7,
  fungal_spread_factor: 0.6,
  worshipper_density: 0.5,
  place_density: 0.004,
  random_seed: 42
}

function App() {
  const [state, setState] = useState<AppState>({
    currentWorld: null,
    selectedPlace: null,
    currentView: 'spatial',
    isLoading: false,
    config: DEFAULT_CONFIG
  })

  // Load default config on mount
  useEffect(() => {
    const loadDefaultConfig = async () => {
      try {
        const { getDefaultWorldConfig } = await import('~/lib/flux-wrapper')
        const defaultConfig = await getDefaultWorldConfig()
        setState(prev => ({ ...prev, config: defaultConfig }))
      } catch (error) {
        console.error('Failed to load default config:', error)
      }
    }
    loadDefaultConfig()
  }, [])

  // Generate initial world
  useEffect(() => {
    handleGenerateWorld()
  }, [])

  const handleGenerateWorld = async () => {
    setState(prev => ({ ...prev, isLoading: true, selectedPlace: null }))

    try {
      // Use setTimeout to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 100))

      // Use our ESM wrapper
      const { generateWorld } = await import('~/lib/flux-wrapper')
      const world = await generateWorld(state.config)

      setState(prev => ({
        ...prev,
        currentWorld: world,
        isLoading: false
      }))
    } catch (error) {
      console.error('Error generating world:', error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const handleConfigChange = (newConfig: Partial<WorldGenerationConfig>) => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, ...newConfig }
    }))
  }

  const handleViewChange = (view: ViewType) => {
    setState(prev => ({ ...prev, currentView: view }))
  }

  const handlePlaceSelect = (place: GAEAPlace | null) => {
    setState(prev => ({ ...prev, selectedPlace: place }))
  }

  const handleExportWorldData = () => {
    if (!state.currentWorld) return

    const dataStr = JSON.stringify(state.currentWorld, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'world-data.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportGameFormat = () => {
    if (!state.currentWorld) return

    const gamePlaces = state.currentWorld.places.map((place: GAEAPlace) => ({
      id: place.id,
      name: place.name,
      description: place.description,
      exits: place.exits
    }))

    const dataStr = JSON.stringify(gamePlaces, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'places.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderCurrentView = () => {
    if (state.isLoading) {
      return <LoadingSpinner />
    }

    if (!state.currentWorld) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-text-dim mb-2">No world generated</h3>
            <p className="text-text-dim">Click "Generate New World" to create a world</p>
          </div>
        </div>
      )
    }

    switch (state.currentView) {
      case 'spatial':
        return (
          <SpatialView
            world={state.currentWorld}
            selectedPlace={state.selectedPlace}
            onPlaceSelect={handlePlaceSelect}
            config={state.config}
            onConfigChange={handleConfigChange}
            onGenerateWorld={handleGenerateWorld}
            onExportWorldData={handleExportWorldData}
            onExportGameFormat={handleExportGameFormat}
            isLoading={state.isLoading}
          />
        )
      case 'network':
        return (
          <NetworkView
            world={state.currentWorld}
            selectedPlace={state.selectedPlace}
            onPlaceSelect={handlePlaceSelect}
          />
        )
      case 'analysis':
        return <AnalysisView world={state.currentWorld} />
      case 'detail':
        return <DetailView selectedPlace={state.selectedPlace} />
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-danger">Unknown view</h3>
            </div>
          </div>
        )
    }
  }

  return (
    <ErrorBoundary>
      <div className="h-screen bg-background text-text relative overflow-hidden">
        {/* Full-screen visualization */}
        <div className="absolute inset-0">
          {renderCurrentView()}
        </div>

        {/* Floating view tabs */}
        <div className="absolute top-4 right-4 z-20">
          <ViewTabs
            currentView={state.currentView}
            onViewChange={handleViewChange}
          />
        </div>

        {/* Detail panel for selected place */}
        {state.selectedPlace && state.currentView !== 'detail' && (
          <div className="absolute bottom-4 right-4 z-20 max-w-sm">
            <div className="bg-surface/90 backdrop-blur-sm border border-border rounded-lg p-4">
              <DetailView selectedPlace={state.selectedPlace} />
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
