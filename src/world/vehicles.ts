// Vehicles: wireframe bodies, arcade driving over the terrain, seats, and trunks for storing items.
import { vehiclesOpen } from '../gen/settlement';
import { play, hum } from './sound';
import * as THREE from 'three';
import { scene, camera, V, GRID } from './render';
import { G } from '../game';
import { PropBatch } from './props';
import { VEHICLES, SEATS, HULL_BOXES, BAY_SPOTS, MODEL_ORDER, fitBays, vehicleTitle, freshParts, upgradeParts, immobile, partPerformance, resaleValue, fuelBurn, outOfFuel, rangeKm, cansToFill, FUEL, isEV, evBurn, evRangeKm, energyOf, damageCondition, crashDamage, engineBoost, type VehicleSpec, type VehicleModel, type VehicleParts } from '../data/vehicles';
import { PART_PRICE, PART_BUYBACK } from '../data/items';
import { rayWorld } from './player';
import { foes, damageFoe } from './enemies';
import { rayBarrier, hurtBarrier, rayRaider, type Raider } from './raiders';
import { addFx, burst } from './fx';
import { makeNoise } from './noise';
import { add as addMat, edgesOf, lineMat } from './render';
import { regionVehicle, YARD, type Parking } from '../gen/vehicles';
import type { Terrain } from '../gen/terrain';
import { regionOf, nearX } from '../gen/regions';
import { RELIC_KEYS } from '../data/items';
import { putItems } from '../inventory';
import { CARGO, takeOut } from '../data/cargo';
import { villageDist } from '../gen/regions';
import { trunkKey, type VehicleState, type Container, type Slot } from '../save';
import { online } from '../net/client';
import { saveChar, takeOne } from '../character';
import { collides } from './player';
import { openTransfer } from '../ui/transfer';
import { openService } from '../ui/service';
import { showToast, logLine, el } from '../ui/hud';
import { makeFigure, type Figure } from './npc';
import { tl, TL } from '../i18n';

const BODY = 0x5cff8a, DETAIL = GRID, GLASS = 0x2a9a50;
/** You, as others see you in a vehicle. */
const YOU = 0xd8ffe8;

export interface Vehicle {
  st: VehicleState; spec: VehicleSpec; group: THREE.Group;
  /** In the world's list of vehicles (G.char.vehicles, shared online): an abandoned one out in the wilds joins it when
   *  someone first gets in or opens the trunk. (0.248) Nobody owns a vehicle: anyone drives it, anyone opens its trunk. */
  claimed: boolean;
  /** (0.248) Another player is in it: their game moves it and it is drawn from what they send (world/peers.ts ghosts);
   *  this copy is hidden and left alone meanwhile. */
  held?: boolean;
  wheels: { g: THREE.Group; front: boolean }[];
  /** Roof cannon (present when one is fitted). */
  turret: THREE.Group | null;
  /** Driven by bandits (world/raiders.ts): not claimable until they are beaten. */
  ai?: boolean;
  /** Who sits in each seat (`SEATS[model]`), drawn as a figure; null = empty. */
  riders: (Rider | null)[];
  /** What the bays and the fittings looked like when last drawn (a change by someone else redraws them). */
  bayLook?: string; partLook?: string;
  /** Another player at the cannon (world/peers.ts): where they aim it, body-relative. */
  gunYaw?: number;
  speed: number; spin: number; steer: number; y: number; pitch: number; roll: number;
}
/** Someone aboard: 'you', a raider crewman, ... (multiplayer will add other players). */
export interface Rider { who: string; fig: Figure }
export interface WorldHooks {
  height(x: number, z: number): number;
  /** Depth of standing water at a point (0 on dry land). */
  water(x: number, z: number): number;
  /** True where a vehicle may not go (places, trees, rocks...). r = clearance radius around the point. */
  blocked(x: number, z: number, r: number): boolean;
  /** The height the chase camera must stay under at a point (a roof over it), or undefined in the open. */
  ceiling?(x: number, z: number): number | undefined;
}
let hooks: WorldHooks | null = null;
export const vehicles: Vehicle[] = [];
/** The vehicle you are in (your own) and your seat in it (`SEATS` index: 0 the driver's). */
export const driving = { v: null as Vehicle | null, cockpit: false, since: 0, seat: 0 };
/** The gunner's seat of a model. */
export const gunSeat = (m: VehicleModel) => SEATS[m].findIndex((s) => s.gun);
export const SEAT_NAMES = ['driver', 'passenger', 'gunner'];

// ---------- models ----------
const wheelCache = new Map<VehicleModel, THREE.Group>();
function wheelModel(m: VehicleModel): THREE.Group {
  let w = wheelCache.get(m);
  if (w) return w;
  const s = VEHICLES[m], r = s.wheelR, hw = s.wheelW / 2, n = 14, pb = new PropBatch();
  const P = (x: number, a: number, rr = r) => [x, Math.sin(a) * rr, Math.cos(a) * rr];
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.283, b = (i + 1) / n * 6.283, mid = (a + b) / 2;
    pb.face(P(-hw, a), P(hw, a), P(hw, b), P(-hw, b));
    pb.seg(DETAIL, P(-hw, a), P(-hw, b)); pb.seg(DETAIL, P(hw, a), P(hw, b));
    // chevron tread
    pb.line(DETAIL, P(-hw, a), P(0, mid, r * 1.03), P(hw, a));
    // hub on both faces
    pb.seg(DETAIL, P(-hw - 0.01, a, r * 0.45), P(-hw - 0.01, b, r * 0.45)); pb.seg(DETAIL, P(hw + 0.01, a, r * 0.45), P(hw + 0.01, b, r * 0.45));
    pb.face([-hw, 0, 0], P(-hw, a), P(-hw, b)); pb.face([hw, 0, 0], P(hw, b), P(hw, a));
  }
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; pb.seg(DETAIL, P(hw + 0.01, a, r * 0.45), [hw + 0.01, 0, 0]); }
  w = pb.build(); wheelCache.set(m, w); return w;
}
const box = (pb: PropBatch, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c = BODY) =>
  pb.solid8([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c);

function scoutBody(pb: PropBatch) {
  // tub, hood and grille
  box(pb, -0.82, 0.55, -1.95, 0.82, 1.0, 1.0);
  pb.solid8([[-0.85, 0.6, 1.0], [0.85, 0.6, 1.0], [0.85, 0.6, 2.08], [-0.85, 0.6, 2.08]], [[-0.8, 1.2, 1.0], [0.8, 1.2, 1.0], [0.8, 1.02, 2.05], [-0.8, 1.02, 2.05]], BODY);
  for (let x = -0.5; x <= 0.5; x += 0.25) pb.line(DETAIL, [x, 0.68, 2.09], [x, 0.95, 2.07]);
  for (const x of [-0.62, 0.62]) pb.line(DETAIL, [x - 0.1, 0.9, 2.08], [x + 0.1, 0.9, 2.08], [x + 0.1, 0.98, 2.07], [x - 0.1, 0.98, 2.07], [x - 0.1, 0.9, 2.08]);
  // fenders over the wheels
  for (const z of VEHICLES.scout.axles) for (const sx of [-1, 1]) box(pb, sx * 0.78, 0.98, z - 0.58, sx * 1.08, 1.1, z + 0.58);
  // seats
  for (const x of [-0.42, 0.42]) { box(pb, x - 0.26, 0.95, -0.45, x + 0.26, 1.02, 0.1, DETAIL); box(pb, x - 0.26, 0.95, -0.6, x + 0.26, 1.55, -0.45, DETAIL); }
  steeringWheel(pb, VEHICLES.scout.eye[0], SEATS.scout[0]);
  // roll cage and windshield frame (tubes are lines), tall enough for the people sitting under it
  const cz0 = 0.72, cz1 = -1.25, top = 2.1;
  for (const x of [-0.8, 0.8]) { pb.line(BODY, [x, 1.0, cz0], [x, top, cz0 - 0.15], [x, top, cz1 + 0.1], [x, 1.0, cz1]); pb.line(BODY, [x, 1.2, 1.0], [x, 1.7, 0.75]); }
  pb.line(BODY, [-0.8, top, cz0 - 0.15], [0.8, top, cz0 - 0.15]); pb.line(BODY, [-0.8, top, cz1 + 0.1], [0.8, top, cz1 + 0.1]);
  pb.line(BODY, [-0.8, top, cz1 + 0.1], [0.8, top, cz0 - 0.15]);
  pb.line(GLASS, [-0.8, 1.2, 1.0], [0.8, 1.2, 1.0], [0.8, 1.7, 0.75], [-0.8, 1.7, 0.75], [-0.8, 1.2, 1.0]);
  // cargo bed walls (the trunk) and a spare wheel mount
  box(pb, -0.82, 1.0, -1.95, 0.82, 1.28, -1.85); box(pb, -0.82, 1.0, -1.95, -0.72, 1.28, -0.75); box(pb, 0.72, 1.0, -1.95, 0.82, 1.28, -0.75);
  box(pb, -0.3, 0.7, -2.12, 0.3, 1.3, -1.95, DETAIL);
}
/** A steering wheel in front of the driver's seat, where the driver's hands are. */
function steeringWheel(pb: PropBatch, x: number, s: { y: number; z: number }) {
  const cy = s.y + 0.3, cz = s.z + 0.44, r = 0.19, pts: number[][] = [];
  for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; pts.push([x + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, cz + Math.sin(a) * r * 0.6]); }
  pb.line(DETAIL, ...pts);
  pb.line(DETAIL, [x, cy, cz], [x, cy - 0.3, cz + 0.3]); // the column
}
function mastodonBody(pb: PropBatch) {
  // chassis beam
  box(pb, -0.65, 0.95, -4.8, 0.65, 1.35, 4.4, DETAIL);
  // cab with a raked windscreen
  // (built round open windows, so you see who sits inside: body below the sills, pillars, back wall, roof with a hatch)
  box(pb, -1.72, 1.25, 2.1, 1.72, 2.3, 4.75);
  box(pb, -1.72, 2.3, 2.1, 1.72, 3.08, 2.25);
  for (const [x0, x1] of [[-1.72, -1.5], [1.5, 1.72]]) {
    box(pb, x0, 2.3, 2.25, x1, 3.08, 2.4);
    pb.solid8([[x0, 2.3, 3.9], [x1, 2.3, 3.9], [x1, 2.3, 4.75], [x0, 2.3, 4.75]], [[x0, 3.08, 3.9], [x1, 3.08, 3.9], [x1, 3.08, 4.2], [x0, 3.08, 4.2]], BODY);
  }
  pb.solid8([[-0.08, 2.3, 4.45], [0.08, 2.3, 4.45], [0.08, 2.3, 4.75], [-0.08, 2.3, 4.75]], [[-0.08, 3.08, 4.12], [0.08, 3.08, 4.12], [0.08, 3.08, 4.22], [-0.08, 3.08, 4.22]], BODY);
  for (const [x0, z0, x1, z1] of [[-1.72, 2.1, -0.45, 4.2], [0.45, 2.1, 1.72, 4.2], [-0.45, 2.95, 0.45, 4.2], [-0.45, 2.1, 0.45, 2.25]]) box(pb, x0, 3.08, z0, x1, 3.25, z1);
  // windows: split windscreen and side windows
  for (const [a, b] of [[-1.5, -0.08], [0.08, 1.5]]) pb.line(GLASS, [a, 2.35, 4.58], [b, 2.35, 4.58], [b, 3.08, 4.2], [a, 3.08, 4.2], [a, 2.35, 4.58]);
  for (const x of [-1.73, 1.73]) pb.line(GLASS, [x, 2.3, 2.4], [x, 2.3, 3.9], [x, 3.0, 3.9], [x, 3.0, 2.4], [x, 2.3, 2.4]);
  for (const x of [-1.73, 1.73]) pb.line(DETAIL, [x, 1.4, 2.35], [x, 2.2, 2.35], [x, 2.2, 3.95]);
  // grille, bumper and brush guard
  for (let x = -1.2; x <= 1.2; x += 0.3) pb.line(DETAIL, [x, 1.45, 4.76], [x, 2.05, 4.76]);
  box(pb, -1.8, 0.95, 4.75, 1.8, 1.35, 5.0);
  for (const x of [-1.1, 1.1]) pb.line(BODY, [x, 1.35, 4.98], [x * 1.05, 2.6, 5.05], [x * 1.05, 2.6, 4.72]);
  pb.line(BODY, [-1.15, 2.6, 5.05], [1.15, 2.6, 5.05]);
  // exhaust stack
  box(pb, 1.45, 1.4, 1.75, 1.7, 4.3, 2.0, DETAIL);
  // the gunner's hatch in the roof, and the wheel
  pb.line(DETAIL, [-0.45, 3.26, 2.25], [0.45, 3.26, 2.25], [0.45, 3.26, 2.95], [-0.45, 3.26, 2.95], [-0.45, 3.26, 2.25]);
  steeringWheel(pb, VEHICLES.mastodon.eye[0], SEATS.mastodon[0]);
  // cargo box with panel seams (the trunk)
  box(pb, -1.78, 1.45, -4.95, 1.78, 3.4, 1.8);
  for (let z = -3.65; z < 1.8; z += 1.3) for (const x of [-1.79, 1.79]) pb.line(DETAIL, [x, 1.45, z], [x, 3.4, z]);
  for (const x of [-1.79, 1.79]) pb.line(DETAIL, [x, 2.7, -4.95], [x, 2.7, 1.8]);
  pb.line(DETAIL, [-1.3, 1.6, -4.96], [1.3, 1.6, -4.96], [1.3, 3.2, -4.96], [-1.3, 3.2, -4.96], [-1.3, 1.6, -4.96]);
  pb.line(DETAIL, [0, 1.6, -4.96], [0, 3.2, -4.96]);
  // mudguards
  for (const z of VEHICLES.mastodon.axles) for (const sx of [-1, 1]) box(pb, sx * 1.15, 1.6, z - 0.95, sx * 1.8, 1.72, z + 0.95, DETAIL);
}

