// Рельеф Затона. Единственный источник высоты земли: всё (дома, люди, игрок,
// мелочь) ставится на groundH(x,z). Раздел 3.3 и 4.3 спеки.
// src/sim не импортирует этот модуль: там рельеф не нужен.

export const WATER_Y = -2.4;
export const CANAL_HALF = 6.2; // до стенки набережной
export const BRIDGE_Z0 = -3.4;
export const BRIDGE_Z1 = 3.4;
export const MAP = { x0: -96, x1: 96, z0: -92, z1: 72 };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function onBridge(x: number, z: number) {
  return Math.abs(x) < 9.4 && z > BRIDGE_Z0 && z < BRIDGE_Z1;
}

export function isWater(x: number, z: number) {
  return Math.abs(x) < CANAL_HALF && !onBridge(x, z);
}

/** Высота улицы. Внутри канала возвращает дно (ходить туда нельзя — коллизия). */
// Настилы и крыша каланчи: ходить можно, вода под ними не мешает.
export const ZONES: { x0: number; x1: number; z0: number; z1: number; y: number }[] = [
  { x0: -74, x1: -66, z0: -62, z1: -54, y: 27.4 }, // крыша каланчи
  { x0: -45, x1: -39, z0: 56, z1: 68, y: 0.7 },            // пристань №3
  { x0: -12, x1: -6, z0: 58, z1: 70, y: 0.7 },             // пирс 7
  { x0: -8, x1: -2, z0: 60, z1: 68, y: 0.95 },             // баржа «Вера»
  { x0: -42, x1: -38, z0: 62, z1: 67, y: 0.95 },           // катер
];

export function zoneAt(x: number, z: number): number | null {
  for (const zn of ZONES) {
    if (x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1) return zn.y;
  }
  return null;
}

export function groundH(x: number, z: number): number {
  const zone = zoneAt(x, z);
  if (zone !== null) return zone;
  if (isWater(x, z)) return WATER_Y - 1.1;
  // мост: ровная каменная палуба с короткими съездами
  if (onBridge(x, z)) {
    const ramp = Math.min(1, (3.4 - Math.abs(z)) / 1.1, (9.4 - Math.abs(x)) / 1.1);
    return 0.42 * Math.max(0, Math.min(1, ramp)) + 0.06;
  }

  // общий уклон к гавани (на юг) ≈1.5 м на 140 м
  let h = -0.0105 * z + 0.05;

  // восточный холм: подъём к приюту +6 м
  const east = smooth(10, 50, x);
  const north = 1 - smooth(-52, 12, z);
  h += 6.1 * east * north;

  // Приютская улица: срезка-ступени у (30,-30) — локальная терраса
  const stair = Math.exp(-(((x - 30) ** 2) / 40 + ((z + 30) ** 2) / 30));
  h -= 0.55 * stair;

  // горб мостовой на Рыночной (z=-8) и на Складской (z=18)
  const crownZ = (zc: number) => Math.exp(-((z - zc) ** 2) / 14);
  if (x < -10) h += 0.075 * crownZ(-8);
  if (x > 14) h += 0.06 * crownZ(18);

  // колеи трамвая на Рыночной
  if (x < -10) h -= 0.035 * (Math.exp(-((z + 9.6) ** 2) * 3) + Math.exp(-((z + 6.4) ** 2) * 3));

  // спуск к воде у набережных
  const bankW = Math.exp(-((x + 14) ** 2) / 26) + Math.exp(-((x - 14) ** 2) / 26);
  h -= 0.22 * bankW;

  // неровность: крупные бугры и мелкая рябь
  h += 0.055 * (vnoise(x * 0.34, z * 0.34) - 0.5) * 2;
  h += 0.02 * (vnoise(x * 1.6, z * 1.6) - 0.5) * 2;

  // у самого края карты — берег вниз
  const edge = Math.min(x - MAP.x0, MAP.x1 - x, z - MAP.z0, MAP.z1 - z);
  if (edge < 8) h -= (1 - edge / 8) * 1.2;

  return h;
}

/** Высота пола в интерьере (дом стоит на земле, порог ровный). */
export function floorH(x: number, z: number) {
  return groundH(x, z) + 0.06;
}

export function dist2(ax: number, az: number, bx: number, bz: number) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
