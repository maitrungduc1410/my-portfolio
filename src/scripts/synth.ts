// UI sound design, synthesised live with Web Audio. No audio files.
// Every voice is a few oscillators or a noise burst through an envelope,
// routed through one master gain and a gentle compressor, with an analyser
// on the way out that drives the nav visualizer.
import { attachViz, kickViz } from './soundviz';

export type SfxName =
  | 'hover'
  | 'click'
  | 'toggleOn'
  | 'toggleOff'
  | 'layer'
  | 'key'
  | 'enter'
  | 'error'
  | 'spring'
  | 'success'
  | 'open'
  | 'close'
  | 'tick'
  | 'ink'
  | 'ping'
  | 'letter'
  | 'chord';

const MASTER = 0.32;
let ctx: AudioContext | null = null;
let out: GainNode;
let noiseBuf: AudioBuffer;
const lastAt: Partial<Record<SfxName, number>> = {};
// Minimum spacing per voice, so fast pointer movement never turns into a buzz.
const THROTTLE: Partial<Record<SfxName, number>> = { letter: 40, chord: 400, hover: 55, key: 22, tick: 30, ink: 45, layer: 250 };

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  out = ctx.createGain();
  out.gain.value = MASTER;
  const an = ctx.createAnalyser();
  an.fftSize = 64;
  an.smoothingTimeConstant = 0.55;
  out.connect(comp).connect(an).connect(ctx.destination);
  attachViz(an);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export function resume() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function env(g: GainNode, t: number, a: number, peak: number, dur: number) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0, attack = 0.004) {
  const c = ctx!;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, attack, peak, dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, peak: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', delay = 0, sweepTo?: number) {
  const c = ctx!;
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  env(g, t, 0.003, peak, dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.3);
  s.stop(t + dur + 0.02);
}

// Pentatonic-ish pitch per layer: deeper layers sound lower.
const LAYER_HZ = [659.25, 523.25, 440, 349.23, 261.63];

export function play(name: SfxName, arg = 0) {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const now = performance.now();
  const gap = THROTTLE[name];
  if (gap && now - (lastAt[name] ?? 0) < gap) return;
  lastAt[name] = now;
  kickViz();

  switch (name) {
    case 'hover':
      tone('sine', 1760, 1900, 0.05, 0.05);
      break;
    case 'click':
      tone('triangle', 720, 360, 0.08, 0.16);
      noise(0.02, 0.05, 3000, 2);
      break;
    case 'toggleOn':
      tone('sine', 523.25, 523.25, 0.09, 0.14);
      tone('sine', 783.99, 783.99, 0.14, 0.14, 0.07);
      break;
    case 'toggleOff':
      tone('sine', 783.99, 783.99, 0.09, 0.12);
      tone('sine', 523.25, 523.25, 0.14, 0.12, 0.07);
      break;
    case 'layer': {
      const f = LAYER_HZ[Math.max(0, Math.min(4, arg))];
      noise(0.45, 0.06, 1800, 0.7, 'bandpass', 0, 300);
      tone('sine', f * 1.5, f, 0.35, 0.09, 0.02, 0.02);
      tone('triangle', f / 2, f / 2, 0.4, 0.05, 0.04, 0.03);
      break;
    }
    case 'key':
      noise(0.025, 0.09, 2400 + Math.random() * 1600, 3);
      tone('square', 180 + Math.random() * 40, 120, 0.018, 0.015);
      break;
    case 'enter':
      noise(0.04, 0.1, 1400, 2);
      tone('triangle', 440, 660, 0.09, 0.1, 0.01);
      break;
    case 'error':
      tone('sawtooth', 160, 110, 0.18, 0.06);
      tone('square', 120, 90, 0.2, 0.03, 0.02);
      break;
    case 'spring': {
      // arg: release speed 0..1 → more energy, higher and longer wobble
      const e = Math.max(0.15, Math.min(1, arg));
      const t = c.currentTime;
      const o = c.createOscillator();
      const lfo = c.createOscillator();
      const lg = c.createGain();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(220 + 260 * e, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.5);
      lfo.frequency.setValueAtTime(9 + 8 * e, t);
      lfo.frequency.linearRampToValueAtTime(4, t + 0.5);
      lg.gain.setValueAtTime(40 * e, t);
      lg.gain.exponentialRampToValueAtTime(1, t + 0.5);
      lfo.connect(lg).connect(o.frequency);
      env(g, t, 0.006, 0.14, 0.55);
      o.connect(g).connect(out);
      o.start(t); lfo.start(t);
      o.stop(t + 0.6); lfo.stop(t + 0.6);
      break;
    }
    case 'success':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone('triangle', f, f, 0.18, 0.11, i * 0.07));
      break;
    case 'open':
      noise(0.14, 0.05, 600, 0.8, 'lowpass', 0, 4000);
      tone('sine', 392, 587.33, 0.12, 0.07);
      break;
    case 'close':
      noise(0.12, 0.04, 4000, 0.8, 'lowpass', 0, 500);
      tone('sine', 587.33, 392, 0.1, 0.06);
      break;
    case 'tick':
      tone('square', 1200 + arg * 1400, 1200 + arg * 1400, 0.012, 0.03);
      break;
    case 'ink':
      noise(0.05, 0.03, 5200, 0.6, 'highpass');
      break;
    case 'ping':
      tone('sine', 880 + arg * 90, 880 + arg * 90, 0.12, 0.06);
      break;
    case 'letter': {
      // arg: position in the headline 0..1, mapped onto two octaves of a
      // major pentatonic so any sweep sounds like a phrase, never a clash.
      const steps = [0, 2, 4, 7, 9];
      const n = Math.round(Math.max(0, Math.min(1, arg)) * 9);
      const f = 523.25 * 2 ** ((steps[n % 5] + 12 * Math.floor(n / 5)) / 12);
      tone('sine', f, f, 0.14, 0.035, 0, 0.006);
      tone('triangle', f * 2, f * 2, 0.06, 0.01, 0, 0.004);
      break;
    }
    case 'chord':
      // Cmaj9, rolled: a friendly "sound works" cue.
      tone('sine', 261.63, 261.63, 1.2, 0.05, 0, 0.02);
      [523.25, 659.25, 783.99, 987.77, 1174.66].forEach((f, i) => tone('triangle', f, f, 0.9 - i * 0.08, 0.045, i * 0.06, 0.01));
      break;
  }
}
