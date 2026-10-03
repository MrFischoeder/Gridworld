import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
const state = vi.hoisted(() => ({ G: {} as any, W: { robots: [] as any[], creatures: [] as any[], bandits: [] as any[] }, net: { id: 1, peers: new Map<number, any>() }, heard: null as any, relay: vi.fn(), damage: vi.fn() }));
vi.mock('../src/game', () => state);
vi.mock('../src/net/client', () => ({ net: state.net, online: () => true, relay: state.relay, onRelay: (fn: any) => { state.heard = fn; } }));
vi.mock('../src/world/peers', () => ({ myLoc: () => 'surface' }));
vi.mock('../src/character', () => ({ armoured: (damage: number) => damage }));
vi.mock('../src/world/render', async () => { const { Vector3 } = await import('three'); return { V: (x: number, y: number, z: number) => new Vector3(x, y, z) }; });
vi.mock('../src/world/robots', () => ({ spawnRemoteRobot: vi.fn(), wreckRobot: vi.fn(), removeRobot: vi.fn() }));
vi.mock('../src/world/creatures', () => ({ spawnRemoteCreature: vi.fn(), fallCreature: vi.fn(), removeCreature: vi.fn() }));
vi.mock('../src/world/bandits', () => ({
  spawnBandit: (role: string, p: THREE.Vector3, level: number) => {
    const f = { kind: 'bandit', role, p, level, heading: 0, hp: 20, maxHp: 20, state: 'idle', r: 1 };
    state.W.bandits.push(f); return f;
  }, fallBandit: vi.fn(), removeBandit: (f: any) => { state.W.bandits.splice(state.W.bandits.indexOf(f), 1); }, ghostBolt: vi.fn(),
}));
vi.mock('../src/world/enemies', () => ({ damageFoe: state.damage, foeRules: { playerSafe: () => false, shielded: () => false } }));
import { syncFoes, dropCopies } from '../src/world/foesync';
import { unmarkRemote, hitOwner } from '../src/world/remote';
beforeEach(() => {
  dropCopies(); state.W.bandits.length = 0; state.relay.mockClear(); state.damage.mockReset();
  Object.assign(state.G, { pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), hp: 100, hitFlash: 0 });
  state.net.peers.set(2, { id: 2, st: { loc: 'surface', p: [5, 0, 0] } });
  syncFoes(1); state.relay.mockClear();
});
describe('shared city posts and faction damage', () => {
  it('preserves the post identity through receiving and sending actual foe snapshots', () => {
    state.heard({ t: 'foes', from: 2, loc: 'surface', list: [[77, 2, 'gunner', 5, 1, 0, 0, 20, 20, 3, 'idle', '1:5']] });
    const f = state.W.bandits[0]; expect(f.cityPost).toBe('1:5');
    unmarkRemote(f); syncFoes(1);
    const packet = state.relay.mock.calls.find(([p]) => p.t === 'foes')![0];
    expect(packet.list[0][11]).toBe('1:5');
  });
  it('sends NPC damage to the owner without player kill credit', () => {
    state.heard({ t: 'foes', from: 2, loc: 'surface', list: [[78, 2, 'gunner', 5, 1, 0, 0, 20, 20, 3, 'idle', '1:5']] });
    const f = state.W.bandits[0]; hitOwner(f, 8, true);
    expect(state.relay).toHaveBeenCalledWith(expect.objectContaining({ t: 'fhit', nid: 78, npc: true }), 2);
    unmarkRemote(f); syncFoes(1);
    const nid = state.relay.mock.calls.filter(([p]) => p.t === 'foes').at(-1)![0].list[0][0];
    state.damage.mockImplementation((target, damage) => { target.hp -= damage; }); state.relay.mockClear();
    state.heard({ t: 'fhit', from: 2, nid, dmg: 30, npc: true });
    expect(state.damage).toHaveBeenCalledWith(f, 30, false);
    expect(state.relay).not.toHaveBeenCalledWith(expect.objectContaining({ t: 'kill' }), expect.anything());
  });
});
