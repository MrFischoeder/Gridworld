import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newChar } from '../src/save';
import type { WorldHooks, WorldDoc } from '../src/net/client';
import { mergeWorld } from '../src/net/worlddoc.mjs';

const state = vi.hoisted(() => ({
  G: { char: null as any, pos: { x: 0 } }, W: { chests: [] as any[], doors: [] as any[] }, net: { id: 1 }, online: true,
  active: new Set<string>(), hooks: null as WorldHooks | null, send: vi.fn(() => true), seed: vi.fn(), save: vi.fn(),
}));
vi.mock('../src/game', () => ({ G: state.G, W: state.W }));
vi.mock('../src/net/client', () => ({
  net: state.net, activeContainers: state.active, activeTowns: new Set<string>(), online: () => state.online, sendWorld: state.send, seedWorld: state.seed,
  onWorld: (h: WorldHooks) => { state.hooks = h; },
}));
vi.mock('../src/character', () => ({ saveChar: state.save, dungeonKey: () => 'dungeon' }));
vi.mock('../src/world/overworld', () => ({ OW: { terrain: null }, reloadStruct: vi.fn(), rebuildChunkAt: vi.fn() }));
import { joinWorld, syncWorld, worldDoc } from '../src/world/share';

function welcome(doc: WorldDoc, seeded = true) {
  state.hooks!.welcome(doc, seeded, state.G.char.world);
  return joinWorld();
}
beforeEach(() => {
  state.active.clear(); state.W.chests = []; state.W.doors = []; state.G.char = newChar(); state.online = true; state.net.id = 1;
  vi.clearAllMocks(); welcome({}); vi.clearAllMocks();
});

