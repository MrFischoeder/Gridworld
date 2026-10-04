// The same six alien engravings are used on stone corners, physical consoles and the dialing UI.
export type GlyphPoint = readonly [number, number];
export interface GateGlyph { name: string; paths: readonly (readonly GlyphPoint[])[] }
export const GATE_GLYPHS: readonly GateGlyph[] = [
  { name: 'Eye', paths: [[[-1, 0], [0, .65], [1, 0], [0, -.65], [-1, 0]], [[0, -.3], [0, .3]]] },
  { name: 'Trident', paths: [[[-.8, .8], [-.8, 0], [.8, 0], [.8, .8]], [[0, 1], [0, -1]], [[-.4, -1], [.4, -1]]] },
  { name: 'Spiral', paths: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -.4], [.4, -.4], [.4, .4], [-.3, .4]]] },
  { name: 'Bolt', paths: [[[.6, 1], [-.4, .1], [.5, .1], [-.6, -1]]] },
  { name: 'Twin moons', paths: [[[-.3, 1], [-.9, .6], [-1, 0], [-.9, -.6], [-.3, -1]], [[.3, 1], [.9, .6], [1, 0], [.9, -.6], [.3, -1]]] },
  { name: 'Star', paths: [[[0, 1], [.25, .25], [1, 0], [.25, -.25], [0, -1], [-.25, -.25], [-1, 0], [-.25, .25], [0, 1]]] },
];
export type GateAddress = readonly [number, number, number];
export const addressText = (a: GateAddress) => a.map(i => GATE_GLYPHS[i].name).join(' · ');
