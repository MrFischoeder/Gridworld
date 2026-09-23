// Survival: stamina, food and water (numbers in data/survival.ts).
// Stamina is spent by effort and comes back when you ease off; run it dry and you are exhausted for a while.
// Food and water run down with game time, faster when you exert yourself; low, you tire and recover slowly;
// empty, you start losing health. Eating and drinking (items, wells, lakes) fill them back up.
import { G } from '../game';
import { STAMINA, DRAIN, LOW, STARVE_DPS } from '../data/survival';
import { MIN_PER_SEC } from '../core/time';
import { $, logLine, showToast } from '../ui/hud';

const bar = { st: $('stfill'), food: $('foodfill'), water: $('waterfill'), foodBox: $('foodbar'), waterBox: $('waterbar') };

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
/** Eat or drink: food, water and health points. */
export function nourish(food: number, water: number, hp = 0) {
  const c = G.char;
  c.food = Math.min(100, c.food + food); c.water = Math.min(100, c.water + water);
  if (hp) G.hp = Math.min(G.S.maxHp, G.hp + hp);
  logLine([food && `food +${food}`, water && `water +${water}`, hp && `+${hp} HP`].filter(Boolean).join(', '));
}

let warnT = 0, lastLow = '';
/** Once a frame while playing (in the open world and underground alike). */
export function updateSurvival(dt: number) {
  const c = G.char, gameMin = dt * MIN_PER_SEC, busy = G.effortT < 0.5 ? DRAIN.effort : 1;
  if (G.god) { c.food = c.water = 100; G.stamina = STAMINA.max; G.exhausted = false; }
  c.water = Math.max(0, c.water - DRAIN.water * gameMin * busy);
  c.food = Math.max(0, c.food - DRAIN.food * gameMin * busy);
  // stamina comes back after a moment's rest; hunger and thirst slow it down
  G.effortT += dt;
  const slow = (c.water < LOW ? 0.5 : 1) * (c.food < LOW ? 0.6 : 1);
  if (G.effortT > STAMINA.regenDelay) G.stamina = Math.min(STAMINA.max, G.stamina + STAMINA.regen * slow * dt);
  if (G.exhausted && G.stamina >= STAMINA.recover) G.exhausted = false;
  // starving or parched: health drains away
  const empty = (c.water <= 0 ? 1 : 0) + (c.food <= 0 ? 1 : 0);
  if (empty) { G.hp -= STARVE_DPS * empty * dt; }
  const low = c.water <= 0 ? 'You are dying of thirst!' : c.food <= 0 ? 'You are starving!' : c.water < LOW ? 'You are thirsty.' : c.food < LOW ? 'You are hungry.' : '';
  warnT -= dt;
  if (low && (low !== lastLow || warnT <= 0)) { logLine(low); warnT = empty ? 20 : 60; }
  lastLow = low;
  // HUD
  bar.st.style.width = G.stamina / STAMINA.max * 100 + '%';
  bar.st.style.background = G.exhausted ? 'var(--amber)' : '#d8ff7a';
  bar.food.style.width = c.food + '%'; bar.water.style.width = c.water + '%';
  bar.foodBox.classList.toggle('low', c.food < LOW); bar.waterBox.classList.toggle('low', c.water < LOW);
}
