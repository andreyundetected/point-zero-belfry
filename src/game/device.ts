import * as THREE from 'three';
/** Stvorka: a brass pocket-chronometer in a leather glove — domed glass, engraved dial, red digits, crown and gearwork (spec 2.5). */
export function makeDevice() {
  const dev = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a34, metalness: 0.95, roughness: 0.3 }), dark = new THREE.MeshStandardMaterial({ color: 0x1a1612, metalness: 0.6, roughness: 0.5 });
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // body: thick brass puck with a bevelled ring, glass dome over the dial
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.082, 0.034, 40), brass); body.position.y = 0;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.008, 10, 40), brass); ring.rotation.x = Math.PI / 2; ring.position.y = 0.019;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.068, 40), new THREE.MeshBasicMaterial({ map: tex })); face.rotation.x = -Math.PI / 2; face.position.y = 0.0185;
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.07, 28, 10, 0, Math.PI * 2, 0, Math.PI / 5), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.02, clearcoat: 1 })); glass.scale.set(1, 0.55, 1); glass.position.y = 0.019;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 14), brass); crown.rotation.z = Math.PI / 2; crown.position.set(0.09, 0.004, -0.03);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.014, 8), brass); stem.rotation.z = Math.PI / 2; stem.position.set(0.082, 0.004, -0.03);
  const lug = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 8, 14), brass); lug.position.set(0, 0.003, -0.095); lug.rotation.x = Math.PI / 2;
  dev.add(body, ring, face, glass, crown, stem, lug);
  for (const [x, z, r] of [[-0.05, 0.05, 0.016], [-0.075, 0.0, 0.011], [0.0, 0.08, 0.012]] as [number, number, number][]) { const gear = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.006, 12), brass); gear.position.set(x, -0.012, z + 0.02); dev.add(gear); } // visible gears on the rim
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 6, 24, Math.PI * 1.2), brass); chain.position.set(-0.01, -0.01, -0.12); chain.rotation.set(Math.PI / 2, 0, 0.4); dev.add(chain);
  const glove = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.14), new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.85 })); glove.position.set(0, -0.04, 0.04); dev.add(glove);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.04, 3, 6), glove.material); f.rotation.z = Math.PI / 2; f.position.set(0.06 + i * 0.002, -0.03, 0.0 + i * 0.022 - 0.02); dev.add(f); }
  void dark;
  let last = '';
  const setTime = (s: string) => {
    if (s === last) return; last = s; const [hh, mm, ss] = s.split(':').map(Number); const sec = ss || 0, min = mm + sec / 60, hr = (hh % 12) + min / 60;
    g.fillStyle = '#0b0a08'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#6a5428'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.stroke(); g.lineWidth = 1; g.beginPath(); g.arc(128, 128, 92, 0, 7); g.stroke();
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, l = i % 5 === 0 ? 14 : 6; g.strokeStyle = i % 5 === 0 ? '#d8cfae' : '#8a7e5e'; g.lineWidth = i % 5 === 0 ? 3 : 1; g.beginPath(); g.moveTo(128 + Math.sin(a) * 118, 128 - Math.cos(a) * 118); g.lineTo(128 + Math.sin(a) * (118 - l), 128 - Math.cos(a) * (118 - l)); g.stroke(); }
    const hand = (a: number, l: number, w: number, col: string) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(128 - Math.sin(a) * 12, 128 + Math.cos(a) * 12); g.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); g.stroke(); };
    hand(hr / 12 * Math.PI * 2, 52, 7, '#d8cfae'); hand(min / 60 * Math.PI * 2, 84, 4, '#d8cfae'); hand(sec / 60 * Math.PI * 2, 96, 2, '#ff2a18');
    g.fillStyle = '#ff1808'; g.shadowColor = '#ff2a10'; g.shadowBlur = 14; g.font = 'bold 34px monospace'; g.textAlign = 'center'; g.fillText(s.slice(0, 5), 128, 190); g.shadowBlur = 0; g.fillStyle = '#d8cfae'; g.beginPath(); g.arc(128, 128, 5, 0, 7); g.fill();
    tex.needsUpdate = true;
  };
  setTime('22:00:00');
  dev.scale.setScalar(1.25); dev.position.set(-0.2, -0.235, -0.47); dev.rotation.set(0.85, 0.28, 0.1);
  return { obj: dev, setTime };
}
