// Headless simulation of the civilisation layer (src/gen/civ.ts): every village of a world with real goods,
// development tiers, the ~20 regional projects of the Ancients and the Chariot, once without players and once
// with some. Shows whether every material finds buyers across the world and what players add.
//   npm run sim                                    (both simulations)
//   SIM_WORLD=777 SIM_DAYS=500 SIM_PLAYERS=0,8 npm run sim
import { it } from 'vitest';
import { allVillages, villageSeed, worldDist, GRIDHOLM_ID } from '../src/gen/regions';
import { industryOf, fertility } from '../src/gen/industry';
import { ringDanger } from '../src/gen/danger';
import { newCiv, civDay, MAT, MATS, TIERS, type CivWorld, type CivSeed, type Mat } from '../src/gen/civ';

const WORLD = Number(process.env.SIM_WORLD ?? 12345), DAYS = Number(process.env.SIM_DAYS ?? 400), EVERY = Number(process.env.SIM_EVERY ?? 40);
const PLAYERS = (process.env.SIM_PLAYERS ?? '0,4').split(',').map(Number);

const seeds = (): CivSeed[] => allVillages(WORLD).map((v) => {
  const seed = villageSeed(WORLD, v), ind = industryOf(WORLD, v, seed);
  return { name: v.name, x: v.x, z: v.z, industry: ind, home: v.id === GRIDHOLM_ID,
    place: { seed, danger: ringDanger(Math.max(0, worldDist(v.x, v.z, 0, 0) - 40)), fertility: fertility(WORLD, v, seed), foodIndustry: ind === 'farm' || ind === 'fishery' } };
});
const pad = (x: unknown, n: number) => String(x).padStart(n);
const KEY: Mat[] = ['steel', 'glass', 'parts', 'aluminium', 'boards', 'alloy', 'batteries', 'relic'];

function report(w: CivWorld) {
  const vs = w.villages, pop = vs.reduce((a, v) => a + v.life.pop, 0), tiers = TIERS.map((_, t) => vs.filter((v) => v.tier === t).length).join('/');
  const want = vs.reduce((a, v) => a + v.wanted, 0), unmet = vs.reduce((a, v) => a + v.unmet, 0);
  const stages = w.projects.reduce((a, p) => a + p.stage, 0), full = w.projects.filter((p) => p.stage >= 3).length;
  const plants = vs.reduce((a, v) => a + v.plants.length, 0), ch = Math.round(w.chariot.stage / w.chariot.stages.length * 100);
  console.log(`${pad(w.day, 4)} ${pad(Math.round(pop), 6)} ${pad(tiers, 12)} ${pad(plants, 6)} ${pad(stages + '/' + w.projects.length * 3, 7)} ${pad(full, 4)} ${pad(ch + '%', 5)} ${pad((want ? unmet / want * 100 : 0).toFixed(0) + '%', 6)}  ` +
    KEY.map((m) => pad((w.pool.price[m] / MAT[m].base).toFixed(2), 5)).join(' '));
}

for (const players of PLAYERS) it(`civilisation: world ${WORLD}, ${DAYS} days, ${players} players`, () => {
  const t0 = performance.now(), w = newCiv(seeds(), players);
  console.log(`\n=== World ${WORLD}: ${w.villages.length} villages, ${w.projects.length} regional projects, ${players} players, ${DAYS} days ===`);
  console.log(`Projects (anchor · danger · villages): ${w.projects.map((p) => `${p.name} (${w.villages[p.anchor].name} · ${p.danger.toFixed(1)} · ${p.members.length})`).join(', ')}`);
  const rares = MATS.filter((m) => MAT[m].kind === 'rare').map((m) => `${MAT[m].name} ${w.villages.filter((v) => v.dig.includes(m)).length}`).join(', ');
  console.log(`Villages with a rare deposit: ${rares}`);
  console.log(`\n day    pop  tiers S/T/C/M plants stages full chart unmet  price/base: ${KEY.map((m) => m.slice(0, 5).padStart(5)).join(' ')}`);
  report(w);
  for (let d = 1; d <= DAYS; d++) { civDay(w); if (d % EVERY === 0) report(w); }
  console.log('\nMaterials: made · used by people / upkeep / works / tiers / projects / chariot · stock · price/base');
  for (const m of MATS) {
    const u = (k: string) => Math.round(w.used[k]?.[m] ?? 0);
    const usedAll = ['people', 'upkeep', 'works', 'tiers', 'projects', 'chariot'].reduce((a, k) => a + u(k), 0);
    console.log(`  ${MAT[m].name.padEnd(22)} ${pad(Math.round(w.made[m]), 7)} · ${pad(u('people'), 6)} ${pad(u('upkeep'), 5)} ${pad(u('works'), 6)} ${pad(u('tiers'), 5)} ${pad(u('projects'), 6)} ${pad(u('chariot'), 4)} = ${pad(usedAll, 7)} · ${pad(Math.round(w.pool.stock[m]), 6)} · ${(w.pool.price[m] / MAT[m].base).toFixed(2)}${usedAll < w.made[m] * 0.3 && w.made[m] > 50 ? '  ← few buyers' : ''}`);
  }
  console.log('\nProjects: stage reached (day each stage was done)');
  for (const p of [...w.projects, w.chariot]) console.log(`  ${p.name.padEnd(24)} ${p.stage}/${p.stages.length} ${p.doneAt.length ? '(' + p.doneAt.join(', ') + ')' : ''}${p.stage < p.stages.length && p.stages[p.stage].relic ? ' — waiting for relics' : ''}`);
  const works: Record<string, number> = {};
  for (const v of w.villages) for (const o of v.plants) works[o] = (works[o] ?? 0) + 1;
  console.log(`\nWorks paid for by a richer village of the region: ${w.invested}`);
  console.log(`Works built: ${Object.entries(works).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${MAT[k as Mat].name} ${n}`).join(', ') || 'none'}`);
  if (players) console.log(`Players: relics found ${w.players.relics}, handed to projects and tiers ${w.players.delivered}, purse ${Math.round(w.players.purse)}`);
  console.log(`Simulated in ${Math.round(performance.now() - t0)} ms\n`);
});
