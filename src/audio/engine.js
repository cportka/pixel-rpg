// Playback for the 8bit-sfx library.
//
// v0.16 retired this file's hand-rolled Web Audio synth: sounds are now
// synthesized by the vendored 8bit-sfx 1.0.0 engine (vendor/8bit-sfx), the
// same code that produced the library's published `rpg` category — so the
// game and the library can never drift, and the library's 202 procedural RPG
// effects are available to us for spells and battle stingers.
//
// Each effect is rendered once to an AudioBuffer and cached; playback is a
// buffer source through a gain node. The context is created lazily on
// resume() (browsers require a user gesture), so play() is a no-op until
// then, and while muted.

import { render, SR } from '../../vendor/8bit-sfx/index.js';
import { SOUNDS } from './sfx.js';

const MASTER_GAIN = 0.45;

export class AudioPlayer {
  /** @param {() => AudioContext} createContext test seam; defaults to WebAudio */
  constructor(createContext) {
    this.createContext =
      createContext ?? (() => new (window.AudioContext || window.webkitAudioContext)());
    this.ctx = null;
    this.master = null;
    this.buffers = new Map(); // effect name -> AudioBuffer
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

  /**
   * Synthesize (once) and cache an effect as an AudioBuffer. The library
   * renders at its own sample rate; the buffer carries that rate so the
   * context resamples on playback.
   */
  buffer(effect) {
    let buf = this.buffers.get(effect);
    if (!buf) {
      const samples = render(effect);
      buf = this.ctx.createBuffer(1, samples.length, SR);
      buf.getChannelData(0).set(samples);
      this.buffers.set(effect, buf);
    }
    return buf;
  }

  /** Play a named game event. No-op when unknown, muted, or asleep. */
  play(name) {
    const sound = SOUNDS[name];
    if (!sound || this.muted || !this.ctx) return;
    const gain = this.ctx.createGain();
    gain.gain.value = Math.min(1, sound.gain * this.intensity);
    gain.connect(this.master);
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer(sound.name);
    src.connect(gain);
    src.start();
  }
}
