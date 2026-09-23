// Notice-board quests. Generated from the world seed and a running counter, and always about places that
// really exist: the terrain at a hunt's spot matches its description, fetch quests point at real ruins and wrecks.
import { rng, hash, rangeInt } from '../core/rng';
import { poisNear } from './regions';
import { rectDist, type Terrain } from './terrain';
import { regionVehicle } from './vehicles';
import { CREATURES, type CreatureKind } from '../data/creatures';
import { NPC_INFO, type NpcRole } from '../data/npcs';
import { ITEMS, type ItemKey } from '../data/items';
import { VEHICLES } from '../data/vehicles';

export type QuestKind = 'bounty' | 'hunt' | 'fetch' | 'camp';
export type QuestState = 'offer' | 'talk' | 'active' | 'ready' | 'done';
export interface QuestPlace { type: 'ruin' | 'wreck' | 'camp'; ruinId?: number; campId?: number; vehicleId?: string; x: number; z: number; name: string }
export interface Quest {
  id: string; kind: QuestKind; title: string; text: string;
  reward: { gold: number; xp: number };
  state: QuestState;
  /** bounty: kill `count` of `target` anywhere */
  target?: CreatureKind | 'drone' | 'bandit'; count?: number; progress?: number;
  /** hunt: a group with a leader at a described spot */
  at?: { x: number; z: number; where: string };
  pack?: { kind: CreatureKind; count: number; alpha: string }; killed?: number; alphaDead?: boolean;
  /** fetch: a resident wants an item from a real place */
  giver?: NpcRole; item?: ItemKey; place?: QuestPlace; briefing?: string;
}

const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** Compass word for a direction from (0,0) to (x,z); -z is north. */
export function compass(dx: number, dz: number): string {
  const a = Math.atan2(dx, -dz), i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return DIRS[i];
}
export const km = (d: number) => (d < 950 ? `${Math.round(d / 50) * 50} m` : `${(d / 1000).toFixed(1)} km`);
const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const plural = (kind: CreatureKind | 'drone' | 'bandit', n: number) => (kind === 'drone' || kind === 'bandit' ? kind + (n === 1 ? '' : 's') : CREATURES[kind].name + (n === 1 ? '' : 's'));

/** Describes the land at a point, and which creatures live in that kind of place. */
export function describeSpot(t: Terrain, x: number, z: number): { where: string; kind: CreatureKind } {
  const ruin = poisNear(t.world, x, z, 120).find((p) => p.type === 'ruin' && rectDist(p.rect, x, z) < 60);
  if (ruin) return { where: 'near the ' + ruin.name, kind: 'leechwing' };
  const h = t.heightAt(x, z);
  if (h < 8) return { where: 'in a valley', kind: 'bramble' };
  if (h > 17) return { where: 'on the hills', kind: 'leechwing' };
  if (t.forest(x, z) > 0.45) return { where: 'in the forest', kind: 'ravager' };
  return { where: 'in the open fields', kind: 'ravager' };
}
export const ALPHA: Record<CreatureKind, string> = { ravager: 'Pack Alpha', bramble: 'Old Bull', leechwing: 'Matriarch' };
const GROUP: Record<CreatureKind, string> = { ravager: 'a pack of', bramble: 'a herd of', leechwing: 'a swarm of' };

/** Fetch errands: who wants what, and from which kind of place. */
const ERRANDS: { giver: NpcRole; item: ItemKey; place: 'ruin' | 'wreck'; where: string }[] = [
  { giver: 'elder', item: 'book', place: 'ruin', where: "Elder's Hall" },
  { giver: 'blacksmith', item: 'gearbox', place: 'ruin', where: 'forge' },
  { giver: 'merchant', item: 'datacore', place: 'ruin', where: 'General Store' },
  { giver: 'dealer', item: 'logbook', place: 'wreck', where: 'vehicle yard' },
];

function bounty(id: string, R: () => number): Quest {
  const ri = rangeInt(R), target = (['ravager', 'bramble', 'leechwing', 'drone', 'bandit'] as const)[ri(0, 4)];
  const count = target === 'bramble' ? ri(2, 4) : target === 'leechwing' ? ri(3, 5) : target === 'drone' ? ri(6, 12) : target === 'bandit' ? ri(5, 8) : ri(6, 10);
  const each = target === 'bramble' ? 45 : target === 'leechwing' ? 30 : target === 'drone' ? 12 : target === 'bandit' ? 28 : 18;
  return {
    id, kind: 'bounty', state: 'offer', target, count, progress: 0,
    title: `Bounty: ${count} ${plural(target, count)}`,
    text: `The village pays for every ${plural(target, 1)} put down. Kill ${WORDS[count] ?? count} ${plural(target, count)} anywhere and come back to this board for the reward.`,
    reward: { gold: count * each, xp: count * each / 2 },
  };
}

