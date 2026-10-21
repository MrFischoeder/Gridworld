// Stable catalogue of visual assets, deliberately separate from data/creatures.ts and its gameplay/network IDs.
import { grzbietowiec } from './grzbietowiec';
import { szescionog } from './szescionog';
import { wazPregowy } from './waz-pregowy';
import { szczekorog } from './szczekorog';
import { koronotytan } from './koronotytan';
import { skoczek } from './skoczek';
import { klowiec } from './klowiec';
import { skorpid } from './skorpid';
import type { FaunaModel } from './geometry';
export type { FaunaModel } from './geometry';

export const FAUNA_IDS = ['grzbietowiec', 'szescionog', 'waz-pregowy', 'szczekorog', 'koronotytan', 'skoczek', 'klowiec', 'skorpid'] as const;
export type FaunaId = typeof FAUNA_IDS[number];
export interface FaunaAsset {
  name: string;
  description: string;
  dimensions: string;
  /** Anatomical dimensions in metres; snake length follows its curved centreline. */
  length: number; height: number;
  legs: number;
  create(): FaunaModel;
}
export const FAUNA: Readonly<Record<FaunaId, FaunaAsset>> = {
  grzbietowiec: { name: 'Ridgeback Bear', description: 'An alien bear with a shaggy shoulder hump, four almond eyes and broad five-toed paws.',
    dimensions: '4.2 m nose to rump · 2.9 m hump', length: 4.55, height: 2.9, legs: 4, create: grzbietowiec },
  szescionog: { name: 'Hexastrider', description: 'An elongated horse with three distinct pairs of legs, cloven hooves and a ribbon mane.',
    dimensions: '5.2 m nose to rump · 3.4 m head', length: 6.4, height: 3.4, legs: 6, create: szescionog },
  'waz-pregowy': { name: 'Banded Serpent', description: 'A giant continuous S-shaped snake with broad transverse bands and a raised wedge-shaped head.',
    dimensions: '22 m along the body · 1.4 m body diameter · 4.5 m raised head', length: 22, height: 4.5, legs: 0, create: wazPregowy },
  szczekorog: { name: 'Crestjaw', description: 'A low crocodilian with four splayed legs, a long flat muzzle and two organic dorsal ridges.',
    dimensions: '9 m including tail · 1.2 m crest', length: 9, height: 1.2, legs: 4, create: szczekorog },
  koronotytan: { name: 'Crown Titan', description: 'A colossal sauropod with four columnar legs, a steep rising neck and a small leaf-crowned head.',
    dimensions: '36 m including tail · 18 m crown · 7.5 m shoulders', length: 36, height: 18, legs: 4, create: koronotytan },
  // (0.240) three more of the planet's animals, made the same way
  skoczek: { name: 'Hopling', description: 'A small long-eared hopper with strong hind legs that grazes the open land in little groups.',
    dimensions: '1 m nose to tail · 0.85 m to the ear tips', length: 1, height: 0.85, legs: 4, create: skoczek },
  klowiec: { name: 'Tusker', description: 'A bristle-backed boar with four tusks that roots in a sounder and turns on whoever hurts one of them.',
    dimensions: '2.3 m tusks to tail · 1.3 m at the bristles', length: 2.3, height: 1.3, legs: 4, create: klowiec },
  skorpid: { name: 'Scorpid', description: 'A desert scorpion the size of a calf, pincers held before it and the sting curled over its back.',
    dimensions: '3 m with the pincers · 1.5 m to the sting', length: 3, height: 1.5, legs: 6, create: skorpid },
};

export function createFaunaModel(id: FaunaId): FaunaModel { return FAUNA[id].create(); }
