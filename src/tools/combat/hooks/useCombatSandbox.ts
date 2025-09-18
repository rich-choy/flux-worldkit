import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalStorage } from '~/lib/storage';
import {
  type TransformerContext,
  createActor,
  createTransformerContext,
  type CombatSession,
  type ActorURN,
  type PlaceURN,
  Team,
  createCombatSessionApi,
  ActorStat,
  type SessionURN,
  type RollResult,
  SpecialDuration,
  type WeaponSchema,
  HUMAN_ANATOMY,
  setMaxHp,
  calculateMaxHpFromRes,
  getHealthPercentage,
  setHealthPercentage,
  MIN_SKILL_RANK,
  MAX_SKILL_RANK,
} from '@flux';

export type CombatPhase = 'setup' | 'active' | 'ended';

export type ActorShellStatsInput = {
  pow?: number;
  fin?: number;
  res?: number;
  int?: number;
  per?: number;
  mem?: number;
};

export type CombatScenarioActorData = {
  stats: ActorShellStatsInput;
  aiControlled: boolean;
  weapon: string; // weapon schema URN
  skills: {
    'flux:skill:evasion'?: number;
    'flux:skill:weapon:martial'?: number;
  };
};

export type CombatScenarioData = {
  actors: Record<ActorURN, CombatScenarioActorData>;
};


export type CombatSandboxState = {
  // Phase management
  phase: CombatPhase;
  isInitialized: boolean;

  // Core entities
  initialContext: TransformerContext | null;
  initialSession: CombatSession | null;
  sessionId: SessionURN | null;
  actors: Record<string, any>;
  currentActorId: ActorURN | null;

  // Event tracking for re-renders
  eventCount: number;

  // AI control
  aiControlled: Record<ActorURN, boolean>;
  aiThinking: ActorURN | null;
};

const TEST_WEAPON_ENTITY_URN = 'flux:item:weapon:test';

export type CombatSandboxActions = {
  // Phase transitions
  startCombat: () => void;

  // Actor management
  updateActorStat: (actorId: ActorURN, stat: ActorStat, value: number) => void;

  // AI control
  handleAiToggle: (actorId: ActorURN, enabled: boolean) => void;
  setAiThinking: (actorId: ActorURN | null) => void;

  // Turn management
  handleTurnAdvance: (newActorId: ActorURN) => void;
};

const createActorWithShellStats = (
  id: ActorURN,
  name: string,
  weapon: WeaponSchema,
  stats: ActorShellStatsInput,
  location: PlaceURN,

) => {
  const { pow = 10, fin = 10, res = 10, int = 10, per = 10, mem = 10 } = stats;

  const actor = createActor({
    id,
    name,
    location, // Set the actor's location for combat validation
    stats: {
      [ActorStat.POW]: { nat: pow, eff: pow, mods: {} },
      [ActorStat.FIN]: { nat: fin, eff: fin, mods: {} },
      [ActorStat.RES]: { nat: res, eff: res, mods: {} },
      [ActorStat.INT]: { nat: int, eff: int, mods: {} },
      [ActorStat.PER]: { nat: per, eff: per, mods: {} },
      [ActorStat.MEM]: { nat: mem, eff: mem, mods: {} },
    },
    equipment: {
      [HUMAN_ANATOMY.RIGHT_HAND]: {
        [TEST_WEAPON_ENTITY_URN]: 1,
      },
    },
    inventory: {
      mass: 1_000,
      ts: Date.now(),
      items: {
        [TEST_WEAPON_ENTITY_URN]: {
          id: TEST_WEAPON_ENTITY_URN,
          schema: weapon.urn
        },
      },
    },
  });

  // Initialize HP based on RES stat
  const maxHp = calculateMaxHpFromRes(actor);
  setMaxHp(actor, maxHp);

  return actor;
};

export type CombatSandboxHook = {
  state: CombatSandboxState;
  actions: CombatSandboxActions;
};

/**
 * Creates a combat sandbox scenario management API
 * Note: Despite the "use" prefix, this is actually a React hook that manages
 * combat scenario state and provides actions for scenario manipulation
 */
