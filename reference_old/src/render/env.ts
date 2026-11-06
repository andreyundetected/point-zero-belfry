import * as THREE from 'three';
import { NEON } from './textures';
import { hrand } from '../sim/util';

/** Procedural night-city environment: used for reflections on wet asphalt, glass and car paint. */
export function makeEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: {},
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 v; void main(){ float h = v.y; vec3 top = vec3(0.01,0.012,0.03); vec3 hor = vec3(0.16,0.06,0.22); vec3 low = vec3(0.03,0.03,0.05); vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.5)) : mix(hor, low, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }',
  }));
  s.add(sky);
  for (let i = 0; i < 70; i++) {
    const a = hrand(700, i) * Math.PI * 2, y = -8 + hrand(701, i) * 30, w = 3 + hrand(702, i) * 12, h = 1 + hrand(703, i) * 10;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON[i % NEON.length]).multiplyScalar(1.5 + hrand(704, i) * 3), side: THREE.DoubleSide }));
    m.position.set(Math.cos(a) * 80, y, Math.sin(a) * 80); m.lookAt(0, y, 0); s.add(m);
  }
  for (let i = 0; i < 160; i++) { // warm windows
    const a = hrand(710, i) * Math.PI * 2, y = -5 + hrand(711, i) * 40;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc070).multiplyScalar(2), side: THREE.DoubleSide }));
    m.position.set(Math.cos(a) * 85, y, Math.sin(a) * 85); m.lookAt(0, y, 0); s.add(m);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.02).texture; pm.dispose();
  return tex;
}

/** Visible sky: dark clouds lit from below by the city glow, slowly drifting. */
export function makeSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, flash: { value: 0 } },
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 v; uniform float time; uniform float flash;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
      void main(){
        float y = max(v.y, 0.0);
        vec3 top = vec3(0.012,0.014,0.03), hor = vec3(0.20,0.07,0.24);
        vec3 c = mix(hor, top, pow(y, 0.45));
        vec2 uv = v.xz / (v.y + 0.25) * 1.6 + vec2(time*0.004, time*0.002);
        float cl = fbm(uv);
        vec3 lit = mix(vec3(0.10,0.05,0.14), vec3(0.30,0.12,0.30), cl);
        c = mix(c, lit * (1.0 - y*0.7), smoothstep(0.35, 0.8, cl) * 0.85);
        c += flash * vec3(0.5,0.55,0.75) * cl;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat); m.frustumCulled = false; m.renderOrder = -1;
  return m;
}
