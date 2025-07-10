import { useState, useEffect, useCallback, useRef } from 'react'
import type { GeneratedWorld, GAEAPlace, WorldGenerationConfig } from '@flux'

// Import components
import { SpatialView } from './components/SpatialView'
import { NetworkView } from './components/NetworkView'
import { AnalysisView } from './components/AnalysisView'
import { ViewTabs } from './components/ViewTabs'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ErrorBoundary } from './components/ErrorBoundary'

// Import task scheduler
import { scheduleWorldGeneration, taskScheduler } from '~/lib/task-scheduler'

export type ViewType = 'spatial' | 'network' | 'analysis'

interface AppState {
  currentWorld: GeneratedWorld | null
  selectedPlace: GAEAPlace | null
  currentView: ViewType
  isLoading: boolean
  config: WorldGenerationConfig
}

const DEFAULT_CONFIG: WorldGenerationConfig = {
  topology: {
    central_crater: {
      center: [0, 0],
      radius: 6.4,
      elevation: -200
    },
    mountain_ring: {
      inner_radius: 6.4,
      outer_radius: 10.2,
      elevation_range: [1200, 2000]
    },
    ecosystem_slices: {
      slice_count: 3,
      outer_radius: 25.6,
      elevation_range: [300, 1000]
    }
  },
  ecosystem_distribution: {
    'flux:eco:forest:coniferous': 0.40,
    'flux:eco:grassland:subtropical': 0.30,
    'flux:eco:wetland:tropical': 0.05,
    'flux:eco:forest:montane': 0.15,
    'flux:eco:mountain:alpine': 0.10,
    'flux:eco:marsh:tropical': 0.00
  } as any, // Temporary any cast to avoid TypeScript config mismatch
  gaea_intensity: 0.7,
  fungal_spread_factor: 0.6,
  worshipper_density: 0.5,
  place_density: 5.0,
  connectivity: {
    max_exits_per_place: 6,
    connection_distance_factor: 1.5,
    connection_density: 1.0,
    prefer_same_zone: true,
    ecosystem_edge_targets: {
      'flux:eco:forest:coniferous': 1.8,
      'flux:eco:grassland:subtropical': 3.2,
      'flux:eco:wetland:tropical': 2.2,
      'flux:eco:forest:montane': 1.4,
      'flux:eco:mountain:alpine': 1.0,
      'flux:eco:marsh:tropical': 2.8,
    },
    boundary_detection_threshold: 0.05,
    fractal_trails: {
      enabled: true,
      trail_count: 3,
      branching_factor: 2.0,
      branching_angle: Math.PI / 3, // 60 degrees
      max_depth: 4,
      segment_length: 3.0,
      length_variation: 0.4,
      trail_width: 2.0,
      decay_factor: 0.7
    }
  },
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

  // Track current generation task to enable cancellation
  const currentTaskId = useRef<string | null>(null)

  // Load default config on mount
  useEffect(() => {
    const loadDefaultConfig = async () => {
      try {
        const { getDefaultWorldConfig } = await import('@flux')
        const defaultConfig = await getDefaultWorldConfig()
        console.log('Loaded default config:', defaultConfig)
        console.log('Default config ecosystems:', Object.keys(defaultConfig.ecosystem_distribution))
        setState(prev => ({ ...prev, config: defaultConfig }))
      } catch (error) {
        console.error('Failed to load default config:', error)
      }
    }
    loadDefaultConfig()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentTaskId.current) {
        taskScheduler.cancelTask(currentTaskId.current)
      }
    }
  }, [])

  const handleGenerateWorld = useCallback(() => {
    // Cancel any existing task
    if (currentTaskId.current) {
      taskScheduler.cancelTask(currentTaskId.current)
    }

    setState(prev => ({ ...prev, isLoading: true, selectedPlace: null }))

    // Schedule world generation with Priority Task Scheduling API
    currentTaskId.current = scheduleWorldGeneration(state.config, {
      priority: 'user-visible', // User-initiated action, should be visible priority
      onSuccess: (world: GeneratedWorld) => {
        console.log('World generation completed:', {
          placesGenerated: world.places.length,
          configDensity: state.config.place_density,
          expectedPlaces: Math.round(state.config.place_density * 250000),
          hasTrailNetwork: !!world.trail_network,
          trailSystemCount: world.trail_network?.trailSystems.length || 0
        })

        setState(prev => ({
          ...prev,
          currentWorld: world,
          isLoading: false
        }))

        currentTaskId.current = null
      },
      onError: (error: string) => {
        console.error('World generation error:', error)
        setState(prev => ({ ...prev, isLoading: false }))
        currentTaskId.current = null
      }
    })
  }, [state.config])

  const handleConfigChange = (newConfig: Partial<WorldGenerationConfig>) => {
    console.log('Config change:', newConfig)
    setState(prev => {
      const updatedConfig = { ...prev.config, ...newConfig }
      console.log('Updated config:', updatedConfig)
      return {
        ...prev,
        config: updatedConfig
      }
    })
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
        return state.currentWorld ? (
          <NetworkView
            world={state.currentWorld}
            selectedPlace={state.selectedPlace}
            onPlaceSelect={handlePlaceSelect}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-text-dim mb-2">No world generated</h3>
              <p className="text-text-dim">Click "Generate New World" to create a world</p>
            </div>
          </div>
        )
      case 'analysis':
        return state.currentWorld ? (
          <AnalysisView world={state.currentWorld} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-text-dim mb-2">No world generated</h3>
              <p className="text-text-dim">Click "Generate New World" to create a world</p>
            </div>
          </div>
        )
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
      <div className="app-container">
        <div className="main-content">
          <div className="view-container">
            {renderCurrentView()}
          </div>
        </div>

        {/* View Tabs - positioned in top-right corner */}
        <div className="absolute top-4 right-4 z-20">
          <ViewTabs currentView={state.currentView} onViewChange={handleViewChange} />
      </div>
      </div>
    </ErrorBoundary>
  )
}

export default App
