import { describe, it, expect } from 'vitest';
import { DRONE, GUARD, CLEARED, REPOP, recordKill, refill, refillAt, clearedAt, labyrinthDrones } from '../src/gen/repopulate';
import { labyrinthTurrets } from '../src/gen/mountedturrets';

describe('dungeon foes stay dead until the place is cleared, then come back after 7–14 days', () => {
  it('a sector is cleared only when every drone and guard is down; bosses and turrets are kept through a refill', () => {
    const k: number[] = [3, 1_000_000 + 2]; // a boss and a turret
    expect(recordKill(k, DRONE + 0, 2, 1, 100)).toBe(false);
    expect(recordKill(k, DRONE + 1, 2, 1, 200)).toBe(false);
    expect(clearedAt(k)).toBeNull();
    expect(recordKill(k, GUARD + 0, 2, 1, 300)).toBe(true);
    expect(clearedAt(k)).toBe(300);
    expect(refill(1, 's:1:0:0', k, 300 + REPOP.min - 1)).toBe(false); // nothing before a week
    const back = refillAt(1, 's:1:0:0', 300);
    expect(back).toBeGreaterThanOrEqual(300 + REPOP.min); expect(back).toBeLessThanOrEqual(300 + REPOP.max);
    expect(refill(1, 's:1:0:0', k, back)).toBe(true);
    expect(k).toEqual([3, 1_000_000 + 2]);
    expect(k.some((n) => n >= CLEARED)).toBe(false);
  });
  it('a partly cleared sector never refills, however long you wait', () => {
    const k: number[] = [];
    recordKill(k, DRONE + 0, 3, 0, 10);
    expect(refill(1, 'x', k, 10 + 100 * 1440)).toBe(false);
    expect(k).toEqual([DRONE]);
  });
  it('labyrinths hold more drones than before and at most one anchored gun', () => {
    expect(labyrinthDrones(6, 1)).toBeGreaterThan(6 + 1 + 1);
    const n = Array.from({ length: 200 }, (_, i) => labyrinthTurrets(i * 7919));
    expect(Math.max(...n)).toBe(1); expect(n.filter((x) => x === 1).length).toBeGreaterThan(60); expect(n.filter((x) => x === 0).length).toBeGreaterThan(60);
  });
});
