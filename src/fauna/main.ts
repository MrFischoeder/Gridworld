// A standalone visual workshop. Importing a model never starts the game or connects to multiplayer.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FAUNA, FAUNA_IDS, createFaunaModel, type FaunaId, type FaunaModel } from '../models/fauna';
import { lang, tl, TL } from '../i18n';
import { VERSION } from '../version';
import './style.css';

THREE.ColorManagement.enabled = false;
document.documentElement.lang = lang;
document.title = `Gridworld · ${tl('Fauna gallery')}`;
const app = document.getElementById('app')!;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '') {
  const e = document.createElement(tag); e.textContent = text; return e;
}
const header = element('header'), title = element('h1', `GRIDWORLD / ${tl('Fauna gallery')}`);
header.append(title, element('small', `v${VERSION}`));
const back = element('a', tl('Back to game')); back.href = './index.html'; header.append(back);
const controls = element('nav'), select = element('select'); select.id = 'species'; select.setAttribute('aria-label', tl('Creature model'));
for (const id of FAUNA_IDS) { const option = element('option', tl(FAUNA[id].name)); option.value = id; select.append(option); }
const compare = element('input'); compare.type = 'checkbox'; compare.id = 'compare';
const compareLabel = element('label'); compareLabel.append(compare, document.createTextNode(tl('Compare all at true scale')));
const reset = element('button', tl('Reset view')); reset.id = 'reset';
const download = element('button', tl('Download model (.json)')); download.id = 'download';
controls.append(select, compareLabel, reset, download);
const main = element('main'), viewport = element('div'); viewport.id = 'viewport';
const canvas = element('canvas'); canvas.setAttribute('aria-label', tl('Rotatable three-dimensional creature preview')); viewport.append(canvas);
const aside = element('aside'), name = element('h2'), dimensions = element('p'), description = element('p'), status = element('p');
name.id = 'model-name'; dimensions.id = 'dimensions'; description.id = 'description'; status.className = 'status';
const humanText = element('p', tl('Green figure: a 1.8 m human. Grid squares: 1 m.'));
const help = element('p', tl('Drag to orbit, scroll to zoom, right-drag to pan. On touch screens use one or two fingers.'));
const partsTitle = element('h3', tl('Model parts')), parts = element('ul'); parts.id = 'parts';
aside.append(name, dimensions, description, status, humanText, help, partsTitle, parts);
main.append(viewport, aside); app.append(header, controls, main);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x000000);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // same colours as world/render.ts
const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .02, 1000);
let aspect = 1;
const orbit = new OrbitControls(camera, canvas); orbit.enableDamping = true;
orbit.minZoom = .2; orbit.maxZoom = 30; orbit.maxPolarAngle = Math.PI * .495;
const display = new THREE.Group(); scene.add(display);
let grid: THREE.GridHelper | null = null;
let models: FaunaModel[] = [];
const humans = new THREE.Group(); scene.add(humans);
const humanMaterial = new THREE.LineBasicMaterial({ color: 0x55c47c });
const humanGeometry = new THREE.BufferGeometry();
// Fixed 1.8 m outline, including the crown of the head. No shared game NPC resources.
const segments: number[] = [];
const poly = (...p: number[][]) => { for (let i = 1; i < p.length; i++) segments.push(...p[i - 1], ...p[i]); };
poly([-.12, 1.55, 0], [-.13, 1.72, 0], [0, 1.8, 0], [.13, 1.72, 0], [.12, 1.55, 0], [-.12, 1.55, 0]);
poly([-.12, 1.55, 0], [-.23, 1.44, 0], [-.17, .88, 0], [.17, .88, 0], [.23, 1.44, 0], [.12, 1.55, 0]);
poly([-.23, 1.44, 0], [-.33, .83, 0]); poly([.23, 1.44, 0], [.33, .83, 0]);
poly([-.17, .88, 0], [-.19, 0, 0], [-.3, 0, 0]); poly([.17, .88, 0], [.19, 0, 0], [.3, 0, 0]);
humanGeometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
function addHuman(x: number, z: number) {
  const figure = new THREE.LineSegments(humanGeometry, humanMaterial); figure.position.set(x, 0, z); humans.add(figure);
}
const labels = element('div'); labels.id = 'labels'; viewport.append(labels);
let tags: { e: HTMLElement; p: THREE.Vector3 }[] = [];
function fit() {
  const bounds = new THREE.Box3().setFromObject(display); bounds.expandByObject(humans);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere()), center = sphere.center;
  orbit.target.copy(center);
  const direction = compare.checked ? new THREE.Vector3(0, .18, 1) : new THREE.Vector3(1, .42, 1.2);
  camera.position.copy(center).add(direction.normalize().multiplyScalar(sphere.radius * 4));
  camera.lookAt(center); camera.updateMatrixWorld(true);
  const projected = new THREE.Box3();
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    projected.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  }
  const size = projected.getSize(new THREE.Vector3());
  const halfHeight = Math.max(size.y / 2, size.x / (2 * aspect)) * 1.18;
  camera.top = halfHeight; camera.bottom = -halfHeight; camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
  camera.zoom = 1; camera.near = .02; camera.far = Math.max(500, sphere.radius * 10); camera.updateProjectionMatrix();
  orbit.update();
}
function show() {
  models.forEach(m => { display.remove(m.root); m.dispose(); }); models = [];
  humans.clear(); labels.replaceChildren(); tags = [];
  const selected = select.value as FaunaId, all = compare.checked;
  download.disabled = all;
  const ids = all ? FAUNA_IDS : [selected];
  let x = 0;
  for (const id of ids) {
    const model = createFaunaModel(id); models.push(model);
    // A side-oriented lineup: all models keep their metric scale; only placement/orientation changes.
    model.root.rotation.y = Math.PI / 2;
    const box = new THREE.Box3().setFromObject(model.root);
    model.root.position.x = x - box.min.x;
    display.add(model.root); box.setFromObject(model.root);
    addHuman(box.min.x - 1.3, box.max.z + .8);
    if (all) {
      const tag = element('span', tl(FAUNA[id].name)); labels.append(tag);
      tags.push({ e: tag, p: new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + .8, 0) });
    }
    x = box.max.x + 4;
  }
  name.textContent = all ? tl('All the creatures at one scale') : tl(FAUNA[selected].name);
  dimensions.textContent = all ? tl('Every model keeps its original size in metres.') : tl(FAUNA[selected].dimensions);
  description.textContent = all ? '' : tl(FAUNA[selected].description);
  status.textContent = tl('In the game since 0.240: they live in the wilds by their biomes.');
  parts.replaceChildren(...(all ? [] : Object.keys(models[0].parts).map(p => element('li', p))));
  partsTitle.hidden = all;
  const triangles = models.reduce((sum, m) => {
    m.root.traverse(o => { if (o instanceof THREE.Mesh) sum += o.geometry.getAttribute('position').count / 3; }); return sum;
  }, 0);
  status.textContent += ' ' + TL`${triangles} triangles.`;
  location.hash = all ? 'compare' : selected;
  if (grid) { scene.remove(grid); grid.geometry.dispose(); (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(m => m.dispose()); }
  const bounds = new THREE.Box3().setFromObject(display), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const gridSize = Math.ceil(Math.max(10, size.x, size.z) * 1.4);
  grid = new THREE.GridHelper(gridSize, gridSize, 0x12391e, 0x07180c); grid.position.set(center.x, -.04, center.z); scene.add(grid);
  fit();
}
function resize() {
  const { width, height } = viewport.getBoundingClientRect();
  renderer.setSize(width, height, false); aspect = width / height; fit();
}
const requested = location.hash.slice(1);
select.value = FAUNA_IDS.includes(requested as FaunaId) ? requested : FAUNA_IDS[0];
compare.checked = requested === 'compare';
select.onchange = () => { compare.checked = false; show(); };
compare.onchange = show; reset.onclick = fit;
download.onclick = () => {
  // Export a fresh neutral instance; gallery placement, rotation and scale references are presentation only.
  const id = select.value as FaunaId, model = createFaunaModel(id);
  try {
    const file = new Blob([JSON.stringify(model.root.toJSON())], { type: 'application/json' });
    const url = URL.createObjectURL(file), link = element('a');
    link.href = url; link.download = `gridworld-${id}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally { model.dispose(); }
};
new ResizeObserver(resize).observe(viewport);
show();
renderer.setAnimationLoop(() => {
  orbit.update(); renderer.render(scene, camera);
  for (const tag of tags) {
    const p = tag.p.clone().project(camera);
    tag.e.hidden = Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || p.z > 1;
    tag.e.style.left = `${(p.x + 1) * 50}%`; tag.e.style.top = `${(1 - p.y) * 50}%`;
  }
});
