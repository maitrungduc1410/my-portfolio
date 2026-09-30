// Performance HUD: the successor of the old frame timeline. It measures the
// visitor's own browser, snaps the refresh rate to a real display rate, draws
// the budget line for it, and keeps the "Inject jank" button so the
// instrument can be seen reacting to something.
import { cssVar, onTheme, strings } from './store';
import { sfx } from './sound';

const el = document.getElementById('hud')!;
const cv = el.querySelector<HTMLCanvasElement>('#hud-cv')!;
const ctx = cv.getContext('2d')!;
const fpsEl = el.querySelector('#hud-fps')!;
const p95El = el.querySelector('#hud-p95')!;
const hzEl = el.querySelector('#hud-hz')!;
const jankBtn = el.querySelector<HTMLButtonElement>('#hud-jank')!;
const miniEl = el.querySelector('#hud-mini')!;
const expand = el.querySelector<HTMLButtonElement>('[data-hud-expand]')!;
expand.addEventListener('click', () => {
  const mini = !el.hasAttribute('data-mini');
  el.toggleAttribute('data-mini', mini);
  expand.setAttribute('aria-expanded', String(!mini));
  sfx(mini ? 'close' : 'open');
  if (!mini) { size(); draw(); }
});

const N = 90;
const frames: number[] = [];
let running = false;
let raf = 0;
let last = 0;
let hz = 60;
let calibrated = false;
let jankUntil = 0;
let frameIdx = 0;
let lastRead = 0;
let W = 0, H = 0;
let colors = { ink: '', dim: '', acc: '', warn: '', ok: '' };

function readColors() {
  colors = { ink: cssVar('--ink-2'), dim: cssVar('--line-2'), acc: cssVar('--l0'), warn: cssVar('--warn'), ok: cssVar('--ok') };
}

function size() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = cv.clientWidth;
  H = cv.clientHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const snap = (v: number) => [60, 75, 90, 100, 120, 144, 165, 240].reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
const pct = (a: number[], q: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] ?? 0;
};

function draw() {
  if (el.hasAttribute('data-mini')) return;
  if (!W) size();
  const budget = 1000 / hz;
  const max = budget * 3;
  ctx.clearRect(0, 0, W, H);
  const bw = W / N;
  const off = W - frames.length * bw;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const h = Math.max(1, Math.min(H - 2, (f / max) * H));
    ctx.fillStyle = f > budget * 2 ? colors.warn : f > budget * 1.35 ? colors.acc : colors.ink;
    ctx.globalAlpha = f > budget * 1.35 ? 0.95 : 0.35;
    ctx.fillRect(off + i * bw, H - h, Math.max(1, bw - 0.8), h);
  }
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = colors.ok;
  ctx.lineWidth = 1;
  const y = Math.round(H - (budget / max) * H) + 0.5;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  ctx.globalAlpha = 1;
}

function readout(now: number) {
  if (now - lastRead < 250 || frames.length < 5) return;
  lastRead = now;
  const recent = frames.slice(-40);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  fpsEl.textContent = miniEl.textContent = (1000 / mean).toFixed(0);
  p95El.textContent = pct(frames, 0.95).toFixed(1);
  hzEl.textContent = String(hz);
}

// Deliberate main-thread work on every other frame, so the trace alternates.
function burn() {
  if (frameIdx++ & 1) return;
  const t0 = performance.now();
  const dur = 8 + Math.random() * 24;
  let acc = 0;
  while (performance.now() - t0 < dur) acc += Math.random();
  if (acc < 0) throw new Error('unreachable');
}

function tick(now: number) {
  if (!running) return;
  raf = requestAnimationFrame(tick);
  const dt = now - last;
  last = now;
  if (dt > 0 && dt < 400) {
    frames.push(dt);
    if (frames.length > N) frames.shift();
  }
  if (!calibrated && frames.length >= 30) {
    hz = snap(1000 / pct(frames, 0.5));
    calibrated = true;
  }
  if (jankUntil) {
    if (now < jankUntil) burn();
    else stopJank();
  }
  draw();
  readout(now);
}

function stopJank() {
  jankUntil = 0;
  jankBtn.setAttribute('aria-pressed', 'false');
  jankBtn.textContent = strings.hud.jank;
}

jankBtn.addEventListener('click', () => {
  if (jankUntil) { stopJank(); return; }
  jankUntil = performance.now() + 3000;
  jankBtn.setAttribute('aria-pressed', 'true');
  jankBtn.textContent = strings.hud.stop;
  sfx('error');
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(raf); }
  else if (running) { last = performance.now(); raf = requestAnimationFrame(tick); }
});
onTheme(() => { readColors(); draw(); });
new ResizeObserver(() => { size(); draw(); }).observe(cv);

export function start() {
  readColors();
  import('./stage').then((m) => {
    const q = document.getElementById('hud-q');
    if (q) q.textContent = m.currentTier();
  });
  if (running) return;
  running = true;
  last = performance.now();
  raf = requestAnimationFrame(tick);
}

export function stop() {
  running = false;
  cancelAnimationFrame(raf);
  stopJank();
}
