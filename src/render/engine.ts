import * as THREE from 'three';
import { createPost } from './post';
import { setupAtmosphere, followMoon, Rain, LampSystem } from './atmosphere';

export interface Engine {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera;
  post: ReturnType<typeof createPost>; moon: THREE.DirectionalLight; rain: Rain; lamps: LampSystem;
  mixers: THREE.AnimationMixer[]; clock: THREE.Clock;
  onFrame: ((dt: number, t: number) => void)[];
  start(): void;
}

export function createEngine(host: HTMLElement): Engine {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 260);
  const { moon } = setupAtmosphere(scene);
  const rain = new Rain(); scene.add(rain.obj);
  const lamps = new LampSystem(scene, 12);
  const post = createPost(renderer, scene, cam);
  const mixers: THREE.AnimationMixer[] = [];
  const clock = new THREE.Clock();
  const onFrame: Engine['onFrame'] = [];
  let t = 0;
  const eng: Engine = {
    renderer, scene, cam, post, moon, rain, lamps, mixers, clock, onFrame,
    start() {
      const loop = () => {
        const dt = Math.min(clock.getDelta(), 0.05); t += dt;
        mixers.forEach((m) => m.update(dt));
        onFrame.forEach((f) => f(dt, t));
        followMoon(moon, new THREE.Vector3(cam.position.x, 0, cam.position.z));
        rain.update(t, cam.position);
        lamps.setPx(renderer.domElement.height, cam.fov); lamps.update(t, cam.position);
        renderer.info.reset(); post.render(t);
        requestAnimationFrame(loop);
      };
      loop();
    },
  };
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight); post.resize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  });
  return eng;
}
