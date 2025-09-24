import { useEffect, useCallback, useRef } from 'react';
import {
  type ActorURN,
  type PlaceURN,
  Team,
  EventType,
  SessionStatus,
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
  clearTimeout: (timeout: NodeJS.Timeout) => void;
  generateCombatPlan: typeof generateCombatPlan;
  createCombatantApi: typeof createCombatantApi;
  createIntentExecutionApi: typeof createIntentExecutionApi;
  createCombatSessionApi: typeof createCombatSessionApi;
};

export const DEFAULT_COMBAT_SANDBOX_TOOL_DEPS: CombatSandboxToolDependencies = {
  setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
  clearTimeout: (timeout: NodeJS.Timeout) => clearTimeout(timeout),
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
    const aiTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionApiRef = useRef<any>(null);

    // Helper to determine if we're in setup phase
    const isInSetupPhase = !state.initialSession || state.initialSession.status === 'pending';
    const isPaused = state.initialSession?.status === SessionStatus.PAUSED;
    const isRunning = state.initialSession?.status === SessionStatus.RUNNING;

    // Get session API when session is available
    useEffect(() => {
      if (state.initialContext && state.sessionId && !isInSetupPhase) {
        sessionApiRef.current = createCombatSessionApi(
          state.initialContext,
          TEST_PLACE_ID,
          state.sessionId
        );
      } else {
        sessionApiRef.current = null;
      }
    }, [state.initialContext, state.sessionId, isInSetupPhase]);

    const handleCommand = useCallback((command: string) => {
      const events = executeCommand(command);
      handleLogEvents(events);

      // CRITICAL: Synchronize React UI state with authoritative combat state
      actions.syncActorsFromContext();

      // Check for turn advancement in the events
      const turnStartEvent = events.find(event => event.type === EventType.COMBAT_TURN_DID_START);

      if (turnStartEvent && turnStartEvent.actor !== state.currentActorId) {
        actions.handleTurnAdvance(turnStartEvent.actor!);
      }
    }, [executeCommand, handleLogEvents, state.currentActorId, actions]);

    // Pause/Resume handlers
    const handlePause = useCallback(() => {
      if (!sessionApiRef.current || !isRunning) return;

      // Cancel any pending AI timer
      if (aiTimerRef.current) {
        deps.clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }

      // Pause combat and handle events
      const events = sessionApiRef.current.pauseCombat();
      handleLogEvents(events);

      // Clear AI thinking state
      actions.setAiThinking(null);
      aiExecutingRef.current = null;

    }, [isRunning, handleLogEvents, actions]);

    const handleResume = useCallback(() => {
      if (!sessionApiRef.current || !isPaused) return;

      // Resume combat and handle events
      const events = sessionApiRef.current.resumeCombat();
      handleLogEvents(events);

      // AI execution will restart automatically via useEffect
    }, [isPaused, handleLogEvents]);

    useEffect(() => {
      // Only execute AI actions during active combat
      if (isInSetupPhase || !state.currentActorId) {
        aiExecutingRef.current = null;
        return;
      }

      // Don't execute AI actions when combat is paused
      if (isPaused) {
        aiExecutingRef.current = null;
        return;
      }

      // Check if current actor is AI-controlled
      const isCurrentActorAI = state.aiControlled[state.currentActorId];
      if (!isCurrentActorAI) {
        aiExecutingRef.current = null;
        return;
      }

      // Check if current actor is dead - skip AI execution for dead actors
      const currentActor = state.actors[state.currentActorId];
      if (currentActor && currentActor.hp.eff.cur <= 0) {
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

        // Double-check that the current actor is still alive before executing AI
        const currentActor = state.initialContext.world.actors[state.currentActorId];
        if (!currentActor || currentActor.hp.eff.cur <= 0) {
          aiExecutingRef.current = null;
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

          // Execute the entire AI plan using the combat execution system
          if (aiPlan.length > 0) {
            // Use the cached session API to ensure state consistency
            if (!sessionApiRef.current) {
              throw new Error('Expected cached session API to be available for AI execution');
            }
            const combatantHook = sessionApiRef.current.getCombatantApi(state.currentActorId);

            const intentExecutor = deps.createIntentExecutionApi(
              state.initialContext,
              combatState.session,
              combatantHook
            );

            const actionEvents = intentExecutor.executeActions(aiPlan, `ai-plan-${state.currentActorId}`);

            // Check if turn should advance after AI actions (critical for dead combatant skipping!)
            const turnAdvancementEvents = intentExecutor.checkAndAdvanceTurn(`ai-turn-advance-${state.currentActorId}`);

            // Combine all events
            const allEvents = [...actionEvents, ...turnAdvancementEvents];

            // Add events to combat log
            handleLogEvents(allEvents);

            // CRITICAL: Synchronize React UI state with authoritative combat state
            // This ensures the UI reflects the actual actor HP after combat events
            actions.syncActorsFromContext();

            // Check for turn advancement in all events (including turn advancement events)
            const turnStartEvent = allEvents.find(event => event.type === EventType.COMBAT_TURN_DID_START);
            if (turnStartEvent && turnStartEvent.actor !== state.currentActorId) {
              actions.handleTurnAdvance(turnStartEvent.actor!);
            }

            // Check if the current actor died during their own actions - if so, force turn advancement
            const currentActorDied = allEvents.some((event: any) =>
              event.type === EventType.COMBATANT_DID_DIE && event.actor === state.currentActorId
            );
            if (currentActorDied && !turnStartEvent) {
              // Force turn advancement by calling the session API directly
              if (sessionApiRef.current) {
                const advancementEvents = sessionApiRef.current.advanceTurn(`force-advance-${state.currentActorId}`);
                handleLogEvents(advancementEvents);

                // Check for new turn start event
                const newTurnStartEvent = advancementEvents.find((event: any) => event.type === EventType.COMBAT_TURN_DID_START);
                if (newTurnStartEvent) {
                  actions.handleTurnAdvance(newTurnStartEvent.actor!);
                }
              }
            }
          }
        }

        // Clear AI thinking state and execution tracking after execution
        actions.setAiThinking(null);
        aiExecutingRef.current = null;
        aiTimerRef.current = null;
      }, 1000); // 1 second delay for better UX

      // Store timer reference for potential cancellation
      aiTimerRef.current = aiExecutionTimer;

      // Cleanup timer on unmount or dependency change
      return () => {
        if (aiTimerRef.current) {
          clearTimeout(aiTimerRef.current);
          aiTimerRef.current = null;
        }
        actions.setAiThinking(null);
        aiExecutingRef.current = null;
      };
    }, [state.currentActorId, state.aiControlled, isInSetupPhase, isPaused, actions, handleCommand, combatState.session, state.initialContext]);

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

    // For setup phase, organize actors by team
    const getActiveActorsByTeam = () => {
      if (!isInSetupPhase || !state.initialContext) return { alpha: [], bravo: [] };

      const activeActors = Object.keys(state.initialContext.world.actors);
      const alpha = activeActors.filter(actorId =>
        actorId === ALICE_ID || actorId === 'flux:actor:charlie' || actorId === 'flux:actor:eric'
      );
      const bravo = activeActors.filter(actorId =>
        actorId === BOB_ID || actorId === 'flux:actor:dave' || actorId === 'flux:actor:franz'
      );

      return { alpha, bravo };
    };

    const { alpha: alphaActors, bravo: bravoActors } = getActiveActorsByTeam();

    return (
      <div className="combat-sandbox-tool h-full flex flex-col" style={{ backgroundColor: '#1d2021' }}>
        {/* Header with phase info */}
        <div className="px-6 py-4" style={{ backgroundColor: '#32302f', borderBottom: '1px solid #504945' }}>
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold" style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}>Combat Sandbox</h1>
            <div className="flex items-center gap-4">
              {/* Pause/Resume Controls */}
              {!isInSetupPhase && (
                <div className="flex gap-2">
                  {isRunning && (
                    <button
                      onClick={handlePause}
                      className="px-3 py-2 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors flex items-center gap-1"
                      style={{ fontFamily: 'Zilla Slab' }}
                      title="Pause combat"
                    >
                      ⏸️ Pause
                    </button>
                  )}
                  {isPaused && (
                    <button
                      onClick={handleResume}
                      className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                      style={{ fontFamily: 'Zilla Slab' }}
                      title="Resume combat"
                    >
                      ▶️ Resume
                    </button>
                  )}
                </div>
              )}
              {/* Status Text */}
              <div className="text-sm" style={{ color: '#a89984', fontFamily: 'Zilla Slab' }}>
                {isInSetupPhase ? (
                  'Setup Phase - Customize actors before combat'
                ) : isPaused ? (
                  <span className="text-yellow-400 font-medium">⏸️ PAUSED</span>
                ) : (
                  `Turn ${combatState.session?.data.rounds.current.number} - ${state.actors[state.currentActorId!]?.name || 'Unknown'} (${currentCombatant?.ap.eff.cur.toFixed(1) || 0} AP remaining)`
                )}
              </div>
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
              <div className="space-y-6">
                {/* Team ALPHA Section */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-medium" style={{ color: '#83a598', fontFamily: 'Zilla Slab' }}>
                      Team ALPHA
                    </h3>
                    <div className="flex gap-1">
                      {!alphaActors.includes('flux:actor:charlie') && (
                        <button
                          onClick={() => actions.addCombatant('charlie')}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          style={{ fontFamily: 'Zilla Slab' }}
                          title="Add Charlie to Team ALPHA"
                        >
                          + Charlie
                        </button>
                      )}
                      {!alphaActors.includes('flux:actor:eric') && (
                        <button
                          onClick={() => actions.addCombatant('eric')}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          style={{ fontFamily: 'Zilla Slab' }}
                          title="Add Eric to Team ALPHA"
                        >
                          + Eric
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {alphaActors.map(actorId => (
                      <CombatantForm
                        key={actorId}
                        actor={state.actors[actorId]}
                        team={Team.ALPHA}
                        availableWeapons={state.availableWeapons}
                        currentWeaponUrn={state.getActorWeapon(actorId as ActorURN)}
                        onWeaponChange={actions.updateActorWeapon}
                        skillValues={state.getActorSkills(actorId as ActorURN)}
                        onSkillChange={actions.updateActorSkill}
                        onStatChange={actions.updateActorStat}
                        isAiControlled={state.aiControlled[actorId as ActorURN] || false}
                        onAiToggle={actions.handleAiToggle}
                        isAiThinking={state.aiThinking === actorId}
                        showRemoveButton={actorId !== ALICE_ID}
                        onRemove={actorId !== ALICE_ID ? () => {
                          const name = actorId === 'flux:actor:charlie' ? 'charlie' : 'eric';
                          actions.removeCombatant(name);
                        } : undefined}
                      />
                    ))}
                  </div>
                </div>

                {/* Team BRAVO Section */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-medium" style={{ color: '#fb4934', fontFamily: 'Zilla Slab' }}>
                      Team BRAVO
                    </h3>
                    <div className="flex gap-1">
                      {!bravoActors.includes('flux:actor:dave') && (
                        <button
                          onClick={() => actions.addCombatant('dave')}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          style={{ fontFamily: 'Zilla Slab' }}
                          title="Add Dave to Team BRAVO"
                        >
                          + Dave
                        </button>
                      )}
                      {!bravoActors.includes('flux:actor:franz') && (
                        <button
                          onClick={() => actions.addCombatant('franz')}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          style={{ fontFamily: 'Zilla Slab' }}
                          title="Add Franz to Team BRAVO"
                        >
                          + Franz
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {bravoActors.map(actorId => (
                      <CombatantForm
                        key={actorId}
                        actor={state.actors[actorId]}
                        team={Team.BRAVO}
                        availableWeapons={state.availableWeapons}
                        currentWeaponUrn={state.getActorWeapon(actorId as ActorURN)}
                        onWeaponChange={actions.updateActorWeapon}
                        skillValues={state.getActorSkills(actorId as ActorURN)}
                        onSkillChange={actions.updateActorSkill}
                        onStatChange={actions.updateActorStat}
                        isAiControlled={state.aiControlled[actorId as ActorURN] || false}
                        onAiToggle={actions.handleAiToggle}
                        isAiThinking={state.aiThinking === actorId}
                        showRemoveButton={actorId !== BOB_ID}
                        onRemove={actorId !== BOB_ID ? () => {
                          const name = actorId === 'flux:actor:dave' ? 'dave' : 'franz';
                          actions.removeCombatant(name);
                        } : undefined}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              combatants.map(combatant => {
                const actor = state.actors[combatant.actorId];
                const weaponSchema = state.initialContext?.equipmentApi?.getEquippedWeaponSchema(actor) || null;

                return (
                  <CombatantCard
                    key={combatant.actorId}
                    combatant={combatant}
                    actor={actor}
                    isActive={combatant.actorId === state.currentActorId}
                    isAiControlled={state.aiControlled[combatant.actorId] || false}
                    onAiToggle={actions.handleAiToggle}
                    isAiThinking={state.aiThinking === combatant.actorId}
                    weaponSchema={weaponSchema}
                  />
                );
              })
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
