import { useCallback, useMemo } from 'react';
import {
  useIntentExecution,
  ActionExecutionError,
  useCombatant,
  type IntentExecutor,
  type ActorURN,
  type CombatContext,
  type CombatSession,
  type WorldEvent,
  EventType
} from '@flux';

interface UseIntentBasedCombatProps {
  context: CombatContext | null;
  session: CombatSession | null;
  currentActorId: ActorURN | null;
  onLogEvents: (events: WorldEvent[]) => void;
  onTurnAdvance?: (newActorId: ActorURN) => void;
}

export function useIntentBasedCombat({
  context,
  session,
  currentActorId,
  onLogEvents,
  onTurnAdvance
}: UseIntentBasedCombatProps) {
  const { location } = session?.data ?? {};

  // Create the intent executor when we have all required dependencies
  const intentExecutor = useMemo((): IntentExecutor & { checkAndAdvanceTurn: () => WorldEvent[] } | null => {
    if (!context || !session || !currentActorId) {
      return null;
    }
    return useIntentExecution(context, session, currentActorId);

  }, [context, session, currentActorId, location, onLogEvents]);

  const executeCommand = useCallback((commandText: string) => {
    if (!intentExecutor) {
      const errorEvent: WorldEvent = {
        id: `error-${Date.now()}`,
        type: 'SYSTEM_ERROR' as any,
        ts: Date.now(),
        actor: currentActorId || 'flux:actor:unknown',
        location: location || 'flux:place:unknown',
        trace: 'command-execution',
        payload: { message: 'No active combat session or intent executor available' }
      };
      onLogEvents([errorEvent]);
      return;
    }

    try {
      // Execute the natural language intent
      const events = intentExecutor.executeIntent(commandText);

      if (events.length > 0) {
        onLogEvents(events);

        // Check for turn advancement events
        const turnStartEvent = events.find(event => event.type === EventType.COMBAT_TURN_DID_START);
        if (turnStartEvent && onTurnAdvance && turnStartEvent.actor !== currentActorId) {
          onTurnAdvance(turnStartEvent.actor!);
        }
      }

      // After executing the command, check if we need to automatically advance the turn
      const turnAdvanceEvents = intentExecutor.checkAndAdvanceTurn();
      if (turnAdvanceEvents.length > 0) {
        onLogEvents(turnAdvanceEvents);

        // Check for turn advancement in the auto-advance events
        const autoTurnStartEvent = turnAdvanceEvents.find(event => event.type === EventType.COMBAT_TURN_DID_START);
        if (autoTurnStartEvent && onTurnAdvance && autoTurnStartEvent.actor !== currentActorId) {
          onTurnAdvance(autoTurnStartEvent.actor!);
        }
      }

    } catch (error) {
      // Create error log entry for command execution errors
      let errorMessage = 'Unknown error';
      let suggestions: string[] = [];

      if (error instanceof ActionExecutionError) {
        errorMessage = error.message;
        // Add contextual suggestions based on the error
        if (error.message.includes('Unknown target')) {
          suggestions.push('Try: "target alice" or "target bob"');
        } else if (error.message.includes('Insufficient AP')) {
          suggestions.push('Try: "defend" to end your turn');
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        // Add general suggestions for parsing errors
        if (error.message.includes('Unknown command') || error.message.includes('Could not parse')) {
          suggestions.push('Try: "attack bob", "move closer to alice", "defend myself"');
        }
      }

      const errorEvent: WorldEvent = {
        id: `error-${Date.now()}`,
        type: 'COMBAT_ERROR' as any,
        ts: Date.now(),
        actor: currentActorId!,
        location: session?.data?.location || 'flux:place:unknown',
        trace: 'intent-execution',
        payload: {
          command: commandText,
          error: errorMessage,
          message: `Error: ${errorMessage}`,
          suggestions: suggestions.length > 0 ? suggestions : undefined
        }
      };

      onLogEvents([errorEvent]);
    }
  }, [intentExecutor, currentActorId, location, onLogEvents, onTurnAdvance, session?.data?.location]);

  const getAvailableCommands = useCallback((): string[] => {
    if (!context || !session || !currentActorId) return [];

    try {
      // Get AI-powered command suggestions from the combatant hook
      const actor = context.world.actors[currentActorId];
      if (!actor) return [];

      const combatantHook = useCombatant(context, session, actor);
      const commandTypes = combatantHook.getAvailableCommands();

      // Convert CommandType enum values to natural language suggestions
      const naturalLanguageCommands: string[] = [];

      for (const commandType of commandTypes) {
        switch (commandType) {
          case 'TARGET':
            naturalLanguageCommands.push('target <actor>', 'target alice', 'target bob');
            break;
          case 'ATTACK':
            naturalLanguageCommands.push('attack', 'attack <target>', 'strike');
            break;
          case 'DEFEND':
            naturalLanguageCommands.push('defend', 'defend myself', 'end turn');
            break;
          case 'MOVE':
            naturalLanguageCommands.push('move closer', 'advance', 'move forward', 'back away', 'retreat', 'move back');
            break;
          case 'STRIKE':
            naturalLanguageCommands.push('strike', 'strike <target>');
            break;
        }
      }

      // Remove duplicates and return
      return Array.from(new Set(naturalLanguageCommands));
    } catch (error) {
      // Fallback to basic commands if AI analysis fails
      return ['target <actor>', 'attack', 'defend', 'move closer', 'back away'];
    }
  }, [context, session, currentActorId]);

  const getCurrentCombatant = useCallback(() => {
    if (!currentActorId || !session) return null;
    return session.data?.combatants?.get(currentActorId) || null;
  }, [currentActorId, session]);

  // Note: endTurn is no longer needed as turn advancement is automatic
  // We keep it for backward compatibility but it just executes a defend command
  const endTurn = useCallback(() => {
    executeCommand('defend myself');
  }, [executeCommand]);

  return {
    executeCommand,
    getAvailableCommands,
    getCurrentCombatant,
    endTurn, // Kept for backward compatibility
  };
}
