import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { hostile, shotSphere } from '../src/core/factions';
const state = vi.hoisted(() => ({ G: {} as any, W: { robots: [] as any[], creatures: [] as any[], bandits: [] as any[] } }));
vi.mock('../src/game', () => state);
import { withFoeTarget, setCombatHooks, setRemoteHooks, targetingFoe, proxied, hitCombatFoe } from '../src/world/remote';
const foe = (kind: string, x: number) => ({ kind, p: new THREE.Vector3(x, 1.1, 0), hp: 30, r: 1 });
beforeEach(() => {
  Object.assign(state.G, { pos: new THREE.Vector3(80, 0, 0), vel: new THREE.Vector3(2, 0, 0), hp: 100, dmgFlash: 0 });
  state.W.robots = []; state.W.creatures = []; state.W.bandits = [];
  setRemoteHooks({ others: () => [], authority: () => true, hurt: vi.fn(), hit: vi.fn(), bolt: vi.fn() });
  setCombatHooks({ visible: () => true, hit: (f, damage) => { f.hp -= damage; } });
});
describe('separate enemy factions', () => {
  it('allows human/nonhuman combat, protects machines and wildlife from each other and their own faction', () => {
    for (const a of ['player', 'bandit', 'robot', 'wildlife'] as const) for (const b of ['player', 'bandit', 'robot', 'wildlife'] as const) {
      const friendly = a === b || (a === 'robot' && b === 'wildlife') || (a === 'wildlife' && b === 'robot');
      expect(hostile(a, b)).toBe(!friendly);
    }
  });
  it('makes machines and creatures choose a nearby bandit, routes melee damage and restores the player', () => {
    for (const kind of ['robot', 'ravager']) {
      const attacker = foe(kind, 0), bandit = foe('bandit', 3);
      state.W.bandits = [bandit];
      withFoeTarget(attacker, () => {
        expect(targetingFoe()).toBe(true); expect(proxied()).toBe(true);
        expect(state.G.pos.x).toBe(3); state.G.hp -= 6; state.G.vel.set(9, 9, 9);
      });
      expect(bandit.hp).toBe(24); expect(state.G.hp).toBe(100);
      expect(state.G.pos.x).toBe(80); expect(state.G.vel.x).toBe(2);
      expect(targetingFoe()).toBe(false); expect(proxied()).toBe(false);
    }
  });
  it('allows bandit retaliation, skips blocked/dead targets and prefers a closer player', () => {
    const b = foe('bandit', 0), r = foe('robot', 3); state.W.robots = [r];
    withFoeTarget(b, () => { state.G.hp -= 4; }); expect(r.hp).toBe(26);
    setCombatHooks({ visible: () => false, hit: vi.fn() });
    withFoeTarget(b, () => expect(targetingFoe()).toBe(false));
    setCombatHooks({ visible: () => true, hit: vi.fn() }); r.hp = 0;
    withFoeTarget(b, () => expect(targetingFoe()).toBe(false)); r.hp = 30;
    state.G.pos.x = 1;
    withFoeTarget(b, () => expect(targetingFoe()).toBe(false));
  });
  it('never redirects to or harms the other nonhuman faction, including area hits', () => {
    const r = foe('robot', 0), c = foe('ravager', 2); state.W.creatures = [c];
    withFoeTarget(r, () => expect(targetingFoe()).toBe(false)); hitCombatFoe(c, 500, r);
    state.W.robots = [r]; withFoeTarget(c, () => expect(targetingFoe()).toBe(false)); hitCombatFoe(r, 500, c);
    expect(r.hp).toBe(30); expect(c.hp).toBe(30);
  });
  it('restores player and proxy state even when an enemy mind throws', () => {
    state.W.bandits = [foe('bandit', 2)];
    expect(() => withFoeTarget(foe('robot', 0), () => { throw new Error('mind'); })).toThrow('mind');
    expect(state.G.pos.x).toBe(80); expect(proxied()).toBe(false);
  });
  it('detects a fast projectile that crossed an entire body between frames', () => {
    expect(shotSphere(0, 1, 0, 1, 0, 0, 12, 5, 1, 0, 1)).toBe(4);
    expect(shotSphere(0, 1, 0, 1, 0, 0, 3, 5, 1, 0, 1)).toBeNull();
    expect(shotSphere(0, 1, 0, 1, 0, 0, 12, 5, 1, 3, 1)).toBeNull();
  });
});
