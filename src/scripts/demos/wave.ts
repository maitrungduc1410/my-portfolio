// waveform-player style scrubbing: bars are a deterministic pseudo-audio
// envelope; dragging moves the playhead and ticks at the bar's loudness.
import { cssVar, onTheme, strings, motionOn } from '../store';
import { sfx } from '../sound';

const DURATION = 24;

export function init(root: HTMLElement) {
  const host = root.querySelector<HTMLElement>('[data-wave-cv]')!;
  const cv = host.querySelector('canvas')!;
  const ctx = cv.getContext('2d')!;
  const playBtn = root.querySelector<HTMLButtonElement>('[data-wave-play]')!;
  const time = root.querySelector<HTMLElement>('[data-wave-time]')!;
  const BARS = 96;
  const amps = Array.from({ length: BARS }, (_, i) => {
    const env = Math.sin((i / BARS) * Math.PI) * 0.6 + 0.4;
    const beat = i % 8 === 0 ? 0.35 : 0;
    const n = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    return Math.min(1, Math.max(0.08, env * (0.45 + Math.abs(n) * 0.55) + beat));
  });
  let pos = 0, playing = false, raf = 0, last = 0, W = 0, H = 0, lastBar = -1;
  let col = { acc: '', dim: '' };
  const readCol = () => (col = { acc: cssVar('--acc', root), dim: cssVar('--line-2') });

  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = host.clientWidth; H = host.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    const pad = 16, bw = (W - pad * 2) / BARS, mid = H / 2;
    for (let i = 0; i < BARS; i++) {
      const h = Math.max(2, amps[i] * (H - 36));
      const played = i / BARS < pos;
      ctx.fillStyle = played ? col.acc : col.dim;
      ctx.beginPath();
      ctx.roundRect(pad + i * bw + bw * 0.18, mid - h / 2, Math.max(1, bw * 0.64), h, 2);
      ctx.fill();
    }
    const x = pad + pos * (W - pad * 2);
    ctx.fillStyle = col.acc;
    ctx.fillRect(x - 1, 8, 2, H - 16);
    ctx.beginPath(); ctx.arc(x, 10, 5, 0, 7); ctx.fill();
    time.textContent = `${fmt(pos * DURATION)} / ${fmt(DURATION)}`;
    host.setAttribute('aria-valuenow', String(Math.round(pos * 100)));
    host.setAttribute('aria-valuetext', fmt(pos * DURATION));
  }
  function setPos(p: number, audible = true) {
    pos = Math.min(1, Math.max(0, p));
    const bar = Math.min(BARS - 1, Math.floor(pos * BARS));
    if (audible && bar !== lastBar) sfx('tick', amps[bar]);
    lastBar = bar;
    draw();
  }
  const loop = (t: number) => {
    const dt = (t - last) / 1000; last = t;
    setPos(pos + dt / DURATION, false);
    if (pos >= 1) { setPlaying(false); return; }
    raf = requestAnimationFrame(loop);
  };
  function setPlaying(v: boolean) {
    playing = v;
    playBtn.textContent = v ? strings.demos.wave.pause : strings.demos.wave.play;
    playBtn.setAttribute('aria-pressed', String(v));
    cancelAnimationFrame(raf);
    if (v) { if (pos >= 1) pos = 0; last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  playBtn.addEventListener('click', () => setPlaying(!playing));

  let dragging = false;
  const at = (e: PointerEvent) => { const r = host.getBoundingClientRect(); return (e.clientX - r.left - 16) / (r.width - 32); };
  host.addEventListener('pointerdown', (e) => { dragging = true; host.setPointerCapture(e.pointerId); setPos(at(e)); });
  host.addEventListener('pointermove', (e) => { if (dragging) setPos(at(e)); });
  host.addEventListener('pointerup', () => (dragging = false));
  host.addEventListener('pointercancel', () => (dragging = false));
  host.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.1 : 1 / BARS;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setPos(pos + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setPos(pos - step);
    else if (e.key === 'Home') setPos(0);
    else if (e.key === 'End') setPos(1);
    else if (e.key === ' ' || e.key === 'Enter') setPlaying(!playing);
    else return;
    e.preventDefault();
  });

  onTheme(() => { readCol(); draw(); });
  readCol();
  new ResizeObserver(size).observe(host);
  return {
    start: () => { if (playing && motionOn()) setPlaying(true); },
    stop: () => cancelAnimationFrame(raf),
  };
}
