import { useCallback } from 'react';
import { useCombatant } from '@flux';
import type { ActorURN, CombatContext, CombatSession, WorldEvent } from '@flux';

interface UseCombatActionsProps {
  context: CombatContext;
  session: CombatSession;
  currentActorId: ActorURN | null;
  onLogEvents: (events: WorldEvent[]) => void;
}

export function useCombatActions({
  context,
  session,
  currentActorId,
  onLogEvents
}: UseCombatActionsProps) {

  const executeCommand = useCallback((commandText: string) => {
    if (!context || !session || !currentActorId) {
      const errorEvent: WorldEvent = {
        id: `error-${Date.now()}`,
        type: 'SYSTEM_ERROR' as any,
        ts: Date.now(),
        actor: currentActorId || 'flux:actor:unknown',
        location: session?.data?.location || 'unknown',
        trace: 'command-execution',
        payload: { message: 'No active combat session or actor' }
      };
      onLogEvents([errorEvent]);
      return;
    }

    const [verb, ...args] = commandText.trim().split(' ');
    const combatantHook = useCombatant(context, session, currentActorId, 'ui-command');

    try {
      let events: WorldEvent[] = [];

      switch (verb.toLowerCase()) {
        case 'target':
          if (args[0]) {
            events = combatantHook.target(args[0] as ActorURN);
          } else {
            throw new Error('Target command requires an actor ID');
          }
          break;

        case 'reposition':
          if (args[0]) {
            const position = parseInt(args[0]);
            if (isNaN(position) || position < 0 || position > 300) {
              throw new Error('Position must be a number between 0 and 300');
            }
            events = combatantHook.reposition(position);
          } else {
            throw new Error('Reposition command requires a position (0-300)');
          }
          break;

        case 'attack':
          events = combatantHook.attack();
          break;

        case 'defend':
          events = combatantHook.defend();
          break;

        default:
          throw new Error(`Unknown command: ${verb}. Available: target, reposition, attack, defend`);
      }

      // Pass events directly from combat system
      if (events.length > 0) {
        onLogEvents(events);
      }

    } catch (error) {
      // Create error log entry for command parsing errors
      const errorEvent: WorldEvent = {
        id: `error-${Date.now()}`,
        type: 'COMBAT_ERROR' as any,
        ts: Date.now(),
        actor: currentActorId,
        location: session.data.location,
        trace: 'command-execution',
        payload: {
          command: verb,
          args,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };

      onLogEvents([errorEvent]);
    }
  }, [context, session, currentActorId, onLogEvents]);

  const getAvailableCommands = useCallback(() => {
    if (!currentActorId || !session) return [];

    const combatant = session.data?.combatants?.get(currentActorId);
    if (!combatant) return [];

    const commands = [];

    // Always available commands
    commands.push('target <actor-id>', 'defend');

    // AP-dependent commands
    if (combatant.ap.eff.cur >= 2.0) {
      commands.push('attack');
    }

    if (combatant.ap.eff.cur >= 1.0) {
      commands.push('reposition <0-300>');
    }

    return commands;
  }, [currentActorId, session]);

  const getCurrentCombatant = useCallback(() => {
    if (!currentActorId || !session) return null;
    return session.data?.combatants?.get(currentActorId) || null;
  }, [currentActorId, session]);

  return {
    executeCommand,
    getAvailableCommands,
    getCurrentCombatant,
  };
}
