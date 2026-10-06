// Who lives in the dungeon sector, cave or wreck you are in (gen/repopulate.ts): its drones and robot guards stand at
// their own spots, a killed one stays dead, and only when the last one falls does the place start its 7–14 day wait
// before it fills up again. The record is the shared `killed` list of the place (every player sees the same).
import { G, W } from '../game';
import { scene } from './render';
import { makeDrone, placeDroneAt, setDroneRespawn, type Drone } from './enemies';
import { onGuardDown } from './robots';
import { progress, dungeonKey, saveChar } from '../character';
import { DRONE, GUARD, refill, recordKill } from '../gen/repopulate';
import { logLine } from '../ui/hud';

let drones = 0, guards = 0;
/** Fill the place on arrival: `n` drones (minus the dead ones), `g` guards to come (their spawner asks `guardAlive`). */
export function populate(n: number, g: number, seed: number) {
  drones = n; guards = g;
  const killed = progress('killed');
  if (refill(G.char.world, dungeonKey(), killed, G.char.time)) saveChar(); // a week or two has passed: they are back
  for (let i = 0; i < n; i++) if (!killed.includes(DRONE + i)) { const t = makeDrone(); t.idx = i; placeDroneAt(t, i, seed); W.drones.push(t); }
  setDroneRespawn(down);
}
export const guardAlive = (i: number) => !progress('killed').includes(GUARD + i);
function down(t: Drone) {
  scene.remove(t.g); const i = W.drones.indexOf(t); if (i >= 0) W.drones.splice(i, 1); // no respawn: it stays dead
  if (t.idx !== undefined) record(DRONE + t.idx);
}
function record(id: number) {
  if (G.char.loc !== 'dungeon' || !G.char.dungeon) return;
  if (recordKill(progress('killed'), id, drones, guards, G.char.time)) logLine('Nothing stirs here any more. It will be a week or two before anything moves in again.');
  saveChar();
}
onGuardDown((i) => record(GUARD + i));
