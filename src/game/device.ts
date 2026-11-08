import * as THREE from 'three';
/** Створка: brass device in the left hand, red digits. */
export function makeDevice() {
  const dev = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.026, 0.14), new THREE.MeshStandardMaterial({ color: 0x5a4a32, metalness: 0.8, roughness: 0.35 }));
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.006, 28), new THREE.MeshStandardMaterial({ color: 0xcfc6b2, roughness: 0.3 })); dial.position.set(0, 0.015, 0.022);
  const c = document.createElement('canvas'); c.width = 128; c.height = 40; const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  const setTime = (s: string) => { ctx.fillStyle = '#120202'; ctx.fillRect(0, 0, 128, 40); ctx.fillStyle = '#ff1808'; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center'; ctx.fillText(s, 64, 30); tex.needsUpdate = true; };
  setTime('22:00');
  const dg = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.019), new THREE.MeshBasicMaterial({ map: tex })); dg.rotation.x = -Math.PI / 2; dg.position.set(0, 0.0135, -0.042);
  const glove = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.035, 0.11), new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.85 })); glove.position.set(0, -0.028, 0.02);
  dev.add(body, dial, dg, glove); dev.scale.setScalar(0.85); dev.position.set(-0.23, -0.24, -0.42); dev.rotation.set(0.95, 0.32, 0.12);
  return { obj: dev, setTime };
}
