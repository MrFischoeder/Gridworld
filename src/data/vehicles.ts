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
}

export const VEHICLES: Record<VehicleModel, VehicleSpec> = {
  scout: {
    designation: 'RTV-1', name: 'Scout', role: 'Reconnaissance vehicle',
    seats: 2, trunk: 8, length: 4.2, width: 2.1, height: 1.8, wheelR: 0.48, wheelW: 0.38,
    axles: [1.35, -1.3], track: 0.92, maxSpeed: 22, accel: 9, turn: 1.9, enclosed: false, price: 350,
    eye: [0.42, 1.55, -0.1], door: [1.6, 0], rear: [0, -2.9],
  },
  mastodon: {
    designation: 'HTV-6', name: 'Mastodon', role: 'Heavy transport vehicle',
    seats: 2, trunk: 24, length: 9.8, width: 3.6, height: 3.4, wheelR: 0.82, wheelW: 0.6,
    axles: [3.3, -1.6, -3.4], track: 1.45, maxSpeed: 14, accel: 4.5, turn: 1.15, enclosed: true, price: 900,
    eye: [0.7, 2.75, 3.4], door: [2.4, 3.2], rear: [0, -5.6],
  },
};
export const vehicleTitle = (m: VehicleModel) => VEHICLES[m].designation + ' ' + VEHICLES[m].name;
