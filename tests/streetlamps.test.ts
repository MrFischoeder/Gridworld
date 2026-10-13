import { describe, it, expect } from 'vitest';
import { STREET, isNight, nightBetween, oilLeft, fillLamp, lampLit, streetKw, lampProblem, type StreetLamp } from '../src/gen/streetlamps';

describe('street lamps (0.203)', () => {
  it('night runs from 20:00 to 06:00, ten hours a day', () => {
    expect(isNight(22 * 60)).toBe(true); expect(isNight(3 * 60)).toBe(true); expect(isNight(12 * 60)).toBe(false);
    expect(nightBetween(0, 1440)).toBe(600); expect(nightBetween(1440 + 600, 1440 + 1200)).toBe(0);
    expect(nightBetween(1440 + 1140, 1440 + 1260)).toBe(60);
  });
  it('an oil lamp burns its tank only by night, filled up to the tank', () => {
    const l: StreetLamp = { k: 'oil', x: 0, z: 0 };
    expect(fillLamp(l, 600, STREET.flask)).toBe(STREET.flask);
    expect(oilLeft(l, 1199)).toBe(STREET.flask); // the day passes, nothing burns
    expect(oilLeft(l, 1200 + 100)).toBe(STREET.flask - 100);
    expect(lampLit(l, 1300, false)).toBe(true); expect(lampLit(l, 1440 + 600, false)).toBe(false);
    expect(oilLeft(l, 1440 + 1440)).toBe(0);
    fillLamp(l, 3000, 99999); expect(oilLeft(l, 3000)).toBe(STREET.cap);
  });
  it('electric lamps burn on the village power and draw it by night', () => {
    const s = { lamps: [{ k: 'electric', x: 0, z: 0 }, { k: 'electric', x: 5, z: 0 }, { k: 'oil', x: 10, z: 0 }] as StreetLamp[] };
    expect(lampLit(s.lamps[0], 22 * 60, true)).toBe(true); expect(lampLit(s.lamps[0], 22 * 60, false)).toBe(false);
    expect(streetKw(s, 22 * 60)).toBe(2 * STREET.kw); expect(streetKw(s, 12 * 60)).toBe(0);
    expect(lampProblem(s, 1, 1)).toBe('close'); expect(lampProblem(s, 200, 0)).toBe('too far'); expect(lampProblem(s, 0, 20)).toBe('');
  });
});
