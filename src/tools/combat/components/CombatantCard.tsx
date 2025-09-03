interface CombatantCardProps {
  combatant: any;
  actor: any;
  isActive?: boolean;
}

export function CombatantCard({ combatant, actor, isActive = false }: CombatantCardProps) {
  const teamColor = combatant.team === 'team-red' ? 'red' : 'blue';
  const teamColorClasses = {
    red: {
      border: 'border-red-500',
      text: 'text-red-600',
      bg: 'bg-red-50'
    },
    blue: {
      border: 'border-blue-500',
      text: 'text-blue-600',
      bg: 'bg-blue-50'
    }
  };

  const colors = teamColorClasses[teamColor];

  // Calculate percentages for progress bars
  const apPercent = (combatant.ap.eff.cur / combatant.ap.eff.max) * 100;
  const energyPercent = (combatant.energy.eff.cur / combatant.energy.eff.max) * 100;

  // Get actor name from ID
  const actorName = actor?.name || combatant.actorId.split(':').pop() || 'Unknown';
  const teamName = combatant.team === 'team-red' ? 'Red Team' : 'Blue Team';

  return (
    <div className={`
      bg-white border-2 rounded-lg p-4 mb-4 transition-all
      ${isActive ? `${colors.border} ${colors.bg}` : 'border-gray-200'}
    `}>
      {/* Header */}
      <div className="mb-3">
        <h3 className={`font-semibold text-lg ${colors.text}`}>
          {actorName}
        </h3>
        <p className="text-sm text-gray-600">
          {teamName}{isActive ? ' - Active Turn' : ''}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="text-center">
          <div className="font-medium text-gray-700">POW</div>
          <div className="text-lg font-bold">{actor?.stats?.pow?.eff || 50}</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-gray-700">FIN</div>
          <div className="text-lg font-bold">{actor?.stats?.fin?.eff || 50}</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-gray-700">RES</div>
          <div className="text-lg font-bold">{actor?.stats?.res?.eff || 50}</div>
        </div>
      </div>

      {/* Action Points */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">Action Points</span>
          <span className="text-xs text-gray-500">
            {combatant.ap.eff.cur.toFixed(1)}/{combatant.ap.eff.max.toFixed(1)}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-red-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${apPercent}%` }}
          />
        </div>
      </div>

      {/* Energy */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">Energy</span>
          <span className="text-xs text-gray-500">
            {combatant.energy.eff.cur}/{combatant.energy.eff.max}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${energyPercent}%` }}
          />
        </div>
      </div>

      {/* Position & Status */}
      <div className="text-xs text-gray-600 space-y-1">
        <div>
          <span className="font-medium">Position:</span> {combatant.position.coordinate}m
        </div>
        <div>
          <span className="font-medium">Facing:</span> {combatant.position.facing === 'RIGHT' ? 'Right →' : 'Left ←'}
        </div>
        <div>
          <span className="font-medium">Velocity:</span> {combatant.position.velocity.toFixed(1)} m/s
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
