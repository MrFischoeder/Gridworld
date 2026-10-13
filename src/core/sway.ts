// (0.191) The body in first person: the view rocks with every step (more when running), the hands breathe even
// standing still, and steadying the gun (aiming) calms both. Pure: the runtime feeds it the speed, the gait and
// the aim each frame and puts the result on the camera (main.ts) and the gun (world/weapons.ts). Shots leave along
// the camera, so the wandering view is what makes aiming on the move harder: the crosshair stays true, but it
// will not sit still on the target.

export const SWAY = {
  /** Metres a step covers walking / sprinting (sets the step rate from the speed). */
  stride: 1.5, strideRun: 2.1,
  /** Walking: the eye's bounce (m), side sway (m) and the head's pitch / yaw / roll (rad). */
  walk: { bob: 0.032, side: 0.022, pitch: 0.006, yaw: 0.005, roll: 0.008 },
  /** Running shakes this many times as much. */
  run: 2.6,
  /** Crouched you walk smoother. */
  crouch: 0.55,
  /** Breathing while still: a slow figure eight (rad) and its pace (rad/s). */
  breathe: 0.0028, breatheRate: 1.1,
  /** Out of breath (stamina low) the breathing sway grows up to this many times. */
  winded: 3.2,
  /** Aiming keeps this share of the sway (walking and breathing alike). */
  aimKeep: 0.3,
  /** How fast the gait's strength follows the speed (1/s). */
  ease: 7,
  /** The gun trails the view's turns: how much (m per rad) and how fast it catches up (1/s). */
  lag: 0.09, lagEase: 10,
};

export interface SwayIn {
  /** Horizontal speed (m/s) and whether the feet are on the ground. */
  speed: number; ground: boolean;
  /** Sprinting, crouching. */
  run: boolean; crouch: boolean;
  /** 0..1 how far the gun is raised to the eye. */
  aim: number;
  /** 0..1 how winded (1 - stamina share). */
  winded: number;
}
export interface Sway {
  /** Phase of the stride (a step every π), the gait's eased strength (0 still .. 1 walk .. SWAY.run sprint), breathing time. */
  phase: number; amp: number; t: number;
  /** The result: camera offsets (metres up and right) and angles (rad). */
  up: number; right: number; pitch: number; yaw: number; roll: number;
  /** The hands' own bob (-1..1 of the step) for the viewmodel. */
  step: number; side: number;
}
export const newSway = (): Sway => ({ phase: 0, amp: 0, t: 0, up: 0, right: 0, pitch: 0, yaw: 0, roll: 0, step: 0, side: 0 });

/** Advance the sway by dt and work out this frame's offsets. */
export function stepSway(s: Sway, i: SwayIn, dt: number): Sway {
  const W = SWAY.walk;
  const moving = i.ground && i.speed > 0.4;
  const gait = !moving ? 0 : (i.run ? SWAY.run : 1) * (i.crouch ? SWAY.crouch : 1) * Math.min(1, i.speed / 3);
  s.amp += (gait - s.amp) * Math.min(1, dt * SWAY.ease);
  if (moving) s.phase = (s.phase + dt * Math.PI * i.speed / (i.run ? SWAY.strideRun : SWAY.stride)) % (Math.PI * 4);
  s.t += dt;
  const keep = 1 - (1 - SWAY.aimKeep) * Math.max(0, Math.min(1, i.aim));
  const a = s.amp * keep, p = s.phase;
  // a step lifts and drops the eye twice a stride; the body leans side to side once
  const bounce = Math.abs(Math.sin(p)), lean = Math.sin(p);
  s.step = bounce * 2 - 1; s.side = lean;
  s.up = -a * W.bob * (1 - bounce);
  s.right = a * W.side * lean;
  s.roll = -a * W.roll * lean;
  // breathing: always there, bigger when winded, calmer when aiming
  const b = SWAY.breathe * (1 + (SWAY.winded - 1) * Math.max(0, Math.min(1, i.winded))) * keep, r = SWAY.breatheRate * (1 + i.winded * 0.8);
  s.pitch = a * W.pitch * Math.cos(p * 2) + b * Math.sin(s.t * r * 2) * 0.6;
  s.yaw = a * W.yaw * lean + b * Math.sin(s.t * r);
  return s;
}