/**
 * (0.247) The UTV-3 Nomad, a utility van: a short bonnet, a cab with a raked windscreen and open side windows (you see
 * who sits there), a closed cargo box behind with a sliding side door and twin rear doors, a roof hatch for the
 * gunner between the two, and a stripe down its flanks.
 */
function vanBody(pb: PropBatch) {
  box(pb, -1.15, 0.6, -3.05, 1.15, 1.6, 2.2); // the body below the windows
  pb.solid8([[-1.1, 0.6, 2.2], [1.1, 0.6, 2.2], [1.1, 0.6, 3.1], [-1.1, 0.6, 3.1]], [[-1.1, 1.38, 2.2], [1.1, 1.38, 2.2], [1.05, 1.15, 3.05], [-1.05, 1.15, 3.05]], BODY); // bonnet
  for (let x = -0.7; x <= 0.7; x += 0.2) pb.line(DETAIL, [x, 0.72, 3.11], [x, 1.05, 3.09]);
  box(pb, -1.15, 0.6, 3.05, 1.15, 0.85, 3.25, DETAIL); // bumper
  box(pb, -1.15, 1.6, -3.05, 1.15, 2.65, -0.1); // the cargo box
  for (const [x0, x1] of [[-1.15, -0.95], [0.95, 1.15]]) {
    box(pb, x0, 1.6, -0.1, x1, 2.65, 0.6); // round the hatch
    box(pb, x0, 1.6, 0.6, x1, 2.65, 0.75); // B pillar
    pb.solid8([[x0, 1.6, 1.85], [x1, 1.6, 1.85], [x1, 1.6, 2.2], [x0, 1.6, 2.2]], [[x0, 2.55, 1.55], [x1, 2.55, 1.55], [x1, 2.55, 1.85], [x0, 2.55, 1.85]], BODY); // A pillar, raked
  }
  box(pb, -0.95, 2.55, 0.6, 0.95, 2.65, 1.85); // cab roof
  for (const [x0, z0, x1, z1] of [[-0.95, -0.1, -0.45, 0.6], [0.45, -0.1, 0.95, 0.6]]) box(pb, x0, 2.55, z0, x1, 2.65, z1); // beside the hatch
  pb.line(DETAIL, [-0.45, 2.66, -0.1], [0.45, 2.66, -0.1], [0.45, 2.66, 0.6], [-0.45, 2.66, 0.6], [-0.45, 2.66, -0.1]);
  // windows: the windscreen and the side windows of the cab
  pb.line(GLASS, [-0.95, 1.62, 2.18], [0.95, 1.62, 2.18], [0.95, 2.52, 1.88], [-0.95, 2.52, 1.88], [-0.95, 1.62, 2.18]);
  for (const x of [-1.16, 1.16]) pb.line(GLASS, [x, 1.65, 0.8], [x, 1.65, 1.8], [x, 2.5, 1.55], [x, 2.5, 0.8], [x, 1.65, 0.8]);
  // the sliding side door, the rear doors, the stripe and the wheel arches
  for (const x of [-1.16, 1.16]) {
    pb.line(DETAIL, [x, 0.75, -1.9], [x, 2.5, -1.9]); pb.line(DETAIL, [x, 0.75, -0.2], [x, 2.5, -0.2]); pb.line(DETAIL, [x, 2.38, -1.9], [x, 2.38, -0.2]);
    pb.line(0xff5a3c, [x, 1.25, -3.0], [x, 1.25, 2.2], [x, 1.18, 3.05]); pb.line(0xff5a3c, [x, 1.33, -3.0], [x, 1.33, 2.2]);
  }
  pb.line(DETAIL, [-1.0, 0.75, -3.06], [1.0, 0.75, -3.06], [1.0, 2.5, -3.06], [-1.0, 2.5, -3.06], [-1.0, 0.75, -3.06]); pb.line(DETAIL, [0, 0.75, -3.06], [0, 2.5, -3.06]);
  for (const z of VEHICLES.van.axles) for (const sx of [-1, 1]) box(pb, sx * 0.98, 1.05, z - 0.62, sx * 1.2, 1.15, z + 0.62, DETAIL);
  for (const x of [-0.75, 0.75]) pb.line(DETAIL, [x - 0.15, 0.95, 3.06], [x + 0.15, 0.95, 3.06], [x + 0.15, 1.05, 3.05], [x - 0.15, 1.05, 3.05], [x - 0.15, 0.95, 3.06]);
  // seats and the wheel
  for (const x of [-0.55, 0.55]) { box(pb, x - 0.28, 1.15, 0.95, x + 0.28, 1.22, 1.5, DETAIL); box(pb, x - 0.28, 1.15, 0.8, x + 0.28, 1.95, 0.95, DETAIL); }
  steeringWheel(pb, VEHICLES.van.eye[0], SEATS.van[0]);
}
/** The body of a model. */
function bodyOf(m: VehicleModel, pb: PropBatch) { if (m === 'scout') scoutBody(pb); else if (m === 'van') vanBody(pb); else mastodonBody(pb); }

