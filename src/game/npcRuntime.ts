import * as THREE from 'three';
import { NpcDef, NPCS } from '../sim/npcs';
import { SimWorld } from '../sim/world';
import { createPerson, Person } from './people';

/** keeps people alive in the scene only near the player (LOD: spec 15.4), driven by the deterministic sim */
export class NpcRuntime {
  active = new Map<string, Person>(); loading = new Set<string>(); radius = 24; far = 70; maxPeople = 10; pending: string[] = [];
  /** distant people are cheap dark silhouettes (capsules) - the full Mixamo bodies are 50k triangles each */
  lod = new Map<string, THREE.Mesh>(); capGeo = new THREE.CapsuleGeometry(0.24, 1.2, 2, 6);
  poses = new Map<string, { x: number; y: number; z: number; ry: number; a: string; hidden: boolean }>();
  constructor(public scene: THREE.Scene, public sim: SimWorld) {}
  /** world position of an npc right now (even if not spawned) */
  pose(id: string) { return this.poses.get(id); }
  update(t: number, px: number, pz: number, dt: number, py: number, hook?: (d: NpcDef, p: { x: number; y: number; z: number; ry: number; a: string; hidden: boolean }) => void, override?: (id: string) => { x: number; y: number; z: number; ry: number; a: string; hidden: boolean } | null) {
    const cand: { d: NpcDef; dist: number }[] = [];
    for (const d of NPCS) {
      let p: { x: number; y: number; z: number; ry: number; a: string; hidden: boolean } = this.sim.pose(d.id, t); const o = override?.(d.id); if (o) p = o;
      this.poses.set(d.id, p); hook?.(d, p);
      if (p.hidden) continue; const dist = Math.hypot(p.x - px, p.z - pz) + Math.abs(p.y - py) * 2; if (dist < this.radius) cand.push({ d, dist });
    }
    // silhouettes for everyone visible between the detail radius and the far radius
    const sil = new Set<string>();
    for (const d of NPCS) { const p = this.poses.get(d.id)!; if (p.hidden) continue; const dist = Math.hypot(p.x - px, p.z - pz) + Math.abs(p.y - py) * 2; if (dist >= this.radius - 2 && dist < this.far) { sil.add(d.id); let m = this.lod.get(d.id); if (!m) { m = new THREE.Mesh(this.capGeo, new THREE.MeshStandardMaterial({ color: d.look.coat, roughness: 1 })); this.scene.add(m); this.lod.set(d.id, m); } m.visible = !this.active.has(d.id); const sc = d.look.scale ?? 1; m.scale.setScalar(sc); m.position.set(p.x, p.y + 0.85 * sc, p.z); } }
    for (const [id, m] of this.lod) if (!sil.has(id)) m.visible = false;
    cand.sort((a, b) => a.dist - b.dist); const want = new Set(cand.slice(0, this.maxPeople).map(c => c.d.id));
    for (const [id, per] of this.active) if (!want.has(id) || this.poses.get(id)!.hidden || (Math.hypot(this.poses.get(id)!.x - px, this.poses.get(id)!.z - pz) > this.radius + 6)) { per.dispose(); this.active.delete(id); }
    for (const c of cand.slice(0, this.maxPeople)) if (!this.active.has(c.d.id) && !this.loading.has(c.d.id) && this.loading.size < 2) {
      this.loading.add(c.d.id);
      createPerson(c.d.look, c.d.id).then(per => { this.loading.delete(c.d.id); if (!want.has(c.d.id)) { return; } this.scene.add(per.root); this.active.set(c.d.id, per); }).catch(e => { this.loading.delete(c.d.id); console.warn('person', c.d.id, e); });
    }
    for (const [id, per] of this.active) {
      const p = this.poses.get(id)!; per.root.position.set(p.x, p.y, p.z);
      // ease the turn
      const cur = per.root.rotation.y; let d = p.ry - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); per.root.rotation.y = cur + d * Math.min(1, dt * 8);
      let a = p.a; if (a === 'sit' || a === 'sittalk' || a === 'cry') per.root.position.y -= 0.38 * (per.look.scale ?? 1); per.anim(a === 'v' ? 'idle' : a);
      const dd = Math.hypot(p.x - px, p.z - pz); per.root.traverse(o => { (o as THREE.Mesh).castShadow = dd < 10; }); per.update(dt);
    }
  }
}
