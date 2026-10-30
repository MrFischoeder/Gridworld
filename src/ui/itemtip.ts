// The item tooltip: hover the mouse over any item slot (or anything carrying data-k) and a panel follows the cursor
// with everything about the item: its kind, what it does, its numbers (weapon and armour values, food, attachments'
// effects), weight and bulk, the stack, what the traders ask for it and what it is used for (data/uses.ts).
// (0.279) Over an item of yours in the backpack window the sheet stands beside the slot instead, with the item's
// buttons at the top (Eat, Use, Modify...): move the mouse onto it and click, without going through the whole window.
import { CLOTH_TEMP } from '../gen/temperature';
import { classOf, CLASS_NAME } from '../data/itemclass';
import { ITEMS, BULK, WEAR, WEAR_NAME, PACK, PACK_VOL, EXO, HEAL, HANDS_ONLY, HAND_TOOLS, GEAR_PRICE, TOOL_PRICE, SUPPLY_PRICE, PART_PRICE, ATTACH_PRICE, type ItemKey, type ItemType, type ItemDef } from '../data/items';
import { NOURISH, BLADE } from '../data/survival';
import { BLASTER, ATTACHMENTS, SLOT_NAME, GUNS, MELEE, gunStats, type GunStats } from '../data/weapons';
import { GOOD_INFO } from '../gen/market';
import { MASK } from '../gen/toxic';
import { RARE_VALUE, isRare } from '../gen/deposits';
import { usesOf } from '../data/uses';
import { itemIcon } from './icons';
import { CARGO, LIQUID, boxCap } from '../data/cargo';
import { tl, TL, lang } from '../i18n';

