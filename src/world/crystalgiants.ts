// (0.277, the owner's request) The Crystal Wastes at runtime: the spikes cut whoever walks or runs into them, and each
// stretch of the wastes wakes its Crystal Colossus when a player comes near its lair (gen/crystalspikes.ts).
// Multiplayer: the colossus is a creature like any other, run by the game with `spawnAuthority` and copied to the
// others by world/foesync.ts (its lair id travels as `cityPost`, so nobody wakes a second one); its death is written
// to the shared `camps` map under the lair's id, so it stays dead for everyone until it comes back. The spikes hurt
// only the player who runs into them, on their own game.
import { G, W } from '../game';
import { saveChar } from '../character';
import { OW, danger, spikeTouch } from './overworld';
import { GIANT, SPIKE, giantLairsNear, giantDead, spikeHurt } from '../gen/crystalspikes';
import { spawnColossus, removeCreature, onColossusDown, colossusNear } from './creatures';
import { spawnAuthority, remoteOf, nearestPlayer } from './remote';
import { hurtPlayer, insideVehicle } from './damage';
import { foeRules } from './enemies';
import { burst } from './fx';
import { V } from './render';
import { play } from './sound';
import { logLine } from '../ui/hud';
import { CREATURES } from '../data/creatures';
import { tl } from '../i18n';

onColossusDown((c) => { if (c.cityPost) { G.char.camps[c.cityPost] = Date.now(); saveChar(); } });

let lairT = 0, cut = 0, told = false;
/** Main loop, outdoors: lairs once a second, the spikes every frame. */
export function updateCrystalWastes(dt: number) {
  if (G.char.loc !== 'overworld' || !OW.terrain) return;
  cutBySpikes(dt);
  if ((lairT -= dt) > 0) return;
  lairT = 1;
  for (const L of giantLairsNear(OW.terrain.world, G.pos.x, G.pos.z, GIANT.sleep + 60)) {
    const c = W.creatures.find((k) => k.cityPost === L.id);
    if (c) { // asleep again once everyone has gone (the owner's game decides)
      if (!remoteOf(c) && nearestPlayer(c.p.x, c.p.z) > GIANT.sleep && nearestPlayer(L.x, L.z) > GIANT.sleep) removeCreature(c);
      continue;
    }
    if (giantDead(G.char.camps[L.id], Date.now()) || G.fly) continue;
    if (Math.hypot(G.pos.x - L.x, G.pos.z - L.z) > GIANT.wake || !spawnAuthority()) continue;
    spawnColossus(L.x, L.z, Math.max(2, danger(L.x, L.z)), L.id);
  }
}
/** Pressing into a spike on foot: it cuts (more the faster you came) and throws you back a little. */
function cutBySpikes(dt: number) {
  cut = Math.max(0, cut - dt);
  if (cut > 0 || G.fly || G.god || insideVehicle() || foeRules.playerSafe()) return;
  const hit = spikeTouch(G.pos.x, G.pos.y, G.pos.z, 0.35, SPIKE.reach);
  if (!hit) return;
  const dx = G.pos.x - hit[0], dz = G.pos.z - hit[1], h = Math.hypot(dx, dz) || 1, into = -(G.vel.x * dx + G.vel.z * dz) / h; // speed towards it
  const dmg = spikeHurt(Math.max(0, into, Math.hypot(G.vel.x, G.vel.z) * 0.5));
  if (dmg <= 0) return;
  cut = SPIKE.cool;
  hurtPlayer(dmg, true, 0.5);
  G.vel.x = dx / h * SPIKE.push; G.vel.z = dz / h * SPIKE.push;
  burst(V(G.pos.x - dx / h * 0.4, G.pos.y + 0.8, G.pos.z - dz / h * 0.4), 0xd8b8ff, 10, 0.6);
  play('hit', { at: G.pos, vol: 0.6, rate: 1.6, far: 30 });
  if (!told) { told = true; logLine(tl('The crystal spikes cut! Walk round them, and never run into them.')); }
}
/** The boss bar while a colossus is after someone near you (its name and health), or null. */
export function colossusBar(): { name: string; hp: number; maxHp: number } | null {
  const c = colossusNear(140);
  return c ? { name: CREATURES.colossus.name.toUpperCase(), hp: c.hp, maxHp: c.maxHp } : null;
}
