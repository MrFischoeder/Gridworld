// The same six alien engravings are used on stone corners, physical consoles and the dialing UI.
import { tl } from '../i18n';
export type GlyphPoint = readonly [number, number];
export interface GateGlyph { name: string; paths: readonly (readonly GlyphPoint[])[] }
export const GATE_GLYPHS: readonly GateGlyph[] = [
  { name: tl('Eye'), paths: [[[-1, 0], [0, .65], [1, 0], [0, -.65], [-1, 0]], [[0, -.3], [0, .3]]] },
  { name: tl('Trident'), paths: [[[-.8, .8], [-.8, 0], [.8, 0], [.8, .8]], [[0, 1], [0, -1]], [[-.4, -1], [.4, -1]]] },
  { name: tl('Spiral'), paths: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -.4], [.4, -.4], [.4, .4], [-.3, .4]]] },
  { name: tl('Bolt'), paths: [[[.6, 1], [-.4, .1], [.5, .1], [-.6, -1]]] },
  { name: tl('Twin moons'), paths: [[[-.3, 1], [-.9, .6], [-1, 0], [-.9, -.6], [-.3, -1]], [[.3, 1], [.9, .6], [1, 0], [.9, -.6], [.3, -1]]] },
  { name: tl('Star'), paths: [[[0, 1], [.25, .25], [1, 0], [.25, -.25], [0, -1], [-.25, -.25], [-1, 0], [-.25, .25], [0, 1]]] },
];
export type GateAddress = readonly [number, number, number];
export const addressText = (a: GateAddress) => a.map(i => GATE_GLYPHS[i].name).join(' · ');
