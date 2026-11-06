import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Bloom (0.75/0.7/0.82) → грейд (бирюзовые тени, янтарные света) → виньетка → зерно → Output. */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera) {
  const comp = new EffectComposer(renderer);
  const pass = new RenderPass(scene, cam);
  comp.addPass(pass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.7, 0.82);
  comp.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, flash: { value: 0 }, heat: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse;uniform float time;uniform float flash;uniform float heat;varying vec2 vUv;
 float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
 void main(){
  vec2 uv=vUv;
  uv+=vec2(sin(uv.y*40.+time*3.),cos(uv.x*35.+time*2.))*0.0012*heat;
  vec4 c=texture2D(tDiffuse,uv); vec2 d=vUv-.5; float v=smoothstep(.95,.25,length(d)*1.15); c.rgb*=mix(.55,1.,v);
  float l=dot(c.rgb,vec3(.299,.587,.114)); c.rgb=mix(vec3(l),c.rgb,1.12);
  c.rgb=mix(c.rgb*vec3(.92,.98,1.1),c.rgb*vec3(1.08,1.0,.9),smoothstep(.15,.8,l));
  c.rgb=mix(c.rgb,vec3(.55,.8,1.)*(l+.2),flash*.6);
  c.rgb=max(c.rgb-.012,0.); c.rgb+=(h(vUv*vec2(1920.,1080.)+time)-.5)*.022; gl_FragColor=c;}`,
  });
  comp.addPass(grade);
  comp.addPass(new OutputPass());
  return {
    comp, bloom, grade,
    render(t: number) { grade.uniforms.time.value = t; comp.render(); },
    resize(w: number, h: number) { comp.setSize(w, h); },
  };
}
