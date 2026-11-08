import * as THREE from 'three';
import { SimWorld, CityState } from '../sim/world';
import { VEHICLES } from '../sim/vehicles';
import { putModel } from '../world/props';
import { groundH, walkY } from '../world/terrain';
import { M } from '../render/materials';

/** car, wagon, tram, launch: moving models driven by the sim (spec 15.2) */
export class Vehicles {
  objs = new Map<string, THREE.Object3D>();
  constructor(public scene: THREE.Scene) { this.build(); }
  private async build() {
    const black = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.35, metalness: 0.6 });
    const mkCar = async (id: string) => { const g = new THREE.Group(); this.scene.add(g); g.visible = false; this.objs.set(id, g);
      try { const m = await putModel(this.scene, 'city_bits/car_sedan', 0, 0, { l: 4.6 }); this.scene.remove(m); m.traverse(o => { const me = o as THREE.Mesh; if (me.isMesh) me.material = black; }); g.add(m); } catch { const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.4, 4.4), black); b.position.y = 0.8; g.add(b); } };
    await mkCar('craneCar'); await mkCar('cordCar');
    // tram: lit box on rails
    { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 9), new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.6 })); body.position.y = 1.9; g.add(body);
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), M.lit); w.position.set(s * 1.26, 2.3, -3.2 + i * 1.6); w.rotation.y = s * Math.PI / 2; g.add(w); }
      g.traverse(o => { o.castShadow = true; }); this.scene.add(g); g.visible = false; this.objs.set('tram', g); }
    // wagon: covered cart
    { const g = new THREE.Group(); this.scene.add(g); g.visible = false; this.objs.set('wagon', g);
      const tent = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.4, 14, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x5a5448, roughness: 1, side: THREE.DoubleSide })); tent.rotation.z = Math.PI / 2; tent.rotation.y = Math.PI / 2; tent.position.y = 1.5; tent.rotation.set(0, 0, 0); tent.rotation.x = Math.PI / 2; tent.rotateY(Math.PI / 2); tent.position.y = 1.55; g.add(tent);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 3.6), M.wood); bed.position.y = 0.9; g.add(bed);
      for (const sx of [-1.2, 1.2]) for (const sz of [-1.2, 1.2]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 14), M.iron); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.55, sz); g.add(w); }
      const horse = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 1.6), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1 })); horse.position.set(0, 1.0, 3.3); g.add(horse);
      g.traverse(o => { o.castShadow = true; }); }
    // launch
    { const g = new THREE.Group(); this.scene.add(g); g.visible = false; this.objs.set('launch', g);
      try { const m = await putModel(this.scene, 'boats/boat_watercraft_pack_024', 0, 0, { l: 8, y: 0 }); this.scene.remove(m); g.add(m); } catch { const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 7), M.dark); b.position.y = 0.4; g.add(b); } }
  }
  update(sim: SimWorld, t: number, cs: CityState) {
    for (const v of VEHICLES) {
      const o = this.objs.get(v.id); if (!o) continue; const p = sim.vehicle(v.id, t);
      if (p.hidden) { o.visible = false; continue; } o.visible = true;
      const y = v.id === 'launch' ? -2.2 + Math.sin(t * 1.7) * 0.05 : walkY(p.x, p.z);
      o.position.set(p.x, y, p.z); o.rotation.y = p.ry + (v.id === 'wagon' || v.id === 'cordCar' || v.id === 'craneCar' ? 0 : 0);
      if (v.id === 'wagon' && cs.wagonPinOut) o.rotation.z = 0.12;
    }
    void groundH;
  }
}