/**
 * (0.203) A vehicle's headlights: two lit lenses on its nose and a faint beam ahead of each, named 'headlights' so
 * whoever draws the vehicle can switch them (body coordinates, facing +z).
 */
const LAMPS: Record<VehicleModel, [number, number]> = { scout: [1.0, 0.55], van: [1.12, 0.48], mastodon: [1.6, 0.9] };
export function headlightModel(m: VehicleModel): THREE.Group {
  const spec = VEHICLES[m], [dz, dy] = LAMPS[m], g = new THREE.Group(), z = spec.axles[0] + dz, y = spec.wheelR + dy;
  const lens = new THREE.MeshBasicMaterial({ color: 0xf6ffe0, fog: false, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.MeshBasicMaterial({ color: 0xe8ffd0, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.13, 10), lens); l.position.set(sx * (spec.track - 0.25), y, z); g.add(l);
    const cone = new THREE.ConeGeometry(1.6, 9, 12, 1, true); cone.rotateX(-Math.PI / 2); cone.translate(0, 0, 4.5);
    const b = new THREE.Mesh(cone, beam); b.position.set(sx * (spec.track - 0.25), y, z + 0.05); g.add(b);
  }
  g.name = 'headlights'; g.visible = false;
  return g;
}
/** Where a vehicle's headlights shine (world, ~8 m ahead of its nose) for the light map. */
export function headlightSpot(x: number, z: number, heading: number, m: VehicleModel): { x: number; z: number } {
  const d = VEHICLES[m].axles[0] + 8; return { x: x + Math.sin(heading) * d, z: z + Math.cos(heading) * d };
}
/** L at the wheel: switch the headlights on or off. */
export function toggleHeadlights(): string | null {
  const v = driving.v; if (!v) return null;
  if (driving.seat !== 0) return tl('Only the driver switches the lights.');
  v.st.lights = !v.st.lights; refreshLights(v); saveChar();
  return v.st.lights ? tl('Headlights on.') : tl('Headlights off.');
}
export function refreshLights(v: Vehicle) { const h = v.group.getObjectByName('headlights'); if (h) h.visible = !!v.st.lights; }
/**
 * A vehicle model with nothing to drive (the trucks and jeeps of the caravans, world/caravans.ts): body, wheels and,
 * if asked, the roof cannon (returned as `turret` so it can turn). Origin on the ground, facing +z.
 */
export function convoyModel(model: VehicleModel, cannon: boolean, crew?: number): { g: THREE.Group; turret: THREE.Group | null; gunner: THREE.Group | null } {
  const spec = VEHICLES[model], g = new THREE.Group(), pb = new PropBatch();
  bodyOf(model, pb);
  g.add(pb.build(), headlightModel(model));
  for (const z of spec.axles) for (const sx of [-1, 1]) { const w = wheelModel(model).clone(); w.position.set(sx * spec.track, spec.wheelR, z); g.add(w); }
  let turret: THREE.Group | null = null;
  if (cannon) { turret = turretModel(); turret.position.set(...spec.mount); g.add(turret); }
  // the crew: a driver, and a gunner at the cannon
  let gunner: THREE.Group | null = null;
  if (crew !== undefined) {
    g.add(seatFigure(model, 0, crew).g);
    if (cannon) { gunner = seatFigure(model, SEATS[model].findIndex((x) => x.gun), crew).g; g.add(gunner); }
  }
  return { g, turret, gunner };
}
function makeVehicle(st: VehicleState, claimed = true): Vehicle {
  const spec = VEHICLES[st.model], group = new THREE.Group(), pb = new PropBatch();
  bodyOf(st.model, pb);
  group.add(pb.build(), headlightModel(st.model));
  const wheels: Vehicle['wheels'] = [];
  spec.axles.forEach((z, ai) => {
    for (const sx of [-1, 1]) {
      const g = new THREE.Group(), w = wheelModel(st.model).clone();
      g.add(w); g.position.set(sx * spec.track, spec.wheelR, z); group.add(g);
      wheels.push({ g: w as unknown as THREE.Group, front: ai === 0 });
      (w as THREE.Object3D).userData.pivot = g;
    }
  });
  st.parts ??= freshParts(st.model); // saves from before vehicles had parts
  upgradeParts(st.model, st.parts);
  if (!claimed) st.bays = fitBays(st.model, st.bays);
  scene.add(group);
  const v: Vehicle = { st, spec, group, claimed, wheels, turret: null, riders: SEATS[st.model].map(() => null), speed: 0, spin: 0, steer: 0, y: 0, pitch: 0, roll: 0 };
  refreshParts(v); refreshLights(v); refreshBays(v);
  pose(v);
  return v;
}

// ---------- people aboard ----------
/**
 * Put someone in seat i, drawn there: sitting with the legs forward (the driver's hands on the wheel), or the gunner
 * standing at the roof cannon, turning with it. Returns the figure.
 */
export function seatRider(v: Vehicle, i: number, who: string, color: number): Figure {
  unseat(v, i);
  const fig = seatFigure(v.st.model, i, color);
  v.group.add(fig.g);
  v.riders[i] = { who, fig };
  if (v === driving.v && driving.cockpit && who === 'you') fig.g.visible = false;
  return fig;
}
/** A figure posed in seat i of a model (body coordinates; the caller adds it to the body group). */
export function seatFigure(m: VehicleModel, i: number, color: number): Figure {
  const s = SEATS[m][i], fig = makeFigure(color, i === 0 || s.gun ? 'drive' : 'none');
  if (s.gun) fig.g.position.set(s.x, s.y, s.z);
  else { fig.g.position.set(s.x, s.y - 0.82, s.z); fig.legL.rotation.x = fig.legR.rotation.x = -1.45; }
  return fig;
}
export function unseat(v: Vehicle, i: number) {
  const r = v.riders[i];
  if (!r) return;
  v.group.remove(r.fig.g); r.fig.g.traverse((o) => { if ((o as THREE.LineSegments).isLineSegments || (o as THREE.Line).isLine) (o as THREE.Line).geometry.dispose(); });
  v.riders[i] = null;
}
/** The first empty seat (the gunner's last, unless asked for). */
export function freeSeat(v: Vehicle, gun = false): number {
  const seats = SEATS[v.st.model];
  return seats.findIndex((s, i) => !v.riders[i] && !!s.gun === gun);
}
export const aboard = (v: Vehicle) => v.riders.filter(Boolean).length;
/** The middle of the chest of whoever sits in seat i, in world space (what shooters aim at). */
export function seatPoint(v: Vehicle, i: number): THREE.Vector3 {
  const s = SEATS[v.st.model][i];
  v.group.updateMatrixWorld();
  return v.group.localToWorld(V(s.x, s.gun ? s.y + 1.2 : s.y + 0.4, s.z));
}
/** Boxes round a person in seat i (torso, head), body coordinates. */
function riderBoxes(m: VehicleModel, i: number): number[][] {
  const { x, y, z, gun } = SEATS[m][i];
  return gun ? [[x - 0.26, y + 0.8, z - 0.26, x + 0.26, y + 1.45, z + 0.26], [x - 0.18, y + 1.45, z - 0.18, x + 0.18, y + 1.8, z + 0.18]]
    : [[x - 0.22, y - 0.02, z - 0.15, x + 0.22, y + 0.62, z + 0.15], [x - 0.17, y + 0.62, z - 0.17, x + 0.17, y + 0.98, z + 0.17]];
}
const wheelBoxes = (m: VehicleModel) => { const s = VEHICLES[m]; return s.axles.flatMap((z) => [-1, 1].map((sx) => [sx * s.track - s.wheelW / 2, 0, z - s.wheelR, sx * s.track + s.wheelW / 2, s.wheelR * 2, z + s.wheelR])); };
const inv = new THREE.Matrix4(), ray = new THREE.Ray(), bx = new THREE.Box3(), hitP = new THREE.Vector3();
/**
 * A shot from o along d (normalised) meets this vehicle within `max`: at t, its body or an occupant silhouette. Both are vehicle hits (seat -1).
 */
export function rayVehicle(v: Vehicle, o: THREE.Vector3, d: THREE.Vector3, max: number): { t: number; seat: number } | null {
  if (v.held) return null; // (0.248) another player's game has it: their copy (a ghost) is what you see and hit
  const R = Math.max(v.spec.length, v.spec.height) * 0.6, cx = v.st.x - o.x, cy = v.y + v.spec.height / 2 - o.y, cz = v.st.z - o.z;
  const along = cx * d.x + cy * d.y + cz * d.z;
  if (along < -R || along > max + R || cx * cx + cy * cy + cz * cz - along * along > R * R) return null; // nowhere near
  v.group.updateMatrixWorld(); inv.copy(v.group.matrixWorld).invert();
  ray.origin.copy(o).applyMatrix4(inv); ray.direction.copy(d).transformDirection(inv);
  let best = max, seat = -2;
  const test = (b: number[], k: number) => {
    bx.min.set(b[0], b[1], b[2]); bx.max.set(b[3], b[4], b[5]);
    if (ray.intersectBox(bx, hitP)) { const t = hitP.distanceTo(ray.origin); if (t < best) { best = t; seat = k; } }
  };
  for (const b of HULL_BOXES[v.st.model]) test(b, -1);
  wheelBoxes(v.st.model).forEach((b, i) => { if (v.st.parts.wheels[i] >= 0) test(b, -1); });
  v.riders.forEach((r, i) => { if (r && r.fig.g.parent === v.group) for (const b of riderBoxes(v.st.model, i)) test(b, -1); });
  return seat === -2 ? null : { t: best, seat };
}

// ---------- parts ----------
const turretMat = lineMat(0xffb347);
function turretModel(): THREE.Group {
  const g = new THREE.Group(), pb = new PropBatch();
  pb.solid8([[-0.35, 0, -0.35], [0.35, 0, -0.35], [0.35, 0, 0.35], [-0.35, 0, 0.35]], [[-0.28, 0.32, -0.28], [0.28, 0.32, -0.28], [0.28, 0.32, 0.28], [-0.28, 0.32, 0.28]], 0xffb347);
  pb.solid8([[-0.07, 0.12, 0.2], [0.07, 0.12, 0.2], [0.07, 0.12, 1.25], [-0.07, 0.12, 1.25]], [[-0.07, 0.24, 0.2], [0.07, 0.24, 0.2], [0.07, 0.24, 1.25], [-0.07, 0.24, 1.25]], 0xffb347);
  g.add(pb.build());
  g.add(edgesOf(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10), turretMat));
  return g;
}
/**
 * (0.247) The crates and barrels in an open bed (the jeep's): drawn where they stand, a crate with its planks or ribs,
 * a barrel with its hoops; a full one with a gold lid line. Closed bodies hide theirs.
 */
