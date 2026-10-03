import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { garrisonReady, recordGarrison } from '../src/gen/garrisons';
const state = vi.hoisted(() => ({ G: {} as any, W: { robots: [] as any[], creatures: [] as any[], bandits: [] as any[] }, authority: true, saves: vi.fn() }));
vi.mock('../src/game', () => state);
vi.mock('../src/character', () => ({ saveChar: state.saves }));
vi.mock('../src/world/overworld', () => ({ OW: { terrain: { world: 12345 } }, danger: () => 3 }));
vi.mock('../src/gen/cities', () => ({ GARRISON: { respawn: 600 }, citySites: () => [{ i: 1, x: 0, z: 0, r: 300 }], cityGarrisons: () => [{ k: 5, u: 10, v: 0, kind: 'gang', size: 1 }], cityToWorld: (_c: any, u: number, v: number) => [u, v] }));
vi.mock('../src/world/remote', () => ({ spawnAuthority: () => state.authority }));
vi.mock('../src/world/enemies', () => ({ foeRules: { blocked: () => false } }));
vi.mock('../src/world/robots', () => ({ spawnCityRobot: vi.fn(), removeRobot: vi.fn() }));
vi.mock('../src/world/creatures', () => ({ spawnRemoteCreature: vi.fn(), removeCreature: vi.fn() }));
vi.mock('../src/world/bandits', () => ({
  spawnBandit: (role: string, p: THREE.Vector3, _lv: number, group: any[]) => {
    const f = { kind: 'bandit', role, p, hp: 20, maxHp: 20 }; state.W.bandits.push(f); group.push(f); return f;
  }, removeBandit: (f: any) => { const i = state.W.bandits.indexOf(f); if (i >= 0) state.W.bandits.splice(i, 1); },
}));
import { updateGarrisons, dropGarrisons } from '../src/world/citygarrisons';
beforeEach(() => {
  dropGarrisons(); state.W.bandits.length = 0; state.W.robots.length = 0; state.W.creatures.length = 0;
  Object.assign(state.G, { char: { world: 12345, loc: 'overworld', time: 1000, cityGarrisons: {} }, pos: new THREE.Vector3(0, 0, 0), fly: false, ground: () => 0 });
  state.authority = true; state.saves.mockClear();
});
describe('city reinforcement pacing', () => {
  it('does not repeat a live group or replace killed members after streaming/reload', () => {
    updateGarrisons(1); expect(state.W.bandits).toHaveLength(3); updateGarrisons(1); expect(state.W.bandits).toHaveLength(3);
    state.W.bandits[0].hp = 0; state.W.bandits.shift(); state.W.bandits[0].hp = 7;
    updateGarrisons(1); dropGarrisons(); expect(state.W.bandits).toHaveLength(0);
    state.G.char.cityGarrisons = JSON.parse(JSON.stringify(state.G.char.cityGarrisons));
    updateGarrisons(1); expect(state.W.bandits).toHaveLength(2); expect(state.W.bandits[0].hp).toBe(7);
    expect(state.G.char.cityGarrisons['1:5'].hp[0]).toBe(0);
  });
  it('starts ten real minutes of quiet after the whole group dies and never spawns reinforcements on the player', () => {
    updateGarrisons(1); for (const f of state.W.bandits) f.hp = 0; state.W.bandits.length = 0;
    updateGarrisons(1); const s = state.G.char.cityGarrisons['1:5']; expect(s.until).toBe(1600);
    state.G.char.time = 1599; updateGarrisons(1); expect(state.W.bandits).toHaveLength(0);
    state.G.char.time = 1600; updateGarrisons(1); expect(state.W.bandits).toHaveLength(0);
    state.G.pos.x = 70; updateGarrisons(1); expect(state.W.bandits).toHaveLength(3);
    expect(state.G.char.cityGarrisons['1:5'].until).toBe(0);
  });
  it('keeps survivors when distance culls them, rather than confusing unloading with a kill', () => {
    updateGarrisons(1); state.W.bandits.length = 0; updateGarrisons(1);
    expect(state.G.char.cityGarrisons['1:5'].until).toBe(0); expect(state.W.bandits).toHaveLength(3);
  });
  it('does not duplicate another multiplayer owner’s post', () => {
    state.authority = false; updateGarrisons(1); expect(state.W.bandits).toHaveLength(0);
    state.authority = true; state.W.bandits.push({ cityPost: '1:5', hp: 20 });
    updateGarrisons(1); expect(state.W.bandits).toHaveLength(1);
  });
  it('records casualties in game-time units and never starts a cooldown from streaming alone', () => {
    const s = { until: 0, hp: {} }; recordGarrison(s, { 0: 0, 1: 7 }, 10); expect(s.until).toBe(0);
    recordGarrison(s, { 1: 0 }, 30); expect(s.until).toBe(630);
    expect(garrisonReady(s, 629)).toBe(false); expect(garrisonReady(s, 630)).toBe(true);
  });
});
