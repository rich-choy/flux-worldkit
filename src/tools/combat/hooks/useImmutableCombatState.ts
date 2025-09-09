import { useState, useCallback, useEffect } from 'react';
import { createDraft, finishDraft, type WritableDraft } from 'immer';
import {
  useIntentExecution as createIntentExecutor,
  useCombatSession,
  type ActorURN,
  type CombatContext,
  type CombatSession,
  type WorldEvent,
} from '@flux';

interface ImmutableCombatState {
  session: CombatSession;
}

interface UseImmutableCombatStateResult {
  state: ImmutableCombatState;
  executeInDraft: <T>(fn: (draftSession: WritableDraft<CombatSession>, context: CombatContext) => T) => { result: T; newState: ImmutableCombatState };
  executeCommand: (command: string) => WorldEvent[];
}

/**
 * Hook that wraps CombatSession with Immer drafts to provide immutable state updates
 * while allowing the game package to use mutations internally.
 *
 * CombatContext is kept separate since it contains function properties (declareError,
 * declareEvent, executeRoll, etc.) that don't work well with Immer's drafting mechanism.
 *
 * This creates an "Immer boundary" where consumers get immutable guarantees
 * while the underlying game logic can continue using mutations for performance.
 */
export function useImmutableCombatState(
  context: CombatContext | null, // Context is stable and contains functions - don't draft it
  initialSession: CombatSession | null,
  currentActorId: ActorURN | null
): UseImmutableCombatStateResult {
  const [state, setState] = useState<ImmutableCombatState>({
    session: initialSession || null as any
  });

  // Update internal state when initialSession changes (from null to actual session)
  // Only update if we don't have a session yet (initialization case)
  useEffect(() => {
    if (initialSession && !state.session) {
      setState({ session: initialSession });
    }
  }, [initialSession, state.session]);

  const executeInDraft = useCallback(<T>(
    fn: (draftSession: WritableDraft<CombatSession>, context: CombatContext) => T
  ): { result: T; newState: ImmutableCombatState } => {
    // Return early if not initialized
    if (!context || !state.session) {
      throw new Error('Combat state not initialized - context or session is null');
    }

    // Only draft the session - context contains functions and should remain stable
    const draftSession = createDraft(state.session);

    // Execute function with draft session and stable context
    const result = fn(draftSession, context);

    // Finalize draft to get new immutable session
    const newSession = finishDraft(draftSession);
    const newState = { session: newSession };

    // Update React state with immutable session
    setState(newState);

    return { result, newState };
  }, [state, context]);

  const executeCommand = useCallback((command: string): WorldEvent[] => {
    // Return early if not initialized
    if (!currentActorId || !context || !state.session) return [];

    try {
      const { result: events } = executeInDraft((draftSession, ctx) => {
        // Capture events declared during this command execution
        const commandEvents: WorldEvent[] = [];

        // Create a context wrapper that captures events for this command
        const contextWithEventCapture = {
          ...ctx,
          declareEvent: (event: WorldEvent) => {
            // Call the original declareEvent to maintain normal behavior
            ctx.declareEvent(event);
            // Also capture the event for our return value
            commandEvents.push(event);
          }
        };

        // Use the session's built-in combatant hook with turn advancement
        const sessionHook = useCombatSession(contextWithEventCapture, contextWithEventCapture.uniqid(), draftSession.data.location, draftSession.id);
        const combatantHook = sessionHook.useCombatant(currentActorId);

        // Create intent executor with our event-capturing context
        const intentExecutor = createIntentExecutor(
          contextWithEventCapture,
          draftSession,
          combatantHook
        );

        // Execute command - mutations happen on draft session, tracked by Immer
        // The intent executor will call declareEvent, which we capture above
        intentExecutor.executeIntent(command);

        // Return only the events declared during this command
        return commandEvents;
      });

      return events;
    } catch (error) {
      console.warn('executeCommand failed:', error);
      return [];
    }
  }, [currentActorId, context, state.session, executeInDraft]);

  return { state, executeInDraft, executeCommand };
}
