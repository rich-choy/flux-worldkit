import { useState, useEffect } from 'react';
import {
  type TransformerContext,
  createActor,
  createTransformerContext,
  type CombatSession,
  type ActorURN,
  type PlaceURN,
  Team,
  useCombatSession,
  ActorStat,
  EventType,
  HUMAN_ANATOMY,
  createWeaponSchema,
  type SessionURN,
  type RollResult,
  SpecialDuration,
} from '@flux';

const CombatPhase = {
  SETUP: 'setup',
  ACTIVE: 'active',
  ENDED: 'ended'
} as const;

type CombatPhase = typeof CombatPhase[keyof typeof CombatPhase];

import { BattlefieldCanvas } from './components/BattlefieldCanvas';
import { CommandInput } from './components/CommandInput';
import { CombatantCard } from './components/CombatantCard';
import { CombatLog } from './components/CombatLog';
import { useCombatState } from './hooks/useCombatState';
import { useCombatLog } from './hooks/useCombatLog';

// Test actor IDs and place
const ALICE_ID: ActorURN = 'flux:actor:alice';
const BOB_ID: ActorURN = 'flux:actor:bob';
const TEST_PLACE_ID: PlaceURN = 'flux:place:test-battlefield';

export function CombatSandboxTool() {
  const [phase, setPhase] = useState<CombatPhase>(CombatPhase.SETUP);
  const [initialContext, setInitialContext] = useState<TransformerContext | null>(null);
  const [initialSession, setInitialSession] = useState<CombatSession | null>(null);
  const [sessionId, setSessionId] = useState<SessionURN | null>(null);
  const [actors, setActors] = useState<Record<string, any>>({});
  const [currentActorId, setCurrentActorId] = useState<ActorURN | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Use our combat state hook - this replaces manual state management
  const { state, executeCommand } = useCombatState(
    initialContext,
    initialSession,
    currentActorId,
    TEST_PLACE_ID, // Use the same placeId as in startCombat
    sessionId      // Pass the captured session ID
  );

  // Use combat log hook for event management
  const { combatLog, addEvents: handleLogEvents, setLog: setCombatLog } = useCombatLog();

type ActorStatsInput = {
  pow: number;
  fin: number;
  res: number;
  int?: number;
  per?: number;
  mem?: number;
};

  const createActorWithShellStats = (id: ActorURN, name: string, stats: ActorStatsInput) => {
    const { pow, fin, res, int = 10, per = 10, mem = 10 } = stats;

    // Following the corrected pattern from strike.spec.ts
    const weaponEntityId = 'flux:item:weapon:test'; // Item instance URN
    const weaponSchemaUrn = 'flux:schema:weapon:test'; // Weapon schema URN

    return createActor({
      id,
      name,
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
          [weaponEntityId]: 1,
        },
      },
      inventory: {
        mass: 1_000,
        ts: Date.now(),
        items: {
          [weaponEntityId]: { id: weaponEntityId, schema: weaponSchemaUrn },
        },
      },
    });
  };

  // Initialize actors and context (but not combat session) during setup phase
  useEffect(() => {
    try {
      const context = createTransformerContext();

      // Set up weapon schema for combat
      const testWeapon = createWeaponSchema({
        name: 'Test Weapon',
        urn: 'flux:schema:weapon:test',
        range: { optimal: 1, max: 1 } // True 1m range melee weapon
      });
      // @ts-expect-error
      context.schemaManager.getSchema = (urn: string) => {
        if (urn === testWeapon.urn) {
          return testWeapon;
        }
        throw new Error(`Schema not found for URN: ${urn}`);
      };

      // Create Alice (Red Team - POW build)
      const alice = createActorWithShellStats(ALICE_ID, 'Alice', { pow: 10, fin: 10, res: 10, per: 10 });
      const bob = createActorWithShellStats(BOB_ID, 'Bob', { pow: 10, fin: 10, res: 10 });

      // Add actors to context
      context.world.actors[ALICE_ID] = alice;
      context.world.actors[BOB_ID] = bob;

      setInitialContext(context);
      setActors({ [ALICE_ID]: alice, [BOB_ID]: bob });
      setIsInitialized(true);
    } catch (error) {
      console.error('❌ Combat initialization failed:', error);
    }
  }, []);


  // Function to start combat - creates session and transitions to active phase
  const startCombat = () => {
    if (!initialContext || phase !== CombatPhase.SETUP) return;

    try {
      // Create deterministic initiative to ensure Alice always goes first
      const aliceInitiative: RollResult = {
        dice: '1d20' as const,
        values: [20],
        mods: { perception: { type: 'flux:modifier:initiative:per', origin: { type: 'flux:stat:per', actor: 'self' }, value: 0, duration: SpecialDuration.PERMANENT } },
        natural: 20,
        result: 20
      };
      const bobInitiative: RollResult = {
        dice: '1d20' as const,
        values: [1],
        mods: { perception: { type: 'flux:modifier:initiative:per', origin: { type: 'flux:stat:per', actor: 'self' }, value: 0, duration: SpecialDuration.PERMANENT } },
        natural: 1,
        result: 1
      };

      const deterministicInitiative = new Map<ActorURN, RollResult>([
        [ALICE_ID, aliceInitiative],
        [BOB_ID, bobInitiative]
      ]);

      // Create session with deterministic initiative using the proper abstraction
      // Note: The @flux package may not have the updated useCombatSession signature yet
      // For now, we'll create the session and then override the initiative
      const { session: combatSession, addCombatant, startCombat: startCombatSession } = useCombatSession(
        initialContext,
        TEST_PLACE_ID,
        undefined, // sessionId
        undefined, // battlefield
        deterministicInitiative,
      );

      // Capture the session ID that was created
      setSessionId(combatSession.id);

      addCombatant(ALICE_ID, Team.ALPHA);
      addCombatant(BOB_ID, Team.BRAVO);

      // Start combat - this will use our deterministic initiative
      startCombatSession();

      setInitialSession(combatSession);
      setCurrentActorId(ALICE_ID); // Alice always goes first
      setPhase(CombatPhase.ACTIVE);

      // Get initial events from the combat session creation
      const initialEvents = initialContext.getDeclaredEvents();
      setCombatLog(initialEvents);
    } catch (error) {
      console.error('❌ Combat start failed:', error);
    }
  };

  // Function to update actor stats during setup phase
  const updateActorStat = (actorId: ActorURN, stat: ActorStat, value: number) => {
    if (phase !== CombatPhase.SETUP || !initialContext) return;

    // Update the actor in the context directly
    const actor = initialContext.world.actors[actorId];
    if (actor && actor.stats[stat]) {
      actor.stats[stat].nat = value;
      actor.stats[stat].eff = value;

      // Update local state to trigger re-render
      setActors(prev => ({
        ...prev,
        [actorId]: { ...actor }
      }));
    }
  };

  const handleTurnAdvance = (newActorId: ActorURN) => {
    setCurrentActorId(newActorId);
  };

  // Enhanced executeCommand that integrates with our immutable state
  const handleCommand = (command: string) => {
    try {
      const events = executeCommand(command);
      handleLogEvents(events);

      // Check for turn advancement in the events
      const turnStartEvent = events.find(event => event.type === EventType.COMBAT_TURN_DID_START);

      if (turnStartEvent && turnStartEvent.actor !== currentActorId) {
        handleTurnAdvance(turnStartEvent.actor!);
      }
    } catch (error) {
      throw error;
    }
  };

  // Get current combatant from immutable state
  const getCurrentCombatant = () => {
    if (!currentActorId || !state.session) return null;
    return state.session.data?.combatants?.get(currentActorId) || null;
  };

  if (!isInitialized) {
    return (
      <div className="combat-sandbox-tool h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">⚔️</div>
            <p className="text-gray-600">Initializing combat sandbox...</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle setup vs active phase data
  const combatants = phase === CombatPhase.ACTIVE && state.session
    ? Array.from(state.session.data.combatants.values())
    : [];
  const currentCombatant = getCurrentCombatant();

  // For setup phase, create mock combatants from actors
  const setupActors = phase === CombatPhase.SETUP
    ? [
        { actorId: ALICE_ID, team: Team.ALPHA },
        { actorId: BOB_ID, team: Team.BRAVO }
      ]
    : [];

  return (
    <div className="combat-sandbox-tool h-full flex flex-col" style={{ backgroundColor: '#1d2021' }}>
      {/* Header with phase info */}
      <div className="px-6 py-4" style={{ backgroundColor: '#32302f', borderBottom: '1px solid #504945' }}>
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold" style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}>Combat Sandbox</h1>
          <div className="text-sm" style={{ color: '#a89984', fontFamily: 'Zilla Slab' }}>
            {phase === CombatPhase.SETUP ? (
              'Setup Phase - Customize actors before combat'
            ) : (
              `Turn ${state.session?.data.rounds.current.number} - ${actors[currentActorId!]?.name || 'Unknown'} (${currentCombatant?.ap.eff.cur.toFixed(1) || 0} AP remaining)`
            )}
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="flex-1 grid grid-cols-12 gap-6 p-6 overflow-hidden">

        {/* Left sidebar - Combatant cards */}
        <div className="col-span-3 space-y-4 overflow-y-auto">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium" style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}>
              {phase === CombatPhase.SETUP ? 'Setup Actors' : 'Combatants'}
            </h2>
            {phase === CombatPhase.SETUP && (
              <button
                onClick={startCombat}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                style={{ fontFamily: 'Zilla Slab' }}
              >
                Start Combat
              </button>
            )}
          </div>

          {phase === CombatPhase.SETUP ? (
            setupActors.map(setupActor => (
              <CombatantCard
                key={setupActor.actorId}
                combatant={null}
                actor={actors[setupActor.actorId]}
                team={setupActor.team}
                isEditable={true}
                onStatChange={updateActorStat}
              />
            ))
          ) : (
            combatants.map(combatant => (
              <CombatantCard
                key={combatant.actorId}
                combatant={combatant}
                actor={actors[combatant.actorId]}
                isActive={combatant.actorId === currentActorId}
              />
            ))
          )}
        </div>

        {/* Center - Battlefield */}
        <div className="col-span-6">
          {phase === CombatPhase.ACTIVE ? (
            <BattlefieldCanvas
              key={`battlefield-r${state.session?.data?.rounds?.current?.number || 0}-t${state.session?.data?.rounds?.current?.turns?.current?.number || 0}`}
              session={state.session}
            />
          ) : (
            <div className="h-full flex items-center justify-center rounded-lg" style={{ backgroundColor: '#282828', border: '2px dashed #504945' }}>
              <div className="text-center">
                <div className="text-4xl mb-4">⚔️</div>
                <h3 className="text-lg font-medium mb-2" style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}>
                  Combat Setup
                </h3>
                <p className="text-sm" style={{ color: '#a89984', fontFamily: 'Zilla Slab' }}>
                  Customize actor stats, then click "Start Combat" to begin
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar - Command input and log */}
        <div className="col-span-3 flex flex-col space-y-4">
          {phase === CombatPhase.ACTIVE ? (
            <>
              <CommandInput
                onCommand={handleCommand}
                placeholder="Enter command (attack bob, move closer to alice, defend myself)"
              />
              <CombatLog entries={combatLog} />
            </>
          ) : (
            <div className="rounded-lg p-4" style={{ backgroundColor: '#282828', border: '1px solid #504945' }}>
              <h3 className="text-lg font-medium mb-3" style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}>
                Setup Instructions
              </h3>
              <div className="space-y-2 text-sm" style={{ color: '#a89984', fontFamily: 'Zilla Slab' }}>
                <p>• Adjust actor stats using the number inputs</p>
                <p>• POW affects damage and health</p>
                <p>• FIN affects speed and accuracy</p>
                <p>• RES affects defense and stamina</p>
                <p>• Click "Start Combat" when ready</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="px-6 py-4" style={{ backgroundColor: '#282828', borderTop: '1px solid #504945' }}>
        <div className="flex justify-between items-center">
          <div className="text-sm" style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}>
            {phase === CombatPhase.SETUP ? (
              'Setup Phase: Modify stats and click "Start Combat" when ready'
            ) : (
              'Available commands: attack, defend, move closer, back away, target <actor>'
            )}
          </div>
          <div className="flex gap-2">
            {phase === CombatPhase.ACTIVE && (
              <div className="text-xs text-green-400 bg-green-900/20 px-3 py-2 rounded">
                ✨ Turns advance automatically when AP = 0
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reset Sandbox
            </button>
            {phase === CombatPhase.ACTIVE && (
              <button
                onClick={() => setCurrentActorId(currentActorId === ALICE_ID ? BOB_ID : ALICE_ID)}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Switch Actor (Debug)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
