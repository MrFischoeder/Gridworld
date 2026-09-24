// Notice-board quests. Generated from the world seed and a running counter, and always about places that
// really exist: the terrain at a hunt's spot matches its description, fetch quests point at real ruins and wrecks.
import { rng, hash, rangeInt } from '../core/rng';
import { poisNear, worldDist, wrapDx, GRIDHOLM_ID } from './regions';
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
  /** The village whose board posted it (none = Gridholm), and the giver's name there. */
  town?: number; townName?: string; giverName?: string;
}
/** The village a board stands in: where its notices are measured from, and how well it pays (wilder country pays more). */
export interface QuestTown { id: number; name: string; x: number; z: number; home: boolean; pay: number; names?: Partial<Record<NpcRole, string>> }
export const GRIDHOLM_TOWN: QuestTown = { id: GRIDHOLM_ID, name: 'Gridholm', x: 0, z: 0, home: true, pay: 1 };
/** Pay factor of a board: 1 at Gridholm, a third more for every step of danger out there. */
export const boardPay = (danger: number) => 1 + danger / 3;
const money = (v: number, T: QuestTown) => Math.round(v * T.pay / 5) * 5;

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
export const ALPHA: Record<CreatureKind, string> = { ravager: 'Pack Alpha', bramble: 'Old Bull', leechwing: 'Matriarch', gnawer: 'Rat King' };
const GROUP: Record<CreatureKind, string> = { ravager: 'a pack of', bramble: 'a herd of', leechwing: 'a swarm of', gnawer: 'a nest of' };

/** Fetch errands: who wants what, and from which kind of place. */
const ERRANDS: { giver: NpcRole; item: ItemKey; place: 'ruin' | 'wreck'; where: string }[] = [
  { giver: 'elder', item: 'book', place: 'ruin', where: "Elder's Hall" },
  { giver: 'blacksmith', item: 'gearbox', place: 'ruin', where: 'forge' },
  { giver: 'merchant', item: 'datacore', place: 'ruin', where: 'General Store' },
  { giver: 'dealer', item: 'logbook', place: 'wreck', where: 'vehicle yard' },
];

function bounty(id: string, R: () => number, T: QuestTown): Quest {
  const ri = rangeInt(R), target = (['ravager', 'bramble', 'leechwing', 'drone', 'bandit'] as const)[ri(0, 4)];
  const count = target === 'bramble' ? ri(2, 4) : target === 'leechwing' ? ri(3, 5) : target === 'drone' ? ri(6, 12) : target === 'bandit' ? ri(5, 8) : ri(6, 10);
  const each = target === 'bramble' ? 45 : target === 'leechwing' ? 30 : target === 'drone' ? 12 : target === 'bandit' ? 28 : 18;
  return {
    id, kind: 'bounty', state: 'offer', target, count, progress: 0,
    title: `Bounty: ${count} ${plural(target, count)}`,
    text: `${T.home ? 'The village' : T.name} pays for every ${plural(target, 1)} put down. Kill ${WORDS[count] ?? count} ${plural(target, count)} anywhere and come back to this board for the reward.`,
    reward: { gold: T.home ? count * each : money(count * each, T), xp: count * each / 2 },
  };
}

function hunt(t: Terrain, id: string, R: () => number, T: QuestTown): Quest | null {
  const ri = rangeInt(R);
  for (let i = 0; i < 12; i++) {
    const a = R() * 6.283, d = 300 + R() * 800, x = T.x + Math.sin(a) * d, z = T.z - Math.cos(a) * d;
    if (poisNear(t.world, x, z, 80).some((p) => rectDist(p.rect, x, z) < 25)) continue;
    const { where, kind } = describeSpot(t, x, z);
    const count = kind === 'ravager' ? ri(3, 5) : kind === 'bramble' ? ri(1, 2) : ri(2, 3);
    const alpha = ALPHA[kind], dir = compass(x - T.x, z - T.z);
    return {
      id, kind: 'hunt', state: 'offer', at: { x, z, where }, pack: { kind, count, alpha }, killed: 0, alphaDead: false,
      title: `Hunt: ${alpha} ${where}`,
      text: `About ${km(d)} ${dir} of ${T.name}, ${where}, ${GROUP[kind]} ${WORDS[count] ?? count} ${plural(kind, count)} led by ${/^[AEIOU]/.test(alpha) ? 'an' : 'a'} ${alpha} is troubling travellers. Kill them all, the ${alpha} included, then report back here.`,
      reward: { gold: T.home ? 90 + count * 40 + Math.round(d / 10) : money(90 + count * 40 + d / 10, T), xp: 60 + count * 25 },
    };
  }
  return null;
}

