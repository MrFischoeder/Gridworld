// The opening film (48 s, src/core/cinematic.ts times it): its own scene, shown before the menu. No player movement,
// spawns, saves or world ticks. Fourteen shots, each its own group with a drone path, a point it watches, the colour of
// its sky and what moves in it: the survey ship in deep space, the meteor strike and the fall, the crash site, Gridholm,
// builders at work, an ancient gate waking, the stone heads, a dead city, a firefight, a convoy under fire, a ship at
// sea, a storm over the ranges, the Chariot of the Ancients, and the planet with the title.
import * as THREE from 'three';
import { cinematicFrame, CINEMATIC_SHOTS, STRIKE } from '../core/cinematic';
import { rng } from '../core/rng';
import { meshVoxels } from '../core/meshing';
import { VoxelGrid } from '../core/voxel';
import { generateVillage } from '../gen/village';
import { generateRuin } from '../gen/ruins';
import { MEGALITH_DESIGNS, type Megalith } from '../gen/megaliths';
import { PropBatch } from '../world/props';
import { drawHouse } from '../world/houses';
import { drawTemple } from '../world/temple';
import { gateModel, gateEnergy, gateSignals } from '../world/gatemodel';
import { showcaseRobot } from '../world/robots';
import { showcaseCreature } from '../world/creatures';
import { makeFigure } from '../world/npc';
import { poseRig } from '../world/rig';
import { convoyModel } from '../world/vehicles';
import { drawLander, HULL_C, ENGINE_C, WARN_C } from '../world/lander';
import { megalithModel } from '../world/megaliths';
import { showcaseBoat } from '../world/boats';
import { showcaseShuttle } from '../world/hangar';
import { GRID, fillMat, lineMat, add } from '../world/render';
import { G } from '../game';

let frozen = false;
let running = false, time = 0, done: (() => void) | null = null;
let root: HTMLDivElement, capName: HTMLElement, capLine: HTMLElement, cap: HTMLElement, title: HTMLElement, design: HTMLElement, music: HTMLElement, veil: HTMLElement, flash: HTMLElement;
let world: THREE.Scene;
const camera = new THREE.PerspectiveCamera(62, 1, .1, 900);
const V = (p: number[]) => new THREE.Vector3(...p as [number, number, number]);
const curve = (pts: number[][]) => new THREE.CatmullRomCurve3(pts.map(V));
/** A shot: its group, the drone's path, what it looks at (fixed or moving), its sky, a roll, and what moves (global time t, the shot's progress p). */
interface Shot { g: THREE.Group; path: THREE.CatmullRomCurve3; look: THREE.Vector3 | ((t: number) => THREE.Vector3); sky: number; fog: [number, number]; roll?: number; motion?: (t: number, p: number) => void }
const shots: Shot[] = [];
const AMBER = 0xffb347, BOLT_R = 0xff5a3c, BOLT_G = 0xffd060, PLASMA = 0xff9a4a, WATER = 0x2ac8b0, STEEL = 0xa8c8b8, WOOD = 0xb8b060;

