import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { installSites, installMisfit, inInstall, INSTALLS, INSTALL_STAGES, INSTALL_WORK, newInstall, installPlan, handOverInstall, runInstall, installDone, loadInstall, fixInstall } from '../src/gen/installs';
import { ITEMS } from '../src/data/items';
import { chunkTrees } from '../src/gen/trees';
import { CHUNK } from '../src/gen/regions';

describe('great installations', () => {
  it('stand in fixed, fitting places in their band, on bare ground', () => {
    for (const w of [12345, 777, 1, 4242]) {
      const t = new Terrain(w), a = installSites(t);
      expect(a).toEqual(installSites(new Terrain(w)));
      expect(a.length).toBe(INSTALLS.length);
      for (const s of a) {
        const spec = INSTALLS.find((x) => x.k === s.k)!, d = Math.hypot(s.x, s.z);
        expect(d).toBeGreaterThanOrEqual(spec.band[0] - 1); expect(d).toBeLessThanOrEqual(spec.band[1] + 1);
        expect(installMisfit(t, s.x, s.z, s.r)).toBeNull();
        const cx = Math.floor(s.x / CHUNK), cz = Math.floor(s.z / CHUNK);
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const tr of chunkTrees(t, cx + i, cz + j)) expect(inInstall(t, tr.x, tr.z)).toBe(false);
      }
    }
  });

  it('are restored stage by stage, the last one only with the plans', () => {
    const s = newInstall(), plenty = () => 99;
    for (const st of INSTALL_STAGES.uranium) for (const [k] of st.needs) expect(ITEMS[k]).toBeTruthy();
    // bit by bit: half of each first
    const half = handOverInstall('uranium', s, {}, (k) => Math.floor((INSTALL_STAGES.uranium[0].needs.find((n) => n[0] === k)?.[1] ?? 0) / 2), 0);
    expect(half.built).toBe(false); expect(s.stage).toBe(0);
    expect(handOverInstall('uranium', s, {}, plenty, 0).built).toBe(true); expect(s.stage).toBe(1);
    expect(handOverInstall('uranium', s, {}, plenty, 0).built).toBe(true); expect(s.stage).toBe(2);
    // the core needs Uranium Enrichment
    expect(installPlan('uranium', s, {})!.plans).toBe(false);
    expect(handOverInstall('uranium', s, {}, plenty, 0)).toEqual({ taken: [], built: false });
    expect(handOverInstall('uranium', s, { enrichment: 5 }, plenty, 100).built).toBe(true);
    expect(installDone('uranium', s)).toBe(true); expect(installPlan('uranium', s, {})).toBeNull(); expect(s.t).toBe(100);
  });
  it('turn ore into fuel by game time, while fed and with room', () => {
    const w = INSTALL_WORK.uranium, s = { ...newInstall(), stage: INSTALL_STAGES.uranium.length, inp: { uranium: 7 }, t: 0 };
    runInstall('uranium', s, w.batch - 1); expect(s.out).toBe(0);
    runInstall('uranium', s, w.batch * 10); // ore for two batches only
    expect(s.out).toBe(2); expect(s.inp.uranium).toBe(1); expect(s.t).toBe(w.batch * 10);
    s.inp.uranium = 30; runInstall('uranium', s, w.batch * 10 + 5); runInstall('uranium', s, w.batch * 13 + 5);
    expect(s.out).toBe(5); expect(s.inp.uranium).toBe(21);
    runInstall('uranium', s, w.batch * 100); expect(s.out).toBe(w.bay); expect(s.inp.uranium).toBe(30 - (w.bay - 2) * 3);
    // an unrestored plant makes nothing
    const u = { ...newInstall(), inp: { uranium: 9 } }; runInstall('uranium', u, 99999); expect(u.out).toBe(0);
    // old saves kept the ore as a number
    expect(fixInstall('uranium', { ...newInstall(), inp: 4 as unknown as Record<string, number> }).inp).toEqual({ uranium: 4 });
  });
  it('the chip foundry needs every input for a batch', () => {
    const w = INSTALL_WORK.chips, s = { ...newInstall(), stage: INSTALL_STAGES.chips.length };
    expect(loadInstall('chips', s, 'glass', 99, 0)).toBe(w.hopper);
    expect(loadInstall('chips', s, 'uranium', 5, 0)).toBe(0);
    runInstall('chips', s, w.batch * 5); expect(s.out).toBe(0); // no copper yet
    expect(loadInstall('chips', s, 'copperbar', 3, w.batch * 5)).toBe(3);
    runInstall('chips', s, w.batch * 20); expect(s.out).toBe(3); expect(s.inp.glass).toBe(w.hopper - 6); expect(s.inp.copperbar).toBe(0);
    expect(INSTALL_STAGES.chips[2].tech).toBe('chips');
  });
});
