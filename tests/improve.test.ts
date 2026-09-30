import { describe, it, expect } from 'vitest';
import { IMPROVE, IMPROVE_KINDS, improvePlan, handOverImprove, hasImprove, villageKw, VILLAGE_BASE_KW, LAMPS_KW, BANK, autoMult, autoStaffing, armourHold, armourDrain } from '../src/gen/improve';
import { balance } from '../src/gen/energy';
import { findPoi, GRIDHOLM_ID } from '../src/gen/regions';
import { production } from '../src/gen/industry';
import { hallPick, newInstall, INSTALL_STAGES, HALL_SETS, radarUpPlan, handOverRadarUp, radarRange, RADAR, RADAR_UP, type InstallState } from '../src/gen/installs';
import { engineBoost, freshParts } from '../src/data/vehicles';
import { ORDERS } from '../src/data/orders';
import { PLANT_LEVELS } from '../src/gen/plantup';
import { usesOf } from '../src/data/uses';
import { ITEMS } from '../src/data/items';
import type { TownState } from '../src/gen/town';

const all = () => 99;

describe('stage 6: the components of the old plants put to use', () => {
  it('village improvements are built bit by bit from the stock; the armoured wall only on stone', () => {
    const s: TownState = {};
    expect(improvePlan('lamps', s)!.problem).toBe('');
    const half = handOverImprove('lamps', s, (i) => (i === 'batteries' ? 2 : 0));
    expect(half.built).toBe(false); expect(half.taken).toEqual([['batteries', 2]]);
    expect(handOverImprove('lamps', s, all).built).toBe(true);
    expect(hasImprove(s, 'lamps')).toBe(true); expect(improvePlan('lamps', s)).toBeNull();
    expect(improvePlan('armour', s)!.problem).toMatch(/stone/);
    expect(handOverImprove('armour', s, all).taken).toEqual([]);
    s.wall = 2; expect(handOverImprove('armour', s, all).built).toBe(true);
    // every component of the old plants has a use here or in the orders
    for (const k of ['powercell', 'batteries', 'sensor', 'microchip', 'precision', 'automation', 'aluminium', 'alloy'] as const) expect(usesOf(k).length).toBeGreaterThan(0);
    for (const k of IMPROVE_KINDS) for (const [i] of IMPROVE[k].needs) expect(ITEMS[i]).toBeTruthy();
  });
  it('battery lamps cut what the village takes; the battery bank gives power back when the renewables fall short', () => {
    expect(villageKw({})).toBe(VILLAGE_BASE_KW); expect(villageKw({ imp: { lamps: true } })).toBe(LAMPS_KW);
    const v = findPoi(1, GRIDHOLM_ID)!;
    const s: TownState = { stations: [{ k: 'solarfarm', on: true, fuel: 0, t: 0 }] };
    const night = 1440 * 3 + 60, noon = 1440 * 3 + 720;
    expect(balance(1, v, 1, s, night).bank).toBe(0);
    const b: TownState = { ...s, imp: { bank: true } }, bn = balance(1, v, 1, b, night);
    expect(bn.bank).toBeGreaterThan(20); expect(bn.bank).toBeLessThanOrEqual(BANK.kw);
    expect(bn.made).toBeCloseTo(balance(1, v, 1, s, night).made + bn.bank, 5);
    expect(balance(1, v, 1, b, noon).bank).toBeLessThan(bn.bank); // in the sun it charges rather than gives
    expect(balance(1, v, 1, { imp: { bank: true } }, night).bank).toBeGreaterThanOrEqual(0);
  });
  it('an automated site makes half as much again and needs no hands', () => {
    const v = findPoi(1, GRIDHOLM_ID)!, t = 1440 * 5;
    const a = production(1, v, 1, {}, t), b = production(1, v, 1, { imp: { automation: true } }, t);
    expect(autoMult({ imp: { automation: true } })).toBe(1.5);
    expect(b).toBeGreaterThanOrEqual(a * 1.5 - 1e-9);
    expect(autoStaffing({ imp: { automation: true } }, 0.4)).toBe(1); expect(autoStaffing({}, 0.4)).toBe(0.4);
  });
  it('the armoured wall holds raids more often and slows the gates\' wear', () => {
    expect(armourHold({ wall: 2, imp: { armour: true } })).toBeGreaterThan(0);
    expect(armourHold({ wall: 1, imp: { armour: true } })).toBe(0); // (a wall that fell back to timber loses its plates' use)
    expect(armourDrain({ wall: 2, imp: { armour: true } })).toBeLessThan(1);
  });
  it('the halls of the old plants burn power cells; two sets together when one is not enough', () => {
    expect(HALL_SETS.map((h) => h.fuel)).toEqual(['coal', 'fuel', 'nfuel', 'powercell']); // (appended: the others kept their places)
    const s: InstallState = { ...newInstall(), stage: INSTALL_STAGES.robotics.length, pw: { powercell: 5 } };
    expect(hallPick('robotics', s)).toBeNull(); // 160 kW < 200
    s.pw!.coal = 10; expect(hallPick('robotics', s)!.map((h) => h.fuel)).toEqual(['coal', 'powercell']);
    const p: InstallState = { ...newInstall(), stage: INSTALL_STAGES.precision.length, pw: { powercell: 5 } };
    expect(hallPick('precision', p)!.map((h) => h.fuel)).toEqual(['powercell']);
  });
  it('the radar station hears further with a sensor array, once restored', () => {
    const s: InstallState = newInstall();
    expect(radarUpPlan(s)).toBeNull();
    s.stage = INSTALL_STAGES.radar.length; expect(radarRange(s)).toBe(RADAR.r);
    expect(handOverRadarUp(s, all).built).toBe(true);
    expect(radarRange(s)).toBe(RADAR_UP.r); expect(radarUpPlan(s)).toBeNull();
  });
  it('precision components: a drivetrain for vehicles, and the automated power plant', () => {
    const p = freshParts('scout'); p.mods = ['drivetrain', 'turbo'];
    const b = engineBoost(p); expect(b.speed).toBeCloseTo(1.15 * 1.2); expect(b.accel).toBeCloseTo(1.3 * 1.25);
    expect(ORDERS.find((o) => o.out === 'drivetrain')!.tech).toBe('precision');
    expect(ORDERS.find((o) => o.out === 'scanner')!.tech).toBe('sensors');
    expect(PLANT_LEVELS[3].needs.map(([k]) => k)).toContain('precision');
  });
});
