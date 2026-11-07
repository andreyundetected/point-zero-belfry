import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SU from 'three/addons/utils/SkeletonUtils.js';
import { M, StaticBatch, mtx, canvasPlane } from '../render/materials';
import { groundH, WATER_Y, isWater, zoneAt, MAP, onBridge } from './terrain';
import { buildBuilding, groundStrip, type Built, type Rect } from './building';
import type { Sim } from '../sim/types';
import type { RenderSetup } from '../render/setup';
import type { ItemId } from '../sim/types';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<any>>();
const load = (p: string) => {
  if (!cache.has(p)) cache.set(p, loader.loadAsync(p));
  return cache.get(p)!;
};

export interface Door {
  id: string;
  x: number;
  z: number;
  ry: number;
  w: number;
  open: boolean;
  locked: 'orven' | 'foma' | 'tikhon' | 'shelter' | null;
  ru: string;
  en: string;
  panel?: THREE.Mesh;
}

export interface WorldItem {
  id: string;
  item: ItemId;
  x: number;
  z: number;
  y: number;
  ru: string;
  en: string;
  taken?: boolean;
  mesh?: THREE.Object3D;
}

export interface UsePoint {
  id: string;
  x: number;
  z: number;
  r: number;
  ru: string;
  en: string;
}

const RED = () => new THREE.MeshStandardMaterial({ color: 0xa00a0a, roughness: 0.45, emissive: 0x2a0000 });

export class City {
  rs: RenderSetup;
  scene: THREE.Scene;
  batch = new StaticBatch();
  rects: Rect[] = [];
  doors: Door[] = [];
  items: WorldItem[] = [];
  points: UsePoint[] = [];
  interiors: Record<string, NonNullable<Built['interior']>> = {};
  fires: { id: string; group: THREE.Group; light: THREE.PointLight; smoke: THREE.Sprite[] }[] = [];
  private pending: Promise<any>[] = [];
  ready = false;
  private smokeTex: THREE.Texture;

  constructor(rs: RenderSetup) {
    this.rs = rs;
    this.scene = rs.scene;
    this.smokeTex = this.makeSmoke();
  }

  // --- утилиты -----------------------------------------------------------
  private prop(path: string, x: number, z: number, ry = 0, s = 1, y?: number) {
    const p = load(`/models/${path}.glb`)
      .then((g) => {
        const o = SU.clone(g.scene);
        o.position.set(x, y ?? groundH(x, z), z);
        o.rotation.y = ry;
        o.scale.setScalar(s);
        o.traverse((m) => {
          const mm = m as THREE.Mesh;
          if (mm.isMesh) {
            mm.castShadow = true;
            mm.receiveShadow = true;
            const mat = mm.material as THREE.MeshStandardMaterial;
            if (mat && 'roughness' in mat) mat.roughness = Math.max(0.6, mat.roughness ?? 0.6);
          }
        });
        this.scene.add(o);
      })
      .catch(() => { /* нет модели — не критично */ });
    this.pending.push(p);
  }

  private local(place: string, lx: number, lz: number) {
    const it = this.interiors[place];
    if (!it) return { x: 0, z: 0 };
    const c = Math.cos(it.ry), s = Math.sin(it.ry);
    return { x: it.cx + lx * c + lz * s, z: it.cz - lx * s + lz * c };
  }

  private addRect(x: number, z: number, hw: number, hd: number, ry = 0, yMin?: number, yMax?: number) {
    this.rects.push({ x, z, hw, hd, ry, yMin, yMax });
  }

