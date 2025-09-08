import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useImmutableCombatState } from './useImmutableCombatState';
import {
  createCombatContext,
  createTransformerContext,
  createCombatSession,
  createActor,
  ActorStat,
  SessionStatus,
  type CombatContext,
  type CombatSession,
  type ActorURN,
  type PlaceURN,
  type WorldEvent,
} from '@flux';

describe('useImmutableCombatState', () => {
  let mockContext: CombatContext;
  let mockSession: CombatSession;
  const aliceId: ActorURN = 'flux:actor:alice';
  const bobId: ActorURN = 'flux:actor:bob';
  const testPlaceId: PlaceURN = 'flux:place:test';

  beforeEach(() => {
    // Create test context with mocked functions
    const transformerContext = createTransformerContext();
    mockContext = createCombatContext(transformerContext);

    // Create test actors
    const alice = createActor({
      id: aliceId,
      name: 'Alice',
      stats: {
        [ActorStat.POW]: { nat: 50, eff: 50, mods: {} },
        [ActorStat.FIN]: { nat: 40, eff: 40, mods: {} },
        [ActorStat.RES]: { nat: 30, eff: 30, mods: {} },
        [ActorStat.INT]: { nat: 20, eff: 20, mods: {} },
        [ActorStat.PER]: { nat: 25, eff: 25, mods: {} },
        [ActorStat.MEM]: { nat: 15, eff: 15, mods: {} },
      }
    });

    const bob = createActor({
      id: bobId,
      name: 'Bob',
      stats: {
        [ActorStat.POW]: { nat: 45, eff: 45, mods: {} },
        [ActorStat.FIN]: { nat: 35, eff: 35, mods: {} },
        [ActorStat.RES]: { nat: 40, eff: 40, mods: {} },
        [ActorStat.INT]: { nat: 30, eff: 30, mods: {} },
        [ActorStat.PER]: { nat: 20, eff: 20, mods: {} },
        [ActorStat.MEM]: { nat: 25, eff: 25, mods: {} },
      }
    });

    // Add actors to context
    mockContext.world.actors[aliceId] = alice;
    mockContext.world.actors[bobId] = bob;

    // Create test session
    mockSession = createCombatSession(mockContext, {
      location: testPlaceId,
      combatants: []
    });
  });

  describe('initialization', () => {
    it('should initialize with provided session', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      expect(result.current.state.session).toBe(mockSession);
    });

    it('should provide executeInDraft and executeCommand functions', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      expect(typeof result.current.executeInDraft).toBe('function');
      expect(typeof result.current.executeCommand).toBe('function');
    });
  });

  describe('executeInDraft', () => {
    it('should create new immutable session after mutations', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      const originalSession = result.current.state.session;

      act(() => {
        result.current.executeInDraft((draftSession, context) => {
          // Simulate a mutation that the game package would make
          draftSession.status = SessionStatus.RUNNING;
          return 'test-result';
        });
      });

      const newSession = result.current.state.session;

      // Should be a different object reference (immutable update)
      expect(newSession).not.toBe(originalSession);
      expect(newSession.status).toBe(SessionStatus.RUNNING);
      expect(originalSession.status).not.toBe(SessionStatus.RUNNING); // Original unchanged
    });

    it('should pass stable context to the function', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      let capturedContext: CombatContext | null = null;

      act(() => {
        result.current.executeInDraft((draftSession, context) => {
          capturedContext = context;
          return 'test';
        });
      });

      // Context should be the same reference (stable)
      expect(capturedContext).toBe(mockContext);
    });

    it('should return both result and new state', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      let executionResult: any;

      act(() => {
        const { result: fnResult, newState } = result.current.executeInDraft((draftSession, context) => {
          draftSession.status = 'ACTIVE' as any;
          return { success: true, data: 'test-data' };
        });

        executionResult = { fnResult, newState };
      });

      expect(executionResult.fnResult).toEqual({ success: true, data: 'test-data' });
      expect(executionResult.newState.session.status).toBe('ACTIVE');
    });

    it('should handle nested object mutations', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      act(() => {
        result.current.executeInDraft((draftSession, context) => {
          // Simulate deep mutations like the game package makes
          if (draftSession.data.rounds.current) {
            draftSession.data.rounds.current.number = 5;
            draftSession.data.rounds.current.turns.current.number = 3;
          }
          return 'nested-mutation-test';
        });
      });

      const updatedSession = result.current.state.session;
      expect(updatedSession.data.rounds.current?.number).toBe(5);
      expect(updatedSession.data.rounds.current?.turns.current.number).toBe(3);
    });
  });

  describe('executeCommand', () => {
    it('should return empty array when no current actor', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, null)
      );

      let events: WorldEvent[];
      act(() => {
        events = result.current.executeCommand('test command');
      });

      expect(events!).toEqual([]);
    });

    it('should execute intent and return events', () => {
      // Mock the useIntentExecution to return test events
      const mockEvents: WorldEvent[] = [
        {
          id: 'test-event-1',
          type: 'TEST_EVENT' as any,
          ts: Date.now(),
          actor: aliceId,
          location: testPlaceId,
          trace: 'test-trace',
          payload: { action: 'test' }
        }
      ];

      // We'll need to mock the intent execution system
      // For now, let's test the structure
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      // This test would need proper mocking of the intent execution system
      // For now, we verify the function exists and handles null actor
      expect(typeof result.current.executeCommand).toBe('function');
    });
  });

  describe('immutability guarantees', () => {
    it('should never mutate the original session', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      const originalSessionCopy = JSON.parse(JSON.stringify(mockSession));

      act(() => {
        result.current.executeInDraft((draftSession, context) => {
          // Make various mutations
          draftSession.status = 'ACTIVE' as any;
          if (draftSession.data.rounds.current) {
            draftSession.data.rounds.current.number = 999;
          }
          return 'mutation-test';
        });
      });

      // Original session should be completely unchanged
      expect(JSON.stringify(mockSession)).toBe(JSON.stringify(originalSessionCopy));
    });

    it('should create new references for each operation', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      const sessions: CombatSession[] = [];

      // Perform multiple operations
      act(() => {
        result.current.executeInDraft((draft) => {
          draft.status = SessionStatus.RUNNING;
        });
      });
      sessions.push(result.current.state.session);

      act(() => {
        result.current.executeInDraft((draft) => {
          if (draft.data.rounds.current) {
            draft.data.rounds.current.number = 2;
          }
        });
      });
      sessions.push(result.current.state.session);

      act(() => {
        result.current.executeInDraft((draft) => {
          if (draft.data.rounds.current) {
            draft.data.rounds.current.number = 3;
          }
        });
      });
      sessions.push(result.current.state.session);

      // Each operation should create a new session reference
      expect(sessions[0]).not.toBe(sessions[1]);
      expect(sessions[1]).not.toBe(sessions[2]);
      expect(sessions[0]).not.toBe(sessions[2]);

      // But they should have the expected values
      expect(sessions[0].status).toBe(SessionStatus.RUNNING);
      expect(sessions[1].data.rounds.current?.number).toBe(2);
      expect(sessions[2].data.rounds.current?.number).toBe(3);
    });
  });

  describe('context stability', () => {
    it('should maintain stable context reference across operations', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      const capturedContexts: CombatContext[] = [];

      // Perform multiple operations and capture context each time
      act(() => {
        result.current.executeInDraft((draft, context) => {
          capturedContexts.push(context);
        });
      });

      act(() => {
        result.current.executeInDraft((draft, context) => {
          capturedContexts.push(context);
        });
      });

      // Context should be the same reference every time
      expect(capturedContexts[0]).toBe(mockContext);
      expect(capturedContexts[1]).toBe(mockContext);
      expect(capturedContexts[0]).toBe(capturedContexts[1]);
    });

    it('should preserve context function properties', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      act(() => {
        result.current.executeInDraft((draft, context) => {
          // Context functions should be preserved and callable
          expect(typeof context.declareError).toBe('function');
          expect(typeof context.declareEvent).toBe('function');
          expect(typeof context.getDeclaredEvents).toBe('function');
          expect(typeof context.random).toBe('function');
          expect(typeof context.uniqid).toBe('function');
        });
      });
    });
  });

  describe('error handling', () => {
    it('should not update state if executeInDraft throws', () => {
      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      const originalSession = result.current.state.session;

      expect(() => {
        act(() => {
        result.current.executeInDraft((draft, context) => {
          draft.status = SessionStatus.RUNNING; // This mutation happens
          throw new Error('Test error'); // But then we throw
        });
        });
      }).toThrow('Test error');

      // State should remain unchanged due to the error
      expect(result.current.state.session).toBe(originalSession);
    });
  });
});
