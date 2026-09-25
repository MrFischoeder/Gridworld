// The campaign (pure, deterministic from the world seed): the Chariot of the Ancients built stage by stage, twenty
// wonders of the Ancients over the continent (one per region, each an old ruin to restore), and the surprises on the
// way: twice the hangar crew finds that the Chariot cannot go on without a part only a far-off wonder can give, and
// on the night of the launch the bandits come for the hangar. The player learns of each surprise only when it
// happens (`visible`), and of each wonder's next trouble only when the stage before it is done. Everything is fixed
// by the seed, so every player on a server meets the same surprises. Not wired into the game yet: tools/campaign.sim.ts
// walks a player bot through it to time the whole thing (80 hours alone).
import { hash } from '../core/rng';
import { allVillages, poisNear, worldDist, wrapDx, GRIDHOLM_ID, type Poi } from './regions';
import { ringDanger } from './danger';
import { STAGES } from './shuttle';
import type { Good } from './market';

/** What a wonder is, what it gives the region once restored, and the part the Chariot may one day need from it. */
export interface WonderKind { name: string; perk: string; part: string }
export const WONDER_KINDS: WonderKind[] = [
  { name: 'Cold Forge', perk: 'Steel and alloy cost less in the region', part: 'Cryo Coolant Rods' },
  { name: 'Deep Engine', perk: 'Works in the region need half the power', part: 'Reactor Core' },
  { name: 'Star Well', perk: 'Every wonder within 15 km shows on the map', part: 'Navigation Core' },
  { name: 'Signal Tower', perk: 'News of raids and caravans from the whole region', part: 'Uplink Array' },
  { name: 'Old Reactor', perk: 'Free power for every village of the region', part: 'Fuel Cell Stack' },
  { name: 'Glass Spire', perk: 'Glass is cheap in the region', part: 'Optical Lattice' },
  { name: 'Warden Pylon', perk: 'Bandits keep off the region\'s roads', part: 'Shield Emitter' },
  { name: 'Sky Loom', perk: 'Cloth and cable are cheap in the region', part: 'Heat Weave' },
  { name: 'Iron Choir', perk: 'Guardian robots of the region fall silent', part: 'Harmonic Dampers' },
  { name: 'Rain Mill', perk: 'Farms of the region yield half again', part: 'Pressure Valves' },
  { name: 'Night Lantern', perk: 'The region\'s nights are lit and safe', part: 'Beacon Crystal' },
  { name: 'Gate of Ash', perk: 'A fast way through the mountains', part: 'Gate Keystone' },
  { name: 'Echo Dish', perk: 'Hidden caches of the region show on the map', part: 'Echo Receiver' },
  { name: 'Stone Heart', perk: 'Walls of the region are raised for less', part: 'Gravity Anchor' },
  { name: 'High Aerial', perk: 'Contracts in the region pay more', part: 'Long-Range Antenna' },
  { name: 'Sand Clock', perk: 'Storehouses of the region fill faster', part: 'Chrono Regulator' },
  { name: 'Storm Mast', perk: 'Lightning powers the region\'s works in storms', part: 'Capacitor Bank' },
  { name: 'Root Engine', perk: 'Timber and food are plentiful in the region', part: 'Bio-Seal Gaskets' },
  { name: 'Sunward Beacon', perk: 'Solar farms of the region give double', part: 'Solar Mirror Array' },
  { name: 'Last Lighthouse', perk: 'Your recall beacon reaches the region', part: 'Homing Lens' },
];
/** Relics of the Ancients: only found in ruins and wrecks (a new item when this goes into the game). */
export type Need = Good | 'relic';
export interface WonderStage { title: string; twist: string; needs: [Need, number][] }
export interface Wonder {
  kind: WonderKind; x: number; z: number;
  /** Distance from Gridholm (m) and the danger round it. */
  dist: number; danger: number;
  /** The village it stands by, and the ruin it is (null: an open site by the village). */
  near: string; ruin: number | null;
  stages: WonderStage[];
}
/** A surprise: after Chariot stage `after` the crew finds that it needs `wonder`'s part before going on. */
export interface Blocker { after: number; wonder: number; crew: string; clue: string }
export interface ChariotStep { key: string; name: string; needs: [Need, number][] }
export interface Campaign { chariot: ChariotStep[]; wonders: Wonder[]; blockers: Blocker[]; finale: { after: number; waves: number; text: string } }

/** How much the Chariot's stages need, as a multiple of gen/shuttle.ts STAGES (tools/campaign.sim.ts calibrates it to 80 h). */
export const CHARIOT_SCALE = 1.85;
/** Stage weights on top of the scale: light at first (a new player, no truck yet), heavier towards the launch. */
export const CHARIOT_WEIGHTS = [0.5, 0.8, 1.15, 1.35, 1.6];
/** Where the surprises lie: distance from Gridholm (m) and after which Chariot stage they come. */
export const SURPRISE = [{ after: 1, dist: [8000, 13000] }, { after: 3, dist: [20000, 30000] }];

const TWISTS = [
  ['Clearing the site', 'The halls are choked with rubble and something has nested in them.'],
  ['The machine hall', 'The machine hall is flooded; the pumps must be rebuilt first.'],
  ['The machine hall', 'Guardians still walk the machine hall and the conduits are cut.'],
  ['The machine hall', 'The old power lines are rotten through; every one must be relaid.'],
  ['The heart', 'The heart of the machine is cracked. Only relics of the Ancients can mend it.'],
  ['The heart', 'The core is dark and cold. It wakes only to the relics of its makers.'],
];
const PROC: Good[] = ['steel', 'glass', 'cable', 'parts', 'plastic', 'copperbar', 'boards', 'alloy'];
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** Compass word for a point seen from Gridholm (z grows southwards in the world). */
const dirOf = (x: number, z: number) => DIRS[Math.round(((Math.atan2(wrapDx(x), -z) * 180 / Math.PI + 360) % 360) / 45) % 8];

