import type { WeaponSchema, WeaponSchemaURN } from '@flux';

export type WeaponMap = Map<WeaponSchemaURN, WeaponSchema>;

// Re-export components
export { WeaponDisplay } from './components/WeaponDisplay';
