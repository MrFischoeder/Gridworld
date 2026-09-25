// A player bot walks the campaign (src/gen/campaign.ts) of a world and times it: earning, buying a Scout, a Mastodon
// and a works, hauling goods to the hangar, meeting the three surprises (leaving the Chariot, finding the wonder
// from its clue, restoring it stage by stage, diving ruins for relics). It then finds the
// Chariot size that makes the whole campaign last ~80 hours for one player, and shows how long it takes 2 and 4.
//   npm run sim                         SIM_WORLD=777 npm run sim
// PACE holds the assumptions about the game (gold per hour, speeds, minutes per dive). They are guesses until
// playtests measure them; change them here and the calibration follows.
import { it } from 'vitest';
import { campaign, CHARIOT_SCALE, CHARIOT_WEIGHTS, type Campaign, type Need } from '../src/gen/campaign';
import { STAGES } from '../src/gen/shuttle';
import { GOOD_INFO } from '../src/gen/market';

const WORLD = Number(process.env.SIM_WORLD ?? 12345), TARGET = 80;
export const PACE = {
  /** Gold per real hour from trading, contracts and quests: on foot, with a Scout, with a Mastodon. */
  income: { foot: 350, scout: 700, mastodon: 1100 },
  /** A processing works of your own: what it costs, the income it adds, how much cheaper processed goods get. */
  works: { cost: 3000, bonus: 450, discount: 0.7 },
  vehicle: { scout: 350, mastodon: 900 },
  /** Crates per trip and speed over rough country (m/s). */
  cap: { foot: 8, scout: 40, mastodon: 120 },
  speed: { foot: 4, scout: 14, mastodon: 10 },
  /** Minutes loading and unloading a trip; the average run (m) to the markets for the hangar's goods. */
  tripBase: 12, marketDist: 4000,
  /** Minutes to find a wonder from its clue, and per relic (a ruin or wreck dive), by distance and danger. */
  explore: { base: 30, perKm: 2.5 }, dive: { base: 20, perDanger: 5 },
  /** Extra time per danger level on an expedition (fights, detours). */
  fight: 0.04,
  /** Hours learning the game at the start. */
  learn: 4,
};
type Veh = 'foot' | 'scout' | 'mastodon';
interface Bot { t: number; gold: number; veh: Veh; works: boolean; n: number; log: [number, string][] }
const price = (g: Need, b: Bot) => (g === 'relic' ? 0 : GOOD_INFO[g].base * (b.works && GOOD_INFO[g].proc ? PACE.works.discount : 1));
const income = (b: Bot) => (PACE.income[b.veh] + (b.works ? PACE.works.bonus : 0)) * b.n * (b.n > 1 ? 0.9 : 1);
function earn(b: Bot, need: number) {
  if (b.gold >= need) return;
  b.t += (need - b.gold) / income(b); b.gold = need;
}
/** Buy what speeds everything up, as soon as it pays: a Scout, a Mastodon, a works. */
function invest(b: Bot, stage: number) {
  if (b.veh === 'foot') { earn(b, PACE.vehicle.scout); b.gold -= PACE.vehicle.scout; b.veh = 'scout'; b.log.push([b.t, 'Scout bought']); }
  if (stage >= 1 && b.veh === 'scout') { earn(b, PACE.vehicle.mastodon); b.gold -= PACE.vehicle.mastodon; b.veh = 'mastodon'; b.log.push([b.t, 'Mastodon bought']); }
  if (stage >= 1 && !b.works) { earn(b, PACE.works.cost); b.gold -= PACE.works.cost; b.works = true; b.log.push([b.t, 'Own processing works']); }
}
/** Buy and haul a list of goods to a place `dist` m away (relics are dived for there, at `danger`). */
function deliver(b: Bot, needs: [Need, number][], dist: number, danger: number) {
  const goods = needs.filter(([g]) => g !== 'relic'), relics = needs.find(([g]) => g === 'relic')?.[1] ?? 0;
  const cost = goods.reduce((a, [g, n]) => a + n * price(g, b), 0);
  earn(b, cost); b.gold -= cost;
  const crates = goods.reduce((a, [, n]) => a + n, 0), trips = Math.ceil(crates / PACE.cap[b.veh] / b.n);
  const run = (PACE.marketDist + dist) * 2 / PACE.speed[b.veh] / 60;
  b.t += trips * (PACE.tripBase + run) / 60 * (1 + PACE.fight * danger);
  if (relics) b.t += Math.ceil(relics / b.n) * (PACE.dive.base + PACE.dive.perDanger * danger) / 60 * (1 + PACE.fight * danger);
}
/** The whole campaign with the Chariot's goods at `scale` × gen/shuttle.ts STAGES. */
function play(c: Campaign, scale: number, n: number): Bot {
  const b: Bot = { t: PACE.learn, gold: 0, veh: 'foot', works: false, n, log: [] };
  STAGES.forEach((st, i) => {
    invest(b, i);
    deliver(b, st.needs.map(([g, k]) => [g, Math.max(1, Math.round(k * scale * CHARIOT_WEIGHTS[i]))] as [Need, number]), 0, 0);
    b.log.push([b.t, `Chariot ${i + 1}/${STAGES.length}: ${st.name}`]);
    for (const bl of c.blockers.filter((x) => x.after === i + 1)) {
      const w = c.wonders[bl.wonder];
      b.log.push([b.t, `SURPRISE: needs ${w.kind.part} from the ${w.kind.name} (${(w.dist / 1000).toFixed(1)} km, danger ${w.danger.toFixed(1)})`]);
      b.t += (PACE.explore.base + PACE.explore.perKm * w.dist / 1000) / 60 / Math.min(n, 2);
      b.log.push([b.t, `  found the ${w.kind.name}`]);
      b.t += 2 * w.dist / PACE.speed[b.veh] / 3600 * (1 + PACE.fight * w.danger); // there and back once; goods come from the villages round it
      w.stages.forEach((s, k) => { deliver(b, s.needs, 0, w.danger); b.log.push([b.t, `  ${w.kind.name} ${k + 1}/3: ${s.title}`]); });
    }
  });
  b.log.push([b.t, 'The Chariot flies']);
  return b;
}

