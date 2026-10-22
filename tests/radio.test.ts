import { describe, it, expect, vi } from 'vitest';
import { newChar } from '../src/save';
const state = vi.hoisted(() => ({ G: { char: null as any } }));
vi.mock('../src/game', () => ({ G: state.G }));
vi.mock('../src/ui/hud', () => ({ showToast: vi.fn(), logLine: vi.fn(), $: () => ({ style: {} }) }));
vi.mock('../src/world/remote', () => ({ proxied: () => false }));
import { settleCrates, onCrateOverflow, addItem, takeOne, countHeld } from '../src/character';
import { pocketOf, dropEmpty, boxOf } from '../src/data/cargo';
import { orderOpen } from '../src/data/orders';
import { RADIO } from '../src/gen/radiomast';
import { radioNet, linkedHubs, hubStock, handOverMast, mastPlan } from '../src/gen/radio';
import { completeMast } from '../src/gen/radio';
import { finishJob } from '../src/gen/jobs';
import { jobOf } from '../src/gen/construction';
import { allVillages, worldDist } from '../src/gen/regions';
import { partProblem, type OutpostState } from '../src/gen/outposts';
import { demandOf } from '../src/gen/grid';
import type { TownState } from '../src/gen/town';

describe('crates that come and go (0.251)', () => {
  it('a few stones stay in the pockets, one more and they are a crate in your hands', () => {
    const c = newChar(); c.hands[0] = null; state.G.char = c; const hand = () => c.hands[0] as { k: string; b?: { k: string; n: number } } | null;
    expect(pocketOf('stone')).toBe(10);
    expect(pocketOf('wire')).toBeGreaterThan(10);
    addItem('stone', 10);
    expect(countHeld('stone')).toBe(10); expect(c.hands[0]).toBe(null);
    addItem('stone', 1);
    expect(hand()?.k).toBe('crateW'); expect(hand()?.b).toEqual({ k: 'stone', n: 11 });
    expect(c.inv.some((s) => s?.k === 'stone')).toBe(false);
    addItem('stone', 3); // more goes into the crate you hold
    expect(hand()?.b?.n).toBe(14);
    for (let i = 0; i < 4; i++) expect(takeOne('stone')).toBe(true);
    expect(c.hands[0]).toBe(null); // 10 left: back into the pockets, the crate is gone
    expect(countHeld('stone')).toBe(10);
  });
  it('the weapon you hold goes onto your back; a second crate is set down', () => {
    const c = newChar(); state.G.char = c; c.back = [null, null]; c.hands[0] = { k: 'blaster', n: 1 };
    const down: unknown[] = []; onCrateOverflow((s) => down.push(s));
    c.inv[0] = { k: 'log', n: 12 };
    expect(settleCrates()).toBe(true);
    expect(c.hands[0]?.b).toEqual({ k: 'log', n: 12 }); expect(c.back.some((s) => s?.k === 'blaster')).toBe(true);
    c.inv[1] = { k: 'stone', n: 12 };
    settleCrates();
    expect(down.length).toBe(1);
  });
  it('fuel goes into a barrel; empty ones vanish and the old steel kinds become the one kind', () => {
    expect(boxOf('fuel', 6)?.k).toBe('barrelW');
    const L = [{ k: 'crateM' as const, n: 1, b: { k: 'stone' as const, n: 3 } }, { k: 'crateW' as const, n: 1 }];
    expect(dropEmpty(L)).toBe(true);
    expect(L[0]?.k).toBe('crateW'); expect(L[1]).toBe(null);
  });
  it('nobody orders crates or barrels any more', () => {
    for (const k of ['crateW', 'crateM', 'barrelW', 'barrelM'] as const) expect(orderOpen(k)).toBe(false);
    expect(orderOpen('hatchet')).toBe(true);
  });
});

describe('the radio link (0.251, stage M3)', () => {
  const world = 12345, vs = allVillages(world);
  const near = vs.flatMap((a) => vs.filter((b) => b.id > a.id).map((b) => [a, b, worldDist(a.x, a.z, b.x, b.z)] as const)).filter(([, , d]) => d < RADIO.reach * 0.8).sort((x, y) => x[2] - y[2])[0];
  it('a village builds its mast from its stock, the builders finish it', () => {
    const s: TownState = {}, v = vs[0];
    const r = handOverMast(s, () => 99, 100);
    expect(r.started).toBe(true); expect(mastPlan(s).every((q) => q.given >= q.n)).toBe(true);
    const j = jobOf(s, 'radio')!;
    finishJob(world, v, s, j, 100 + RADIO.hours * 60);
    expect(s.mast).toBeGreaterThan(0); expect(s.mgiven).toBeUndefined(); expect(jobOf(s, 'radio')).toBeUndefined();
  });
  it('two old villages within reach with masts read each other\'s stock', () => {
    const [a, b] = near, towns: Record<string, TownState> = { [a.id]: { hold: { stone: 7 } }, [b.id]: { hold: { planks: 5 } } };
    expect(radioNet(world, towns, {}, 0).size).toBe(0);
    completeMast(towns[a.id], 10);
    expect(linkedHubs(world, towns, {}, 'v:' + a.id, 0).length).toBe(0); // the other has none
    completeMast(towns[b.id], 10);
    const l = linkedHubs(world, towns, {}, 'v:' + a.id, 0);
    expect(l.map((h) => h.id)).toEqual(['v:' + b.id]);
    expect(hubStock(world, l[0], towns, {}, 0).find(([k]) => k === 'planks')?.[1]).toBe(5);
  });
  it('a wild warehouse builds it as a part once its shed stands, and the mast draws power', () => {
    const o = { k: 'store', x: 0, z: 0, name: 'W', o: 'crew', by: 'x', t: 0 } as OutpostState;
    expect(partProblem(o, 'radio')).not.toBe('');
    o.done = { port: true };
    expect(partProblem(o, 'radio')).toBe('');
    const before = demandOf(o); o.done.radio = true;
    expect(demandOf(o)).toBe(before + RADIO.kw);
    expect(partProblem({ k: 'stone', x: 0, z: 0, name: 'S', o: 'crew', by: 'x', t: 0, done: { dig: true } } as OutpostState, 'radio')).not.toBe('');
  });
});
