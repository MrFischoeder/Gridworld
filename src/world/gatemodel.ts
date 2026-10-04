import * as THREE from 'three';
import { GATE_GLYPHS } from '../data/gates';
import { GATE_OUTLINE, GATE_OPENING, GATE_DEPTH, GATE_CENTRE, UNMARKED_CORNERS } from '../gen/gategeometry';
import { gateRocks, type WorldGate } from '../gen/worldgates';
import { rng, hash } from '../core/rng';
import { PropBatch } from './props';

const STONE = 0x889b87, CARVING = 0xc8b77c, GLYPH = 0x80e8ff;
function glyph(pb: PropBatch, id: number, x: number, y: number, z: number, r: number) {
  for (const path of GATE_GLYPHS[id].paths) pb.line(GLYPH, ...path.map(([u, v]) => [x + u * r, y + v * r, z]));
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
/** Batched opaque stonework: only four draw calls including all engravings and scattered boulders. */
export function gateModel(g: WorldGate, rockHeight: (x: number, z: number) => number): THREE.Group {
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
      for (const z of [-GATE_DEPTH - .025, GATE_DEPTH + .025]) glyph(pb, symbol, x, y, z, .32);
      symbol++;
    }
  }
  // Thin slabs lie flush with the cleared terrain: no jumping onto the portal or console.
  pb.box(-5.4, -.3, -1.5, 5.4, 0, 1.5, STONE);
  for (let i = -4; i <= 4; i++) pb.seg(CARVING, [i, .012, -1.5], [i + .2, .012, 1.5]);
  const x = 6.3, z = 3;
  pb.solid8([[x - .75, -.1, z - .65], [x + .75, -.1, z - .65], [x + .75, -.1, z + .65], [x - .75, -.1, z + .65]],
    [[x - .48, 1.6, z - .5], [x + .48, 1.6, z - .5], [x + .48, 1.6, z + .5], [x - .48, 1.6, z + .5]], STONE);
  pb.box(x - .9, 1.25, z - .55, x + .9, 2.45, z + .6, CARVING);
  for (let i = 0; i < 6; i++) {
    const gx = x + (i % 3 - 1) * .58, gy = 2.12 - Math.floor(i / 3) * .52;
    pb.box(gx - .25, gy - .22, z + .60, gx + .25, gy + .22, z + .63, STONE);
    glyph(pb, i, gx, gy, z + .65, .17);
  }
  // Own address is carved on the pedestal below the keys, never on the two grounded ring corners.
  g.address.forEach((id, i) => glyph(pb, id, x + (i - 1) * .35, .85, z + .64, .13));
  gateRocks(g).forEach((b, i) => boulder(pb, b, rockHeight(b.x, b.z) - .15, hash(g.seed, i)));
  const group = pb.build(); group.name = `ancient-gate:${g.id}`; return group;
}

/** A deliberately translucent energy sheet; stonework behind it still has opaque fills. */
export function gateEnergy(): THREE.Mesh {
  const shape = new THREE.Shape(); GATE_OPENING.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, centre: { value: GATE_CENTRE } },
    transparent: true, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true,
    vertexShader: `varying vec2 stonePosition;
      void main() { stonePosition = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; uniform float centre; varying vec2 stonePosition;
      void main() {
        vec2 p = (stonePosition - vec2(0.0, centre)) / 3.65;
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
