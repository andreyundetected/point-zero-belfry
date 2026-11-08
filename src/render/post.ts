import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** 20% colour grade; pure red survives by hue (no overlay pass). */
export function makePost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera, W: number, H: number, sat = 0.2) {
  const comp = new EffectComposer(renderer); comp.setPixelRatio(1); comp.setSize(W, H);
  comp.addPass(new RenderPass(scene, cam));
  comp.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.65, 0.7, 0.82));
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, sat: { value: sat }, res: { value: new THREE.Vector2(W, H) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse;uniform float time,sat;uniform vec2 res;varying vec2 vUv; float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
 void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; float l=dot(c,vec3(.2126,.7152,.0722)); vec3 mono=vec3(l)*vec3(.94,.98,1.05);
  float red=smoothstep(.78,.92,(c.r-max(c.g,c.b))/max(c.r,1e-4))*smoothstep(.03,.1,c.r);
  vec3 col=mix(mix(mono,c,sat),vec3(c.r*1.25,c.g*.6,c.b*.6),red);
  vec2 d=vUv-.5; col*=mix(.5,1.,smoothstep(.9,.25,length(d*vec2(1.,res.y/res.x))*1.25)); col+=(h(vUv*res+time)-.5)*.035; gl_FragColor=vec4(col,1.);}`,
  });
  comp.addPass(grade); comp.addPass(new OutputPass());
  return { comp, grade };
}
