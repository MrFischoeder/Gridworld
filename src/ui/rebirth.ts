// Death on a server is the end of that character. Their kit falls where they died (shared drops, anyone may take it),
// their name joins the world's fallen crew (`Char.fallen`, shared: the server refuses it as a character name from then
// on) and their cryo-pod stays open. Another member of the survey team thaws out in the next shut pod aboard the
// Kestrel with an empty backpack, a fresh locker and no map, quests or gold, and needs a new name. Alone nothing of this
// happens: you wake in your pod as before (world/level.ts toVillage).
// Their houses go to the next crew member of the same player (`Char.estate`), handed over by the village elder.
// Multiplayer: each player's game runs their own death; the drops, `fallen` and the server's name check are shared.
import { G } from '../game';
import { online, net, sendHero, onHero } from '../net/client';
import { newChar, type Char, type Slot } from '../save';
import { saveChar } from '../character';
import { dropAtFeet } from '../world/drops';
import { myPod, nextPod } from '../world/crashpod';
import { SHARED } from '../world/share';
import { setCrewDeath, type Arrival } from '../world/level';
import { SHIP_NAME } from '../world/lander';
import { cleanName } from './menu';
import { lockPointer } from './input';
import { logLine, showToast } from './hud';

const box = document.getElementById('crewName')!, title = document.getElementById('cnTitle')!, sub = document.getElementById('cnSub')!;
const input = document.getElementById('cnName') as HTMLInputElement, msg = document.getElementById('cnMsg')!, ok = document.getElementById('cnOk')!;
let asking = false;

/** Why this name cannot be your character's ('' = it can). */
export function nameProblem(n: string): string {
  if (!n) return 'Your crew member needs a name.';
  const low = n.toLowerCase();
  if (G.char.fallen?.[low]) return `${G.char.fallen[low].n} died in this world. Pick another name.`;
  for (const p of net.peers.values()) if (p.name.toLowerCase() === low) return `Someone here is already called ${p.name}.`;
  return '';
}
/** Asks for the character's name (after a death, or when the one you had is taken). */
export function askName(head: string, text: string, why = '') {
  asking = true; G.dlgOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  title.textContent = head; sub.textContent = text; msg.textContent = why; input.value = '';
  box.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => input.focus(), 0);
}
function confirm() {
  const n = cleanName(input.value), why = nameProblem(n);
  if (why) { msg.textContent = why; return; }
  G.char.name = n; saveChar(); sendHero(n);
  asking = false; G.dlgOpen = false; box.style.display = 'none';
  logLine(`You are ${n} now, of the ${SHIP_NAME}'s survey team.`);
  if (!G.isTouch && G.playing) lockPointer();
}
ok.addEventListener('click', confirm);
input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') confirm(); });
onHero((mine, name, why) => {
  if (!mine || !why) return;
  if (G.char.name === name) { G.char.name = ''; saveChar(); }
  askName('Another name', 'The server will not take that name for your character.', why);
});

/** After the welcome: tell the server who you play, or ask for a name if there is none (or the dead own it). */
export function presentHero() {
  const had = G.char.name, why = nameProblem(had);
  if (!why) { sendHero(had); return; }
  if (had) { G.char.name = ''; saveChar(); }
  askName('Name your crew member', `You wake aboard the ${SHIP_NAME}. Who are you?`, had ? why : '');
}

let use: ((c: Char, a: Arrival) => void) | null = null;
/** main.ts hands over how to switch to another character. */
export function initRebirth(f: (c: Char, a: Arrival) => void) {
  use = f;
  setCrewDeath(() => {
    if (!online() || !use) return false;
    const old = G.char, name = old.name || 'A castaway';
    // the kit falls where they died
    const kit: Slot[] = [];
    for (const s of [...old.inv, ...old.hands, ...old.back]) if (s) kit.push(s);
    for (const k of [...Object.values(old.wear), ...old.mods, ...old.gunMods]) if (k) kit.push({ k, n: 1 });
    for (const s of kit) dropAtFeet(s);
    // the name joins the fallen, the pod stays open
    old.fallen[name.toLowerCase()] = { n: name, t: Math.round(old.time), pod: myPod() };
    const c = newChar(), pod = nextPod();
    for (const f of SHARED) (c as unknown as Record<string, unknown>)[f.f] = old[f.f]; // the world stays the world
    Object.assign(c, { world: old.world, time: old.time, name: '', intro: true, guide: 2, pod, settlementRules: old.settlementRules });
    // their house waits for the next crew member of this same player: the elder hands it over (ui/dialog.ts)
    const homes = Object.fromEntries(Object.entries(old.containers).filter(([k]) => k.startsWith('home:')));
    for (const k of Object.keys(homes)) delete c.containers[k];
    const prev = old.estate, houses = [...new Set([...(prev?.houses ?? []), ...old.houses])];
    if (houses.length) c.estate = { from: old.houses.length ? name : prev!.from, houses, chests: { ...(prev?.chests ?? {}), ...homes } };
    use(c, { kind: 'pod' });
    showToast(`${name} is dead`);
    logLine(`${name} died. Their kit lies where they fell.`);
    askName(`${name} is dead`, `Another member of the survey team thaws out in a cryo-pod aboard the ${SHIP_NAME}, with nothing but what the crew left in the locker. ${name}'s kit lies where they fell. Name the survivor:`);
    return true;
  });
}
export const askingName = () => asking;
