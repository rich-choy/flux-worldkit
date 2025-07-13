import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { addExitsToPlaces } from './river-delta'
import { Direction, createPlace, type Place } from 'flux-game'
import { EcosystemName } from './types'
import type { WorldVertex } from './types'

// Helper function to create test places
function createTestPlace(id: string, name: string): Place {
  return createPlace({ id: id as any, name, exits: {} })
}

describe('addExitsToPlaces', () => {
  let consoleSpy: any

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('Edge Cases', () => {
    it('should handle empty places array', () => {
      const places: Place[] = []
      const connections = [{ from: 'v1', to: 'v2' }]
      const vertices: WorldVertex[] = []

      expect(() => addExitsToPlaces(places, connections, vertices)).not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith('Processing 1 connections...')
    })

    it('should handle empty connections array', () => {
      const places: Place[] = [
        createTestPlace('flux:place:v1', 'Place 1')
      ]
      const connections: Array<{from: string, to: string}> = []
      const vertices: WorldVertex[] = []

      addExitsToPlaces(places, connections, vertices)

      expect(places[0].exits).toEqual({})
      expect(consoleSpy).toHaveBeenCalledWith('Processing 0 connections...')
    })

    it('should handle empty vertices array', () => {
      const places: Place[] = [
        { id: 'flux:place:v1', name: 'Place 1', exits: {} },
        { id: 'flux:place:v2', name: 'Place 2', exits: {} }
      ]
      const connections = [{ from: 'v1', to: 'v2' }]
      const vertices: WorldVertex[] = []

      addExitsToPlaces(places, connections, vertices)

      // Should create exits using fallback directions
      expect(places[0].exits[Direction.EAST]).toBeDefined()
      expect(places[1].exits[Direction.WEST]).toBeDefined()
    })
  })

  describe('Valid Connections', () => {
    it('should create bidirectional exits for valid connections with coordinates', () => {
      const places: Place[] = [
        { id: 'flux:place:v1', name: 'Western Place', exits: {} },
        { id: 'flux:place:v2', name: 'Eastern Place', exits: {} }
      ]
      const connections = [{ from: 'v1', to: 'v2' }]
      const vertices: WorldVertex[] = [
        {
          id: 'v1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:v1'
        },
        {
          id: 'v2',
          x: 1300,
          y: 2000,
          gridX: 4,
          gridY: 6,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:v2'
        }
      ]

      addExitsToPlaces(places, connections, vertices)

      // Check forward connection (v1 -> v2, going east)
      expect(places[0].exits[Direction.EAST]).toEqual({
        direction: Direction.EAST,
        label: 'To Eastern Place',
        to: 'flux:place:v2'
      })

      // Check reverse connection (v2 -> v1, going west)
      expect(places[1].exits[Direction.WEST]).toEqual({
        direction: Direction.WEST,
        label: 'To Western Place',
        to: 'flux:place:v1'
      })
    })

    it('should calculate correct directions for diagonal connections', () => {
      const places: Place[] = [
        { id: 'flux:place:v1', name: 'Southwest Place', exits: {} },
        { id: 'flux:place:v2', name: 'Northeast Place', exits: {} }
      ]
      const connections = [{ from: 'v1', to: 'v2' }]
      const vertices: WorldVertex[] = [
        {
          id: 'v1',
          x: 1000,
          y: 2300,
          gridX: 3,
          gridY: 7,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:v1'
        },
        {
          id: 'v2',
          x: 1300,
          y: 2000,
          gridX: 4,
          gridY: 6,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:v2'
        }
      ]

      addExitsToPlaces(places, connections, vertices)

      // From southwest to northeast should be NORTHEAST
      expect(places[0].exits[Direction.NORTHEAST]).toBeDefined()
      // From northeast to southwest should be SOUTHWEST
      expect(places[1].exits[Direction.SOUTHWEST]).toBeDefined()
    })

    it('should use fallback directions when coordinates are missing', () => {
      const places: Place[] = [
        { id: 'flux:place:v1', name: 'Place 1', exits: {} },
        { id: 'flux:place:v2', name: 'Place 2', exits: {} }
      ]
      const connections = [{ from: 'v1', to: 'v2' }]
      const vertices: WorldVertex[] = [
        // Missing v1 coordinates
        {
          id: 'v2',
          x: 1300,
          y: 2000,
          gridX: 4,
          gridY: 6,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:v2'
        }
      ]

      addExitsToPlaces(places, connections, vertices)

      // Should fall back to east/west
      expect(places[0].exits[Direction.EAST]).toBeDefined()
      expect(places[1].exits[Direction.WEST]).toBeDefined()
    })
  })

  describe('Invalid Connections', () => {
    it('should handle missing from place', () => {
      const places: Place[] = [
        { id: 'flux:place:v2', name: 'Place 2', exits: {} }
      ]
      const connections = [{ from: 'v1', to: 'v2' }]
      const vertices: WorldVertex[] = []

      addExitsToPlaces(places, connections, vertices)

      // v2 should not have any exits since v1 place doesn't exist
      expect(places[0].exits).toEqual({})
      expect(consoleSpy).toHaveBeenCalledWith('  FAILED CONNECTION: v1 -> v2 (fromPlace: false, toPlace: true)')
    })

    it('should handle missing to place', () => {
      const places: Place[] = [
        { id: 'flux:place:v1', name: 'Place 1', exits: {} }
      ]
      const connections = [{ from: 'v1', to: 'v2' }]
      const vertices: WorldVertex[] = []

      addExitsToPlaces(places, connections, vertices)

      // v1 should not have any exits since v2 place doesn't exist
      expect(places[0].exits).toEqual({})
      expect(consoleSpy).toHaveBeenCalledWith('  FAILED CONNECTION: v1 -> v2 (fromPlace: true, toPlace: false)')
    })

    it('should handle both places missing', () => {
      const places: Place[] = []
      const connections = [{ from: 'v1', to: 'v2' }]
      const vertices: WorldVertex[] = []

      addExitsToPlaces(places, connections, vertices)

      expect(consoleSpy).toHaveBeenCalledWith('  FAILED CONNECTION: v1 -> v2 (fromPlace: false, toPlace: false)')
    })
  })

  describe('Cross-Ecosystem Connections', () => {
    it('should detect cross-ecosystem connections', () => {
      const places: Place[] = [
        { id: 'flux:place:forest1', name: 'Forest Place', exits: {} },
        { id: 'flux:place:steppe1', name: 'Steppe Place', exits: {} }
      ]
      const connections = [{ from: 'forest1', to: 'steppe1' }]
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

      addExitsToPlaces(places, connections, vertices)

      // Currently the function creates these connections - this is where unauthorized connections come from!
      expect(places[0].exits[Direction.EAST]).toBeDefined()
      expect(places[1].exits[Direction.WEST]).toBeDefined()

      // This test documents the current behavior - we should add validation to prevent this
      expect(places[0].exits[Direction.EAST].to).toBe('flux:place:steppe1')
      expect(places[1].exits[Direction.WEST].to).toBe('flux:place:forest1')
    })

    it('should handle jungle-marsh connections (expected)', () => {
      const places: Place[] = [
        { id: 'flux:place:jungle1', name: 'Jungle Place', exits: {} },
        { id: 'flux:place:marsh1', name: 'Marsh Place', exits: {} }
      ]
      const connections = [{ from: 'jungle1', to: 'marsh1' }]
      const vertices: WorldVertex[] = [
        {
          id: 'jungle1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: EcosystemName.JUNGLE_TROPICAL,
          placeId: 'flux:place:jungle1'
        },
        {
          id: 'marsh1',
          x: 1300,
          y: 2000,
          gridX: 4,
          gridY: 6,
          ecosystem: EcosystemName.MARSH_TROPICAL,
          placeId: 'flux:place:marsh1'
        }
      ]

      addExitsToPlaces(places, connections, vertices)

      // Jungle-marsh connections should be allowed
      expect(places[0].exits[Direction.EAST]).toBeDefined()
      expect(places[1].exits[Direction.WEST]).toBeDefined()
    })
  })

  describe('Direction Calculation', () => {
    it('should calculate all 8 directions correctly', () => {
      const testCases = [
        { from: [0, 0], to: [1, 0], expected: Direction.EAST },
        { from: [0, 0], to: [-1, 0], expected: Direction.WEST },
        { from: [0, 0], to: [0, -1], expected: Direction.NORTH },
        { from: [0, 0], to: [0, 1], expected: Direction.SOUTH },
        { from: [0, 0], to: [1, -1], expected: Direction.NORTHEAST },
        { from: [0, 0], to: [1, 1], expected: Direction.SOUTHEAST },
        { from: [0, 0], to: [-1, -1], expected: Direction.NORTHWEST },
        { from: [0, 0], to: [-1, 1], expected: Direction.SOUTHWEST }
      ]

      testCases.forEach(({ from, to, expected }, index) => {
        const places: Place[] = [
          { id: `flux:place:v${index}a`, name: `Place ${index}A`, exits: {} },
          { id: `flux:place:v${index}b`, name: `Place ${index}B`, exits: {} }
        ]
        const connections = [{ from: `v${index}a`, to: `v${index}b` }]
        const vertices: WorldVertex[] = [
          {
            id: `v${index}a`,
            x: from[0],
            y: from[1],
            gridX: 0,
            gridY: 0,
            ecosystem: EcosystemName.FOREST_TEMPERATE,
            placeId: `flux:place:v${index}a`
          },
          {
            id: `v${index}b`,
            x: to[0],
            y: to[1],
            gridX: 1,
            gridY: 1,
            ecosystem: EcosystemName.FOREST_TEMPERATE,
            placeId: `flux:place:v${index}b`
          }
        ]

        addExitsToPlaces(places, connections, vertices)

        expect(places[0].exits[expected]).toBeDefined()
        expect(places[0].exits[expected].direction).toBe(expected)
      })
    })
  })

  describe('Multiple Connections', () => {
    it('should handle multiple connections from same place', () => {
      const places: Place[] = [
        { id: 'flux:place:center', name: 'Center Place', exits: {} },
        { id: 'flux:place:north', name: 'North Place', exits: {} },
        { id: 'flux:place:east', name: 'East Place', exits: {} }
      ]
      const connections = [
        { from: 'center', to: 'north' },
        { from: 'center', to: 'east' }
      ]
      const vertices: WorldVertex[] = [
        {
          id: 'center',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:center'
        },
        {
          id: 'north',
          x: 1000,
          y: 1700,
          gridX: 3,
          gridY: 5,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:north'
        },
        {
          id: 'east',
          x: 1300,
          y: 2000,
          gridX: 4,
          gridY: 6,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:east'
        }
      ]

      addExitsToPlaces(places, connections, vertices)

      // Center place should have two exits
      expect(Object.keys(places[0].exits)).toHaveLength(2)
      expect(places[0].exits[Direction.NORTH]).toBeDefined()
      expect(places[0].exits[Direction.EAST]).toBeDefined()

      // Each connected place should have one exit back to center
      expect(Object.keys(places[1].exits)).toHaveLength(1)
      expect(Object.keys(places[2].exits)).toHaveLength(1)
    })

    it('should handle large number of connections', () => {
      const numPlaces = 100
      const places: Place[] = Array.from({ length: numPlaces }, (_, i) => ({
        id: `flux:place:v${i}`,
        name: `Place ${i}`,
        exits: {}
      }))

      const connections = Array.from({ length: numPlaces - 1 }, (_, i) => ({
        from: `v${i}`,
        to: `v${i + 1}`
      }))

      const vertices: WorldVertex[] = Array.from({ length: numPlaces }, (_, i) => ({
        id: `v${i}`,
        x: i * 300,
        y: 2000,
        gridX: i,
        gridY: 6,
        ecosystem: EcosystemName.FOREST_TEMPERATE,
        placeId: `flux:place:v${i}`
      }))

      addExitsToPlaces(places, connections, vertices)

      // Each place (except first and last) should have 2 exits
      expect(Object.keys(places[1].exits)).toHaveLength(2) // middle place
      expect(Object.keys(places[0].exits)).toHaveLength(1) // first place
      expect(Object.keys(places[numPlaces - 1].exits)).toHaveLength(1) // last place
    })
  })

  describe('Bridge Vertices', () => {
    it('should handle bridge vertices correctly', () => {
      const places: Place[] = [
        { id: 'flux:place:v1', name: 'Regular Place', exits: {} },
        { id: 'flux:place:bridge-1', name: 'Bridge Place', exits: {} },
        { id: 'flux:place:v2', name: 'Another Place', exits: {} }
      ]
      const connections = [
        { from: 'v1', to: 'bridge-1' },
        { from: 'bridge-1', to: 'v2' }
      ]
      const vertices: WorldVertex[] = [
        {
          id: 'v1',
          x: 1000,
          y: 2000,
          gridX: 3,
          gridY: 6,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:v1'
        },
        {
          id: 'bridge-1',
          x: 1150,
          y: 2000,
          gridX: 3.5,
          gridY: 6,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:bridge-1'
        },
        {
          id: 'v2',
          x: 1300,
          y: 2000,
          gridX: 4,
          gridY: 6,
          ecosystem: EcosystemName.FOREST_TEMPERATE,
          placeId: 'flux:place:v2'
        }
      ]

      addExitsToPlaces(places, connections, vertices)

      // All connections should work normally
      expect(places[0].exits[Direction.EAST]).toBeDefined()
      expect(places[1].exits[Direction.WEST]).toBeDefined()
      expect(places[1].exits[Direction.EAST]).toBeDefined()
      expect(places[2].exits[Direction.WEST]).toBeDefined()
    })
  })

  describe('Logging and Statistics', () => {
    it('should log connection processing statistics', () => {
      const places: Place[] = [
        { id: 'flux:place:v1', name: 'Place 1', exits: {} },
        { id: 'flux:place:v2', name: 'Place 2', exits: {} }
      ]
      const connections = [
        { from: 'v1', to: 'v2' },
        { from: 'v1', to: 'missing' }
      ]
      const vertices: WorldVertex[] = []

      addExitsToPlaces(places, connections, vertices)

      expect(consoleSpy).toHaveBeenCalledWith('Processing 2 connections...')
      expect(consoleSpy).toHaveBeenCalledWith('  FAILED CONNECTION: v1 -> missing (fromPlace: true, toPlace: false)')
      expect(consoleSpy).toHaveBeenCalledWith('Successful connections: 1, Failed: 1')
    })
  })
})
