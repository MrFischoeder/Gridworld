// "How is the village doing?" (the elder) and the village computer's rows: the six numbers of a settlement (gen/villagestats.ts)
// with who works where and what holds its growth back.
import { G } from '../game';
import { findPoi, villageSeed, GRIDHOLM_ID } from '../gen/regions';
import { villageStats, type VillageStats } from '../gen/villagestats';
import { FOOD, CROPS, cropOf } from '../gen/farms';
import { PROJECTS, type Project } from '../gen/settlement';
import { PLANTS } from '../gen/plants';
import { STATIONS } from '../gen/energy';
import type { Post } from '../gen/workforce';
import type { ItemKey } from '../data/items';
import type { TownState } from '../gen/town';
import { stockAt } from './stock';

/** The village's stats now, with the food in its stores. */
export function statsOf(vid: number): VillageStats | null {
  const c = G.char, poi = findPoi(c.world, vid);
  if (!poi) return null;
  const st = stockAt(vid), stored = st ? (Object.keys(FOOD.value) as ItemKey[]).reduce((a, k) => a + st.has(k) * FOOD.value[k]!, 0) : 0;
  return villageStats(villageSeed(c.world, poi), vid === GRIDHOLM_ID, c.towns[vid], c.time, stored);
}
/** A post's name: Farm 2 (potatoes), Stone quarry, Smelter... */
export function postName(s: TownState | undefined, p: Post): string {
  if (p.kind === 'farm') return `Farm ${p.i + 1} (${CROPS[cropOf(s, p.i)].name.toLowerCase()})`;
  if (p.kind === 'works') { const w = s?.plants?.[p.i]; return w ? PLANTS[w.k].name : 'Works'; }
  if (p.kind === 'station') { const w = s?.stations?.[p.i]; return w ? STATIONS[w.k].name : 'Power station'; }
  return PROJECTS[p.kind as Project]?.name ?? p.kind;
}
const FOOD_WORDS = { short: 'Short: the food does not cover everyone, families will leave', tight: 'Tight: enough to eat, but no newcomers will settle', secure: 'Secure: food to spare, families may settle' };
const days = (d: number) => (d === Infinity ? '' : ` · in store: ${d < 1 ? 'less than a day' : Math.floor(d) + (Math.floor(d) === 1 ? ' day' : ' days')}`);
/** The six numbers as label/value rows (also used by the village computer). */
export function statRows(v: VillageStats): [string, string][] {
  const p = Math.round(v.people), growing = Math.abs(v.target - v.people) >= 1 ? (v.target > v.people ? ` · growing to ${v.target}` : ` · shrinking to ${v.target}`) : '';
  if (!v.settled) return [['Population', `${p}${growing}`], ['Workers', `${v.workers} at work`]];
  return [
    ['Population', `${p}${growing}`],
    ['Workers assigned', `${v.assigned} of ${v.jobs} posts filled`],
    ['Free workers', `${v.free}`],
    ['Housing capacity', `${p} / ${v.housing} homes`],
    ['Food security', `${FOOD_WORDS[v.food.state]} · grown ${v.food.made.toFixed(1)}, eaten ${v.food.need.toFixed(1)} crates a day${days(v.food.days)}`],
    ['Development', `${v.development} / 6 · ${v.devName}`],
  ];
}
/** The elder's panel. */
export function statusHTML(vid: number, head: string): string {
  const v = statsOf(vid), s = G.char.towns[vid];
  if (!v) return head + '<div class="say">Hm?</div><button class="opt" data-o="back">Back</button>';
  let h = head + `<div class="say">${v.settled ? 'Here is where we stand.' : 'We get by. The fields and the old ways keep us.'}</div>`;
  h += statRows(v).map(([a, b]) => `<div class="shoprow"><b>${a}</b>: ${b}</div>`).join('');
  if (v.settled) {
    if (v.posts.length) {
      h += '<h3>Who works where</h3>' + v.posts.map((p) => `<div class="shoprow">${postName(s, p)}: ${p.got}/${p.jobs}${p.fill < 1 ? (p.got === 0 ? ' · <span style="color:var(--warn,#ff5a3c)">no hands, it stands still</span>' : ' · short of hands, works at ' + Math.round(p.fill * 100) + '%') : ''}</div>`).join('');
    } else h += '<div class="say">Nobody works a farm or a works yet: we live off the wilds.</div>';
    if (v.limit) h += `<div class="say">${v.limit}</div>`;
    h += '<div class="say">More food brings more families, more families bring more hands, and more hands work more farms and works. Families come gradually, over days, while there are homes and food to spare.</div>';
  }
  return h + '<button class="opt" data-o="back">Back</button>';
}
/** A settlement's works (or station, `kind`) i short of its crew now: the words to say so, else ''. */
export function shortHands(vid: number, kind: 'works' | 'station', i: number): string {
  const v = statsOf(vid), p = v?.posts.find((q) => q.id === `${kind}:${i}`);
  return p && p.fill < 1 ? `it needs ${p.jobs} workers and the village has ${v!.free} free: more people come with more food and homes (ask the elder how the village is doing)` : '';
}
