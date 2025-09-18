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
  type WeaponSchemaURN,
  type SkillURN,
  HUMAN_ANATOMY,
  setMaxHp,
  calculateMaxHpFromRes,
  getHealthPercentage,
  setHealthPercentage,
  MIN_SKILL_RANK,
  MAX_SKILL_RANK,
  SessionStatus,
  createSwordSchema,
} from '@flux';
import type { WeaponMap } from '../types';

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
  weapon: WeaponSchemaURN;
  skills: {
    'flux:skill:evasion'?: number;
    'flux:skill:weapon:martial'?: number;
  };
};

export type CombatScenarioData = {
  actors: Record<ActorURN, CombatScenarioActorData>;
};


export type CombatSandboxState = {
  // Initialization
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

  // Weapon and skill data
  availableWeapons: WeaponMap;

  // Helper functions to get current actor data
  getActorWeapon: (actorId: ActorURN) => WeaponSchemaURN;
  getActorSkills: (actorId: ActorURN) => Record<SkillURN, number>;
};

const TEST_WEAPON_ENTITY_URN = 'flux:item:weapon:test';

export type CombatSandboxActions = {
  // Phase transitions
  startCombat: () => void;

  // Actor management
  updateActorStat: (actorId: ActorURN, stat: ActorStat, value: number) => void;
  updateActorWeapon: (actorId: ActorURN, weaponUrn: WeaponSchemaURN) => void;
  updateActorSkill: (actorId: ActorURN, skillUrn: SkillURN, rank: number) => void;

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

const DEFAULT_TEST_WEAPON = createSwordSchema({ urn: 'flux:schema:weapon:test', name: 'Test Weapon' });

/**
 * Creates a combat sandbox scenario management API
 * Note: Despite the "use" prefix, this is actually a React hook that manages
 * combat scenario state and provides actions for scenario manipulation
 */
export function useCombatSandbox(
  aliceId: ActorURN,
  bobId: ActorURN,
  testPlaceId: PlaceURN = 'flux:place:test-battlefield',
  defaultWeapon: WeaponSchema = DEFAULT_TEST_WEAPON,
): CombatSandboxHook {
  // Default scenario data
  const defaultScenarioData: CombatScenarioData = {
    actors: {
      [aliceId]: {
        stats: { pow: 10, fin: 10, res: 10, per: 10 },
        aiControlled: false,
        weapon: defaultWeapon.urn as WeaponSchemaURN,
        skills: {
          'flux:skill:evasion': 0,
          'flux:skill:weapon:martial': 0
        }
      },
      [bobId]: {
        stats: { pow: 10, fin: 10, res: 10 },
        aiControlled: true, // Bob is AI-controlled by default
        weapon: defaultWeapon.urn as WeaponSchemaURN,
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

  // Available weapons state
  const [availableWeapons, setAvailableWeapons] = useState<WeaponMap>(new Map());

  // Helper to determine if we're in setup phase (no active session)
  const isInSetupPhase = !initialSession || initialSession.status === SessionStatus.PENDING;

  // Initialize actors and context during setup phase
  useEffect(() => {
    try {
      const context = createTransformerContext();


      const weaponMap = context.schemaManager.getSchemasOfType<WeaponSchemaURN, WeaponSchema>('weapon');
      // Set up available weapons - for now just the test weapon, but this will expand
      setAvailableWeapons(weaponMap);

      // @ts-expect-error - Mock schema manager for testing
      context.schemaManager.getSchema = (urn: string) => {
        const weapon = weaponMap.get(urn as WeaponSchemaURN);
        if (weapon) {
          return weapon;
        }
        throw new Error(`Schema not found for URN: ${urn}`);
      };

      // Create test actors using persisted stats and weapons
      const aliceWeaponUrn = scenarioData.actors[aliceId]?.weapon || (defaultWeapon.urn as WeaponSchemaURN);
      const bobWeaponUrn = scenarioData.actors[bobId]?.weapon || (defaultWeapon.urn as WeaponSchemaURN);

      const aliceWeapon = weaponMap.get(aliceWeaponUrn);
      const bobWeapon = weaponMap.get(bobWeaponUrn);

      if (!aliceWeapon) throw new Error(`Weapon schema not found for Alice: ${aliceWeaponUrn}`);
      if (!bobWeapon) throw new Error(`Weapon schema not found for Bob: ${bobWeaponUrn}`);

      const alice = createActorWithShellStats(
        aliceId,
        'Alice',
        aliceWeapon,
        scenarioData.actors[aliceId]?.stats || { pow: 10, fin: 10, res: 10, per: 10 },
        testPlaceId
      );
      const bob = createActorWithShellStats(
        bobId,
        'Bob',
        bobWeapon,
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
  }, [aliceId, bobId, defaultWeapon]);

  // Function to start combat - creates session and transitions to active phase
  const startCombat = useCallback(() => {
    if (!initialContext || !isInSetupPhase) return;

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
      setEventCount(eventsAfter);

    } catch (error) {
      console.error('❌ Combat start failed:', error);
    }
  }, [initialContext, isInSetupPhase, aliceId, bobId, testPlaceId]);

  // Function to update actor stats during setup phase
  const updateActorStat = useCallback((actorId: ActorURN, stat: ActorStat, value: number) => {
    if (!isInSetupPhase || !initialContext) return;

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
  }, [isInSetupPhase, initialContext, setScenarioData]);

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

  // Function to update actor weapon during setup phase
  const updateActorWeapon = useCallback((actorId: ActorURN, weaponUrn: WeaponSchemaURN) => {
    if (!isInSetupPhase) return;

    // Validate weapon exists
    if (!availableWeapons.has(weaponUrn)) {
      throw new Error(`Weapon schema not found: ${weaponUrn}`);
    }

    // Persist the weapon change to localStorage
    setScenarioData((prev: CombatScenarioData) => ({
      ...prev,
      actors: {
        ...prev.actors,
        [actorId]: {
          ...prev.actors[actorId],
          weapon: weaponUrn
        }
      }
    }));
  }, [isInSetupPhase, availableWeapons, setScenarioData]);

  // Function to update actor skill during setup phase
  const updateActorSkill = useCallback((actorId: ActorURN, skillUrn: SkillURN, rank: number) => {
    if (!isInSetupPhase) return;

    // Validate skill rank bounds
    const clampedRank = Math.max(MIN_SKILL_RANK, Math.min(MAX_SKILL_RANK, rank));

    // Persist the skill change to localStorage
    setScenarioData((prev: CombatScenarioData) => ({
      ...prev,
      actors: {
        ...prev.actors,
        [actorId]: {
          ...prev.actors[actorId],
          skills: {
            ...prev.actors[actorId]?.skills,
            [skillUrn]: clampedRank
          }
        }
      }
    }));
  }, [isInSetupPhase, setScenarioData]);

  // Helper functions to get current actor data
  const getActorWeapon = useCallback((actorId: ActorURN): WeaponSchemaURN => {
    const actorData = scenarioData.actors[actorId];
    if (actorData?.weapon) {
      return actorData.weapon;
    }
    // Return first available weapon as fallback
    for (const [weaponUrn] of availableWeapons) {
      return weaponUrn;
    }
    throw new Error('No weapons available');
  }, [scenarioData, availableWeapons]);

  const getActorSkills = useCallback((actorId: ActorURN): Record<SkillURN, number> => {
    const actorData = scenarioData.actors[actorId];
    return actorData?.skills || {};
  }, [scenarioData]);

  // Combine state and actions
  const state: CombatSandboxState = useMemo(() => ({
    isInitialized,
    initialContext,
    initialSession,
    sessionId,
    actors,
    currentActorId,
    eventCount,
    aiControlled,
    aiThinking,
    availableWeapons,
    getActorWeapon,
    getActorSkills,
  }), [isInitialized, initialContext, initialSession, sessionId, actors, currentActorId, eventCount, aiControlled, aiThinking, availableWeapons, getActorWeapon, getActorSkills]);

  const actions: CombatSandboxActions = useMemo(() => ({
    startCombat,
    updateActorStat,
    updateActorWeapon,
    updateActorSkill,
    handleAiToggle,
    setAiThinking,
    handleTurnAdvance,
  }), [startCombat, updateActorStat, updateActorWeapon, updateActorSkill, handleAiToggle, handleTurnAdvance]);

  return { state, actions };
}

/**
 * Alias for useCombatSandbox to disambiguate from React hooks
 * Creates and manages a combat sandbox scenario with actors, phases, and AI control
 */
export const createCombatSandboxScenario = useCombatSandbox;
