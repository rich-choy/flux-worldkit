import type { Actor, Combatant } from '@flux';
import { CombatFacing, Team } from '@flux';

interface CombatantCardProps {
  combatant: Combatant;
  actor: Actor;
  isActive?: boolean;
}

function formatJoules(energy: number) {
  return Math.floor(energy);
}

export function CombatantCard({ combatant, actor, isActive = false }: CombatantCardProps) {
  const teamColor = combatant.team === Team.RED ? 'red' : 'blue';
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

  // Calculate percentages for progress bars
  const apPercent = (combatant.ap.eff.cur / combatant.ap.eff.max) * 100;
  const energyPercent = (combatant.energy.eff.cur / combatant.energy.eff.max) * 100;

  // Get actor name from ID
  const actorName = actor?.name || combatant.actorId.split(':').pop() || 'Unknown';
  const teamName = combatant.team === Team.RED ? 'Red Team' : 'Blue Team';

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
          <div className="text-lg font-bold" style={{ color: '#ebdbb2' }}>{actor?.stats?.pow?.eff || 50}</div>
        </div>
        <div className="text-center">
          <div className="font-medium" style={{ color: '#ebdbb2' }}>FIN</div>
          <div className="text-lg font-bold" style={{ color: '#ebdbb2' }}>{actor?.stats?.fin?.eff || 50}</div>
        </div>
        <div className="text-center">
          <div className="font-medium" style={{ color: '#ebdbb2' }}>RES</div>
          <div className="text-lg font-bold" style={{ color: '#ebdbb2' }}>{actor?.stats?.res?.eff || 50}</div>
        </div>
      </div>

      {/* Action Points */}
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

      {/* Energy */}
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

      {/* Position & Status */}
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
    </div>
  );
}
