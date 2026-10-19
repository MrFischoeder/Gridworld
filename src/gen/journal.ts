// (0.230) The journal (J): what the character has taken on, and which of it is marked on the map and the compass.
// Pure: the marker ids and the list of the ones switched off.

/** The marker id of a quest, a contract or a lead (the elder's step, the side task and the guide are 'elder', 'side', 'guide'). */
export const markId = (k: 'q' | 'c' | 'l', id: string) => `${k}:${id}`;
/** The list with `id` switched (in: shown again; out: hidden). */
export function toggleId(hidden: readonly string[], id: string): string[] {
  return hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
}
/** Drop the ids of things no longer held (a quest finished, a contract handed over), so the list does not grow. */
export const pruneMarks = (hidden: readonly string[], live: readonly string[]) => hidden.filter((h) => live.includes(h));
