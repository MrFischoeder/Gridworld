// Developer console, opened with ~ (the backquote key). Cheats for testing.
import { G } from '../game';
import { ROBOTS, type RobotKind } from '../data/robots';
import { spawnRobotNear } from '../world/robots';
import { fmtClock, DAY } from '../core/time';
import { saveChar } from '../character';
import { toVillage } from '../world/level';
import { GRIDHOLM_ID } from '../gen/regions';
import { spawnCreatureNear } from '../world/creatures';
import { spawnBanditsNear } from '../world/bandits';
import { spawnRaiderNear, forceAmbush } from '../world/raiders';
import { CREATURES, type CreatureKind } from '../data/creatures';
import { $, logLine } from './hud';
import { openDevMap, planetSize } from './devmap';
import { teleportTo } from '../world/level';
import { lockPointer } from './input';

const root = $('console'), out = $('conLog'), input = $<HTMLInputElement>('conIn');
const history: string[] = [];
let hIdx = 0;

function print(text: string, err = false) {
  const d = document.createElement('div'); d.textContent = text; if (err) d.className = 'err';
  out.appendChild(d); out.scrollTop = out.scrollHeight;
}

const COMMANDS: Record<string, { help: string; run: (args: string[]) => string }> = {
  help: { help: 'list commands', run: () => Object.entries(COMMANDS).map(([k, c]) => `${k.padEnd(6)} ${c.help}`).join('\n') },
  cash: {
    help: '+10000 gold',
    run: () => { G.char.gold += 10000; saveChar(); logLine('+10000 gold'); return `Gold: ${G.char.gold}`; },
  },
  god: {
    help: 'full health and immortality (type again to turn off)',
    run: () => { G.god = !G.god; G.hp = G.S.maxHp; return G.god ? 'God mode ON: full health, no death.' : 'God mode OFF.'; },
  },
  home: {
    help: 'go back to Gridholm (outside the tavern)',
    run: () => { if (G.trans) return 'Busy travelling, try again in a moment.'; close(); toVillage('recall', GRIDHOLM_ID); return 'Home.'; },
  },
  time: {
    help: 'time [hour] — show the clock, or skip ahead to that hour (0-23)',
    run: ([h]) => {
      if (h === undefined) return fmtClock(G.char.time);
      const want = Number(h);
      if (!Number.isFinite(want) || want < 0 || want >= 24) return 'Usage: time <hour 0-23>';
      const now = G.char.time, today = Math.floor(now / DAY) * DAY;
      G.char.time = today + want * 60 + (today + want * 60 <= now ? DAY : 0);
      return 'It is now ' + fmtClock(G.char.time) + '.';
    },
  },
  eat: { help: 'fill food, water and stamina', run: () => { G.char.kcal = 3000; G.char.stomach = 0; G.char.water = 100; G.stamina = 100; G.exhausted = false; return 'Fed and watered.'; } },
  clear: { help: 'clear this log', run: () => { out.innerHTML = ''; return ''; } },
  ambush: { help: 'set up a bandit ambush ahead (stand on a road)', run: () => (forceAmbush() ? 'Something moves by the road ahead...' : 'Stand on a road, away from places.') },
  worldmap: {
    help: 'map of the whole planet: click a village, ruin, camp, wreck or any spot to teleport there',
    run: () => { openDevMap(); close(); return 'The planet: ' + planetSize() + '.'; },
  },
  tp: {
    help: 'tp <x> <z>: teleport to a point on the surface',
    run: (a) => {
      const x = parseFloat(a[0]), z = parseFloat(a[1]);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return 'Usage: tp <x> <z>   (Gridholm is at 0 0)';
      close(); return teleportTo(x, z);
    },
  },
  spawn: {
    help: 'spawn ravager | bramble | leechwing | gnawer | bandits | raider [mastodon] | scout | guardian | repair | sentinel | artillery | assault (open world)',
    run: (a) => {
      if (a[0] in ROBOTS) return spawnRobotNear(a[0] as RobotKind) ? `${ROBOTS[a[0] as RobotKind].name} spawned.` : 'Only in the open world.';
      if (a[0] === 'bandits') return spawnBanditsNear() ? 'Bandits!' : 'Only in the open world.';
      if (a[0] === 'raider') return spawnRaiderNear(a[1] === 'mastodon' ? 'mastodon' : 'scout') ? 'Raiders incoming.' : 'Only in the open world.';
      const k = a[0] as CreatureKind;
      if (!(k in CREATURES)) return 'Usage: spawn ravager | bramble | leechwing | gnawer | bandits';
      return spawnCreatureNear(k) ? `${CREATURES[k].name} spawned.` : 'Only in the open world.';
    },
  },
};

function exec(line: string) {
  const cmd = line.trim().toLowerCase();
  if (!cmd) return;
  history.push(cmd); hIdx = history.length;
  print('> ' + cmd);
  const c = COMMANDS[cmd.split(/\s+/)[0]];
  if (!c) { print(`Unknown command "${cmd}". Type help.`, true); return; }
  const r = c.run(cmd.split(/\s+/).slice(1));
  if (r) print(r);
}

export function open() {
  if (G.consoleOpen) return;
  G.consoleOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  root.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
  if (!out.childElementCount) print('GridWorld console. Commands: cash, god, home, help. ~ or Esc to close.');
  setTimeout(() => input.focus(), 0);
}
export function close() {
  if (!G.consoleOpen) return;
  G.consoleOpen = false; root.style.display = 'none'; input.blur();
  if (G.playing && !G.isTouch) lockPointer();
}
export const toggleConsole = () => (G.consoleOpen ? close() : open());

input.addEventListener('keydown', (e) => {
  e.stopPropagation(); // typing here must not move the player
  if (e.code === 'Backquote' || e.code === 'Escape') { e.preventDefault(); close(); return; }
  if (e.code === 'Enter') { exec(input.value); input.value = ''; return; }
  if (e.code === 'ArrowUp' && history.length) { hIdx = Math.max(0, hIdx - 1); input.value = history[hIdx]; e.preventDefault(); }
  if (e.code === 'ArrowDown' && history.length) { hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] ?? ''; e.preventDefault(); }
});
