// ---------------------------------------------------------------------------
// A tiny synthesised sound bank. No files: every effect is oscillators and
// filtered noise, built on demand. The context cannot start until the player
// interacts with the page, so `unlock()` is called from the first input event.
// ---------------------------------------------------------------------------

import { AUDIO } from './config';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let sizzleGain: GainNode | null = null;
let muted = false;

try {
  muted = localStorage.getItem('gg-muted') === '1';
} catch {
  muted = false;
}

export function isMuted(): boolean {
  return muted;
}

function makeNoise(c: AudioContext): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Starts the always-on sizzle bed, gated to silence until the pod is cooking. */
function startSizzle(c: AudioContext, out: GainNode, buffer: AudioBuffer): GainNode {
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1650;
  band.Q.value = 0.8;

  const gain = c.createGain();
  gain.gain.value = 0;

  src.connect(band).connect(gain).connect(out);
  src.start();
  return gain;
}

/** Safe to call on every input event; only the first one does anything. */
export function unlock(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : AUDIO.master;
    master.connect(ctx.destination);
    noiseBuffer = makeNoise(ctx);
    sizzleGain = startSizzle(ctx, master, noiseBuffer);
  } catch {
    ctx = null;
  }
}

export function toggleMute(): boolean {
  muted = !muted;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : AUDIO.master, ctx.currentTime, 0.02);
  try {
    localStorage.setItem('gg-muted', muted ? '1' : '0');
  } catch {
    // storage is optional
  }
  return muted;
}

/** 0..1 — how hard the payload is currently roasting. */
export function setSizzle(amount: number): void {
  if (!ctx || !sizzleGain) return;
  const target = Math.max(0, Math.min(1, amount)) * AUDIO.sizzleGain;
  sizzleGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
}

interface ToneOptions {
  type?: OscillatorType;
  to?: number;
  gain?: number;
  attack?: number;
  delay?: number;
}

function tone(freq: number, dur: number, opts: ToneOptions = {}): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const peak = opts.gain ?? 0.5;

  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + dur);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function hit(dur: number, freq: number, gain = 0.5, type: BiquadFilterType = 'lowpass'): void {
  if (!ctx || !master || !noiseBuffer || muted) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.25), t0 + dur);

  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const sfx = {
  launch(power: number): void {
    hit(0.32, 900 + power * 900, 0.35);
    tone(180 + power * 120, 0.34, { type: 'sawtooth', to: 70, gain: 0.32 });
  },
  pickup(): void {
    tone(880, 0.10, { type: 'triangle', gain: 0.30 });
    tone(1320, 0.14, { type: 'triangle', gain: 0.24, delay: 0.06 });
  },
  capture(): void {
    hit(0.24, 520, 0.45);
    tone(150, 0.26, { type: 'sine', to: 88, gain: 0.42 });
    tone(660, 0.30, { type: 'sine', to: 990, gain: 0.16, delay: 0.06 });
  },
  relaunch(power: number): void {
    tone(210, 0.30, { type: 'square', to: 620 + power * 380, gain: 0.20 });
    hit(0.20, 1500, 0.25, 'highpass');
  },
  serve(tier: number): void {
    const root = 392;
    const steps = tier >= 2 ? [1, 1.25, 1.5, 2] : [1, 1.25, 1.5];
    steps.forEach((m, i) => {
      tone(root * m, 0.22, { type: 'triangle', gain: 0.30, delay: i * 0.07 });
    });
  },
  reject(): void {
    tone(210, 0.34, { type: 'sawtooth', to: 90, gain: 0.30 });
    tone(197, 0.34, { type: 'square', to: 84, gain: 0.18 });
  },
  vaporise(): void {
    hit(0.55, 2600, 0.55, 'bandpass');
    tone(320, 0.5, { type: 'sawtooth', to: 60, gain: 0.26 });
  },
  drift(): void {
    tone(300, 0.6, { type: 'sine', to: 70, gain: 0.18 });
  },
  growl(): void {
    tone(78, 0.45, { type: 'sawtooth', to: 54, gain: 0.26 });
    tone(117, 0.40, { type: 'square', to: 82, gain: 0.10 });
  },
  roar(): void {
    tone(140, 0.55, { type: 'sawtooth', to: 46, gain: 0.34 });
    tone(72, 0.55, { type: 'square', to: 38, gain: 0.22 });
    hit(0.45, 780, 0.30, 'bandpass');
  },
  stage(): void {
    hit(0.16, 700, 0.40);
    tone(120, 0.18, { type: 'square', to: 60, gain: 0.22 });
  },
  win(): void {
    [392, 494, 587, 784].forEach((f, i) => {
      tone(f, 0.42, { type: 'triangle', gain: 0.32, delay: i * 0.11 });
    });
  },
  lose(): void {
    [330, 262, 208, 147].forEach((f, i) => {
      tone(f, 0.5, { type: 'sawtooth', gain: 0.26, delay: i * 0.14 });
    });
  },
};