export function refreshBays(v: Vehicle) {
  const old = v.group.getObjectByName('bays'), bays = baysOf(v);
  if (old) { v.group.remove(old); old.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
  v.bayLook = JSON.stringify(bays);
  if (v.spec.enclosed || !bays.some(Boolean)) return;
  const pb = new PropBatch(), sp = BAY_SPOTS[v.st.model];
  bays.forEach((s, i) => {
    const at = sp.at[i]; if (!s || !at) return;
    const [x, z] = at, y = sp.y, steel = s.k === 'crateM' || s.k === 'barrelM', c = steel ? 0x9fd8b0 : 0xb8b060;
    if (CARGO[s.k]?.kind === 'barrel') {
      const r = 0.26, h = 0.66, n = 10, P = (a: number, yy: number, rr = r) => [x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr];
      for (let k = 0; k < n; k++) { const a = k / n * 6.283, b = (k + 1) / n * 6.283; pb.face(P(a, y), P(b, y), P(b, y + h), P(a, y + h)); pb.face([x, y + h, z], P(b, y + h), P(a, y + h)); for (const yy of [y + 0.08, y + h / 2, y + h - 0.08]) pb.seg(c, P(a, yy, r * 1.02), P(b, yy, r * 1.02)); }
    } else {
      const w = 0.3, h = 0.56;
      box(pb, x - w, y, z - w, x + w, y + h, z + w, c);
      for (const yy of [y + h * 0.33, y + h * 0.66]) for (const sx of [-1, 1]) pb.line(c, [x + sx * (w + 0.01), yy, z - w], [x + sx * (w + 0.01), yy, z + w]);
    }
    if (s.b) pb.line(0xffd060, [x - 0.2, y + 0.68, z], [x + 0.2, y + 0.68, z]);
  });
  const g = pb.build(); g.name = 'bays'; v.group.add(g);
}
/** Wheels are permanent; only optional roof equipment is fitted or removed. */
export function refreshParts(v: Vehicle) {
  v.partLook = (v.st.parts.gun ? 1 : 0) + ':' + (v.st.lights ? 1 : 0);
  v.wheels.forEach((w) => { ((w.g as THREE.Object3D).userData.pivot as THREE.Group).visible = true; });
  if (v.st.parts.gun && !v.turret) {
    v.turret = turretModel(); v.turret.position.set(...v.spec.mount); v.group.add(v.turret);
  } else if (!v.st.parts.gun && v.turret) {
    v.group.remove(v.turret); v.turret.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); v.turret = null;
  }
}
/** Driving burns fuel (data/vehicles.ts `fuelBurn`); the tank running dry stops the engine's pull. */
let dryWarnAt = 0;
function consumeFuel(v: Vehicle, metres: number, thr: number, secs: number) {
  const p = v.st.parts;
  if (isEV(p)) { // (0.180) the battery
    const had = p.ev!, [, cap] = energyOf(v.st.model, p);
    if (had <= 0) return;
    p.ev = Math.max(0, had - evBurn(v.st.model, metres, thr, secs));
    if (had > cap * 0.1 && p.ev <= cap * 0.1) logLine(TL`Battery low: ${Math.round(p.ev)} kWh left, about ${Math.round(evRangeKm(v.st.model, p.ev))} km.`);
    if (p.ev <= 0) dryWarn();
    return;
  }
  const had = p.fuel;
  if (had <= 0) return;
  p.fuel = Math.max(0, had - fuelBurn(v.st.model, metres, thr, secs));
  if (had > v.spec.tank * 0.1 && p.fuel <= v.spec.tank * 0.1) logLine(TL`Fuel low: ${Math.round(p.fuel)} L left, about ${Math.round(rangeKm(v.st.model, p.fuel))} km.`);
  if (p.fuel <= 0) dryWarn();
}
function dryWarn() {
  if (performance.now() < dryWarnAt) return;
  dryWarnAt = performance.now() + 5000;
  if (driving.v && isEV(driving.v.st.parts)) { showToast(tl('Battery flat')); logLine(tl('The battery is flat: the motor whines and stops. Tow or push it to a charging post.')); return; }
  showToast(tl('Out of fuel')); logLine(tl('The tank is dry: the engine coughs and dies. R pours in a Fuel Canister from the trunk or your backpack.'));
}
/** The vehicle you could refuel now: the one you are in, else one beside you (within 4 m of its body). */
function refuelTarget(): Vehicle | null {
  if (driving.v) return driving.v;
  let best: Vehicle | null = null, bd = 4;
  for (const v of vehicles) {
    if (v.ai || !v.claimed || v.held || Math.abs(G.pos.y - v.y) > 2.5) continue;
    const [lx, lz] = toLocal(v, G.pos.x, G.pos.z), d = Math.max(Math.abs(lx) - v.spec.width / 2, Math.abs(lz) - v.spec.length / 2, 0);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
/** Pours one Fuel Canister into vehicle v: from its trunk first, then your backpack. Returns the message. */
export function pourCanister(v: Vehicle): string {
  const p = v.st.parts;
  if (isEV(p)) return tl('It runs on electricity: charge it at a charging post.');
  if (cansToFill(v.st.model, p.fuel) <= 0) return tl('The tank is nearly full.');
  const t = trunkFor(v).items, i = t.findIndex((x) => x?.k === 'fuel'), drum = baysOf(v).find((x) => x?.b?.k === 'fuel'); // (0.247) a barrel of diesel in the cargo bay first
  if (drum) takeOut(drum, 1);
  else if (i >= 0) { const x = t[i]!; if (--x.n <= 0) t[i] = null; }
  else if (!takeOne('fuel')) return tl('You have no Fuel Canister, in the trunk or your backpack. Villages trade them.');
  p.fuel = Math.min(v.spec.tank, p.fuel + FUEL.can);
  saveChar();
  return TL`You pour a canister into the tank: ${Math.round(p.fuel)} of ${v.spec.tank} litres, about ${Math.round(rangeKm(v.st.model, p.fuel))} km.`;
}
/** R in or beside a vehicle: pour a canister in. False when there is no vehicle here (R then reloads). */
export function refuelVehicle(): boolean {
  const v = refuelTarget();
  if (!v) return false;
  if (!driving.v && (isEV(v.st.parts) || cansToFill(v.st.model, v.st.parts.fuel) <= 0)) return false; // on foot by a full tank (or an electric vehicle) R reloads
  claim(v); logLine(pourCanister(v));
  return true;
}

// ---------- hull ----------
let hullWarnAt = 0;
/**
 * Hull damage from gunfire, rams and crashes. At 0 the vehicle is wrecked: it stops, smokes, and the driver
 * leaves without injury. Service or a repair kit brings it back.
 * Returns true when this hit wrecked it.
 */
export function damageVehicle(v: Vehicle, dmg: number): boolean {
  const p = v.st.parts;
  if (p.hull <= 0 || !Number.isFinite(dmg) || dmg <= 0) return false;
  damageCondition(p, dmg);
  if (v === driving.v) {
    G.dmgFlash = Math.max(G.dmgFlash, 0.12);
    if (p.hull < v.spec.hull * 0.25 && performance.now() > hullWarnAt) { hullWarnAt = performance.now() + 6000; logLine(tl('Vehicle condition critical!')); }
  }
  if (p.hull > 0) return false;
  v.speed = 0;
  burst(V(v.st.x, v.y + v.spec.height * 0.6, v.st.z), 0xffb347, 60, v.spec.length * 0.5);
  if (v === driving.v) {
    showToast(vehicleTitle(v.st.model) + ' wrecked!');
    logLine(tl('Vehicle condition reached 0%. Use a Vehicle Repair Kit or service it at the front.'));
    leave();
    G.dmgFlash = 0.6;
  }
  if (v.claimed) saveChar();
  return true;
}
/** Wrecked vehicles smoulder: a few sparks rise from them now and then. */
let smokeT = 0;
export function smokeWrecks(dt: number) {
  if ((smokeT -= dt) > 0) return;
  smokeT = 0.35;
  for (const v of vehicles) if (v.st.parts.hull <= 0 && v.claimed && Math.hypot(v.st.x - G.pos.x, v.st.z - G.pos.z) < 90)
    burst(V(v.st.x + (Math.random() - 0.5) * v.spec.width, v.y + v.spec.height, v.st.z + (Math.random() - 0.5) * v.spec.length * 0.5), 0x3a8a50, 3, 0.4);
}

// ---------- cannon ----------
let gunCool = 0;
/** Fire the roof cannon where the camera looks. */
/** Whether you work the cannon of your own vehicle: from the gunner's seat, or from the wheel while no one stands at it. */
export function myCannon(v: Vehicle): boolean {
  return v === driving.v && (driving.seat === gunSeat(v.st.model) || (driving.seat === 0 && v.gunYaw === undefined));
}
export function fireCannon(dt: number) {
  const v = driving.v;
  gunCool -= dt;
  if (!v || !v.turret || !G.firing || gunCool > 0 || !myCannon(v)) return;
  gunCool = 0.55;
  shootCannon(v.turret);
}
/** Fire a roof cannon along the camera (yours, or another player's you stand at: world/ride.ts). */
export function shootCannon(turret: THREE.Object3D) {
  const muzzle = V(0, 0.18, 1.3); turret.localToWorld(muzzle);
  play('cannon', { at: muzzle, vol: 0.9, far: 150, share: 160 });
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  let tHit = rayWorld(muzzle, d, 90), hit = null;
  for (const t of foes()) {
    if ('kind' in t && t.kind === 'raider') {
      const h = rayRaider(t as Raider, muzzle, d, tHit);
      if (h) { tHit = h.t; hit = t; }
      continue;
    }
    const rr = (t.r || 0.6) + 0.3, oc = muzzle.clone().sub(t.g.position), b = oc.dot(d), c = oc.lengthSq() - rr * rr, disc = b * b - c;
    if (disc < 0) continue; const tt = -b - Math.sqrt(disc);
    if (tt > 0 && tt < tHit) { tHit = tt; hit = t; }
  }
  let car: Vehicle | null = null;
  for (const candidate of vehicles) {
    if (candidate.ai || candidate === driving.v || candidate.group === turret.parent) continue;
    const h = rayVehicle(candidate, muzzle, d, tHit);
    if (h) { tHit = h.t; car = candidate; hit = null; }
  }
  const bar = rayBarrier(muzzle, d, tHit);
  if (bar) { tHit = bar.t; hit = null; car = null; hurtBarrier(bar.p, 3 * G.S.bm); }
  const end = muzzle.clone().addScaledVector(d, tHit);
  addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle, end]), addMat(0xffb347)), 0.15);
  burst(end, 0xffb347, hit ? 16 : 8, hit ? 1.1 : 0.5);
  if (car) damageVehicle(car, 3 * G.S.bm);
  if (hit) damageFoe(hit, 3 * G.S.bm);
  makeNoise(muzzle, 95); // the cannon is heard far and wide
}
/** The turret follows the camera. */
function aimTurret(v: Vehicle) {
  if (!v.turret) return;
  if (v.gunYaw !== undefined) v.turret.rotation.y = v.gunYaw; // another player at the cannon
  else if (myCannon(v)) v.turret.rotation.y = G.yaw + Math.PI - v.st.heading;
  else if (v !== driving.v) v.turret.rotation.y = 0;
}

