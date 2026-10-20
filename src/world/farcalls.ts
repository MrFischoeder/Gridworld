// (0.237, PLAN_SPAWNOW.md stage L4) Calls from afar: a foe that is not fighting now and then makes itself heard
// well beyond the near voices of world/sound.ts (a ravager pack's howl to 260 m, a bramble's bellow, the hum of a
// heavy machine, a scout's radio chirps, bandits talking, more and with laughter round a fire), muffled and faint
// with distance and panned to where it is, so you know what is about before you see it (gen/warnings.ts).
// Each game plays the calls of the foes it has (its own and the others' copies); nothing is sent.
import { G, W } from '../game';
import { play } from './sound';
import { FAR_CALLS, REST_TALK, CALL_NEAR, type FarCall } from '../gen/warnings';

const timers = new WeakMap<object, number>();
const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);
const fighting = new Set(['hunt', 'dash', 'stalk', 'dive', 'climb', 'charge', 'fight', 'flee', 'search', 'retreat', 'recover']);

function call(o: object, at: { x: number; y: number; z: number }, c: FarCall, dt: number, every = c.every, name = c.s) {
  let t = timers.get(o);
  if (t === undefined) { timers.set(o, between(every) * Math.random()); return; } // spread the first calls out
  if ((t -= dt) > 0) { timers.set(o, t); return; }
  timers.set(o, between(every));
  const d = Math.hypot(at.x - G.pos.x, at.z - G.pos.z);
  if (d < CALL_NEAR || d > c.far) return;
  play(name, { at, vol: c.vol, far: c.far, carry: true, jitter: 0.1 });
}
/** Every frame on the surface. */
export function updateFarCalls(dt: number) {
  if (!G.playing || G.char.loc !== 'overworld') return;
  for (const c of W.creatures) {
    const k = FAR_CALLS[c.kind];
    if (k && !fighting.has(c.state)) call(c, c.p, k, dt);
  }
  for (const r of W.robots) {
    const k = FAR_CALLS[r.model];
    if (k && r.state !== 'hunt') call(r, r.p, k, dt);
  }
  const talked = new Set<object>();
  for (const b of W.bandits) {
    if (fighting.has(b.state) || b.mode === 'give' || b.mode === 'rout') continue;
    const g = b.group.find((o) => W.bandits.includes(o) && !fighting.has(o.state)) ?? b; // one voice a group at a time
    if (g !== b || talked.has(b.group)) continue;
    talked.add(b.group);
    const rest = b.mode === 'rest', k = FAR_CALLS.bandit;
    call(b, b.p, k, dt, rest ? REST_TALK.every : k.every, rest && Math.random() < REST_TALK.laugh ? 'bandit_laugh' : k.s);
  }
}