function hunt(t: Terrain, id: string, R: () => number): Quest | null {
  const ri = rangeInt(R);
  for (let i = 0; i < 12; i++) {
    const a = R() * 6.283, d = 300 + R() * 800, x = Math.sin(a) * d, z = -Math.cos(a) * d;
    if (poisNear(t.world, x, z, 80).some((p) => rectDist(p.rect, x, z) < 25)) continue;
    const { where, kind } = describeSpot(t, x, z);
    const count = kind === 'ravager' ? ri(3, 5) : kind === 'bramble' ? ri(1, 2) : ri(2, 3);
    const alpha = ALPHA[kind], dir = compass(x, z);
    return {
      id, kind: 'hunt', state: 'offer', at: { x, z, where }, pack: { kind, count, alpha }, killed: 0, alphaDead: false,
      title: `Hunt: ${alpha} ${where}`,
      text: `About ${km(d)} ${dir} of Gridholm, ${where}, ${GROUP[kind]} ${WORDS[count] ?? count} ${plural(kind, count)} led by ${/^[AEIOU]/.test(alpha) ? 'an' : 'a'} ${alpha} is troubling travellers. Kill them all, the ${alpha} included, then report back here.`,
      reward: { gold: 90 + count * 40 + Math.round(d / 10), xp: 60 + count * 25 },
    };
  }
  return null;
}

function fetch(t: Terrain, id: string, R: () => number): Quest | null {
  const e = ERRANDS[Math.floor(R() * ERRANDS.length)], info = NPC_INFO[e.giver], item = ITEMS[e.item].name;
  let place: QuestPlace | null = null;
  if (e.place === 'ruin') {
    const ruins = poisNear(t.world, 0, 0, 1100).filter((p) => p.type === 'ruin' && Math.hypot(p.x, p.z) > 120);
    if (!ruins.length) return null;
    const r = ruins[Math.floor(R() * ruins.length)];
    place = { type: 'ruin', ruinId: r.id, x: r.x, z: r.z, name: r.name };
  } else {
    const found = [];
    for (let rx = -3; rx <= 3; rx++) for (let rz = -3; rz <= 3; rz++) { const v = regionVehicle(t, rx, rz); if (v) found.push(v); }
    if (!found.length) return null;
    const v = found[Math.floor(R() * found.length)];
    place = { type: 'wreck', vehicleId: v.id, x: v.x, z: v.z, name: 'abandoned ' + VEHICLES[v.model].designation + ' ' + VEHICLES[v.model].name };
  }
  const d = Math.hypot(place.x, place.z), dir = compass(place.x, place.z);
  const briefing = place.type === 'ruin'
    ? `Listen well. In the ${place.name}, about ${km(d)} ${dir} of here, the old ones left ${e.item === 'book' ? 'an' : 'a'} ${item}. Take the stairs down; it lies where the first guardian keeps watch. Bring it to me.`
    : `There is an ${place.name} about ${km(d)} ${dir} of here, ${describeSpot(t, place.x, place.z).where}. Its driver never came back, but his ${item.toLowerCase()} should still be by the wreck, whoever went through the trunk since. Bring it to me.`;
  return {
    id, kind: 'fetch', state: 'offer', giver: e.giver, item: e.item, place, briefing,
    title: `${info.name} needs an errand run`,
    text: `${info.name} (${info.title.toLowerCase()}) is looking for someone reliable. Ask at the ${e.where}.`,
    reward: { gold: 150 + Math.round(d / 5), xp: 120 },
  };
}

/** Clear a real bandit camp. */
function camp(t: Terrain, id: string, R: () => number): Quest | null {
  const camps = poisNear(t.world, 0, 0, 1200).filter((p) => p.type === 'camp');
  if (!camps.length) return null;
  const c = camps[Math.floor(R() * camps.length)], d = Math.hypot(c.x, c.z), dir = compass(c.x, c.z), { where } = describeSpot(t, c.x, c.z);
  return {
    id, kind: 'camp', state: 'offer', place: { type: 'camp', campId: c.id, x: c.x, z: c.z, name: c.name },
    title: `Clear the ${c.name}`,
    text: `Bandits have dug in at the ${c.name}, about ${km(d)} ${dir} of Gridholm, ${where}. They rob every cart on the road. Clear the camp, their boss included, then report back here.`,
    reward: { gold: 220 + Math.round(d / 4), xp: 180 },
  };
}

/** The n-th notice of this world. Fetch errands are not offered twice for the same item at once (see `taken`). */
export function generateQuest(t: Terrain, n: number, taken: ItemKey[] = []): Quest {
  const R = rng(hash(t.world, n, 0x9e57)), id = `q${n}`, roll = R();
  let q: Quest | null = null;
  if (roll < 0.3) q = hunt(t, id, R);
  else if (roll < 0.6) { q = fetch(t, id, R); if (q && taken.includes(q.item!)) q = null; }
  else if (roll < 0.75) q = camp(t, id, R);
  return q ?? bounty(id, R);
}
