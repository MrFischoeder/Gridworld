import { describe, it, expect } from 'vitest';
import { chunkSpikes, spikeHurt, giantLair, giantLairsNear, giantTurn, GIANT, SPIKE } from '../src/gen/crystalspikes';
import { biomeAt } from '../src/gen/biomes';
import { CHUNK } from '../src/gen/regions';

/** A chase on flat ground, the colossus's rules from world/creatures.ts in short: does it land a blow within `secs`? */
function chase(zig: boolean, secs = 40): { caught: boolean; t: number; trampled: number } {
  let trampled = 0, stomp = 0, gx = 0, gz = 0, h = 0, v = 0, state = 'charge', timer = 0, px = 0, pz = 35, t = 0, leg = 0, side = 1;
  const dt = 0.05, run = 9;
  for (; t < secs; t += dt) {
    // the player: straight away from it, or zigzagging across its line every second or so
    const ax = px - gx, az = pz - gz, d = Math.hypot(ax, az), away = Math.atan2(ax, az);
    if (zig && (leg -= dt) <= 0) { leg = 1.5; side = -side; }
    // zigzagging: away with a swing to each side in turn, and a hard cut across its line when it comes close
    const across = h + (Math.sin(away - h) >= 0 ? 1 : -1) * Math.PI / 2;
    const dir = !zig ? away : d < 22 ? across : away + side * 0.8;
    px += Math.sin(dir) * run * dt; pz += Math.cos(dir) * run * dt;
    const want = Math.atan2(px - gx, pz - gz); let off = want - h; off = Math.atan2(Math.sin(off), Math.cos(off));
    timer -= dt; stomp -= dt;
    if (d < GIANT.trample && v > 6 && stomp <= 0) { stomp = 1.2; trampled++; }
    if (state === 'charge') {
      v = Math.min(GIANT.speed, v + GIANT.accel * dt); h = giantTurn(h, want, v, dt);
      if (d < GIANT.strike && Math.abs(off) < GIANT.aim) { state = 'smash'; timer = GIANT.windup; }
      else if (d < GIANT.near && Math.abs(off) > GIANT.skid) state = 'skid';
    } else if (state === 'skid') { v = Math.max(0, v - GIANT.brake * dt); if (v < 1) state = 'turn'; }
    else if (state === 'turn') { v = 0; h = giantTurn(h, want, 0, dt); if (Math.abs(off) < 0.25) state = 'charge'; }
    else if (state === 'smash') { v = Math.max(0, v - GIANT.brake * 1.5 * dt); if (timer <= 0) { if (d < GIANT.reach && Math.abs(off) < GIANT.cone) return { caught: true, t, trampled }; state = 'turn'; } }
    gx += Math.sin(h) * v * dt; gz += Math.cos(h) * v * dt;
  }
  return { caught: false, t, trampled };
}

describe('the Crystal Wastes (0.277)', () => {
  it('spikes grow only in the wastes, the same every time, with room between them', () => {
    let found = 0;
    for (let cx = -400; cx < 400 && found < 30; cx += 7) for (let cz = -400; cz < 400; cz += 23) {
      const s = chunkSpikes(-123456789, cx, cz);
      expect(chunkSpikes(-123456789, cx, cz)).toEqual(s);
      for (const k of s) {
        expect(biomeAt(-123456789, k.x, k.z)).not.toBe('sea');
        expect(k.x).toBeGreaterThanOrEqual(cx * CHUNK); expect(k.x).toBeLessThan((cx + 1) * CHUNK);
        expect(k.h).toBeGreaterThanOrEqual(SPIKE.h[0]);
        found++;
      }
      for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) expect(Math.hypot(s[i].x - s[j].x, s[i].z - s[j].z)).toBeGreaterThan(s[i].r + s[j].r + 2);
    }
    expect(found).toBeGreaterThan(0);
  });
  it('a spike only blocks when leaned on, and cuts the harder the faster you come', () => {
    expect(spikeHurt(0)).toBe(0);
    expect(spikeHurt(6)).toBeGreaterThan(spikeHurt(2));
    expect(spikeHurt(9)).toBeGreaterThan(15);
  });
  it('every stretch of the wastes has one colossus lair, in the wastes, apart from the others', () => {
    const W = -123456789, all = giantLairsNear(W, 0, 0, 30000);
    expect(all.length).toBeGreaterThan(2);
    for (const L of all) {
      expect(biomeAt(W, L.x, L.z)).toBe('crystal');
      for (const o of all) if (o !== L) expect(Math.hypot(o.x - L.x, o.z - L.z)).toBeGreaterThanOrEqual(GIANT.apart);
    }
    const [i, j] = all[0].id.split(':').slice(1).map(Number);
    expect(giantLair(W, i, j)?.id).toBe(all[0].id); // the same lair asked again
  });
  it('it runs you down in a straight line, but a zigzag gets away', () => {
    expect(chase(false).caught).toBe(true);
    const z = chase(true);
    expect(z.caught).toBe(false);
    expect(z.trampled).toBeLessThanOrEqual(1);
  });
});
