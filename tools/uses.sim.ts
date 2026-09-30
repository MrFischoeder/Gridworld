import { it } from 'vitest';
import { ITEMS, type ItemKey } from '../src/data/items';
import { usesOf } from '../src/data/uses';
it('uses', () => {
  const low: string[] = [];
  for (const k of Object.keys(ITEMS) as ItemKey[]) {
    const t = ITEMS[k].type; if (t !== 'good' && t !== 'mat') continue;
    const n = usesOf(k).reduce((a, [, l]) => a + l.length, 0);
    if (n < 2) low.push(`${k} (${t}) ${n}: ${JSON.stringify(usesOf(k))}`);
  }
  console.log(low.join('\n'));
});
