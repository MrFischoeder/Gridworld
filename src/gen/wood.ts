// (0.165) Logs are raw timber now: every building wants planks. Materials already handed over to a build as logs
// count on as planks (two a log, about what a log gives sawn by hand), so nothing given is lost. Pure and idempotent:
// run on loading a save and on opening a world (after a server's shared world is taken over).
const PER_LOG = 2;
type Bag = Record<string, unknown>;
const isObj = (v: unknown): v is Bag => !!v && typeof v === 'object' && !Array.isArray(v);
/** Every `...given` map under `o` (any depth): logs → planks. Returns how many were changed. */
function walk(o: unknown, depth = 0): number {
  if (depth > 6 || !o || typeof o !== 'object') return 0;
  let n = 0;
  if (Array.isArray(o)) { for (const v of o) n += walk(v, depth + 1); return n; }
  for (const [k, v] of Object.entries(o)) {
    if (/given$/i.test(k) && isObj(v)) n += convert(v);
    else n += walk(v, depth + 1);
  }
  return n;
}
function convert(m: Bag): number {
  if (typeof m.log === 'number') { m.planks = ((m.planks as number) ?? 0) + (m.log as number) * PER_LOG; delete m.log; return 1; }
  let n = 0; for (const v of Object.values(m)) if (isObj(v)) n += convert(v); // (a settlement's given is per project)
  return n;
}
/** The world's builds in a save: villages, installations, bridges, docks (and their boats on the slip). */
export function planksForLogs(c: { towns?: unknown; installs?: unknown; bridges?: unknown; piers?: unknown }): number {
  return walk(c.towns) + walk(c.installs) + walk(c.bridges) + walk(c.piers);
}
