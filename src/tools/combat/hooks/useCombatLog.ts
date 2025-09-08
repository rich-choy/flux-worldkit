import { useState, useCallback } from 'react';
import type { WorldEvent } from '@flux';

export interface UseCombatLogResult {
  /** Current combat log entries */
  combatLog: WorldEvent[];
  /** Add new events to the log (automatically deduplicates) */
  addEvents: (events: WorldEvent[]) => void;
  /** Set the entire log (replaces all entries) */
  setLog: (events: WorldEvent[]) => void;
  /** Clear all log entries */
  clearLog: () => void;
}

/**
 * Hook for managing combat event logs with automatic deduplication.
 *
 * Events are deduplicated by their `id` property to prevent duplicate
 * entries from appearing in the UI.
 */
export function useCombatLog(): UseCombatLogResult {
  const [combatLog, setCombatLog] = useState<WorldEvent[]>([]);

  const addEvents = useCallback((events: WorldEvent[]) => {
    if (events.length === 0) return;

    setCombatLog(prev => {
      // Use Set to deduplicate by ID, then convert back to array
      const existingIds = new Set(prev.map(e => e.id));
      const newEvents = events.filter(e => !existingIds.has(e.id));

      return [...prev, ...newEvents];
    });
  }, []);

  const setLog = useCallback((events: WorldEvent[]) => {
    setCombatLog(events);
  }, []);

  const clearLog = useCallback(() => {
    setCombatLog([]);
  }, []);

  return {
    combatLog,
    addEvents,
    setLog,
    clearLog,
  };
}
