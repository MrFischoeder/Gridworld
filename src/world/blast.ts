// (0.194) A machine blowing up: the see-through fireball (world/fx.ts addBlast) and the hurt it does round it.
// Every game that plays a wreck plays its blast; each hurts only its own player and the foes it runs itself (another
// player's foes are hurt by their owner's game, which plays the same blast), so nobody is hit twice.
import * as THREE from 'three';
import { G } from '../game';
import { V } from './render';
import { addBlast } from './fx';
import { hurtPlayer } from './damage';
import { foes, foeRules, damageFoe, type Foe } from './enemies';
import { remoteOf } from './remote';
import { blastShare, BLAST, type BlastSpec } from '../data/robots';
import { setTurretBlast } from './mountedturrets';
import { FOE_HIT } from './threat';

export function machineBlast(at: THREE.Vector3, b: BlastSpec, color: number, groundY = at.y, source?: object) {
  addBlast(at, b.r, color, groundY);
  // you: through armour (or the vehicle you sit in), with a shove away from it
  const eye = V(G.pos.x, G.pos.y + 1, G.pos.z), d = eye.distanceTo(at), k = blastShare(d, b.r);
  if (k > 0 && !foeRules.playerSafe()) {
    if (!hurtPlayer(b.hurt * k * FOE_HIT, true, .5)) {
      const dx = G.pos.x - at.x, dz = G.pos.z - at.z, L = Math.hypot(dx, dz) || 1;
      G.vel.x += dx / L * 4 * k; G.vel.z += dz / L * 4 * k; G.vel.y += 2.5 * k;
    }
  }
  // the foes standing by (copies of another player's foes are left to their owner's blast)
  for (const f of foes().slice() as Foe[]) {
    if (f === source || remoteOf(f) || f.hp <= 0) continue;
    const p = f.g.position, e = Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z) - (f.r || 0.6) * 0.5, s = blastShare(e, b.r);
    if (s > 0) damageFoe(f, b.foe * s, false);
  }
}

setTurretBlast((at, t) => machineBlast(at, BLAST.turret, 0xff8a3a, at.y, t));
