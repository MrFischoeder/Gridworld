import { beforeEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
vi.hoisted(() => { vi.stubGlobal('window', {}); vi.stubGlobal('navigator', { maxTouchPoints: 0 }); });
vi.mock('../src/world/render', () => ({ V: (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z) }));
vi.mock('../src/world/survival', () => ({ drainStamina: () => true, spendStamina: () => true, load: () => ({ state: 'light', kg: 0 }), loadSpeed: () => 1, burn: () => {} }));
import { G, W } from '../src/game';
import { collides, updatePlayer, H } from '../src/world/player';
import { VoxelGrid } from '../src/core/voxel';

beforeEach(() => {
  Object.assign(G, { ground: () => 0, floor: null, obstacle: null, solid: null, rayBlock: null, water: null, fly: false, onGround: false, touchJump: false, trans: null, swimming: false, stick: { dx: 0, dy: 0 }, keys: {} });
  G.S.speed = 1; G.space = { empty: () => true, setCell: () => {} }; W.portals = [];
  G.pos.set(0, 0, 0); G.vel.set(0, 0, 0);
});

// These use the real movement loop and the fractional height predicates used by rocks and city buildings.
for (const shape of ['rock', 'ruin'] as const) for (const top of [0.87, 2.37, 16.8]) for (const fps of [30, 60, 120]) {
  it(`lands on a ${shape} at ${top} m at ${fps} fps, walks away and can jump again`, () => {
    G.obstacle = (x, y, z, r) => y < top && (shape === 'rock' ? Math.hypot(x, z) < 2 + r : Math.abs(x) < 2 + r && Math.abs(z) < 2 + r);
    G.pos.y = top + 1;
    for (let i = 0; i < fps * 2; i++) updatePlayer(1 / fps);
    expect(G.onGround).toBe(true);
    expect(collides(G.pos)).toBe(false);
    expect(G.pos.y).toBeCloseTo(top, 3);
    G.keys.KeyD = true;
    for (let i = 0; i < fps / 5; i++) updatePlayer(1 / fps);
    expect(G.pos.x).toBeGreaterThan(0.5);
    expect(collides(G.pos)).toBe(false);
    G.keys.KeyD = false; G.keys.Space = true;
    updatePlayer(1 / fps);
    expect(G.vel.y).toBeGreaterThan(0);
    expect(G.pos.y).toBeGreaterThan(top);
    G.keys.Space = false; G.keys.KeyD = true;
    for (let i = 0; i < fps * 3; i++) updatePlayer(1 / fps);
    expect(G.pos.x).toBeGreaterThan(5);
    expect(G.pos.y).toBeCloseTo(0, 3);
    expect(collides(G.pos)).toBe(false);
  });
}

it('lands on voxel floors without sinking into them and walks into the next cell', () => {
  G.ground = null;
  G.space = VoxelGrid.fromOps([{ op: 'room', x: -8, y: 0, z: -8, w: 16, h: 12, d: 16 }, { op: 'solid', x: -4, y: 0, z: -4, w: 8, h: 2, d: 8 }]);
  G.pos.set(0, 3, 0);
  for (let i = 0; i < 120; i++) updatePlayer(1 / 60);
  expect(G.pos.y).toBeCloseTo(2, 3);
  expect(collides(G.pos)).toBe(false);
  G.keys.KeyD = true;
  for (let i = 0; i < 30; i++) updatePlayer(1 / 60);
  expect(G.pos.x).toBeGreaterThan(1);
});

it('stops below a fractional ceiling without passing into or through it', () => {
  const ceiling = 2.43;
  G.obstacle = (_x, y) => y + H > ceiling && y < ceiling + 0.2;
  G.pos.y = 0; G.onGround = true; G.keys.Space = true;
  let highest = 0;
  for (let i = 0; i < 120; i++) { updatePlayer(1 / 60); G.keys.Space = false; highest = Math.max(highest, G.pos.y); expect(collides(G.pos)).toBe(false); }
  expect(highest).toBeLessThanOrEqual(ceiling - H);
  expect(highest).toBeGreaterThan(0.7);
  expect(G.pos.y).toBeCloseTo(0, 3);
});


it('recovers an old rounded save on a fractional top without moving through a tall wall', () => {
  G.obstacle = (x, y, z, r) => Math.abs(x) < 2 + r && Math.abs(z) < 2 + r && y < 2.37;
  G.pos.y = 2;
  expect(collides(G.pos)).toBe(true);
  updatePlayer(1 / 60);
  expect(collides(G.pos)).toBe(false);
  expect(G.pos.y).toBeCloseTo(2.37, 3);
  G.keys.KeyD = true;
  for (let i = 0; i < 30; i++) updatePlayer(1 / 60);
  expect(G.pos.x).toBeGreaterThan(1);
  G.obstacle = (x, y, z, r) => Math.abs(x) < 2 + r && Math.abs(z) < 2 + r && y < 10;
  G.pos.set(0, 2, 0); G.vel.set(0, 0, 0); G.keys = {};
  updatePlayer(1 / 60);
  expect(G.pos.y).toBe(2);
});

for (const fps of [30, 60, 120]) it(`jumps onto a small rock from ground level at ${fps} fps and runs off it`, () => {
  const top = 0.87;
  G.obstacle = (x, y, z, r) => y < top && Math.hypot(x, z) < 2 + r;
  G.pos.set(-3.2, 0, 0); G.onGround = true; G.keys.KeyD = true;
  for (let i = 0; i < fps; i++) updatePlayer(1 / fps);
  expect(G.pos.x).toBeLessThan(-2);
  G.keys.Space = true; updatePlayer(1 / fps); G.keys.Space = false;
  let landed = false;
  for (let i = 0; i < fps * 2; i++) {
    updatePlayer(1 / fps);
    if (G.onGround && Math.abs(G.pos.x) < 2) { landed = true; expect(G.pos.y).toBeCloseTo(top, 3); }
    expect(collides(G.pos)).toBe(false);
  }
  expect(landed).toBe(true);
  expect(G.pos.x).toBeGreaterThan(4);
  expect(G.pos.y).toBeCloseTo(0, 3);
});
