import { describe, it, expect } from 'vitest';
import { HEX, hexOf, hexCenter, hubs, hubAt, hexProblem, handOff, drainVillage, waitingAt, villageHall, villageHub, wildId, cleanHubName } from '../src/gen/warehouses';
import { WORLD_W, allVillages } from '../src/gen/regions';
import type { OutpostState } from '../src/gen/outposts';
import type { Lode } from '../src/gen/lodes';
import type { TownState } from '../src/gen/town';

describe('the warehouse hexes (0.249)', () => {
  it('tile the planet: every point lies in the hex whose middle is nearest, about a kilometre across', () => {
    expect(HEX.w * HEX.cols).toBeCloseTo(WORLD_W);
    expect(HEX.w).toBeGreaterThan(950); expect(HEX.w).toBeLessThan(1050);
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 2000; i++) {
      const x = (rnd() - 0.5) * WORLD_W, z = (rnd() - 0.5) * 40000, h = hexOf(x, z), [cx, cz] = hexCenter(h.c, h.r);
      const d = Math.hypot(((x - cx + WORLD_W * 1.5) % WORLD_W) - WORLD_W / 2, z - cz);
      expect(d).toBeLessThanOrEqual(HEX.r + 1e-6);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { // no neighbour is nearer
        const [nx, nz] = hexCenter(h.c + dc, h.r + dr), dn = Math.hypot(((x - nx + WORLD_W * 1.5) % WORLD_W) - WORLD_W / 2, z - nz);
        expect(dn).toBeGreaterThanOrEqual(d - 1e-6);
      }
    }
  });
  it('close round the planet\'s seam: the same hex on both sides', () => {
    for (const [x, z] of [[100, 50], [-30000, 9000], [WORLD_W / 2 - 3, -400]]) expect(hexOf(x + WORLD_W, z).key).toBe(hexOf(x, z).key);
  });
  it('names are cleaned', () => {
    expect(cleanHubName('  <b>North</b> "Depot"  ')).toBe('bNorth/b Depot');
    expect(cleanHubName('x'.repeat(40)).length).toBe(28);
  });
});

describe('the warehouse network (0.249)', () => {
  const world = 12345, v = allVillages(world)[0], towns: Record<string, TownState> = {};
  const at = villageHall(v, undefined)!;
  it('an old village\'s hall is a warehouse; a second one in its hex is refused, one in the next hex is fine', () => {
    const list = hubs(world, towns, {});
    expect(hubAt(list, at[0], at[1])?.id).toBe(villageHub(v.id));
    expect(hexProblem(list, at[0] + 3, at[1] + 3)).not.toBe('');
    const h0 = hexOf(at[0], at[1]);
    let far = hexCenter(h0.c + 1, h0.r);
    for (let k = 1; k < 40 && hubAt(list, far[0], far[1]); k++) far = hexCenter(h0.c + k, h0.r + (k % 3)); // a hex with no warehouse
    expect(hexProblem(list, far[0], far[1])).toBe('');
    const wild: Record<string, OutpostState> = { [wildId(hexOf(far[0], far[1]).key)]: { o: 'crew', by: 'A', t: 0, k: 'store', x: Math.round(far[0]), z: Math.round(far[1]), name: 'Far Store' } };
    expect(hexProblem(hubs(world, towns, wild), far[0] + 5, far[1])).toContain('Far Store');
  });
  it('the carriers take a deposit\'s crates to the warehouse of its hex, and the warehouse takes them in once', () => {
    const lode: Lode = { id: 'lode:t', k: 'stone', x: at[0] + 120, z: at[1] + 40, y: 0, r: 20, yaw: 0, rich: 1, name: 'Stone at Test' } as Lode;
    expect(hexOf(lode.x, lode.z).key).toBe(hexOf(at[0], at[1]).key);
    const o: OutpostState = { o: 'crew', by: 'A', t: 0, k: 'stone', x: lode.x, z: lode.z, name: lode.name, done: { dig: true }, stock: { t: 0, n: { stone: 7.4 } } };
    const outposts: Record<string, OutpostState> = { [lode.id]: o }, s: TownState = {};
    const went = handOff(world, outposts, { [v.id]: s }, (id) => (id === lode.id ? lode : null), 0);
    expect(went[0].n).toBe(7);
    expect(o.stock!.n.stone).toBeCloseTo(0.4);
    expect(waitingAt(villageHub(v.id), outposts, s.rcv)).toEqual([[lode.id, lode.id + ':0', 'stone', 7]]);
    expect(drainVillage(s, v.id, outposts)).toEqual([['stone', 7]]);
    expect(s.hold?.stone).toBe(7);
    expect(drainVillage(s, v.id, outposts)).toEqual([]); // nothing twice
    expect(waitingAt(villageHub(v.id), outposts, s.rcv)).toEqual([]);
  });
});
