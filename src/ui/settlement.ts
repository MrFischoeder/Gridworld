import { G } from '../game';
import { addItem, gainXp, saveChar, calcStats } from '../character';
import { PROJECTS, projectPlan, projectProblem, projectDone, buildProject, tutorialStep, commsRuin, progressive, depositsOf, type Project } from '../gen/settlement';
import { ORES } from '../gen/resource-sites';
import { findPoi, villageSeed, worldDist, GRIDHOLM_ID } from '../gen/regions';
import { settleOwn, anchorNew, hallStands } from '../gen/hall';
import { peopleAt, setPeople } from '../gen/people';
import { ITEMS, type ItemKey } from '../data/items';
import { stockHas, stockTake } from './stock';
import { reloadStruct } from '../world/overworld';
import { syncFarmVillage } from '../world/farms';

/** Rewards belong to the character; projects and deliveries belong to the shared world. */
export function settlementReward(vid: number, key: string, item?: ItemKey): boolean {
  const c = G.char, id = `${c.world}:${vid}:${key}`, seen = (c.settlementRewards ??= []);
  if (seen.includes(id)) return false;
  seen.push(id);
  c.gold += 40; gainXp(30);
  if (item && !addItem(item)) { const h = ((c.towns[vid] ??= {}).hold ??= {}); h[item] = (h[item] ?? 0) + 1; }
  return true;
}
export function developmentHTML(vid: number, head: string, msg = '', atComms = false): string {
  const c = G.char, s = c.towns[vid], step = tutorialStep(s), v = findPoi(c.world, vid);
  if (!step || !v) return head + '<div class="say">This village keeps its established buildings.</div><button class="opt" data-o="back">Back</button>';
  const has = stockHas(vid), ruin = commsRuin(c.world, v);
  let h = head + `<div class="say">${msg ? msg + '<br><br>' : ''}<b>Village tutorial: ${step.title}</b><br>${step.text}<br><br>Bring materials to the village stores${hallStands(s) ? ' at the warehouse terminal' : ': to me, until the warehouse stands'}. Houses are repaired as our food supply and works grow; families arrive gradually.</div>`;
  h += `<button class="opt" data-devkit="${vid}">Receive the elder's starter tools and earned rewards</button>`;
  if (!atComms) {
    const d = depositsOf(s);
    h += `<div class="say">Local resources · about 100 m beyond the fence:<br>Stone quarry · west. Sawmill woodland · east.<br>${d.ore ? ORES[d.ore].name + ' (' + ORES[d.ore].symbol + ') · south.' : 'No local ore seam: bring metals from other villages.'}<br>${d.oil ? 'Oil seeps · north.' : 'No local oil field: import crude or fuel.'}</div>`;
  }
  if (step.supplies) h += `<div class="say">Wood: ${has('log')}/4 · stone: ${has('stone')}/4</div><button class="opt" data-devsupplies="${vid}" ${has('log') >= 4 && has('stone') >= 4 ? '' : 'disabled'}>Report the stored supplies</button>`;
  if (step.farm) h += '<button class="opt" data-o="farms">Build the next farm</button>';
  const keys = (atComms ? ['comms'] : step.project ? [step.project] : []) as Project[];
  for (const k of keys) {
    h += `<h3>${PROJECTS[k].name}</h3><div class="say">${PROJECTS[k].description}</div>`;
    h += projectPlan(s, k).map((r) => `<div class="shoprow">${ITEMS[r.k].name}: ${r.given}/${r.n} · in stock: ${has(r.k)}</div>`).join('');
    const why = projectProblem(s, k);
    if (k === 'comms' && !atComms) h += `<div class="say">Receiver: ${ruin?.name ?? 'search the nearby ruins'}. Its console is outside the west wall of the ruins. Follow the tutorial marker; no GPS is needed to find it.</div>`;
    else if (!why) h += `<button class="opt" data-devbuild="${k}" data-devvid="${vid}">Hand over materials and build</button>`;
    else h += `<div class="say">${why}</div>`;
  }
  if (atComms && projectDone(s, 'comms')) h += `<button class="opt" data-devgps="${vid}">Receive my GPS tablet</button>`;
  if (projectDone(s, 'power')) h += '<button class="opt" data-o="fortify">Local industry and defences</button><button class="opt" data-o="works">More processing works and power stations</button>';
  return h + (atComms ? '<button class="opt" data-devclose="1">Close</button>' : '<button class="opt" data-o="back">Back</button>');
}
/** Returns a message when a development action was handled. The caller redraws its own panel. */
export function developmentClick(t: HTMLElement, vid: number | null, atComms = false): string | null {
  const button = t.closest<HTMLElement>('[data-devkit], [data-devsupplies], [data-devbuild], [data-devgps]');
  if (!button || vid === null) return null;
  const c = G.char, s = c.towns[vid], v = findPoi(c.world, vid);
  if (!progressive(s) || !s || !v) return 'This settlement uses the established rules.';
  let msg = '';
  if (button.dataset.devkit) {
    settlementReward(vid, 'starter-hatchet', 'hatchet'); settlementReward(vid, 'starter-pickaxe', 'pickaxe');
    for (let i = 1; i <= (s.farms ?? 0); i++) settlementReward(vid, `farm-${i}`);
    for (const k of Object.keys(PROJECTS) as Project[]) if (projectDone(s, k)) settlementReward(vid, k, k === 'comms' ? 'tablet' : undefined);
    msg = 'Starter tools and rewards are issued once per traveller. Anything that did not fit is in the village stores. Use the hatchet on trees and the pickaxe on rocks; hold E to work.';
  } else if (button.dataset.devsupplies) {
    const has = stockHas(vid);
    if (has('log') < 4 || has('stone') < 4) return 'Store four logs and four stones first.';
    s.settlement!.supplies = true; settlementReward(vid, 'supplies'); msg = 'Good. Keep these materials in stock and collect enough for the first farm.';
  } else if (button.dataset.devgps) {
    if (!atComms || !projectDone(s, 'comms')) return 'The receiver has not been restored.';
    msg = settlementReward(vid, 'comms', 'tablet') ? 'Satellite link online. Your GPS tablet is ready (or in the village stores if your pack was full).' : 'You already received your GPS tablet.';
  } else {
    const k = button.dataset.devbuild as Project;
    if (!(k in PROJECTS)) return 'Unknown project.';
    if (k === 'comms') {
      const r = commsRuin(c.world, v), spot = r && { x: r.rect.x0 - 3, z: r.z };
      if (!atComms || !spot || worldDist(spot.x, spot.z, G.pos.x, G.pos.z) > 4) return 'Restore this receiver at the marked ruin console.';
    }
    const why = projectProblem(s, k); if (why) return why;
    const seed = villageSeed(c.world, v), has = stockHas(vid);
    settleOwn(c.world, v, seed, s, c.time); setPeople(s, seed, v.id === GRIDHOLM_ID, c.time, peopleAt(seed, v.id === GRIDHOLM_ID, s, c.time));
    const result = buildProject(s, k, has); stockTake(vid, result.taken);
    if (result.built) {
      if (k === 'power') { s.fixed = c.time; s.hurt = 0; }
      if (k === 'refinery') s.settlement!.refinedAt = c.time;
      anchorNew(c.world, v, seed, s, c.time); syncFarmVillage(vid); reloadStruct(vid);
      if (k === 'comms') reloadStruct(commsRuin(c.world, v)!.id);
      settlementReward(vid, k, k === 'comms' ? 'tablet' : undefined);
      msg = PROJECTS[k].name + ' built. The elder has the next objective.';
    } else msg = result.taken.length ? 'Materials delivered. The remaining requirements are shown below.' : 'Bring the missing materials to the village stores first.';
  }
  calcStats(); saveChar(); return msg;
}
