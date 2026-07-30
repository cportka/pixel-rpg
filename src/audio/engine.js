// A tiny Web Audio chip-synth for the SOUNDS table.
//
// The context is created lazily on resume() (browsers require a user
// gesture before audio can start); play() is a no-op until then, and while
// muted. Noise comes from one shared LCG-filled buffer — deterministic,
// no Math.random — pushed through a swept bandpass.

import { SOUNDS } from './sfx.js';

const MASTER_GAIN = 0.4;

export class AudioPlayer {
  /** @param {() => AudioContext} createContext test seam; defaults to WebAudio */
  constructor(createContext) {
    this.createContext =
      createContext ?? (() => new (window.AudioContext || window.webkitAudioContext)());
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.muted = false;
    this.intensity = 1; // >1 while the pipe's colors lean closer
  }

  /** Build (or wake) the context. Safe to call on every input event. */
  resume() {
    if (!this.ctx) {
      this.ctx = this.createContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER_GAIN;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** Half a second of deterministic white noise, built once. */
  noiseBuffer() {
    if (!this.noiseBuf) {
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * 0.5));
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      let s = 1234567;
      for (let i = 0; i < len; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        data[i] = s / 0x3fffffff - 1;
      }
    }
    return this.noiseBuf;
  }

  /** Play a named sound from the table. No-op when unknown, muted, or asleep. */
  play(name) {
    const segments = SOUNDS[name];
    if (!segments || this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (const seg of segments) this.playSegment(seg, now + (seg.t ?? 0));
  }

  playSegment(seg, at) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.25, seg.v * this.intensity), at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + seg.d);
    gain.connect(this.master);

    if (seg.type === 'noise') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1;
      filter.frequency.setValueAtTime(seg.f0, at);
      filter.frequency.linearRampToValueAtTime(seg.f1 ?? seg.f0, at + seg.d);
      src.connect(filter);
      filter.connect(gain);
      src.start(at);
      src.stop(at + seg.d);
    } else {
      const osc = this.ctx.createOscillator();
      osc.type = seg.wave;
      osc.frequency.setValueAtTime(seg.f0, at);
      osc.frequency.linearRampToValueAtTime(seg.f1 ?? seg.f0, at + seg.d);
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + seg.d);
    }
  }
}
