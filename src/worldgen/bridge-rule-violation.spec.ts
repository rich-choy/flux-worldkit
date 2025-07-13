import { describe, it, expect } from 'vitest'
import { generateWorld } from './generator'
import type { WorldGenerationConfig } from './types'

describe('Bridge Rule Violations - Seed 52275', () => {
  const config: WorldGenerationConfig = {
    worldWidth: 14.5,
    worldHeight: 9.0,
    placeSize: 100,
    placeMargin: 200,
    globalBranchingFactor: 1.0,
    seed: 52275
  }

  it('should follow ecosystem progression rules for inter-ecosystem bridges', async () => {
    const world = generateWorld(config)

    // World center line should be at worldHeight/2 in meters
    const worldCenterY = config.worldHeight * 1000 / 2 // 4500m for 9km world
    const centerLineTolerance = 150 // ±150m tolerance

    // Check for the specific problematic vertex mentioned by user
    const problematicVertex = world.vertices.find(v => v.id === 'vertex_2MSFITlY')
    expect(problematicVertex).toBeDefined()
    expect(problematicVertex?.ecosystem).toBe('flux:eco:mountain:arid')

    if (problematicVertex) {
      const correspondingPlace = world.places.find(p => p.id === problematicVertex.placeId)
      expect(correspondingPlace).toBeDefined()

      // Analyze the exits from this mountain vertex
      const exits = correspondingPlace?.exits || {}
      console.log('Mountain vertex exits:', exits)

            // Check for bridge connections OR direct connections to next ecosystem
      const bridgeConnections = Object.values(exits).filter((exit: any) =>
        exit.to.startsWith('flux:place:bridge-')
      )

      const directJungleConnections = Object.values(exits).filter((exit: any) => {
        const targetVertex = world.vertices.find(v => v.placeId === exit.to)
        return targetVertex?.ecosystem === 'flux:eco:jungle:tropical'
      })

      // Mountain should connect to Jungle (either via bridge or directly)
      const totalJungleConnections = bridgeConnections.length + directJungleConnections.length
      expect(totalJungleConnections).toBeGreaterThan(0)

      if (bridgeConnections.length > 0) {
        // If there are bridge connections, they should follow the rules
        for (const bridgeExit of bridgeConnections) {
          const bridgeVertex = world.vertices.find(v => v.placeId === bridgeExit.to)

          console.log('Bridge connection analysis:', {
            bridgeId: bridgeExit.to,
            bridgeEcosystem: bridgeVertex?.ecosystem,
            bridgePosition: { x: bridgeVertex?.x, y: bridgeVertex?.y },
            distanceFromCenterLine: bridgeVertex ? Math.abs(bridgeVertex.y - worldCenterY) : 'N/A'
          })

          // RULE 1: Mountain bridge should target Jungle ecosystem
          expect(bridgeVertex?.ecosystem).toBe('flux:eco:jungle:tropical')

          // RULE 2: Bridge vertex should be on center line (±150m tolerance)
          if (bridgeVertex) {
            const distanceFromCenter = Math.abs(bridgeVertex.y - worldCenterY)
            expect(distanceFromCenter).toBeLessThanOrEqual(centerLineTolerance)
          }
        }
      } else {
        // Direct connection to jungle is also acceptable
        console.log('Mountain connects directly to Jungle (no intermediate bridge)')
      }
    }
  })

  it('should enforce West-to-East ecosystem progression for all bridges', async () => {
    const world = generateWorld(config)

    // Define ecosystem progression order (West to East)
    const ecosystemProgression = [
      'flux:eco:steppe:arid',
      'flux:eco:grassland:temperate',
      'flux:eco:forest:temperate',
      'flux:eco:mountain:arid',
      'flux:eco:jungle:tropical'
    ]

    // Check all bridge vertices
    const bridgeVertices = world.vertices.filter(v => v.id.startsWith('bridge-'))

    for (const bridgeVertex of bridgeVertices) {
      const bridgePlace = world.places.find(p => p.id === bridgeVertex.placeId)

      // Check what ecosystems this bridge connects
      const connectedEcosystems = new Set<string>()

      if (bridgePlace?.exits) {
        for (const exit of Object.values(bridgePlace.exits)) {
          const targetVertex = world.vertices.find(v => v.placeId === (exit as any).to)
          if (targetVertex) {
            connectedEcosystems.add(targetVertex.ecosystem)
          }
        }
      }

      // Find vertices that connect TO this bridge
      for (const place of world.places) {
        if (place.exits) {
          for (const exit of Object.values(place.exits)) {
            if ((exit as any).to === bridgeVertex.placeId) {
              const sourceVertex = world.vertices.find(v => v.placeId === place.id)
              if (sourceVertex) {
                connectedEcosystems.add(sourceVertex.ecosystem)
              }
            }
          }
        }
      }

      // Bridge should only connect adjacent ecosystems in progression
      const ecosystemsArray = Array.from(connectedEcosystems)
      if (ecosystemsArray.length >= 2) {
        const indices = ecosystemsArray.map(eco => ecosystemProgression.indexOf(eco))
        indices.sort((a, b) => a - b)

        // Adjacent ecosystems should have consecutive indices
        for (let i = 1; i < indices.length; i++) {
          expect(indices[i] - indices[i-1]).toBe(1)
        }
      }
    }
  })

  it('should place all bridge vertices on the horizontal center line', async () => {
    const world = generateWorld(config)

    const worldCenterY = config.worldHeight * 1000 / 2 // 4500m for 9km world
    const centerLineTolerance = 150 // ±150m tolerance

        // Find all bridge vertices (intermediate vertices created by bridge algorithm)
    const bridgeVertices = world.vertices.filter(v => v.id.startsWith('bridge-'))

    console.log(`Found ${bridgeVertices.length} bridge vertices`)

    if (bridgeVertices.length === 0) {
      console.log('No intermediate bridge vertices found - all connections are direct')
      return // Skip test if no bridge vertices exist
    }

    for (const bridgeVertex of bridgeVertices) {
      const distanceFromCenter = Math.abs(bridgeVertex.y - worldCenterY)

      console.log('Bridge vertex center line check:', {
        id: bridgeVertex.id,
        ecosystem: bridgeVertex.ecosystem,
        position: { x: bridgeVertex.x, y: bridgeVertex.y },
        worldCenterY,
        distanceFromCenter,
        isOnCenterLine: distanceFromCenter <= centerLineTolerance
      })

      // RULE: All bridge vertices must be on center line (±150m tolerance)
      expect(distanceFromCenter).toBeLessThanOrEqual(centerLineTolerance)
    }
  })
})

