import { A } from '../render/materials';
/** WebAudio: synthesised rain/wind/fire (spec 14) + a few one-shots from the pack */
export class Sound {
  ctx?: AudioContext; master?: GainNode; rain?: GainNode; fire?: GainNode; lowpass?: BiquadFilterNode; buffers = new Map<string, AudioBuffer>(); muffled = false;
  init() {
    if (this.ctx) return; try {
      const c = this.ctx = new AudioContext(); this.master = c.createGain(); this.master.gain.value = 0.7; this.master.connect(c.destination);
      this.lowpass = c.createBiquadFilter(); this.lowpass.type = 'lowpass'; this.lowpass.frequency.value = 18000; this.lowpass.connect(this.master);
      const noise = (secs: number) => { const b = c.createBuffer(1, c.sampleRate * secs, c.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 + w * 0.15; } return b; };
      const mk = (freq: number, q: number, gain: number, type: BiquadFilterType) => { const s = c.createBufferSource(); s.buffer = noise(4); s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(this.lowpass!); s.start(); return g; };
      this.rain = mk(3600, 0.4, 0.22, 'highpass'); mk(420, 0.6, 0.18, 'lowpass'); this.fire = mk(260, 0.8, 0.0, 'lowpass');
    } catch { /* no audio */ }
  }
  async load(name: string) { if (!this.ctx) return null; if (this.buffers.has(name)) return this.buffers.get(name)!; try { const r = await fetch(A + 'audio/' + name); const b = await this.ctx.decodeAudioData(await r.arrayBuffer()); this.buffers.set(name, b); return b; } catch { return null; } }
  async play(name: string, vol = 0.8, rate = 1) { if (!this.ctx) return; const b = await this.load(name); if (!b) return; const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(this.lowpass ?? this.ctx.destination); s.start(); }
  /** short synthesised thud / shot / boom */
  boom(vol = 0.9, dur = 0.8, f0 = 90) { if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, c.currentTime); o.frequency.exponentialRampToValueAtTime(25, c.currentTime + dur); g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur); o.connect(g); g.connect(this.master!); o.start(); o.stop(c.currentTime + dur); }
  shot() { this.boom(0.6, 0.18, 220); this.play('impact/impact_generic_light_000', 0.4); }
  setMuffled(on: boolean) { if (this.lowpass && this.ctx) this.lowpass.frequency.setTargetAtTime(on ? 700 : 18000, this.ctx.currentTime, 0.12); }
  setFire(k: number) { if (this.fire && this.ctx) this.fire.gain.setTargetAtTime(Math.min(0.35, k * 0.3), this.ctx.currentTime, 0.5); }
}