function wonderStages(seed: number, danger: number): WonderStage[] {
  const k = 1 + danger * 0.12, n = (base: number) => Math.round(base * k);
  const p1 = PROC[hash(seed, 1) % 5], p2 = PROC[(hash(seed, 1) % 5 + 1 + hash(seed, 2) % 4) % 5], p3 = PROC[5 + hash(seed, 3) % 3];
  const t2 = TWISTS[1 + hash(seed, 4) % 3], t3 = TWISTS[4 + hash(seed, 5) % 2];
  return [
    { title: TWISTS[0][0], twist: TWISTS[0][1], needs: [['timber', n(20)], ['tools', n(6)]] },
    { title: t2[0], twist: t2[1], needs: [[p1, n(8)], [p2, n(6)]] },
    { title: t3[0], twist: t3[1], needs: [['relic', 2 + Math.round(danger / 3)], [p3, n(3)]] },
  ];
}

/** The campaign of a world. */
export function campaign(world: number): Campaign {
  // twenty wonders spread over the settled land: anchors by farthest-point sampling over the villages
  const vs = allVillages(world).filter((v) => v.id !== GRIDHOLM_ID), anchors: Poi[] = [];
  anchors.push(vs.reduce((b, v) => (hash(world, v.id, 0x51) < hash(world, b.id, 0x51) ? v : b)));
  while (anchors.length < Math.min(WONDER_KINDS.length, vs.length)) {
    let best = vs[0], bd = -1;
    for (const v of vs) { if (anchors.includes(v)) continue; const d = Math.min(...anchors.map((a) => worldDist(v.x, v.z, a.x, a.z))); if (d > bd) { bd = d; best = v; } }
    anchors.push(best);
  }
  // each is the nearest old ruin to its village (the Ancients built them), else an open site by the village
  const kinds = [...WONDER_KINDS].sort((a, b) => hash(world, a.name.length, a.name.charCodeAt(0), 0x7e) - hash(world, b.name.length, b.name.charCodeAt(0), 0x7e));
  const wonders: Wonder[] = anchors.map((v, i) => {
    const ruin = poisNear(world, v.x, v.z, 2500).filter((p) => p.type === 'ruin').sort((a, b) => worldDist(a.x, a.z, v.x, v.z) - worldDist(b.x, b.z, v.x, v.z))[0];
    const x = ruin ? ruin.x : v.x + 300, z = ruin ? ruin.z : v.z, dist = worldDist(x, z, 0, 0), danger = ringDanger(Math.max(0, dist - 40));
    return { kind: kinds[i], x, z, dist, danger, near: v.name, ruin: ruin ? ruin.id : null, stages: wonderStages(hash(world, v.id, 0xa0), danger) };
  });
  // the surprises: a wonder at the right distance, picked by the seed (the nearest to the band if none lies in it)
  const used = new Set<number>(), blockers: Blocker[] = SURPRISE.map((s, k) => {
    const mid = (s.dist[0] + s.dist[1]) / 2, inBand = wonders.map((_, i) => i).filter((i) => !used.has(i) && wonders[i].dist >= s.dist[0] && wonders[i].dist <= s.dist[1]);
    const pick = inBand.length ? inBand[hash(world, k, 0xb1) % inBand.length]
      : wonders.map((_, i) => i).filter((i) => !used.has(i)).sort((a, b) => Math.abs(wonders[a].dist - mid) - Math.abs(wonders[b].dist - mid))[0];
    used.add(pick);
    const w = wonders[pick], stage = STAGES[s.after - 1]?.name ?? 'the last stage';
    return { after: s.after, wonder: pick,
      crew: `${stage} is done, but the tests went wrong: without ${w.kind.part} the Chariot will tear itself apart on the way up. Nobody alive can make one. The old records say the ${w.kind.name} could.`,
      clue: `The ${w.kind.name} stood ${dirOf(w.x, w.z)} of Gridholm, some ${Math.round(w.dist / 1000)} km away, near a place the maps call ${w.near}.` };
  });
  const chariot: ChariotStep[] = STAGES.map((st, i) => ({ key: st.key, name: st.name, needs: st.needs.map(([g, n]) => [g, Math.max(1, Math.round(n * CHARIOT_SCALE * CHARIOT_WEIGHTS[i]))] as [Need, number]) }));
  const finale = { after: STAGES.length, waves: 6, text: 'The Chariot stands fuelled on the pad. Tonight it flies, and every bandit band for fifty kilometres has heard of it. They come for the hangar at dusk: hold it until the engines are lit.' };
  return { chariot, wonders, blockers, finale };
}

/** What a player may know: the Chariot's stages so far and the surprises already met (the rest stays hidden). */
export interface CampaignProgress { chariot: number; wonders: Record<number, number> }
export function visible(c: Campaign, p: CampaignProgress) {
  const met = c.blockers.filter((b) => p.chariot >= b.after), open = met.filter((b) => (p.wonders[b.wonder] ?? 0) < 3);
  return {
    /** The Chariot waits while a surprise is not dealt with. */
    blocked: open.length > 0,
    surprises: met.map((b) => ({ ...b, done: (p.wonders[b.wonder] ?? 0) >= 3, stage: p.wonders[b.wonder] ?? 0 })),
    /** Only a wonder's current stage is known (its trouble shows once you get there). */
    wonderNeeds: (i: number) => c.wonders[i].stages[p.wonders[i] ?? 0] ?? null,
    finale: p.chariot >= c.finale.after,
  };
}
