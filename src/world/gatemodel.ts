import * as THREE from 'three';
import { GATE_GLYPHS, type GateAddress } from '../data/gates';
import { GATE_OUTLINE, GATE_OPENING, GATE_DEPTH, GATE_CENTRE, GATE_INNER, UNMARKED_CORNERS } from '../gen/gategeometry';
import { gateRocks, GATE_PANEL, GATE_TABLET, type WorldGate } from '../gen/worldgates';
import { rng, hash } from '../core/rng';
import { PropBatch } from './props';

const STONE = 0x889b87, CARVING = 0xc8b77c, GLYPH = 0x80e8ff;
function glyph(pb: PropBatch, id: number, x: number, y: number, z: number, r: number, colour = GLYPH) {
  for (const path of GATE_GLYPHS[id].paths) pb.line(colour, ...path.map(([u, v]) => [x + u * r, y + v * r, z]));
}
/** Weathered boulders have uneven shoulders and a broken flat crown, rather than a pyramid peak. */
function boulder(pb: PropBatch, b: ReturnType<typeof gateRocks>[number], y: number, seed: number) {
  const R = rng(seed), rings = [0, .48, .88].map((height, level) => Array.from({ length: b.sides }, (_, i) => {
    const a = b.rot + i * Math.PI * 2 / b.sides + level * .08, radius = b.r * (level === 2 ? .4 + R() * .2 : .7 + R() * .3);
    return [b.x + Math.cos(a) * radius, y + b.h * (height + (level ? R() * .12 : 0)), b.z + Math.sin(a) * radius];
  }));
  for (let k = 0; k < 2; k++) for (let i = 0; i < b.sides; i++) {
    const j = (i + 1) % b.sides, a = rings[k][i], c = rings[k][j], d = rings[k + 1][j], e = rings[k + 1][i];
    pb.face(a, c, d, e); pb.line(STONE, a, c, d); pb.seg(STONE, a, e);
  }
  pb.face(...rings[2]); for (let i = 0; i < b.sides; i++) pb.seg(STONE, rings[2][i], rings[2][(i + 1) % b.sides]);
}
/** Opaque stonework, permanent engravings and scattered boulders are batched by material. */
export function gateModel(g: WorldGate, rockHeight: (x: number, z: number) => number, tablet: readonly GateAddress[] = []): THREE.Group {
  const pb = new PropBatch(), R = rng(g.seed);
  for (let i = 0, symbol = 0; i < 8; i++) {
    const j = (i + 1) % 8, [ox, oy] = GATE_OUTLINE[i], [nx, ny] = GATE_OPENING[i];
    const front = [GATE_OUTLINE[i], GATE_OUTLINE[j], GATE_OPENING[j], GATE_OPENING[i]].map(([x, y]) => [x, y, GATE_DEPTH]);
    const back = front.map(([x, y]) => [x, y, -GATE_DEPTH]);
    pb.solid8(back, front, STONE);
    // Inner bevel and uneven, weathered fracture lines across the ancient stone blocks.
    for (const z of [-GATE_DEPTH - .01, GATE_DEPTH + .01]) {
      pb.seg(CARVING, [ox * .96, oy * .96 + .17, z], [GATE_OUTLINE[j][0] * .96, GATE_OUTLINE[j][1] * .96 + .17, z]);
      const t = .3 + R() * .4;
      const p = (poly: [number, number][]) => [poly[i][0] + (poly[j][0] - poly[i][0]) * t, poly[i][1] + (poly[j][1] - poly[i][1]) * t, z];
      pb.seg(STONE, p(GATE_OUTLINE), p(GATE_OPENING));
    }
    if (!(UNMARKED_CORNERS as readonly number[]).includes(i)) {
      const x = (ox + nx) / 2, y = (oy + ny) / 2;
      for (const z of [-GATE_DEPTH - .025, GATE_DEPTH + .025]) glyph(pb, symbol, x, y, z, .45, 0x315b65);
      symbol++;
    }
  }
  // Three large slots below the upper lintel show the ordered dial / incoming address.
  for (const z of [-GATE_DEPTH - .12, GATE_DEPTH + .12]) {
    pb.box(-2.2, GATE_CENTRE + GATE_INNER - .45, z - .04, 2.2, GATE_CENTRE + GATE_INNER + .6, z + .04, CARVING);
  }
  // Thin slabs lie flush with the cleared terrain: no jumping onto the portal or console.
  pb.box(-12, -.3, -2, 12, 0, 2, STONE);
  for (let i = -11; i <= 11; i++) pb.seg(CARVING, [i, .012, -2], [i + .2, .012, 2]);
  const [x, z] = GATE_PANEL;
  pb.solid8([[x - .75, -.1, z - .65], [x + .75, -.1, z - .65], [x + .75, -.1, z + .65], [x - .75, -.1, z + .65]],
    [[x - .48, 1.6, z - .5], [x + .48, 1.6, z - .5], [x + .48, 1.6, z + .5], [x - .48, 1.6, z + .5]], STONE);
  pb.box(x - .9, 1.25, z - .55, x + .9, 2.45, z + .6, CARVING);
  for (let i = 0; i < 6; i++) {
    const gx = x + (i % 3 - 1) * .58, gy = 2.12 - Math.floor(i / 3) * .52;
    pb.box(gx - .25, gy - .22, z + .60, gx + .25, gy + .22, z + .63, STONE);
    glyph(pb, i, gx, gy, z + .65, .17);
  }
  // Own address is carved on the pedestal below the keys, never on the two grounded ring corners.
  pb.box(x - .95, .4, z + .57, x + .95, 1.12, z + .68, CARVING);
  g.address.forEach((id, i) => glyph(pb, id, x + (i - 1) * .57, .76, z + .70, .22));
  const [tx, tz] = GATE_TABLET;
  pb.solid8([[tx - 1.8, -.1, tz - .75], [tx + 1.8, -.1, tz - .75], [tx + 1.8, -.1, tz + .75], [tx - 1.8, -.1, tz + .75]],
    [[tx - 1.5, 2.9, tz - .35], [tx + 1.5, 2.9, tz - .35], [tx + 1.5, 2.9, tz + .62], [tx - 1.5, 2.9, tz + .62]], STONE);
  tablet.forEach((a, row) => {
    const y = 2.3 - row * .8;
    pb.line(CARVING, [tx - 1.3, y - .36, tz + .78], [tx + 1.3, y - .36, tz + .78]);
    a.forEach((id, i) => glyph(pb, id, tx + (i - 1) * .85, y, tz + .8, .3));
  });
  gateRocks(g).forEach((b, i) => boulder(pb, b, rockHeight(b.x, b.z) - .15, hash(g.seed, i)));
  const group = pb.build(); group.name = `ancient-gate:${g.id}`; return group;
}

