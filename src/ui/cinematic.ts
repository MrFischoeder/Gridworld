// Twenty-second drone showcase in its own scene. No player movement, spawns, saves or world ticks.
import * as THREE from 'three';
import { cinematicFrame, CINEMATIC_SHOTS } from '../core/cinematic';
import { rng } from '../core/rng';
import { meshVoxels } from '../core/meshing';
import { VoxelGrid } from '../core/voxel';
import { generateVillage } from '../gen/village';
import { generateRuin } from '../gen/ruins';
import { PropBatch } from '../world/props';
import { drawHouse } from '../world/houses';
import { drawTemple } from '../world/temple';
import { gateModel, gateEnergy, gateSignals } from '../world/gatemodel';
import { showcaseRobot } from '../world/robots';
import { showcaseCreature } from '../world/creatures';
import { makeFigure } from '../world/npc';
import { poseRig } from '../world/rig';
import { convoyModel } from '../world/vehicles';
import { GRID, fillMat, lineMat } from '../world/render';
import { G } from '../game';

let frozen = false;
let running = false, time = 0, done: (() => void) | null = null;
let root: HTMLDivElement, label: HTMLElement, title: HTMLElement, design: HTMLElement, music: HTMLElement, veil: HTMLElement;
let world: THREE.Scene;
const camera = new THREE.PerspectiveCamera(62, 1, .1, 650);
const groups: THREE.Group[] = [], motions: ((t: number) => void)[] = [];
const V = (p: number[]) => new THREE.Vector3(...p as [number, number, number]);
// Each shot has a smooth drone trajectory and an independently tracked point of interest.
const paths = [
  [[0, 3, -62], [0, 3, -38], [0, 5, -18]],
  [[0, 18, -28], [48, 34, 0], [0, 45, 52], [-48, 34, 0], [0, 30, -48]],
  [[-65, 34, -60], [-5, 40, -48], [60, 32, -20]],
  [[-45, 27, -50], [0, 34, -8], [45, 26, 38]],
  [[-65, 55, -45], [-35, 70, 5], [45, 85, 35]],
  [[-15, 5, -14], [0, 6, -10], [16, 7, -8]],
  [[-20, 8, -18], [8, 12, -12], [28, 20, 8]],
].map(points => new THREE.CatmullRomCurve3(points.map(V)));
const targets = [[0, 3, 0], [0, 3, 0], [10, 5, 6], [0, 8, 8], [0, 15, 75], [0, 2, 3], [0, 2, 5]].map(V);
function terrain(pb: PropBatch, R: () => number, mountains = false) {
  const height = (x: number, z: number) => mountains && z > 45 ? Math.min(1, Math.max(0, (Math.abs(x - Math.sin(z / 35) * 18) - 12) / 25)) * Math.max(0, 55 * Math.exp(-((x - 10) ** 2 + (z - 105) ** 2) / 1900) + 72 * Math.exp(-((x + 65) ** 2 + (z - 135) ** 2) / 1800)) : -.12;
  for (let x = -160; x < 180; x += 10) for (let z = -110; z < 210; z += 10) {
    const a = [x, height(x, z), z], b = [x + 10, height(x + 10, z), z], c = [x + 10, height(x + 10, z + 10), z + 10], d = [x, height(x, z + 10), z + 10];
    pb.face(a, b, c, d); pb.seg(0x17452a, a, b); pb.seg(0x17452a, a, d);
  }
  for (let i = 0; i < 45; i++) {
    const x = (R() - .5) * 230, z = (R() - .5) * 170;
    if (Math.abs(x) < 46 && Math.abs(z) < 48) continue;
    pb.rock(x, height(x, z), z, 1 + R() * 3, 1 + R() * 3, 6, R() * 6, GRID);
    if (i % 2) { pb.box(x - .2, 0, z - .2, x + .2, 4, z + .2, GRID); pb.cone(x, 3, z, 2, 6, GRID); }
  }
}
function build() {
  world = new THREE.Scene(); world.background = new THREE.Color(0x000904); world.fog = new THREE.Fog(0x000904, 110, 430);
  const R = rng(0x124c1);
  for (let i = 0; i < 6; i++) { const g = new THREE.Group(), pb = new PropBatch(); terrain(pb, R, i === 3); g.add(pb.build()); world.add(g); groups.push(g); }
  const village = generateVillage(12345, 0, 0, 0, 'Gridholm', true, 2);
  const mesh = meshVoxels(VoxelGrid.surface(village.shown, village.rect, 0), Infinity, { floor: 4, wall: 2 });
  groups[0].add(new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(mesh.tri, 3)), fillMat()),
    new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(mesh.lines, 3)), lineMat(GRID)));
  const houses = new PropBatch(); village.buildings.forEach(b => drawHouse(houses, b, 0)); village.towers.forEach(t => houses.lookout(t.x, t.z, t.x + t.w, t.z + t.d, t.h, GRID, 2.5)); groups[0].add(houses.build());
  // The first trajectory is aligned to the actual north gate, including its off-centre slot.
  const north = village.gates.find(g => g.dir === 'N')!;
  paths[0] = new THREE.CatmullRomCurve3([[north.x, 3, north.z - 28], [north.x, 3, north.z + 2], [north.x, 5, north.z + 20]].map(V));
  targets[0].set(north.x, 3, north.z + 30);
  const ruin = generateRuin(12345, { type: 'ruin', id: 45, name: 'Ancient ruins', x: 0, z: 0, rect: { x0: -22, z0: -22, x1: 22, z1: 22 }, flat: 4, blend: 8 }, 0);
  groups[1].add(drawTemple(ruin.temple, 12345).g);
  const portal = new THREE.Group(); portal.add(gateModel({ id: 0, x: 0, y: 0, z: 0, yaw: 0, seed: 45, address: [0, 2, 4] }, () => 0), gateSignals([0, 2, 4]));
  const energy = gateEnergy(); energy.visible = true; portal.add(energy); portal.position.set(30, 0, 15); groups[1].add(portal);
  motions.push(t => { (energy.material as THREE.ShaderMaterial).uniforms.time.value = t; });
  const city = new PropBatch();
  for (let x = -36; x <= 36; x += 18) for (let z = -30; z <= 42; z += 18) {
    const h = 8 + R() * 24;
    // Broken floors, exposed uprights and missing wall sections leave recognisable ruined blocks.
    city.box(x, 0, z, x + 11, h * .45, z + 2, GRID);
    city.box(x, 0, z, x + 2, h, z + 11, GRID);
    for (let y = 4; y < h; y += 4) { city.box(x, y, z, x + 11, y + .3, z + 11, GRID); city.box(x + 10.5, y, z + 10.5, x + 11, Math.min(h, y + 4), z + 11, GRID); }
    for (let j = 0; j < 3; j++) city.rock(x + R() * 14, 0, z + R() * 14, 1.2, 1.5, 5, R() * 6, GRID);
  }
  groups[2].add(city.build());
  const river = new PropBatch();
  for (let z = -100; z < 160; z += 6) {
    const x = Math.sin(z / 35) * 18, nx = Math.sin((z + 6) / 35) * 18;
    river.face([x - 8, .02, z], [x + 8, .02, z], [nx + 8, .02, z + 6], [nx - 8, .02, z + 6]);
    for (let k = -8; k <= 8; k += 4) river.seg(0x2ac8b0, [x + k, .04, z], [nx + k, .04, z + 6]);
  }
  groups[3].add(river.build());
  const robot = showcaseRobot('guardian'); robot.g.position.x = -6; robot.g.position.z = 4; groups[4].add(robot.g);
  const creature = showcaseCreature('ravager'); creature.g.position.x = 7; creature.g.position.z = 5; groups[4].add(creature.g);
  const bandits = [-1.5, 1.5].map(x => { const f = makeFigure(0xffb347, 'rifle'); f.g.position.set(x, 0, 2); groups[4].add(f.g); return f; });
  motions.push(t => {
    robot.g.position.z = 4 + Math.sin(t) * 1.5; robot.legs.forEach((l, i) => l.rotation.x = Math.sin(t * 5 + i * Math.PI) * .2);
    creature.g.position.z = 5 + Math.sin(t * .7); creature.legs.forEach((l, i) => l.rotation.x = Math.sin(t * 6 + i * Math.PI) * .25);
    bandits.forEach((f, i) => { const swing = Math.sin(t * 5 + i) * .35; f.legL.rotation.x = swing; f.legR.rotation.x = -swing; poseRig(f.rig, { swing, aim: .7 }); });
  });
  for (let i = 0; i < 3; i++) {
    const car = convoyModel(i === 1 ? 'mastodon' : 'scout', i !== 1, 2).g; groups[5].add(car);
    motions.push(t => { car.position.set((t - 18.5) * 2 + 14 - i * 9, 0, 5); car.rotation.y = Math.PI / 2; car.traverse(o => { if (o.name.startsWith('wheel')) o.rotation.x = t * 3; }); });
  }
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
  root = document.createElement('div'); root.id = 'cinematic'; root.innerHTML = '<div class="letterbox top"></div><div class="letterbox bottom"></div><div class="shot"></div><div class="credits"><h1>GRIDWORLD</h1><p class="design">Designed by Luki</p><p class="music">Music by Iskra</p></div><div class="veil"></div><button type="button" class="skip">Skip · Space / Esc</button>';
  document.body.append(root); label = root.querySelector('.shot')!; title = root.querySelector('h1')!; design = root.querySelector('.design')!; music = root.querySelector('.music')!; veil = root.querySelector('.veil')!;
  root.querySelector<HTMLButtonElement>('button')!.onclick = finish;
  time = 0; frozen = false; done = end; running = true; G.playing = false; G.intro = true; G.firing = false; G.keys = {}; document.body.classList.add('cinematic');
  if (document.pointerLockElement) document.exitPointerLock();
  update(0);
}
function update(t: number) {
  const frame = cinematicFrame(t), map = [0, 0, 1, 2, 3, 4, 5];
  groups.forEach((g, i) => g.visible = i === map[frame.shot]);
  camera.position.copy(paths[frame.shot].getPoint(frame.progress)); camera.lookAt(targets[frame.shot]);
  camera.rotateZ(Math.sin(frame.progress * Math.PI) * (frame.shot === 1 ? -.07 : .015));
  motions.forEach(f => f(t));
  label.textContent = CINEMATIC_SHOTS[frame.shot].name;
  title.style.opacity = String(frame.title); title.style.letterSpacing = `${.18 + (1 - frame.title) * .2}em`;
  design.style.opacity = String(frame.design); music.style.opacity = String(frame.music); veil.style.opacity = String(frame.veil);
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
