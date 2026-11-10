import * as THREE from 'three';
import { makeDevice } from './game/device';
import { Player } from './game/player';
import { makePost } from './render/post';
import { makeRain, setupAtmosphere } from './render/atmosphere';
import { buildZaton } from './world/zaton';
import { Game } from './game/game';
import { createPerson } from './game/people';
import { at, fmt } from './sim/time';
import { ROOF_Y } from './sim/npcs';
import { TOWER } from './world/tower';
import { groundH } from './world/terrain';

const q = new URLSearchParams(location.search), SAT = +(q.get('sat') ?? 0.2);
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(W < H ? 80 : 70, W / H, 0.05, 260); scene.add(cam);
const { moon, hemi } = setupAtmosphere(scene);
const zaton = buildZaton(scene);
const dev = makeDevice(); cam.add(dev.obj);
const rain = makeRain(scene);
const { comp, grade, setScale } = makePost(renderer, scene, cam, W, H, SAT);
const player = new Player(cam, renderer.domElement);
const game = new Game(scene, cam, player, moon, hemi, renderer);

// start: tower roof, 22:03:30 - the prologue (spec 11.1). ?at=x,z,lookX,lookZ&t=mm:ss for debug viewpoints
const at4 = q.get('at')?.split(',').map(Number); const tq = q.get('t');
const SHOTS: Record<string, [number, number, number, number, number?]> = { '1': [-34, -3, -60, -8.5], '2': [12, 12, 30, 9, 0.05], '3': [-12, 0.2, 9, 0], '4': [-60, -37, -38, -33.5], '5': [-24, 52, -9, 66, -0.05] };
const sh = q.get('shot') ? SHOTS[q.get('shot')!] : undefined;
const debugPos = at4 && at4.length >= 4 ? (at4 as [number, number, number, number]) : sh;
if (tq) { const [m, s] = tq.split(':').map(Number); game.s.t = m * 60 + (s || 0); } else game.s.t = debugPos ? 0 : at(22, 3);
if (debugPos) player.place(debugPos[0], debugPos[1], debugPos[2], debugPos[3], (debugPos as any)[4] ?? 0);
else { player.place(TOWER.roofSpawn.x, TOWER.roofSpawn.z, -70, -63, 0, ROOF_Y()); }
if (q.get('thread')) game.s.thread = q.get('thread')!;
if (q.get('y')) player.body.y = q.get('y') === 'roof' ? ROOF_Y() : +q.get('y')!;
if (q.get('gun')) { game.s.hasGun = true; game.s.mag = 6; game.s.ammo = 18; }
const clock = new THREE.Clock(); let t = 0;
declare global { interface Window { done?: boolean; info?: string; FREEZE?: boolean; player?: Player; game?: Game; dbg?: any } }
window.player = player; window.game = game; (window as any).renderer = renderer; window.dbg = { createPerson, scene, THREE, fmt };
let lastShown = ''; let scale = +(q.get('scale') ?? 1), acc = 0, accN = 0; setScale(scale);
function frame() {
  for (const p of (window as any).__lp ?? []) p.update(0.016);
  const dt = Math.min(clock.getDelta(), 0.05); t += dt;
  acc += dt; accN++; if (accN >= 90) { const avg = acc / accN; acc = 0; accN = 0; if (!q.get('scale')) { const ns = avg > 0.026 ? Math.max(0.5, scale - 0.15) : avg < 0.0155 ? Math.min(1, scale + 0.1) : scale; if (Math.abs(ns - scale) > 0.01) { scale = ns; setScale(scale); } } }
  game.update(dt); { const bm = (scene as any).__beam; if (bm) bm.material.opacity = 0.15 + 0.85 * Math.max(0, Math.sin(t * 0.9) ** 3); } const shown = fmt(game.s.t, true); if (shown !== lastShown) { lastShown = shown; dev.setTime(shown); } (rain as any).mesh.visible = !game.sceneInside; rain(t, cam.position.x, cam.position.z); grade.uniforms.time.value = t; comp.render();
  if (!window.FREEZE) requestAnimationFrame(frame);
}
frame();
if (q.get('lineup')) { const Lt = new THREE.PointLight(0xfff2e0, 60, 20); Lt.position.set(-60, 3, -38); scene.add(Lt); const looks: any[] = [{ body: 'remy', coat: 0x2b2a28, hat: 'fedora' }, { body: 'remy', coat: 0x4a4238, hat: 'cap', long: true }, { body: 'liza', coat: 0x26292d, skirt: true, long: true, hat: 'scarf' }, { body: 'michelle', coat: 0x3a352e, hat: 'none' }, { body: 'liza', coat: 0x4a4238, hat: 'veil', long: true }, { body: 'james', coat: 0x1d1e20, hat: 'peaked' }]; looks.forEach((l, i) => createPerson(l, 'L' + i).then(p => { p.root.position.set(-63 + i * 1.2, 0, -42); p.root.position.y = groundH(-63 + i * 1.2, -42); p.root.rotation.y = 0; scene.add(p.root); p.anim('idle'); (window as any).__lp = ((window as any).__lp ?? []).concat(p); })); }
zaton.ready.then(() => { const ld = document.getElementById('loading'); if (ld) ld.style.display = 'none'; window.done = true; window.info = 'ok'; if (q.get('board')) { game.s.pocket = 'cap'; game.s.learn('helm_ok'); game.pilot.board(); } window.done = true; window.info = 'ok'; if (!debugPos && !q.get('noprologue')) setTimeout(() => game.runner.start('prologue'), 1200); });
