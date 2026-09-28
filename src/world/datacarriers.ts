// Old data carriers in the dungeons (gen/tech.ts): when you enter the first vault of a ruin, a crashed ship or a cave
// system that holds one, it stands on a small pedestal beside one of the place's chests (always the same one), under
// a violet beam. E takes it: the technology is recorded in `char.tech` and can be read at any village computer
// (ARCHIVE). The pedestal stays behind, empty.
import * as THREE from 'three';
import { scene, add, fillMat, edgesOf, V } from './render';
import { G, W } from '../game';
import { emptyAt } from './player';
import { OW } from './overworld';
import { Terrain } from '../gen/terrain';
import { siteIn, carrierChest, techSites, pickLead, leadText, dirWord, TECH_BY_ID, CARRIER_NAME, type TechSite } from '../gen/tech';
import { worldDist, wrapDx, nearX } from '../gen/regions';
import { saveChar } from '../character';
import { logLine, showToast } from '../ui/hud';

export const DATA_C = 0xc49cff;
let grp: THREE.Group | null = null, item: THREE.Group | null = null, site: TechSite | null = null, top = V(0, 0, 0);

const terrain = () => (OW.terrain && OW.terrain.world === G.char.world ? OW.terrain : new Terrain(G.char.world));

/** The carrier's model: a floppy disk with its shutter, a data disk in a caddy, or a long memory crystal. */
function carrierModel(k: TechSite['carrier']): THREE.Group {
  const g = new THREE.Group(), line = add(DATA_C);
  if (k === 'floppy') {
    const b = new THREE.BoxGeometry(0.34, 0.03, 0.34); g.add(new THREE.Mesh(b, fillMat()), edgesOf(b, line));
    const sh = new THREE.BoxGeometry(0.16, 0.035, 0.11); const s = edgesOf(sh, line); s.position.set(0, 0.002, -0.11); g.add(s);
    g.rotation.x = -0.5;
  } else if (k === 'disk') {
    const c = new THREE.CylinderGeometry(0.19, 0.19, 0.03, 12); g.add(new THREE.Mesh(c, fillMat()), edgesOf(c, line));
    const hub = new THREE.CylinderGeometry(0.05, 0.05, 0.035, 8); g.add(edgesOf(hub, line));
    g.rotation.x = -0.6;
  } else {
    const o = new THREE.OctahedronGeometry(0.13); const m = edgesOf(o, line); m.scale.set(0.8, 2.3, 0.8); g.add(m);
    g.position.y = 0.2;
  }
  return g;
}

