// A thin facade over the synth. Browsers only let an AudioContext start after a
// click or key press, so nothing is played (and no AudioContext is created)
// until the first such gesture, even though sound is on by default.
import type { SfxName } from './synth';

type Synth = typeof import('./synth');
let synth: Synth | null = null;
let loading: Promise<Synth> | null = null;
let gestured = false;

const enabled = () => document.documentElement.dataset.sound === 'on';

function load() {
  loading ??= import('./synth').then((m) => (synth = m));
  return loading;
}

export function sfx(name: SfxName, arg?: number) {
  if (!enabled() || !gestured) return;
  if (synth) synth.play(name, arg);
  else load().then((m) => enabled() && m.play(name, arg));
}

/** Call from a user gesture when sound is switched on. */
export async function unlock() {
  gestured = true;
  const m = await load();
  m.resume();
  document.documentElement.dataset.audio = 'live';
}

export function preloadIfEnabled() {
  const once = () => {
    gestured = true;
    if (enabled()) unlock();
    removeEventListener('pointerdown', once, true);
    removeEventListener('keydown', once, true);
  };
  addEventListener('pointerdown', once, { passive: true, capture: true });
  addEventListener('keydown', once, true);
  if (enabled()) (window.requestIdleCallback ?? setTimeout)(() => load());
}
