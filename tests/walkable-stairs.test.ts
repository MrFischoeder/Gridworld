import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
vi.hoisted(() => { vi.stubGlobal('window', {}); vi.stubGlobal('navigator', { maxTouchPoints: 0 }); });
vi.mock('../src/world/render', () => ({ V: (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z) }));
vi.mock('../src/world/survival', () => ({ drainStamina: () => true, spendStamina: () => true, load: () => ({ state: 'light', kg: 0 }), loadSpeed: () => 1, burn: () => {} }));
import { G, W } from '../src/game';
import { updatePlayer, rayWorld, collides } from '../src/world/player';
import { smallSteps, STAIR_RISE } from '../src/core/steps';
import { stairOpsFor } from '../src/gen/stairs';
import { VoxelGrid } from '../src/core/voxel';
import { DIRV, type Dir } from '../src/core/rng';
import type { Stair } from '../src/world/doors';

beforeEach(() => { Object.assign(G, { ground: null, floor: null, obstacle: null, solid: null, rayBlock: null, water: null, fly: false, onGround: true, touchJump: false, trans: null, swimming: false, stick: { dx: 0, dy: 0 }, keys: { KeyW: true, ShiftLeft: true } }); G.S.speed = 1; G.vel.set(0, 0, 0); });
describe('small stairs use real player movement', () => {
  for (const dir of ['N', 'E', 'S', 'W'] as Dir[]) for (const up of [true, false]) it(`runs ${dir} ${up ? 'up' : 'down'} and back without jumping`, () => {
    const [dx, dz] = DIRV[dir], p = { key: 'V', dir, m: 0, c: 0, axis: dx ? 'x' as const : 'z' as const, up };
    const boxes = smallSteps(p), grid = VoxelGrid.fromOps(stairOpsFor(dir, 0, 0, up));
    G.grid = grid; G.space = grid; W.portals = [{ steps: boxes }] as Stair[];
    G.pos.set(0.5 - dx, 0, 0.5 - dz); G.yaw = Math.atan2(-dx, -dz);
    const along = () => (G.pos.x - 0.5) * dx + (G.pos.z - 0.5) * dz;
    for (let i = 0; i < 600 && along() < 7.4; i++) updatePlayer(1 / 120);
    expect(along()).toBeGreaterThanOrEqual(7.4); expect(G.pos.y).toBeCloseTo(up ? 6 : -6, 1);
    expect(collides(G.pos)).toBe(false);
    G.yaw += Math.PI; G.vel.set(0, 0, 0);
    for (let i = 0; i < 600 && along() > -1; i++) updatePlayer(1 / 120);
    expect(along()).toBeLessThanOrEqual(-1); expect(G.pos.y).toBeCloseTo(0, 1);
    const tops = boxes.map(b => b.y + b.h);
    for (let i = 1; i < tops.length; i++) expect(Math.abs(tops[i] - tops[i - 1])).toBeLessThanOrEqual(STAIR_RISE);
  });
  it('stairs block weapon rays through their actual fractional solids', () => {
    const p = { key: 'V', dir: 'E' as const, m: 0, c: 0, axis: 'x' as const, up: true };
    G.space = VoxelGrid.fromOps(stairOpsFor('E', 0, 0, true)); W.portals = [{ steps: smallSteps(p) }] as Stair[];
    expect(rayWorld(new THREE.Vector3(0.5, 0.1, 0.5), new THREE.Vector3(1, 0, 0), 8)).toBeLessThan(1);
    expect(rayWorld(new THREE.Vector3(0.5, 8, 0.5), new THREE.Vector3(1, 0, 0), 7)).toBe(7);
  });
});
