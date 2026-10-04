// One route for incoming combat damage. Vehicle owners absorb hits for every occupied seat.
import { G } from '../game';
import { proxied } from './remote';
let armourDamage = (damage: number) => damage;
let occupied = () => false;
let absorb = (_damage: number) => {};
export function setVehicleProtection(hasSeat: () => boolean, takeHit: (damage: number) => void, armour?: (damage: number) => number) { occupied = hasSeat; absorb = takeHit; if (armour) armourDamage = armour; }
export const insideVehicle = () => !proxied() && occupied();
export const hitOccupiedVehicle = (damage: number) => { if (damage > 0) absorb(damage); };
export function hurtPlayer(damage: number, armour = true, flash = .35) {
  if (!Number.isFinite(damage) || damage <= 0) return false;
  if (insideVehicle()) { hitOccupiedVehicle(damage); return true; }
  G.hp -= armour ? armourDamage(damage) : damage;
  G.dmgFlash = Math.max(G.dmgFlash, flash);
  return false;
}
/** Natural hazards cannot harm an occupant or wear down a vehicle. */
export function environmentalDamage(damage: number, flash = 0) {
  if (insideVehicle() || damage <= 0) return;
  G.hp -= damage; G.dmgFlash = Math.max(G.dmgFlash, flash);
}
