import { it, expect } from 'vitest';
import { depositOf, metalOf, RARES } from '../src/gen/deposits';
import { allVillages, worldDist, GRIDHOLM_ID } from '../src/gen/regions';

it('rare deposits lie further out the rarer they are, and are deterministic', () => {
  for (const w of [12345, 777]) {
    const vs = allVillages(w), count: Record<string, number> = {};
    for (const v of vs) {
      for (const f of [depositOf, metalOf]) {
        const r = f(w, v);
        expect(f(w, v)).toBe(r);
        if (v.id === GRIDHOLM_ID) expect(r).toBeNull();
        if (!r) continue;
        count[r] = (count[r] ?? 0) + 1;
        expect(worldDist(v.x, v.z, 0, 0)).toBeGreaterThanOrEqual(RARES.find((x) => x.k === r)!.from);
      }
      const m = metalOf(w, v);
      if (m) expect(['chromite', 'rutile', 'pgmore']).toContain(m);
      const d = depositOf(w, v);
      if (d) expect(['chromite', 'rutile', 'pgmore']).not.toContain(d); // the older deposits stay as they were
    }
    for (const r of RARES) expect(count[r.k] ?? 0).toBeGreaterThan(0); // every rare exists somewhere
  }
});