// ---------- helpers ----------
/** Lines whose ends move every frame: n segments, `set(i, a, b)`, hidden ones collapse to a point. */
function liveLines(g: THREE.Object3D, n: number, mat: THREE.LineBasicMaterial) {
  const pos = new Float32Array(n * 6), geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; g.add(lines);
  return {
    set(i: number, a: number[], b: number[]) { pos.set(a, i * 6); pos.set(b, i * 6 + 3); },
    hide(i: number) { pos.fill(0, i * 6, i * 6 + 6); },
    done() { (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; },
  };
}
/** Bolts flying from a to b over and over (each with its own phase): a short glowing dash. */
function bolts(g: THREE.Object3D, color: number, list: { a: number[]; b: number[]; every: number; phase: number }[]) {
  const L = liveLines(g, list.length, add(color));
  return (t: number) => {
    list.forEach((o, i) => {
      const k = ((t + o.phase) % o.every) / 0.45; // a bolt crosses in 0.45 s, then waits for the next
      if (k > 1) { L.hide(i); return; }
      const at = (f: number) => o.a.map((v, j) => v + (o.b[j] - v) * Math.max(0, Math.min(1, f)));
      L.set(i, at(k - 0.18), at(k));
    });
    L.done();
  };
}
/** The green lattice ground with rocks and trees; with `mountains`, ranges rise to the north. */
function terrain(pb: PropBatch, R: () => number, mountains = false, clear = 46) {
  const height = (x: number, z: number) => mountains && z > 45 ? Math.min(1, Math.max(0, (Math.abs(x - Math.sin(z / 35) * 18) - 12) / 25)) * Math.max(0, 55 * Math.exp(-((x - 10) ** 2 + (z - 105) ** 2) / 1900) + 72 * Math.exp(-((x + 65) ** 2 + (z - 135) ** 2) / 1800)) : -.12;
  for (let x = -160; x < 180; x += 10) for (let z = -110; z < 210; z += 10) {
    const a = [x, height(x, z), z], b = [x + 10, height(x + 10, z), z], c = [x + 10, height(x + 10, z + 10), z + 10], d = [x, height(x, z + 10), z + 10];
    pb.face(a, b, c, d); pb.seg(0x17452a, a, b); pb.seg(0x17452a, a, d);
  }
  for (let i = 0; i < 45; i++) {
    const x = (R() - .5) * 230, z = (R() - .5) * 170;
    if (Math.abs(x) < clear && Math.abs(z) < clear) continue;
    pb.rock(x, height(x, z), z, 1 + R() * 3, 1 + R() * 3, 6, R() * 6, GRID);
    if (i % 2) { pb.box(x - .2, 0, z - .2, x + .2, 4, z + .2, GRID); pb.cone(x, 3, z, 2, 6, GRID); }
  }
}
function ground(R: () => number, mountains = false, clear = 46) { const g = new THREE.Group(), pb = new PropBatch(); terrain(pb, R, mountains, clear); g.add(pb.build()); return g; }
/** Streaking stars round the origin, flowing towards −z (the ship flies along +z). */
function stars(g: THREE.Group, n: number, speed: number) {
  const R = rng(0x57a75), S = Array.from({ length: n }, () => [(R() - .5) * 260, (R() - .5) * 160, R() * 420]), L = liveLines(g, n, lineMat(0xc8ffe0));
  return (t: number) => { S.forEach(([x, y, z0], i) => { const z = 220 - ((z0 + t * speed) % 420); L.set(i, [x, y, z], [x, y, z + 2 + speed / 30]); }); L.done(); };
}
function landerGroup(broken: boolean, landed = false) { const pb = new PropBatch(); drawLander(pb, { broken, landed }); return pb.build(); }
/** A worker hammering (or carrying) at x, z facing the spot it works on. */
function worker(g: THREE.Group, x: number, z: number, face: number, kit: 'hammer' | 'carry' | 'pick' = 'hammer') {
  const f = makeFigure(0xdce8ff, kit); f.g.position.set(x, 0, z); f.g.rotation.y = face; g.add(f.g); return f;
}
const ICO = new THREE.IcosahedronGeometry(1, 1);

// ---------- the shots ----------
function build() {
  world = new THREE.Scene(); world.fog = new THREE.Fog(0, 110, 430);
  const R = rng(0x124c1);
  const shot = (g: THREE.Group, s: Omit<Shot, 'g'>) => { world.add(g); shots.push({ g, ...s }); };

  // 0 · the survey ship in deep space, stars streaming past, the engines burning
  {
    const g = new THREE.Group(), ship = landerGroup(false); g.add(ship);
    const plume = liveLines(g, 12, add(ENGINE_C)), streak = stars(g, 520, 140);
    shot(g, {
      path: curve([[16, 5, 30], [11, 2.5, 9], [4, 1.5, -6], [-13, 4, -18]]), look: V([0, 1, 1]), sky: 0x000306, fog: [200, 800], roll: .06,
      motion: (t) => {
        streak(t); ship.rotation.z = Math.sin(t * .8) * .05; ship.position.y = Math.sin(t * 1.3) * .15;
        for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, r = .9, len = 5 + Math.sin(t * 30 + i) * 1.5; plume.set(i, [Math.cos(a) * r, 1 + Math.sin(a) * r, -8.2], [Math.cos(a) * .2, 1 + Math.sin(a) * .2, -8.2 - len]); }
        plume.done();
      },
    });
  }
  // 1 · the strike: meteors, a flash, the wing torn away, the ship falls nose first wrapped in plasma towards the grid
  {
    const g = new THREE.Group(), whole = landerGroup(false), broken = landerGroup(true); broken.visible = false; g.add(whole, broken);
    const rocks: THREE.Group[] = [], RR = rng(0x3e7e0);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Group(); m.add(new THREE.Mesh(ICO, fillMat()), new THREE.LineSegments(new THREE.EdgesGeometry(ICO), lineMat(AMBER)));
      m.scale.setScalar(.8 + RR() * 2.2); m.userData = { y: (RR() - .5) * 30, z: (RR() - .5) * 60, v: 40 + RR() * 30, o: RR() * 4 }; rocks.push(m); g.add(m);
    }
    const wing = new THREE.Group(), wb = new PropBatch(); wb.line(HULL_C, [0, 0, 0], [5, 0, -2], [5.5, 0, -4], [0, 0, -3.2], [0, 0, 0]); wing.add(wb.build()); g.add(wing);
    const plasma = liveLines(g, 60, add(PLASMA)), streak = stars(g, 300, 60), grid = new THREE.Group(), gl: number[] = [];
    for (let x = -600; x <= 600; x += 30) gl.push(x, 0, -600, x, 0, 600, -600, 0, x, 600, 0, x);
    grid.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gl, 3)), lineMat(GRID))); g.add(grid);
    shot(g, {
      path: curve([[18, 7, 14], [14, 10, -2], [6, 12, -16]]), look: V([0, 0, 0]), sky: 0x020302, fog: [150, 700], roll: -.12,
      motion: (t) => {
        const after = t >= STRIKE, s = Math.max(0, t - STRIKE);
        whole.visible = !after; broken.visible = after; streak(t * (after ? 2.5 : 1));
        const ship = after ? broken : whole;
        ship.rotation.set(after ? Math.min(.9, s * .5) : 0, 0, after ? s * .35 + Math.sin(t * 9) * .05 : 0);
        rocks.forEach((m, i) => { const u = m.userData as { y: number; z: number; v: number; o: number }, x = 90 - ((t - 4 + u.o) * u.v) % 200; m.position.set(x, u.y + (i === 0 ? -u.y + 1 : 0), u.z * (i === 0 ? 0 : 1)); m.rotation.set(t * .7 + i, t * .5, 0); });
        wing.visible = after; wing.position.set(4 + s * 6, -s * s * 3, -1 + s * 2); wing.rotation.set(s * 3, s * 2, s * 4);
        grid.position.y = -260 + s * 60;
        for (let i = 0; i < 60; i++) {
          if (!after) { plasma.hide(i); continue; }
          const a = i / 60 * 6.283, z = 9 - (i % 10) * 1.6, r = 2.6 + (i % 3), len = 6 + Math.sin(t * 40 + i * 1.7) * 3;
          const p = new THREE.Vector3(Math.cos(a) * r, 1 + Math.sin(a) * r, z).applyEuler(ship.rotation), q = p.clone().add(new THREE.Vector3(0, len, -len * .3).applyEuler(ship.rotation));
          plasma.set(i, p.toArray(), q.toArray());
        }
        plasma.done();
      },
    });
  }
  // 2 · the crash site at dawn: the broken ship at the end of its furrow, smoke rising, the emergency lamp blinking
  {
    const g = ground(R, false, 30), ship = landerGroup(true, true); ship.rotation.y = .35; ship.position.y = -.3; g.add(ship);
    const pb = new PropBatch();
    for (let z = -70; z < -8; z += 4) for (const s of [-1, 1]) pb.rock(s * (4.5 + Math.sin(z) * .6) + z * .14, -.2, z, 1.2 + Math.abs(Math.cos(z)) * .8, 1.1, 5, z, 0x3f5a50);
    for (let i = 0; i < 14; i++) pb.rock(Math.sin(i * 2.3) * 14, 0, Math.cos(i * 1.7) * 12 - 6, .5, .4, 5, i, HULL_C);
    g.add(pb.build());
    const smoke = Array.from({ length: 7 }, () => { const r = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 16 }, (_, k) => new THREE.Vector3(Math.cos(k / 16 * 6.283), 0, Math.sin(k / 16 * 6.283)))), lineMat(0x6f8a7a)); g.add(r); return r; });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.35, .35, .35), new THREE.MeshBasicMaterial({ color: WARN_C })); lamp.position.set(-1.6, 3.4, 4); g.add(lamp);
    shot(g, {
      path: curve([[-22, 2.2, 26], [-9, 2.8, 15], [9, 4.5, 12]]), look: V([0, 1.8, 0]), sky: 0x061a0c, fog: [60, 300],
      motion: (t) => {
        smoke.forEach((r, i) => { const k = ((t * .35 + i / smoke.length) % 1); r.position.set(.6 + k * 2, 3 + k * 14, .5 + k * 3); r.scale.setScalar(.6 + k * 4); (r.material as THREE.LineBasicMaterial).opacity = 1 - k; (r.material as THREE.LineBasicMaterial).transparent = true; });
        lamp.visible = Math.floor(t * 2.5) % 2 === 0;
      },
    });
  }
  // 3 and 4 · Gridholm through its north gate, then the builders raising a house outside the wall
  const village = generateVillage(12345, 0, 0, 0, 'Gridholm', true, 2), vg = ground(R);
  {
    const mesh = meshVoxels(VoxelGrid.surface(village.shown, village.rect, 0), Infinity, { floor: 4, wall: 2 });
    vg.add(new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(mesh.tri, 3)), fillMat()),
      new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(mesh.lines, 3)), lineMat(GRID)));
    const houses = new PropBatch(); village.buildings.forEach(b => drawHouse(houses, b, 0)); village.towers.forEach(t => houses.lookout(t.x, t.z, t.x + t.w, t.z + t.d, t.h, GRID, 2.5)); vg.add(houses.build());
  }
  const north = village.gates.find(g => g.dir === 'N')!;
  shot(vg, { path: curve([[north.x, 3, north.z - 28], [north.x, 3, north.z + 2], [north.x, 5, north.z + 20]]), look: V([north.x, 3, north.z + 30]), sky: 0x000904, fog: [110, 430] });
  {
    const sx = north.x + 24, sz = north.z - 18, site = new THREE.Group(); site.position.set(sx, 0, sz); vg.add(site);
    const frame = new THREE.Group(), fb = new PropBatch(); // the house going up: posts, plates and rafters
    for (const [x, z] of [[-4, -3], [4, -3], [4, 3], [-4, 3], [0, -3], [0, 3]]) fb.box(x - .12, 0, z - .12, x + .12, 3, z + .12, WOOD);
    fb.line(WOOD, [-4, 3, -3], [4, 3, -3], [4, 3, 3], [-4, 3, 3], [-4, 3, -3]);
    for (let x = -4; x <= 4; x += 1.6) fb.line(WOOD, [x, 3, -3.4], [x, 5, 0], [x, 3, 3.4]);
    fb.box(-4.2, 0, -3.2, 4.2, .2, 3.2, 0xd8c890); frame.add(fb.build()); site.add(frame);
    const sb = new PropBatch(); // scaffold, stakes and lines, the stack of timber, a field in rows beside it
    for (const [x, z] of [[-5.5, -4.5], [5.5, -4.5], [5.5, 4.5], [-5.5, 4.5]]) { sb.box(x - .07, 0, z - .07, x + .07, 5.5, z + .07, WOOD); sb.seg(0xffd060, [x, .7, z], [x === -5.5 ? 5.5 : -5.5, .7, z]); }
    for (let y = 1.6; y < 5.5; y += 1.6) sb.line(WOOD, [-5.5, y, -4.5], [5.5, y, -4.5], [5.5, y, 4.5]);
    for (let i = 0; i < 5; i++) sb.box(-9, i * .22, 2, -6.6, i * .22 + .2, 3.2, 0xd8c890);
    for (let i = 0; i < 10; i++) sb.seg(0x7fe070, [8, .1, -6 + i * 1.3], [20, .1, -6 + i * 1.3]);
    site.add(sb.build());
    const hands = [worker(site, -5, 0, Math.PI / 2), worker(site, 5, 1, -Math.PI / 2), worker(site, 0, -4, 0), worker(site, -7.5, 2.5, 0, 'carry')];
    shot(vg, {
      path: curve([[sx - 18, 3, sz - 14], [sx - 6, 5, sz - 16], [sx + 12, 6, sz - 8], [sx + 16, 8, sz + 8]]), look: V([sx, 2, sz]), sky: 0x000904, fog: [110, 430],
      motion: (t, p) => {
        frame.scale.y = .25 + p * .75;
        hands.forEach((h, i) => {
          if (i === 3) { const k = (t * .35) % 1, u = k < .5 ? k * 2 : 2 - k * 2, sw = Math.sin(t * 7) * .5; h.g.position.set(-7.5 + u * 4, 0, 2.5 - u * 2); h.g.rotation.y = k < .5 ? 1.2 : -1.9; h.legL.rotation.x = sw; h.legR.rotation.x = -sw; poseRig(h.rig, { swing: sw, strike: -1 }); }
          else poseRig(h.rig, { swing: 0, strike: (t * .9 + i * .3) % 1 });
        });
      },
    });
  }
  // 5 · an ancient gate waking in the ruins
  {
    const g = ground(R), ruin = generateRuin(12345, { type: 'ruin', id: 45, name: 'Ancient ruins', x: 0, z: 0, rect: { x0: -22, z0: -22, x1: 22, z1: 22 }, flat: 4, blend: 8 }, 0);
    g.add(drawTemple(ruin.temple, 12345).g);
    const portal = new THREE.Group(); portal.add(gateModel({ id: 0, x: 0, y: 0, z: 0, yaw: 0, seed: 45, address: [0, 2, 4] }, () => 0), gateSignals([0, 2, 4]));
    const energy = gateEnergy(); energy.visible = false; portal.add(energy); portal.position.set(30, 0, 15); g.add(portal);
    shot(g, {
      path: curve([[-8, 9, -34], [14, 6, -16], [27, 4.5, -2]]), look: V([30, 6, 15]), sky: 0x000a08, fog: [110, 430],
      motion: (t, p) => { energy.visible = p > .3; energy.scale.setScalar(Math.min(1, (p - .3) * 4)); (energy.material as THREE.ShaderMaterial).uniforms.time.value = t; },
    });
  }
  // 6 · the stone heads at dusk
  {
    const g = ground(R, false, 120), d = MEGALITH_DESIGNS[12];
    const site: Megalith = { id: 'film', index: 12, name: d.name, x: 0, y: 0, z: 0, yaw: 0, radius: d.radius, height: d.height, seed: 0x5ea7 };
    g.add(megalithModel(site));
    shot(g, { path: curve([[-14, 5, -95], [-4, 9, -40], [6, 13, 15], [14, 18, 55]]), look: (t) => V([0, 14 + Math.sin(t) * .5, 70]), sky: 0x180b02, fog: [90, 420] });
  }
  // 7 · a dead city, its machines on patrol, bolts in the street
  {
    const g = ground(R), city = new PropBatch();
    for (let x = -54; x <= 54; x += 18) for (let z = -30; z <= 60; z += 18) {
      if (Math.abs(x) < 6) continue; // the street
      const h = 8 + R() * 30;
      city.box(x, 0, z, x + 11, h * .45, z + 2, GRID); city.box(x, 0, z, x + 2, h, z + 11, GRID);
      for (let y = 4; y < h; y += 4) { city.box(x, y, z, x + 11, y + .3, z + 11, GRID); city.box(x + 10.5, y, z + 10.5, x + 11, Math.min(h, y + 4), z + 11, GRID); }
      for (let j = 0; j < 3; j++) city.rock(x + R() * 14, 0, z + R() * 14, 1.2, 1.5, 5, R() * 6, GRID);
    }
    for (let z = -40; z < 80; z += 8) city.seg(0x3f8a50, [0, .05, z], [0, .05, z + 4]);
    g.add(city.build());
    const sentinel = showcaseRobot('sentinel'), scouts = [showcaseRobot('scout'), showcaseRobot('scout')];
    sentinel.g.position.set(0, 0, 30); g.add(sentinel.g); scouts.forEach((s, i) => { s.g.position.set(i ? 3 : -3, 0, 16); g.add(s.g); });
    const fire = bolts(g, BOLT_R, [0, 1, 2, 3].map(i => ({ a: [0, 2.6, 28], b: [(i - 1.5) * 3, 1.5, -12], every: 1.1, phase: i * .27 })));
    shot(g, {
      path: curve([[-3, 3, -30], [2, 5, -14], [8, 9, 0]]), look: V([0, 4, 28]), sky: 0x000904, fog: [80, 360],
      motion: (t) => {
        fire(t); sentinel.g.position.z = 30 - (t - 22.5) * 1.5; sentinel.legs.forEach((l, i) => l.rotation.x = Math.sin(t * 4 + i * Math.PI) * .25);
        scouts.forEach((s, j) => { s.g.position.z = 16 - (t - 22.5) * 4; s.legs.forEach((l, i) => l.rotation.x = Math.sin(t * 10 + i * Math.PI + j) * .35); });
      },
    });
  }
  // 8 · a firefight: outlaws against a guardian drone, a pack of ravagers running past, the drone blows apart
  {
    const g = ground(R, false, 30), robot = showcaseRobot('guardian'); robot.g.position.set(-8, 0, 0); robot.g.rotation.y = Math.PI / 2; g.add(robot.g);
    const outlaws = [[8, -3], [9.5, 1], [7, 4]].map(([x, z]) => { const f = makeFigure(AMBER, 'rifle'); f.g.position.set(x, 0, z); f.g.rotation.y = -Math.PI / 2; g.add(f.g); return f; });
    const pack = [0, 1, 2].map(i => { const c = showcaseCreature('ravager'); c.g.position.set(-40, c.g.position.y, 14 + i * 2.5); c.g.rotation.y = Math.PI / 2; g.add(c.g); return c; });
    const shots1 = bolts(g, BOLT_G, outlaws.map((f, i) => ({ a: [f.g.position.x - .6, 1.4, f.g.position.z], b: [-8, 1.6, 0], every: .7, phase: i * .23 })));
    const shots2 = bolts(g, BOLT_R, [0, 1].map(i => ({ a: [-7, 1.7, 0], b: [8 + i, 1.3, i * 3 - 1], every: .9, phase: i * .4 })));
    const blast = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 1)), add(PLASMA)); blast.position.set(-8, 1.5, 0); g.add(blast);
    const BOOM = 28.3;
    shot(g, {
      path: curve([[-1, 2.4, -12], [9, 3, -7.5], [11, 4.5, 6]]), look: V([0, 1.5, 0]), sky: 0x000904, fog: [90, 400], roll: .03,
      motion: (t) => {
        const gone = t > BOOM, k = t - BOOM;
        robot.g.visible = !gone; if (!gone) { shots2(t); robot.legs.forEach((l, i) => l.rotation.x = Math.sin(t * 6 + i * Math.PI) * .2); }
        shots1(gone ? -10 : t);
        blast.visible = gone && k < 1; blast.scale.setScalar(.5 + k * 9); (blast.material as THREE.LineBasicMaterial).opacity = 1 - k;
        outlaws.forEach((f, i) => poseRig(f.rig, { aim: 1, recoil: gone ? 0 : Math.max(0, Math.sin(t * 9 + i * 2)) }));
        pack.forEach((c, i) => { c.g.position.x = -40 + (t - 25.5) * 16 - i * 3; c.legs.forEach((l, j) => l.rotation.x = Math.sin(t * 14 + j * Math.PI + i) * .45); });
      },
    });
  }
  // 9 · a convoy on the road, its rear gun jeep firing back at a raider
  {
    const g = ground(R, false, 20), pb = new PropBatch();
    pb.face([-200, .02, -4], [200, .02, -4], [200, .02, 4], [-200, .02, 4]); pb.seg(0x3f8a50, [-200, .05, -4], [200, .05, -4]); pb.seg(0x3f8a50, [-200, .05, 4], [200, .05, 4]);
    for (let x = -200; x < 200; x += 8) pb.seg(0x3f8a50, [x, .05, 0], [x + 4, .05, 0]);
    g.add(pb.build());
    const cars = [0, 1, 2].map(i => { const m = convoyModel(i === 1 ? 'mastodon' : 'scout', i !== 1, 2); m.g.rotation.y = Math.PI / 2; g.add(m.g); return m; });
    const raider = convoyModel('scout', true, 2); raider.g.rotation.y = Math.PI / 2; g.add(raider.g);
    const at = (t: number, i: number) => -10 + (t - 29.5) * 10 - i * 9, rx = (t: number) => at(t, 2) - 16 + Math.sin(t * 2) * 1.5;
    const tracer = liveLines(g, 6, add(BOLT_G));
    shot(g, {
      path: curve([[-26, 3, 13], [-4, 4, 12], [20, 6, 9]]), look: (t) => V([at(t, 1), 2, 0]), sky: 0x000904, fog: [110, 430],
      motion: (t) => {
        cars.forEach((m, i) => { m.g.position.set(at(t, i), 0, 1.6); m.g.traverse(o => { if (o.name.startsWith('wheel')) o.rotation.x = t * 6; }); });
        raider.g.position.set(rx(t), 0, -1.6 + Math.sin(t * 1.3)); raider.g.traverse(o => { if (o.name.startsWith('wheel')) o.rotation.x = t * 6; });
        if (cars[2].turret) cars[2].turret.rotation.y = Math.PI; // the rear gun faces back
        for (let i = 0; i < 6; i++) {
          const k = ((t * 3 + i / 6) % 1), a = [at(t, 2) - 1, 2.4, 1.6], b = [rx(t) + 1, 1.4, -1.6];
          if (k > .6) { tracer.hide(i); continue; }
          const p = (f: number) => a.map((v, j) => v + (b[j] - v) * f); tracer.set(i, p(k / .6 - .15 < 0 ? 0 : k / .6 - .15), p(k / .6));
        }
        tracer.done();
      },
    });
  }
  // 10 · open seas: a sailing ship and a motor skiff on a rolling swell
  {
    const g = new THREE.Group(), N = 34, S = 6, waves = liveLines(g, N * N * 2, lineMat(WATER)), sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), fillMat(0x011614)); sea.rotation.x = -Math.PI / 2; sea.position.y = -.4; g.add(sea);
    const ship = showcaseBoat('ship'), skiff = showcaseBoat('motor'); g.add(ship, skiff);
    const isle = new PropBatch(); isle.rock(40, -2, 70, 22, 9, 9, 1, GRID); isle.rock(55, -2, 60, 10, 6, 7, 2, GRID); g.add(isle.build());
    const h = (x: number, z: number, t: number) => Math.sin(x * .12 + t * 1.4) * .35 + Math.sin(z * .09 - t) * .3;
    shot(g, {
      path: curve([[-36, 9, -26], [-26, 6, -4], [-14, 7, 20], [6, 10, 34]]), look: (t) => V([0, 3, (t - 32.5) * 2.5]), sky: 0x00090c, fog: [80, 380], roll: -.04,
      motion: (t) => {
        let i = 0; const o = -N * S / 2, cz = (t - 32.5) * 2.5;
        for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
          const x = o + a * S, z = o + b * S + cz;
          waves.set(i++, [x, h(x, z, t), z], [x + S, h(x + S, z, t), z]); waves.set(i++, [x, h(x, z, t), z], [x, h(x, z + S, t), z + S]);
        }
        waves.done();
        ship.position.set(0, h(0, cz, t), cz); ship.rotation.set(Math.sin(t * 1.1) * .05, 0, Math.sin(t * .9) * .06);
        const a = t * .6; skiff.position.set(Math.cos(a) * 18, h(0, 0, t) * .8, cz + Math.sin(a) * 14); skiff.rotation.y = -a;
      },
    });
  }
  // 11 · a storm over the ranges and the river: rain, forked lightning, the sky lit white
  {
    const g = ground(R, true), pb = new PropBatch();
    for (let z = -100; z < 160; z += 6) {
      const x = Math.sin(z / 35) * 18, nx = Math.sin((z + 6) / 35) * 18;
      pb.face([x - 8, .02, z], [x + 8, .02, z], [nx + 8, .02, z + 6], [nx - 8, .02, z + 6]);
      for (let k = -8; k <= 8; k += 4) pb.seg(WATER, [x + k, .04, z], [nx + k, .04, z + 6]);
    }
    g.add(pb.build());
    const rain = liveLines(g, 900, lineMat(0x9ab8a8)), RR = rng(0x7a17), drops = Array.from({ length: 900 }, () => [(RR() - .5) * 160, RR() * 70, (RR() - .5) * 160 + 40]);
    const bolt = liveLines(g, 40, add(0xe8fff0)), forks: number[][][] = [];
    for (let f = 0; f < 3; f++) { const pts: number[][] = []; let x = -40 + f * 45, y = 90, z = 90 + f * 20; while (y > 0) { const nx = x + (RR() - .5) * 14, ny = y - 6 - RR() * 6; pts.push([x, y, z, nx, Math.max(0, ny), z + (RR() - .5) * 6]); x = nx; y = ny; } forks.push(pts); }
    shot(g, {
      path: curve([[-55, 22, -70], [0, 28, -62], [50, 34, -50]]), look: V([0, 22, 110]), sky: 0x010603, fog: [70, 330],
      motion: (t) => {
        drops.forEach(([x, y0, z], i) => { const y = 70 - ((70 - y0 + t * 60) % 70); rain.set(i, [x, y, z], [x + 1, y + 3, z]); }); rain.done();
        const s = t - 35.5, strike = [.7, 1.9, 2.5].findIndex(x => s > x && s < x + .18);
        let n = 0; if (strike >= 0) for (const [x, y, z, x2, y2, z2] of forks[strike]) if (n < 40) bolt.set(n++, [x, y, z], [x2, y2, z2]);
        for (; n < 40; n++) bolt.hide(n); bolt.done();
        (world.background as THREE.Color).setHex(strike >= 0 ? 0x1a3a26 : 0x010603);
      },
    });
  }
  // 12 · the Chariot of the Ancients in its hangar, made whole, engines lit
  {
    const g = new THREE.Group(), shuttle = showcaseShuttle(); g.add(shuttle);
    const pb = new PropBatch();
    for (let z = -8; z <= 34; z += 6) { const arch: number[][] = []; for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI; arch.push([Math.cos(a) * 15, Math.sin(a) * 14, z]); } pb.line(STEEL, ...arch); }
    for (let x = -16; x <= 16; x += 4) pb.seg(0x17452a, [x, 0, -10], [x, 0, 36]);
    for (let z = -10; z <= 36; z += 4) pb.seg(0x17452a, [-16, 0, z], [16, 0, z]);
    g.add(pb.build());
    const glow = liveLines(g, 24, add(ENGINE_C));
    shot(g, {
      path: curve([[9, 2.5, 40], [13, 5, 22], [11, 8, 2], [4, 10, -12]]), look: V([0, 5, 12]), sky: 0x000302, fog: [60, 260],
      motion: (t) => {
        for (let i = 0; i < 24; i++) { const e = (i % 3) - 1, a = i / 8 * 6.283, len = 2.5 + Math.sin(t * 25 + i) * 1; glow.set(i, [e * 1.3 + Math.cos(a) * .5, 5.2 + Math.sin(a) * .5, -.2], [e * 1.3, 5.2, -.2 - len]); }
        glow.done();
      },
    });
  }
  // 13 · the planet, turning, as the title comes up
  {
    const g = new THREE.Group(), planet = new THREE.Group(), Rr = 100;
    planet.add(new THREE.Mesh(new THREE.SphereGeometry(Rr * .995, 32, 20), fillMat()));
    const glob: number[] = [];
    for (let la = -75; la <= 75; la += 15) { const y = Math.sin(la * Math.PI / 180) * Rr, r = Math.cos(la * Math.PI / 180) * Rr; for (let k = 0; k < 48; k++) { const a0 = k / 48 * 6.283, a1 = (k + 1) / 48 * 6.283; glob.push(Math.cos(a0) * r, y, Math.sin(a0) * r, Math.cos(a1) * r, y, Math.sin(a1) * r); } }
    for (let lo = 0; lo < 180; lo += 15) { const c = Math.cos(lo * Math.PI / 180), s = Math.sin(lo * Math.PI / 180); for (let k = 0; k < 48; k++) { const a0 = k / 48 * 6.283, a1 = (k + 1) / 48 * 6.283; glob.push(Math.cos(a0) * Rr * c, Math.sin(a0) * Rr, Math.cos(a0) * Rr * s, Math.cos(a1) * Rr * c, Math.sin(a1) * Rr, Math.cos(a1) * Rr * s); } }
    planet.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(glob, 3)), lineMat(GRID)));
    planet.rotation.z = .35; g.add(planet);
    const halo = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, k) => new THREE.Vector3(Math.cos(k / 96 * 6.283) * Rr * 1.06, Math.sin(k / 96 * 6.283) * Rr * 1.06, 0))), add(0x9dffe0)); g.add(halo);
    const RR = rng(0x5ea2), sp: number[] = []; for (let i = 0; i < 600; i++) { const v = new THREE.Vector3(RR() - .5, RR() - .5, RR() - .5).normalize().multiplyScalar(500 + RR() * 200); sp.push(v.x, v.y, v.z); }
    g.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: 0xc8ffe0, size: 1.6, sizeAttenuation: false })));
    shot(g, {
      path: curve([[40, 30, 150], [20, 40, 230], [0, 55, 300]]), look: V([0, 30, 0]), sky: 0x000000, fog: [600, 900],
      motion: (t) => { planet.rotation.y = t * .12; halo.lookAt(camera.position); },
    });
  }
  world.background = new THREE.Color(0);
}

