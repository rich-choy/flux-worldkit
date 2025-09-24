import { useState, useCallback, useEffect } from 'react';
import {
  createIntentExecutionApi,
  createCombatSessionApi,
  type ActorURN,
  type TransformerContext,
  type CombatSession,
  type WorldEvent,
  type PlaceURN,
  type SessionURN,
} from '@flux';

interface CombatState {
  session: CombatSession;
  eventCount: number; // Track event count to trigger re-renders
}

interface UseCombatStateResult {
  state: CombatState;
  executeCommand: (command: string) => WorldEvent[];
}

/**
 * Hook that manages combat session state and triggers re-renders based on event count.
 * Uses direct mutations on the session (as the combat system was designed) and tracks
 * the number of declared events to determine when to re-render.
 */
export function useCombatState(
  context: TransformerContext | null,
  initialSession: CombatSession | null,
  currentActorId: ActorURN | null,
  placeId: PlaceURN = 'flux:place:test',
  sessionId?: SessionURN | null,
): UseCombatStateResult {
  const [state, setState] = useState<CombatState>({
    session: initialSession as any, // Will be updated when initialSession is provided
    eventCount: 0
  });

  // Update internal state when initialSession changes (from null to actual session)
  // Only update if we don't have a session yet (initialization case)
  useEffect(() => {
    if (initialSession && !state.session) {
      setState({ session: initialSession, eventCount: 0 });
    }
  }, [initialSession, state.session]);

  const executeCommand = useCallback((command: string): WorldEvent[] => {
    // Return early if not initialized
    if (!currentActorId || !context || !state.session) return [];

    try {
      // Capture events by stubbing declareEvent
      const capturedEvents: WorldEvent[] = [];
      const eventsBefore = context.getDeclaredEvents().length;

      // Use the session's built-in combatant hook with turn advancement
      const actualSessionId = sessionId || state.session?.id;
      const sessionApi = createCombatSessionApi(context, placeId, actualSessionId);
      const combatantApi = sessionApi.getCombatantApi(currentActorId);

      // Stub declareEvent to capture events
      const originalDeclareEvent = context.declareEvent;
      context.declareEvent = (event: WorldEvent) => {
        capturedEvents.push(event);
        return originalDeclareEvent(event);
      };

      try {
        // Create intent executor - session will be mutated directly
        const intentExecutor = createIntentExecutionApi(
          context,
          state.session,
          combatantApi
        );

        // Execute command - mutations happen directly on session
        intentExecutor.executeIntent(command);

        // Check if turn should advance after command execution
        const turnAdvancementEvents = intentExecutor.checkAndAdvanceTurn();
        capturedEvents.push(...turnAdvancementEvents);
      } finally {
        // Restore original declareEvent
        context.declareEvent = originalDeclareEvent;
      }

      // Trigger re-render by updating event count
      const eventsAfter = context.getDeclaredEvents().length;
      if (eventsAfter > eventsBefore || capturedEvents.length > 0) {
        setState(prev => ({
          session: prev.session, // Same session object, but mutated
          eventCount: eventsAfter
        }));
      }

      return capturedEvents;
    } catch (error) {
      console.error('executeCommand failed:', error);
      return [];
    }
  }, [currentActorId, context, state.session, sessionId]);

  return { state, executeCommand };
}
