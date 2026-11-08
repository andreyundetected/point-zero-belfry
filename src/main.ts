import * as THREE from 'three';
import { makeDevice } from './game/device';
import { Player } from './game/player';
import { makePost } from './render/post';
import { makeRain, setupAtmosphere } from './render/atmosphere';
import { buildTestStreet } from './world/testStreet';

const q = new URLSearchParams(location.search), SAT = +(q.get('sat') ?? 0.2);
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(W < H ? 80 : 70, W / H, 0.05, 250); scene.add(cam);
setupAtmosphere(scene);
buildTestStreet(scene);
const dev = makeDevice(); cam.add(dev.obj);
const rain = makeRain(scene);
const { comp, grade } = makePost(renderer, scene, cam, W, H, SAT);
const player = new Player(cam, renderer.domElement);
const SHOTS: Record<string, [number, number, number, number]> = { '1': [0.8, 26, 0, -5], '2': [-6.6, 2.6, -8.6, 6.4], '3': [-2, -22, 6.4, -33] };
const s = SHOTS[q.get('shot') ?? '1'] ?? SHOTS['1']; player.place(s[0], s[1], s[2], s[3]);
cam.rotation.set(player.pitch, player.yaw, 0);
const clock = new THREE.Clock(); let t = 0;
declare global { interface Window { done?: boolean; info?: string; FREEZE?: boolean } }
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); t += dt;
  player.update(dt); rain(t, cam.position.x, cam.position.z); grade.uniforms.time.value = t; comp.render();
  if (!window.FREEZE) requestAnimationFrame(frame);
}
frame(); setTimeout(() => { window.done = true; window.info = 'ok'; }, 5000);
