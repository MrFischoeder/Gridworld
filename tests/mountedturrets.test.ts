import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
const state = vi.hoisted(() => { vi.stubGlobal('window', {}); vi.stubGlobal('navigator', { maxTouchPoints: 0 }); return { blocked: false, killed: [] as number[], saves: 0 }; });
vi.mock('../src/world/render', () => ({ scene: new THREE.Scene(), lineMat: (color: number) => new THREE.LineBasicMaterial({ color }), fillMat: () => new THREE.MeshBasicMaterial(), add: (color: number) => new THREE.LineBasicMaterial({ color }) }));
vi.mock('../src/world/player', () => ({ H: 1.7, rayWorld: (_o: unknown, _d: unknown, max: number) => state.blocked ? 0 : max }));
vi.mock('../src/world/fx', () => ({ addFx: vi.fn(), burst: vi.fn() }));
vi.mock('../src/character', () => ({ armoured: (n: number) => n * 0.5, progress: () => state.killed, progressHas: (_k: string, n: number) => state.killed.includes(n), saveChar: () => { state.saves++; } }));
vi.mock('../src/ui/hud', () => ({ showToast: vi.fn() }));
import { G } from '../src/game';
import { armoured } from '../src/character';
import { setVehicleProtection } from '../src/world/damage';
import { clearMountedTurrets, loadMountedTurrets, updateMountedTurrets, rayMountedTurret, damageMountedTurret, mountedTurretHit } from '../src/world/mountedturrets';
import { MOUNTED_TURRET as S, type MountedTurretSpec } from '../src/data/mountedturrets';
const spec: MountedTurretSpec = { id: 0, mount: 'floor', x: 0, y: 0.55, z: 0, normal: [0, 1, 0] };
const origin = new THREE.Vector3(5, 0.55, 0), direction = new THREE.Vector3(-1, 0, 0);
beforeEach(() => { setVehicleProtection(() => false, () => {}, armoured); clearMountedTurrets(); state.blocked = false; state.killed.length = 0; state.saves = 0; G.pos.set(10, 0, 0); G.hp = 100; loadMountedTurrets([spec]); });
describe('ancient turret combat', () => {
  it('warns before firing, honours its cooldown and applies armour', () => {
    updateMountedTurrets(S.warning - 0.01); expect(G.hp).toBe(100);
    updateMountedTurrets(0.02); expect(G.hp).toBe(100 - S.damage / 2);
    updateMountedTurrets(S.rate - 0.1); expect(G.hp).toBe(100 - S.damage / 2);
    updateMountedTurrets(0.11); expect(G.hp).toBe(100 - S.damage);
  });
  it('cannot shoot through cover or outside range, and reacquires with a fresh warning', () => {
    state.blocked = true; updateMountedTurrets(5); expect(G.hp).toBe(100);
    state.blocked = false; updateMountedTurrets(S.warning / 2); expect(G.hp).toBe(100);
    state.blocked = true; updateMountedTurrets(0.1); state.blocked = false;
    updateMountedTurrets(S.warning / 2); expect(G.hp).toBe(100);
    G.pos.x = S.range + 1; updateMountedTurrets(5); expect(G.hp).toBe(100);
  });
  it('keeps its mount and housing fixed while tracking and firing, and withstands unarmoured lethal damage', () => {
    const hit = rayMountedTurret(origin, direction, 8)!;
    const before = hit.gun.g.position.clone(), base = hit.gun.g.children[0], orientation = base.quaternion.clone();
    damageMountedTurret(hit.gun, S.hp);
    expect(rayMountedTurret(origin, direction, 8)).not.toBeNull();
    for (let i = 0; i < 60; i++) { G.pos.z = Math.sin(i) * 3; updateMountedTurrets(0.05); }
    expect(hit.gun.g.position.equals(before)).toBe(true); expect(base.quaternion.equals(orientation)).toBe(true);
    expect(state.killed).toEqual([]);
    expect(G.hp).toBeLessThan(100 - S.damage); // sustained fire, not a single warning shot
  });
  it('can be shot, stays destroyed after reload and observes shared destruction', () => {
    expect(mountedTurretHit(0, 0, 0, 0.3)).toBe(true);
    expect(rayMountedTurret(origin, direction, 4)).toBeNull(); // cover closer than the turret wins
    const hit = rayMountedTurret(origin, direction, 8)!; expect(hit.t).toBeCloseTo(5 - S.radius);
    damageMountedTurret(hit.gun, S.hp / (1 - S.armour)); expect(state.saves).toBe(1); expect(mountedTurretHit(0, 0, 0, 0.3)).toBe(false);
    expect(state.killed).toEqual([S.progressBase]);
    loadMountedTurrets([spec]); expect(rayMountedTurret(origin, direction, 8)).toBeNull();
    state.killed.length = 0; loadMountedTurrets([spec]); state.killed.push(S.progressBase);
    updateMountedTurrets(1); expect(rayMountedTurret(origin, direction, 8)).toBeNull(); expect(G.hp).toBe(100);
  });
});
