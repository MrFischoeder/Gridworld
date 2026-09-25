// Vehicle models. Dimensions in metres; the body is built from these in world/vehicles.ts.
import type { ItemKey } from './items';
export type VehicleModel = 'scout' | 'mastodon';

export interface VehicleSpec {
  designation: string; name: string; role: string;
  /** Seats (`SEATS[model].length`): the first one is the driver's, the last the roof gunner's. */
  seats: number;
  /** Trunk slots (one stack per slot, like the backpack). */
  trunk: number;
  length: number; width: number; height: number;
  wheelR: number; wheelW: number;
  /** Wheel axle positions along the body (local z, forward is +z); each axle has a left and a right wheel. */
  axles: number[];
  /** Track half-width (wheel centre x). */
  track: number;
  maxSpeed: number; accel: number; turn: number;
  /** Closed cab: drones cannot reach the driver. */
  enclosed: boolean;
  /** Price at the vehicle dealer in Gridholm. */
  price: number;
  /** Driver's eye in body coordinates (cockpit view) and where you stand to get in / reach the trunk. */
  eye: [number, number, number];
  door: [number, number]; rear: [number, number];
  /** Where the service point (bonnet) is, and where a cannon sits on the roof. */
  front: [number, number]; mount: [number, number, number];
  /** Replacement wheel item for this model. */
  wheelItem: 'wheelL' | 'wheelH';
  /** Hull points: gunfire, rams and crashes wear them down; at 0 the vehicle is wrecked until patched. */
  hull: number;
  /** Fuel tank (litres) and consumption (litres per km at full throttle). */
  tank: number; fuelUse: number;
  /** Deepest water it can drive through (m). */
  wade: number;
}

export const VEHICLES: Record<VehicleModel, VehicleSpec> = {
  scout: {
    designation: 'RTV-1', name: 'Scout', role: 'Reconnaissance vehicle',
    seats: 3, trunk: 8, length: 4.2, width: 2.1, height: 2.1, wheelR: 0.48, wheelW: 0.38,
    axles: [1.35, -1.3], track: 0.92, maxSpeed: 22, accel: 9, turn: 1.9, enclosed: false, price: 350,
    eye: [0.42, 1.84, -0.12], door: [1.6, 0], rear: [0, -2.9], front: [0, 2.9], mount: [0, 2.12, -0.3], wheelItem: 'wheelL',
    hull: 120, tank: 60, fuelUse: 9, wade: 0.6,
  },
  mastodon: {
    designation: 'HTV-6', name: 'Mastodon', role: 'Heavy transport vehicle',
    seats: 3, trunk: 24, length: 9.8, width: 3.6, height: 3.4, wheelR: 0.82, wheelW: 0.6,
    axles: [3.3, -1.6, -3.4], track: 1.45, maxSpeed: 14, accel: 4.5, turn: 1.15, enclosed: true, price: 900,
    eye: [0.7, 2.75, 3.4], door: [2.4, 3.2], rear: [0, -5.6], front: [0, 5.8], mount: [0, 3.26, 3.0], wheelItem: 'wheelH',
    hull: 320, tank: 220, fuelUse: 28, wade: 1.2,
  },
};
/**
 * Where people sit, in body coordinates (x right, y up from the ground, z forward): `y` is the hip for a seat, the
 * feet for the gunner who stands at the roof cannon (`gun`). Seat 0 is the driver's. Everyone who gets in takes the
 * next free seat and is drawn there (world/vehicles.ts `seatRider`), so you can see how many are aboard.
 */
export interface Seat { x: number; y: number; z: number; gun?: boolean }
export const SEATS: Record<VehicleModel, Seat[]> = {
  scout: [{ x: 0.42, y: 1.02, z: -0.2 }, { x: -0.42, y: 1.02, z: -0.2 }, { x: 0, y: 1.0, z: -1.2, gun: true }],
  mastodon: [{ x: 0.7, y: 1.9, z: 3.3 }, { x: -0.7, y: 1.9, z: 3.3 }, { x: 0, y: 2.2, z: 2.5, gun: true }],
};
/**
 * The solid parts of each body as boxes [x0, y0, z0, x1, y1, z1] (body coordinates; the wheels are added from the
 * spec). A shot meets these or the people inside: whatever is nearer along its line takes it, so through a window,
 * over the side of an open tub or through the gunner's hatch it hits the person, anywhere else the vehicle.
 */
