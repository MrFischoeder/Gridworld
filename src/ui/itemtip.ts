// The item tooltip: hover the mouse over any item slot (or anything carrying data-k) and a panel follows the cursor
// with everything about the item: its kind, what it does, its numbers (weapon and armour values, food, attachments'
// effects), weight and bulk, the stack, what the traders ask for it and what it is used for (data/uses.ts).
import { CLOTH_TEMP } from '../gen/temperature';
import { classOf, CLASS_NAME } from '../data/itemclass';
import { ITEMS, BULK, WEAR, WEAR_NAME, PACK, PACK_VOL, EXO, HEAL, HANDS_ONLY, HAND_TOOLS, GEAR_PRICE, TOOL_PRICE, SUPPLY_PRICE, PART_PRICE, ATTACH_PRICE, type ItemKey, type ItemType, type ItemDef } from '../data/items';
import { NOURISH, BLADE } from '../data/survival';
import { BLASTER, ATTACHMENTS, SLOT_NAME, GUNS, MELEE, type GunStats } from '../data/weapons';
import { GOOD_INFO } from '../gen/market';
import { MASK } from '../gen/toxic';
import { RARE_VALUE, isRare } from '../gen/deposits';
import { usesOf } from '../data/uses';
import { itemIcon } from './icons';
import { tl, TL, lang } from '../i18n';

export const TYPE_NAME: Record<ItemType, string> = {
  relic: tl('Relic module'), cons: tl('Consumable'), key: tl('Key'), part: tl('Vehicle part'), quest: tl('Quest item'), attach: tl('Weapon attachment'),
  mat: tl('Material'), tool: tl('Tool'), weapon: tl('Weapon'), wear: tl('Clothing and armour'), good: tl('Trade good'), ammo: tl('Ammunition'),
};
const PREFIX = /^(Crate of |Sack of |Flask of |Barrel of |Bolt of |Churn of |Basket of |Cup of )/;
/** The name shortened for a slot's label ("Sack of Grain" -> "Grain"). */
export const shortName = (k: ItemKey) => (lang === 'en' ? ITEMS[k].name.replace(PREFIX, '') : ITEMS[k].name); // (0.190) the Polish names stay whole

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
/** What an attachment changes on the Blaster. */
function attachLines(k: ItemKey): string[] {
  const a = ATTACHMENTS[k];
  if (!a) return [];
  const b = { ...BLASTER.base }, s: GunStats = { ...b };
  a.apply(s);
  const out = [TL`Fits the ${SLOT_NAME[a.slot].toLowerCase()} slot of the Blaster`];
  if (s.dmg !== b.dmg) out.push(`damage ${pct(s.dmg / b.dmg - 1)}`);
  if (s.interval !== b.interval) out.push(TL`fire rate ${pct(b.interval / s.interval - 1)}`);
  if (s.range !== b.range) out.push(TL`range ${s.range - b.range > 0 ? '+' : ''}${s.range - b.range} m`);
  if (s.mag !== b.mag) out.push(`magazine ${b.mag} → ${s.mag}`);
  if (s.reload !== b.reload) out.push(TL`reload ${pct(s.reload / b.reload - 1)} time`);
  if (s.zoom !== b.zoom) out.push(`zoom ${s.zoom}×`);
  if (s.noise !== b.noise) out.push(TL`noise heard ${Math.round(b.noise)} → ${Math.round(s.noise)} m`);
  return out;
}
/** The item's numbers, one per line. */
function statLines(k: ItemKey): string[] {
  const out: string[] = [], w = WEAR[k], f = NOURISH[k];
  const gun = GUNS[k], mel = MELEE[k];
  if (gun) { const s = gun.base; out.push(TL`damage ${s.dmg}${gun.pellets ? ` × ${gun.pellets} pellets` : ''} a shot · ${(1 / s.interval).toFixed(s.interval > 0.5 ? 1 : 0)} shots/s`, TL`range ${s.range} m · magazine ${s.mag} · reload ${s.reload} s${s.zoom >= 2 ? ` · scope ${s.zoom}×` : ''}`, TL`fires ${ITEMS[gun.ammo].name} · heard ${s.noise} m away${gun.slots.length ? TL` · ${gun.slots.length} attachment slots` : ''}`); }
  if (mel) out.push(TL`damage ${mel.dmg} a swing · a swing every ${mel.rate} s · reach ${mel.reach} m`, TL`each swing costs ${mel.stamina === 1 ? '' : TL`${mel.stamina}× the `}stamina${mel.stamina === 1 ? '' : tl(' of a blade swing')}; exhausted: slower and half as strong`);
  const users = Object.values(GUNS).filter((g) => g!.ammo === k).map((g) => g!.name);
  if (users.length) out.push(TL`rounds for the ${users.join(tl(' and the '))} · loaded when you reload (R)`);
  void BLADE;
  if (w) out.push(TL`worn on: ${WEAR_NAME[w.slot]}${w.def ? TL` · takes ${Math.round(w.def * 100)}% off every hit` : ''}`);
  const ct = CLOTH_TEMP[k];
  if (ct) out.push([ct.warm ? TL`+${ct.warm} °C against the cold` : '', ct.cool ? TL`−${ct.cool} °C in the heat` : ''].filter(Boolean).join(' · '));
  if (PACK_VOL[k]) out.push(TL`the backpack holds ${PACK_VOL[k]} L (${PACK.vol} without it)`);
  const x = EXO[k];
  if (x) out.push(TL`carry ${PACK.comfy + x.comfy} kg with ease (${PACK.comfy} without) · overloaded past ${PACK.max + x.max} kg (${PACK.max})`, TL`walk and run ${Math.round((x.speed - 1) * 100)}% faster · sprinting and swimming cost ${Math.round((1 - x.stamina) * 100)}% less stamina`);
  if (k === 'gasmask') out.push(tl('keeps out toxic fog while a filter is fitted'));
  if (k === 'filter') out.push(TL`lasts ${MASK.filter / 60} min in the thickest fog, longer in thin fog`);
  if (f) out.push([f.kcal ? `${f.kcal} kcal` : '', f.water ? `+${f.water} water` : '', f.hp ? `+${f.hp} HP` : ''].filter(Boolean).join(' · '));
  if (HEAL[k]) out.push(TL`heals ${HEAL[k]} HP`);
  out.push(...attachLines(k));
  if (HANDS_ONLY.has(k)) out.push(tl('too big for the backpack: carried in your hands'));
  if (HAND_TOOLS.has(k)) out.push(tl('works only from your hands: take it in your hands to use it'));
  return out;
}
/** What the traders ask for it (new), or the base market price of a trade good. */
function priceLine(k: ItemKey): string {
  const p = GEAR_PRICE[k] ?? TOOL_PRICE[k] ?? SUPPLY_PRICE[k] ?? PART_PRICE[k] ?? ATTACH_PRICE[k];
  if (p) return TL`shop price ${p} g`;
  const g = (GOOD_INFO as Record<string, { base: number } | undefined>)[k];
  if (g) return TL`market price about ${g.base} g a crate (cheaper where it is made, dearer where it is wanted)`;
  return isRare(k) ? TL`no market trades it: dug at the villages that stand by a deposit, worth about ${RARE_VALUE[k]} g a crate to the works` : '';
}

