import { useState, useCallback } from 'react';
import { createDraft, finishDraft, type WritableDraft } from 'immer';
import {
  useIntentExecution,
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
  context: CombatContext, // Context is stable and contains functions - don't draft it
  initialSession: CombatSession,
  currentActorId: ActorURN | null
): UseImmutableCombatStateResult {
  const [state, setState] = useState<ImmutableCombatState>({ session: initialSession });

  const executeInDraft = useCallback(<T>(
    fn: (draftSession: WritableDraft<CombatSession>, context: CombatContext) => T
  ): { result: T; newState: ImmutableCombatState } => {
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
    if (!currentActorId) return [];

    const { result: events } = executeInDraft((draftSession, ctx) => {
      // Create intent executor with stable context and draft session
      const intentExecutor = useIntentExecution(
        ctx,
        draftSession,
        currentActorId
      );

      // Execute command - mutations happen on draft session, tracked by Immer
      return intentExecutor.executeIntent(command);
    });

    return events;
  }, [currentActorId, executeInDraft]);

  return { state, executeInDraft, executeCommand };
}
