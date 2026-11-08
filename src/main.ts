import * as THREE from 'three';
import { makeDevice } from './game/device';
import { Player } from './game/player';
import { makePost } from './render/post';
import { makeRain, setupAtmosphere } from './render/atmosphere';
import { buildZaton } from './world/zaton';
import { LampPool } from './world/lamps';

const q = new URLSearchParams(location.search), SAT = +(q.get('sat') ?? 0.2);
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(W < H ? 80 : 70, W / H, 0.05, 260); scene.add(cam);
const moon = setupAtmosphere(scene);
const zaton = buildZaton(scene);
const dev = makeDevice(); cam.add(dev.obj);
const rain = makeRain(scene);
const pool = new LampPool(scene, 10);
const { comp, grade } = makePost(renderer, scene, cam, W, H, SAT);
const player = new Player(cam, renderer.domElement);

// spawn / debug viewpoints: ?shot=1..5 or ?at=x,z,lookX,lookZ
const SHOTS: Record<string, [number, number, number, number, number?]> = {
  '1': [-34, -3, -60, -8.5],        // Rynok street
  '2': [12, 12, 30, 9, 0.05],       // tavern front on the Naberezhnaya
  '3': [-12, 0.2, 9, 0],            // Old Bridge from the west
  '4': [-60, -37, -38, -33.5],      // Kluchnikov alley
  '5': [-24, 52, -9, 66, -0.05],    // harbour quay and pier 7
};
const at = q.get('at')?.split(',').map(Number);
const s = at && at.length >= 4 ? (at as [number, number, number, number]) : (SHOTS[q.get('shot') ?? '3'] ?? SHOTS['3']);
player.place(s[0], s[1], s[2], s[3], s[4] ?? 0);
const clock = new THREE.Clock(); let t = 0;
declare global { interface Window { done?: boolean; info?: string; FREEZE?: boolean; player?: Player } }
window.player = player;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); t += dt;
  player.update(dt); pool.update(cam.position.x, cam.position.z);
  moon.position.set(cam.position.x - 18, 30, cam.position.z - 12); moon.target.position.set(cam.position.x, 0, cam.position.z);
  rain(t, cam.position.x, cam.position.z); grade.uniforms.time.value = t; comp.render();
  if (!window.FREEZE) requestAnimationFrame(frame);
}
frame();
zaton.ready.then(() => { window.done = true; window.info = 'ok'; });
