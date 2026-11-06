// Звук: фильтрованный шум (дождь, вода, огонь), пады в миноре, колокол, шаги и интерфейс из assets/audio.
import { ASSET_BASE } from './render/assets';
import { hrand } from './sim/rng';

export class Sound {
  ctx: AudioContext | null = null; master!: GainNode; rainG!: GainNode; rainF!: BiquadFilterNode; waterG!: GainNode; fireG!: GainNode; humG!: GainNode; padG!: GainNode;
  buffers = new Map<string, Promise<AudioBuffer | null>>(); indoor = 0; private stepT = 0; private bellN = 0; volume = 0.8;
  init() {
    if (this.ctx) return; const Ctx = window.AudioContext || (window as any).webkitAudioContext; if (!Ctx) return;
    const c = (this.ctx = new Ctx()); this.master = c.createGain(); this.master.gain.value = this.volume; this.master.connect(c.destination);
    const noise = (sec: number) => { const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate); const d = b.getChannelData(0); let s = 1234567; for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; } return b; };
    const loop = (buf: AudioBuffer) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    // дождь
    const r = loop(noise(3)); const bp = c.createBiquadFilter(); bp.type = 'highpass'; bp.frequency.value = 700; this.rainF = c.createBiquadFilter(); this.rainF.type = 'lowpass'; this.rainF.frequency.value = 9000; this.rainG = c.createGain(); this.rainG.gain.value = 0.2;
    r.connect(bp); bp.connect(this.rainF); this.rainF.connect(this.rainG); this.rainG.connect(this.master);
    // вода
    const w = loop(noise(4)); const wl = c.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 380; this.waterG = c.createGain(); this.waterG.gain.value = 0; w.connect(wl); wl.connect(this.waterG); this.waterG.connect(this.master);
    // огонь/камин
    const f = loop(noise(2)); const fb = c.createBiquadFilter(); fb.type = 'bandpass'; fb.frequency.value = 1800; fb.Q.value = 0.7; this.fireG = c.createGain(); this.fireG.gain.value = 0; f.connect(fb); fb.connect(this.fireG); this.fireG.connect(this.master);
    // гул механизма
    const h = c.createOscillator(); h.type = 'sawtooth'; h.frequency.value = 55; const hf = c.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 160; this.humG = c.createGain(); this.humG.gain.value = 0; h.connect(hf); hf.connect(this.humG); this.humG.connect(this.master); h.start();
    // пад в миноре (A C E, + D)
    this.padG = c.createGain(); this.padG.gain.value = 0.05; this.padG.connect(this.master);
    for (const [fr, det] of [[110, 0], [130.8, 3], [164.8, -2], [220, 4], [293.7, -3]]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = fr; o.detune.value = det; const g = c.createGain(); g.gain.value = 0.3; const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + hrand(1, fr) * 0.08; const lg = c.createGain(); lg.gain.value = 0.2; lfo.connect(lg); lg.connect(g.gain); lfo.start(); o.connect(g); g.connect(this.padG); o.start(); }
  }
  load(path: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return Promise.resolve(null);
    let b = this.buffers.get(path); if (!b) { b = fetch(ASSET_BASE + 'audio/' + path).then((r) => r.arrayBuffer()).then((a) => this.ctx!.decodeAudioData(a)).catch(() => null); this.buffers.set(path, b); } return b;
  }
  async play(path: string, vol = 0.6, rate = 1) { if (!this.ctx) return; const b = await this.load(path); if (!b) return; const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(this.master); s.start(); }
  ui(n = 1) { this.play(`ui/click${(n % 5) + 1}.ogg`, 0.35); }
  door(open = true) { this.play(open ? `rpg_foley/door_open_${1 + Math.floor(hrand(2, performance.now() | 0) * 2)}.ogg` : `rpg_foley/door_close_${1 + Math.floor(hrand(3, performance.now() | 0) * 4)}.ogg`, 0.6); }
  jump() { this.play('digital/phase_jump' + (1 + Math.floor(hrand(4, performance.now() | 0) * 5)) + '.ogg', 0.8); this.play('digital/phaser_up' + (1 + Math.floor(hrand(5, performance.now() | 0) * 7)) + '.ogg', 0.5); }
  bell() { this.play('impact/impact_bell_heavy_00' + (this.bellN++ % 5), 0.7); }
  metal() { this.play('impact/impact_metal_medium_000', 0.4); }
  coins() { this.play('rpg_foley/handle_coins.ogg', 0.5); }
  step(surface: 'stone' | 'wood' | 'grass', run: boolean, sneak: boolean) { const i = Math.floor(hrand(6, performance.now() | 0) * 5); this.play(`impact/footstep_${surface === 'stone' ? 'concrete' : surface}_00${i}`, sneak ? 0.12 : run ? 0.4 : 0.25, run ? 1.1 : 1); }
  update(dt: number, s: { indoor: boolean; nearWater: boolean; nearFire: number; inTower: boolean; moving: boolean; run: boolean; sneak: boolean; wood: boolean; rain: number }) {
    if (!this.ctx) return; const c = this.ctx;
    this.indoor += ((s.indoor ? 1 : 0) - this.indoor) * Math.min(1, dt * 4);
    this.rainF.frequency.setTargetAtTime(9000 - this.indoor * 8200, c.currentTime, 0.2); this.rainG.gain.setTargetAtTime((0.2 * s.rain) * (1 - this.indoor * 0.6), c.currentTime, 0.3);
    this.waterG.gain.setTargetAtTime(s.nearWater ? 0.18 : 0.04, c.currentTime, 0.5); this.fireG.gain.setTargetAtTime(Math.min(0.5, s.nearFire * 0.5), c.currentTime, 0.3); this.humG.gain.setTargetAtTime(s.inTower ? 0.12 : 0, c.currentTime, 0.5);
    if (s.moving) { this.stepT -= dt; if (this.stepT <= 0) { this.stepT = s.sneak ? 0.62 : s.run ? 0.28 : 0.42; this.step(s.wood ? 'wood' : 'stone', s.run, s.sneak); } } else this.stepT = 0;
  }
}
