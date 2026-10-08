// (0.180, the fuel plan's P4) Charging electric vehicles at a settlement's charging post (gen/settlement.ts 'charger',
// built as a project). Every second each of your electric vehicles parked within CHARGER.reach of a built post takes
// up to CHARGER.kw from the power the village has to spare (`balance().free`: after the village, its farms, its site
// and its works), at EV.price gold a kWh; one post shares its power among the vehicles at it.
// Multiplayer: the vehicle and the gold are the owner's, so the owner's game charges it; the village's spare power is
// read from the shared state, not written: two players charging at one post at once each see all of it (not synced).
import { G } from '../game';
import { allVillages, villageSeed, worldDist, nearX, findPoi, type Poi } from '../gen/regions';
import { progressive, projectDone, RESOURCE_PLOTS, CHARGER } from '../gen/settlement';
import { balance } from '../gen/energy';
import { isEV, evCap, EV, vehicleTitle } from '../data/vehicles';
import { vehicles, type Vehicle } from './vehicles';
import { saveChar } from '../character';
import { logLine, showToast } from '../ui/hud';

const postAt = (v: Poi) => { const p = RESOURCE_PLOTS.charger; return { x: v.x - 36 + p.x, z: v.z - 36 + p.z }; };
const hasPost = (v: Poi) => progressive(G.char.towns[v.id]) && projectDone(G.char.towns[v.id], 'charger');
/** Vehicles charging now (kW) and the gold owed below a whole coin. */
const charging = new Map<Vehicle, number>();
let owe = 0, tick = 0, saveT = 0;
/** The kW vehicle v is charging at (0 = not). */
export const chargingKw = (v: Vehicle) => charging.get(v) ?? 0;

export function updateCharging(dt: number) {
  if ((tick -= dt) > 0 || G.char.loc !== 'overworld') return;
  const secs = 1 - tick; tick = 1;
  const was = new Set(charging.keys()); charging.clear();
  for (const v of allVillages(G.char.world)) {
    if (worldDist(v.x, v.z, G.pos.x, G.pos.z) > 900 || !hasPost(v)) continue;
    const p = postAt(v), cars = vehicles.filter((c) => !c.ai && isEV(c.st.parts) && G.char.vehicles.includes(c.st) && Math.hypot(c.st.x - nearX(p.x, c.st.x), c.st.z - p.z) < CHARGER.reach);
    if (!cars.length) continue;
    let left = Math.min(CHARGER.kw, balance(G.char.world, v, villageSeed(G.char.world, v), G.char.towns[v.id], G.char.time).free);
    for (const c of cars) {
      const parts = c.st.parts, cap = evCap(c.st.model, parts), room = cap - parts.ev!;
      if (room <= 1e-3 || left <= 0.5 || G.char.gold < 1) continue;
      const kwh = Math.min(room, left * secs / 60); // a real second is a game minute
      parts.ev! += kwh; owe += kwh * EV.price; charging.set(c, left); left = 0;
      if (!was.has(c)) logLine(`Charging the ${vehicleTitle(c.st.model)} at ${v.name}'s post: ${Math.round(charging.get(c)!)} kW from the village's spare power.`);
      if (parts.ev! >= cap - 1e-3) { showToast('Fully charged'); logLine(`The ${vehicleTitle(c.st.model)} is fully charged: ${Math.round(cap)} kWh.`); }
    }
  }
  const pay = Math.floor(owe); if (pay > 0) { G.char.gold = Math.max(0, G.char.gold - pay); owe -= pay; }
  if (charging.size && (saveT -= secs) <= 0) { saveT = 10; saveChar(); }
  if (!charging.size && was.size) saveChar();
}
/** The village whose charging pillar you stand at, for the prompt. */
export function nearCharger(): number | null {
  if (G.char.loc !== 'overworld') return null;
  for (const v of allVillages(G.char.world)) {
    if (worldDist(v.x, v.z, G.pos.x, G.pos.z) > 400 || !hasPost(v)) continue;
    const p = postAt(v), px = nearX(p.x, G.pos.x);
    if (CHARGER.posts.some((dx) => Math.hypot(G.pos.x - (px + dx), G.pos.z - p.z) < CHARGER.near)) return v.id;
  }
  return null;
}
/** The prompt at a charging pillar: the village's spare power and what is charging. */
export function chargerPrompt(vid: number): string {
  const v = findPoi(G.char.world, vid)!, spare = Math.round(balance(G.char.world, v, villageSeed(G.char.world, v), G.char.towns[vid], G.char.time).free);
  const at = [...charging.entries()].find(([c]) => Math.hypot(c.st.x - nearX(postAt(v).x, c.st.x), c.st.z - postAt(v).z) < CHARGER.reach);
  return at ? `Charging post · ${vehicleTitle(at[0].st.model)} ${Math.round(at[0].st.parts.ev!)}/${evCap(at[0].st.model, at[0].st.parts)} kWh at ${Math.round(at[1])} kW · ${EV.price} g a kWh`
    : `Charging post · ${spare} kW spare in ${v.name} · park an electric vehicle beside it (${EV.price} g a kWh)`;
}
