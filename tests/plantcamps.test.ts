import { describe, it, expect, afterEach } from 'vitest';
import { CREW, campId, needsCrew, newCamp, campSpots, crewOf, crewRuleFor } from '../src/gen/plantcamps';
import { INSTALL_STAGES, newInstall, runInstall, setCrewRule, canRun, type InstallSite } from '../src/gen/installs';
import { partProblem, handOver, finishDue, jobEnd, type OutpostState } from '../src/gen/outposts';
import { crews, pantryOf, LIFE } from '../src/gen/outpostlife';
import { worthRobbing } from '../src/gen/outpostraids';
import { portClaims } from '../src/gen/ports';
import { fertility } from '../src/gen/fertility';

const W = -424242;
let X0 = 3000;
while (fertility(W, X0, 0) < 0.8) X0 += 500;
const site: InstallSite = { k: 'chips', name: 'Old Chip Foundry', x: X0, z: 0, y: 5, yaw: 0.3, r: 64 };
const camp = (n = 0): OutpostState => {
  const o = newCamp(site, 'Ala', 0, 'crew', campSpots(site, () => true));
  if (n) { o.n = { bunks: 3, field: 3 }; o.life = { t: 0, n, food: 80, fed: 1 }; }
  return o;
};
afterEach(() => setCrewRule(null));

describe('crews at the old plants (stage Z4)', () => {
  it('only in new worlds, only for the plants that make something', () => {
    expect(needsCrew(W, 'chips')).toBe(true);
    expect(needsCrew(W, 'radar')).toBe(false);
    expect(needsCrew(W, 'powerplex')).toBe(false);
    expect(needsCrew(12345, 'chips')).toBe(false); // an old world
    for (const n of Object.values(CREW)) expect(n).toBeGreaterThanOrEqual(6);
  });
  it('a camp builds bunkhouses and fields round the plant, nothing else', () => {
    const o = camp();
    expect(o.k).toBe('camp');
    expect(o.cw).toBe(CREW.chips);
    expect(partProblem(o, 'dig')).not.toBe('');
    expect(partProblem(o, 'power')).not.toBe('');
    expect(partProblem(o, 'port')).not.toBe('');
    expect(partProblem(o, 'bunks')).toBe('');
    expect(handOver(o, 'bunks', () => 99, 0).started).toBe(true);
    expect(finishDue(o, null, jobEnd(o))).toBe('bunks');
    expect(o.life).toBeTruthy();
    expect(pantryOf(o)).toBe(LIFE.shed);
    expect(worthRobbing({ ...o, life: { t: 0, n: 20, food: 0, fed: 1 } })).toBe(false);
    for (const q of [...o.ps!.bunks, ...o.ps!.fields]) expect(Math.hypot(q[0] - site.x, q[1] - site.z)).toBeGreaterThan(site.r);
    expect(portClaims(W, { [campId('chips')]: o }).length).toBe(1); // the bunkhouse's ground is levelled
  });
  it('the fields come first, then the plant', () => {
    const o = camp(12);
    const w = crews(o, 12);
    expect(w.farm).toBe(9);
    expect(w.dig).toBe(3);
    expect(crews(o, 20).dig).toBe(CREW.chips);
  });
  it('a batch starts only with the whole crew', () => {
    const outs: Record<string, OutpostState> = {};
    const rule = crewRuleFor(W, () => outs);
    expect(rule('chips', 0)).toBe(false); // no camp
    expect(rule('radar', 0)).toBe(true);
    outs[campId('chips')] = camp(12);
    expect(crewOf(W, outs, 'chips', 0)).toEqual({ at: 3, need: 8 });
    expect(rule('chips', 0)).toBe(false);
    outs[campId('chips')] = camp(20);
    expect(rule('chips', 0)).toBe(true);
    expect(crewRuleFor(12345, () => ({}))('chips', 0)).toBe(true); // old worlds need none
  });
  it('the plant stands without its crew and works with it', () => {
    const s = newInstall();
    s.stage = INSTALL_STAGES.chips.length;
    s.inp = { glass: 20, copperbar: 10, chems: 10, rareearth: 10 };
    const grid = 1e9; // powered along the pylons
    setCrewRule(() => false);
    expect(canRun('chips', s, grid)).toBe(false);
    runInstall('chips', s, 2000, grid);
    expect(s.out).toBe(0);
    setCrewRule(() => true);
    runInstall('chips', s, 4000, grid);
    expect(s.out).toBeGreaterThan(0);
  });
});
