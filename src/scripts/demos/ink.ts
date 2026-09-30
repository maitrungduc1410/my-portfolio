// signature-ink style pen: stroke width follows pointer speed (and pressure
// where the device reports it), smoothed with quadratic midpoints.
import { cssVar, onTheme } from '../store';
import { sfx } from '../sound';

interface Pt { x: number; y: number; w: number }

export function init(root: HTMLElement) {
  const cv = root.querySelector<HTMLCanvasElement>('[data-ink-cv]')!;
  const ph = root.querySelector<HTMLElement>('[data-ink-ph]')!;
  const ctx = cv.getContext('2d')!;
  const strokes: Pt[][] = [];
  let cur: Pt[] | null = null;
  let lastT = 0, lastW = 3, W = 0, H = 0;
  let color = '';

  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  };

  function drawStroke(s: Pt[]) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (s.length === 1) {
      ctx.beginPath(); ctx.arc(s[0].x, s[0].y, s[0].w / 2, 0, 7); ctx.fill();
      return;
    }
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      const p0 = i > 1 ? { x: (s[i - 2].x + a.x) / 2, y: (s[i - 2].y + a.y) / 2 } : a;
      const p1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      ctx.lineWidth = (a.w + b.w) / 2;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(a.x, a.y, p1.x, p1.y);
      ctx.stroke();
    }
  }
  function redraw() {
    ctx.clearRect(0, 0, W, H);
    strokes.forEach(drawStroke);
    ph.style.opacity = strokes.length ? '0.35' : '1';
  }

  const point = (e: PointerEvent): Pt => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const now = performance.now();
    const prev = cur?.[cur.length - 1];
    let w = 3.2;
    if (prev) {
      const v = Math.hypot(x - prev.x, y - prev.y) / Math.max(1, now - lastT);
      w = Math.max(1, Math.min(5.5, 5.2 - v * 1.6));
      if (e.pressure && e.pointerType === 'pen') w *= 0.5 + e.pressure;
      w = lastW * 0.6 + w * 0.4;
    }
    lastT = now; lastW = w;
    return { x, y, w };
  };

  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    lastT = performance.now(); lastW = 3.2;
    cur = [];
    cur.push(point(e));
    strokes.push(cur);
    redraw();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const events = e.getCoalescedEvents?.() ?? [e];
    for (const ce of events) cur.push(point(ce));
    const n = cur.length;
    drawStroke(cur.slice(Math.max(0, n - 3)));
    sfx('ink');
  });
  const end = () => { cur = null; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  root.querySelectorAll<HTMLButtonElement>('[data-ink]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.ink;
    if (a === 'undo') strokes.pop();
    else if (a === 'clear') strokes.length = 0;
    else if (a === 'save' && strokes.length) {
      const link = document.createElement('a');
      link.download = 'signature-ducmai-me.png';
      link.href = cv.toDataURL('image/png');
      link.click();
    }
    redraw();
  }));

  onTheme(() => { color = cssVar('--acc', root); redraw(); });
  color = cssVar('--acc', root);
  new ResizeObserver(size).observe(cv);
}
