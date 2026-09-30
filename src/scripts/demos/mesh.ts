// socket.io-mesh-adapter vs a broker: N pods on a ring. In mesh mode every pod
// holds a link to every other pod (N(N-1)/2 links) and a broadcast is one hop;
// with a broker there are only N links but every message takes two hops.
import { cssVar, onTheme } from '../store';
import { sfx } from '../sound';

interface Packet { from: number; to: number; via: boolean; t: number; hop: 0 | 1 }

export function init(root: HTMLElement) {
  const cv = root.querySelector<HTMLCanvasElement>('[data-mesh-cv]')!;
  const ctx = cv.getContext('2d')!;
  const range = root.querySelector<HTMLInputElement>('[data-k="nodes"]')!;
  const nLabel = root.querySelector<HTMLElement>('[data-mesh-n]')!;
  const linksEl = root.querySelector<HTMLElement>('[data-mesh-links]')!;
  const hopsEl = root.querySelector<HTMLElement>('[data-mesh-hops]')!;
  const modeBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-mesh-mode]')];
  let mode: 'mesh' | 'broker' = 'mesh';
  let n = +range.value;
  let W = 0, H = 0, raf = 0, running = false, last = 0;
  let packets: Packet[] = [];
  let flash: number[] = [];
  let col = { acc: '', ink: '', dim: '', line: '', bg: '' };
  const readCol = () => (col = { acc: cssVar('--acc', root), ink: cssVar('--ink'), dim: cssVar('--ink-3'), line: cssVar('--line-2'), bg: cssVar('--bg-2') });

  const pos = (i: number) => {
    const r = Math.min(W, H) * 0.36;
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: W / 2 + Math.cos(a) * r, y: H / 2 + 8 + Math.sin(a) * r };
  };
  const hub = () => ({ x: W / 2, y: H / 2 + 8 });

  function stats() {
    linksEl.textContent = String(mode === 'mesh' ? (n * (n - 1)) / 2 : n);
    hopsEl.textContent = mode === 'mesh' ? '1' : '2';
    nLabel.textContent = String(n);
  }

  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = col.line;
    ctx.beginPath();
    if (mode === 'mesh') {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const a = pos(i), b = pos(j); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    } else {
      const h = hub();
      for (let i = 0; i < n; i++) { const a = pos(i); ctx.moveTo(a.x, a.y); ctx.lineTo(h.x, h.y); }
    }
    ctx.stroke();
    if (mode === 'broker') {
      const h = hub();
      ctx.fillStyle = col.bg; ctx.strokeStyle = col.dim; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(h.x - 30, h.y - 13, 60, 26, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col.ink; ctx.font = '600 11px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('redis', h.x, h.y);
    }
    for (const p of packets) {
      const a = p.via && p.hop === 1 ? hub() : pos(p.from);
      const b = p.via && p.hop === 0 ? hub() : pos(p.to);
      const t = Math.min(1, p.t);
      ctx.fillStyle = col.acc;
      ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 4, 0, 7); ctx.fill();
    }
    for (let i = 0; i < n; i++) {
      const p = pos(i);
      const f = flash[i] ?? 0;
      ctx.fillStyle = col.bg;
      ctx.strokeStyle = f > 0 ? col.acc : col.dim;
      ctx.lineWidth = 1.5 + f * 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 13 + f * 3, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = f > 0 ? col.acc : col.ink;
      ctx.font = '600 10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`p${i}`, p.x, p.y + 0.5);
    }
  }

  const loop = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    const speed = 2.2;
    const next: Packet[] = [];
    for (const p of packets) {
      p.t += dt * speed;
      if (p.t < 1) { next.push(p); continue; }
      if (p.via && p.hop === 0) { next.push({ ...p, hop: 1, t: 0 }); continue; }
      flash[p.to] = 1;
      sfx('ping', p.to % 8);
    }
    packets = next;
    flash = flash.map((f) => Math.max(0, f - dt * 2.5));
    draw();
    if (packets.length || flash.some((f) => f > 0)) raf = requestAnimationFrame(loop);
    else running = false;
  };
  const kick = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); };

  function emit(from = Math.floor(Math.random() * n)) {
    flash[from] = 1;
    for (let i = 0; i < n; i++) if (i !== from) packets.push({ from, to: i, via: mode === 'broker', t: 0, hop: 0 });
    sfx('click');
    kick();
  }

  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };

  modeBtns.forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.meshMode as 'mesh' | 'broker';
    modeBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    packets = [];
    stats(); draw();
  }));
  range.addEventListener('input', () => { n = +range.value; packets = []; flash = []; stats(); draw(); sfx('tick', n / 12); });
  root.querySelector('[data-mesh-emit]')!.addEventListener('click', () => emit());
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    for (let i = 0; i < n; i++) { const p = pos(i); if (Math.hypot(p.x - x, p.y - y) < 18) { emit(i); return; } }
  });

  onTheme(() => { readCol(); draw(); });
  readCol();
  stats();
  new ResizeObserver(size).observe(cv);
  return { stop: () => { cancelAnimationFrame(raf); running = false; } };
}