  private makeSmoke() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, 'rgba(120,115,105,.75)');
    grad.addColorStop(0.55, 'rgba(70,66,60,.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  async build() {
    this.terrain();
    this.canalAndBridge();
    this.buildings();
    this.tower();
    this.warehouse();
    this.piers();
    this.interiorsFurniture();
    this.worldItems();
    this.usePoints();
    this.streetLamps();
    this.streetDressing();
    this.createFires();
    await Promise.allSettled(this.pending);
    this.batch.flush(this.scene);
    this.ready = true;
  }

  // --- земля и улицы ------------------------------------------------------
  private terrain() {
    this.scene.add(groundStrip(-MAP.x1 * 0 - 96, -6.2, -92, 72, M.flags, 0, 2.4, 0.9));
    this.scene.add(groundStrip(6.2, 96, -92, 72, M.flags, 0, 2.4, 0.9));

    const street = (x0: number, x1: number, z0: number, z1: number, lift = 0.02) => {
      const m = groundStrip(x0, x1, z0, z1, M.setts, lift, 3.2, 0.55);
      this.scene.add(m);
    };
    // Рыночная
    street(-90, -10, -12.4, -3.6);
    this.scene.add(groundStrip(-90, -10, -13.8, -12.4, M.flags, 0.16, 2.2, 0.5));
    this.scene.add(groundStrip(-90, -10, -3.6, -2.2, M.flags, 0.16, 2.2, 0.5));
    // Береговая
    street(-17.4, -10.6, -80, 58);
    this.scene.add(groundStrip(-19.4, -17.4, -80, 58, M.flags, 0.16, 2.2, 0.5));
    this.scene.add(groundStrip(-10.6, -8.2, -80, 58, M.flags, 0.16, 2.2, 0.5));
    // Набережная Заречья
    street(10.6, 17.4, -60, 40);
    this.scene.add(groundStrip(8.2, 10.6, -60, 40, M.flags, 0.16, 2.2, 0.5));
    this.scene.add(groundStrip(17.4, 19.4, -60, 40, M.flags, 0.16, 2.2, 0.5));
    // Складская
    street(12, 88, 14, 22);
    this.scene.add(groundStrip(12, 88, 12.4, 14, M.flags, 0.16, 2.2, 0.5));
    this.scene.add(groundStrip(12, 88, 22, 23.6, M.flags, 0.16, 2.2, 0.5));
    // Канатная
    street(-62, -16, 32.4, 39.6);
    this.scene.add(groundStrip(-62, -16, 30.8, 32.4, M.flags, 0.16, 2.2, 0.5));
    this.scene.add(groundStrip(-62, -16, 39.6, 41.2, M.flags, 0.16, 2.2, 0.5));
    // Башенная площадь
    this.scene.add(groundStrip(-83, -53, -51, -29, M.setts, 0.02, 3.2, 0.6));
    // переулок Ключников
    this.ribbon([[-56, -41], [-46, -36], [-30, -30]], 3.2, M.setts);
    // Приютская улица
    this.ribbon([[20, -5], [26, -16], [30, -30], [38, -44], [46, -52]], 5.2, M.setts);
    // двор и площадка приюта
    this.scene.add(groundStrip(40, 60, -56, -48, M.setts, 0.03, 3.2, 0.5));

    // бордюрные камни
    const curb = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 0.95));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        const ang = Math.atan2(x1 - x0, z1 - z0);
        this.batch.box(M.stone, 0.24, 0.26, 0.9, mtx(x, groundH(x, z) + 0.02, z, ang), 1.0);
      }
    };
    curb(-10, -12.4, -90, -12.4);
    curb(-10, -3.6, -90, -3.6);
    curb(-17.4, -80, -17.4, 58);
    curb(-10.6, -80, -10.6, 58);
    curb(10.6, -60, 10.6, 40);
    curb(17.4, -60, 17.4, 40);
    curb(12, 14, 88, 14);
    curb(12, 22, 88, 22);

    // трамвайные рельсы на Рыночной
    for (const rz of [-9.6, -6.4]) {
      for (let x = -88; x < -12; x += 2) {
        this.batch.box(M.iron, 2.0, 0.035, 0.07, mtx(x, groundH(x, rz) + 0.02, rz), 1.0);
      }
    }

    // лужи в колеях и у бордюра
    const pud = new THREE.MeshPhysicalMaterial({ color: 0x020306, roughness: 0.02, clearcoat: 1, envMapIntensity: 1.6, transparent: true, opacity: 0.88 });
    const spots: [number, number][] = [
      [-30, -9.5], [-46, -9.9], [-62, -6.5], [-20, -11.6], [12, -4], [-52, 10],
      [22, 16], [40, 20], [-24, 34], [-40, 35], [-14, -30], [14, -25], [-64, -42], [18, 27],
    ];
    for (const [x, z] of spots) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 26), pud);
      m.scale.set(0.5 + Math.random() * 1.4, 0.35 + Math.random() * 0.5, 1);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * 3;
      m.position.set(x, groundH(x, z) + 0.018, z);
      this.scene.add(m);
    }
  }

  private ribbon(pts: [number, number][], width: number, mat: THREE.Material) {
    const pos: number[] = [], uv: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const dx = x1 - x0, dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      const nx = (-dz / len) * width * 0.5, nz = (dx / len) * width * 0.5;
      const a = [x0 + nx, z0 + nz], b = [x0 - nx, z0 - nz], c = [x1 + nx, z1 + nz], d = [x1 - nx, z1 - nz];
      const quad = [a, b, d, a, d, c];
      for (const [x, z] of quad) {
        pos.push(x, groundH(x, z) + 0.025, z);
        uv.push(x / 3.2, z / 3.2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // --- канал, набережные, мост -------------------------------------------
  private canalAndBridge() {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(220, 18), M.water.clone());
    (water.material as THREE.MeshPhysicalMaterial).transparent = true;
    (water.material as THREE.MeshPhysicalMaterial).opacity = 0.96;
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, WATER_Y, -10);
    this.scene.add(water);

    for (const sx of [-1, 1]) {
      // стенки канала
      for (let z = -92; z < 72; z += 6) {
        this.batch.box(M.stone, 0.7, 3.4, 6, mtx(sx * 6.55, WATER_Y + 1.2, z + 3), 1.6);
      }
      // парапет с проёмами у моста, лестниц и пирсов
      for (let z = -90; z < 70; z += 2.6) {
        if (Math.abs(z) < 6) continue;
        if (z > -18 && z < -10) continue;
        if (z > 54) continue;
        const x = sx * 7.6;
        const y = groundH(x, z);
        this.batch.box(M.stone, 0.42, 0.95, 2.5, mtx(x, y + 0.45, z), 1.2);
        this.batch.box(M.cornice, 0.55, 0.12, 2.55, mtx(x, y + 0.98, z), 1.2);
      }
      // лестницы к воде у моста
      for (let k = 0; k < 6; k++) {
        const x = sx * (7.0 + k * 0.34);
        this.batch.box(M.stone, 0.36, 0.24, 2.2, mtx(x, groundH(x, 9) - 0.2 - k * 0.34, 9), 1.2);
      }
    }

    // мост: палуба и арка
    this.scene.add(groundStrip(-9.4, 9.4, -3.4, 3.4, M.setts, 0.005, 3.2, 0.4));
    for (let k = 0; k < 12; k++) {
      const t = k / 11;
      const z = -2.8 + 5.6 * t;
      const y = Math.sin(t * Math.PI) * 1.0;
      this.batch.box(M.stone, 18.8, 0.9, 0.62, mtx(0, WATER_Y + 0.9 + y, z), 1.6);
    }
    for (const sz of [-1, 1]) {
      for (let x = -9; x <= 9; x += 1.1) {
        this.batch.box(M.stone, 0.28, 0.95, 0.34, mtx(x, groundH(x, sz * 3) + 0.5, sz * 3), 1.2);
      }
      this.batch.box(M.stone, 18.4, 0.18, 0.4, mtx(0, groundH(0, sz * 3) + 1.0, sz * 3), 1.2);
      this.batch.box(M.cornice, 18.5, 0.1, 0.52, mtx(0, groundH(0, sz * 3) + 1.1, sz * 3), 1.2);
    }
    // три фонаря на мосту
    for (const x of [-8.4, 0, 8.4]) this.lamp(x, 2.9);
  }

  // --- дома ---------------------------------------------------------------
  private house(o: Parameters<typeof buildBuilding>[1], placeId?: string, lock: Door['locked'] = null) {
    // любой дом с именем места (placeId) — входимый: у него строится полый первый этаж
    const b = buildBuilding(this.batch, { ...o, enterable: !!placeId || o.enterable });
    this.rects.push(...b.rects);
    if (b.sign) this.scene.add(b.sign);
    if (b.door && placeId) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(b.door.w - 0.04, 2.34, 0.09), o.redDoor ? RED() : M.wood.clone());
      panel.castShadow = true;
      panel.position.set(b.door.x, groundH(b.door.x, b.door.z) + 1.24, b.door.z);
      panel.rotation.y = b.door.ry;
      this.scene.add(panel);
      this.doors.push({
        id: placeId, x: b.door.x, z: b.door.z, ry: b.door.ry, w: b.door.w,
        open: false, locked: lock, ru: o.name ?? placeId, en: o.name ?? placeId, panel,
      });
      if (b.interior) this.interiors[placeId] = b.interior;
    } else if (b.interior && placeId) {
      this.interiors[placeId] = b.interior;
    }
    return b;
  }

  private buildings() {
    const W = M.wall;
    // Рыночная, северная сторона
    let x = -88;
    const north = [
      [7, 3, M.brick], [8, 4, M.plaster], [6, 2, M.plaster2], [9, 3, M.brickD], [7, 4, M.plaster3],
      [8, 3, M.brick], [7, 2, M.plaster], [9, 4, M.brickD], [8, 3, M.plaster2],
    ];
    north.forEach(([w, f, mat], i) => {
      this.house({ x: x + (w as number) / 2, z: -13.8, ry: 0, w: w as number, floors: f as number, wall: mat as THREE.Material, lit: 0.12 + (i % 3) * 0.09, seed: 10 + i, shop: i % 3 === 1, sign: i === 1 ? 'БУЛОЧНАЯ' : undefined, roof: i % 3 === 2 ? 'flat' : 'gable' });
      x += (w as number) + 0.05;
    });
    // Фома — южнее, на Рыночной
    this.house({ x: -40, z: -13.8, ry: 0, w: 7, depth: 8, floors: 2, wall: M.plaster3, lit: 0.2, seed: 77, shop: false, name: 'foma', sign: 'ЗАЛОГИ · ФОМА' }, 'foma', 'foma');
    // Орвен в переулке
    this.house({ x: -46.5, z: -36.2, ry: 0.45, w: 6, depth: 5, floors: 1, wall: M.brickD, lit: 0.5, seed: 91, name: 'orven', sign: 'КЛЮЧИ И ЗАМКИ' }, 'orven', 'orven');
    // Почта
    this.house({ x: -22, z: -13.8, ry: 0, w: 8, depth: 9, floors: 2, wall: M.brick, lit: 0.3, seed: 95, name: 'post', sign: 'ПОЧТА · ТЕЛЕГРАФ' });

    // Рыночная, южная сторона
    x = -88;
    const south = [[8, 3, M.plaster], [7, 2, M.brick], [9, 4, M.plaster2], [6, 2, M.brickD], [8, 3, M.plaster3], [7, 4, M.plaster], [9, 2, M.brick], [8, 3, M.brickD]];
    south.forEach(([w, f, mat], i) => {
      this.house({ x: x + (w as number) / 2, z: -2.2, ry: Math.PI, w: w as number, floors: f as number, wall: mat as THREE.Material, lit: 0.1 + (i % 4) * 0.07, seed: 30 + i, shop: i % 4 === 0, sign: i === 0 ? 'АПТЕКА' : undefined, roof: i % 2 ? 'flat' : 'gable' });
      x += (w as number) + 0.05;
    });

    // Береговая, западная сторона
    let z = -78;
    for (let i = 0; i < 9; i++) {
      const w = 8 + (i % 3) * 1.2;
      this.house({ x: -19.4, z: z + w / 2, ry: Math.PI / 2, w, depth: 9, floors: 2 + (i % 3), wall: W[i % 5], lit: 0.1 + (i % 4) * 0.08, seed: 50 + i, shop: i === 3, sign: i === 3 ? 'ПОРТ · АРТЕЛЬ' : undefined, roof: i % 3 === 0 ? 'flat' : 'gable' });
      z += w + 0.1;
    }

    // Набережная Заречья, восточная сторона
    z = -56;
    for (let i = 0; i < 8; i++) {
      const w = 9 + (i % 2) * 1.5;
      this.house({ x: 19.4, z: z + w / 2, ry: -Math.PI / 2, w, depth: 10, floors: 2 + (i % 2), wall: W[(i + 2) % 5], lit: 0.12 + (i % 3) * 0.1, seed: 70 + i, roof: i % 2 ? 'flat' : 'gable' });
      z += w + 0.1;
    }
    // Таверна «Якорь» на углу
    this.house({ x: 20.6, z: 9, ry: -Math.PI / 2, w: 10, depth: 9, floors: 2, wall: M.brickD, lit: 0.45, seed: 101, name: 'tavern', sign: '«ЯКОРЬ»' }, 'tavern');

    // Складская, северная сторона
    x = 24;
    for (let i = 0; i < 5; i++) {
      const w = 8 + (i % 2) * 2;
      this.house({ x: x + w / 2, z: 12.4, ry: 0, w, depth: 9, floors: 2 + (i % 2), wall: W[i % 5], lit: 0.15, seed: 110 + i, shop: i === 1, sign: i === 1 ? 'БОНДАРЬ' : undefined });
      x += w + 0.1;
    }
    // Контора Гейла
    this.house({ x: 44, z: 23.6, ry: Math.PI, w: 12, depth: 10, floors: 2, wall: M.brick, lit: 0.35, seed: 130, name: 'office', sign: 'КУРЬЕРЫ · ГЕЙЛ' }, 'office');

    // Канатная
    x = -60;
    for (let i = 0; i < 5; i++) {
      const w = 7 + (i % 2) * 1.6;
      this.house({ x: x + w / 2, z: 30.8, ry: 0, w, depth: 8, floors: 2, wall: W[(i + 3) % 5], lit: 0.15, seed: 150 + i });
      x += w + 0.1;
    }
    // дом Тихона
    this.house({ x: -38, z: 41.2, ry: Math.PI, w: 6, depth: 6, floors: 1, wall: M.plaster, lit: 0.55, seed: 171, name: 'tikhon' }, 'tikhon', 'tikhon');

    // Приют св. Лукии
    this.house({ x: 50, z: -56, ry: 0, w: 20, depth: 14, floors: 3, wall: M.plaster2, lit: 0.35, seed: 200, name: 'shelter', sign: 'ПРИЮТ СВ. ЛУКИИ' }, 'shelter');
    // часовня-колокольня приюта
    this.house({ x: 58, z: -58, ry: 0, w: 5, depth: 5, floors: 2, wall: M.brickD, lit: 0.1, seed: 201, roof: 'flat' });
    this.batch.box(M.iron, 0.12, 5.0, 0.12, mtx(58, groundH(58, -58) + 9.5, -58), 1.0);
    this.batch.box(M.brickD, 1.6, 1.2, 1.6, mtx(58, groundH(58, -58) + 7.0, -58), 1.4);

    // забор вокруг приюта
    for (let x2 = 40; x2 < 60; x2 += 1.4) {
      const y = groundH(x2, -48.4);
      this.batch.box(M.iron, 0.06, 1.8, 0.06, mtx(x2, y + 0.9, -48.4), 1);
      this.batch.box(M.stone, 0.34, 0.5, 0.34, mtx(x2, y + 0.25, -48.4), 1);
    }

    // квартал у площади: несколько домов
    const sq = [
      [-84, -52, 0, 8, 3], [-76, -53, 0, 7, 2], [-60, -52, 0, 9, 4], [-52, -44, Math.PI / 2, 8, 3],
      [-52, -33, Math.PI / 2, 7, 2], [-80, -28, 0, 9, 3], [-70, -28, 0, 8, 2],
    ];
    for (const [bx, bz, ry, w, f] of sq) {
      this.house({ x: bx, z: bz, ry, w, depth: 8, floors: f, wall: W[(Math.abs(bx) + Math.abs(bz)) % 5], lit: 0.18, seed: bx + bz });
    }

    // восточная окраина: силуэты за туманом
    for (let i = 0; i < 7; i++) {
      this.house({ x: 34 + i * 9, z: -74, ry: 0, w: 7 + (i % 3), depth: 8, floors: 2 + (i % 3), wall: W[i % 5], lit: 0.1, seed: 300 + i, facadeOnly: true });
    }
    for (let i = 0; i < 6; i++) {
      this.house({ x: 88, z: -20 + i * 12, ry: -Math.PI / 2, w: 8, depth: 9, floors: 3, wall: W[(i + 1) % 5], lit: 0.08, seed: 330 + i, facadeOnly: true });
    }
  }

  // --- башня-каланча ------------------------------------------------------
  private tower() {
    const bx = -70, bz = -58;
    const baseY = groundH(bx, bz + 5);
    const H = 27;
    this.batch.box(M.stone, 8.4, 3, 8.4, mtx(bx, baseY + 1.2, bz), 1.6);
    this.batch.box(M.brickD, 7.8, H, 7.8, mtx(bx, baseY + H / 2, bz), 1.8);
    for (let f = 1; f <= 4; f++) this.batch.box(M.cornice, 8.1, 0.18, 8.1, mtx(bx, baseY + f * 6.1, bz), 1.4);
    // часы
    const clock = canvasPlane('22:00', 2.2, 2.2, { bg: '#151310', fg: '#c9b48a', border: '#6a5434' });
    clock.position.set(bx, baseY + 22.5, bz + 3.95);
    this.scene.add(clock);
    // окна
    for (let f = 0; f < 5; f++) {
      for (const sx of [-1.9, 1.9]) {
        this.batch.box(M.lit, 0.5, 1.0, 0.06, mtx(bx + sx, baseY + 5 + f * 4.2, bz + 3.94), 1);
      }
    }
    // площадка наверху
    this.batch.box(M.stone, 8.6, 0.3, 8.6, mtx(bx, baseY + H + 0.1, bz), 1.4);
    for (const [dx, dz, w, d] of [[0, 4.2, 8.6, 0.3], [0, -4.2, 8.6, 0.3], [4.2, 0, 0.3, 8.6], [-4.2, 0, 0.3, 8.6]] as const) {
      this.batch.box(M.stone, w, 0.95, d, mtx(bx + dx, baseY + H + 0.7, bz + dz), 1.2);
    }
    // колокол и механизм
    this.prop('village_q/bell', bx + 1.8, bz - 1.4, 0.4, 1, baseY + H + 0.3);
    this.batch.box(M.iron, 1.4, 1.1, 1.2, mtx(bx - 2.2, baseY + H + 0.8, bz - 2.0), 1.2);
    // дверь внизу
    this.batch.box(M.wood, 1.4, 2.3, 0.2, mtx(bx, baseY + 1.2, bz + 4.1), 1);
    this.batch.box(M.lit2, 1.1, 0.3, 0.06, mtx(bx, baseY + 2.5, bz + 4.2), 1);
    this.addRect(bx, bz, 4.2, 4.2, 0, undefined, 27);
    for (const [dx, dz, hw, hd] of [[0, 4.2, 8.6, 0.3], [0, -4.2, 8.6, 0.3], [4.2, 0, 0.3, 8.6], [-4.2, 0, 0.3, 8.6]] as const) {
      this.rects.push({ x: bx + dx, z: bz + dz, hw, hd, ry: 0, yMin: 27 });
    }
    this.doors.push({ id: 'tower', x: bx, z: bz + 4.2, ry: 0, w: 1.4, open: false, locked: null, ru: 'Башня', en: 'Tower' });
    // люк на площадке
    this.batch.box(M.iron, 1.2, 0.14, 1.2, mtx(bx - 2.6, baseY + H + 0.35, bz + 2.6), 1);
    this.rects.push({ x: bx - 2.6, z: bz + 2.6, hw: 1.0, hd: 1.0, ry: 0 });

    // подстанция №3 у подножия
    const subY = groundH(-75.5, -57.5);
    this.batch.box(M.brickD, 6, 3.4, 5, mtx(-75.5, subY + 1.7, -57.5), 1.8);
    this.batch.box(M.stone, 6.3, 0.5, 5.3, mtx(-75.5, subY + 0.25, -57.5), 1.4);
    this.batch.box(M.wood, 1.2, 2.2, 0.16, mtx(-75.5, subY + 1.1, -54.92), 1);
    this.batch.box(M.RED, 0.4, 0.4, 0.06, mtx(-75.5, subY + 1.9, -54.9), 1);
    this.addRect(-75.5, -57.5, 3, 2.5, 0);
    this.doors.push({ id: 'tower_basement', x: -75.5, z: -54.9, ry: 0, w: 1.2, open: false, locked: null, ru: 'Подстанция', en: 'Substation' });
    this.points.push({ id: 'fuse', x: -75.5, z: -57.4, r: 2.2, ru: 'Электрощит. Красный предохранитель', en: 'Switchboard. Red fuse' });
  }

  // --- склад --------------------------------------------------------------
  private warehouse() {
    const x = 66, z = 33;
    const y = groundH(x, z + 11);
    this.batch.box(M.brickD, 32, 12, 18, mtx(x, y + 6, z), 1.8);
    this.batch.box(M.stone, 32.4, 1.4, 18.4, mtx(x, y + 0.6, z), 1.6);
    this.batch.box(M.iron, 32.2, 0.4, 18.2, mtx(x, y + 11.9, z), 1.4);
    // ворота
    this.batch.box(M.wood, 7, 5.4, 0.4, mtx(x - 6, y + 2.7, z - 9.1), 1.2);
    this.batch.box(M.dark, 0.3, 5.4, 0.3, mtx(x - 6, y + 2.7, z - 9.2), 1);
    // высокие окна
    for (let i = 0; i < 6; i++) this.batch.box(M.lit2, 1.6, 1.0, 0.1, mtx(x - 12 + i * 5, y + 8.4, z - 9.06), 1);
    // кран
    this.batch.box(M.iron, 0.5, 14, 0.5, mtx(x + 12, y + 7, z - 4), 1.2);
    this.batch.box(M.iron, 0.4, 0.4, 12, mtx(x + 12, y + 13.8, z + 1), 1.2);
    this.addRect(x, z, 16, 9, 0);
    this.points.push({ id: 'warehouse', x: x - 6, z: z - 9.4, r: 5, ru: 'Склад Харроу', en: 'Harrow warehouse' });
  }

  // --- пирсы, баржа, катер ------------------------------------------------
  private piers() {
    const deck = (x0: number, x1: number, z0: number, z1: number, y: number) => {
      const w = x1 - x0, d = z1 - z0;
      this.batch.box(M.wood, w, 0.22, d, mtx((x0 + x1) / 2, y - 0.1, (z0 + z1) / 2), 1.6);
      for (let z = z0 + 1; z < z1; z += 3) {
        for (const x of [x0 + 0.5, x1 - 0.5]) {
          this.batch.box(M.wood, 0.28, Math.abs(y - WATER_Y) + 1.2, 0.28, mtx(x, (y + WATER_Y) / 2 - 0.4, z), 1.2);
        }
      }
    };
    deck(-45, -39, 56, 68, 0.7);
    deck(-12, -6, 58, 70, 0.7);
    // сходня к барже
    this.batch.box(M.wood, 1.4, 0.14, 5.5, mtx(-7.4, 0.8, 61.5), 1.2);
    // баржа
    this.batch.box(M.iron, 6, 1.6, 8, mtx(-5, 0.15, 64), 1.6);
    this.batch.box(M.wood, 5.8, 0.16, 7.8, mtx(-5, 0.98, 64), 1.6);
    this.batch.box(M.wood, 2.6, 2.4, 3, mtx(-4, 2.2, 66.4), 1.2);
    this.batch.box(M.wood, 0.06, 0.06, 2.6, mtx(-6.5, 1.2, 64), 1);
    this.points.push({ id: 'hatch', x: -4.2, z: 63.2, r: 2.4, ru: 'Люк в трюм', en: 'Hold hatch' });
    // катер
    this.batch.box(M.iron, 4, 1.2, 5, mtx(-40, 0.35, 64), 1.2);
    this.batch.box(M.wood, 3.8, 0.14, 4.8, mtx(-40, 1.0, 64), 1.4);
    this.batch.box(M.wood, 2.4, 1.8, 2.2, mtx(-40, 1.9, 65.2), 1.2);
    this.points.push({ id: 'helm', x: -40, z: 64.6, r: 2.6, ru: 'Штурвал', en: 'Wheel' });
  }

  // --- лампа --------------------------------------------------------------
  private lamp(x: number, z: number) {
    const y0 = groundH(x, z);
    this.batch.box(M.iron, 0.1, 3.6, 0.1, mtx(x, y0 + 1.8, z), 1);
    this.batch.box(M.iron, 0.2, 0.14, 0.2, mtx(x, y0 + 0.08, z), 1);
    this.batch.box(M.iron, 0.34, 0.4, 0.34, mtx(x, y0 + 3.9, z), 1);
    this.batch.box(M.lit, 0.22, 0.26, 0.22, mtx(x, y0 + 3.72, z), 1);
    this.batch.box(M.iron, 0.46, 0.12, 0.46, mtx(x, y0 + 4.16, z), 1);
    this.rs.registerLamp(x, y0 + 3.7, z);
  }

  private streetLamps() {
    // Рыночная
    for (let x = -86; x < -12; x += 11) this.lamp(x, -12.2);
    // Береговая
    for (let z = -70; z < 56; z += 12) this.lamp(-17.0, z);
    // Набережная
    for (let z = -52; z < 38; z += 12) this.lamp(17.0, z);
    // Складская
    for (let x = 16; x < 86; x += 12) this.lamp(x, 13.8);
    // Канатная
    for (let x = -58; x < -18; x += 12) this.lamp(x, 32.0);
    // площадь
    for (const [x, z] of [[-80, -46], [-56, -46], [-80, -33], [-56, -33]] as const) this.lamp(x, z);
    // переулок
    this.lamp(-48, -37.6);
    // приют
    this.lamp(42, -50);
    this.lamp(58, -50);
  }

  // --- мелочь и обстановка ------------------------------------------------
  private streetDressing() {
    // бочки и ящики у таверны
    const clutter: [string, number, number, number, number][] = [
      ['hex_props/barrel', 23.4, 12.8, 0.3, 1.3], ['hex_props/barrel', 24.2, 12.9, 1.2, 1.2],
      ['hex_props/crate_a_big', 22.4, 13.4, 0.2, 1.0], ['village_q/bench_1', 18.4, 13.2, -1.2, 1],
      ['dungeon/barrel_large', 47, 12.2, 0.4, 1.1], ['dungeon/keg', 48.4, 12.4, 0.9, 1.0],
      ['hex_props/crate_a_small', 46.2, 12.6, 0.3, 1.0], ['village_q/cart', -32, -10.8, 1.22, 1.0],
      ['village_q/barrel', -44, -4.2, 0.2, 1.1], ['village_q/barrel', -43.2, -4.4, 1.0, 1.0],
      ['hex_props/crate_b_big', -44.6, -3.2, 0.2, 1.0], ['dungeon/chest', -70.6, -54.6, 0.2, 1.0],
      ['interior_q/bench_1', -64, -42, 1.2, 1.0], ['interior_q/bench_1', -72, -33, -1.4, 1.0],
      ['village_q/barrel', 52, 20.4, 0.4, 1.2], ['hex_props/crate_a_big', 54, 21.2, 0.9, 1.1],
      ['hex_props/crate_a_small', 56, 20.6, 0.2, 1.0], ['village_q/hay', -40, 44.2, 0.4, 1.0],
      ['village_q/rock_1', -22, 44, 0.2, 0.3], ['village_q/rock_2', 30, -34, 0.4, 0.35],
      ['village_q/rock_3', 14.6, 6, 0.4, 0.4], ['village_q/hay', 44, -50.6, 0.1, 1.2],
    ];
    clutter.forEach(([p, x, z, ry, s]) => this.prop(p, x, z, ry, s));

    // кошка на подоконнике и собака у пирса
    this.prop('characters/animal_cat', 17.8, 8.2, 1.2, 1.0);
    this.prop('characters/animal_pug', -12.4, 62.4, -1.0, 1.4);

    // бельё на Канатной
    for (let i = 0; i < 9; i++) {
      const x = -52 + i * 3.4, z = 38.4;
      const y = groundH(x, z) + 4.6;
      if (i === 0) this.batch.box(M.iron, 1.6, 0.04, 0.04, mtx(x - 0.8, y, z), 1);
      this.batch.box(M.cloth, 0.7, 1.0 + (i % 3) * 0.2, 0.02, mtx(x, y - 0.55, z + 0.1), 1);
    }
    // провода у почты
    for (let i = 0; i < 4; i++) {
      this.batch.box(M.iron, 0.03, 0.03, 24, mtx(-26 + i * 1.2, groundH(-24, -12) + 7.2 - i * 0.15, -14), 1);
    }
    // афиши
    const poster = canvasPlane('ВЕЧЕР\nВ «ЯКОРЕ»', 1.1, 1.5, { bg: '#2a241c', fg: '#cbb98f', border: '#6d5b3c' });
    poster.position.set(20.0, groundH(20, 5) + 1.8, 4.9);
    poster.rotation.y = -Math.PI / 2;
    this.scene.add(poster);

    // камни и мелочь на земле
    for (let i = 0; i < 26; i++) {
      const x = -86 + ((i * 47) % 168);
      const z = -80 + ((i * 61) % 140);
      if (isWater(x, z)) continue;
      this.prop(i % 3 === 0 ? 'village_q/rock_1' : i % 3 === 1 ? 'village_q/rock_2' : 'village_q/rock_3', x, z, i, 0.12 + (i % 5) * 0.02);
    }
  }

  // --- интерьеры ----------------------------------------------------------
  private interiorsFurniture() {
    // Орвен: прилавок, стеллаж, станок
    let p = this.local('orven', 0, -1.2);
    this.batch.box(M.wood, 4.6, 1.0, 0.9, mtx(p.x, groundH(p.x, p.z) + 0.5, p.z), 1.2);
    this.prop('interior_q/shelf_large', this.local('orven', -1.6, -2.0).x, this.local('orven', -1.6, -2.0).z, 0.45, 1);
    this.prop('interior_q/light_desk', this.local('orven', 1.0, -1.8).x, this.local('orven', 1.0, -1.8).z, 0.45, 1);
    this.addFurnitureRect('orven', 0, -1.2, 2.3, 0.5);

    // Фома: прилавок с решёткой, полки, половица
    p = this.local('foma', 0, -1.0);
    this.batch.box(M.wood, 5.8, 1.05, 1.0, mtx(p.x, groundH(p.x, p.z) + 0.52, p.z), 1.2);
    for (let i = 0; i < 5; i++) this.batch.box(M.iron, 0.03, 1.0, 0.03, mtx(p.x - 2.6 + i * 1.3, groundH(p.x, p.z) + 1.75, p.z), 1);
    this.prop('interior_q/shelf_2', this.local('foma', -2.0, -3.2).x, this.local('foma', -2.0, -3.2).z, 0, 1);
    this.prop('interior_q/shelf_large', this.local('foma', 2.0, -3.2).x, this.local('foma', 2.0, -3.2).z, 0, 1);
    this.prop('dungeon/chest', this.local('foma', 1.6, -4.0).x, this.local('foma', 1.6, -4.0).z, 0, 1);
    const fl = this.local('foma', -1.0, -3.6);
    this.batch.box(M.wood, 1.1, 0.06, 1.5, mtx(fl.x, 0.02 + this.interiors.foma.floorY - 0.05, fl.z), 1);
    this.points.push({ id: 'foma_floor', x: fl.x, z: fl.z, r: 1.5, ru: 'Сорванная половица', en: 'Torn floorboard' });

    // Таверна
    p = this.local('tavern', 0, 2.8);
    this.batch.box(M.wood, 6.4, 1.05, 0.8, mtx(p.x, groundH(p.x, p.z) + 0.55, p.z), 1.2);
    this.prop('tavern_kitchen/kitchencounter_straight_a', this.local('tavern', -2.0, 2.9).x, this.local('tavern', -2.0, 2.9).z, 0, 1);
    const table = this.local('tavern', 0.4, -0.8);
    this.prop('interior_q/table_roundlarge', table.x, table.z, 0.2, 1.0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const c = this.local('tavern', 0.4 + Math.cos(a) * 1.15, -0.8 + Math.sin(a) * 1.15);
      this.prop('dungeon/chair', c.x, c.z, a, 1.0);
    }
    this.prop('interior_q/fireplace', this.local('tavern', -3.4, -3.5).x, this.local('tavern', -3.4, -3.5).z, 0, 1.1);
    this.prop('interior_q/light_chandelier', this.local('tavern', 0, -0.6).x, this.local('tavern', 0, -0.6).z, 0, 1, this.interiors.tavern.floorY + 2.6);
    // «комната наверху» — задняя комната с пальто
    this.batch.box(M.wood, 2.2, 1.6, 0.4, mtx(this.local('tavern', 2.6, -4.1).x, this.interiors.tavern.floorY + 0.8, this.local('tavern', 2.6, -4.1).z), 1);
    this.points.push({ id: 'coat', x: this.local('tavern', 2.6, -4.0).x, z: this.local('tavern', 2.6, -4.0).z, r: 1.8, ru: 'Пальто с монограммой «В.Х.»', en: 'Coat monogrammed “V.H.”' });
    this.addFurnitureRect('tavern', 0, 2.8, 3.2, 0.4);
    this.addFurnitureRect('tavern', 0.4, -0.8, 1.1, 1.1);

    // Контора: стол, сейф, шкаф
    const desk = this.local('office', -1.0, -1.6);
    this.prop('interior_q/table_roundlarge', desk.x, desk.z, 0, 1.0);
    this.prop('interior_q/shelf_1', this.local('office', -3.4, -2.6).x, this.local('office', -3.4, -2.6).z, 0, 1);
    const safe = this.local('office', 3.1, -3.0);
    this.batch.box(M.iron, 1.4, 1.5, 1.2, mtx(safe.x, groundH(safe.x, safe.z) + 0.78, safe.z), 1);
    const safeDoor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.9), M.iron);
    safeDoor.position.set(safe.x, groundH(safe.x, safe.z) + 0.8, safe.z + 0.62);
    this.scene.add(safeDoor);
    this.points.push({ id: 'safe', x: safe.x, z: safe.z, r: 2.2, ru: 'Сейф Гейла', en: "Gale's safe" });
    this.addFurnitureRect('office', 3.1, -3.0, 0.8, 0.7);

    // Приют: койки, стол, книга
    for (let i = 0; i < 5; i++) {
      const c = this.local('shelter', -5.5 + i * 2.6, -3.6);
      this.prop('interior_q/bed_bunk', c.x, c.z, this.interiors.shelter.ry, 1);
      this.addFurnitureRect('shelter', -5.5 + i * 2.6, -3.6, 0.8, 1.9);
    }
    const deskA = this.local('shelter', 1.0, -1.4);
    this.prop('interior_q/table_roundlarge', deskA.x, deskA.z, 0, 1.1);
    this.batch.box(M.paper, 0.7, 0.08, 0.5, mtx(deskA.x, groundH(deskA.x, deskA.z) + 0.95, deskA.z), 1);
    this.points.push({ id: 'book', x: deskA.x, z: deskA.z, r: 1.6, ru: 'Книга записей', en: 'Registry book' });
    this.points.push({ id: 'window', x: 55.4, z: -57, r: 1.6, ru: 'Окно прачечной', en: 'Laundry window' });

    // Дом Тихона
    this.prop('interior_q/bed_single', this.local('tikhon', -1.2, -1.4).x, this.local('tikhon', -1.2, -1.4).z, this.interiors.tikhon.ry, 1);
    this.prop('interior_q/table_roundsmall', this.local('tikhon', 1.2, -1.2).x, this.local('tikhon', 1.2, -1.2).z, 0, 1);
    this.addFurnitureRect('tikhon', -1.2, -1.4, 0.7, 1.2);

    // Подстанция: щит
    const box = this.local('tower_basement', 0, -1.2);
    this.batch.box(M.iron, 2.6, 1.6, 0.35, mtx(box.x, groundH(box.x, box.z) + 1.2, box.z), 1);
    this.batch.box(M.RED, 0.18, 0.42, 0.12, mtx(box.x + 0.9, groundH(box.x, box.z) + 1.3, box.z + 0.25), 1);
    this.prop('dungeon/chest', this.local('tower_basement', -1.8, -1.2).x, this.local('tower_basement', -1.8, -1.2).z, 0, 1);

    // Баржа: нары в трюме
    for (let i = 0; i < 3; i++) {
      this.prop('interior_q/bed_bunk', -6.2 + i * 1.0, 63.0, 0, 0.9, 1.02);
    }
    // Катер: штурвал
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 20), M.wood);
    wheel.position.set(-40, 1.9, 64.9);
    wheel.rotation.x = Math.PI / 2.4;
    this.scene.add(wheel);
  }

  private addFurnitureRect(place: string, lx: number, lz: number, hw: number, hd: number) {
    const it = this.interiors[place];
    if (!it) return;
    const c = Math.cos(it.ry), s = Math.sin(it.ry);
    this.rects.push({
      x: it.cx + lx * c + lz * s,
      z: it.cz - lx * s + lz * c,
      hw, hd, ry: it.ry,
    });
  }

  // --- предметы -----------------------------------------------------------
  private worldItems() {
    const add = (id: string, item: ItemId, place: string, lx: number, lz: number, ru: string, en: string, y = 0.95) => {
      const p = this.local(place, lx, lz);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.24), item === 'key' ? RED() : M.iron);
      mesh.position.set(p.x, groundH(p.x, p.z) + y, p.z);
      mesh.rotation.y = 0.4;
      this.scene.add(mesh);
      this.items.push({ id, item, x: p.x, z: p.z, y: groundH(p.x, p.z) + y, ru, en, mesh });
    };
    add('key', 'key', 'tavern', 0.9, -0.8, 'Ключ на столе', 'Key on the table', 0.95);
    add('jeton', 'jeton', 'tavern', 0.1, -0.6, 'Жетон №17', 'Tag No.17', 0.95);
    add('gun', 'revolver' as ItemId, 'foma', -1.0, -3.6, 'Револьвер под половицей', 'Revolver under the floorboard', 0.25);
  }

  private usePoints() {
    this.points.push({ id: 'hatch_roof', x: -72.6, z: -55.4, r: 2.2, ru: 'Люк вниз', en: 'Hatch down' });
    this.points.push({ id: 'wagon_pin', x: 46.6, z: -50.4, r: 2.4, ru: 'Чека на оси повозки', en: 'Wagon axle pin' });
    this.points.push({ id: 'pier3', x: -42, z: 58.5, r: 6, ru: 'Пристань №3', en: 'Pier 3' });
    this.points.push({ id: 'pier7', x: -9, z: 61, r: 6, ru: 'Пирс 7', en: 'Pier 7' });
    this.points.push({ id: 'shelter_gate', x: 50, z: -48.6, r: 4, ru: 'Ворота приюта', en: 'Shelter gate' });
  }

  // --- огонь --------------------------------------------------------------
  private makeFire(x: number, z: number, s = 1, id = 'fire') {
    const group = new THREE.Group();
    const base = groundH(x, z);
    for (let i = 0; i < 7; i++) {
      const h = 1.4 + (i % 3) * 0.7;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.35 * s, h, 7), M.fire);
      m.position.set((i - 3) * 0.7 * s, h / 2, ((i * 7) % 5 - 2) * 0.3 * s);
      group.add(m);
    }
    const light = new THREE.PointLight(0xff7a22, 8 * s, 26, 1.5);
    light.position.set(0, 2.2, 0);
    group.add(light);
    const smoke: THREE.Sprite[] = [];
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, opacity: 0.35, depthWrite: false }));
      sp.scale.setScalar(4 + i);
      sp.position.set((i - 3) * 1.1, 3 + i * 2.2, 0);
      group.add(sp);
      smoke.push(sp);
    }
    group.position.set(x, base, z);
    group.visible = false;
    this.scene.add(group);
    this.fires.push({ id, group, light, smoke });
  }

  private createFires() {
    this.makeFire(62, 26, 2.4, 'warehouse');
    this.makeFire(-40, -13, 1.6, 'market');
    this.makeFire(-34, 37, 1.4, 'kanat');
  }

  // --- запросы из игры ----------------------------------------------------
  groundAt(x: number, z: number) {
    return groundH(x, z);
  }

  collides(x: number, z: number, r = 0.34, feetY?: number): boolean {
    if (x < MAP.x0 + 2 || x > MAP.x1 - 2 || z < MAP.z0 + 2 || z > MAP.z1 - 2) return true;
    const y = feetY ?? groundH(x, z);
    if (isWater(x, z) && zoneAt(x, z) === null && !onBridge(x, z)) return true;
    for (const q of this.rects) {
      if (q.yMin !== undefined && y < q.yMin) continue;
      if (q.yMax !== undefined && y > q.yMax) continue;
      if (this.hitRect(q, x, z, r)) return true;
    }
    for (const d of this.doors) {
      if (d.open) continue;
      if (this.hitRect({ x: d.x, z: d.z, hw: d.w / 2, hd: 0.3, ry: d.ry }, x, z, r)) return true;
    }
    return false;
  }

  private hitRect(q: Rect, x: number, z: number, r: number) {
    const dx = x - q.x, dz = z - q.z;
    const c = Math.cos(q.ry), s = Math.sin(q.ry);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const nx = Math.max(-q.hw, Math.min(q.hw, lx));
    const nz = Math.max(-q.hd, Math.min(q.hd, lz));
    return (lx - nx) ** 2 + (lz - nz) ** 2 < r * r;
  }

  /** Выталкивание из стен: двигаем позицию наружу по кратчайшей оси. */
  resolve(x: number, z: number, r = 0.34, feetY?: number): [number, number] {
    const y = feetY ?? groundH(x, z);
    for (const q of this.rects) {
      if (q.yMin !== undefined && y < q.yMin) continue;
      if (q.yMax !== undefined && y > q.yMax) continue;
      const dx = x - q.x, dz = z - q.z;
      const c = Math.cos(q.ry), s = Math.sin(q.ry);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) > q.hw + r || Math.abs(lz) > q.hd + r) continue;
      const nx = Math.max(-q.hw, Math.min(q.hw, lx));
      const nz = Math.max(-q.hd, Math.min(q.hd, lz));
      const ddx = lx - nx, ddz = lz - nz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 > r * r) continue;
      let ox = 0, oz = 0;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        ox = (ddx / d) * (r - d);
        oz = (ddz / d) * (r - d);
      } else {
        const px = q.hw - Math.abs(lx), pz = q.hd - Math.abs(lz);
        if (px < pz) ox = Math.sign(lx || 1) * (px + r);
        else oz = Math.sign(lz || 1) * (pz + r);
      }
      x += ox * c + oz * s;
      z += -ox * s + oz * c;
    }
    return [x, z];
  }

  nearestUse(x: number, z: number, r = 2.2): UsePoint | null {
    let best: UsePoint | null = null;
    let bd = r * r;
    for (const p of this.points) {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd && d < p.r * p.r) { bd = d; best = p; }
    }
    return best;
  }

  nearestDoor(x: number, z: number, r = 2.2): Door | null {
    let best: Door | null = null;
    let bd = r * r;
    for (const d of this.doors) {
      const dd = (d.x - x) ** 2 + (d.z - z) ** 2;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  nearestItem(x: number, z: number, r = 1.8): WorldItem | null {
    let best: WorldItem | null = null;
    let bd = r * r;
    for (const it of this.items) {
      if (it.taken) continue;
      const d = (it.x - x) ** 2 + (it.z - z) ** 2;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  update(sim: Sim, time: number) {
    const minute = sim.t / 60;
    for (const f of this.fires) {
      let on = false;
      if (f.id === 'warehouse') on = minute >= 12;
      if (f.id === 'market') on = minute >= 30 && sim.flags.tapCut === undefined;
      if (f.id === 'kanat') on = minute >= 45 && sim.flags.tapCut === undefined;
      f.group.visible = on;
      if (on) {
        f.light.intensity = 7 + Math.sin(time * 9 + f.group.position.x) * 2.5;
        for (let i = 0; i < f.smoke.length; i++) {
          const sp = f.smoke[i];
          sp.position.y += 0.4 / 60;
          if (sp.position.y > 18) sp.position.y = 3;
          sp.material.opacity = 0.22 + 0.1 * Math.sin(time + i);
        }
      }
    }
    // выгоревшая лавка Фомы: дверь открыта после пожара
    const fomaDoor = this.doors.find((d) => d.id === 'foma');
    if (fomaDoor && minute >= 30 && sim.flags.tapCut === undefined) fomaDoor.open = true;
    // пальто и предметы исчезают, если взяты
    for (const it of this.items) {
      if (it.mesh) it.mesh.visible = !it.taken;
    }
  }
}