// ---------- geometry helpers ----------
const fwd = (h: number): [number, number] => [Math.sin(h), Math.cos(h)];
/** Body point (x right, z forward) to world x/z. */
function toWorld(v: { st: { x: number; z: number; heading: number } }, lx: number, lz: number): [number, number] {
  const h = v.st.heading, c = Math.cos(h), s = Math.sin(h);
  return [v.st.x + lx * c + lz * s, v.st.z - lx * s + lz * c];
}
function toLocal(v: Vehicle, x: number, z: number): [number, number] {
  const h = v.st.heading, c = Math.cos(h), s = Math.sin(h), dx = x - v.st.x, dz = z - v.st.z;
  return [dx * c - dz * s, dx * s + dz * c];
}
/** A world point in the frame of a body at (x, z) turned by heading h (for vehicles drawn without a Vehicle). */
export function toLocalOf(h: number, x0: number, z0: number, x: number, z: number): [number, number] {
  const c = Math.cos(h), s = Math.sin(h), dx = x - x0, dz = z - z0;
  return [dx * c - dz * s, dx * s + dz * c];
}
/** Rest the body on its wheels: height from the wheel contact points, pitch and roll from their differences. */
function pose(v: Vehicle) {
  const s = v.spec, H = hooks ? hooks.height : () => 0, zf = s.axles[0], zr = s.axles[s.axles.length - 1];
  const g = (lx: number, lz: number) => { const [x, z] = toWorld(v, lx, lz); return H(x, z); };
  const fl = g(-s.track, zf), fr = g(s.track, zf), rl = g(-s.track, zr), rr = g(s.track, zr);
  v.y = (fl + fr + rl + rr) / 4;
  v.pitch = Math.atan2((fl + fr) / 2 - (rl + rr) / 2, zf - zr);
  v.roll = Math.atan2((fr + rr) / 2 - (fl + rl) / 2, 2 * s.track);
  v.group.position.set(v.st.x, v.y - 0.05, v.st.z);
  v.group.rotation.set(-v.pitch, v.st.heading, v.roll, 'YXZ');
  const gi = SEATS[v.st.model].findIndex((x) => x.gun), gunner = v.riders[gi];
  if (gunner) gunner.fig.g.rotation.y = v.turret ? v.turret.rotation.y : 0; // the gunner turns with the cannon
  for (const w of v.wheels) {
    w.g.rotation.x = v.spin;
    const pivot = (w.g as THREE.Object3D).userData.pivot as THREE.Group;
    pivot.rotation.y = w.front ? v.steer * 0.45 : 0;
  }
}

// ---------- lifecycle ----------
export function spawnVehicles(h: WorldHooks) {
  hooks = h;
  clearVehicles();
  for (const st of G.char.vehicles) { st.x = nearX(st.x, G.pos.x); vehicles.push(makeVehicle(st)); }
  unsent.clear();
}
const emptyTrunk = (m: VehicleModel) => ({ items: Array(VEHICLES[m].trunk).fill(null), gold: 0 });
/**
 * (0.248) The trunk of a vehicle in the world's list: the shared container `trunk:<id>` (locked while someone has it
 * open, like any chest), with its cargo bays. A trunk still kept inside the vehicle (a found one, a raider's wreck, an
 * older game's) moves there first.
 */
export function trunkOf(st: VehicleState): Container {
  const k = trunkKey(st.id), all = G.char.containers;
  if (!all[k]) { all[k] = { ...(st.trunk ?? emptyTrunk(st.model)) }; if (st.bays) all[k].bays = st.bays; }
  delete st.trunk; delete st.bays;
  const t = all[k];
  t.bays = fitBays(st.model, t.bays);
  return t;
}
/** The trunk of any vehicle: the shared one of a listed vehicle, else the one it carries (a raider's, a found one). */
export const trunkFor = (v: Vehicle): Container => (v.claimed ? trunkOf(v.st) : (v.st.trunk ??= emptyTrunk(v.st.model)));
/** The shared trunk of a vehicle standing here for the stores and markets (not one another player is in), or null. */
export const trunkHere = (v: Vehicle): Container | null => (v.claimed && !v.ai && !v.held ? G.char.containers[trunkKey(v.st.id)] ?? null : null);
/** Its cargo bays. */
export const baysOf = (v: Vehicle): (Slot | null)[] => (v.claimed ? G.char.containers[trunkKey(v.st.id)]?.bays ?? v.st.bays ?? [] : (v.st.bays = fitBays(v.st.model, v.st.bays))); // (only looks: a trunk not heard of yet is not made here)
/** A vehicle joins the world's list (found, bought, built, back from a route): its trunk becomes the shared container. */
function enlist(st: VehicleState) { if (!G.char.vehicles.includes(st)) G.char.vehicles.push(st); trunkOf(st); }
/** (0.248) The vehicles this game moves (the one you are in, and one you left whose last place is not sent yet):
 *  online only these send where they stand (world/share.ts), the others' copies follow what the driver's game tells. */
const unsent = new Set<string>();
export const steeredHere = (id: string) => driving.v?.st.id === id || unsent.has(id);
/** world/share.ts: the place of vehicle id went out. */
export const poseSent = (id: string) => { unsent.delete(id); };
/** The vehicles this game looks after (charging): the ones it drove last this session, or alone every one. */
const tended = new Set<string>();
export const tendsHere = (v: Vehicle) => v.claimed && !v.held && (!online() || tended.has(v.st.id));
/**
 * (0.248) Keep the vehicles drawn here in step with the world's list (twice a second, main loop): a vehicle someone
 * else found, bought or brought appears, one sold or sent off on a route goes; one moved, refitted or loaded by someone
 * else is drawn where and as it is now.
 */
