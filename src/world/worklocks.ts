// (0.270) Who is working a lying thing. A tiny module of its own so drops, the ground panel and hand work can ask
// without importing the workshop (gen/workshop.ts has the rules; the claims are the shared Char.workclaims).
import { G } from '../game';
import { claimedByOther } from '../gen/workshop';
/** The hero working the lying thing `dropId` right now, if it is not you. */
export const workedBy = (dropId: string | undefined): string | null => claimedByOther(G.char.workclaims, dropId, G.char.pid, G.char.time)?.n ?? null;
