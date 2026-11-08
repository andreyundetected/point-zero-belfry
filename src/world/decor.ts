import * as THREE from 'three';
import { M } from '../render/materials';
import { ROADS } from './layout';
import { groundH, hash, surfaceAt, walkY } from './terrain';
import { placed } from './city';
import { world } from './colliders';
import { PropField } from './props';

// density rules (spec 3.6): puddles in ruts and gutters, rubbish at walls, telegraph poles + wires, posters, laundry, rails
export function buildDecor(scene: THREE.Scene, props: PropField) {
  // ---- puddles (instanced discs) only on road surface, along the curb and the ruts
  const pud = new THREE.MeshPhysicalMaterial({ color: 0x020306, roughness: 0.02, clearcoat: 1, envMapIntensity: 1.6, transparent: true, opacity: 0.88 });
  const spots: [number, number, number][] = [];
  for (const r of ROADS) for (let k = 0; k < r.pts.length - 1; k++) {
    const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1], len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
    for (let t = 2; t < len - 1; t += 5 + hash(t, k) * 5) { const side = hash(t, 7) < 0.5 ? -1 : 1, off = (r.w / 2 - 0.5) * side * (0.6 + 0.4 * hash(t, 9)); const x = ax + dx * t - dz * off, z = az + dz * t + dx * off; if (surfaceAt(x, z) === 'road') spots.push([x, z, 0.5 + hash(x, z) * 1.1]); }
  }
  const im = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20), pud, spots.length); const m4 = new THREE.Matrix4();
  spots.forEach(([x, z, s], i) => { m4.compose(new THREE.Vector3(x, groundH(x, z) + 0.014, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, hash(x, 3) * 3)), new THREE.Vector3(s, s * (0.5 + hash(z, 1) * 0.4), 1)); im.setMatrixAt(i, m4); }); scene.add(im);
  // ---- rubbish: crumpled newspapers and leaves against the walls (clusters, not mid-street)
  const papers: [number, number, number][] = [];
  for (const b of placed) { if (b.id === 'blk') continue; for (let i = 0; i < 3; i++) { const lx = (hash(b.x, i) - 0.5) * b.w, c = Math.cos(b.ry), s = Math.sin(b.ry); const x = b.x + lx * c + 0.5 * s + (hash(i, 4) - 0.5) * 0.8, z = b.z - lx * s + 0.5 * c; if (hash(b.x + i, b.z) < 0.55 && surfaceAt(x, z) !== 'water') papers.push([x, z, hash(x, z) * 6]); } }
  const pm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 0.2), new THREE.MeshStandardMaterial({ color: 0x8a867a, roughness: 1, side: THREE.DoubleSide }), papers.length);
  papers.forEach(([x, z, r], i) => { m4.compose(new THREE.Vector3(x, groundH(x, z) + 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + (hash(x, 1) - 0.5) * 0.3, 0, r)), new THREE.Vector3(1, 1, 1)); pm.setMatrixAt(i, m4); }); scene.add(pm);
  // ---- tram rails on Rynochnaya
  for (const rz of [-10.0, -8.7]) { const g = new THREE.BoxGeometry(70, 0.04, 0.07); const m = new THREE.Mesh(g, M.iron); m.position.set(-52, groundH(-52, rz) - 0.005, rz); scene.add(m); }
  // ---- telegraph poles with sagging wires along Rynochnaya and Beregovaya
  const poles: THREE.Vector3[] = [];
  const addPole = (x: number, z: number) => { const y = groundH(x, z); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 8, 8), M.wood); m.position.set(x, y + 4, z); m.castShadow = true; scene.add(m); const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), M.wood); arm.position.set(x, y + 7.4, z); scene.add(arm); world.add(x, z, 0.15, 0.15, 0, y, y + 8, 'solid'); poles.push(new THREE.Vector3(x, y + 7.4, z)); };
  for (let x = -86; x <= -16; x += 18) addPole(x, -5.6);
  for (let z = -76; z <= 52; z += 18) addPole(-9.6, z);
  const wire = new THREE.LineBasicMaterial({ color: 0x15171a });
  const link = (a: THREE.Vector3, b: THREE.Vector3) => { for (const off of [-0.6, 0, 0.6]) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 12; i++) { const t = i / 12, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.9; if (Math.abs(b.x - a.x) > Math.abs(b.z - a.z)) p.z += off; else p.x += off; pts.push(p); } scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire)); } };
  const west = poles.filter(p => Math.abs(p.z + 5.6) < 0.1).sort((a, b) => a.x - b.x), shore = poles.filter(p => Math.abs(p.x + 9.6) < 0.1).sort((a, b) => a.z - b.z);
  for (let i = 0; i < west.length - 1; i++) link(west[i], west[i + 1]); for (let i = 0; i < shore.length - 1; i++) link(shore[i], shore[i + 1]);
  // ---- poster columns (Tower square and by the bridge)
  const poster = (text: string, sub: string) => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d')!; g.fillStyle = '#b9b1a0'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#1b1814'; g.font = 'bold 30px serif'; g.textAlign = 'center'; g.fillText(text, 128, 100); g.font = '20px serif'; g.fillText(sub, 128, 150); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); };
  const col = (x: number, z: number, mat: THREE.Material) => { const y = groundH(x, z); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 16), mat); m.position.set(x, y + 1.3, z); m.castShadow = true; scene.add(m); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.15, 16), M.iron); cap.position.set(x, y + 2.65, z); scene.add(cap); world.add(x, z, 0.55, 0.55, 0, y, y + 2.7, 'solid'); };
  col(-74, -44, poster('ПРАЗДНИК УРОЖАЯ', '14 октября')); col(11.5, 4.2, poster('ТРЕБУЮТСЯ ГРУЗЧИКИ', 'Склад №2, смена Гейла'));
  col(-60, -44, poster('ПОПЕЧИТЕЛЬСКИЙ СОВЕТ', 'Детям города · Э. Крайн'));
  // ---- laundry over Kanatnaya and the orphanage yard
  const cloth = [0xd8d4cc, 0x8a8f96, 0xb8aa94, 0xcfc6ac];
  const line = (ax: number, az: number, bx: number, bz: number, y: number) => { const n = 6; const pts: THREE.Vector3[] = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3(ax + (bx - ax) * t, y - Math.sin(t * Math.PI) * 0.35, az + (bz - az) * t)); } scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, p = new THREE.Vector3(ax + (bx - ax) * t, y - Math.sin(t * Math.PI) * 0.35 - 0.35, az + (bz - az) * t); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6 + hash(i, ax) * 0.5, 0.7 + hash(i, az) * 0.5), new THREE.MeshStandardMaterial({ color: cloth[i % 4], side: THREE.DoubleSide, roughness: 1 })); m.position.copy(p); m.rotation.y = Math.atan2(bx - ax, bz - az) + Math.PI / 2; m.castShadow = true; scene.add(m); } };
  for (const x of [-56, -44, -30]) line(x, 32.4, x + 2, 39.6, groundH(x, 36) + 5.2);
  line(40, -62, 60, -61, groundH(50, -58) + 5.0); line(40, -58, 60, -57, groundH(50, -58) + 4.6);
  // ---- life: a pug at pier 7, a cat on the tavern step
  props.add('characters/animal_pug', -12.5, 56.2, { h: 0.6, ry: 1.2 }); props.add('characters/animal_cat', 19.2, 13.6, { h: 0.35, ry: -1.4, y: groundH(19.2, 13.6) + 0.15 });
  // ---- far shore across the harbour: dotted lights, a lighthouse with a sweeping beam (Mayak island, spec 4)
  const halo = new THREE.TextureLoader().load('/textures/procedural/lamp_halo.png');
  for (let i = 0; i < 46; i++) { const x = -160 + i * 7 + hash(i, 1) * 6, z = 150 + hash(i, 2) * 50; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: hash(i, 3) < 0.3 ? 0xffb070 : 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 + hash(i, 4) * 0.4, fog: false })); sp.scale.setScalar(2 + hash(i, 5) * 3); sp.position.set(x, 3 + hash(i, 6) * 6, z); scene.add(sp); }
  const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xfff4d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false })); beam.scale.setScalar(14); beam.position.set(70, 16, 240); scene.add(beam);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 16, 10), new THREE.MeshStandardMaterial({ color: 0x1a1c1e })); tower.position.set(70, 8, 240); scene.add(tower);
  (scene as any).__beam = beam;
  void walkY;
}