/** The full tooltip for an item (n: how many in the stack, c: condition in percent). */
export function itemTip(k: ItemKey, n = 1, c?: number): string {
  const it = ITEMS[k] as ItemDef | undefined;
  if (!it) return '';
  const [kg, l] = BULK[k] ?? [0, 0], stats = statLines(k), uses = usesOf(k), price = priceLine(k);
  let s = `<div class="tiphead">${itemIcon(k)}<div><b>${it.name}</b><div class="tiptype t-${it.type}">${TYPE_NAME[it.type]}</div></div></div>`;
  s += `<div class="tipdesc">${it.desc}</div>`;
  { const cl = classOf(k); if (cl) s += `<div class="tipline">class: ${CLASS_NAME[cl]}</div>`; }
  if (c !== undefined) s += `<div class="tipline">condition <span class="${c < 35 ? 'bad' : ''}">${Math.round(c)}%</span></div>`;
  if (stats.length) s += `<div class="tipstats">${stats.map((x) => `<div>${x}</div>`).join('')}</div>`;
  s += TL`<div class="tipline">${kg} kg · ${l} L each${n > 1 ? TL` · this stack: ${n} = ${+(kg * n).toFixed(2)} kg, ${+(l * n).toFixed(2)} L` : ''}${it.stack ? TL` · stacks to ${it.stack}` : ''}</div>`;
  if (price) s += `<div class="tipline">${price}</div>`;
  if (uses.length) s += TL`<div class="tipuses"><span>Used for</span>${uses.map(([g, xs]) => `<div><i>${g}:</i> ${xs.slice(0, 7).join(', ')}${xs.length > 7 ? TL` and ${xs.length - 7} more` : ''}</div>`).join('')}</div>`;
  return s;
}

// ---------- the floating panel ----------
let tip: HTMLDivElement | null = null, shown = '';
function place(e: PointerEvent) {
  const t = tip!, w = t.offsetWidth, h = t.offsetHeight;
  let x = e.clientX + 18, y = e.clientY + 18;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  if (y + h > innerHeight - 8) y = Math.max(8, innerHeight - h - 8);
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
function hide() { if (tip) tip.style.display = 'none'; shown = ''; }
/** Starts following the mouse over anything with data-k (every item slot, shop rows): called once at start-up. */
export function initItemTips() {
  tip = document.createElement('div'); tip.id = 'itip'; document.body.appendChild(tip);
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-k]');
    if (!el || document.pointerLockElement || document.querySelector('.slot.ghost')) { hide(); return; }
    const k = el.dataset.k as ItemKey, key = `${k}|${el.dataset.n ?? ''}|${el.dataset.c ?? ''}`;
    if (key !== shown) { tip!.innerHTML = itemTip(k, +(el.dataset.n ?? 1) || 1, el.dataset.c ? +el.dataset.c : undefined); shown = key; }
    tip!.style.display = 'block';
    place(e);
  });
  addEventListener('pointerdown', hide);
  addEventListener('keydown', hide);
}
