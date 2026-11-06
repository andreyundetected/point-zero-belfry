import * as THREE from 'three';
import { createEngine } from './render/engine';
import { buildProofStreet } from './render/stage1';

const host = document.getElementById('app')!;
const eng = createEngine(host);
const q = new URLSearchParams(location.search);
const shot = q.get('shot') || 'a';
const presets: Record<string, [number[], number[]]> = { a: [[6.5, 2.4, 10.5], [0, 1.4, -2.5]], b: [[-2.0, 1.0, 6.5], [1.0, 1.5, -3]], c: [[8.5, 4.2, 2.0], [-2.5, 1.2, 0.5]] };
(async () => {
  await buildProofStreet(eng);
  const [p, t] = presets[shot] || presets.a;
  eng.cam.position.set(p[0], p[1], p[2]); eng.cam.lookAt(t[0], t[1], t[2]);
  eng.start();
  (window as any).READY = false; setTimeout(() => ((window as any).READY = true), 1500);
})();
export { THREE };
