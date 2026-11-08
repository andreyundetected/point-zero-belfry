import * as THREE from 'three';
import { at, fmt } from '../sim/time';
import { createPerson, Person } from './people';
import { M } from '../render/materials';
import type { Game } from './game';

// Harrow's launch (spec 6.9, 8.5, 8.6): stand at the helm, steer W/S/A/D from 22:40; finale knock at 22:46.
export interface LaunchState { x: number; z: number; ry: number; v: number; }
export function buildLaunchMesh(): THREE.Group {
  const g = new THREE.Group(); const hull = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.2, 7.4), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.4, metalness: 0.3 })); hull.position.set(0, 0.0, 0); g.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.35, 2.2, 4), hull.material); bow.rotation.x = Math.PI / 2; bow.rotation.z = Math.PI / 4; bow.scale.set(1, 1, 0.5); bow.position.set(0, 0.0, 4.5); g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 7.2), M.wood); deck.position.set(0, 0.64, 0); g.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.7, 3.2), new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.6 })); cabin.position.set(0, 1.5, -2.0); g.add(cabin);
  const rubka = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.9, 2.0), cabin.material); rubka.position.set(0, 1.6, 1.0); g.add(rubka);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.55), M.lit); w.position.set(s * 1.16, 1.9, -2.0); w.rotation.y = s * Math.PI / 2; g.add(w); const w2 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshBasicMaterial({ color: 0x0a0c10 })); w2.position.set(s * 1.16, 1.95, 1.0); w2.rotation.y = s * Math.PI / 2; g.add(w2); }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 20), M.iron); wheel.position.set(0, 1.55, 1.7); wheel.rotation.x = -0.4; g.add(wheel);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(4) })); lamp.position.set(0, 2.7, 1.0); g.add(lamp);
  g.traverse(o => { o.castShadow = true; }); return g;
}
const ROUTE: [number, number][] = [[-44, 84], [-30, 98], [8, 106], [34, 94], [10, 78], [-8, 74]];
export class Pilot {
  s: LaunchState = { x: -44.5, z: 83.6, ry: Math.PI / 2 * 1.0, v: 0 }; mesh: THREE.Group; guards: Person[] = []; harrow?: Person; barked = 0; finaleStarted = false; engine = 0; done = false; aboard = false; beacon: THREE.Sprite;
  constructor(public g: Game) {
    this.mesh = buildLaunchMesh(); this.mesh.visible = false; g.scene.add(this.mesh);
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff2010, blending: THREE.AdditiveBlending, transparent: true, fog: false, depthWrite: false })); this.beacon.scale.set(8, 8, 1); this.beacon.position.set(-9.5, 6, 66); this.beacon.visible = false; g.scene.add(this.beacon);
  }
  board() {
    if (this.aboard) return; this.aboard = true; const g = this.g; this.s = { x: -45.4, z: 83.2, ry: Math.PI, v: 0 }; // moored along the pier end, bow to the +x? we keep heading south-west until 22:40
    this.s.ry = Math.PI * 0.5; g.player.frozen = true; g.s.learn('on_helm'); g.hud.bark('Не поднимать голову.', true);
    g.message('Вижу тебя. Пирс 7. Ни слова ему.', 'I see you. Pier 7. Not a word to him.'); g.s.learn('msg3');
    const mk = async (look: any, off: [number, number]) => { const p = await createPerson(look, 'pg'); p.root.position.set(off[0], 0.68, off[1]); this.mesh.add(p.root); p.anim('idle'); return p; };
    mk({ body: 'james', coat: 0x5a5a58, hat: 'fedora', extra: ['revolver'] }, [0.7, -4.2]).then(p => this.guards.push(p)); mk({ body: 'remy', coat: 0x5a5a58, hat: 'cap', extra: ['revolver'] }, [-0.7, -4.2]).then(p => this.guards.push(p));
    this.mesh.visible = true; this.g.veh.objs.get('launch')!.visible = false;
  }
  update(dt: number) {
    const g = this.g, t = g.s.t, k = g.player.keys, s = this.s;
    if (!this.aboard) return;
    this.beacon.visible = t >= at(22, 41) && !this.done; (this.beacon.material as THREE.SpriteMaterial).opacity = 0.6 + Math.sin(g.time * 3) * 0.3;
    if (t >= at(22, 40)) { // under way
      const thr = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), steer = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
      s.v += (thr * 5.2 - s.v * 0.25) * dt * 0.9; s.v = Math.max(0, Math.min(6.5, s.v)); if (!thr && s.v < 0.2) s.v = 0; const dψ = steer * 0.55 * dt * (0.4 + s.v / 6); s.ry += dψ; g.player.yaw += dψ;
      s.x += Math.sin(s.ry) * s.v * dt; s.z += Math.cos(s.ry) * s.v * dt + 0.25 * dt; // the current pushes toward the shore
      s.x = Math.max(-110, Math.min(110, s.x)); s.z = Math.max(62, Math.min(170, s.z));
    } else if (t > at(22, 38)) s.v = 0;
    this.engine = s.v / 6.5; g.snd.setEngine(this.engine);
    this.mesh.position.set(s.x, -2.35 + Math.sin(g.time * 1.7) * 0.05, s.z); this.mesh.rotation.y = s.ry; this.mesh.rotation.z = Math.sin(g.time * 1.3) * 0.015;
    // camera at the helm
    const c = new THREE.Vector3(0, 1.62, 1.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.ry); g.player.body.x = s.x + c.x; g.player.body.z = s.z + c.z; g.player.body.y = this.mesh.position.y + 0.68; g.player.body.vx = g.player.body.vz = 0;
    // guards ask where you are going (spec 14.2): off the route by >40 m
    let dmin = 1e9; for (const [x, z] of ROUTE) dmin = Math.min(dmin, Math.hypot(x - s.x, z - s.z)); const offTrack = Math.hypot(s.x + 9.5, s.z - 66) > 40 && dmin > 40;
    if (t >= at(22, 41) && offTrack && g.time - this.barked > 12 && this.barked >= 0) { this.barked = g.time; g.hud.sub('Охранник', 'Куда правишь? Маяк левее.', 3); g.s.learn('guard_asked'); }
    // Harrow comes into the wheelhouse at 22:45:30 and knocks
    if (t >= at(22, 45, 20) && !this.harrow) createPerson({ body: 'james', coat: 0xb8b2a4, long: true, hat: 'none', scale: 1.04, hair: 0xd0d0cc }, 'harrow').then(p => { this.harrow = p; p.root.position.set(0.55, 0.68, -0.6); p.root.rotation.y = Math.PI; this.mesh.add(p.root); p.anim('idle'); });
    if (t >= at(22, 46) && !this.finaleStarted && !g.runner.active && this.harrow) { this.finaleStarted = true; g.s.learn('sync_held'); g.hud.sync(true); g.player.frozen = true; g.runner.start('finale'); }
    for (const p of this.guards) p.update(dt); this.harrow?.update(dt);
    void fmt;
  }
}
