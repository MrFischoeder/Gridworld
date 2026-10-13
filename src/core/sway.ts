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

// (0.192) Recoil: every shot kicks the view up (a punch that springs back), climbs the aim a little (most of it comes
// back by itself, so a burst walks upwards and a single shot settles), nudges it sideways, and shoves the gun back.
// Aiming and crouching soak some of it up.
export interface RecoilSpec {
  /** The view's punch (rad), the aim's climb (rad) and how much of the climb stays, the sideways nudge (rad), the gun's shove back (m). */
  kick: number; climb: number; keep: number; side: number; back: number;
}
export const RECOIL: Record<string, RecoilSpec> = {
  blaster: { kick: 0.010, climb: 0.006, keep: 0.25, side: 0.003, back: 0.05 },
  pistol: { kick: 0.026, climb: 0.016, keep: 0.3, side: 0.008, back: 0.07 },
  smg: { kick: 0.012, climb: 0.007, keep: 0.35, side: 0.006, back: 0.04 },
  shotgun: { kick: 0.06, climb: 0.035, keep: 0.3, side: 0.012, back: 0.14 },
  rifle: { kick: 0.05, climb: 0.03, keep: 0.25, side: 0.008, back: 0.12 },
};
export const RECOIL_RULE = {
  /** Share kept while aiming, and while crouched. */
  aim: 0.6, crouch: 0.75,
  /** How fast the punch springs back and the climb comes back (1/s). */
  punchBack: 14, climbBack: 6,
};
export interface Recoil {
  /** The view's punch now (rad up, rad sideways), the climb still owed back, the gun's shove (0..1 of its back). */
  up: number; side: number; owed: number; shove: number; back: number;
}
export const newRecoil = (): Recoil => ({ up: 0, side: 0, owed: 0, shove: 0, back: 0 });

/** A shot: returns how far the aim itself moves now (pitch up, yaw), the rest is the view's punch. rnd in −1..1. */
export function kickRecoil(r: Recoil, spec: RecoilSpec, aim: number, crouch: boolean, rnd: number): { pitch: number; yaw: number } {
  const k = (1 - (1 - RECOIL_RULE.aim) * Math.max(0, Math.min(1, aim))) * (crouch ? RECOIL_RULE.crouch : 1);
  r.up += spec.kick * k;
  r.side += spec.side * k * rnd * 0.5;
  r.owed += spec.climb * k * (1 - spec.keep);
  r.shove = 1; r.back = spec.back * k;
  return { pitch: spec.climb * k, yaw: spec.side * k * rnd };
}
/** Settle the recoil by dt: returns how much of the climb comes back this frame (to take off the aim's pitch). */
export function stepRecoil(r: Recoil, dt: number): number {
  const p = Math.exp(-dt * RECOIL_RULE.punchBack), c = 1 - Math.exp(-dt * RECOIL_RULE.climbBack);
  r.up *= p; r.side *= p; r.shove *= Math.exp(-dt * RECOIL_RULE.punchBack * 0.8);
  const back = r.owed * c; r.owed -= back;
  return back;
}
