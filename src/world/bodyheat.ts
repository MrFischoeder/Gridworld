// (0.234, PLAN_BIOMOW.md stage B4a) The body's heat: the air of the biome you stand in (gen/temperature.ts), what you
// wear, a fire or a torch near you and a roof over you make what you feel; the body follows it slowly (`Char.body`,
// saved, personal). Freezing you burn more calories and tire; overheating you lose more water and tire; never health.
// Writes BODY_FX for world/survival.ts and world/player.ts; the HUD line under the food bar and the clock's °C.
import { G } from '../game';
import { airTemp, feltTemp, bodyTarget, stepBody, bodyState, bodyEffects, clothing, TEMP, type BodyState } from '../gen/temperature';
import { daylight, sunTilt } from '../core/time';
import { latitude } from '../gen/regions';
import { seen } from './weather';
import { carriedLight } from './light';
import { fireSpots } from './cooking';
import { campFires, inVillage } from './overworld';
import { insideHouse } from './houses';
import { driving } from './vehicles';
import { VEHICLES } from '../data/vehicles';
import { BODY_FX } from './bodystate';
import { WEAR_SLOTS } from '../data/items';
import { $, logLine } from '../ui/hud';
import { tl, TL } from '../i18n';

const el = { row: $('heatrow'), fill: $('heatfill'), lbl: $('heatlbl') };
/** What you feel now (°C), the air (°C), and what keeps you warm or cool (for the HUD and the backpack). */
export const heatNow = { air: 15, felt: 15, warm: 0, cool: 0, shelter: '' as '' | 'house' | 'village' | 'cab', fire: false };
let last: BodyState = 'ok', sampleT = 0, logT = 0;

/** The air where you are (°C): the biome's outdoors, fixed under the ground. */
function air(): number {
  const c = G.char;
  if (c.loc === 'dungeon') return c.dungeon?.cave ? TEMP.under.cave : TEMP.under.dungeon;
  const p = G.pos, day = daylight(c.time, sunTilt(latitude(p.z)));
  return airTemp(c.world, p.x, p.z, p.y, { day, rain: seen.rain, storm: seen.storm, cloud: seen.cloud, wind: seen.wind });
}
/** °C added by a fire within reach, a torch or a lamp in your hand. */
function warmth(): number {
  const p = G.pos, F = TEMP.fire;
  let add = 0;
  const fires = G.char.loc === 'overworld' ? [...fireSpots(), ...campFires()] : fireSpots();
  for (const f of fires) { const d = Math.hypot(f.x - p.x, f.z - p.z); if (d < F.r && Math.abs(f.y - p.y) < 3) add = Math.max(add, F.add * (1 - d / F.r)); }
  heatNow.fire = add > 0;
  const l = carriedLight();
  return add + (l === 3 ? TEMP.torch : l === 2 ? TEMP.lamp : 0);
}
/** How much a roof pulls the air towards a room's: a house, a village's wall, a closed cab. */
function shelter(): number {
  heatNow.shelter = '';
  if (G.char.loc !== 'overworld') return 0;
  const p = G.pos, v = driving.v;
  if (v && VEHICLES[v.st.model].enclosed) { heatNow.shelter = 'cab'; return TEMP.cab; }
  if (insideHouse(p.x, p.y, p.z)) { heatNow.shelter = 'house'; return TEMP.house; }
  if (inVillage(p.x, p.z)) { heatNow.shelter = 'village'; return TEMP.village; }
  return 0;
}
const STATE_LINE: Record<BodyState, string> = {
  freezing: tl('You are freezing: you burn through food and tire quickly. Get to a fire, a roof or warmer clothes.'),
  cold: tl('You are getting cold: your body burns more calories.'),
  ok: tl('Your body is at a comfortable warmth again.'),
  hot: tl('You are getting hot: you sweat and need more water.'),
  overheated: tl('You are overheating: you sweat out water and tire quickly. Find shade, water or lighter clothes.'),
};
const STATE_NAME: Record<BodyState, string> = { freezing: tl('freezing'), cold: tl('cold'), ok: tl('comfortable'), hot: tl('hot'), overheated: tl('overheating') };

/** Once a frame while playing. */
export function updateBodyHeat(dt: number) {
  const c = G.char;
  if ((sampleT -= dt) <= 0) {
    sampleT = 0.5;
    const cl = clothing(WEAR_SLOTS.map((s) => c.wear[s]));
    heatNow.warm = cl.warm; heatNow.cool = cl.cool;
    heatNow.air = air();
    heatNow.felt = feltTemp({ air: heatNow.air, warm: cl.warm, cool: cl.cool, heat: warmth(), shelter: shelter(), swimming: G.swimming });
  }
  let b = c.body ?? 0;
  b = G.god ? 0 : stepBody(b, bodyTarget(heatNow.felt), dt);
  const tg = bodyTarget(heatNow.felt);
  c.body = tg === 0 && Math.abs(b) < 0.05 ? 0 : b; // settles to a clean 0 once at ease
  Object.assign(BODY_FX, bodyEffects(b));
  const st = bodyState(b);
  logT -= dt;
  // a change is told once it holds a little past the threshold (no chatter on the border)
  if (st !== last && bodyState(b * 0.92) === st) { if (logT <= 0 || st !== 'ok') logLine(STATE_LINE[st]); logT = 20; last = st; }
  // the HUD: shown once the body leaves its comfort a little
  const show = Math.abs(b) > 10;
  el.row.style.display = show ? '' : 'none';
  if (show) {
    el.fill.style.width = Math.min(100, Math.abs(b)) + '%';
    el.fill.style.background = b < 0 ? '#7ad0ff' : '#ff9a4a';
    const why = heatNow.fire ? tl(' · by the fire') : heatNow.shelter === 'house' ? tl(' · indoors') : heatNow.shelter === 'cab' ? tl(' · in the cab') : '';
    el.lbl.textContent = TL`${STATE_NAME[st]} · feels ${Math.round(heatNow.felt)} °C${why}`;
    el.lbl.classList.toggle('warn', st !== 'ok');
  }
}
/** The air's temperature for the clock line. */
export const airText = () => `${Math.round(heatNow.air)} °C`;
/** After a death: a new body, at ease. */
export function resetBodyHeat() { G.char.body = 0; last = 'ok'; Object.assign(BODY_FX, bodyEffects(0)); }
