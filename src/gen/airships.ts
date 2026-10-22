// (0.256, PLAN_LOTNICTWA.md stage F3, part 1) Airships the players fly themselves, and the mooring masts they tie up to.
//
// The mast is a warehouse's building (`AIRMAST`): a village's `TownState.amast` / `agiven` (from its stock at the
// warehouse terminal, the timed job 'airmast'; with the plans 'aviation'), a port's or a wild warehouse's part
// 'amast'. It draws power and wants a hand (gen/energy.ts `amastOf`, gen/workforce.ts 'airmast', gen/grid.ts). It stands
// beside the warehouse, across from the drone pad (`mastAt`).
//
// An airship is built at a mast, from the warehouse's stock, with the drive picked when its keel is laid: diesel or
// cells (`AirBuild` on the warehouse: `TownState.abuild` / `OutpostState.abuild`). Done, it is launched moored at the
// mast and goes into the shared list `Char.airships` (`Airship`); its hold is `Char.containers[id]`, like a boat's.
// The lifting gas is part of the build (the owner's choice): it never runs out. Diesel burns from its tank (R pours a
// canister); cells drain, and charge from the warehouse's power while it is moored at a working mast (`charging`).
// Pure; the flight is world/airships.ts.
import type { ItemKey } from '../data/items';
import type { TownState } from './town';
import type { OutpostState } from './outposts';
import { allVillages, nearX, villageSeed } from './regions';
import { hubWorks } from './warehouses';
import { amastOf } from './energy';
import { hash } from '../core/rng';
import { startJob, jobOf } from './construction';
import { AIRMAST, AIRSHIP, type AirDrive } from './airmast';
import type { Hub } from './warehouses';

export interface Airship {
  /** 'air:<pid>:<time>'; its middle (the envelope's), heading (forward = (sin yaw, cos yaw)); its drive and what is left. */
  id: string; x: number; y: number; z: number; yaw: number; drive: AirDrive; fuel: number; kwh: number;
  /** The warehouse whose mast it is tied to (absent: free); who built it; when. */
  moor?: string; by: string; t: number;
}
/** An airship going up at a warehouse's mast: its drive and what was handed over. */
export interface AirBuild { drive: AirDrive; given: Partial<Record<ItemKey, number>> }