export const HULL_BOXES: Record<VehicleModel, number[][]> = {
  scout: [
    [-0.82, 0.55, -1.95, 0.82, 1.0, 1.0], [-0.85, 0.6, 1.0, 0.85, 1.2, 2.08], [-0.3, 0.7, -2.12, 0.3, 1.3, -1.95],
    [-0.82, 1.0, -1.95, 0.82, 1.28, -1.85], [-0.82, 1.0, -1.95, -0.72, 1.28, -0.75], [0.72, 1.0, -1.95, 0.82, 1.28, -0.75],
    [-0.68, 0.95, -0.6, -0.16, 1.55, -0.45], [0.16, 0.95, -0.6, 0.68, 1.55, -0.45], // seat backs
  ],
  mastodon: [
    [-0.65, 0.95, -4.8, 0.65, 1.35, 4.4], [-1.78, 1.45, -4.95, 1.78, 3.4, 1.8], [-1.8, 0.95, 4.75, 1.8, 1.35, 5.0],
    [-1.72, 1.25, 2.1, 1.72, 2.3, 4.75], // cab below the windows
    // the roof round the gunner's hatch (x -0.45..0.45, z 2.25..2.95)
    [-1.72, 3.08, 2.1, -0.45, 3.25, 4.2], [0.45, 3.08, 2.1, 1.72, 3.25, 4.2], [-0.45, 3.08, 2.95, 0.45, 3.25, 4.2], [-0.45, 3.08, 2.1, 0.45, 3.25, 2.25],
    [-1.72, 2.3, 2.1, 1.72, 3.08, 2.25], // back wall of the cab
    [-1.72, 2.3, 2.25, -1.5, 3.08, 2.4], [1.5, 2.3, 2.25, 1.72, 3.08, 2.4], // rear pillars
    [-1.72, 2.3, 3.9, -1.5, 3.08, 4.75], [1.5, 2.3, 3.9, 1.72, 3.08, 4.75], // front pillars
    [-0.08, 2.3, 4.15, 0.08, 3.08, 4.75], [1.45, 1.4, 1.75, 1.7, 4.3, 2.0], // windscreen post, exhaust stack
  ],
};
export const vehicleTitle = (m: VehicleModel) => VEHICLES[m].designation + ' ' + VEHICLES[m].name;

/** Number of wheels of a model (a left and a right one per axle). */
export const wheelCount = (m: VehicleModel) => VEHICLES[m].axles.length * 2;

/**
 * Fuel is tracked (every vehicle has a tank and a gauge) but not burnt yet: vehicles drive on an endless supply.
 * Set this to 1 to make them consume `fuelUse` litres per km.
 */
export const FUEL_BURN = 0;

/**
 * Part conditions in percent. A wheel at -1 is missing; at 0 it is wrecked. Either stops the vehicle,
 * as does a dead engine or a wrecked hull. Worn parts cost speed.
 * `hull` is in hull points (max = the spec's `hull`), `fuel` in litres (max = `tank`).
 */
export interface VehicleParts {
  wheels: number[]; engine: number; gun: boolean; hull: number; fuel: number;
  /** Engine upgrade slots (ENGINE_MODS long): Turbocharger, Engine Guard. */
  mods: (ItemKey | null)[];
}
export const ENGINE_MODS = 2;
/** Items that fit the engine upgrade slots. */
export const ENGINE_UPGRADES: ItemKey[] = ['turbo', 'eguard'];
export const freshParts = (m: VehicleModel): VehicleParts => ({ wheels: Array(wheelCount(m)).fill(100), engine: 100, gun: false, hull: VEHICLES[m].hull, fuel: VEHICLES[m].tank, mods: Array(ENGINE_MODS).fill(null) });
/** Saves from before hull points and fuel: a full hull and a full tank. */
export function upgradeParts(m: VehicleModel, p: VehicleParts): VehicleParts {
  p.hull ??= VEHICLES[m].hull; p.fuel ??= VEHICLES[m].tank; p.mods ??= Array(ENGINE_MODS).fill(null);
  return p;
}

/** Why a vehicle will not move, or null when it can. */
export function immobile(p: VehicleParts): string | null {
  if (p.hull <= 0) return 'The hull is shot to pieces.';
  if (p.fuel <= 0) return 'The tank is empty.';
  if (p.wheels.some((w) => w < 0)) return 'A wheel is missing.';
  if (p.wheels.some((w) => w === 0)) return 'A wheel is wrecked.';
  if (p.engine <= 0) return 'The engine is dead.';
  return null;
}
/** Speed / acceleration factor from the state of the parts (1 = like new). */
export function partPerformance(p: VehicleParts): number {
  const wheels = p.wheels.reduce((a, w) => a + Math.max(0, w), 0) / p.wheels.length / 100;
  return (0.55 + 0.45 * wheels) * (0.45 + 0.55 * p.engine / 100);
}
const has = (p: VehicleParts, k: ItemKey) => !!p.mods?.includes(k);
/** Top speed and acceleration factors from engine upgrades. */
export const engineBoost = (p: VehicleParts) => (has(p, 'turbo') ? { speed: 1.15, accel: 1.3 } : { speed: 1, accel: 1 });
/** Damage to the engine, halved by an Engine Guard. */
export function hurtEngine(p: VehicleParts, dmg: number) { p.engine = Math.max(0, Math.round(p.engine - dmg * (has(p, 'eguard') ? 0.5 : 1))); }
/** Overall health 0..1: wheels (missing ones count as 0), engine and hull. */
export function health(m: VehicleModel, p: VehicleParts): number {
  const wheels = p.wheels.reduce((a, w) => a + Math.max(0, w), 0) / p.wheels.length;
  return (wheels + p.engine + Math.max(0, p.hull) / VEHICLES[m].hull * 100) / 300;
}
/** What Kuba pays: half the price for a vehicle in perfect shape, less for a wreck; a fitted cannon adds its part value. */
export function resaleValue(m: VehicleModel, p: VehicleParts, cannonPrice: number, buyback: number): number {
  return Math.floor(VEHICLES[m].price / 2 * (0.3 + 0.7 * health(m, p)) + (p.gun ? cannonPrice * buyback : 0));
}
