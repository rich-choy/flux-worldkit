import { useEffect, useCallback, useRef } from 'react';
import {
  type ActorURN,
  type PlaceURN,
  Team,
  EventType,
  createWeaponSchema,
  DEFAULT_COMBAT_PLANNING_DEPS,
  generateCombatPlan,
} from '@flux';

import { BattlefieldCanvas } from './components/BattlefieldCanvas';
import { CommandInput } from './components/CommandInput';
import { CombatantCard } from './components/CombatantCard';
import { CombatLog } from './components/CombatLog';
import { useCombatState } from './hooks/useCombatState';
import { useCombatLog } from './hooks/useCombatLog';
import { useCombatSandbox } from './hooks/useCombatSandbox';

// Test actor IDs and place
const ALICE_ID: ActorURN = 'flux:actor:alice';
const BOB_ID: ActorURN = 'flux:actor:bob';
const TEST_PLACE_ID: PlaceURN = 'flux:place:test-battlefield';

// Set up weapon schema for combat
const TEST_WEAPON = createWeaponSchema({
  name: 'Test Weapon',
  urn: 'flux:schema:weapon:test',
  range: { optimal: 1, max: 1 } // True 1m range melee weapon
});

export function CombatSandboxTool() {
  // Use our clean, well-tested hook for all state management
  const { state, actions } = useCombatSandbox(ALICE_ID, BOB_ID, TEST_PLACE_ID, TEST_WEAPON);

  // Use our combat state hook for command execution
  const { state: combatState, executeCommand } = useCombatState(
    state.initialContext,
    state.initialSession,
    state.currentActorId,
    TEST_PLACE_ID,
    state.sessionId
  );

  // Use combat log hook for event management
  const { combatLog, addEvents: handleLogEvents } = useCombatLog();

  // Track AI execution to prevent loops
  const aiExecutingRef = useRef<ActorURN | null>(null);


  // Enhanced executeCommand that integrates with our hook-based state
  const handleCommand = useCallback((command: string) => {
    try {
      const events = executeCommand(command);
      handleLogEvents(events);

      // Check for turn advancement in the events
      const turnStartEvent = events.find(event => event.type === EventType.COMBAT_TURN_DID_START);

      if (turnStartEvent && turnStartEvent.actor !== state.currentActorId) {
        actions.handleTurnAdvance(turnStartEvent.actor!);
      }
    } catch (error) {
      throw error;
    }
  }, [executeCommand, handleLogEvents, state.currentActorId, actions]);

  // AI auto-execution effect
  useEffect(() => {
    // Only execute AI actions during active combat
    if (state.phase !== 'active' || !state.currentActorId) {
      aiExecutingRef.current = null;
      return;
    }

    // Check if current actor is AI-controlled
    const isCurrentActorAI = state.aiControlled[state.currentActorId];
    if (!isCurrentActorAI) {
      aiExecutingRef.current = null;
      return;
    }

    // Prevent multiple executions for the same turn using ref
    if (aiExecutingRef.current === state.currentActorId) {
      return;
    }

    // Mark this actor as executing and set AI thinking state
    aiExecutingRef.current = state.currentActorId;
    actions.setAiThinking(state.currentActorId);

    const aiExecutionTimer = setTimeout(() => {
      try {
        // Use AI planning system directly with stubbed dependencies
        if (state.initialContext && combatState.session && state.currentActorId) {
          const currentCombatant = combatState.session.data.combatants.get(state.currentActorId);
          if (currentCombatant) {
            // Create stubbed dependencies like in the integration tests
            const stubbedDeps = {
              ...DEFAULT_COMBAT_PLANNING_DEPS,
              calculateWeaponApCost: () => 2, // 2 AP for any weapon strike
            };

            // Generate AI plan with stubbed dependencies
            const aiPlan = generateCombatPlan(
              state.initialContext,
              combatState.session,
              currentCombatant,
              `ai-turn-${state.currentActorId}`,
              stubbedDeps
            );

            // Execute the first action from the AI plan
            if (aiPlan.length > 0) {
              const firstAction = aiPlan[0];
              let command = firstAction.command.toLowerCase();

              // Convert AI action to command string
              if (firstAction.command === 'STRIKE' && firstAction.args?.target) {
                command = `attack ${firstAction.args.target.split(':').pop()}`;
              } else if (firstAction.command === 'ADVANCE') {
                const distance = firstAction.args?.distance || 10;
                command = `advance ${distance}`;
              } else if (firstAction.command === 'RETREAT') {
                const distance = firstAction.args?.distance || 10;
                command = `retreat ${distance}`;
              } else if (firstAction.command === 'DEFEND') {
                command = 'defend';
              } else if (firstAction.command === 'TARGET' && firstAction.args?.target) {
                command = `target ${firstAction.args.target.split(':').pop()}`;
              }

              handleCommand(command);
            } else {
              handleCommand("attack");
            }
          }
        } else {
          handleCommand("attack");
        }
      } catch (error) {
        console.error('AI execution failed:', error);
        try {
          handleCommand("attack");
        } catch (fallbackError) {
          console.error('Fallback attack also failed:', fallbackError);
        }
      } finally {
        // Clear AI thinking state and execution tracking after execution
        actions.setAiThinking(null);
        aiExecutingRef.current = null;
      }
    }, 1000); // 1 second delay for better UX

    // Cleanup timer on unmount or dependency change
    return () => {
      clearTimeout(aiExecutionTimer);
      actions.setAiThinking(null);
      aiExecutingRef.current = null;
    };
  }, [state.currentActorId, state.aiControlled, state.phase, actions, handleCommand, combatState.session, state.initialContext]);

  // Get current combatant from immutable state
  const getCurrentCombatant = () => {
    if (!state.currentActorId || !combatState.session) return null;
    return combatState.session.data?.combatants?.get(state.currentActorId) || null;
  };

  if (!state.isInitialized) {
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
  const combatants = state.phase === 'active' && combatState.session
    ? Array.from(combatState.session.data.combatants.values())
    : [];
  const currentCombatant = getCurrentCombatant();

  // For setup phase, create mock combatants from actors
  const setupActors = state.phase === 'setup'
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
            {state.phase === 'setup' ? (
              'Setup Phase - Customize actors before combat'
            ) : (
              `Turn ${combatState.session?.data.rounds.current.number} - ${state.actors[state.currentActorId!]?.name || 'Unknown'} (${currentCombatant?.ap.eff.cur.toFixed(1) || 0} AP remaining)`
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
              {state.phase === 'setup' ? 'Setup Actors' : 'Combatants'}
            </h2>
            {state.phase === 'setup' && (
              <button
                onClick={actions.startCombat}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                style={{ fontFamily: 'Zilla Slab' }}
              >
                Start Combat
              </button>
            )}
          </div>

          {state.phase === 'setup' ? (
            setupActors.map(setupActor => (
              <CombatantCard
                key={setupActor.actorId}
                combatant={null}
                actor={state.actors[setupActor.actorId]}
                team={setupActor.team}
                isEditable={true}
                onStatChange={actions.updateActorStat}
                isAiControlled={state.aiControlled[setupActor.actorId] || false}
                onAiToggle={actions.handleAiToggle}
                isAiThinking={state.aiThinking === setupActor.actorId}
              />
            ))
          ) : (
            combatants.map(combatant => (
              <CombatantCard
                key={combatant.actorId}
                combatant={combatant}
                actor={state.actors[combatant.actorId]}
                isActive={combatant.actorId === state.currentActorId}
                isAiControlled={state.aiControlled[combatant.actorId] || false}
                onAiToggle={actions.handleAiToggle}
                isAiThinking={state.aiThinking === combatant.actorId}
              />
            ))
          )}
        </div>

        {/* Center - Battlefield */}
        <div className="col-span-6">
          {state.phase === 'active' ? (
            <BattlefieldCanvas
              key={`battlefield-r${combatState.session?.data?.rounds?.current?.number || 0}-t${combatState.session?.data?.rounds?.current?.turns?.current?.number || 0}`}
              session={combatState.session}
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
          {state.phase === 'active' ? (
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
            {state.phase === 'setup' ? (
              'Setup Phase: Modify stats and click "Start Combat" when ready'
            ) : (
              'Available commands: attack, defend, move closer, back away, target <actor>'
            )}
          </div>
          <div className="flex gap-2">
            {state.phase === 'active' && (
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
            {state.phase === 'active' && (
              <button
                onClick={() => actions.handleTurnAdvance(state.currentActorId === ALICE_ID ? BOB_ID : ALICE_ID)}
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
