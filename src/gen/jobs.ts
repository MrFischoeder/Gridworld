// Finishing a build whose time is up (pure): the state change each kind of build makes once its builders are done
// (gen/construction.ts). The stock's own goods are settled before and anchored after, as the panels did for a build.
import { dropJob, type Job } from './construction';
import { completeFarm, completeUpgrade } from './farms';
import { completeWall, completeWork, type TownState, type WorkKind } from './town';
import { completeImprove, type ImproveKind } from './improve';
import { completeBuild } from './industry';
import { completePlantUp } from './plantup';
import { completePlant } from './plants';
import { completeProject, type Project } from './settlement';
import { settleOwn, anchorNew } from './hall';
import { peopleAt, setPeople } from './people';
import { villageSeed, GRIDHOLM_ID, type Poi } from './regions';

export interface Finished { job: Job; built: boolean; stage: boolean }
/** Finish job j of village v (whose time is up) and drop it. */
export function finishJob(world: number, v: Poi, s: TownState, j: Job, now: number): Finished {
  const seed = villageSeed(world, v), home = v.id === GRIDHOLM_ID, a = j.a ?? '';
  settleOwn(world, v, seed, s, now);
  let built = true, stage = false;
  switch (j.k) {
    case 'farm': completeFarm(s, seed, home, now); break;
    case 'plough': completeUpgrade(s); break;
    case 'wall': completeWall(s); break;
    case 'work': completeWork(s, a as WorkKind); break;
    case 'refinery': completeBuild(s); break;
    case 'improve': completeImprove(s, a as ImproveKind); break;
    case 'plantup': completePlantUp(s); break;
    case 'plant': built = completePlant(s, now) !== null; break;
    case 'project': {
      setPeople(s, seed, home, now, peopleAt(seed, home, s, now)); // development changes the homes: grow from where it is
      ({ built, stage } = completeProject(s, a as Project));
      if (built && a === 'power') { s.fixed = now; s.hurt = 0; }
      if (built && a === 'refinery') s.settlement!.refinedAt = now;
      break;
    }
  }
  dropJob(s, j);
  anchorNew(world, v, seed, s, now);
  return { job: j, built, stage };
}
