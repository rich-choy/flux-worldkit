import type { WeaponSchema } from '@flux';

interface WeaponDisplayProps {
  weaponSchema: WeaponSchema | null | undefined;
  className?: string;
}

export function WeaponDisplay({ weaponSchema, className = "" }: WeaponDisplayProps) {
  if (!weaponSchema) {
    return (
      <div className={`mb-3 p-2 rounded text-center ${className}`} style={{ backgroundColor: '#3c3836', border: '1px solid #504945' }}>
        <div className="text-sm" style={{ color: '#a89984' }}>
          No weapon equipped
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-3 p-2 rounded ${className}`} style={{ backgroundColor: '#3c3836', border: '1px solid #504945' }}>
      <div className="text-sm font-medium mb-1" style={{ color: '#ebdbb2' }}>
        ⚔️ {weaponSchema.name}
      </div>
      <div className="text-xs space-y-1" style={{ color: '#a89984' }}>
        <div>
          <span className="font-medium">Range:</span> {weaponSchema.range.optimal}m optimal
          {weaponSchema.range.max && weaponSchema.range.max !== weaponSchema.range.optimal && (
            <span>, {weaponSchema.range.max}m max</span>
          )}
        </div>
        {weaponSchema.damage && (
          <div>
            <span className="font-medium">Damage:</span> {weaponSchema.damage.dice}
            {weaponSchema.damage.types && Object.keys(weaponSchema.damage.types).length > 0 && (
              <span> ({Object.keys(weaponSchema.damage.types).join(', ')})</span>
            )}
          </div>
        )}
        <div className="text-xs opacity-75">
          {weaponSchema.urn}
        </div>
      </div>
    </div>
  );
}
