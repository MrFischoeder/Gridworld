import { describe, expect, it } from 'vitest';
import { NAME_PARTS, nameIndex, regionIndex, ruinTitle, shipTitle, NAME_ROWS } from '../src/gen/placenames';
import { NR, regionInfo, POLE_Z, REGION } from '../src/gen/regions';

describe('(0.242) names of ruins and wrecks', () => {
  it('has the owner\'s 500 + 500 parts, the joined words split', () => {
    for (const l of Object.values(NAME_PARTS)) { expect(l.length).toBe(500); expect(new Set(l).size).toBe(500); }
    expect(NAME_PARTS.ruinB).toContain('Crow Bastion');
  });
  it('a seeded bijection: no index twice', () => {
    const seen = new Uint8Array(250000);
    for (let i = 0; i < 250000; i++) { const k = nameIndex(-123456789, 0x7a11, i); expect(seen[k]).toBe(0); seen[k] = 1; }
  });
  it('every region of the planet gets its own ruin and ship name, and another world other names', () => {
    expect(NAME_ROWS * NR).toBeLessThanOrEqual(250000);
    expect(Math.ceil(POLE_Z / REGION)).toBeLessThan((NAME_ROWS - 1) / 2);
    const rn = new Set<string>(), sn = new Set<string>();
    for (let rz = -118; rz <= 118; rz++) for (let cx = 0; cx < NR; cx++) { const i = regionIndex(cx, rz, NR); rn.add(ruinTitle(7, i)); sn.add(shipTitle(7, i)); }
    expect(rn.size).toBe(237 * NR); expect(sn.size).toBe(237 * NR);
    expect(ruinTitle(7, 100)).toBe(ruinTitle(7, 100));
    expect(ruinTitle(8, 100)).not.toBe(ruinTitle(7, 100));
  });
  it('the places carry them, the same on both sides of the seam', () => {
    let n = 0;
    for (let rx = -12; rx <= 12; rx++) for (let rz = -12; rz <= 12; rz++) for (const p of regionInfo(4242, rx, rz).pois) {
      if (p.type === 'ruin') { expect(p.name).toMatch(/^Ruins of \S+ \S+/); n++; }
      if (p.type === 'wreck') { expect(p.name).toMatch(/^Wreck of the \S+ \S+/); n++; }
    }
    expect(n).toBeGreaterThan(20);
    const a = regionInfo(4242, 5, 3).pois.map((p) => p.name), b = regionInfo(4242, 5 + NR, 3).pois.map((p) => p.name);
    expect(b).toEqual(a);
  });
});
