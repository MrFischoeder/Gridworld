const safeKey = (k) => !['__proto__', 'constructor', 'prototype'].includes(k);
const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
/** Apply only the properties changed from the writer's baseline; arrays are atomic. */
export function mergeWorld(current, base, next) {
  if (JSON.stringify(base) === JSON.stringify(next)) return current;
  if (!object(current) || !object(base) || !object(next)) return next;
  const out = structuredClone(current);
  for (const k of new Set([...Object.keys(base), ...Object.keys(next)])) {
    if (!safeKey(k) || JSON.stringify(base[k]) === JSON.stringify(next[k])) continue;
    if (!(k in next)) delete out[k]; else out[k] = mergeWorld(out[k], base[k], next[k]);
  }
  return out;
}

/** Dungeon progress consists of sets of numeric indices, rather than positional arrays. */
export function mergeProgress(current, base, next) {
  if (!Array.isArray(next) || !next.every(Number.isInteger) || (base != null && !Array.isArray(base))) return mergeWorld(current, base, next);
  const before = Array.isArray(base) ? base : [], have = Array.isArray(current) ? current : [];
  const removed = new Set(before.filter((n) => !next.includes(n)));
  return [...new Set([...have.filter((n) => !removed.has(n)), ...next.filter((n) => !before.includes(n))])];
}
