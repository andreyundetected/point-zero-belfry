import { Sim } from './sim';
import type { Loc, WorldDef } from './types';
import { genCrowd, genPlaces } from './crowd';
import { buildGraph, pathLens } from './graph';
import worldDef from '../data/world.json';
import locs from '../data/locations.json';
export function makeSim(seed = 1, crowd = true) {
  const def = { ...(worldDef as unknown as WorldDef) };
  const places = crowd ? genPlaces(seed, locs as Loc[]) : [];
  if (crowd) def.npcs = [...def.npcs, ...genCrowd(seed, pathLens(buildGraph(def), 'lash'), places)];
  return new Sim(def, [...(locs as Loc[]), ...places], seed);
}
