import type { Actor, Combatant, ActorURN } from '@flux';
import { CombatFacing, Team, ActorStat } from '@flux';

interface CombatantCardProps {
  combatant?: Combatant | null;
  actor: Actor;
  isActive?: boolean;
  // Setup phase props
  team?: Team;
  isEditable?: boolean;
  onStatChange?: (actorId: ActorURN, stat: ActorStat, value: number) => void;
}

function formatJoules(energy: number) {
  return Math.floor(energy);
}

export function CombatantCard({
  combatant,
  actor,
  isActive = false,
  team,
  isEditable = false,
  onStatChange
}: CombatantCardProps) {
  // Use team from combatant if available, otherwise use passed team prop
  const actualTeam = combatant?.team || team || Team.BRAVO;
  const teamColor = actualTeam === Team.BRAVO ? 'red' : 'blue';
  const teamColorClasses = {
    red: {
      border: '#fb4934',
      text: '#fb4934',
      bg: '#3c3836'
    },
    blue: {
      border: '#83a598',
      text: '#83a598',
      bg: '#3c3836'
    }
  };

  const colors = teamColorClasses[teamColor];

  // Calculate percentages for progress bars (only for active combat)
  const apPercent = combatant ? (combatant.ap.eff.cur / combatant.ap.eff.max) * 100 : 0;
  const energyPercent = combatant ? (combatant.energy.eff.cur / combatant.energy.eff.max) * 100 : 0;

  // Get actor name from ID
  const actorName = actor?.name || (combatant?.actorId || actor?.id)?.split(':').pop() || 'Unknown';
  const teamName = actualTeam === Team.BRAVO ? 'Red Team' : 'Blue Team';

  // Handle stat changes during setup
  const handleStatChange = (stat: ActorStat) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && onStatChange && actor?.id) {
      onStatChange(actor.id as ActorURN, stat, value);
    }
  };


  return (
    <div
      className="rounded-lg p-4 mb-4 transition-all"
      style={{
        backgroundColor: isActive ? colors.bg : '#282828',
        border: `2px solid ${isActive ? colors.border : '#504945'}`,
        fontFamily: 'Zilla Slab'
      }}
    >
      {/* Header */}
      <div className="mb-3">
        <h3 className="font-semibold text-lg" style={{ color: colors.text }}>
          {actorName}
        </h3>
        <p className="text-sm" style={{ color: '#a89984' }}>
          {teamName}{isActive ? ' - Active Turn' : ''}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="text-center">
          <div className="font-medium" style={{ color: '#ebdbb2' }}>POW</div>
          {isEditable ? (
            <input
              type="number"
              value={actor?.stats?.pow?.eff || 10 }
              onChange={handleStatChange(ActorStat.POW)}
              min="1"
              max="100"
              className="w-full text-lg font-bold text-center bg-transparent border border-gray-600 rounded px-1 py-0.5 focus:border-blue-400 focus:outline-none"
              style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}
            />
          ) : (
            <div className="text-lg font-bold" style={{ color: '#ebdbb2' }}>{actor?.stats?.pow?.eff || 50}</div>
          )}
        </div>
        <div className="text-center">
          <div className="font-medium" style={{ color: '#ebdbb2' }}>FIN</div>
          {isEditable ? (
            <input
              type="number"
              value={actor?.stats?.fin?.eff || 10}
              onChange={handleStatChange(ActorStat.FIN)}
              min="1"
              max="100"
              className="w-full text-lg font-bold text-center bg-transparent border border-gray-600 rounded px-1 py-0.5 focus:border-blue-400 focus:outline-none"
              style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}
            />
          ) : (
            <div className="text-lg font-bold" style={{ color: '#ebdbb2' }}>{actor?.stats?.fin?.eff || 50}</div>
          )}
        </div>
        <div className="text-center">
          <div className="font-medium" style={{ color: '#ebdbb2' }}>RES</div>
          {isEditable ? (
            <input
              type="number"
              value={actor?.stats?.res?.eff || 10}
              onChange={handleStatChange(ActorStat.RES)}
              min="1"
              max="100"
              className="w-full text-lg font-bold text-center bg-transparent border border-gray-600 rounded px-1 py-0.5 focus:border-blue-400 focus:outline-none"
              style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}
            />
          ) : (
            <div className="text-lg font-bold" style={{ color: '#ebdbb2' }}>{actor?.stats?.res?.eff || 50}</div>
          )}
        </div>
      </div>

      {/* Action Points - only show during active combat */}
      {combatant && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium" style={{ color: '#ebdbb2' }}>Action Points</span>
            <span className="text-xs" style={{ color: '#a89984' }}>
              {combatant.ap.eff.cur.toFixed(1)}/{combatant.ap.eff.max.toFixed(1)} AP
            </span>
          </div>
          <div className="w-full rounded-full h-2" style={{ backgroundColor: '#504945' }}>
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${apPercent}%`,
                backgroundColor: '#fb4934'
              }}
            />
          </div>
        </div>
      )}

      {/* Energy - only show during active combat */}
      {combatant && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium" style={{ color: '#ebdbb2' }}>Energy</span>
            <span className="text-xs" style={{ color: '#a89984' }}>
              {formatJoules(combatant.energy.eff.cur)}/{formatJoules(combatant.energy.eff.max)} Joules
            </span>
          </div>
          <div className="w-full rounded-full h-2" style={{ backgroundColor: '#504945' }}>
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${energyPercent}%`,
                backgroundColor: '#8ec07c'
              }}
            />
          </div>
        </div>
      )}

      {/* Position & Status - only show during active combat */}
      {combatant && (
        <div className="text-xs space-y-1" style={{ color: '#a89984' }}>
          <div>
            <span className="font-medium">Position:</span> {combatant.position.coordinate}m
          </div>
          <div>
            <span className="font-medium">Facing:</span> {combatant.position.facing === CombatFacing.RIGHT ? 'Right →' : 'Left ←'}
          </div>
          <div>
            <span className="font-medium">Velocity:</span> {combatant.position.speed.toFixed(1)} m/s
          </div>
          {combatant.target && (
            <div>
              <span className="font-medium">Target:</span> {combatant.target.split(':').pop()}
            </div>
          )}
        </div>
      )}

      {/* Setup phase info */}
      {isEditable && !combatant && (
        <div className="text-xs space-y-1" style={{ color: '#a89984' }}>
          <div>
            <span className="font-medium">Team:</span> {teamName}
          </div>
          <div>
            <span className="font-medium">Status:</span> Ready for combat
          </div>
        </div>
      )}
    </div>
  );
}
