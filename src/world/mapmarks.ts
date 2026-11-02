// (0.290) The map markers this game sees: your own (Char.marks) and the ones shared with everyone (Char.pmarks,
// world/share.ts), each shown or hidden by you alone (Char.hideMarks 'pm:<id>').
import { G } from '../game';
import { net, online } from '../net/client';
import { wrapDx } from '../gen/regions';
import { visibleMarks, mayEditPub, type PubMark } from '../gen/mapmarks';

/** May markers be shared here? Alone always (they join the world if you later host it); online only with a server that keeps them. */
export const canSharePub = () => !online() || net.feat.includes('pmarks');
/** Every marker you see now, nearest to you first. */
export const seenMarks = () => visibleMarks(G.char.marks ?? [], G.char.pmarks ?? {}, G.char.hideMarks ?? [], G.pos.x, G.pos.z, wrapDx);
/** May you change this shared marker (yours, or its author has fallen)? */
export const mayEdit = (p: PubMark) => mayEditPub(p, G.char.pid, G.char.fallen ?? {});