describe('Stray Inter-Ecosystem Connections - Seed 256266', () => {
  const config: WorldGenerationConfig = {
    worldWidth: 14.5,
    worldHeight: 9.0,
    placeSize: 100,
    placeMargin: 200,
    globalBranchingFactor: 1.0,
    seed: 256266
  }

  it('should not have unauthorized inter-ecosystem connections', async () => {
    const world = generateWorld(config)

    // World center line should be at worldHeight/2 in meters
    const worldCenterY = config.worldHeight * 1000 / 2 // 4500m for 9km world
    const centerLineTolerance = 150 // ±150m tolerance

    // Define ecosystem progression order
    const ecosystemOrder = [
      'flux:eco:steppe:arid',
      'flux:eco:grassland:temperate',
      'flux:eco:forest:temperate',
      'flux:eco:mountain:arid',
      'flux:eco:jungle:tropical'
    ]

    // Track all stray connections (connections that cross ecosystem boundaries)
    const strayConnections: Array<{
      fromVertex: any,
      toVertex: any,
      fromEcosystem: string,
      toEcosystem: string,
      isBridge: boolean
    }> = []

    // Check every vertex's connections
    for (const vertex of world.vertices) {
      const place = world.places.find(p => p.id === vertex.placeId)
      if (!place) continue

      const exits = place.exits || {}

      for (const exit of Object.values(exits)) {
        const targetVertex = world.vertices.find(v => v.placeId === (exit as any).to)
        if (!targetVertex) continue

        // Check if this is a cross-ecosystem connection
        if (vertex.ecosystem !== targetVertex.ecosystem) {
          const isBridge = vertex.id.startsWith('bridge-') || targetVertex.id.startsWith('bridge-')

          strayConnections.push({
            fromVertex: vertex,
            toVertex: targetVertex,
            fromEcosystem: vertex.ecosystem,
            toEcosystem: targetVertex.ecosystem,
            isBridge
          })
        }
      }
    }

    console.log(`Found ${strayConnections.length} inter-ecosystem connections`)

    // Analyze the connections
    const unauthorizedConnections = strayConnections.filter(conn => {
      // Check if this follows the proper west-east progression
      const fromIndex = ecosystemOrder.indexOf(conn.fromEcosystem)
      const toIndex = ecosystemOrder.indexOf(conn.toEcosystem)

      // Should only connect to adjacent ecosystems in the progression
      const isValidProgression = Math.abs(fromIndex - toIndex) === 1

      // Bridge vertices should be on or near the center line
      const fromOnCenterLine = Math.abs(conn.fromVertex.y - worldCenterY) <= centerLineTolerance
      const toOnCenterLine = Math.abs(conn.toVertex.y - worldCenterY) <= centerLineTolerance

      if (!isValidProgression) {
        console.log(`❌ Invalid progression: ${conn.fromEcosystem.split(':')[2]} → ${conn.toEcosystem.split(':')[2]}`)
        return true // This is unauthorized
      }

      if (!fromOnCenterLine || !toOnCenterLine) {
        console.log(`❌ Off-center connection: ${conn.fromVertex.id} (${conn.fromVertex.y}m) → ${conn.toVertex.id} (${conn.toVertex.y}m)`)
        return true // This is unauthorized
      }

      return false // This connection is authorized
    })

    console.log(`Found ${unauthorizedConnections.length} unauthorized inter-ecosystem connections`)

    // Log details of unauthorized connections
    unauthorizedConnections.forEach(conn => {
      console.log(`  ${conn.fromVertex.id} (${conn.fromEcosystem.split(':')[2]}) → ${conn.toVertex.id} (${conn.toEcosystem.split(':')[2]})`)
    })

    // There should be no unauthorized connections
    expect(unauthorizedConnections.length).toBe(0)
  })

  it('should have proper bridge vertices for authorized connections', async () => {
    const world = generateWorld(config)

    const bridgeVertices = world.vertices.filter(v => v.id.startsWith('bridge-'))
    console.log(`Found ${bridgeVertices.length} bridge vertices`)

    // All bridge vertices should be on the center line
    const worldCenterY = config.worldHeight * 1000 / 2
    const centerLineTolerance = 150

    for (const bridge of bridgeVertices) {
      const distanceFromCenter = Math.abs(bridge.y - worldCenterY)
      console.log(`Bridge ${bridge.id}: ${distanceFromCenter}m from center (ecosystem: ${bridge.ecosystem.split(':')[2]})`)

      expect(distanceFromCenter).toBeLessThanOrEqual(centerLineTolerance)
    }
  })
})
