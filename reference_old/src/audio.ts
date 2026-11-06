/** All sound is synthesized with Web Audio: no files. */
export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode; rainG!: GainNode; humG!: GainNode; droneG!: GainNode; padG!: GainNode; droneOsc!: OscillatorNode; padOsc: OscillatorNode[] = [];
  muted = false;

  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const C = (window.AudioContext || (window as any).webkitAudioContext); if (!C) return;
    const ctx = (this.ctx = new C()); this.master = ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(ctx.destination);
    const noise = (sec: number) => { const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
    // rain: bandpassed noise
    const rn = ctx.createBufferSource(); rn.buffer = noise(3); rn.loop = true;
    const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 3200; rf.Q.value = 0.4;
    this.rainG = ctx.createGain(); this.rainG.gain.value = 0.12; rn.connect(rf).connect(this.rainG).connect(this.master); rn.start();
    // city hum: two detuned low saws through lowpass with slow LFO
    this.humG = ctx.createGain(); this.humG.gain.value = 0.09;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    for (const f of [55, 55.7, 82.4]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 60; lfo.connect(lg).connect(lp.frequency); lfo.start();
    lp.connect(this.humG).connect(this.master);
    // drone whine
    this.droneOsc = ctx.createOscillator(); this.droneOsc.type = 'triangle'; this.droneOsc.frequency.value = 420;
    const vib = ctx.createOscillator(); vib.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = 14; vib.connect(vg).connect(this.droneOsc.frequency); vib.start();
    this.droneG = ctx.createGain(); this.droneG.gain.value = 0; this.droneOsc.connect(this.droneG).connect(this.master); this.droneOsc.start();
    // tension pad
    this.padG = ctx.createGain(); this.padG.gain.value = 0;
    for (const f of [110, 130.8, 164.8]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(this.padG); o.start(); this.padOsc.push(o); }
    this.padG.connect(this.master);
  }

  /** per-frame mood: rain level, drones (off while charging 20:00-20:30), tension grows toward 22:00 and with anomalies */
  update(now: number, raining: boolean, anomalies: number, speed: number) {
    if (!this.ctx) return; const ct = this.ctx.currentTime;
    const charging = now >= 20 * 3600 && now < 20.5 * 3600;
    this.rainG.gain.setTargetAtTime(raining ? 0.2 : 0.09, ct, 1);
    this.droneG.gain.setTargetAtTime(charging || Math.sin(now / 90) < 0.3 ? 0 : 0.012, ct, 1.5);
    const tension = Math.min(1, Math.max(0, (now - 18 * 3600) / (4 * 3600)) * 0.6 + Math.min(anomalies, 10) * 0.04);
    this.padG.gain.setTargetAtTime(tension * 0.05, ct, 2);
    this.master.gain.setTargetAtTime(this.muted ? 0 : speed > 4 ? 0.3 : 0.5, ct, 0.2);
  }

  /** time-jump sound: back = falling filtered sweep, forward = rising */
  jump(back: boolean) {
    if (!this.ctx) return; const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; const g = ctx.createGain(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 8;
    o.frequency.setValueAtTime(back ? 900 : 90, t0); o.frequency.exponentialRampToValueAtTime(back ? 60 : 1100, t0 + 0.9);
    f.frequency.setValueAtTime(back ? 4000 : 300, t0); f.frequency.exponentialRampToValueAtTime(back ? 200 : 5000, t0 + 0.9);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1);
    o.connect(f).connect(g).connect(this.master); o.start(t0); o.stop(t0 + 1.05);
  }
  private noiseBuf: AudioBuffer | null = null;
  private noise() { if (!this.noiseBuf && this.ctx) { const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b; } return this.noiseBuf!; }
  /** wet footstep: short low-passed noise burst */
  step(run: boolean) {
    if (!this.ctx || this.muted) return; const ctx = this.ctx, t0 = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = this.noise();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600 + Math.random() * 500; f.Q.value = 1.2; const g = ctx.createGain();
    g.gain.setValueAtTime(run ? 0.09 : 0.05, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    src.connect(f).connect(g).connect(this.master); src.start(t0, Math.random()); src.stop(t0 + 0.13);
  }
  private eng: { o: OscillatorNode; o2: OscillatorNode; g: GainNode; f: BiquadFilterNode } | null = null;
  /** engine: two detuned saws through a lowpass, pitch follows speed */
  engine(speed: number) {
    if (!this.ctx) return; const ctx = this.ctx;
    if (!this.eng) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = o2.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g).connect(this.master); o.start(); o2.start(); this.eng = { o, o2, g, f }; }
    const t0 = ctx.currentTime, on = speed > 0.01 || false;
    this.eng.o.frequency.setTargetAtTime(38 + speed * 3.2, t0, 0.1); this.eng.o2.frequency.setTargetAtTime(38.7 + speed * 3.25, t0, 0.1);
    this.eng.f.frequency.setTargetAtTime(220 + speed * 40, t0, 0.1); this.eng.g.gain.setTargetAtTime(on ? 0.05 + speed * 0.002 : 0, t0, 0.2);
  }
  shot(silenced: boolean) {
    if (!this.ctx) return; const ctx = this.ctx, t0 = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = this.noise();
    const f = ctx.createBiquadFilter(); f.type = silenced ? 'bandpass' : 'lowpass'; f.frequency.value = silenced ? 2400 : 1800; const g = ctx.createGain();
    g.gain.setValueAtTime(silenced ? 0.25 : 0.9, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (silenced ? 0.12 : 0.6));
    src.connect(f).connect(g).connect(this.master); src.start(t0); src.stop(t0 + 0.7);
  }
  /** thunder: long low rumble */
  thunder() {
    if (!this.ctx) return; const ctx = this.ctx, t0 = ctx.currentTime + 0.4 + Math.random(), src = ctx.createBufferSource(); src.buffer = this.noise(); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140; const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4);
    src.connect(f).connect(g).connect(this.master); src.start(t0); src.stop(t0 + 4.1);
  }
  blip(freq = 880) {
    if (!this.ctx) return; const ctx = this.ctx, t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = freq; g.gain.setValueAtTime(0.06, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + 0.13);
  }
}
