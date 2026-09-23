// Where the vehicles of a new world are parked: just outside the north gate of the starting village.
import type { VehicleModel } from '../data/vehicles';

export interface Parking { id: string; model: VehicleModel; x: number; z: number; heading: number }

/** Heading h points the vehicle along (sin h, cos h); Math.PI faces north (-z), towards the road. */
export function startingVehicles(): Parking[] {
  return [
    { id: 'scout-1', model: 'scout', x: 7, z: -45, heading: Math.PI },
    { id: 'mastodon-1', model: 'mastodon', x: -9, z: -46, heading: Math.PI },
  ];
}
