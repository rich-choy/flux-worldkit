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
  type ItemURN,
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
    'flux:skill:weapon:melee'?: number;
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

const TEST_WEAPON_ENTITY_URN: ItemURN = 'flux:item:weapon:test';
const DEFAULT_WEAPON_SCHEMA_URN: WeaponSchemaURN = 'flux:schema:weapon:longsword';

// Additional combatant actor URNs
const CHARLIE_ID: ActorURN = 'flux:actor:charlie';
const ERIC_ID: ActorURN = 'flux:actor:eric';
const DAVE_ID: ActorURN = 'flux:actor:dave';
const FRANZ_ID: ActorURN = 'flux:actor:franz';

export type CombatSandboxActions = {
  // Phase transitions
  startCombat: () => void;

  // Actor management
  updateActorStat: (actorId: ActorURN, stat: ActorStat, value: number) => void;
  updateActorWeapon: (actorId: ActorURN, weaponUrn: WeaponSchemaURN) => void;
  updateActorSkill: (actorId: ActorURN, skillUrn: SkillURN, rank: number) => void;

  // Optional combatant management
  addCombatant: (name: 'charlie' | 'eric' | 'dave' | 'franz') => void;
  removeCombatant: (name: 'charlie' | 'eric' | 'dave' | 'franz') => void;

  // AI control
  handleAiToggle: (actorId: ActorURN, enabled: boolean) => void;
  setAiThinking: (actorId: ActorURN | null) => void;

  // Turn management
  handleTurnAdvance: (newActorId: ActorURN) => void;

  // State synchronization
  syncActorsFromContext: () => void;
};

