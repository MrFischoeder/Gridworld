// (0.245, the owner's rule) A dead character's body lies where they fell for one game day with everything they carried
// (their backpack, hands, back, clothes, attachments and gold) in it; anyone may search it. Then it is gone with what
// is left. Pure: the state is the shared `Char.bodies` and the body's container `Char.containers[id]`.
import type { Container, Slot } from '../save';

export interface Body {
  id: string;
  /** Who it was. */
  n: string;
  /** Where they fell (feet), the way they lay, and the place (`myLoc`: 'o' the surface, 'd:<dungeon key>' below). */
  x: number; y: number; z: number; yaw: number; loc: string;
  /** Game minute of the death. */
  t: number;
}
export const BODY = { life: 1440, reach: 2.2, slots: 48 };

export const bodyId = (pid: string | number, t: number) => `body:${pid}:${Math.round(t)}`;
/** Still lying there at game minute `now`. */
export const bodyLasts = (b: Body, now: number) => now < b.t + BODY.life;
/** Game minutes until it is gone. */
export const bodyLeft = (b: Body, now: number) => Math.max(0, b.t + BODY.life - now);
/** The body's container: every slot the character carried, stacked as they were, and their gold. */
export function bodyBox(kit: Slot[], gold: number): Container {
  const items: (Slot | null)[] = kit.map((s) => ({ ...s }));
  while (items.length < BODY.slots) items.push(null);
  return { items, gold };
}
/** The bodies gone by `now` (their ids). */
export const expiredBodies = (bodies: Record<string, Body>, now: number) => Object.values(bodies).filter((b) => !bodyLasts(b, now)).map((b) => b.id);
