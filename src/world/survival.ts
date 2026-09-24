// Survival: stamina, calories, the stomach, water and the weight you carry (numbers in data/survival.ts and
// data/items.ts PACK). Stamina is spent by effort and comes back when you ease off; run it dry and you are exhausted
// for a while. The body burns calories all the time, faster the harder you work and the more you carry; food adds
// them back, but only as much as the stomach holds, and it digests slowly. Water runs down with time. Hungry or
// thirsty, you tire and recover slowly; starving or parched, you lose health.
import { G } from '../game';
import { STAMINA, DRAIN, LOW, STARVE_DPS, KCAL, STOMACH, burnPerMin } from '../data/survival';
import { PACK } from '../data/items';
import { weightOf, bulkOf } from '../inventory';
import { MIN_PER_SEC } from '../core/time';
import { $, logLine, showToast } from '../ui/hud';

const bar = { st: $('stfill'), food: $('foodfill'), belly: $('bellyfill'), water: $('waterfill'), foodBox: $('foodbar'), waterBox: $('waterbar'), stLbl: $('stlbl'), foodLbl: $('foodlbl') };

// ---------- carrying ----------
export type Load = 'ok' | 'heavy' | 'over';
/** What the backpack weighs (kg), how full it is (litres) and how it feels. */
export function load() {
  const kg = weightOf(G.char.inv), vol = bulkOf(G.char.inv);
  return { kg, vol, state: (kg > PACK.max ? 'over' : kg > PACK.comfy ? 'heavy' : 'ok') as Load };
}
/** Walking speed factor from the load: free up to PACK.comfy, then slower; overloaded you can barely walk. */
export function loadSpeed(kg: number) {
  if (kg <= PACK.comfy) return 1;
  if (kg <= PACK.max) return 1 - 0.3 * (kg - PACK.comfy) / (PACK.max - PACK.comfy);
  return 0.45;
}

// ---------- stamina ----------
/** Spend stamina on an effort. Returns false (and spends nothing) when there is not enough or you are exhausted. */
export function spendStamina(n: number, force = false): boolean {
  if (G.god) return true;
  if (!force && (G.exhausted || G.stamina < n * 0.5)) return false;
  G.stamina = Math.max(0, G.stamina - n); G.effortT = 0;
  if (G.stamina <= 0 && !G.exhausted) { G.exhausted = true; showToast('Exhausted'); }
  return true;
}
/** Continuous effort (sprinting, swimming): n per second. Returns whether you still can. */
export function drainStamina(n: number, dt: number): boolean {
  if (G.god) return true;
  if (G.exhausted) return false;
  G.stamina = Math.max(0, G.stamina - n * dt); G.effortT = 0;
  if (G.stamina <= 0) { G.exhausted = true; showToast('Exhausted'); }
  return true;
}
/** A one-off effort that burns calories (a jump, a blade swing). */
export const burn = (kcal: number) => { if (!G.god) G.char.kcal = Math.max(0, G.char.kcal - kcal); };

// ---------- eating ----------
/** Eat or drink: calories into the store (the food's weight into the stomach), water and health points. */
export function nourish(kcal: number, water: number, hp = 0, kg = 0) {
  const c = G.char;
  c.kcal = Math.min(KCAL.max, c.kcal + kcal); c.water = Math.min(100, c.water + water);
  c.stomach = Math.min(STOMACH.cap, c.stomach + kg);
  if (hp) G.hp = Math.min(G.S.maxHp, G.hp + hp);
  const full = c.stomach >= STOMACH.cap - 0.1 ? ' · your stomach is full' : '';
  logLine([kcal && `+${kcal} kcal`, water && `water +${water}`, hp && `+${hp} HP`].filter(Boolean).join(', ') + full);
}

let warnT = 0, lastLow = '';
/** Once a frame while playing (in the open world and underground alike). */
export function updateSurvival(dt: number) {
  const c = G.char, gameMin = dt * MIN_PER_SEC, busy = G.effortT < 0.5 ? DRAIN.effort : 1, L = load();
  if (G.god) { c.kcal = KCAL.max; c.water = 100; G.stamina = STAMINA.max; G.exhausted = false; }
  c.water = Math.max(0, c.water - DRAIN.water * gameMin * busy);
  c.kcal = Math.max(0, c.kcal - burnPerMin(G.activity, L.kg) * gameMin);
  G.activity = 1; // the player's movement sets it again for the next frame (not at all while driving)
  c.stomach = Math.max(0, c.stomach - STOMACH.digest / 60 * gameMin);
  // stamina comes back after a moment's rest; hunger, thirst and a heavy pack slow it down
  G.effortT += dt;
  const slow = (c.water < LOW ? 0.5 : 1) * (c.kcal < KCAL.low ? 0.6 : 1) * (L.state === 'over' ? 0.5 : L.state === 'heavy' ? 0.8 : 1);
  if (G.effortT > STAMINA.regenDelay) G.stamina = Math.min(STAMINA.max, G.stamina + STAMINA.regen * slow * dt);
  if (G.exhausted && G.stamina >= STAMINA.recover) G.exhausted = false;
  // starving or parched: health drains away
  const empty = (c.water <= 0 ? 1 : 0) + (c.kcal <= 0 ? 1 : 0);
  if (empty) { G.hp -= STARVE_DPS * empty * dt; }
  const low = c.water <= 0 ? 'You are dying of thirst!' : c.kcal <= 0 ? 'You are starving!' : c.water < LOW ? 'You are thirsty.' : c.kcal < KCAL.low ? 'You are hungry.' : '';
  warnT -= dt;
  if (low && (low !== lastLow || warnT <= 0)) { logLine(low); warnT = empty ? 20 : 60; }
  lastLow = low;
  // HUD
  bar.st.style.width = G.stamina / STAMINA.max * 100 + '%';
  bar.st.style.background = G.exhausted ? 'var(--amber)' : '#d8ff7a';
  bar.food.style.width = c.kcal / KCAL.max * 100 + '%'; bar.water.style.width = c.water + '%';
  bar.belly.style.width = c.stomach / STOMACH.cap * 100 + '%';
  bar.foodBox.classList.toggle('low', c.kcal < KCAL.low); bar.waterBox.classList.toggle('low', c.water < LOW);
  bar.foodLbl.textContent = `${Math.round(c.kcal)} kcal${c.stomach >= STOMACH.cap - 0.15 ? ' (full)' : ''} · water`;
  bar.stLbl.textContent = L.state === 'over' ? 'stamina · OVERLOADED' : L.state === 'heavy' ? 'stamina · heavy load' : 'stamina';
  bar.stLbl.classList.toggle('warn', L.state !== 'ok');
}
