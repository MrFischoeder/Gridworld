// Headless simulation of village life (src/gen/growth.ts): every village of a world for many game days, with one
// shared food price that moves with what the villages buy and sell. Prints how population, food, gold, buildings
// and raids develop, so the numbers can be tuned before any of it goes into the game.
//   npm run sim                      (world 12345, 200 days)
//   SIM_WORLD=777 SIM_DAYS=365 npm run sim
import { it } from 'vitest';
import { allVillages, villageSeed, worldDist } from '../src/gen/regions';
import { industryOf, fertility } from '../src/gen/industry';
import { ringDanger } from '../src/gen/danger';
import { newLife, stepLife, lifeInfo, LIFE, type LifeState, type LifePlace, type LifeMarket } from '../src/gen/growth';

const WORLD = Number(process.env.SIM_WORLD ?? 12345), DAYS = Number(process.env.SIM_DAYS ?? 200), EVERY = Number(process.env.SIM_EVERY ?? 20);

it(`village life: world ${WORLD}, ${DAYS} days`, () => {
  const t0 = performance.now();
  const vs = allVillages(WORLD).map((v) => {
    const seed = villageSeed(WORLD, v), ind = industryOf(WORLD, v, seed);
    const place: LifePlace = { seed, danger: ringDanger(Math.max(0, worldDist(v.x, v.z, 0, 0) - 40)), fertility: fertility(WORLD, v, seed), foodIndustry: ind === 'farm' || ind === 'fishery' };
    return { name: v.name, ind, place, s: newLife(place) };
  });
  const market: LifeMarket = { food: 1, goods: 1 };
  const pad = (x: unknown, n: number) => String(x).padStart(n);
  const row = (day: number) => {
    const pops = vs.map((v) => v.s.pop), tot = pops.reduce((a, b) => a + b, 0), starving = vs.filter((v) => v.s.food <= 0).length;
    const gold = vs.reduce((a, v) => a + v.s.gold, 0), blds = vs.reduce((a, v) => a + lifeInfo(v.s, v.place).count, 0);
    const won = vs.reduce((a, v) => a + v.s.log.won, 0), lost = vs.reduce((a, v) => a + v.s.log.lost, 0);
    const happy = vs.reduce((a, v) => a + v.s.happy, 0) / vs.length, walls = vs.filter((v) => v.s.wall > 0).length;
    console.log(`${pad(day, 4)} ${pad(Math.round(tot), 7)} ${pad(Math.round(Math.min(...pops)), 5)} ${pad(Math.round(tot / vs.length), 5)} ${pad(Math.round(Math.max(...pops)), 6)} ${pad(starving, 5)} ${pad(Math.round(gold / vs.length), 7)} ${pad((blds / vs.length).toFixed(1), 6)} ${pad(walls, 5)} ${pad(won + '/' + lost, 9)} ${pad(happy.toFixed(2), 5)} ${pad(market.food.toFixed(2), 5)}`);
  };
  console.log(`\nWorld ${WORLD}: ${vs.length} villages, ${DAYS} days\n\n day     pop   min   avg    max  hung  gold/v bld/v walls  raids w/l happy food$`);
  row(0);
  let net = 0;
  for (let h = 1; h <= DAYS * 24; h++) {
    for (const v of vs) net += stepLife(v.s, v.place, market);
    if (h % 24 === 0) {
      // one world food price: villages buying more than the others sell push it up, and the other way round
      // (slowly, and drawn back towards the base by trade with the world beyond the villages)
      const k = Math.max(-1, Math.min(1, -net / (vs.length * 8)));
      market.food = Math.max(0.5, Math.min(4, market.food * (1 + 0.03 * k) + (1 - market.food) * 0.02));
      net = 0;
      if ((h / 24) % EVERY === 0) row(h / 24);
    }
  }
  const ms = performance.now() - t0;
  const by = [...vs].sort((a, b) => b.s.pop - a.s.pop), show = (v: (typeof vs)[number]) => {
    const i = lifeInfo(v.s, v.place), b = v.s.built;
    return `  ${v.name.padEnd(14)} ${v.ind.padEnd(9)} danger ${v.place.danger.toFixed(1)} fert ${v.place.fertility.toFixed(2)} | pop ${Math.round(v.s.pop)}/${i.housing} food ${Math.round(v.s.food)} gold ${Math.round(v.s.gold)} happy ${v.s.happy.toFixed(2)} | houses ${b.house} farms ${b.farm} works ${b.works} granaries ${b.granary} barracks ${b.barracks} markets ${b.market} wall ${v.s.wall} guards ${v.s.guards} | raids ${v.s.log.won}/${v.s.log.lost} starved ${v.s.log.starvedDays}d razed ${v.s.log.razed}`;
  };
  console.log('\nBiggest:'); by.slice(0, 5).forEach((v) => console.log(show(v)));
  console.log('Smallest:'); by.slice(-5).forEach((v) => console.log(show(v)));
  const hist = [0, 25, 50, 100, 200, 400, 800, Infinity], counts = hist.slice(1).map((hi, i) => vs.filter((v) => v.s.pop >= hist[i] && v.s.pop < hi).length);
  console.log('\nPopulation spread: ' + hist.slice(1).map((hi, i) => `${hist[i]}–${hi === Infinity ? '' : hi}: ${counts[i]}`).join(' · '));
  const perDay = vs.map((v) => v.s.log.earned / DAYS);
  console.log(`Gold earned per village per day: avg ${Math.round(perDay.reduce((a, b) => a + b, 0) / vs.length)}, max ${Math.round(Math.max(...perDay))} · minimum population ${LIFE.minPop}`);
  console.log(`Simulated ${vs.length} villages × ${DAYS * 24} hours in ${Math.round(ms)} ms (${(ms / (vs.length * DAYS * 24) * 1000).toFixed(2)} µs per village-hour)\n`);
});
