// Only player/world changes, never generated geometry. Shared and saved by post id.
import { GARRISON, type Garrison } from './cities';
import { hash } from '../core/rng';
import type { RobotKind } from '../data/robots';
import type { BanditRole } from './camps';
export type GarrisonMember = { type: 'robot'; model: RobotKind } | { type: 'wildlife' } | { type: 'bandit'; role: BanditRole };
export function garrisonRoster(world: number, city: number, g: Garrison): GarrisonMember[] {
  if (g.kind === 'nest') return Array.from({ length: 3 + g.size }, () => ({ type: 'wildlife' }));
  if (g.kind === 'gang') return Array.from({ length: 2 + g.size }, (_, i) => ({ type: 'bandit', role: i === 0 ? 'leader' : i % 2 ? 'gunner' : 'bruiser' }));
  const heavy: RobotKind = (['sentinel', 'assault', 'artillery'] as const)[hash(world, city, g.k, 0x6a80) % 3];
  return [{ type: 'robot', model: 'scout' }, { type: 'robot', model: 'guardian' }, ...(g.size > 1 ? [{ type: 'robot' as const, model: heavy }] : [])];
}
export interface GarrisonState { until: number; hp: Record<string, number> }
export function garrisonReady(s: GarrisonState | undefined, now: number): boolean { return !s || s.until <= 0 || now >= s.until; }
export function recordGarrison(s: GarrisonState, health: Record<string, number>, now: number): void {
  Object.assign(s.hp, health);
  if (Object.keys(s.hp).length && Object.values(s.hp).every(h => h <= 0) && s.until <= 0) s.until = now + GARRISON.respawn;
}