export const TYPE_NAME: Record<ItemType, string> = {
  relic: tl('Exoskeleton module'), cons: tl('Consumable'), key: tl('Key'), part: tl('Vehicle part'), quest: tl('Quest item'), attach: tl('Weapon attachment'),
  mat: tl('Material'), tool: tl('Tool'), weapon: tl('Weapon'), wear: tl('Clothing and armour'), good: tl('Trade good'), ammo: tl('Ammunition'), cargo: tl('Crate or barrel'), bag: tl('Backpack'),
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
  const out = [TL`Fits the ${SLOT_NAME[a.slot].toLowerCase()} slot of any gun (shown here on the Blaster)`];
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
  { const cg = CARGO[k]; if (cg) out.push(cg.kind === 'barrel' // (0.247) crates and barrels
    ? TL`holds ${cg.cap} litres of one liquid: ${boxCap(k, 'fuel')} Fuel Canisters, ${boxCap(k, 'lampoil')} Lamp Oil or ${boxCap(k, 'milk')} churns of milk`
    : TL`holds ${cg.cap} litres of one kind of building stuff: ${boxCap(k, 'planks')} planks, ${boxCap(k, 'stone')} stones or ${boxCap(k, 'ironO')} lumps of ore`, tl('one takes a vehicle\'s cargo bay; fill it by dragging items onto it')); }
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
export function itemTip(k: ItemKey, n = 1, c?: number, b?: string, m?: string): string {
  const it = ITEMS[k] as ItemDef | undefined;
  if (!it) return '';
  const [kg, l] = BULK[k] ?? [0, 0], stats = statLines(k), uses = usesOf(k), price = priceLine(k);
  let s = `<div class="tiphead">${itemIcon(k)}<div><b>${it.name}</b><div class="tiptype t-${it.type}">${TYPE_NAME[it.type]}</div></div></div>`;
  s += `<div class="tipdesc">${it.desc}</div>`;
  { const cl = classOf(k); if (cl) s += `<div class="tipline">class: ${CLASS_NAME[cl]}</div>`; }
  if (CARGO[k]) { const [bk, bn] = (b ?? '').split(':'), ik = bk as ItemKey; s += `<div class="tipline">${ITEMS[ik] ? TL`holds ${ITEMS[ik].name} ×${bn} of ${boxCap(k, ik)}${LIQUID[ik] ? TL` (${Math.round(+bn * LIQUID[ik]!)} L)` : ''}` : tl('empty')}</div>`; }
  if (c !== undefined) s += `<div class="tipline">condition <span class="${c < 35 ? 'bad' : ''}">${Math.round(c)}%</span></div>`;
  if (stats.length) s += `<div class="tipstats">${stats.map((x) => `<div>${x}</div>`).join('')}</div>`;
  { const fit = (m ?? '').split(',').filter((x) => ITEMS[x as ItemKey]) as ItemKey[], gun = GUNS[k]; // (0.279) this gun's own attachments
    if (fit.length && gun) { const g = gunStats(gun, (m ?? '').split(',').map((x) => (ITEMS[x as ItemKey] ? x as ItemKey : null)));
      s += `<div class="tipstats"><div>${TL`fitted: ${fit.map((x) => ITEMS[x].name).join(', ')}`}</div><div>${TL`with them: damage ${+g.dmg.toFixed(2)} · ${(1 / g.interval).toFixed(1)} shots/s · range ${Math.round(g.range)} m · magazine ${g.mag} · zoom ${g.zoom}×`}</div></div>`; } }
  s += TL`<div class="tipline">${kg} kg · ${l} L each${n > 1 ? TL` · this stack: ${n} = ${+(kg * n).toFixed(2)} kg, ${+(l * n).toFixed(2)} L` : ''}${it.stack ? TL` · stacks to ${it.stack}` : ''}</div>`;
  if (price) s += `<div class="tipline">${price}</div>`;
  if (uses.length) s += TL`<div class="tipuses"><span>Used for</span>${uses.map(([g, xs]) => `<div><i>${g}:</i> ${xs.slice(0, 7).join(', ')}${xs.length > 7 ? TL` and ${xs.length - 7} more` : ''}</div>`).join('')}</div>`;
  return s;
}

// ---------- the floating panel ----------
/** (0.279) The buttons for an element (an item of yours in the backpack window), or null for a plain sheet. */
export interface TipActions { key: string; acts: [string, string][]; run(act: string): void }
let actionsOf: (el: HTMLElement) => TipActions | null = () => null;
export function setTipActions(f: (el: HTMLElement) => TipActions | null) { actionsOf = f; }
let tip: HTMLDivElement | null = null, shown = '', pinned: TipActions | null = null, leaveT = 0;
/** A pinned sheet stands beside its slot: right of it, else left; its top at the slot's top. */
function pin(el: HTMLElement) {
  const t = tip!, r = el.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight;
  let x = r.right + 6;
  if (x + w > innerWidth - 8) x = Math.max(8, r.left - w - 6);
  const y = Math.max(8, Math.min(r.top - 4, innerHeight - h - 8));
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
function place(e: PointerEvent) {
  const t = tip!, w = t.offsetWidth, h = t.offsetHeight;
  let x = e.clientX + 18, y = e.clientY + 18;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  if (y + h > innerHeight - 8) y = Math.max(8, innerHeight - h - 8);
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
function hide() { if (tip) { tip.style.display = 'none'; tip.classList.remove('acts'); } shown = ''; pinned = null; clearTimeout(leaveT); leaveT = 0; }
/** Starts following the mouse over anything with data-k (every item slot, shop rows): called once at start-up. */
export function initItemTips() {
  tip = document.createElement('div'); tip.id = 'itip'; document.body.appendChild(tip);
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const target = e.target as HTMLElement | null;
    if (pinned && target && tip!.contains(target)) { clearTimeout(leaveT); leaveT = 0; return; } // on the sheet's buttons
    const el = target?.closest?.<HTMLElement>('[data-k]');
    if (!el || document.pointerLockElement || document.querySelector('.slot.ghost')) {
      if (pinned) { if (!leaveT) leaveT = window.setTimeout(hide, 300); } else hide(); // a moment to reach the sheet
      return;
    }
    clearTimeout(leaveT); leaveT = 0;
    const k = el.dataset.k as ItemKey, acts = actionsOf(el);
    const key = `${acts?.key ?? ''}|${k}|${el.dataset.n ?? ''}|${el.dataset.c ?? ''}|${el.dataset.b ?? ''}|${el.dataset.m ?? ''}|${acts?.acts.map((a) => a[0]).join() ?? ''}`;
    if (key !== shown) {
      const body = itemTip(k, +(el.dataset.n ?? 1) || 1, el.dataset.c ? +el.dataset.c : undefined, el.dataset.b, el.dataset.m);
      const btns = acts ? `<div class="tipacts">${acts.acts.map(([a, t]) => `<button class="${a === 'drop' ? 'drop' : ''}" data-ta="${a}">${t}</button>`).join('')}</div>` : '';
      tip!.innerHTML = btns ? body.replace('</div></div></div>', '</div></div></div>' + btns) : body; // the buttons right under the name (after the head)
      tip!.classList.toggle('acts', !!acts);
      shown = key; pinned = acts;
    }
    tip!.style.display = 'block';
    if (pinned) pin(el); else place(e);
  });
  tip.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ta]');
    if (!b || !pinned) return;
    const p = pinned; hide(); p.run(b.dataset.ta!);
  });
  addEventListener('pointerdown', (e) => { if (!tip!.contains(e.target as Node)) hide(); });
  addEventListener('keydown', hide);
}
