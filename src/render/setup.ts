import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { loadTexture } from './materials';

export const FOG_COLOR = 0x0b0f15;

export function createRenderSetup(container: HTMLElement) {
  const W = innerWidth, H = innerHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.035);
  const camera = new THREE.PerspectiveCamera(70, W / H, 0.05, 260);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0x5f7590, 0x1d1a17, 0.7));
  const moon = new THREE.DirectionalLight(0xb0c4e8, 1.0);
  moon.position.set(-18, 34, -12);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 120 });
  moon.shadow.bias = -0.0005;
  moon.shadow.normalBias = 0.03;
  scene.add(moon);

  new EXRLoader().load('/hdri/night_512.exr', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = t;
    scene.environmentIntensity = 0.35;
  }, undefined, () => console.warn('hdri missing'));

  // --- post: 20% цвета, чистый красный выживает по цвету материала --------
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.65, 0.7, 0.82);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, sat: { value: 0.2 }, res: { value: new THREE.Vector2(W, H) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float time,sat; uniform vec2 res; varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){
        vec3 c=texture2D(tDiffuse,vUv).rgb;
        float l=dot(c,vec3(.2126,.7152,.0722));
        vec3 mono=vec3(l)*vec3(.94,.98,1.05);
        float red=smoothstep(.78,.92,(c.r-max(c.g,c.b))/max(c.r,1e-4))*smoothstep(.03,.1,c.r);
        vec3 col=mix(mix(mono,c,sat),vec3(c.r*1.25,c.g*.6,c.b*.6),red);
        vec2 d=vUv-.5;
        col*=mix(.5,1.,smoothstep(.9,.25,length(d*vec2(1.,res.y/res.x))*1.25));
        col+=(h(vUv*res+time)-.5)*.035;
        gl_FragColor=vec4(col,1.);
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  // --- дождь --------------------------------------------------------------
  const N = 3200;
  const pos = new Float32Array(N * 6);
  const seeds = new Float32Array(N * 3);
  const box = { x: 34, y: 18, z: 44 };
  for (let i = 0; i < N; i++) {
    seeds[i * 3] = (Math.random() - 0.5) * box.x;
    seeds[i * 3 + 1] = Math.random() * box.y;
    seeds[i * 3 + 2] = (Math.random() - 0.5) * box.z;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xaec4ee, transparent: true, opacity: 0.16 }));
  rain.frustumCulled = false;
  scene.add(rain);

  const rainUpdate = (t: number, cam: THREE.Camera) => {
    const cx = cam.position.x, cz = cam.position.z;
    for (let i = 0; i < N; i++) {
      const x = cx + seeds[i * 3];
      const z = cz + seeds[i * 3 + 2];
      const y = ((seeds[i * 3 + 1] - t * 16) % box.y + box.y) % box.y - 2;
      const k = i * 6;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      pos[k + 3] = x - 0.04; pos[k + 4] = y + 0.6; pos[k + 5] = z;
    }
    rainGeo.attributes.position.needsUpdate = true;
  };

  // --- пул фонарей: не больше 12 динамических светов ----------------------
  const lights: THREE.PointLight[] = [];
  for (let i = 0; i < 11; i++) {
    const L = new THREE.PointLight(0xffb070, 0, 15, 1.6);
    scene.add(L);
    lights.push(L);
  }
  const halo = loadTexture('textures/procedural/lamp_halo.png');
  const halos: THREE.Sprite[] = [];
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffb070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75, fog: false }));
    s.scale.setScalar(2.4);
    scene.add(s);
    halos.push(s);
  }

  const lampPos: THREE.Vector3[] = [];
  const registerLamp = (x: number, y: number, z: number) => lampPos.push(new THREE.Vector3(x, y, z));

  const flicker = (t: number, dark: boolean, strength: number) => {
    if (!dark) return 1;
    const n = Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1.7);
    return n < -0.55 ? 0.15 + strength * 0.1 : 1;
  };

  const updateLamps = (camPos: THREE.Vector3, time: number, dark: boolean) => {
    const sorted = lampPos
      .map((p, i) => ({ p, i, d: p.distanceToSquared(camPos) }))
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < lights.length; i++) {
      const entry = sorted[i];
      const L = lights[i];
      if (!entry) { L.intensity = 0; continue; }
      L.position.set(entry.p.x, entry.p.y + 0.1, entry.p.z);
      L.intensity = 13 * flicker(time + entry.i * 1.7, dark, 1);
    }
    for (let i = 0; i < halos.length; i++) {
      const entry = sorted[i];
      const s = halos[i];
      if (!entry) { s.visible = false; continue; }
      s.visible = true;
      s.position.set(entry.p.x, entry.p.y + 0.2, entry.p.z);
      s.material.opacity = 0.6 * flicker(time + entry.i * 1.7, dark, 1);
    }
  };

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    grade.uniforms.res.value.set(w, h);
  };
  addEventListener('resize', resize);

  return { renderer, scene, camera, composer, grade, bloom, rainUpdate, updateLamps, registerLamp, lampPos };
}

export type RenderSetup = ReturnType<typeof createRenderSetup>;
