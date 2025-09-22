import { useEffect, useCallback, useRef } from 'react';
import {
  type ActorURN,
  type PlaceURN,
  Team,
  EventType,
  generateCombatPlan,
  createCombatantApi,
  createIntentExecutionApi,
  createCombatSessionApi,
} from '@flux';

import { BattlefieldCanvas } from './components/BattlefieldCanvas';
import { CommandInput } from './components/CommandInput';
import { CombatantCard } from './components/CombatantCard';
import { CombatantForm } from './components/CombatantForm';
import { CombatLog } from './components/CombatLog';
import { useCombatLog } from './hooks/useCombatLog';
import { useCombatSandbox } from './hooks/useCombatSandbox';
import { useCombatState } from './hooks/useCombatState';

// Test actor IDs and place
const ALICE_ID: ActorURN = 'flux:actor:alice';
const BOB_ID: ActorURN = 'flux:actor:bob';
const TEST_PLACE_ID: PlaceURN = 'flux:place:test-battlefield';

export type CombatSandboxToolDependencies = {
  setTimeout: (callback: () => void, delay: number) => NodeJS.Timeout;
  generateCombatPlan: typeof generateCombatPlan;
  createCombatantApi: typeof createCombatantApi;
  createIntentExecutionApi: typeof createIntentExecutionApi;
  createCombatSessionApi: typeof createCombatSessionApi;
};

export const DEFAULT_COMBAT_SANDBOX_TOOL_DEPS: CombatSandboxToolDependencies = {
  setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
  generateCombatPlan,
  createCombatantApi,
  createIntentExecutionApi,
  createCombatSessionApi,
};

export function createCombatSandboxTool(deps: CombatSandboxToolDependencies = DEFAULT_COMBAT_SANDBOX_TOOL_DEPS) {

  return function CombatSandboxTool() {
    const { state, actions } = useCombatSandbox(ALICE_ID, BOB_ID, TEST_PLACE_ID);

    const { state: combatState, executeCommand } = useCombatState(
      state.initialContext,
      state.initialSession,
      state.currentActorId,
      TEST_PLACE_ID,
      state.sessionId
    );

    const { combatLog, addEvents: handleLogEvents } = useCombatLog();

    const aiExecutingRef = useRef<ActorURN | null>(null);

    // Helper to determine if we're in setup phase
    const isInSetupPhase = !state.initialSession || state.initialSession.status === 'pending';

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

    useEffect(() => {
      // Only execute AI actions during active combat
      if (isInSetupPhase || !state.currentActorId) {
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

      const aiExecutionTimer = deps.setTimeout(() => {
        if (!state.initialContext || !combatState.session || !state.currentActorId) {
          return;
        }

        const currentCombatant = combatState.session.data.combatants.get(state.currentActorId);
        if (currentCombatant) {

          const aiPlan = deps.generateCombatPlan(
            state.initialContext,
            combatState.session,
            currentCombatant,
            `ai-turn-${state.currentActorId}`,
          );

          console.log('🤖 AI-generated plan for', state.currentActorId, ':', aiPlan.length, 'actions');
          aiPlan.forEach((action, i) => {
            console.log(`  ${i + 1}. ${action.command} (AP: ${action.cost?.ap || 0})`, action.args);
          });

            // Execute the entire AI plan using the combat execution system
            if (aiPlan.length > 0) {
              // Use the session API to get combatant hook with proper turn advancement
              const sessionApi = deps.createCombatSessionApi(
                state.initialContext,
                TEST_PLACE_ID,
                combatState.session.id
              );
              const combatantHook = sessionApi.getCombatantApi(state.currentActorId);

              const intentExecutor = deps.createIntentExecutionApi(
                state.initialContext,
                combatState.session,
                combatantHook
              );

            console.log('🎯 Executing AI plan...');
            const events = intentExecutor.executeActions(aiPlan, `ai-plan-${state.currentActorId}`);
            console.log('✅ AI plan executed:', events.length, 'events generated');

            // Add events to combat log
            handleLogEvents(events);

            // Check for turn advancement in the AI-generated events
            const turnStartEvent = events.find(event => event.type === EventType.COMBAT_TURN_DID_START);
            if (turnStartEvent && turnStartEvent.actor !== state.currentActorId) {
              actions.handleTurnAdvance(turnStartEvent.actor!);
            }

            // Process the events to update the UI state
            events.forEach(event => {
              console.log('📋 Event:', event.type, event.payload);
            });
          }
        }

        // Clear AI thinking state and execution tracking after execution
        actions.setAiThinking(null);
        aiExecutingRef.current = null;
      }, 1000); // 1 second delay for better UX

      // Cleanup timer on unmount or dependency change
      return () => {
        clearTimeout(aiExecutionTimer);
        actions.setAiThinking(null);
        aiExecutingRef.current = null;
      };
    }, [state.currentActorId, state.aiControlled, isInSetupPhase, actions, handleCommand, combatState.session, state.initialContext]);

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
    const combatants = !isInSetupPhase && combatState.session
      ? Array.from(combatState.session.data.combatants.values())
      : [];
    const currentCombatant = getCurrentCombatant();

    // For setup phase, create mock combatants from actors
    const setupActors = isInSetupPhase
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
              {isInSetupPhase ? (
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
                {isInSetupPhase ? 'Setup Actors' : 'Combatants'}
              </h2>
              {isInSetupPhase && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (confirm('Reset all actor stats and AI settings to defaults?')) {
                        localStorage.removeItem('combat-sandbox-scenario');
                        window.location.reload();
                      }
                    }}
                    className="px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    style={{ fontFamily: 'Zilla Slab' }}
                    title="Reset scenario to defaults"
                  >
                    Reset
                  </button>
                  <button
                    onClick={actions.startCombat}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    style={{ fontFamily: 'Zilla Slab' }}
                  >
                    Start Combat
                  </button>
                </div>
              )}
            </div>

            {isInSetupPhase ? (
              setupActors.map(setupActor => (
                <CombatantForm
                  key={setupActor.actorId}
                  actor={state.actors[setupActor.actorId]}
                  team={setupActor.team}
                  availableWeapons={state.availableWeapons}
                  currentWeaponUrn={state.getActorWeapon(setupActor.actorId)}
                  onWeaponChange={actions.updateActorWeapon}
                  skillValues={state.getActorSkills(setupActor.actorId)}
                  onSkillChange={actions.updateActorSkill}
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
            {!isInSetupPhase ? (
              <BattlefieldCanvas
                key={`battlefield-${state.initialContext?.getDeclaredEvents().slice(-1)[0]?.id || 'initial'}`}
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
            {!isInSetupPhase ? (
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
                  <p>• Settings are automatically saved</p>
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
              {isInSetupPhase ? (
                'Setup Phase: Modify stats and click "Start Combat" when ready'
              ) : (
                'Available commands: attack, defend, move closer, back away, target <actor>'
              )}
            </div>
            <div className="flex gap-2">
              {!isInSetupPhase && (
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
              {!isInSetupPhase && (
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
  };
}

export const CombatSandboxTool: React.FC = createCombatSandboxTool(DEFAULT_COMBAT_SANDBOX_TOOL_DEPS);
