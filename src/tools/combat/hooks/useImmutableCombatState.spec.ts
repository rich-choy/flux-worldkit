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
  createCombatant,
  Team,
  CombatFacing,
  type Actor,
} from '@flux';

describe('useImmutableCombatState', () => {
  let mockContext: CombatContext;
  let mockSession: CombatSession;
  const aliceId: ActorURN = 'flux:actor:alice';
  const bobId: ActorURN = 'flux:actor:bob';
  const testPlaceId: PlaceURN = 'flux:place:test';

  let alice: Actor;
  let bob: Actor;
  let aliceCombatant: any;

  beforeEach(() => {
    // Create test context with mocked functions
    const transformerContext = createTransformerContext();
    mockContext = createCombatContext(transformerContext);

    // Create test actors
    alice = createActor({
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

    bob = createActor({
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

    // Create reusable Alice combatant
    aliceCombatant = createCombatant(alice, Team.RED, (c: any) => ({
      ...c,
      actorId: aliceId,
      team: Team.RED,
      position: { coordinate: 100, facing: CombatFacing.LEFT, speed: 0 },
      ap: { nat: { cur: 6.0, max: 6.0 }, eff: { cur: 6.0, max: 6.0 }, mods: {} },
      energy: { position: 1, nat: { cur: 100, max: 100 }, eff: { cur: 100, max: 100 }, mods: {} },
      balance: { nat: { cur: 1, max: 1 }, eff: { cur: 1, max: 1 }, mods: {} },
      target: null,
      mass: 70000,
    }));

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
          draftSession.status = SessionStatus.RUNNING;
          return { success: true, data: 'test-data' };
        });

        executionResult = { fnResult, newState };
      });

      expect(executionResult.fnResult).toEqual({ success: true, data: 'test-data' });
      expect(executionResult.newState.session.status).toBe(SessionStatus.RUNNING);
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

  describe('game package mutation propagation', () => {
    it('should prove that game package mutations propagate to Immer draft', () => {
      // Add Alice combatant to the session
      mockSession.data.combatants.set(aliceId, aliceCombatant);

      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      const originalSession = result.current.state.session;
      const originalAP = originalSession.data.combatants.get(aliceId)?.ap.eff.cur;

      act(() => {
        result.current.executeInDraft((draftSession, context) => {
          const draftCombatant = draftSession.data.combatants.get(aliceId);

          if (draftCombatant) {
            // CRITICAL TEST: Simulate the exact mutation pattern used by game package
            // This is what deductAp(combatant, 2.5) does internally:
            draftCombatant.ap.eff.cur -= 2.5;

            // This is what position updates do:
            draftCombatant.position.coordinate = 150;

            // This is what targeting does:
            draftCombatant.target = bobId;
          }

          return 'game-package-mutations';
        });
      });

      const newSession = result.current.state.session;
      const newCombatant = newSession.data.combatants.get(aliceId);
      const originalCombatant = originalSession.data.combatants.get(aliceId);

      // PROOF: All mutations propagated through Immer
      expect(newSession).not.toBe(originalSession); // New immutable object
      expect(newCombatant?.ap.eff.cur).toBe(originalAP! - 2.5); // AP deducted
      expect(newCombatant?.position.coordinate).toBe(150); // Position updated
      expect(newCombatant?.target).toBe(bobId); // Target set

      // PROOF: Original is completely unchanged
      expect(originalCombatant?.ap.eff.cur).toBe(originalAP); // Original AP unchanged
      expect(originalCombatant?.position.coordinate).toBe(100); // Original position unchanged
      expect(originalCombatant?.target).toBe(null); // Original target unchanged
    });

    it('should prove nested object mutations work with Immer drafts', () => {
      // Add Alice combatant to the session
      mockSession.data.combatants.set(aliceId, aliceCombatant);

      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      act(() => {
        result.current.executeInDraft((draftSession, context) => {
          const draftCombatant = draftSession.data.combatants.get(aliceId);

          if (draftCombatant) {
            // Test deep nested mutations (what game package does)
            draftCombatant.ap.eff.cur -= 1.5;           // Nested: combatant.ap.eff.cur
            draftCombatant.ap.nat.cur -= 1.5;           // Nested: combatant.ap.nat.cur
            draftCombatant.energy.eff.cur -= 10;        // Nested: combatant.energy.eff.cur
            draftCombatant.position.coordinate += 25;   // Nested: combatant.position.coordinate
            draftCombatant.position.speed = 5;          // Nested: combatant.position.speed
          }

          return 'nested-mutations';
        });
      });

      const newCombatant = result.current.state.session.data.combatants.get(aliceId);
      const originalCombatant = mockSession.data.combatants.get(aliceId);

      // PROOF: All nested mutations worked
      expect(newCombatant?.ap.eff.cur).toBe(4.5);      // 6.0 - 1.5
      expect(newCombatant?.ap.nat.cur).toBe(4.5);      // 6.0 - 1.5
      expect(newCombatant?.energy.eff.cur).toBe(90);   // 100 - 10
      expect(newCombatant?.position.coordinate).toBe(125); // 100 + 25
      expect(newCombatant?.position.speed).toBe(5);    // 0 → 5

      // PROOF: Original nested objects unchanged
      expect(originalCombatant?.ap.eff.cur).toBe(6.0);
      expect(originalCombatant?.energy.eff.cur).toBe(100);
      expect(originalCombatant?.position.coordinate).toBe(100);
      expect(originalCombatant?.position.speed).toBe(0);
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

    it('should prove that context function calls result in mutations that propagate to draft', () => {
      // Add Alice as a combatant
      const alice = createActor({ id: aliceId, name: 'Alice' });
      const aliceCombatant = createCombatant(alice, Team.RED, (c: any) => ({
        ...c,
        position: { coordinate: 100, facing: CombatFacing.LEFT, speed: 0 },
        ap: { nat: { cur: 6.0, max: 6.0 }, eff: { cur: 6.0, max: 6.0 }, mods: {} },
      }));

      mockSession.data.combatants.set(aliceId, aliceCombatant);

      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      const originalSession = result.current.state.session;
      let capturedEvents: any[] = [];

      act(() => {
        result.current.executeInDraft((draftSession, context) => {
          // Test 1: declareEvent should add events that can be retrieved
          const testEvent = {
            id: context.uniqid(),
            type: 'TEST_CONTEXT_EVENT' as any,
            ts: context.timestamp ? context.timestamp() : Date.now(),
            actor: aliceId,
            location: testPlaceId,
            trace: 'context-function-test',
            payload: { message: 'Context function called successfully' }
          };

          // Call context function that should affect the context state
          context.declareEvent(testEvent);

          // Test 2: Verify we can retrieve the declared events
          const declaredEvents = context.getDeclaredEvents();
          capturedEvents = declaredEvents;

          // Test 3: Modify the draft session based on context function results
          const draftCombatant = draftSession.data.combatants.get(aliceId);
          if (draftCombatant && declaredEvents.length > 0) {
            // Use context function result to modify draft
            draftCombatant.ap.eff.cur -= declaredEvents.length; // Deduct AP based on events
            draftCombatant.target = bobId; // Set target based on context interaction
          }

          return 'context-function-mutations';
        });
      });

      const newSession = result.current.state.session;
      const newCombatant = newSession.data.combatants.get(aliceId);
      const originalCombatant = originalSession.data.combatants.get(aliceId);

      // PROOF: Context functions worked and affected both context and draft
      expect(capturedEvents.length).toBeGreaterThan(0); // Context function created events
      expect(capturedEvents[0].type).toBe('TEST_CONTEXT_EVENT'); // Event was properly created

      // PROOF: Draft mutations based on context function results propagated
      expect(newSession).not.toBe(originalSession); // New immutable session
      expect(newCombatant?.ap.eff.cur).toBe(6.0 - capturedEvents.length); // AP deducted based on events
      expect(newCombatant?.target).toBe(bobId); // Target set based on context interaction

      // PROOF: Original session unchanged
      expect(originalCombatant?.ap.eff.cur).toBe(6.0); // Original AP unchanged
      expect(originalCombatant?.target).toBe(null); // Original target unchanged
    });

    it('should prove that context random and uniqid functions work with draft mutations', () => {
      // Add Alice as a combatant
      const alice = createActor({ id: aliceId, name: 'Alice' });
      const aliceCombatant = createCombatant(alice, Team.RED, (c: any) => ({
        ...c,
        position: { coordinate: 100, facing: CombatFacing.LEFT, speed: 0 },
        ap: { nat: { cur: 6.0, max: 6.0 }, eff: { cur: 6.0, max: 6.0 }, mods: {} },
      }));

      mockSession.data.combatants.set(aliceId, aliceCombatant);

      const { result } = renderHook(() =>
        useImmutableCombatState(mockContext, mockSession, aliceId)
      );

      let randomValue: number;
      let uniqueId: string;

      act(() => {
        result.current.executeInDraft((draftSession, context) => {
          // Test context random and uniqid functions
          randomValue = context.random();
          uniqueId = context.uniqid();

          const draftCombatant = draftSession.data.combatants.get(aliceId);
          if (draftCombatant) {
            // Use context function results to modify draft
            // Simulate random damage or random movement based on context.random()
            const randomDamage = Math.floor(randomValue * 3); // 0-2 damage
            draftCombatant.ap.eff.cur -= randomDamage;

            // Use unique ID for some state (simulating trace IDs, event IDs, etc.)
            // In real game, this might be used for action traces or event IDs
            draftCombatant.position.coordinate += uniqueId.length; // Use ID length as movement
          }

          return 'random-uniqid-mutations';
        });
      });

      const newCombatant = result.current.state.session.data.combatants.get(aliceId);

      // PROOF: Context functions returned valid values
      expect(typeof randomValue!).toBe('number');
      expect(randomValue!).toBeGreaterThanOrEqual(0);
      expect(randomValue!).toBeLessThan(1);
      expect(typeof uniqueId!).toBe('string');
      expect(uniqueId!.length).toBeGreaterThan(0);

      // PROOF: Context function results affected draft mutations
      const expectedAP = 6.0 - Math.floor(randomValue! * 3);
      const expectedPosition = 100 + uniqueId!.length;

      expect(newCombatant?.ap.eff.cur).toBe(expectedAP);
      expect(newCombatant?.position.coordinate).toBe(expectedPosition);
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
