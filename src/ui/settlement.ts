import { G } from '../game';
import { addItem, gainXp, saveChar, calcStats } from '../character';
import { PROJECTS, projectPlan, projectProblem, projectDone, buildProject, tutorialStep, linkRuin, progressive, depositsOf, isStation, stationStage, STATION_STAGES, STATION_TEXT, satelliteUp, RELAY, sideStep, FIRST_CROPS, optionalProjects, type Project } from '../gen/settlement';
import { poisNear, CHUNK, wrapDx } from '../gen/regions';
import { CROPS } from '../gen/farms';
import { discover } from '../save';
import { ORES, MINERAL_NAME } from '../gen/resource-sites';
import { RARE_NAME } from '../gen/deposits';
import { findPoi, villageSeed, worldDist, GRIDHOLM_ID } from '../gen/regions';
import { settleOwn, anchorNew, hallStands } from '../gen/hall';
import { ITEMS, type ItemKey } from '../data/items';
import { stockHas, stockTake } from './stock';
import { buildersLine, jobHTML, building } from './jobs';

/** Rewards belong to the character; projects and deliveries belong to the shared world. */
export function settlementReward(vid: number, key: string, item?: ItemKey): boolean {
  const c = G.char, id = `${c.world}:${vid}:${key}`, seen = (c.settlementRewards ??= []);
  if (seen.includes(id)) return false;
  seen.push(id);
  c.gold += 40; gainXp(30);
  if (item && !addItem(item)) { const h = ((c.towns[vid] ??= {}).hold ??= {}); h[item] = (h[item] ?? 0) + 1; }
  return true;
}
/** How far the station's first sweep reaches (m): every place in reach goes on your map. */
const SWEEP = 5000;
export function stationSweep(x: number, z: number): number {
  const c = G.char; let n = 0;
  for (const p of poisNear(c.world, x, z, SWEEP)) if (worldDist(p.x, p.z, x, z) <= SWEEP && discover(c.discovered, Math.floor(p.x / CHUNK), Math.floor(p.z / CHUNK))) n++;
  return n;
}
export function developmentHTML(vid: number, head: string, msg = '', atComms = false): string {
  const c = G.char, s = c.towns[vid], step = tutorialStep(s), v = findPoi(c.world, vid);
  if (!step || !v) return head + '<div class="say">This village keeps its established buildings.</div><button class="opt" data-o="back">Back</button>';
  const has = stockHas(vid), ruin = linkRuin(c.world, v, s), big = isStation(s);
  let h = head + `<div class="say">${msg ? msg + '<br><br>' : ''}<b>Village tutorial: ${step.title}</b><br>${step.text}<br><br>Bring materials to the village stores${hallStands(s) ? ' at the warehouse terminal' : ': to me, until the warehouse stands'}. Houses are repaired as our food supply and works grow; families arrive gradually.</div>`;
  h += `<button class="opt" data-devkit="${vid}">Receive the elder's starter tools and earned rewards</button>`;
  if (!atComms) {
    const d = depositsOf(s), kinds = d.kinds ?? (d.kind ? [d.kind] : []);
    const line = (k: string) => k === 'quarry' ? `a field of great boulders · west: a stone quarry there cuts building stone${d.mineral ? ` and digs ${MINERAL_NAME[d.mineral]}` : ''}`
      : k === 'lumber' ? 'a great grove of giant trees · east: a lumber camp there gives logs for good'
      : k === 'mine' && d.ore ? `${ORES[d.ore].name.toLowerCase()} (${ORES[d.ore].symbol}) in a rocky hollow · south: a mine there digs it`
      : k === 'oil' ? `oil seeping out of the ground · north: an oil well there pumps crude${d.salt ? ', and its brine is boiled into salt' : ''}` : '';
    const own = kinds.map(line).filter(Boolean);
    if (d.rares?.length) own.push(`deep under the ground ${d.rares.map((r) => RARE_NAME[r]).join(' and ')}, rare in these parts · south-east: a deep mine with a drill rig could bring it up`);
    h += `<div class="say">${own.length ? `Our land's own ${own.length > 1 ? 'resources' : 'resource'}, about 100 m beyond the fence: ${own.join(';<br>')}.<br>` : ''}Every village digs two things of its own (and a few stand over a rare deposit). The rest comes by trade: logs, stone, ore and crude from the villages that dig them. Processing is open to all of us: logs sawn into planks, crude refined into fuel, and later ore smelted into metal. Processed goods sell for far more than raw ones.</div>`;
  }
  if (step.farm) h += `<button class="opt" data-o="farms">Build the next farm${step.farm <= FIRST_CROPS.length ? ` (${CROPS[FIRST_CROPS[step.farm - 1]].name.toLowerCase()})` : ''}</button>`;
  // (0.167) the side task: the satellite link, once the power plant stands; handed over at its console out there
  const side = atComms ? null : sideStep(s);
  if (side && ruin) {
    const dx = wrapDx(ruin.x - v.x), dz = ruin.z - v.z, km = (Math.hypot(dx, dz) / 1000).toFixed(1);
    const dir = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360) / 45) % 8];
    h += `<h3>Side task: ${side.title}</h3><div class="say">${side.text}<br>It lies about ${km} km ${dir} of here, at ${ruin.name}: its console is outside the west wall of the ruins. The materials are handed over there, from the village stores. You may see to it whenever you like, beside the village's own work.</div>`;
  }
  // (D2) once the receiver works and the satellites answer, its console can raise a relay mast
  const relayOpen = atComms && !big && projectDone(s, 'comms') && !projectDone(s, 'relay');
  // (0.168) the refinery is open to every village once its warehouse stands, beside the tutorial
  const extra = atComms ? [] : optionalProjects(s).filter((k) => k !== step.project);
  const keys = (atComms ? (relayOpen ? ['relay'] : ['comms']) : [...(step.project ? [step.project] : []), ...extra]) as Project[];
  for (const k of keys) {
    if (k === extra[0]) h += '<div class="say" style="color:var(--gold)">Open to you beside our own work:</div>';
    if (k === 'comms' && big) {
      const n = stationStage(s), st = STATION_STAGES[Math.min(n, STATION_STAGES.length - 1)];
      h += `<h3>Radar and communications station</h3><div class="say">${STATION_TEXT}<br>${STATION_STAGES.map((x, i) => `<span style="color:${i < n ? 'var(--xp)' : i === n ? 'var(--txt)' : '#6a8a70'}">${i + 1}. ${x.title}${i < n ? ' ✓' : ''}</span>`).join(' · ')}${n < STATION_STAGES.length ? `<br><b>${st.title}.</b> ${st.text}` : ''}</div>`;
    } else h += `<h3>${PROJECTS[k].name}</h3><div class="say">${PROJECTS[k].description}</div>`;
    if (building(s, 'project', k)) { h += jobHTML(s, 'project', k, k === 'comms' && big ? STATION_STAGES[Math.min(stationStage(s), STATION_STAGES.length - 1)].title.toLowerCase() : PROJECTS[k].name.toLowerCase()); continue; }
    h += projectPlan(s, k).map((r) => `<div class="shoprow">${ITEMS[r.k].name}: ${r.given}/${r.n} · in stock: ${has(r.k)}</div>`).join('');
    const why = projectProblem(s, k);
    if (k === 'comms' && projectDone(s, k)) continue;
    if (k === 'comms' && !atComms) h += `<div class="say">${big ? 'The station' : 'Receiver'}: ${ruin?.name ?? 'search the nearby ruins'}${big && ruin ? ` (${(worldDist(v.x, v.z, ruin.x, ruin.z) / 1000).toFixed(1)} km out)` : ''}. Its console is outside the west wall of the ruins. Follow the tutorial marker; no GPS is needed to find it.${big ? ' Materials are handed over from the village stores at the console.' : ''}</div>`;
    else if (k === 'relay' && !satelliteUp(c.towns[GRIDHOLM_ID])) h += '<div class="say">No satellite answers yet: Gridholm\'s radar and communications station must be restored first.</div>';
    else if (!why) h += `<button class="opt" data-devbuild="${k}" data-devvid="${vid}">Hand over materials and build</button>`;
    else h += `<div class="say">${why}</div>`;
  }
  if (atComms && projectDone(s, 'comms')) h += `<button class="opt" data-devgps="${vid}">Receive my GPS tablet</button>`;
  if (atComms && projectDone(s, 'relay')) h += `<div class="say">The relay mast stands: orbital scans within ${RELAY.reach / 1000} km of ${v.name} use its own passes and reach ${RELAY.r / 1000} km.</div>`;
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
    if (k === 'relay' && !satelliteUp(c.towns[GRIDHOLM_ID])) return 'No satellite answers yet: restore Gridholm\'s station first.';
    if (k === 'comms' || k === 'relay') {
      const r = linkRuin(c.world, v, s), spot = r && { x: r.rect.x0 - 3, z: r.z };
      if (!atComms || !spot || worldDist(spot.x, spot.z, G.pos.x, G.pos.z) > 4) return 'Restore this receiver at the marked ruin console.';
    }
    const why = projectProblem(s, k); if (why) return why;
    const seed = villageSeed(c.world, v), has = stockHas(vid);
    settleOwn(c.world, v, seed, s, c.time);
    const result = buildProject(s, k, has, c.time); stockTake(vid, result.taken);
    anchorNew(c.world, v, seed, s, c.time);
    if (result.started) {
      const what = k === 'comms' && isStation(s) ? STATION_STAGES[stationStage(s)].title.toLowerCase() : PROJECTS[k].name.toLowerCase();
      msg = `All the materials are in. The builders start on the ${what}: ${buildersLine(s, 'project', k)}`;
    } else msg = result.taken.length ? 'Materials delivered. The remaining requirements are shown below.' : 'Bring the missing materials to the village stores first.';
  }
  calcStats(); saveChar(); return msg;
}
