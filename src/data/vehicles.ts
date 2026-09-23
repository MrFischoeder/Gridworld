// Vehicle models. Dimensions in metres; the body is built from these in world/vehicles.ts.
export type VehicleModel = 'scout' | 'mastodon';

export interface VehicleSpec {
  designation: string; name: string; role: string;
  /** Seats: the first one is the driver's. Multiplayer will fill the others. */
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
}

export const VEHICLES: Record<VehicleModel, VehicleSpec> = {
  scout: {
    designation: 'RTV-1', name: 'Scout', role: 'Reconnaissance vehicle',
    seats: 2, trunk: 8, length: 4.2, width: 2.1, height: 1.8, wheelR: 0.48, wheelW: 0.38,
    axles: [1.35, -1.3], track: 0.92, maxSpeed: 22, accel: 9, turn: 1.9, enclosed: false, price: 350,
    eye: [0.42, 1.55, -0.1], door: [1.6, 0], rear: [0, -2.9], front: [0, 2.9], mount: [0, 1.84, -0.3], wheelItem: 'wheelL',
    hull: 120, tank: 60, fuelUse: 9,
  },
  mastodon: {
    designation: 'HTV-6', name: 'Mastodon', role: 'Heavy transport vehicle',
    seats: 2, trunk: 24, length: 9.8, width: 3.6, height: 3.4, wheelR: 0.82, wheelW: 0.6,
    axles: [3.3, -1.6, -3.4], track: 1.45, maxSpeed: 14, accel: 4.5, turn: 1.15, enclosed: true, price: 900,
    eye: [0.7, 2.75, 3.4], door: [2.4, 3.2], rear: [0, -5.6], front: [0, 5.8], mount: [0, 3.26, 3.0], wheelItem: 'wheelH',
    hull: 320, tank: 220, fuelUse: 28,
  },
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
export interface VehicleParts { wheels: number[]; engine: number; gun: boolean; hull: number; fuel: number }
export const freshParts = (m: VehicleModel): VehicleParts => ({ wheels: Array(wheelCount(m)).fill(100), engine: 100, gun: false, hull: VEHICLES[m].hull, fuel: VEHICLES[m].tank });
/** Saves from before hull points and fuel: a full hull and a full tank. */
export function upgradeParts(m: VehicleModel, p: VehicleParts): VehicleParts {
  p.hull ??= VEHICLES[m].hull; p.fuel ??= VEHICLES[m].tank;
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
/** Overall health 0..1: wheels (missing ones count as 0), engine and hull. */
export function health(m: VehicleModel, p: VehicleParts): number {
  const wheels = p.wheels.reduce((a, w) => a + Math.max(0, w), 0) / p.wheels.length;
  return (wheels + p.engine + Math.max(0, p.hull) / VEHICLES[m].hull * 100) / 300;
}
/** What Mirek pays: half the price for a vehicle in perfect shape, less for a wreck; a fitted cannon adds its part value. */
export function resaleValue(m: VehicleModel, p: VehicleParts, cannonPrice: number, buyback: number): number {
  return Math.floor(VEHICLES[m].price / 2 * (0.3 + 0.7 * health(m, p)) + (p.gun ? cannonPrice * buyback : 0));
}
