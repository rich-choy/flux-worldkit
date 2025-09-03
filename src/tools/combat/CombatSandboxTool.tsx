import { useState, useEffect } from 'react';
import {
  createActor,
  createCombatContext,
  createTransformerContext,
  type CombatContext,
  type CombatSession,
  type ActorURN,
  type WorldEvent,
  Team,
  useCombatSession,
} from '@flux';
import { BattlefieldCanvas } from './components/BattlefieldCanvas';
import { CommandInput } from './components/CommandInput';
import { CombatantCard } from './components/CombatantCard';
import { CombatLog } from './components/CombatLog';
import { useCombatActions } from './hooks/useCombatActions';

// Test actor IDs and place
const ALICE_ID: ActorURN = 'flux:actor:alice';
const BOB_ID: ActorURN = 'flux:actor:bob';
const TEST_PLACE_ID = 'flux:place:test-battlefield';

export function CombatSandboxTool() {
  const [context, setContext] = useState<CombatContext | null>(null);
  const [session, setSession] = useState<CombatSession | null>(null);
  const [actors, setActors] = useState<Record<string, any>>({});
  const [currentActorId, setCurrentActorId] = useState<ActorURN | null>(null);
  const [combatLog, setCombatLog] = useState<WorldEvent[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize combat session with two test actors
  useEffect(() => {
    const transformerContext = createTransformerContext();
    const combatContext = createCombatContext(transformerContext);

    // Create Alice (Red Team - POW build)
    const alice = createActor({
      id: ALICE_ID,
      name: 'Alice',
      stats: {
        pow: { nat: 65, eff: 65, mods: {} },
        fin: { nat: 45, eff: 45, mods: {} },
        res: { nat: 50, eff: 50, mods: {} },
        int: { nat: 10, eff: 10, mods: {} },
        per: { nat: 10, eff: 10, mods: {} },
        mem: { nat: 10, eff: 10, mods: {} }
      }
    });

    // Create Bob (Blue Team - FIN build)
    const bob = createActor({
      id: BOB_ID,
      name: 'Bob',
      stats: {
        pow: { nat: 40, eff: 40, mods: {} },
        fin: { nat: 70, eff: 70, mods: {} },
        res: { nat: 40, eff: 40, mods: {} },
        int: { nat: 10, eff: 10, mods: {} },
        per: { nat: 10, eff: 10, mods: {} },
        mem: { nat: 10, eff: 10, mods: {} }
      }
    });

    // Add actors to context
    combatContext.world.actors[ALICE_ID] = alice;
    combatContext.world.actors[BOB_ID] = bob;

    const { session: combatSession, addCombatant } = useCombatSession(
      combatContext,
      'initialization',
      TEST_PLACE_ID
    );

    addCombatant(ALICE_ID, Team.RED);
    addCombatant(BOB_ID, Team.BLUE);

    setContext(combatContext);
    setSession(combatSession);
    setActors({ [ALICE_ID]: alice, [BOB_ID]: bob });
    setCurrentActorId(ALICE_ID); // Alice starts
    setIsInitialized(true);

    // Add initial log entries
    const initialEvents: WorldEvent[] = [
      {
        id: 'init-1',
        type: 'COMBAT_TURN_START' as any,
        ts: Date.now() - 3000,
        actor: BOB_ID,
        location: TEST_PLACE_ID,
        trace: 'initialization',
        payload: { message: 'Bob targets Alice' }
      },
      {
        id: 'init-2',
        type: 'COMBAT_ACTOR_DID_MOVE' as any,
        ts: Date.now() - 2000,
        actor: BOB_ID,
        location: TEST_PLACE_ID,
        trace: 'initialization',
        payload: { message: 'Bob repositions to 185m (2.1 AP)' }
      },
      {
        id: 'init-3',
        type: 'COMBAT_TURN_START' as any,
        ts: Date.now() - 1000,
        actor: ALICE_ID,
        location: TEST_PLACE_ID,
        trace: 'initialization',
        payload: { message: 'Alice\'s turn begins' }
      }
    ];
    setCombatLog(initialEvents);
  }, []);

  // Combat actions hook
  const { executeCommand, getAvailableCommands, getCurrentCombatant } = useCombatActions({
    context: context!,
    session: session!,
    currentActorId,
    onLogEvents: (events: WorldEvent[]) => {
      setCombatLog(prev => [...prev, ...events]);
      // Trigger session re-render to update UI
      if (session) {
        setSession({ ...session });
      }
    }
  });

  if (!isInitialized || !context || !session) {
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

  const combatants = Array.from(session.data.combatants.values());
  const currentCombatant = getCurrentCombatant();

  return (
    <div className="combat-sandbox-tool h-full flex flex-col bg-gray-100">
      {/* Header with turn info */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Combat Sandbox</h1>
          <div className="text-sm text-gray-600">
            Turn {session.data.rounds.current.number} - {actors[currentActorId!]?.name || 'Unknown'}
            ({currentCombatant?.ap.eff.cur.toFixed(1) || 0} AP remaining)
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="flex-1 grid grid-cols-12 gap-6 p-6 overflow-hidden">

        {/* Left sidebar - Combatant cards */}
        <div className="col-span-3 space-y-4 overflow-y-auto">
          <h2 className="text-lg font-medium text-gray-900">Combatants</h2>
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
          <BattlefieldCanvas session={session} />
        </div>

        {/* Right sidebar - Command input and log */}
        <div className="col-span-3 flex flex-col space-y-4">
          <CommandInput
            onCommand={executeCommand}
            placeholder="Enter command (target bob, reposition 150, attack, defend)"
          />

          <CombatLog entries={combatLog} />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Available commands: {getAvailableCommands().join(', ')}
          </div>
          <div className="flex gap-2">
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
              Switch Actor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