function finish() {
  if (!running) return;
  running = false; G.intro = false; G.keys = {}; root.remove(); document.body.classList.remove('cinematic');
  const callback = done; done = null; callback?.();
}
export const cinematicOn = () => running;
export function playCinematic(end: () => void) {
  if (running) return;
  if (!world) build();
  root = document.createElement('div'); root.id = 'cinematic';
  root.innerHTML = '<div class="letterbox top"></div><div class="letterbox bottom"></div><div class="cap"><b></b><span></span></div><div class="credits"><h1>GRIDWORLD</h1><p class="design">Designed by Luki</p><p class="music">Music by Iskra</p></div><div class="flash"></div><div class="veil"></div><button type="button" class="skip">Skip · Space / Esc</button>';
  document.body.append(root);
  cap = root.querySelector('.cap')!; capName = cap.querySelector('b')!; capLine = cap.querySelector('span')!;
  title = root.querySelector('h1')!; design = root.querySelector('.design')!; music = root.querySelector('.music')!; veil = root.querySelector('.veil')!; flash = root.querySelector('.flash')!;
  root.querySelector<HTMLButtonElement>('button')!.onclick = finish;
  time = 0; frozen = false; done = end; running = true; G.playing = false; G.intro = true; G.firing = false; G.keys = {}; document.body.classList.add('cinematic');
  if (document.pointerLockElement) document.exitPointerLock();
  update(0);
}
function update(t: number) {
  const frame = cinematicFrame(t), s = shots[frame.shot];
  shots.forEach((x) => { x.g.visible = false; }); s.g.visible = true;
  (world.background as THREE.Color).setHex(s.sky); world.fog!.color.setHex(s.sky); (world.fog as THREE.Fog).near = s.fog[0]; (world.fog as THREE.Fog).far = s.fog[1];
  camera.position.copy(s.path.getPoint(frame.progress)); camera.lookAt(typeof s.look === 'function' ? s.look(t) : s.look);
  camera.rotateZ(Math.sin(frame.progress * Math.PI) * (s.roll ?? .015));
  s.motion?.(t, frame.progress);
  const c = CINEMATIC_SHOTS[frame.shot];
  if (capName.textContent !== c.name) { capName.textContent = c.name; capLine.textContent = c.line; }
  cap.style.opacity = String(frame.caption); cap.style.transform = `translateX(${(1 - frame.caption) * -18}px)`;
  title.style.opacity = String(frame.title); title.style.letterSpacing = `${.18 + (1 - frame.title) * .2}em`;
  design.style.opacity = String(frame.design); music.style.opacity = String(frame.music); veil.style.opacity = String(frame.veil); flash.style.opacity = String(frame.flash);
  root.dataset.shot = String(frame.shot); root.dataset.time = t.toFixed(2);
}
export function renderCinematic(renderer: THREE.WebGLRenderer, dt: number) {
  // Keep the intended real duration even on slower machines; hidden tabs pause the film.
  if (!document.hidden && !frozen) time += dt;
  if (cinematicFrame(time).finished) { finish(); return; }
  update(time); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.info.reset(); renderer.render(world, camera);
}
addEventListener('keydown', e => {
  if (!running) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') finish();
}, true);
if (import.meta.env.DEV) Object.assign(window, { __cinematicJump: (seconds: number, hold = false) => { if (running) { frozen = hold; time = seconds; update(time); } } });
