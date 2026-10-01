// A worker that works out where the great installations stand (gen/installs.ts `installSites`) off the main thread:
// the search takes seconds (each spot it tries asks for the terrain's features far out), and on the main thread it
// stalled the menu and the start of the game. openWorld starts it (`primeInstalls` in world/installs.ts); the result
// is seeded into the cache, so every later call is instant. Pure modules only: no three.js, no DOM.
import { Terrain } from '../gen/terrain';
import { installSites } from '../gen/installs';
import type { Claim } from '../gen/claims';

self.onmessage = (e: MessageEvent<{ world: number; claims: Claim[] }>) => {
  const { world, claims } = e.data, t = new Terrain(world);
  t.setClaims(claims);
  (self as unknown as Worker).postMessage({ world, sites: installSites(t) });
};
