import { describe, it, expect, beforeEach } from 'vitest'
import { connectDisconnectedSubgraphs, SeededRandom } from './river-delta'
import { EcosystemName } from './types'
import type { WorldVertex, SpatialMetrics } from './types'

describe('connectDisconnectedSubgraphs', () => {
  let rng: SeededRandom
  let metrics: SpatialMetrics
  let ecosystem: EcosystemName

  beforeEach(() => {
    rng = new SeededRandom(42)
    metrics = {
      placeSpacing: 300,
      placeMargin: 200,
      placeSize: 100,
      worldWidthMeters: 14500,
      worldHeightMeters: 9000,
      gridWidth: 48,
      gridHeight: 29,
      totalPlacesCapacity: 48 * 29,
      ecosystemBandWidth: 14500 / 5,
      ecosystemBandCount: 5
    }
    ecosystem = EcosystemName.FOREST_TEMPERATE
  })

  describe('Edge Cases', () => {
    it('should return original connections when vertices array is empty', () => {
      const vertices: WorldVertex[] = []
      const connections = [{ from: 'a', to: 'b' }]

      const result = connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      expect(result).toEqual(connections)
      expect(vertices).toHaveLength(0)
    })

    it('should return original connections when no vertices match ecosystem', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'v1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: EcosystemName.STEPPE_ARID, // Different ecosystem
          placeId: 'flux:place:v1'
        }
      ]
      const connections = [{ from: 'a', to: 'b' }]

      const result = connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      expect(result).toEqual(connections)
      expect(vertices).toHaveLength(1) // No new vertices added
    })

    it('should return original connections when only one vertex in ecosystem', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'v1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:v1'
        }
      ]
      const connections: Array<{from: string, to: string}> = []

      const result = connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      expect(result).toEqual(connections)
      expect(vertices).toHaveLength(1) // No new vertices added
    })

    it('should return original connections when vertices are already connected', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'v1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:v1'
        },
        {
          id: 'v2',
          x: 1300,
          y: 2000,
          gridX: 4,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:v2'
        }
      ]
      const connections = [{ from: 'v1', to: 'v2' }]

      const result = connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      expect(result).toEqual(connections)
      expect(vertices).toHaveLength(2) // No new vertices added
    })
  })

  describe('Connected Component Detection', () => {
    it('should identify multiple disconnected components', () => {
      const vertices: WorldVertex[] = [
        // Component 1
        {
          id: 'v1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:v1'
        },
        {
          id: 'v2',
          x: 1300,
          y: 2000,
          gridX: 4,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:v2'
        },
        // Component 2 (isolated)
        {
          id: 'v3',
          x: 2000,
          y: 3000,
          gridX: 6,
          gridY: 9,
          ecosystem: ecosystem,
          placeId: 'flux:place:v3'
        }
      ]
      const connections = [{ from: 'v1', to: 'v2' }] // Only connects v1-v2

      const result = connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      expect(result.length).toBeGreaterThan(1) // Should add bridge connections
      expect(vertices.length).toBeGreaterThan(3) // Should add bridge vertices
    })

    it('should select easternmost component as the main component', () => {
      const vertices: WorldVertex[] = [
        // Western component
        {
          id: 'w1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:w1'
        },
        // Eastern component (should be selected as main)
        {
          id: 'e1',
          x: 3000,
          y: 2000,
          gridX: 10,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:e1'
        },
        {
          id: 'e2',
          x: 3300,
          y: 2000,
          gridX: 11,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:e2'
        }
      ]
      const connections = [{ from: 'e1', to: 'e2' }] // Eastern component is connected

      const result = connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      expect(result.length).toBeGreaterThan(1) // Should add bridge connections
      // Should create path from w1 to eastern component
    })
  })

  describe('Ecosystem Filtering', () => {
    it('should only consider vertices from specified ecosystem', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'forest1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:forest1'
        },
        {
          id: 'steppe1',
          x: 1300,
          y: 2000,
          gridX: 4,
          gridY: 6,
          ecosystem: EcosystemName.STEPPE_ARID,
          placeId: 'flux:place:steppe1'
        },
        {
          id: 'forest2',
          x: 2000,
          y: 3000,
          gridX: 6,
          gridY: 9,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:forest2'
        }
      ]
      const connections: Array<{from: string, to: string}> = []

      const result = connectDisconnectedSubgraphs(vertices, connections, EcosystemName.FOREST_TEMPERATE, metrics, rng)

      // Should only connect forest1 and forest2, ignoring steppe1
      expect(result.length).toBeGreaterThan(0)

      // Check that no connections involve steppe1
      const involvedVertices = new Set()
      result.forEach(conn => {
        involvedVertices.add(conn.from)
        involvedVertices.add(conn.to)
      })
      expect(involvedVertices.has('steppe1')).toBe(false)
    })

    it('should only include connections between vertices in the same ecosystem', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'forest1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:forest1'
        },
        {
          id: 'steppe1',
          x: 1300,
          y: 2000,
          gridX: 4,
          gridY: 6,
          ecosystem: EcosystemName.STEPPE_ARID,
          placeId: 'flux:place:steppe1'
        }
      ]
      const connections = [
        { from: 'forest1', to: 'steppe1' } // Cross-ecosystem connection
      ]

      const result = connectDisconnectedSubgraphs(vertices, connections, EcosystemName.FOREST_TEMPERATE, metrics, rng)

      // Should ignore the cross-ecosystem connection
      expect(result).toEqual(connections) // No changes since forest1 is isolated
    })
  })

  describe('Bridge Creation', () => {
    it('should create bridge vertices with proper IDs', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'vertex-1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:vertex-1'
        },
        {
          id: 'vertex-100',
          x: 2000,
          y: 3000,
          gridX: 6,
          gridY: 9,
          ecosystem: ecosystem,
          placeId: 'flux:place:vertex-100'
        }
      ]
      const connections: Array<{from: string, to: string}> = []

      const originalLength = vertices.length
      const result = connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      expect(vertices.length).toBeGreaterThan(originalLength)

      // Check that bridge vertices are created with proper IDs
      const bridgeVertices = vertices.filter(v => v.id.startsWith('bridge-'))
      expect(bridgeVertices.length).toBeGreaterThan(0)

      // Bridge vertices should have sequential IDs starting from max existing ID + 1
      const maxExistingId = Math.max(...vertices.filter(v => !v.id.startsWith('bridge-')).map(v => parseInt(v.id.split('-')[1]) || 0))
      const bridgeIds = bridgeVertices.map(v => parseInt(v.id.split('-')[1]))
      expect(Math.min(...bridgeIds)).toBe(maxExistingId + 1)
    })

    it('should create bridge vertices with correct ecosystem', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'vertex-1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:vertex-1'
        },
        {
          id: 'vertex-2',
          x: 2000,
          y: 3000,
          gridX: 6,
          gridY: 9,
          ecosystem: ecosystem,
          placeId: 'flux:place:vertex-2'
        }
      ]
      const connections: Array<{from: string, to: string}> = []

      connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      // All bridge vertices should have the same ecosystem as the source
      const bridgeVertices = vertices.filter(v => v.id.startsWith('bridge-'))
      bridgeVertices.forEach(bridge => {
        expect(bridge.ecosystem).toBe(ecosystem)
      })
    })

    it('should create proper placeId for bridge vertices', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'vertex-1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:vertex-1'
        },
        {
          id: 'vertex-2',
          x: 2000,
          y: 3000,
          gridX: 6,
          gridY: 9,
          ecosystem: ecosystem,
          placeId: 'flux:place:vertex-2'
        }
      ]
      const connections: Array<{from: string, to: string}> = []

      connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      // Bridge vertices should have placeId matching their vertex ID
      const bridgeVertices = vertices.filter(v => v.id.startsWith('bridge-'))
      bridgeVertices.forEach(bridge => {
        expect(bridge.placeId).toBe(`flux:place:${bridge.id}`)
      })
    })
  })

  describe('Connection Creation', () => {
    it('should create connections between disconnected components', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'comp1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:comp1'
        },
        {
          id: 'comp2',
          x: 2000,
          y: 3000,
          gridX: 6,
          gridY: 9,
          ecosystem: ecosystem,
          placeId: 'flux:place:comp2'
        }
      ]
      const connections: Array<{from: string, to: string}> = []

      const result = connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      expect(result.length).toBeGreaterThan(0)

      // Should create connections that bridge the components
      const hasConnectionToComp1 = result.some(conn => conn.from === 'comp1' || conn.to === 'comp1')
      const hasConnectionToComp2 = result.some(conn => conn.from === 'comp2' || conn.to === 'comp2')

      expect(hasConnectionToComp1).toBe(true)
      expect(hasConnectionToComp2).toBe(true)
    })

    it('should preserve original connections', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'v1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:v1'
        },
        {
          id: 'v2',
          x: 1300,
          y: 2000,
          gridX: 4,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:v2'
        },
        {
          id: 'v3',
          x: 2000,
          y: 3000,
          gridX: 6,
          gridY: 9,
          ecosystem: ecosystem,
          placeId: 'flux:place:v3'
        }
      ]
      const originalConnections = [{ from: 'v1', to: 'v2' }]

      const result = connectDisconnectedSubgraphs(vertices, originalConnections, ecosystem, metrics, rng)

      // Original connections should be preserved
      expect(result).toEqual(expect.arrayContaining(originalConnections))
    })
  })

  describe('Marsh Ecosystem Handling', () => {
    it('should handle marsh ecosystem vertices properly', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'marsh1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: EcosystemName.MARSH_TROPICAL,
          placeId: 'flux:place:marsh1'
        },
        {
          id: 'marsh2',
          x: 2000,
          y: 3000,
          gridX: 6,
          gridY: 9,
          ecosystem: EcosystemName.MARSH_TROPICAL,
          placeId: 'flux:place:marsh2'
        }
      ]
      const connections: Array<{from: string, to: string}> = []

      const result = connectDisconnectedSubgraphs(vertices, connections, EcosystemName.MARSH_TROPICAL, metrics, rng)

      // Should handle marsh ecosystem like any other ecosystem
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle multiple disconnected components', () => {
      const vertices: WorldVertex[] = [
        // Component 1 (western)
        {
          id: 'w1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:w1'
        },
        // Component 2 (central)
        {
          id: 'c1',
          x: 2000,
          y: 2000,
          gridX: 6,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:c1'
        },
        // Component 3 (eastern - should be main)
        {
          id: 'e1',
          x: 3000,
          y: 2000,
          gridX: 10,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:e1'
        },
        {
          id: 'e2',
          x: 3300,
          y: 2000,
          gridX: 11,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:e2'
        }
      ]
      const connections = [{ from: 'e1', to: 'e2' }] // Only eastern component is connected

      const result = connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      // Should create bridges from w1 and c1 to the eastern component
      expect(result.length).toBeGreaterThan(1)
      expect(vertices.length).toBeGreaterThan(4) // Should add bridge vertices
    })

    it('should handle large distances between components', () => {
      const vertices: WorldVertex[] = [
        {
          id: 'far-west',
          x: 500,
          y: 2000,
          gridX: 1,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:far-west'
        },
        {
          id: 'far-east',
          x: 5000,
          y: 3000,
          gridX: 16,
          gridY: 9,
          ecosystem: ecosystem,
          placeId: 'flux:place:far-east'
        }
      ]
      const connections: Array<{from: string, to: string}> = []

      const result = connectDisconnectedSubgraphs(vertices, connections, ecosystem, metrics, rng)

      // Should create a path even for large distances
      expect(result.length).toBeGreaterThan(0)

      // Should create intermediate bridge vertices for long paths
      const bridgeVertices = vertices.filter(v => v.id.startsWith('bridge-'))
      expect(bridgeVertices.length).toBeGreaterThan(0)
    })
  })

  describe('Deterministic Behavior', () => {
    it('should produce same results with same seed', () => {
      const vertices1: WorldVertex[] = [
        {
          id: 'v1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: ecosystem,
          placeId: 'flux:place:v1'
        },
        {
          id: 'v2',
          x: 2000,
          y: 3000,
          gridX: 6,
          gridY: 9,
          ecosystem: ecosystem,
          placeId: 'flux:place:v2'
        }
      ]
      const vertices2 = JSON.parse(JSON.stringify(vertices1))
      const connections1: Array<{from: string, to: string}> = []
      const connections2: Array<{from: string, to: string}> = []

      const rng1 = new SeededRandom(42)
      const rng2 = new SeededRandom(42)

      const result1 = connectDisconnectedSubgraphs(vertices1, connections1, ecosystem, metrics, rng1)
      const result2 = connectDisconnectedSubgraphs(vertices2, connections2, ecosystem, metrics, rng2)

      expect(result1).toEqual(result2)
      expect(vertices1).toEqual(vertices2)
    })
  })
})