/** Highlight entered symbols in sequence; repetitions still occupy distinct address slots. */
export function gateSignals(symbols: readonly number[]): THREE.Group {
  const pb = new PropBatch();
  const marked = GATE_OUTLINE.map((p, i) => ({ p, inner: GATE_OPENING[i], i })).filter(v => !(UNMARKED_CORNERS as readonly number[]).includes(v.i));
  for (const id of new Set(symbols)) {
    const { p: [ox, oy], inner: [nx, ny] } = marked[id], colour = id === symbols.at(-1) ? 0xe8ffff : 0x80e8ff;
    for (const z of [-GATE_DEPTH - .03, GATE_DEPTH + .03]) glyph(pb, id, (ox + nx) / 2, (oy + ny) / 2, z, .45, colour);
  }
  symbols.forEach((id, i) => {
    for (const z of [-GATE_DEPTH - .18, GATE_DEPTH + .18]) glyph(pb, id, (i - 1) * 1.4, GATE_CENTRE + GATE_INNER + .07, z, .4, i === symbols.length - 1 ? 0xe8ffff : GLYPH);
  });
  const group = pb.build(); group.name = 'gate-dial-signals'; group.userData.symbols = [...symbols]; return group;
}

/** A deliberately translucent energy sheet; stonework behind it still has opaque fills. */
export function gateEnergy(): THREE.Mesh {
  const shape = new THREE.Shape(); GATE_OPENING.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, centre: { value: GATE_CENTRE }, radius: { value: GATE_INNER } },
    transparent: true, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true,
    vertexShader: `varying vec2 stonePosition;
      void main() { stonePosition = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; uniform float centre; uniform float radius; varying vec2 stonePosition;
      void main() {
        vec2 p = (stonePosition - vec2(0.0, centre)) / radius;
        float r = length(p), a = atan(p.y, p.x);
        float ripple = sin(r * 32.0 - time * 4.0 + sin(a * 6.0 + time) * 1.5);
        float veins = pow(max(0.0, ripple), 8.0);
        float shimmer = 0.035 * sin(p.x * 47.0 + time * 2.0) * sin(p.y * 39.0 - time * 3.0);
        vec3 colour = vec3(0.025, 0.16, 0.21) + vec3(0.04, 0.36, 0.42) * veins + shimmer;
        gl_FragColor = vec4(colour, 0.74 + 0.06 * ripple);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.name = 'gate-energy'; mesh.visible = false; return mesh;
}
