// Уровни этажей: sim-этаж → высота Y. Здания и их границы (для прозрачности оболочки и вертикального перехода).
export interface LevelInfo { b: string; floor: number; y: number }
export const LEVELS: Record<string, LevelInfo> = {
  'tav-1': { b: 'tavern', floor: -1, y: -3.2 }, tav0: { b: 'tavern', floor: 0, y: 0 }, tav1: { b: 'tavern', floor: 1, y: 2.9 },
  work: { b: 'workshop', floor: 0, y: 0 }, bur: { b: 'bureau', floor: 0, y: 0 }, booth: { b: 'booth', floor: 0, y: 0 },
  tw0: { b: 'tower', floor: 0, y: 0 }, tw1: { b: 'tower', floor: 1, y: 4.2 }, tw2: { b: 'tower', floor: 2, y: 8.4 },
};
export interface BBox { b: string; x0: number; z0: number; x1: number; z1: number; house: string }
export const BUILDINGS: BBox[] = [
  { b: 'tavern', x0: -35.1, z0: -7.6, x1: -20.9, z1: 3.6, house: 'F2' },
  { b: 'workshop', x0: -30.2, z0: -25.6, x1: -21.8, z1: -18.4, house: 'F1' },
  { b: 'booth', x0: -38.2, z0: 8.8, x1: -33.8, z1: 13.2, house: 'F3' },
  { b: 'tower', x0: -4.3, z0: -31.3, x1: 4.3, z1: -22.7, house: 'F4' },
  { b: 'bureau', x0: 79.5, z0: 6.1, x1: 86.5, z1: 11.9, house: 'F13' },
];
export const buildingAt = (x: number, z: number): BBox | null => BUILDINGS.find((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) ?? null;
export function floorY(x: number, z: number, floor: number): number {
  const b = buildingAt(x, z); if (!b) return 0;
  const l = Object.values(LEVELS).find((v) => v.b === b.b && v.floor === floor);
  return l ? l.y : 0;
}
export const levelOf = (b: string, floor: number) => Object.entries(LEVELS).find(([, v]) => v.b === b && v.floor === floor)?.[0] ?? '';