export function syncVehicles() {
  if (!hooks || G.char.loc !== 'overworld') return;
  const byId = new Map(G.char.vehicles.map((s) => [s.id, s]));
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (v.ai) continue;
    const st = byId.get(v.st.id);
    if (!st) { if (v.claimed && v !== driving.v) { dropVehicle(v); vehicles.splice(i, 1); } continue; }
    byId.delete(v.st.id);
    if (v.st !== st || !v.claimed) { v.st = st; v.claimed = true; }
    if (v === driving.v || v.held) continue;
    if (JSON.stringify(baysOf(v)) !== v.bayLook) refreshBays(v);
    if ((v.st.parts.gun ? 1 : 0) + ':' + (v.st.lights ? 1 : 0) !== v.partLook) { refreshParts(v); refreshLights(v); }
    v.st.x = nearX(v.st.x, G.pos.x);
    if (v.group.position.x !== v.st.x || v.group.position.z !== v.st.z || v.group.rotation.y !== v.st.heading) pose(v);
  }
  for (const st of byId.values()) { st.x = nearX(st.x, G.pos.x); vehicles.push(makeVehicle(st)); }
}
/** world/peers.ts: whether another player is in vehicle v now, and where their game shows it. */
export function holdVehicle(v: Vehicle, held: boolean, at?: { x: number; z: number; h: number }) {
  if (at) { v.st.x = at.x; v.st.z = at.z; v.st.heading = at.h; }
  if (v.held === held) { if (held && at) v.group.position.set(at.x, v.group.position.y, at.z); return; }
  v.held = held; v.group.visible = !held; v.speed = 0;
  if (!held) pose(v);
}
const stateOf = (p: Parking): VehicleState => ({ ...p, parts: structuredClone(p.parts), trunk: emptyTrunk(p.model), bays: fitBays(p.model, undefined) });

// ---------- abandoned vehicles ----------
const foundCache = new Map<string, Parking | null>();
/** Show the abandoned vehicles of the regions around (x, z) that nobody has claimed yet; drop far ones. */
export function syncFound(t: Terrain, x: number, z: number) {
  const [rx, rz] = regionOf(x, z), owned = new Set(G.char.vehicles.map((s) => s.id));
  if (vehiclesOpen(G.char)) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { // (0.202) none before the mechanic comes
    const key = t.world + ':' + (rx + i) + ':' + (rz + j);
    if (!foundCache.has(key)) foundCache.set(key, regionVehicle(t, rx + i, rz + j));
    const p = foundCache.get(key);
    if (!p || owned.has(p.id) || vehicles.some((v) => v.st.id === p.id)) continue;
    vehicles.push(makeVehicle(stateOf(p), false));
  }
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (!v.claimed && Math.hypot(v.st.x - x, v.st.z - z) > 420) { dropVehicle(v); vehicles.splice(i, 1); }
  }
}
/** Taking an abandoned vehicle: it joins the world's vehicles (anyone's to drive), with whatever its last owner left in the trunk. */
function claim(v: Vehicle) {
  if (v.claimed) return;
  v.claimed = true;
  const t = (v.st.trunk ??= emptyTrunk(v.st.model));
  t.gold = 10 + Math.floor(Math.random() * 60);
  if (Math.random() < 0.6) putItems(t.items, 'medkit', 1 + Math.floor(Math.random() * 2));
  if (Math.random() < 0.3) putItems(t.items, 'emp', 1);
  if (Math.random() < 0.2) putItems(t.items, RELIC_KEYS[(Math.random() * RELIC_KEYS.length) | 0], 1);
  // (0.148) spares the last owner carried: salvage for the mechanic
  if (Math.random() < 0.4) putItems(t.items, 'gears', 1 + Math.floor(Math.random() * 2));
  if (Math.random() < 0.3) putItems(t.items, 'parts', 1);
  if (Math.random() < 0.25) putItems(t.items, 'engine', 1);
  if (Math.random() < 0.35) putItems(t.items, 'fuel', 1); // (0.177) a spare canister
  enlist(v.st); saveChar();
  showToast(tl('Found: ') + vehicleTitle(v.st.model));
}

// ---------- the dealer ----------
/** Buys a vehicle and parks it in the first free bay of the yard. Returns a message for the shop window. */
export function buyVehicle(model: VehicleModel): string {
  const spec = VEHICLES[model], c = G.char;
  if (c.gold < spec.price) return tl('Not enough gold.');
  if (!yardBay()) return tl('The yard is full. Drive one of the vehicles away first.');
  c.gold -= spec.price;
  parkNew(model);
  return TL`The ${vehicleTitle(model)} is waiting in the yard outside the north gate.`;
}
/** The first free bay of Gridholm's yard, or null. */
export const yardBay = () => YARD.bays.find((b) => !vehicles.some((v) => Math.hypot(v.st.x - b.x, v.st.z - b.z) < 7)) ?? null;
/** A new vehicle parked in the yard's first free bay (false when it is full). */
export function parkNew(model: VehicleModel): boolean {
  const bay = yardBay();
  if (!bay) return false;
  const st = stateOf({ id: model + '-' + Date.now().toString(36), model, x: bay.x, z: bay.z, heading: YARD.heading, parts: freshParts(model) });
  enlist(st); vehicles.push(makeVehicle(st)); saveChar();
  return true;
}
/** (0.187) A vehicle handed over to a convoy route: out of the world's list and off the ground. */
export function takeVehicle(v: Vehicle) {
  if (driving.v === v) leave(false);
  const i = G.char.vehicles.indexOf(v.st); if (i >= 0) G.char.vehicles.splice(i, 1); // in place: the shared list keeps its object
  delete G.char.containers[trunkKey(v.st.id)];
  removeVehicle(v); saveChar();
}
/** (0.187) A vehicle back from a convoy route, parked at (x, z) (its trunk empty, as it left). */
export function parkVehicle(id: string, model: VehicleModel, parts: VehicleParts, x: number, z: number, heading: number) {
  const st = stateOf({ id, model, x, z, heading, parts });
  enlist(st); vehicles.push(makeVehicle(st)); saveChar();
}
export function clearVehicles() {
  if (driving.v) leave(false);
  for (const v of vehicles) dropVehicle(v);
  vehicles.length = 0;
}
/** The body batch is per vehicle; wheel geometry is shared between clones and stays cached. */
function dropVehicle(v: Vehicle) { scene.remove(v.group); v.group.children[0].traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }

// ---------- interaction ----------
export interface VehicleSpot { v: Vehicle; kind: 'drive' | 'trunk' | 'service'; label: string }
/** What the player on foot could do with a vehicle right here. */
export function vehicleSpot(): VehicleSpot | null {
  let best: VehicleSpot | null = null, bd = 2.4;
  for (const v of vehicles) {
    if (v.ai || v.held || Math.abs(G.pos.y - v.y) > 2.5) continue;
    for (const side of [-1, 1]) {
      const [x, z] = toWorld(v, side * v.spec.door[0], v.spec.door[1]), d = Math.hypot(x - G.pos.x, z - G.pos.z);
      if (d < bd) { bd = d; best = { v, kind: 'drive', label: (v.claimed ? tl('drive the ') : tl('take the abandoned ')) + vehicleTitle(v.st.model) + (v.st.parts.hull <= 0 ? tl(' (wrecked)') : '') }; }
    }
    const [x, z] = toWorld(v, v.spec.rear[0], v.spec.rear[1]), d = Math.hypot(x - G.pos.x, z - G.pos.z);
    if (d < bd) { bd = d; best = { v, kind: 'trunk', label: v.claimed ? tl('open the trunk') : tl('search the abandoned ') + vehicleTitle(v.st.model) }; }
    const [fx2, fz2] = toWorld(v, v.spec.front[0], v.spec.front[1]), df = Math.hypot(fx2 - G.pos.x, fz2 - G.pos.z);
    if (df < bd) { bd = df; best = { v, kind: 'service', label: tl('service the ') + vehicleTitle(v.st.model) }; }
  }
  return best;
}
export function useVehicle(s: VehicleSpot) {
  claim(s.v);
  if (s.kind === 'service') { openService(s.v); return; }
  if (s.kind === 'trunk') {
    const v = s.v;
    const t = trunkOf(v.st);
    openTransfer({ title: vehicleTitle(v.st.model), subtitle: v.spec.role + ' · ' + v.spec.seats + ' seats', boxLabel: tl('Trunk'), box: t, bays: t.bays, onClose: () => { refreshBays(v); saveChar(); } });
    return;
  }
  const why = immobile(s.v.st.parts);
  if (why) { showToast(tl("It won't move")); logLine(why + tl(' Service it at the front of the vehicle.')); return; }
  const seat = s.v.riders[0] ? s.v.riders.findIndex((r) => !r) : 0; // the wheel, unless someone else sits there
  if (seat < 0) { showToast(tl('No free seat')); return; }
  if (s.v.held) { showToast(tl('Someone else is in it')); return; }
  driving.v = s.v; s.v.speed = 0; driving.since = performance.now(); driving.seat = seat; tended.add(s.v.st.id);
  seatRider(s.v, seat, 'you', YOU); setSeeThrough(s.v, driving.cockpit);
  G.vel.set(0, 0, 0); G.firing = false;
  G.yaw = s.v.st.heading + Math.PI; G.pitch = -0.12;
  showToast(vehicleTitle(s.v.st.model));
}
/** Get out on the driver's side (or wherever there is room). */
export function leave(save = true) {
  const v = driving.v;
  if (!v) return;
  driving.v = null; v.speed = 0; v.steer = 0; aimTurret(v); setSeeThrough(v, false); unsent.add(v.st.id);
  v.riders.forEach((r, i) => { if (r?.who === 'you') unseat(v, i); });
  const spots: [number, number][] = [[v.spec.door[0], v.spec.door[1]], [-v.spec.door[0], v.spec.door[1]], [v.spec.rear[0], v.spec.rear[1]], [v.spec.door[0] + 1, v.spec.door[1]]];
  for (const [lx, lz] of spots) {
    const [x, z] = toWorld(v, lx, lz), y = hooks ? hooks.height(x, z) : v.y;
    G.pos.set(x, y, z);
    if (!collides(G.pos) && !(hooks && hooks.blocked(x, z, 0.3))) break;
  }
  G.vel.set(0, 0, 0); G.yaw = v.st.heading + Math.PI; G.pitch = 0;
  el.veh.innerHTML = '';
  if (save) saveChar();
}

