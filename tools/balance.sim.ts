// The economy's numbers at a glance (economy plan stage 8): what a crate of each old plant's goods costs in inputs and
// fuel, how long it takes, what the orders pay for it, what restoring each plant costs, and what the improvements cost.
//   npx vitest run --config tools/sim.config.ts tools/balance.sim.ts
import { it } from 'vitest';
import { INSTALLS, INSTALL_STAGES, installWorks } from '../src/gen/installs';
import { CHIPS, CELLS, FUEL } from '../src/gen/contracts';
import { IMPROVE, IMPROVE_KINDS } from '../src/gen/improve';
import { STAGES } from '../src/gen/shuttle';
import type { ItemKey } from '../src/data/items';

import { worth, crate } from './worth';
const r = (x: number) => Math.round(x);
it('economy balance', () => {
  console.log('\n=== The old plants: a crate of each ===');
  for (const s of INSTALLS) for (const w of installWorks(s.k)) {
    const c = crate(s.k, w);
    console.log(`${s.name.padEnd(22)} ${String(w.out).padEnd(11)} inputs ${String(r(c.inp)).padStart(5)} g + fuel ${String(r(c.fuel)).padStart(4)} g (${c.how}) = ${String(r(c.total)).padStart(5)} g · ${c.hours.toFixed(1)} game h a crate`);
  }
  console.log('\n=== Orders: pay per crate (danger 0 .. 6) against the cost ===');
  for (const [name, o, g] of [['fuel rods', FUEL, 'nfuel'], ['microchips', CHIPS, 'microchip'], ['power cells', CELLS, 'powercell']] as const)
    console.log(`${name.padEnd(12)} pays ${o.pay}..${o.pay + 6 * o.perDanger} g, costs ${r(worth(g))} g: margin ${r(o.pay - worth(g))}..${r(o.pay + 6 * o.perDanger - worth(g))} g`);
  console.log('\n=== Restoring each plant (materials at base prices) ===');
  for (const s of INSTALLS) {
    const st = INSTALL_STAGES[s.k], cost = st.reduce((a, x) => a + x.needs.reduce((b, [i, n]) => b + n * worth(i as string), 0), 0), paid = st.reduce((a, x) => a + x.gold, 0);
    console.log(`${s.name.padEnd(22)} ${String(r(cost)).padStart(6)} g of materials, pays back ${paid} g · ${s.band[0] / 1000}-${s.band[1] / 1000} km`);
  }
  console.log('\n=== Village improvements ===');
  for (const k of IMPROVE_KINDS) console.log(`${IMPROVE[k].name.padEnd(16)} ${String(r(IMPROVE[k].needs.reduce((a, [i, n]) => a + n * worth(i as string), 0))).padStart(6)} g of materials, pays ${IMPROVE[k].gold} g`);
  console.log('\n=== The Chariot ===');
  let all = 0;
  for (const st of STAGES) { const c = st.needs.reduce((a, [i, n]) => a + n * worth(i as ItemKey), 0); all += c; console.log(`${st.name.padEnd(14)} ${String(r(c)).padStart(6)} g`); }
  console.log(`all stages     ${r(all)} g`);
});
