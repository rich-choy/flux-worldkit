import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCombatLog } from './useCombatLog';
import type { EventType, WorldEvent } from '@flux';

function createMockEvent(id: string, type: string, ts: number = Date.now()): WorldEvent {
  return {
    id,
    type: type as unknown as EventType.ACTOR_WAS_CREATED,
    ts,
    trace: 'test-trace',
    actor: 'alice' as any,
    location: 'flux:place:test',
    payload: { test: true }
  } as WorldEvent;
}

describe('useCombatLog', () => {
  const DEFAULT_TIMESTAMP = 1234567890000;

  let mockEvents: WorldEvent[];

  beforeEach(() => {
    mockEvents = [
      createMockEvent('event1', 'combat:test:event1', DEFAULT_TIMESTAMP),
      createMockEvent('event2', 'combat:test:event2', DEFAULT_TIMESTAMP),
      createMockEvent('event3', 'combat:test:event3', DEFAULT_TIMESTAMP),
    ];
  });

  describe('initial state', () => {
    it('should start with empty combat log', () => {
      const { result } = renderHook(() => useCombatLog());

      expect(result.current.combatLog).toEqual([]);
    });
  });

  describe('addEvents', () => {
    it('should add new events to the log', () => {
      const { result } = renderHook(() => useCombatLog());

      act(() => {
        result.current.addEvents([mockEvents[0], mockEvents[1]]);
      });

      expect(result.current.combatLog).toHaveLength(2);
      expect(result.current.combatLog[0]).toEqual(mockEvents[0]);
      expect(result.current.combatLog[1]).toEqual(mockEvents[1]);
    });

    it('should append events to existing log', () => {
      const { result } = renderHook(() => useCombatLog());

      act(() => {
        result.current.addEvents([mockEvents[0]]);
      });

      act(() => {
        result.current.addEvents([mockEvents[1], mockEvents[2]]);
      });

      expect(result.current.combatLog).toHaveLength(3);
      expect(result.current.combatLog.map(e => e.id)).toEqual(['event1', 'event2', 'event3']);
    });

    it('should deduplicate events by id', () => {
      const { result } = renderHook(() => useCombatLog());

      // Add initial events
      act(() => {
        result.current.addEvents([mockEvents[0], mockEvents[1]]);
      });

      // Try to add duplicate events
      act(() => {
        result.current.addEvents([mockEvents[0], mockEvents[2]]);
      });

      expect(result.current.combatLog).toHaveLength(3);
      expect(result.current.combatLog.map(e => e.id)).toEqual(['event1', 'event2', 'event3']);
    });

    it('should handle empty events array', () => {
      const { result } = renderHook(() => useCombatLog());

      act(() => {
        result.current.addEvents([mockEvents[0]]);
      });

      act(() => {
        result.current.addEvents([]);
      });

      expect(result.current.combatLog).toHaveLength(1);
      expect(result.current.combatLog[0]).toEqual(mockEvents[0]);
    });

    it('should filter out all duplicates when all events already exist', () => {
      const { result } = renderHook(() => useCombatLog());

      // Add initial events
      act(() => {
        result.current.addEvents(mockEvents);
      });

      const initialLength = result.current.combatLog.length;

      // Try to add the same events again
      act(() => {
        result.current.addEvents(mockEvents);
      });

      expect(result.current.combatLog).toHaveLength(initialLength);
    });
  });

  describe('setLog', () => {
    it('should replace entire log with new events', () => {
      const { result } = renderHook(() => useCombatLog());

      // Add some initial events
      act(() => {
        result.current.addEvents([mockEvents[0], mockEvents[1]]);
      });

      // Replace with different events
      act(() => {
        result.current.setLog([mockEvents[2]]);
      });

      expect(result.current.combatLog).toHaveLength(1);
      expect(result.current.combatLog[0]).toEqual(mockEvents[2]);
    });

    it('should handle empty array', () => {
      const { result } = renderHook(() => useCombatLog());

      // Add some events first
      act(() => {
        result.current.addEvents(mockEvents);
      });

      // Set to empty
      act(() => {
        result.current.setLog([]);
      });

      expect(result.current.combatLog).toEqual([]);
    });
  });

  describe('clearLog', () => {
    it('should clear all events from the log', () => {
      const { result } = renderHook(() => useCombatLog());

      // Add some events
      act(() => {
        result.current.addEvents(mockEvents);
      });

      expect(result.current.combatLog).toHaveLength(3);

      // Clear the log
      act(() => {
        result.current.clearLog();
      });

      expect(result.current.combatLog).toEqual([]);
    });

    it('should be safe to call on empty log', () => {
      const { result } = renderHook(() => useCombatLog());

      act(() => {
        result.current.clearLog();
      });

      expect(result.current.combatLog).toEqual([]);
    });
  });

  describe('deduplication edge cases', () => {
    it('should handle events with same id but different content', () => {
      const { result } = renderHook(() => useCombatLog());

      const event1 = { ...mockEvents[0], payload: { original: true } };
      const event1Modified = { ...mockEvents[0], payload: { modified: true } };

      act(() => {
        result.current.addEvents([event1]);
      });

      act(() => {
        result.current.addEvents([event1Modified]);
      });

      // Should still only have one event (the original)
      expect(result.current.combatLog).toHaveLength(1);
      expect(result.current.combatLog[0].payload).toEqual({ original: true });
    });

    it('should preserve order when deduplicating', () => {
      const { result } = renderHook(() => useCombatLog());

      act(() => {
        result.current.addEvents([mockEvents[0], mockEvents[2]]);
      });

      act(() => {
        result.current.addEvents([mockEvents[2], mockEvents[1], mockEvents[0]]);
      });

      expect(result.current.combatLog).toHaveLength(3);
      expect(result.current.combatLog.map(e => e.id)).toEqual(['event1', 'event3', 'event2']);
    });
  });
});