/** Moves every vehicle to the copy of the world nearest to x (after going round the planet). */
export function vehiclesNear(x: number) {
  for (const v of vehicles) { const nx = nearX(v.st.x, x); if (nx !== v.st.x) { v.st.x = nx; pose(v); } }
}
/** Move the existing vehicle, including its cargo and all seat figures, without unloading or recreating it. */
export function teleportVehicle(v: Vehicle, x: number, z: number, heading: number) {
  v.st.x = x; v.st.z = z; v.st.heading = heading; v.speed = 0; v.steer = 0;
  pose(v); G.pos.set(v.st.x, v.y, v.st.z); G.vel.set(0, 0, 0);
}
/** Player collision with parked vehicles (their body box). */
export function vehicleHit(x: number, y: number, z: number, r: number): boolean {
  for (const v of vehicles) {
    if (v === driving.v || v.held || y > v.y + v.spec.height || y + 1.7 < v.y) continue;
    const [lx, lz] = toLocal(v, x, z);
    if (Math.abs(lx) < v.spec.width / 2 + r && Math.abs(lz) < v.spec.length / 2 + r) return true;
  }
  return false;
}

// ---------- driving ----------
let deepWarnAt = 0, blockedByWater = false;
function deepWarn(v: Vehicle) {
  if (performance.now() < deepWarnAt) return;
  deepWarnAt = performance.now() + 4000;
  showToast(tl('Too deep')); logLine(TL`The water is too deep for the ${vehicleTitle(v.st.model)} (it can ford ${v.spec.wade} m).`);
}
function hullBlocked(v: Vehicle, x: number, z: number, h: number): boolean {
  blockedByWater = false;
  if (!hooks) return false;
  const probe = { st: { x, z, heading: h } }, s = v.spec, hl = s.length / 2, hw = s.width / 2;
  for (const [lx, lz] of [[-hw, hl], [hw, hl], [-hw, -hl], [hw, -hl], [0, hl], [0, -hl], [-hw, 0], [hw, 0]]) {
    const [px, pz] = toWorld(probe, lx, lz);
    if (hooks.water(px, pz) > s.wade) { blockedByWater = true; if (v === driving.v) deepWarn(v); return true; } // too deep to ford
    if (villageDist(G.char.world, px, pz, 60) < 1 || hooks.blocked(px, pz, 0.4)) return true;
  }
  for (const o of vehicles) if (o !== v && !o.held && Math.hypot(o.st.x - x, o.st.z - z) < (o.spec.length + s.length) / 2 * 0.8) {
    const [lx, lz] = toLocal(o, x, z);
    if (Math.abs(lx) < (o.spec.width + s.width) / 2 && Math.abs(lz) < (o.spec.length + s.length) / 2) return true;
  }
  return false;
}
export function updateDriving(dt: number) {
  const v = driving.v!, s = v.spec, k = G.keys, stick = G.stick, boost = engineBoost(v.st.parts), perf = partPerformance(v.st.parts), maxSpeed = s.maxSpeed * perf * boost.speed;
  const wheel = driving.seat === 0; // from another seat nobody drives: it rolls to a stop
  const want = wheel ? Math.max(-1, Math.min(1, (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) - stick.dy)) : 0;
  const dry = outOfFuel(v.st.parts), thr = dry ? 0 : want; // a dry tank: it only rolls and brakes
  if (dry && want) dryWarn();
  if (!dry) hum('mine', 'engine', 0.32 + Math.abs(thr) * 0.12, (v.st.model === 'mastodon' ? 0.75 : v.st.model === 'van' ? 0.85 : 0.95) + Math.min(1.3, Math.abs(v.speed) / 18) + Math.abs(thr) * 0.1); // (0.212.1) your engine
  const steer = wheel ? Math.max(-1, Math.min(1, (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0) - stick.dx)) : 0;
  const brake = wheel ? k.Space || G.touchJump : true;
  // throttle, rolling drag, brakes, and gravity along the slope
  v.speed += thr * s.accel * perf * boost.accel * dt * (thr * v.speed < 0 ? 2 : 1);
  v.speed -= v.speed * (thr ? 0.15 : 0.9) * dt;
  if (brake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 18 * dt);
  v.speed -= 9.8 * Math.sin(v.pitch) * dt * 0.6;
  v.speed = Math.max(-maxSpeed * 0.35, Math.min(maxSpeed, v.speed));
  v.steer += (steer - v.steer) * Math.min(1, 6 * dt);
  const dh = v.steer * s.turn * dt * Math.max(-1, Math.min(1, v.speed / 6));
  const nh = v.st.heading + dh, [fx, fz] = fwd(nh), nx = v.st.x + fx * v.speed * dt, nz = v.st.z + fz * v.speed * dt;
  // too steep to climb?
  const H = hooks!.height, ahead = H(nx + fx * s.length / 2, nz + fz * s.length / 2), behind = H(nx - fx * s.length / 2, nz - fz * s.length / 2);
  const climb = (ahead - behind) / s.length * Math.sign(v.speed || 1);
  if (hullBlocked(v, nx, nz, nh) && blockedByWater) v.speed = 0; // the water is too deep: it just won't go on
  else if (hullBlocked(v, nx, nz, nh)) {
    const impact = Math.abs(v.speed);
    if (impact > 6) showToast(tl('Crash!'));
    v.speed = -v.speed * 0.25;
    damageVehicle(v, crashDamage(v.st.model, impact));
    if (driving.v !== v) return; // the crash wrecked it
  } else if (climb > 0.8) { v.speed = 0; } else {
    if (wheel) consumeFuel(v, Math.abs(v.speed) * dt, thr, dt);
    v.st.x = nx; v.st.z = nz; v.st.heading = nh;
    if (!driving.cockpit) G.yaw += dh * 0.9; // the chase camera swings with the vehicle
    else G.yaw += dh;
  }
  v.spin += v.speed / s.wheelR * dt;
  pose(v); aimTurret(v);
  if (immobile(v.st.parts)) { leave(); return; }
  G.pos.set(v.st.x, v.y, v.st.z);
  G.vel.set(0, 0, 0);
  if (driving.seat !== 0 && v.riders[driving.seat]?.who !== 'you') { seatRider(v, driving.seat, 'you', YOU); }
  const p = v.st.parts;
  el.veh.innerHTML = TL`${vehicleTitle(v.st.model)} · ${SEAT_NAMES[driving.seat] ?? tl('seat')} · ${Math.round(Math.abs(v.speed) * 3.6)} km/h · ${aboard(v)}/${s.seats} aboard${s.enclosed ? tl(' · cab closed') : ''}` + (v.st.lights ? tl(' · lights on (L)') : tl(' · lights off (L)')) +
    `<br><span${p.hull < s.hull * 0.25 ? ' class="warn"' : ''}>${tl('condition')} ${Math.ceil(p.hull / s.hull * 100)}%</span>` +
    (([e, full, km, u]) => `<span${e < full * 0.1 ? ' class="warn"' : ''}> · ${u === 'kWh' ? tl('battery') : tl('fuel')} ${Math.ceil(e)}/${full} ${u} · ~${Math.round(km)} km</span>`)(energyOf(v.st.model, p)) + (v.turret ? tl(' · cannon') : '');
}
/** Keys 1 / 2 / 3 in your own vehicle: move to the driver's, the passenger's or the gunner's seat if it is free. */
export function switchSeat(i: number) {
  const v = driving.v;
  if (!v || i === driving.seat || i < 0 || i >= SEATS[v.st.model].length) return;
  if (v.riders[i]) { showToast(TL`The ${SEAT_NAMES[i]}'s seat is taken`); return; }
  if (SEATS[v.st.model][i].gun && !v.turret) { showToast(tl('No cannon on the roof')); return; }
  unseat(v, driving.seat); driving.seat = i; seatRider(v, i, 'you', YOU); setSeeThrough(v, driving.cockpit);
  showToast(i === 0 ? tl('At the wheel') : TL`In the ${SEAT_NAMES[i]}'s seat`);
}
/** Chase camera behind and above the vehicle (or the driver's eye in cockpit view, V). */
export function vehicleCamera(camera: THREE.PerspectiveCamera) {
  const v = driving.v!, s = v.spec;
  if (driving.cockpit) {
    const st = SEATS[v.st.model][driving.seat], eye = driving.seat === 0 ? s.eye : [st.x, st.y + (st.gun ? 1.6 : 0.75), st.z];
    const e = V(eye[0], eye[1], eye[2]).applyEuler(v.group.rotation).add(v.group.position);
    camera.position.copy(e);
    return;
  }
  const dist = s.length * 0.9 + 4, cy = Math.cos(G.pitch), f = V(-Math.sin(G.yaw) * cy, Math.sin(G.pitch), -Math.cos(G.yaw) * cy);
  const target = V(v.st.x, v.y + s.height * 0.85, v.st.z);
  // under a roof (parked in the warehouse) the camera comes in closer, so it stays inside, and keeps below the eaves
  const under = hooks?.ceiling?.(v.st.x, v.st.z);
  let p = target.clone().addScaledVector(f, -dist);
  for (let d = dist, i = 0; under !== undefined && hooks!.ceiling!(p.x, p.z) === undefined && i < 10; i++) { d *= 0.82; p = target.clone().addScaledVector(f, -d); }
  p.y += 1.2;
  if (hooks) p.y = Math.max(p.y, hooks.height(p.x, p.z) + 0.6);
  const roof = Math.min(hooks?.ceiling?.(p.x, p.z) ?? Infinity, under ?? Infinity);
  if (roof < Infinity) p.y = Math.min(p.y, roof);
  camera.position.copy(p);
}
/**
 * In the cockpit the camera sits inside the body, so the driven vehicle's dark fill would block the view:
 * hide it and keep only its lines (you look out through the frame and windows).
 */
