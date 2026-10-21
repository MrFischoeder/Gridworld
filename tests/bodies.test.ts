import { describe, expect, it } from 'vitest';
import { BODY, bodyBox, bodyId, bodyLasts, bodyLeft, expiredBodies, type Body } from '../src/gen/bodies';

const b: Body = { id: bodyId('abc', 1000), n: 'Ala', x: 10, y: 2, z: -5, yaw: 0, loc: 'o', t: 1000 };
describe('(0.245) bodies of the fallen', () => {
  it('lie for one game day, then go', () => {
    expect(b.id).toBe('body:abc:1000');
    expect(bodyLasts(b, 1000 + BODY.life - 1)).toBe(true);
    expect(bodyLasts(b, 1000 + BODY.life)).toBe(false);
    expect(bodyLeft(b, 1000 + 60)).toBe(BODY.life - 60);
    expect(expiredBodies({ [b.id]: b }, 1000 + 100)).toEqual([]);
    expect(expiredBodies({ [b.id]: b }, 1000 + BODY.life + 1)).toEqual([b.id]);
  });
  it('hold everything that was carried, and the gold', () => {
    const kit = [{ k: 'blaster', n: 1 }, { k: 'medkit', n: 3 }] as const;
    const box = bodyBox(kit.map((s) => ({ ...s })) as never, 250);
    expect(box.gold).toBe(250);
    expect(box.items.filter(Boolean)).toEqual(kit);
    expect(box.items.length).toBeGreaterThanOrEqual(BODY.slots);
  });
});
