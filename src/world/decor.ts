import * as THREE from 'three';
import { M } from '../render/materials';
import { ROADS, QUAY_Z, WATER_Y, CANAL_WATER_Y, BARGE } from './layout';
import { Batcher, mtx } from './batch';
import { groundH, hash, surfaceAt, walkY } from './terrain';
import { placed } from './city';
import { world } from './colliders';
import { PropField } from './props';
import { puddleRipples } from '../render/weatherfx';

// density rules (spec 3.6): puddles in ruts and gutters, rubbish at walls, telegraph poles + wires, posters, laundry, rails
export function buildDecor(scene: THREE.Scene, props: PropField) {
  // ---- puddles (instanced discs) only on road surface, along the curb and the ruts
  const pud = new THREE.MeshPhysicalMaterial({ color: 0x020306, roughness: 0.02, clearcoat: 1, envMapIntensity: 1.6, transparent: true, opacity: 0.88 }); (scene as any).__puddleTick = puddleRipples(pud);
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
  // ---- advertising columns (Morris-style): cast-iron body, domed cap, layered half-torn bills in period type
  const posterTex = (bills: [string, string][], seed: number) => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d')!; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
    const draw = () => { g.fillStyle = '#6d695e'; g.fillRect(0, 0, 1024, 256);
      bills.forEach(([title, sub], i) => { const x = 20 + i * (1000 / bills.length), w = 1000 / bills.length - 14, y = 12 + hash(i, seed) * 14, h = 220 - hash(seed, i) * 24; g.save(); g.translate(x + w / 2, y + h / 2); g.rotate((hash(i, seed + 3) - 0.5) * 0.05);
        g.fillStyle = ['#cfc7b0', '#bdb59d', '#d6d0bf', '#b2ab98'][(i + seed) % 4]; g.beginPath(); g.moveTo(-w / 2, -h / 2); for (let k = 0; k <= 10; k++) g.lineTo(-w / 2 + k * w / 10, -h / 2 + hash(k, i + seed) * 7); for (let k = 0; k <= 10; k++) g.lineTo(w / 2 - hash(k, i) * 5, -h / 2 + k * h / 10); g.lineTo(w / 2, h / 2); g.lineTo(-w / 2 + hash(i, 9) * 14, h / 2 - hash(i, 8) * 12); g.lineTo(-w / 2, h / 2); g.closePath(); g.fill();
        g.strokeStyle = '#2a2620'; g.lineWidth = 3; g.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24); g.fillStyle = '#1b1814'; g.textAlign = 'center'; const fam = '"OldStd", Georgia, serif';
        const words = title.split(' '); const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [title]; g.font = `bold ${Math.min(34, w / 9)}px ${fam}`; lines.forEach((ln, k) => g.fillText(ln, 0, -h * 0.18 + k * 36));
        g.font = `italic ${Math.min(22, w / 14)}px ${fam}`; g.fillText(sub, 0, h * 0.28);
        for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(40,34,26,${0.05 + hash(k, i) * 0.08})`; g.beginPath(); g.ellipse((hash(k, i + 1) - 0.5) * w, (hash(i, k + 2) - 0.5) * h, 10 + hash(k, 5) * 30, 6 + hash(5, k) * 20, 0, 0, 7); g.fill(); } g.restore(); });
      for (let k = 0; k < 120; k++) { g.fillStyle = `rgba(20,18,14,${hash(k, seed) * 0.08})`; g.fillRect(hash(k, 2) * 1024, hash(2, k) * 256, 2 + hash(k, 4) * 14, 1); } tex.needsUpdate = true; };
    draw(); try { (document as any).fonts.load('700 30px OldStd').then(draw); } catch { /* font optional */ } return tex; };
  const col = (x: number, z: number, bills: [string, string][], seed: number) => { const y = groundH(x, z); const iron = new THREE.MeshStandardMaterial({ color: 0x243028, roughness: 0.5, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.4, 20), iron); body.position.set(x, y + 0.2, z); scene.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 1.7, 24, 1, true), new THREE.MeshStandardMaterial({ map: posterTex(bills, seed), roughness: 0.95, side: THREE.DoubleSide })); band.position.set(x, y + 1.25, z); band.castShadow = true; scene.add(band);
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 20), iron); mid.position.set(x, y + 2.15, z); scene.add(mid);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), iron); dome.position.set(x, y + 2.2, z); dome.scale.y = 0.7; dome.castShadow = true; scene.add(dome);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8), iron); fin.position.set(x, y + 2.8, z); scene.add(fin); world.add(x, z, 0.62, 0.62, 0, y, y + 2.9, 'solid'); };
  col(-74, -44, [['ПРАЗДНИК УРОЖАЯ', '14 октября · ратуша'], ['ГАСТРОЛИ', 'варьете «Лира»'], ['ПОПЕЧИТЕЛЬСКИЙ СОВЕТ', 'детям города']], 1);
  col(11.5, 4.2, [['ТРЕБУЮТСЯ ГРУЗЧИКИ', 'порт · смена Гейла'], ['РОЗЫСК', 'вознаграждение'], ['КАНАТНАЯ ФАБРИКА', 'набор рабочих']], 2);
  col(-60, -44, [['ПОПЕЧИТЕЛЬСКИЙ СОВЕТ', 'Детям города · Э. Крайн'], ['ЗАЙМЫ', 'под залог · Фома'], ['ТРАМВАЙ', 'расписание']], 3);
  // ---- laundry over Kanatnaya and the orphanage yard
  const cloth = [0xd8d4cc, 0x8a8f96, 0xb8aa94, 0xcfc6ac];
  const line = (ax: number, az: number, bx: number, bz: number, y: number) => { const n = 6; const pts: THREE.Vector3[] = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3(ax + (bx - ax) * t, y - Math.sin(t * Math.PI) * 0.35, az + (bz - az) * t)); } scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, p = new THREE.Vector3(ax + (bx - ax) * t, y - Math.sin(t * Math.PI) * 0.35 - 0.35, az + (bz - az) * t); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6 + hash(i, ax) * 0.5, 0.7 + hash(i, az) * 0.5), new THREE.MeshStandardMaterial({ color: cloth[i % 4], side: THREE.DoubleSide, roughness: 1 })); m.position.copy(p); m.rotation.y = Math.atan2(bx - ax, bz - az) + Math.PI / 2; m.castShadow = true; scene.add(m); } };
  for (const x of [-56, -44, -30]) line(x, 32.4, x + 2, 39.6, groundH(x, 36) + 5.2);
  line(40, -62, 60, -61, groundH(50, -58) + 5.0); line(40, -58, 60, -57, groundH(50, -58) + 4.6);
  // ---- the harbour front: cast-iron bollards with sagging chains along both quays, boats moored below, a rowboat tied up at the canal stairs
  { const bb = new Batcher(); const chain: number[] = []; const posts: [number, number][] = [];
    for (const [x0, x1] of [[-90, -16], [16, 90]] as [number, number][]) for (let x = x0; x <= x1; x += 4.5) { if (Math.abs(x + 42) < 2.5 || Math.abs(x + 9.5) < 3.5) continue; posts.push([x, QUAY_Z - 0.55]); }
    for (const [x, z] of posts) { const y = groundH(x, z); bb.box(M.iron, 0.24, 0.75, 0.24, mtx(x, y + 0.375, z, 0), 1); const cap = new THREE.SphereGeometry(0.15, 8, 6); cap.translate(x, y + 0.8, z); bb.geo(M.iron, cap); world.add(x, z, 0.13, 0.13, 0, y, y + 0.9, 'solid'); }
    for (let i = 0; i < posts.length - 1; i++) { const [ax, az] = posts[i], [bx, bz] = posts[i + 1]; if (bx - ax > 5) continue; const ay = groundH(ax, az) + 0.75, by = groundH(bx, bz) + 0.75; for (let k = 0; k < 10; k++) { const t0 = k / 10, t1 = (k + 1) / 10; chain.push(ax + (bx - ax) * t0, ay - Math.sin(t0 * Math.PI) * 0.3, az, ax + (bx - ax) * t1, by - Math.sin(t1 * Math.PI) * 0.3, bz); } }
    bb.flush(scene); const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(chain, 3)); scene.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x202224 })));
    const boats: [string, number, number, number, number][] = [['boats/boat_watercraft_pack_008', -30, 61.5, 0.4, 2.9], ['boats/boat_watercraft_pack_015', -24.5, 62.2, -0.3, 2.9], ['boats/boat_watercraft_pack_020', 24, 61.8, 0.2, 4.2], ['boats/boat_watercraft_pack_012', 31, 62.6, -0.5, 3.4], ['boats/boat_watercraft_pack_005', 44, 64.5, 0.15, 10.5], ['boats/boat_watercraft_pack_001', -62, 65, 0.9, 5.1], ['boats/boat_watercraft_pack_025', 68, 63, -0.2, 4.6]];
    for (const [m, x, z, ry, l] of boats) props.add(m, x, z, { y: WATER_Y - 0.12, ry, l });
    props.add('boats/boat_watercraft_pack_008', 3.2, 8.5, { y: CANAL_WATER_Y - 0.1, ry: 0.25, l: 2.9 }); props.add('boats/boat_watercraft_pack_015', -3.0, -11, { y: CANAL_WATER_Y - 0.1, ry: -0.2, l: 2.9 });
    void BARGE; }
  // ---- Rynok market: two covered stalls, sacks, crates, a wheelbarrow; a ladder against Foma's wall
  props.add('village_q/marketstand_1', -66.5, -3.9, { l: 3.0, ry: 0, collide: true }); props.add('village_q/marketstand_2', -72.5, -3.7, { l: 2.6, ry: 0.1, collide: true });
  for (const [x, z, r] of [[-64.4, -3.4, 0.3], [-63.9, -4.3, 1.2], [-68.9, -3.5, 2.1], [-70.6, -3.2, 0.8]]) props.add('village_q/bags', x, z, { l: 0.9, ry: r, collide: true });
  for (const [x, z, r] of [[-69.4, -4.4, 0.4], [-74.6, -3.6, 1.1], [-74.4, -4.5, 0.2]]) props.add('hex_props/crate_a_big', x, z, { l: 0.75, ry: r, collide: true });
  props.add('hex_props/wheelbarrow', -53.2, -4.6, { l: 1.5, ry: 2.4, collide: true }); props.add('hex_props/sack', -53.8, -3.9, { l: 0.65, ry: 0.5 }); props.add('hex_props/sack', -54.3, -4.3, { l: 0.6, ry: 2.5 });
  props.add('hex_props/ladder', -37.2, -13.9, { h: 4.2, ry: 0, tilt: -0.28, collide: true });
  // ---- bare-ish autumn trees: Tower square corners and the Beregovaya walk (trunk-only colliders so the crowns do not block the street)
  for (const [x, z, k] of [[-72.5, -47.5, 'oak'], [-63.5, -47.5, 'default'], [-72.5, -32.5, 'default'], [-63.5, -32.5, 'oak'], [-17.5, -62, 'oak'], [-17.5, -44, 'default'], [-17.5, -26, 'oak'], [-17.5, 18, 'default'], [-17.5, 36, 'oak'], [17.5, -44, 'default'], [17.5, 28, 'oak'], [12, -20.5, 'default']] as [number, number, string][]) {
    props.add('nature/tree_' + k + '_fall', x, z, { h: k === 'oak' ? 5.2 : 6.0, ry: hash(x, z) * 6 }); const y = groundH(x, z); world.add(x, z, 0.22, 0.22, 0, y, y + 3, 'solid'); }
  // ---- life: a pug at pier 7, a cat on the tavern step
  props.add('characters/animal_pug', -12.5, 56.2, { h: 0.6, ry: 1.2 }); props.add('characters/animal_cat', 18.9, 13.6, { h: 0.35, ry: -1.4 });
  // ---- far shore across the harbour: dotted lights, a lighthouse with a sweeping beam (Mayak island, spec 4)
  const halo = new THREE.TextureLoader().load('/textures/procedural/lamp_halo.png');
  for (let i = 0; i < 46; i++) { const x = -160 + i * 7 + hash(i, 1) * 6, z = 150 + hash(i, 2) * 50; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: hash(i, 3) < 0.3 ? 0xffb070 : 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 + hash(i, 4) * 0.4, fog: false })); sp.scale.setScalar(2 + hash(i, 5) * 3); sp.position.set(x, 3 + hash(i, 6) * 6, z); scene.add(sp); }
  const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xfff4d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false })); beam.scale.setScalar(14); beam.position.set(70, 16, 240); scene.add(beam);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 16, 10), new THREE.MeshStandardMaterial({ color: 0x1a1c1e })); tower.position.set(70, 8, 240); scene.add(tower);
  (scene as any).__beam = beam;
  void walkY;
}
