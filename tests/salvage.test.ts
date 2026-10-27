import { describe, it, expect } from 'vitest';
import { shipSalvage, salvageYield, partsLeft, workingOn, SALVAGE, KESTREL_PARTS, kestrelKey, wreckKey } from '../src/gen/salvage';
import { generateShip } from '../src/gen/ship';
import { PROJECTS } from '../src/gen/settlement';
import { STATIONS } from '../src/gen/energy';
import { POWER_SRC } from '../src/gen/grid';
import { installWorks } from '../src/gen/installs';
import { ROBOTS } from '../src/data/robots';
import { ITEMS } from '../src/data/items';
import { VoxelGrid } from '../src/core/voxel';

const POWER_PARTS = ['coil', 'bearing', 'pvcell', 'inverter'];

describe('stripping wrecks for parts (0.272)', () => {
  it('every freighter has two reactor drums and two drive cabinets, many have laboratories, all standing on clear floor', () => {
    let labs = 0, consoles = 0, loaders = 0, holds = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const m = generateShip(seed * 7919), g = VoxelGrid.fromOps(m.ops);
      const s = shipSalvage(m, (x, z) => g.empty(x, 0, z) && !g.empty(x, -1, z));
      expect(s.filter((x) => x.k === 'reactor').length).toBe(2);
      expect(s.filter((x) => x.k === 'drive').length).toBe(2);
      labs += s.filter((x) => x.k === 'lab').length; consoles += s.filter((x) => x.k === 'console').length; loaders += s.filter((x) => x.k === 'loader').length;
      holds += (m.boxes ?? []).filter((b) => !b.tunnel && b.w === 27).length;
      expect(s.slice(0, 4).map((x) => x.k)).toEqual(['reactor', 'reactor', 'drive', 'drive']); // older indices kept
      for (const x of s) expect(g.empty(Math.floor(x.x), 0, Math.floor(x.z)), `${seed} ${x.k} ${x.x} ${x.z}`).toBe(true);
      expect(shipSalvage(m, (x, z) => g.empty(x, 0, z))).toEqual(shipSalvage(m, (x, z) => g.empty(x, 0, z)));
    }
    expect(labs).toBeGreaterThan(20);
    expect(consoles).toBeGreaterThan(60); // two a bridge, nearly always clear
    if (holds) expect(loaders).toBeGreaterThan(holds);
  });
  it('yields are hashed (the same for everyone) and items exist', () => {
    const a = salvageYield(5, wreckKey(77, 0), 'reactor', 1), b = salvageYield(5, wreckKey(77, 0), 'reactor', 1);
    expect(a).toEqual(b);
    let coils = 0;
    for (let i = 0; i < 200; i++) for (const [k, n] of salvageYield(3, wreckKey(i, 0), 'reactor', 0)) { expect(ITEMS[k]).toBeTruthy(); if (k === 'coil') coils += n; }
    expect(coils).toBeGreaterThan(100); expect(coils).toBeLessThan(180);
  });
  it('your own ship holds what the first power plant needs, once', () => {
    const got = new Map<string, number>();
    for (let p = 0; p < SALVAGE.parts.kestrel; p++) for (const [k, n] of salvageYield(1, kestrelKey, 'kestrel', p)) got.set(k, (got.get(k) ?? 0) + n);
    for (const [k, n] of PROJECTS.power.needs) if (POWER_PARTS.includes(k)) expect(got.get(k) ?? 0).toBeGreaterThanOrEqual(n);
    expect(KESTREL_PARTS.length).toBe(SALVAGE.parts.kestrel);
    expect(partsLeft('kestrel', { n: 3 })).toBe(0); expect(partsLeft('kestrel', undefined)).toBe(3);
  });
  it('a fresh claim by another hero keeps you off the machine', () => {
    expect(workingOn({ n: 0, by: 'b', nm: 'Ola', t: 100 }, 'a', 100.5)).toBe('Ola');
    expect(workingOn({ n: 0, by: 'b', nm: 'Ola', t: 100 }, 'a', 103)).toBe('');
    expect(workingOn({ n: 0, by: 'a', t: 100 }, 'a', 100)).toBe('');
  });
  it('every generator needs power parts; robots and the restored old plants give them', () => {
    for (const k of ['solarfarm', 'windfarm', 'coalplant', 'dieselbank', 'reactor'] as const) expect(STATIONS[k].needs.some(([i]) => POWER_PARTS.includes(i)), k).toBe(true);
    for (const q of Object.values(POWER_SRC)) expect(q.needs.some(([i]) => POWER_PARTS.includes(i))).toBe(true);
    for (const p of POWER_PARTS) {
      expect(Object.values(ROBOTS).some((r) => r.loot.some(([k]) => k === p)), p).toBe(true);
      expect((['precision', 'chips', 'optical'] as const).some((k) => installWorks(k).some((w) => w.out === p)), p).toBe(true);
    }
  });
});
