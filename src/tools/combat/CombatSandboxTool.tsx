import { useState, useEffect } from 'react';
import {
  createActor,
  createCombatContext,
  createTransformerContext,
  type CombatContext,
  type CombatSession,
  type ActorURN,
  type PlaceURN,
  Team,
  useCombatSession,
  ActorStat,
  EventType,
} from '@flux';

import { BattlefieldCanvas } from './components/BattlefieldCanvas';
import { CommandInput } from './components/CommandInput';
import { CombatantCard } from './components/CombatantCard';
import { CombatLog } from './components/CombatLog';
import { useImmutableCombatState } from './hooks/useImmutableCombatState';
import { useCombatLog } from './hooks/useCombatLog';
// Test actor IDs and place
const ALICE_ID: ActorURN = 'flux:actor:alice';
const BOB_ID: ActorURN = 'flux:actor:bob';
const TEST_PLACE_ID: PlaceURN = 'flux:place:test-battlefield';

export function CombatSandboxTool() {
  const [initialContext, setInitialContext] = useState<CombatContext | null>(null);
  const [initialSession, setInitialSession] = useState<CombatSession | null>(null);
  const [actors, setActors] = useState<Record<string, any>>({});
  const [currentActorId, setCurrentActorId] = useState<ActorURN | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Use our immutable combat state hook - this replaces manual state management
  const { state, executeCommand } = useImmutableCombatState(
    initialContext,
    initialSession,
    currentActorId
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
      }
    });
  };

  // Initialize combat session with two test actors
  useEffect(() => {
    try {
      const transformerContext = createTransformerContext();
      const combatContext = createCombatContext(transformerContext);

      // Create Alice (Red Team - POW build)
      const alice = createActorWithShellStats(ALICE_ID, 'Alice', { pow: 65, fin: 45, res: 50, per: 30 });
      const bob = createActorWithShellStats(BOB_ID, 'Bob', { pow: 40, fin: 70, res: 40 });

      // Add actors to context
      combatContext.world.actors[ALICE_ID] = alice;
      combatContext.world.actors[BOB_ID] = bob;

      const { session: combatSession, addCombatant, startCombat } = useCombatSession(
        combatContext,
        'initialization',
        TEST_PLACE_ID
      );

      addCombatant(ALICE_ID, Team.RED);
      addCombatant(BOB_ID, Team.BLUE);

      // Start combat after adding all combatants
      startCombat();

      setInitialContext(combatContext);
      setInitialSession(combatSession);
      setActors({ [ALICE_ID]: alice, [BOB_ID]: bob });
      setCurrentActorId(ALICE_ID); // Alice starts
      setIsInitialized(true);

      // Get initial events from the combat session creation
      const initialEvents = combatContext.getDeclaredEvents();
      setCombatLog(initialEvents);
    } catch (error) {
      console.error('❌ Combat initialization failed:', error);
    }
  }, []);


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

  if (!isInitialized || !state.session) {
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

  const combatants = Array.from(state.session.data.combatants.values());
  const currentCombatant = getCurrentCombatant();

  return (
    <div className="combat-sandbox-tool h-full flex flex-col" style={{ backgroundColor: '#1d2021' }}>
      {/* Header with turn info */}
      <div className="px-6 py-4" style={{ backgroundColor: '#32302f', borderBottom: '1px solid #504945' }}>
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold" style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}>Combat Sandbox</h1>
          <div className="text-sm" style={{ color: '#a89984', fontFamily: 'Zilla Slab' }}>
            Turn {state.session.data.rounds.current.number} - {actors[currentActorId!]?.name || 'Unknown'}
            ({currentCombatant?.ap.eff.cur.toFixed(1) || 0} AP remaining)
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="flex-1 grid grid-cols-12 gap-6 p-6 overflow-hidden">

        {/* Left sidebar - Combatant cards */}
        <div className="col-span-3 space-y-4 overflow-y-auto">
          <h2 className="text-lg font-medium" style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}>Combatants</h2>
          {combatants.map(combatant => (
            <CombatantCard
              key={combatant.actorId}
              combatant={combatant}
              actor={actors[combatant.actorId]}
              isActive={combatant.actorId === currentActorId}
            />
          ))}
        </div>

        {/* Center - Battlefield */}
        <div className="col-span-6">
          <BattlefieldCanvas session={state.session} />
        </div>

        {/* Right sidebar - Command input and log */}
        <div className="col-span-3 flex flex-col space-y-4">
          <CommandInput
            onCommand={handleCommand}
            placeholder="Enter command (attack bob, move closer to alice, defend myself)"
          />

          <CombatLog entries={combatLog} />
          {/* Debug: Show combat log contents */}
          <div style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>
            Debug - Combat Log ({combatLog.length} entries): {combatLog.map(e => e.id).join(', ')}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="px-6 py-4" style={{ backgroundColor: '#282828', borderTop: '1px solid #504945' }}>
        <div className="flex justify-between items-center">
          <div className="text-sm" style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}>
            Available commands: attack, defend, move closer, back away, target &lt;actor&gt;
          </div>
          <div className="flex gap-2">
            <div className="text-xs text-green-400 bg-green-900/20 px-3 py-2 rounded">
              ✨ Turns advance automatically when AP = 0
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reset Match
            </button>
            <button
              onClick={() => setCurrentActorId(currentActorId === ALICE_ID ? BOB_ID : ALICE_ID)}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Switch Actor (Debug)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
