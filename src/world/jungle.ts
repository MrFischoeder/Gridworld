// (0.287, the owner's request) The jungle's thorny lianas at runtime: running into one cuts (more the faster you came)
// and throws you back a little; creeping through slower than THORN.still only scratches. The lianas and the giants
// come from the seed (gen/jungle.ts), so everyone sees the same ones; each game hurts only its own player, nothing is sent.
import { G } from '../game';
import { thornTouch } from './overworld';
import { THORN, thornHurt } from '../gen/jungle';
import { hurtPlayer, insideVehicle } from './damage';
import { foeRules } from './enemies';
import { burst } from './fx';
import { V } from './render';
import { play } from './sound';
import { THORN_C } from './trees';
import { logLine } from '../ui/hud';
import { tl } from '../i18n';

let cool = 0, told = false;
/** Main loop, outdoors: the lianas round you, every frame. */
export function updateThorns(dt: number) {
  cool = Math.max(0, cool - dt);
  if (cool > 0 || G.char.loc !== 'overworld' || G.fly || G.god || insideVehicle() || foeRules.playerSafe()) return;
  const hit = thornTouch(G.pos.x, G.pos.y, G.pos.z, 0.35, THORN.reach);
  if (!hit) return;
  const dx = G.pos.x - hit[0], dz = G.pos.z - hit[1], h = Math.hypot(dx, dz) || 1, into = -(G.vel.x * dx + G.vel.z * dz) / h;
  const dmg = thornHurt(Math.max(0, into, Math.hypot(G.vel.x, G.vel.z) * 0.6));
  if (dmg <= 0) return;
  cool = THORN.cool;
  hurtPlayer(dmg, true, 0.5);
  G.vel.x = dx / h * THORN.push; G.vel.z = dz / h * THORN.push;
  burst(V(G.pos.x - dx / h * 0.3, G.pos.y + 0.9, G.pos.z - dz / h * 0.3), THORN_C, 10, 0.5);
  play('hit', { at: G.pos, vol: 0.55, rate: 1.3, far: 30 });
  if (!told) { told = true; logLine(tl('Thorny lianas tear at you! Creep through them slowly, or go round.')); }
}
