import * as THREE from 'three';

/** The player's car: low wedge sports body, glass canopy, spinning wheels, real headlight spot, neon underglow. */
export class MyCar {
  group = new THREE.Group(); wheels: THREE.Mesh[] = []; spot: THREE.SpotLight; body: THREE.Mesh; glow: THREE.Mesh;
  x = 0; y = 0; h = 0; v = 0; active = false; placed = false;
  constructor(scene: THREE.Scene) {
    const s = new THREE.Shape();
    s.moveTo(-2.4, 0.3); s.lineTo(2.3, 0.3); s.lineTo(2.55, 0.55); s.lineTo(2.2, 0.72); s.lineTo(0.6, 0.86); s.lineTo(-1.9, 0.98); s.lineTo(-2.45, 0.9); s.lineTo(-2.4, 0.3);
    const bg = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
    bg.translate(0, 0, -0.95); bg.rotateY(-Math.PI / 2);
    this.body = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0xff2a6a, metalness: 0.85, roughness: 0.18, envMapIntensity: 1.8 }));
    this.group.add(this.body);
    const c = new THREE.Shape(); c.moveTo(-1.5, 0.86); c.lineTo(0.75, 0.86); c.lineTo(-0.1, 1.38); c.lineTo(-1.2, 1.42); c.lineTo(-1.5, 0.86);
    const cg = new THREE.ExtrudeGeometry(c, { depth: 1.6, bevelEnabled: false }); cg.translate(0, 0, -0.8); cg.rotateY(-Math.PI / 2);
    this.group.add(new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0x05080e, metalness: 1, roughness: 0.02, envMapIntensity: 2.5 })));
    for (const [x, z] of [[-0.98, 1.55], [0.98, 1.55], [-0.98, -1.5], [0.98, -1.5]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.6, metalness: 0.4 }));
      w.position.set(x, 0.38, z); this.group.add(w); this.wheels.push(w);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 16).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x35f2e6, toneMapped: false })); rim.position.set(x * 1.08, 0.38, z); this.group.add(rim);
    }
    const hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); hl.position.set(0, 0.62, 2.5); this.group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xff1030, toneMapped: false })); tl.position.set(0, 0.8, -2.46); this.group.add(tl);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 4.4), new THREE.MeshBasicMaterial({ color: 0x35f2e6, toneMapped: false }));
    for (const sx of [-1.02, 1.02]) { const st = stripe.clone(); st.position.set(sx, 0.5, 0); this.group.add(st); }
    const gc = document.createElement('canvas'); gc.width = gc.height = 64; const gx = gc.getContext('2d')!; const gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), color: 0xff2a9a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.glow.position.y = 0.05; this.group.add(this.glow);
    this.spot = new THREE.SpotLight(0xe8f4ff, 0, 70, 0.55, 0.5, 1.4); this.spot.position.set(0, 0.7, 2.4); this.spot.target.position.set(0, 0, 14); this.group.add(this.spot, this.spot.target);
    this.group.visible = false; scene.add(this.group);
  }
  place(x: number, y: number, h: number, color: THREE.Color) { this.x = x; this.y = y; this.h = h; this.v = 0; this.placed = true; (this.body.material as THREE.MeshStandardMaterial).color.copy(color).multiplyScalar(1.4); this.group.visible = true; }
  update(dt: number) {
    if (!this.placed) return;
    this.group.position.set(this.x, 0.02, this.y); this.group.rotation.y = this.h;
    for (const w of this.wheels) w.rotation.x += this.v * dt / 0.38;
    this.spot.intensity = this.active ? 120 : 0;
  }
}