function fetch(t: Terrain, id: string, R: () => number, T: QuestTown): Quest | null {
  const list = T.home ? ERRANDS : ERRANDS.filter((x) => x.giver !== 'dealer'); // only Gridholm has a vehicle dealer
  const e = list[Math.floor(R() * list.length)], info = NPC_INFO[e.giver], item = ITEMS[e.item].name, who = T.names?.[e.giver] ?? info.name;
  let place: QuestPlace | null = null;
  if (e.place === 'ruin') {
    const ruins = poisNear(t.world, T.x, T.z, 1100).filter((p) => p.type === 'ruin' && worldDist(p.x, p.z, T.x, T.z) > 120);
    if (!ruins.length) return null;
    const r = ruins[Math.floor(R() * ruins.length)];
    place = { type: 'ruin', ruinId: r.id, x: r.x, z: r.z, name: r.name };
  } else {
    const found = [];
    const rx0 = Math.round(T.x / 256), rz0 = Math.round(T.z / 256);
    for (let rx = rx0 - 3; rx <= rx0 + 3; rx++) for (let rz = rz0 - 3; rz <= rz0 + 3; rz++) { const v = regionVehicle(t, rx, rz); if (v) found.push(v); }
    if (!found.length) return null;
    const v = found[Math.floor(R() * found.length)];
    place = { type: 'wreck', vehicleId: v.id, x: v.x, z: v.z, name: 'abandoned ' + VEHICLES[v.model].designation + ' ' + VEHICLES[v.model].name };
  }
  const d = worldDist(place.x, place.z, T.x, T.z), dir = compass(wrapDx(place.x - T.x), place.z - T.z);
  const briefing = place.type === 'ruin'
    ? `Listen well. In the ${place.name}, about ${km(d)} ${dir} of here, the old ones left ${e.item === 'book' ? 'an' : 'a'} ${item}. Take the stairs down; it lies where the first guardian keeps watch. Bring it to me.`
    : `There is an ${place.name} about ${km(d)} ${dir} of here, ${describeSpot(t, place.x, place.z).where}. Its driver never came back, but his ${item.toLowerCase()} should still be by the wreck, whoever went through the trunk since. Bring it to me.`;
  return {
    id, kind: 'fetch', state: 'offer', giver: e.giver, item: e.item, place, briefing,
    title: `${who} needs an errand run`,
    text: `${who} (${info.title.toLowerCase()}) is looking for someone reliable. Ask at the ${e.where}.`,
    reward: { gold: T.home ? 150 + Math.round(d / 5) : money(150 + d / 5, T), xp: 120 },
    ...(T.home ? {} : { giverName: who }),
  };
}

/** Clear a real bandit camp. */
function camp(t: Terrain, id: string, R: () => number, T: QuestTown): Quest | null {
  const camps = poisNear(t.world, T.x, T.z, 1200).filter((p) => p.type === 'camp');
  if (!camps.length) return null;
  const c = camps[Math.floor(R() * camps.length)], d = worldDist(c.x, c.z, T.x, T.z), dir = compass(wrapDx(c.x - T.x), c.z - T.z), { where } = describeSpot(t, c.x, c.z);
  return {
    id, kind: 'camp', state: 'offer', place: { type: 'camp', campId: c.id, x: c.x, z: c.z, name: c.name },
    title: `Clear the ${c.name}`,
    text: `Bandits have dug in at the ${c.name}, about ${km(d)} ${dir} of ${T.name}, ${where}. They rob every cart on the road. Clear the camp, their boss included, then report back here.`,
    reward: { gold: T.home ? 220 + Math.round(d / 4) : money(220 + d / 4, T), xp: 180 },
  };
}

/** The n-th notice of a board. Fetch errands are not offered twice for the same item at once (see `taken`), nor camps (`camps`). */
export function generateQuest(t: Terrain, n: number, taken: ItemKey[] = [], T: QuestTown = GRIDHOLM_TOWN, camps: number[] = []): Quest {
  // Gridholm keeps its old numbering; every other board has its own stream and ids
  const R = rng(T.home ? hash(t.world, n, 0x9e57) : hash(t.world, T.id, n, 0x9e57)), id = T.home ? `q${n}` : `q${T.id}.${n}`, roll = R();
  let q: Quest | null = null;
  if (roll < 0.3) q = hunt(t, id, R, T);
  else if (roll < 0.6) { q = fetch(t, id, R, T); if (q && taken.includes(q.item!)) q = null; }
  else if (roll < 0.75) { q = camp(t, id, R, T); if (q && camps.includes(q.place!.campId!)) q = null; } // one notice per camp
  q ??= bounty(id, R, T);
  return T.home ? q : { ...q, town: T.id, townName: T.name };
}