// ---------- the mast ----------
export const amastPlan = (s: TownState | undefined) => AIRMAST.needs.map(([k, n]) => ({ k, n, given: Math.min(n, s?.agiven?.[k] ?? 0) }));
/** Hand over what the village's mast still needs (from its stock); with all of it in, the builders start. */
export function handOverAmast(s: TownState, have: (k: ItemKey) => number, at: number): { taken: [ItemKey, number][]; started: boolean } {
  const taken: [ItemKey, number][] = [];
  if (s.amast || jobOf(s, 'airmast')) return { taken, started: false };
  const g = (s.agiven ??= {});
  for (const r of amastPlan(s)) { const n = Math.max(0, Math.min(r.n - r.given, Math.floor(have(r.k)))); if (n) { g[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (!amastPlan(s).every((r) => r.given >= r.n)) return { taken, started: false };
  startJob(s, 'airmast', undefined, at, AIRMAST.hours);
  return { taken, started: true };
}
/** The builders are done (gen/jobs.ts). */
export function completeAmast(s: TownState, now: number) { s.amast = now; delete s.agiven; }
/** Whether warehouse h has a mooring mast. */
export const hasAmast = (h: Hub, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>) =>
  h.kind === 'village' ? !!towns[h.vid!]?.amast : !!outposts[h.id]?.done?.amast;
/** Why h's mast does not work ('' = it works): none, the warehouse stands idle, no hand, no power. A mast that does not work still holds a ship; it does not charge one. */
export function amastWhy(world: number, h: Hub, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState>, t: number): '' | 'none' | 'idle' | 'hands' | 'power' {
  if (!hasAmast(h, towns, outposts)) return 'none';
  if (!hubWorks(world, h, towns, outposts, t)) return 'idle';
  if (h.kind === 'village') { const v = allVillages(world).find((q) => q.id === h.vid); if (v) return amastOf(world, v, villageSeed(world, v), towns[v.id], t).why; }
  return '';
}
/** Where warehouse h's mast stands (its foot) and which way its moored airship lies (`a`: from the mast out, away from the warehouse). */
export function mastAt(world: number, h: Hub): { x: number; z: number; a: number } {
  const v = h.kind === 'village' ? allVillages(world).find((q) => q.id === h.vid) : undefined;
  let a = v ? Math.atan2(h.z - v.z, nearX(h.x, v.x) - v.x) : ((hash(h.x | 0, h.z | 0, 0x9ad) % 628) / 100);
  if (!Number.isFinite(a)) a = 0;
  const b = a + Math.PI / 2; // beside the warehouse, a quarter turn from the drone pad
  return { x: h.x + Math.cos(b) * 34, z: h.z + Math.sin(b) * 34, a: b };
}
/** An airship moored at a mast whose foot stands on `ground`: its middle and heading (the nose at the mast's head, the ship lying away from the warehouse). */
export function moorPose(m: { x: number; z: number; a: number }, ground: number): { x: number; y: number; z: number; yaw: number } {
  const ox = Math.cos(m.a), oz = Math.sin(m.a), half = AIRSHIP.len / 2 + 0.6;
  return { x: m.x + ox * half, y: ground + AIRMAST.h, z: m.z + oz * half, yaw: Math.atan2(-ox, -oz) };
}

// ---------- building one ----------
export const airNeeds = (d: AirDrive): [ItemKey, number][] => [...AIRSHIP.needs, ...AIRSHIP.drive[d]];
export const airRows = (b: AirBuild) => airNeeds(b.drive).map(([k, n]) => ({ k, n, given: Math.min(n, b.given[k] ?? 0) }));
/** Hand over what the airship still needs (`have` from the warehouse's stock); true once it is complete. */
export function handOverAir(b: AirBuild, have: (k: ItemKey) => number): { taken: [ItemKey, number][]; built: boolean } {
  const taken: [ItemKey, number][] = [];
  for (const r of airRows(b)) { const n = Math.max(0, Math.min(r.n - r.given, Math.floor(have(r.k)))); if (n) { b.given[r.k] = r.given + n; taken.push([r.k, n]); } }
  return { taken, built: airRows(b).every((r) => r.given >= r.n) };
}
/** A new airship, moored at warehouse `hub`'s mast; a diesel one with a quarter of a tank, a cell one half charged. */
export function newAirship(b: AirBuild, hub: string, pose: { x: number; y: number; z: number; yaw: number }, by: string, pid: string, now: number): Airship {
  return { id: `air:${pid}:${Math.round(now)}`, ...pose, drive: b.drive, fuel: b.drive === 'fuel' ? AIRSHIP.fuel.tank / 4 : 0, kwh: b.drive === 'cell' ? AIRSHIP.cell.cap / 2 : 0, moor: hub, by, t: now };
}

// ---------- flying ----------
/** The energy it has as [now, full, unit]. */
export const airEnergy = (a: Airship): [number, number, 'L' | 'kWh'] => (a.drive === 'fuel' ? [a.fuel, AIRSHIP.fuel.tank, 'L'] : [a.kwh, AIRSHIP.cell.cap, 'kWh']);
/** Burn what `dt` seconds at throttle `th` (−1..1) take; false once it is empty (no thrust). */
export function burnAir(a: Airship, th: number, dt: number): boolean {
  if (a.drive === 'fuel') { a.fuel = Math.max(0, a.fuel - Math.abs(th) * AIRSHIP.fuel.burn * dt); return a.fuel > 0; }
  a.kwh = Math.max(0, a.kwh - (Math.abs(th) * AIRSHIP.cell.burn + AIRSHIP.cell.idle) * dt);
  return a.kwh > 0;
}
/** Charge a moored cell ship for `dt` seconds (the mast works). Returns the kWh taken. */
export function chargeAir(a: Airship, dt: number): number {
  if (a.drive !== 'cell') return 0;
  const n = Math.min(AIRSHIP.cell.cap - a.kwh, AIRSHIP.cell.charge * dt);
  a.kwh += n;
  return n;
}
/** Pour a canister (L) into a diesel ship; returns the litres taken. */
export function fuelAir(a: Airship, litres: number): number {
  if (a.drive !== 'fuel') return 0;
  const n = Math.min(litres, AIRSHIP.fuel.tank - a.fuel);
  a.fuel += n;
  return n;
}
/** Range left at three quarters throttle (km). */
export function airRangeKm(a: Airship): number {
  const sp = AIRSHIP.speed[a.drive] * 0.75;
  const per = a.drive === 'fuel' ? AIRSHIP.fuel.burn * 0.75 : AIRSHIP.cell.burn * 0.75 + AIRSHIP.cell.idle;
  return (a.drive === 'fuel' ? a.fuel : a.kwh) / per * sp / 1000;
}
/** How low its middle may go over ground `g` (the gondola's floor `min` over it). */
export const lowest = (g: number) => g + AIRSHIP.below + AIRSHIP.min;
/** Where the gondola's seats are (u along the ship; the helm is the first). */
export const SEAT_U = [2.6, 0.6, -1.2, -3];