/** In a freshly loaded dungeon: the pedestal (and the carrier, unless already recovered) of the place's technology. */
export function placeCarrier() {
  dropCarrier();
  const d = G.char.dungeon;
  if (!d || d.depth !== 1 || d.gx !== 0 || d.gz !== 0) return;
  site = siteIn(terrain(), d.ruinId);
  if (!site) return;
  const chests = [...W.chests].sort((a, b) => a.i - b.i), i = carrierChest(G.char.world, site.place, chests.length);
  // beside a chest; with none (a cave), at a hashed spot of the place's open floor
  const cells = W.spawnCells, cell = cells.length ? cells[carrierChest(G.char.world, site.place ^ 0x5eed, cells.length)] : null;
  const base = i >= 0 ? chests[i].g.position.clone() : cell ? V(cell[0] + 0.5, G.ground ? G.ground(cell[0] + 0.5, cell[2] + 0.5) : cell[1], cell[2] + 0.5) : G.pos.clone();
  // beside the chest: the first free spot round it
  let at: THREE.Vector3 | null = null;
  for (let k = 0; k < 12 && !at; k++) {
    const a = k / 12 * 6.283 + 0.4, r = k < 8 ? 1.2 : 1.8, x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r;
    const y = G.ground ? G.ground(x, z) : base.y;
    if (Math.abs(y - base.y) < 0.6 && emptyAt(V(x, y + 0.4, z)) && emptyAt(V(x, y + 1.4, z)) && emptyAt(V(x + 0.3, y + 0.4, z)) && emptyAt(V(x - 0.3, y + 0.4, z)) && emptyAt(V(x, y + 0.4, z + 0.3)) && emptyAt(V(x, y + 0.4, z - 0.3))) at = V(x, y, z);
  }
  if (!at) at = base.clone().add(V(0, 0.6, 0)); // on the chest's lid
  grp = new THREE.Group(); grp.position.copy(at);
  const ped = new THREE.CylinderGeometry(0.22, 0.3, 0.9, 6), m = new THREE.Mesh(ped, fillMat()), e = edgesOf(ped, add(DATA_C));
  m.position.y = e.position.y = 0.45; grp.add(m, e);
  const plate = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 6), pl = edgesOf(plate, add(DATA_C)); pl.position.y = 0.92; grp.add(pl);
  if (!G.char.tech[site.tech]) {
    item = carrierModel(site.carrier); item.position.y += 1.15; grp.add(item);
    const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 1.3, 0), V(0, 5, 0)]), add(DATA_C)); beam.name = 'beam'; grp.add(beam);
  }
  top = at.clone(); scene.add(grp);
}
export function dropCarrier() {
  if (grp) { scene.remove(grp); grp.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
  grp = null; item = null; site = null;
}
/** Standing by a carrier not yet taken. */
export function nearCarrier(): TechSite | null {
  if (!site || !item || G.char.loc !== 'dungeon') return null;
  return Math.hypot(G.pos.x - top.x, G.pos.z - top.z) < 1.7 && Math.abs(G.pos.y - top.y) < 1.5 ? site : null;
}
export const carrierPrompt = (s: TechSite) => `E — take the ${CARRIER_NAME[s.carrier]}`;
/** Take the carrier: the technology is yours. */
export function takeCarrier(s: TechSite) {
  const t = TECH_BY_ID[s.tech];
  G.char.tech[s.tech] = Math.round(G.char.time); saveChar();
  if (item && grp) { grp.remove(item); const b = grp.getObjectByName('beam'); if (b) grp.remove(b); item = null; }
  showToast('Data recovered: ' + t.name);
  logLine(`The ${CARRIER_NAME[s.carrier].toLowerCase()} still reads: plans for ${t.name}. ${t.blurb} Any village computer can read it (ARCHIVE).`);
}
/** The carrier turns slowly over its pedestal. */
export function spinCarrier(time: number) {
  if (item) { item.rotation.y = time * 0.9; item.position.y = 1.15 + Math.sin(time * 2) * 0.05 + (site?.carrier === 'crystal' ? 0.2 : 0); }
}
/** Where the pedestal stands in the loaded dungeon (null: none here). */
export const carrierSpot = () => (grp ? grp.position.clone() : null);

// ---------- leads (gen/tech.ts pickLead): what the villagers tell of old machines ----------
/** A villager of the village at (vx, vz) is asked about old machines: their answer (a new lead is remembered). */
export function askLead(vx: number, vz: number): string {
  const c = G.char, got = pickLead(techSites(terrain()), c.tech, c.leads, vx, vz);
  if (!got) return 'Old machines? Nobody round here has seen anything like that for years. Ask in the villages further out.';
  if (got.fresh) { c.leads.push(got.site.tech); saveChar(); logLine(`New lead: a ${CARRIER_NAME[got.site.carrier].toLowerCase()} in ${got.site.name} (marked on your map).`); }
  return (got.fresh ? '' : 'Did you not go and look yet? ') + leadText(got.site, vx, vz, c.world);
}
/** The leads not yet followed up (heard of, carrier not taken). */
export const openLeads = (): TechSite[] => { const c = G.char; return c.leads.length ? techSites(terrain()).filter((s) => c.leads.includes(s.tech) && c.tech[s.tech] === undefined) : []; };
/** Map and compass markers for the open leads. */
export const leadMarkers = () => openLeads().map((s) => ({ x: nearX(s.x, G.pos.x), z: s.z, label: s.name, short: CARRIER_NAME[s.carrier] }));
/** Quest tracker lines for the open leads. */
export function leadLines(): string[] {
  return openLeads().map((s) => {
    let t = `<span style="color:#c49cff">Lead:</span> a ${CARRIER_NAME[s.carrier].toLowerCase()} in ${s.name}`;
    if (G.char.loc === 'overworld') { const dx = wrapDx(s.x - G.pos.x), dz = s.z - G.pos.z, d = worldDist(s.x, s.z, G.pos.x, G.pos.z); t += d < 40 ? ' · right here' : ` · ${d < 1000 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toFixed(1) + ' km'} ${dirWord(dx, dz)}`; }
    else if (G.char.dungeon?.ruinId === s.place) t += ' · in here';
    return t;
  });
}
