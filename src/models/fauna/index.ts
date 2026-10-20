// Stable catalogue of visual assets, deliberately separate from data/creatures.ts and its gameplay/network IDs.
import { grzbietowiec } from './grzbietowiec';
import { szescionog } from './szescionog';
import { wazPregowy } from './waz-pregowy';
import { szczekorog } from './szczekorog';
import { koronotytan } from './koronotytan';
import type { FaunaModel } from './geometry';
export type { FaunaModel } from './geometry';

export const FAUNA_IDS = ['grzbietowiec', 'szescionog', 'waz-pregowy', 'szczekorog', 'koronotytan'] as const;
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
};

export function createFaunaModel(id: FaunaId): FaunaModel { return FAUNA[id].create(); }