it(`campaign timing: world ${WORLD}`, () => {
  const c = campaign(WORLD);
  console.log(`\n=== World ${WORLD}: the campaign ===`);
  console.log('Surprises:');
  for (const bl of c.blockers) { const w = c.wonders[bl.wonder]; console.log(`  after stage ${bl.after}: the ${w.kind.name} by ${w.near}, ${(w.dist / 1000).toFixed(1)} km, danger ${w.danger.toFixed(1)}\n    crew: "${bl.crew}"\n    clue: "${bl.clue}"`); }
  // calibrate: the Chariot scale that makes one player's campaign last TARGET hours
  let lo = 0.2, hi = 30;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (play(c, mid, 1).t < TARGET) lo = mid; else hi = mid; }
  const scale = (lo + hi) / 2;
  console.log(`\nChariot scale for ${TARGET} h alone: ${scale.toFixed(2)} × gen/shuttle.ts STAGES (CHARIOT_SCALE is ${CHARIOT_SCALE})`);
  console.log('Chariot at that scale: ' + STAGES.map((s, i) => `${s.name}: ${s.needs.map(([g, n]) => `${Math.max(1, Math.round(n * scale * CHARIOT_WEIGHTS[i]))} ${g}`).join(', ')}`).join(' | '));
  for (const n of [1, 2, 4]) {
    const b = play(c, CHARIOT_SCALE, n);
    console.log(`\n${n} player${n > 1 ? 's' : ''} (CHARIOT_SCALE ${CHARIOT_SCALE}): ${b.t.toFixed(1)} h`);
    if (n === 1) for (const [t, what] of b.log) console.log(`  ${t.toFixed(1).padStart(5)} h  ${what}`);
  }
  // side wonders: how long each takes alone (with a Mastodon and a works, from Gridholm)
  const side = c.wonders.map((w, i) => {
    if (c.blockers.some((b) => b.wonder === i)) return null;
    const b: Bot = { t: 0, gold: 0, veh: 'mastodon', works: true, n: 1, log: [] };
    b.t += (PACE.explore.base + PACE.explore.perKm * w.dist / 1000) / 60;
    b.t += 2 * w.dist / PACE.speed[b.veh] / 3600 * (1 + PACE.fight * w.danger);
    for (const s of w.stages) deliver(b, s.needs, 0, w.danger);
    return { w, h: b.t };
  }).filter(Boolean) as { w: (typeof c.wonders)[number]; h: number }[];
  side.sort((a, b) => a.h - b.h);
  console.log(`\nSide wonders (${side.length}), hours alone: ${side.map((s) => `${s.w.kind.name} ${(s.w.dist / 1000).toFixed(0)} km ${s.h.toFixed(1)}h`).join(' · ')}`);
  console.log(`  total ${side.reduce((a, s) => a + s.h, 0).toFixed(0)} h of side content\n`);
});