describe('shared world client reconciliation', () => {
  it('adopts current state while retaining personal saves and house chests', () => {
    const c = state.G.char;
    c.gold = 123; c.containers['home:chest'] = { items: [], gold: 9 }; c.harvest.old = 1;
    expect(welcome({ harvest: { current: 2 }, opened: { dungeon: 1 } })).toBe(true);
    expect(c.harvest).toEqual({ current: 2 }); expect(c.opened).toEqual({ dungeon: 1 });
    expect(c.gold).toBe(123); expect(c.containers['home:chest'].gold).toBe(9);
    expect(worldDoc().containers).not.toHaveProperty('home:chest');
  });
  it('does not seed a new server world with the old world after the UI switches seeds', () => {
    state.G.char.harvest.old = 9;
    const world = state.G.char.world + 1;
    state.hooks!.welcome({}, false, world);
    state.G.char.world = world;
    joinWorld();
    expect(state.seed).not.toHaveBeenCalled(); expect(state.G.char.harvest).toEqual({});
    expect(state.G.char.settlementRules).toBe(1);
    expect(Object.values(state.G.char.towns).every((t: any) => t.settlement?.v === 1)).toBe(true);
  });
  it('waits for a seed acknowledgement and retains edits made while seeding', () => {
    state.G.char.harvest.tree = 1;
    welcome({}, false);
    const doc = structuredClone(state.seed.mock.calls[0][0]);
    state.G.char.harvest.tree = 2; syncWorld(2);
    expect(state.send).not.toHaveBeenCalled();
    state.hooks!.doc(doc, 1);
    expect(state.G.char.harvest.tree).toBe(2);
    syncWorld(2); expect(state.send).toHaveBeenCalledTimes(1);
  });
  it('sends one batch at a time and keeps an edit made while its acknowledgement is in flight', () => {
    welcome({ towns: { '5': { wall: 1, farms: 0 } } });
    const c = state.G.char;
    c.towns['5'].wall = 2; syncWorld(2);
    const [ch, seq] = state.send.mock.calls[0] as unknown as [any[], number];
    expect(ch[0]).toEqual(['towns', '5', { wall: 2, farms: 0 }, { wall: 1, farms: 0 }]);
    c.towns['5'].farms = 1; syncWorld(2); expect(state.send).toHaveBeenCalledTimes(1);
    state.hooks!.set([['towns', '5', { wall: 2, farms: 0 }]], 1, seq);
    expect(c.towns['5']).toEqual({ wall: 2, farms: 1 });
    syncWorld(2); expect(state.send).toHaveBeenCalledTimes(2);
    expect((state.send.mock.calls[1] as unknown as [any[]])[0][0][3]).toEqual({ wall: 2, farms: 0 });
  });
  it('preserves unsent edits when another player changes another property, without echoing unchanged data', () => {
    welcome({ towns: { '5': { wall: 1, farms: 0 } } });
    state.G.char.towns['5'].farms = 1;
    state.hooks!.set([['towns', '5', { wall: 2, farms: 0 }]], 2, 1);
    expect(state.G.char.towns['5']).toEqual({ wall: 2, farms: 1 });
    syncWorld(2);
    const [ch, seq] = state.send.mock.calls[0] as unknown as [any[], number];
    state.hooks!.set(ch.map(([f, k, v]) => [f, k, structuredClone(v)]), 1, seq);
    syncWorld(2); expect(state.send).toHaveBeenCalledTimes(1);
  });
  it('takes authoritative container contents before opening and discards rejected stale changes', () => {
    welcome({ containers: { chest: { items: [], gold: 4 } } });
    const ref = state.G.char.containers.chest;
    ref.gold = 0;
    state.hooks!.set([['containers', 'chest', { items: [], gold: 4 }]], undefined, undefined, true);
    expect(state.G.char.containers.chest).toBe(ref); expect(ref.gold).toBe(4);
    ref.gold = 20;
    state.hooks!.set([['containers', 'chest', { items: [], gold: 0 }, true]], 1, 1);
    expect(ref.gold).toBe(0);
  });
  it('reserved containers use their transfer writer, and earlier echoes preserve rapid subsequent transfers', () => {
    welcome({ containers: { chest: { items: [1], gold: 4 } } });
    state.active.add('chest');
    state.G.char.containers.chest = { items: [], gold: 0 };
    syncWorld(2);
    const changes = state.send.mock.calls.flatMap((call) => (call as unknown as [any[]])[0]);
    expect(changes.some(([field]) => field === 'containers')).toBe(false);
    state.hooks!.set([['containers', 'chest', { items: [1], gold: 0 }]], 1, undefined, true);
    expect(state.G.char.containers.chest).toEqual({ items: [], gold: 0 });
  });
  it('keeps an unsent dungeon opening alongside a remote opening', () => {
    welcome({ opened: { dungeon: [] } });
    state.G.char.opened.dungeon.push(2);
    state.hooks!.set([['opened', 'dungeon', [1]]], 2, 1);
    expect(state.G.char.opened.dungeon).toEqual([1, 2]);
  });
  it('updates existing dungeon chest and locked-door runtime state without local rewards', () => {
    state.G.char.loc = 'dungeon'; state.G.char.dungeon = { ruinId: 1, depth: 1, gx: 0, gz: 0 };
    const chest = { i: 1, open: false, anim: 0 };
    const door = { idx: 2, locked: true, panelMat: { color: { setHex: vi.fn() } }, frameMat: { color: { setHex: vi.fn() } }, lock: { visible: true } };
    state.W.chests = [chest]; state.W.doors = [door];
    const xp = state.G.char.xp;
    state.hooks!.set([['opened', 'dungeon', [1]], ['unlocked', 'dungeon', [2]]], 2, 1);
    expect(chest.open).toBe(true); expect(chest.anim).toBeGreaterThan(0);
    expect(door.locked).toBe(false); expect(door.lock.visible).toBe(false); expect(state.G.char.xp).toBe(xp);
  });
  it('offline play does not send changes or alter saves', () => {
    state.online = false; state.G.char.harvest.tree = 10;
    const before = structuredClone(state.G.char); syncWorld(2);
    expect(state.G.char).toEqual(before); expect(state.send).not.toHaveBeenCalled();
  });
  it('merges nested independent edits, preserves deletions, and treats arrays atomically', () => {
    expect(mergeWorld(undefined, { wall: 1, farms: 0 }, { wall: 2, farms: 0 })).toEqual({ wall: 2, farms: 0 });
    const base = { stock: { wood: 1, ore: 2 }, items: [1], remove: 1 };
    expect(mergeWorld({ ...base, stock: { wood: 3, ore: 2 } }, base, { stock: { wood: 1, ore: 4 }, items: [2] }))
      .toEqual({ stock: { wood: 3, ore: 4 }, items: [2] });
  });
});

it('retires obsolete crossings on shared snapshots and incoming changes', () => {
  const old = { id: 'old', kind: 'chasm', x: 1, z: 2 };
  const river = { id: 'river', x: 3, z: 4 };
  welcome({ bridgeSites: { old, river }, bridges: { old: { given: {}, done: 100 }, river: { given: { log: 3 } } } });
  expect(state.G.char.bridgeSites).toEqual([river]);
  expect(state.G.char.bridges).toEqual({ river: { given: { log: 3 } } });
  state.hooks!.set([['bridgeSites', 'old', old], ['bridges', 'old', { given: {}, done: 200 }]], 2, 0);
  expect(state.G.char.bridgeSites).toEqual([river]);
  expect(state.G.char.bridges.old).toBeUndefined();
});