const createActorWithShellStats = (
  id: ActorURN,
  name: string,
  weapon: WeaponSchema,
  stats: ActorShellStatsInput,
  location: PlaceURN,
  skills: Record<SkillURN, number> = {}
) => {
  const { pow = 10, fin = 10, res = 10, int = 10, per = 10, mem = 10 } = stats;

  // Convert skill ranks to skill state objects
  const skillStates: Record<SkillURN, any> = {};
  for (const [skillUrn, rank] of Object.entries(skills)) {
    skillStates[skillUrn as SkillURN] = {
      xp: 0,
      pxp: 0,
      rank: rank
    };
  }

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
    skills: skillStates,
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
  testPlaceId: PlaceURN = 'flux:place:test-battlefield',
  defaultWeapon: WeaponSchemaURN= DEFAULT_WEAPON_SCHEMA_URN,
): CombatSandboxHook {
  // Default scenario data
  const defaultScenarioData: CombatScenarioData = {
    actors: {
      [aliceId]: {
        stats: { pow: 10, fin: 10, res: 10, per: 10 },
        aiControlled: false,
        weapon: defaultWeapon,
        skills: {
          'flux:skill:evasion': 0,
          'flux:skill:weapon:melee': 0
        }
      },
      [bobId]: {
        stats: { pow: 10, fin: 10, res: 10 },
        aiControlled: true, // Bob is AI-controlled by default
        weapon: defaultWeapon,
        skills: {
          'flux:skill:evasion': 0,
          'flux:skill:weapon:melee': 0
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

      // Create test actors using persisted stats and weapons
      const aliceWeaponUrn = scenarioData.actors[aliceId]?.weapon || defaultWeapon;
      const bobWeaponUrn = scenarioData.actors[bobId]?.weapon || defaultWeapon;

      const aliceWeapon = weaponMap.get(aliceWeaponUrn);
      const bobWeapon = weaponMap.get(bobWeaponUrn);

      if (!aliceWeapon) throw new Error(`Weapon schema not found for Alice: ${aliceWeaponUrn}`);
      if (!bobWeapon) throw new Error(`Weapon schema not found for Bob: ${bobWeaponUrn}`);

      const alice = createActorWithShellStats(
        aliceId,
        'Alice',
        aliceWeapon,
        scenarioData.actors[aliceId]?.stats || { pow: 10, fin: 10, res: 10, per: 10 },
        testPlaceId,
        scenarioData.actors[aliceId]?.skills || {}
      );
      const bob = createActorWithShellStats(
        bobId,
        'Bob',
        bobWeapon,
        scenarioData.actors[bobId]?.stats || { pow: 10, fin: 10, res: 10 },
        testPlaceId,
        scenarioData.actors[bobId]?.skills || {}
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
      // Create session without predetermined initiative - let the session layer compute it dynamically
      const combatSessionApi = createCombatSessionApi(
        initialContext,
        testPlaceId,
        undefined, // sessionId
        undefined, // battlefield
        undefined, // initiative - let it be computed automatically
      );

      const { session: combatSession, addCombatant, startCombat: startCombatSession } = combatSessionApi;

      // Capture the session ID that was created
      if (combatSession && combatSession.id) {
        setSessionId(combatSession.id);
      } else {
        console.error('Combat session is null or missing ID:', combatSession);
        return;
      }

      // Add all active actors to the combat session
      const activeActorIds = Object.keys(initialContext.world.actors) as ActorURN[];

      for (const actorId of activeActorIds) {
        const team = getTeamFromActorId(actorId);
        addCombatant(actorId, team);
      }

      // Set up targeting - each combatant targets a random enemy from the opposing team
      const alphaCombatants: ActorURN[] = [];
      const bravoCombatants: ActorURN[] = [];

      for (const [actorId, combatant] of combatSession.data.combatants) {
        if (combatant.team === Team.ALPHA) {
          alphaCombatants.push(actorId);
        } else {
          bravoCombatants.push(actorId);
        }
      }

      // Set up targeting: each combatant targets a random enemy
      for (const [, combatant] of combatSession.data.combatants) {
        const enemies = combatant.team === Team.ALPHA ? bravoCombatants : alphaCombatants;
        if (enemies.length > 0) {
          const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
          combatant.target = randomEnemy;
        }
      }

      // Start combat - this will generate WorldEvents and compute initiative
      startCombatSession();

      // Get the first actor from the computed initiative order
      const firstActorId = combatSession.data.initiative.keys().next().value as ActorURN;

      // Track events after combat start for re-render triggering
      const eventsAfter = initialContext.getDeclaredEvents().length;

      // Update state - session object is mutated, not replaced
      setInitialSession(combatSession);
      setCurrentActorId(firstActorId); // Use computed initiative order
      setEventCount(eventsAfter);

    } catch (error) {
      console.error('❌ Combat start failed:', error);
    }
  }, [initialContext, isInSetupPhase, testPlaceId]);

  // Helper to get team from actor ID
  const getTeamFromActorId = (actorId: ActorURN): Team => {
    if (actorId === aliceId || actorId === CHARLIE_ID || actorId === ERIC_ID) {
      return Team.ALPHA;
    } else {
      return Team.BRAVO;
    }
  };

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
    // If advancing to a dead actor, log a warning but still update the state
    // The turn manager should have already handled skipping dead actors
    if (initialContext && initialContext.world.actors[newActorId]) {
      const newActor = initialContext.world.actors[newActorId];
      if (newActor.hp.eff.cur <= 0) {
        throw new Error('Turn advanced to dead actor');
      }
    }

    setCurrentActorId(newActorId);
  }, [currentActorId, initialContext]);

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

  // Helper functions for optional combatants
  const getActorIdFromName = (name: 'charlie' | 'eric' | 'dave' | 'franz'): ActorURN => {
    switch (name) {
      case 'charlie': return CHARLIE_ID;
      case 'eric': return ERIC_ID;
      case 'dave': return DAVE_ID;
      case 'franz': return FRANZ_ID;
    }
  };

  const getTeamFromName = (name: 'charlie' | 'eric' | 'dave' | 'franz'): Team => {
    return (name === 'charlie' || name === 'eric') ? Team.ALPHA : Team.BRAVO;
  };

  const getNameFromActorId = (actorId: ActorURN): string => {
    switch (actorId) {
      case CHARLIE_ID: return 'Charlie';
      case ERIC_ID: return 'Eric';
      case DAVE_ID: return 'Dave';
      case FRANZ_ID: return 'Franz';
      case aliceId: return 'Alice';
      case bobId: return 'Bob';
      default: return actorId.split(':').pop() || 'Unknown';
    }
  };

  // Function to add optional combatants during setup phase
  const addCombatant = useCallback((name: 'charlie' | 'eric' | 'dave' | 'franz') => {
    if (!isInSetupPhase || !initialContext) return;

    const actorId = getActorIdFromName(name);
    const team = getTeamFromName(name);
    const actorName = getNameFromActorId(actorId);

    // Check if actor already exists
    if (initialContext.world.actors[actorId]) {
      throw new Error(`Actor ${actorName} already exists`);
    }

    // Get default weapon schema
    const weaponSchema = availableWeapons.get(DEFAULT_WEAPON_SCHEMA_URN);
    if (!weaponSchema) {
      throw new Error(`Default weapon schema not found: ${DEFAULT_WEAPON_SCHEMA_URN}`);
    }

    // Create the actor with default stats and skills
    const defaultStats = { pow: 10, fin: 10, res: 10, per: 10 };
    const defaultSkills = {
      'flux:skill:evasion': 0,
      'flux:skill:weapon:melee': 0
    };
    const actor = createActorWithShellStats(
      actorId,
      actorName,
      weaponSchema,
      defaultStats,
      testPlaceId,
      defaultSkills
    );

    // Add actor to world context
    initialContext.world.actors[actorId] = actor;

    // Add to local actors state for UI updates
    setActors(prev => ({
      ...prev,
      [actorId]: actor
    }));

    // Persist actor data to localStorage
    setScenarioData((prev: CombatScenarioData) => ({
      ...prev,
      actors: {
        ...prev.actors,
        [actorId]: {
          stats: defaultStats,
          aiControlled: true, // Optional combatants are AI-controlled by default
          weapon: DEFAULT_WEAPON_SCHEMA_URN,
        skills: {
          'flux:skill:evasion': 0,
          'flux:skill:weapon:melee': 0
        }
        }
      }
    }));

    // Set AI control state
    setAiControlled(prev => ({
      ...prev,
      [actorId]: true
    }));

  }, [isInSetupPhase, initialContext, availableWeapons, testPlaceId, setActors, setScenarioData, setAiControlled]);

  // Function to remove optional combatants during setup phase
  const removeCombatant = useCallback((name: 'charlie' | 'eric' | 'dave' | 'franz') => {
    if (!isInSetupPhase || !initialContext) return;

    const actorId = getActorIdFromName(name);
    const actorName = getNameFromActorId(actorId);

    // Check if actor exists
    if (!initialContext.world.actors[actorId]) {
      throw new Error(`Actor ${actorName} does not exist`);
    }

    // Remove from world context
    delete initialContext.world.actors[actorId];

    // Remove from local actors state
    setActors(prev => {
      const newActors = { ...prev };
      delete newActors[actorId];
      return newActors;
    });

    // Remove from localStorage (optional - could keep for future re-adding)
    setScenarioData((prev: CombatScenarioData) => {
      const newActors = { ...prev.actors };
      delete newActors[actorId];
      return {
        ...prev,
        actors: newActors
      };
    });

    // Remove AI control state
    setAiControlled(prev => {
      const newAiControlled = { ...prev };
      delete newAiControlled[actorId];
      return newAiControlled;
    });

  }, [isInSetupPhase, initialContext, setActors, setScenarioData, setAiControlled]);

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

  // Synchronize React UI state with authoritative combat state
  const syncActorsFromContext = useCallback(() => {
    if (!initialContext) return;

    const updatedActors: Record<string, any> = {};
    for (let actorId in initialContext.world.actors) {
      const actor = initialContext.world.actors[actorId as ActorURN];
      updatedActors[actorId] = { ...actor }; // Create a new reference to trigger React re-render
    }
    setActors(updatedActors);
  }, [initialContext]);

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
    addCombatant,
    removeCombatant,
    handleAiToggle,
    setAiThinking,
    handleTurnAdvance,
    syncActorsFromContext,
  }), [startCombat, updateActorStat, updateActorWeapon, updateActorSkill, addCombatant, removeCombatant, handleAiToggle, handleTurnAdvance, syncActorsFromContext]);

  return { state, actions };
}

/**
 * Alias for useCombatSandbox to disambiguate from React hooks
 * Creates and manages a combat sandbox scenario with actors, phases, and AI control
 */
export const createCombatSandboxScenario = useCombatSandbox;
