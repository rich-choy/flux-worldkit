import type { Actor, ActorURN, SkillURN, WeaponSchemaURN } from '@flux';
import { Team, ActorStat, MIN_SKILL_RANK, MAX_SKILL_RANK } from '@flux';
import type { WeaponMap } from '../types';

interface CombatantFormProps {
  actor: Actor;
  team: Team;
  // Weapon props
  availableWeapons: WeaponMap;
  currentWeaponUrn: WeaponSchemaURN;
  onWeaponChange: (actorId: ActorURN, weaponUrn: WeaponSchemaURN) => void;
  // Skill props
  skillValues: Record<SkillURN, number>;
  onSkillChange: (actorId: ActorURN, skillUrn: SkillURN, rank: number) => void;
  // Stat editing props
  onStatChange: (actorId: ActorURN, stat: ActorStat, value: number) => void;
  // AI control props
  isAiControlled: boolean;
  onAiToggle: (actorId: ActorURN, enabled: boolean) => void;
  isAiThinking: boolean;
  // Remove button props
  showRemoveButton?: boolean;
  onRemove?: () => void;
}

export function CombatantForm({
  actor,
  team,
  availableWeapons,
  currentWeaponUrn,
  onWeaponChange,
  skillValues,
  onSkillChange,
  onStatChange,
  isAiControlled,
  onAiToggle,
  isAiThinking,
  showRemoveButton = false,
  onRemove
}: CombatantFormProps) {
  const teamColor = team === Team.BRAVO ? 'red' : 'blue';
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
  const actorName = actor?.name || actor?.id?.split(':').pop() || 'Unknown';
  const teamName = team === Team.BRAVO ? 'Red Team' : 'Blue Team';

  // Handle stat changes
  const handleStatChange = (stat: ActorStat) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && actor?.id) {
      onStatChange(actor.id as ActorURN, stat, value);
    }
  };

  // Handle AI toggle
  const handleAiToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (actor?.id) {
      onAiToggle(actor.id as ActorURN, e.target.checked);
    }
  };

  // Handle weapon change
  const handleWeaponChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (actor?.id) {
      onWeaponChange(actor.id as ActorURN, e.target.value as WeaponSchemaURN);
    }
  };

  // Handle skill change
  const handleSkillChange = (skillUrn: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && actor?.id) {
      onSkillChange(actor.id as ActorURN, skillUrn as SkillURN, value);
    }
  };

  // Get HP values
  const currentHp = actor.hp.eff.cur;
  const maxHp = actor.hp.eff.max;
  const healthPercentage = maxHp > 0 ? currentHp / maxHp : 0;

  // Generate weapon options using zero-copy iteration
  const weaponOptions = [];
  for (const [urn, schema] of availableWeapons) {
    weaponOptions.push(
      <option key={urn} value={urn}>
        {schema.name}
      </option>
    );
  }

  return (
    <div
      className="rounded-lg p-4 mb-4 transition-all"
      style={{
        backgroundColor: '#282828',
        border: `2px solid #504945`,
        fontFamily: 'Zilla Slab'
      }}
    >
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg" style={{ color: colors.text }}>
              {actorName}
            </h3>
            <p className="text-sm" style={{ color: '#a89984' }}>
              {teamName}
            </p>
          </div>

          {/* AI Control and Remove Button */}
          <div className="flex items-center space-x-2">
            <label
              className="flex items-center space-x-2 cursor-pointer"
              style={{ fontFamily: 'Zilla Slab' }}
            >
              <input
                type="checkbox"
                checked={isAiControlled}
                onChange={handleAiToggle}
                className="w-4 h-4 rounded border-2 focus:ring-2 focus:ring-offset-0 transition-colors"
                style={{
                  accentColor: colors.border,
                  borderColor: '#504945'
                }}
              />
              <span
                className="text-sm font-medium select-none"
                style={{
                  color: isAiControlled ? colors.text : '#a89984'
                }}
              >
                {isAiThinking ? 'AI Thinking...' : 'AI'}
              </span>
            </label>
            {showRemoveButton && onRemove && (
              <button
                onClick={onRemove}
                className="ml-2 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                style={{ fontFamily: 'Zilla Slab' }}
                title={`Remove ${actorName}`}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="text-center">
          <div className="font-medium" style={{ color: '#ebdbb2' }}>POW</div>
          <input
            type="number"
            value={actor?.stats?.pow?.eff || 10}
            onChange={handleStatChange(ActorStat.POW)}
            min="1"
            max="100"
            className="w-full text-lg font-bold text-center bg-transparent border border-gray-600 rounded px-1 py-0.5 focus:border-blue-400 focus:outline-none"
            style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}
          />
        </div>
        <div className="text-center">
          <div className="font-medium" style={{ color: '#ebdbb2' }}>FIN</div>
          <input
            type="number"
            value={actor?.stats?.fin?.eff || 10}
            onChange={handleStatChange(ActorStat.FIN)}
            min="1"
            max="100"
            className="w-full text-lg font-bold text-center bg-transparent border border-gray-600 rounded px-1 py-0.5 focus:border-blue-400 focus:outline-none"
            style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}
          />
        </div>
        <div className="text-center">
          <div className="font-medium" style={{ color: '#ebdbb2' }}>RES</div>
          <input
            type="number"
            value={actor?.stats?.res?.eff || 10}
            onChange={handleStatChange(ActorStat.RES)}
            min="1"
            max="100"
            className="w-full text-lg font-bold text-center bg-transparent border border-gray-600 rounded px-1 py-0.5 focus:border-blue-400 focus:outline-none"
            style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}
          />
        </div>
      </div>

      {/* Hit Points */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium" style={{ color: '#ebdbb2' }}>Hit Points</span>
          <span className="text-xs" style={{ color: '#a89984' }}>
            {currentHp}/{maxHp} HP
          </span>
        </div>
        <div className="w-full rounded-full h-2" style={{ backgroundColor: '#504945' }}>
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(healthPercentage * 100)}%`,
              backgroundColor: healthPercentage > 0.5 ? '#8ec07c' : healthPercentage > 0.25 ? '#fabd2f' : '#fb4934'
            }}
          />
        </div>
      </div>

      {/* Weapon Selection */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium" style={{ color: '#ebdbb2' }}>Weapon</span>
        </div>
        <select
          value={currentWeaponUrn}
          onChange={handleWeaponChange}
          className="w-full text-sm bg-transparent border border-gray-600 rounded px-2 py-1 focus:border-blue-400 focus:outline-none"
          style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab', backgroundColor: '#1d2021' }}
        >
          {weaponOptions}
        </select>
      </div>

      {/* Skills Section */}
      <div className="mb-3">
        <div className="mb-2">
          <span className="text-sm font-medium" style={{ color: '#ebdbb2' }}>Skills</span>
        </div>

        {/* Evasion Skill */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="text-center">
            <div className="font-medium text-xs mb-1" style={{ color: '#ebdbb2' }}>Evasion</div>
            <input
              type="number"
              value={skillValues['flux:skill:evasion'] || 0}
              onChange={handleSkillChange('flux:skill:evasion')}
              min={MIN_SKILL_RANK}
              max={MAX_SKILL_RANK}
              className="w-full text-sm font-bold text-center bg-transparent border border-gray-600 rounded px-1 py-0.5 focus:border-blue-400 focus:outline-none"
              style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}
            />
          </div>

          {/* Melee Weapon Skill */}
          <div className="text-center">
            <div className="font-medium text-xs mb-1" style={{ color: '#ebdbb2' }}>Melee Weapon</div>
            <input
              type="number"
              value={skillValues['flux:skill:weapon:melee'] || 0}
              onChange={handleSkillChange('flux:skill:weapon:melee')}
              min={MIN_SKILL_RANK}
              max={MAX_SKILL_RANK}
              className="w-full text-sm font-bold text-center bg-transparent border border-gray-600 rounded px-1 py-0.5 focus:border-blue-400 focus:outline-none"
              style={{ color: '#ebdbb2', fontFamily: 'Zilla Slab' }}
            />
          </div>
        </div>
      </div>

      {/* Setup Info */}
      <div className="text-xs space-y-1" style={{ color: '#a89984' }}>
        <div>
          <span className="font-medium">Team:</span> {teamName}
        </div>
        <div>
          <span className="font-medium">Status:</span> Ready for combat
        </div>
      </div>
    </div>
  );
}