export function useCombatSandbox(
  aliceId: ActorURN,
  bobId: ActorURN,
  testPlaceId: PlaceURN,
  testWeapon: WeaponSchema
): CombatSandboxHook {
  // Default scenario data
  const defaultScenarioData: CombatScenarioData = {
    actors: {
      [aliceId]: {
        stats: { pow: 10, fin: 10, res: 10, per: 10 },
        aiControlled: false,
        weapon: testWeapon.urn,
        skills: {
          'flux:skill:evasion': 0,
          'flux:skill:weapon:martial': 0
        }
      },
      [bobId]: {
        stats: { pow: 10, fin: 10, res: 10 },
        aiControlled: true, // Bob is AI-controlled by default
        weapon: testWeapon.urn,
        skills: {
          'flux:skill:evasion': 0,
          'flux:skill:weapon:martial': 0
        }
      }
    }
  };

  // Persistent scenario data
  const [scenarioData, setScenarioData] = useLocalStorage<CombatScenarioData>(
    'combat-sandbox-scenario',
    defaultScenarioData
  );

  // State management
  const [phase, setPhase] = useState<CombatPhase>('setup');
  const [initialContext, setInitialContext] = useState<TransformerContext | null>(null);
  const [initialSession, setInitialSession] = useState<CombatSession | null>(null);
  const [sessionId, setSessionId] = useState<SessionURN | null>(null);
  const [actors, setActors] = useState<Record<string, any>>({});
  const [currentActorId, setCurrentActorId] = useState<ActorURN | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [eventCount, setEventCount] = useState(0);

  // AI control state - now derived from persisted scenario data
  const [aiControlled, setAiControlled] = useState<Record<ActorURN, boolean>>(() => {
    const aiControlMap: Record<ActorURN, boolean> = {};
    const actorEntries = Object.entries(scenarioData.actors) as [ActorURN, CombatScenarioActorData][];
    for (const [actorId, actorData] of actorEntries) {
      aiControlMap[actorId] = actorData.aiControlled;
    }
    return aiControlMap;
  });
  const [aiThinking, setAiThinking] = useState<ActorURN | null>(null);

  // Initialize actors and context during setup phase
  useEffect(() => {
    try {
      const context = createTransformerContext();
      // @ts-expect-error - Mock schema manager for testing
      context.schemaManager.getSchema = (urn: string) => {
        if (urn === testWeapon.urn) {
          return testWeapon;
        }
        throw new Error(`Schema not found for URN: ${urn}`);
      };

      // Create test actors using persisted stats
      const alice = createActorWithShellStats(
        aliceId,
        'Alice',
        testWeapon,
        scenarioData.actors[aliceId]?.stats || { pow: 10, fin: 10, res: 10, per: 10 },
        testPlaceId
      );
      const bob = createActorWithShellStats(
        bobId,
        'Bob',
        testWeapon,
        scenarioData.actors[bobId]?.stats || { pow: 10, fin: 10, res: 10 },
        testPlaceId
      );

      // Ensure actors start with full HP after stat restoration
      setHealthPercentage(alice, 1.0);
      setHealthPercentage(bob, 1.0);

      // Add actors to context
      context.world.actors[aliceId] = alice;
      context.world.actors[bobId] = bob;

      setInitialContext(context);
      setActors({ [aliceId]: alice, [bobId]: bob });
      setIsInitialized(true);
    } catch (error) {
      console.error('❌ Combat initialization failed:', error);
    }
  }, [aliceId, bobId, testWeapon]);

  // Function to start combat - creates session and transitions to active phase
  const startCombat = useCallback(() => {
    if (!initialContext || phase !== 'setup') return;

    try {
      // Create deterministic initiative to ensure Alice always goes first
      const aliceInitiative: RollResult = {
        dice: '1d20' as const,
        values: [20],
        mods: {
          perception: {
            type: 'flux:modifier:initiative:per',
            origin: { type: 'flux:stat:per', actor: 'self' },
            value: 0,
            duration: SpecialDuration.PERMANENT
          }
        },
        natural: 20,
        result: 20
      };
      const bobInitiative: RollResult = {
        dice: '1d20' as const,
        values: [1],
        mods: {
          perception: {
            type: 'flux:modifier:initiative:per',
            origin: { type: 'flux:stat:per', actor: 'self' },
            value: 0,
            duration: SpecialDuration.PERMANENT
          }
        },
        natural: 1,
        result: 1
      };

      const deterministicInitiative = new Map<ActorURN, RollResult>([
        [aliceId, aliceInitiative],
        [bobId, bobInitiative]
      ]);

      // Create session with deterministic initiative
      const combatSessionApi = createCombatSessionApi(
        initialContext,
        testPlaceId,
        undefined, // sessionId
        undefined, // battlefield
        deterministicInitiative,
      );

      const { session: combatSession, addCombatant, startCombat: startCombatSession } = combatSessionApi;

      // Capture the session ID that was created
      if (combatSession && combatSession.id) {
        setSessionId(combatSession.id);
      } else {
        console.error('Combat session is null or missing ID:', combatSession);
        return;
      }

      addCombatant(aliceId, Team.ALPHA);
      addCombatant(bobId, Team.BRAVO);

      // Set up targeting
      combatSession.data.combatants.get(aliceId)!.target = bobId;
      combatSession.data.combatants.get(bobId)!.target = aliceId;

      // Start combat - this will generate WorldEvents
      startCombatSession();

      // Track events after combat start for re-render triggering
      const eventsAfter = initialContext.getDeclaredEvents().length;

      // Update state - session object is mutated, not replaced
      setInitialSession(combatSession);
      setCurrentActorId(aliceId); // Alice always goes first
      setPhase('active');
      setEventCount(eventsAfter);

    } catch (error) {
      console.error('❌ Combat start failed:', error);
    }
  }, [initialContext, phase, aliceId, bobId, testPlaceId]);

  // Function to update actor stats during setup phase
  const updateActorStat = useCallback((actorId: ActorURN, stat: ActorStat, value: number) => {
    if (phase !== 'setup' || !initialContext) return;

    // Update the actor in the context directly
    const actor = initialContext.world.actors[actorId];
    if (actor && actor.stats[stat]) {
      actor.stats[stat].nat = value;
      actor.stats[stat].eff = value;

      // If RES changed, recalculate max HP and maintain health percentage
      if (stat === ActorStat.RES) {
        // Get current health percentage before changing max HP
        const currentHealthPercentage = getHealthPercentage(actor);

        // Calculate and set new max HP based on new RES
        const newMaxHp = calculateMaxHpFromRes(actor);
        setMaxHp(actor, newMaxHp);

        // Restore the same health percentage with the new max HP
        setHealthPercentage(actor, currentHealthPercentage);
      }

      // Update local state to trigger re-render
      setActors(prev => ({
        ...prev,
        [actorId]: { ...actor }
      }));

      // Persist the stat change to localStorage
      setScenarioData((prev: CombatScenarioData) => ({
        ...prev,
        actors: {
          ...prev.actors,
          [actorId]: {
            ...prev.actors[actorId],
            stats: {
              ...prev.actors[actorId]?.stats,
              [stat.toLowerCase()]: value
            }
          }
        }
      }));
    }
  }, [phase, initialContext, setScenarioData]);

  const handleTurnAdvance = useCallback((newActorId: ActorURN) => {
    console.log('🎮 handleTurnAdvance called:', { from: currentActorId, to: newActorId });
    setCurrentActorId(newActorId);
  }, [currentActorId]);

  // Handle AI toggle for combatants
  const handleAiToggle = useCallback((actorId: ActorURN, enabled: boolean) => {
    setAiControlled(prev => ({
      ...prev,
      [actorId]: enabled
    }));

    // Persist the AI control change to localStorage
    setScenarioData((prev: CombatScenarioData) => ({
      ...prev,
      actors: {
        ...prev.actors,
        [actorId]: {
          ...prev.actors[actorId],
          aiControlled: enabled
        }
      }
    }));
  }, [setScenarioData]);

  // Combine state and actions
  const state: CombatSandboxState = useMemo(() => ({
    phase,
    isInitialized,
    initialContext,
    initialSession,
    sessionId,
    actors,
    currentActorId,
    eventCount,
    aiControlled,
    aiThinking,
  }), [phase, isInitialized, initialContext, initialSession, sessionId, actors, currentActorId, eventCount, aiControlled, aiThinking]);

  const actions: CombatSandboxActions = useMemo(() => ({
    startCombat,
    updateActorStat,
    handleAiToggle,
    setAiThinking,
    handleTurnAdvance,
  }), [startCombat, updateActorStat, handleAiToggle, handleTurnAdvance]);

  return { state, actions };
}

/**
 * Alias for useCombatSandbox to disambiguate from React hooks
 * Creates and manages a combat sandbox scenario with actors, phases, and AI control
 */
export const createCombatSandboxScenario = useCombatSandbox;