function setSeeThrough(v: Vehicle, on: boolean) {
  v.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.visible = !on; });
  for (const r of v.riders) r?.fig.g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.visible = true; }); // the people keep their fill
  for (const r of v.riders) if (r?.who === 'you') r.fig.g.visible = !on; // your own figure: the camera is in its head
}
export const toggleCockpit = () => { driving.cockpit = !driving.cockpit; if (driving.v) setSeeThrough(driving.v, driving.cockpit); };

// ---------- selling back to the dealer ----------
/** Vehicles parked near the dealer's yard, with what Kuba would pay for each (anyone may sell one: nobody owns them). */
export function vehiclesForSale(): { v: Vehicle; price: number; why: string | null }[] {
  return vehicles.filter((v) => v.claimed && !v.held && Math.hypot(v.st.x - YARD.dealer.x, v.st.z - YARD.dealer.z) < 45).map((v) => ({
    v, price: resaleValue(v.st.model, v.st.parts, PART_PRICE.cannon ?? 0, PART_BUYBACK),
    why: v === driving.v ? tl('You are sitting in it.') : trunkOf(v.st).items.some(Boolean) || trunkOf(v.st).bays!.some(Boolean) || trunkOf(v.st).gold > 0 ? tl('Empty the trunk first.') : null,
  }));
}
export function sellVehicle(id: string): string {
  const offer = vehiclesForSale().find((o) => o.v.st.id === id);
  if (!offer) return tl('Bring it to the yard first.');
  if (offer.why) return offer.why;
  const c = G.char;
  c.gold += offer.price;
  const i = c.vehicles.findIndex((s) => s.id === id); if (i >= 0) c.vehicles.splice(i, 1);
  delete c.containers[trunkKey(id)];
  dropVehicle(offer.v); vehicles.splice(vehicles.indexOf(offer.v), 1);
  saveChar();
  return TL`Sold the ${vehicleTitle(offer.v.st.model)} for ${offer.price} gold.`;
}

// ---------- vehicles driven by bandits ----------
/** A hostile vehicle: nobody's property until its crew is beaten (then it is an abandoned, claimable wreck). */
export function spawnAIVehicle(st: VehicleState): Vehicle {
  const v = makeVehicle(st, false); v.ai = true; tint(v, true); vehicles.push(v); return v;
}
/** Hostile vehicles are drawn amber while bandits hold them (materials swapped on the body batch only). */
const hostileLine = lineMat(0xffb347), keptMats = new WeakMap<THREE.Object3D, THREE.Material>();
function tint(v: Vehicle, hostile: boolean) {
  v.group.children[0].traverse((o) => {
    const l = o as THREE.LineSegments;
    if (!l.isLineSegments) return;
    if (hostile) { keptMats.set(l, l.material as THREE.Material); l.material = hostileLine; }
    else { const m = keptMats.get(l); if (m) l.material = m; }
  });
}
/** The raiders are beaten: the vehicle stays where it is, a claimable wreck. */
/** Put a copy of another player's raider vehicle where its owner says (world/raiders.ts, shared foes). */
export function placeAI(v: Vehicle, x: number, z: number, heading: number, speed: number, dt: number) {
  v.st.x = x; v.st.z = z; v.st.heading = heading; v.speed = speed; v.spin += speed / v.spec.wheelR * dt; pose(v);
}
export function releaseAI(v: Vehicle) { v.ai = false; v.speed = 0; v.steer = 0; tint(v, false); refreshParts(v); pose(v); }
export function removeVehicle(v: Vehicle) { const i = vehicles.indexOf(v); if (i >= 0) { dropVehicle(v); vehicles.splice(i, 1); } }
/**
 * Drive an AI vehicle towards a point with the same physics limits as the player's: steering rate, acceleration,
 * obstacles, steep slopes. Returns false when it bumped into something this frame.
 */
export function steerVehicle(v: Vehicle, tx: number, tz: number, want: number, dt: number): boolean {
  const s = v.spec, dx = tx - v.st.x, dz = tz - v.st.z;
  // feelers: if the way towards the target is blocked a few metres ahead, fan out left and right for a clear line
  let aim = Math.atan2(dx, dz);
  if (want > 0) {
    const clear = (a: number) => [3, 7].every((d) => !hullBlocked(v, v.st.x + Math.sin(a) * d, v.st.z + Math.cos(a) * d, a));
    if (!clear(aim)) for (const o of [0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.3, -1.3, 1.8, -1.8]) if (clear(aim + o)) { aim += o; break; }
  }
  let dh = aim - v.st.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  const reverse = want < 0;
  // reversing: the rear points at the target, and the wheel turns the other way
  if (reverse) { dh = Math.atan2(Math.sin(dh - Math.PI), Math.cos(dh - Math.PI)); dh = -dh; }
  v.steer += (Math.max(-1, Math.min(1, dh * 1.6)) - v.steer) * Math.min(1, 5 * dt);
  const target = Math.abs(dh) > 1.4 && !reverse ? want * 0.5 : want;
  v.speed += Math.sign(target - v.speed) * Math.min(Math.abs(target - v.speed), s.accel * dt);
  v.speed -= 9.8 * Math.sin(v.pitch) * dt * 0.6;
  const turn = v.steer * s.turn * dt * Math.max(-1, Math.min(1, v.speed / 6));
  const nh = v.st.heading + turn, [fx, fz] = fwd(nh), nx = v.st.x + fx * v.speed * dt, nz = v.st.z + fz * v.speed * dt;
  const H = hooks!.height, ahead = H(nx + fx * s.length / 2, nz + fz * s.length / 2), behind = H(nx - fx * s.length / 2, nz - fz * s.length / 2);
  let ok = true;
  if (hullBlocked(v, nx, nz, nh)) { if (!blockedByWater) damageVehicle(v, crashDamage(v.st.model, v.speed)); v.speed = -v.speed * .25; ok = false; }
  else if ((ahead - behind) / s.length * Math.sign(v.speed || 1) > .8) { v.speed = 0; ok = false; }
  else { v.st.x = nx; v.st.z = nz; v.st.heading = nh; }
  v.spin += v.speed / s.wheelR * dt;
  pose(v);
  return ok;
}
/** Point in world x/z from vehicle body coordinates. */
export const bodyToWorld = (v: Vehicle, lx: number, lz: number) => toWorld(v, lx, lz);


/** (0.248) The vehicle you sit in, as the others know it (`myCars`, the index in a ride): your game moves it while
 *  you are in it, and the others draw it from what you send. Parked vehicles are the world's and need no sending. */
export const myCarList = () => (driving.v && !driving.v.ai ? [driving.v] : []);
/** The vehicle you sit in as the other players see it (net/client.ts PeerCar): model, where, the body's pose, cannon, your seat + 1, the cannon's yaw. */
export function myCars(): number[][] {
  const out: number[][] = [];
  for (const v of myCarList()) {
    const r = (n: number) => Math.round(n * 100) / 100;
    out.push([MODEL_ORDER.indexOf(v.st.model), r(v.st.x), r(v.y), r(v.st.z), r(v.st.heading), r(v.pitch), r(v.roll), v.st.parts.gun ? 1 : 0, v === driving.v ? driving.seat + 1 : 0, r(v.turret?.rotation.y ?? 0), r(v.st.parts.hull / v.spec.hull * 100), v.st.lights ? 1 : 0]); // (0.203) [11] the headlights
  }
  return out;
}
