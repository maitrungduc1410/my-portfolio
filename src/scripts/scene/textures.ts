// Procedural surface art for each slab, painted into a 2D canvas. Every slab
// shows what lives on that layer: a UI, source code, native views, a Wasm hex
// dump and a frame timeline. No image assets.

export interface Palette {
  accent: string;
  ink: string;
  dim: string;
  light: boolean;
}

export const TEX_W = 512;
export const TEX_H = 366;

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function alpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const MONO = '600 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const MONO_S = '500 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function frame(g: CanvasRenderingContext2D, p: Palette, code: string, name: string) {
  g.clearRect(0, 0, TEX_W, TEX_H);
  const fill = g.createLinearGradient(0, 0, TEX_W, TEX_H);
  fill.addColorStop(0, alpha(p.accent, p.light ? 0.24 : 0.2));
  fill.addColorStop(1, alpha(p.accent, p.light ? 0.08 : 0.04));
  rr(g, 3, 3, TEX_W - 6, TEX_H - 6, 30);
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = alpha(p.accent, 0.95);
  g.stroke();
  g.font = MONO;
  g.fillStyle = p.accent;
  g.fillText(code, 26, TEX_H - 24);
  g.font = MONO_S;
  g.fillStyle = alpha(p.accent, 0.75);
  g.fillText(name, 26 + g.measureText(code).width + 34, TEX_H - 25);
}

function surface(g: CanvasRenderingContext2D, p: Palette) {
  // A phone-ish UI: header, avatar, cards, a primary button.
  const a = (v: number) => alpha(p.accent, v);
  rr(g, 28, 26, 456, 38, 10); g.fillStyle = a(0.22); g.fill();
  g.beginPath(); g.arc(52, 45, 10, 0, 7); g.fillStyle = a(0.8); g.fill();
  rr(g, 72, 39, 120, 12, 6); g.fillStyle = a(0.55); g.fill();
  for (let i = 0; i < 3; i++) {
    const x = 28 + i * 156;
    rr(g, x, 82, 144, 150, 14); g.fillStyle = a(0.1); g.fill();
    g.strokeStyle = a(0.45); g.lineWidth = 2; g.stroke();
    rr(g, x + 12, 94, 120, 70, 8); g.fillStyle = a(0.25); g.fill();
    rr(g, x + 12, 176, 96, 10, 5); g.fillStyle = a(0.6); g.fill();
    rr(g, x + 12, 194, 70, 8, 4); g.fillStyle = a(0.35); g.fill();
  }
  rr(g, 28, 250, 180, 40, 20); g.fillStyle = a(0.85); g.fill();
  rr(g, 222, 250, 120, 40, 20); g.strokeStyle = a(0.6); g.lineWidth = 2; g.stroke();
}

function code(g: CanvasRenderingContext2D, p: Palette) {
  const lines = [
    ['<view', ' className="result"', '>'],
    ['  <list', ' onScroll={track}', '>'],
    ['    {items.map(', 'renderCard', ')}'],
    ['  </list>', '', ''],
    ['const [q, setQ] = ', 'useState', '("")'],
    ['bridge.call(', '"native:prefetch"', ')'],
    ['await ', 'lynx.nextFrame', '()'],
  ];
  g.font = '500 17px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  lines.forEach((l, i) => {
    let x = 30;
    const y = 52 + i * 34;
    g.fillStyle = alpha(p.accent, 0.35);
    g.fillText(String(i + 1).padStart(2, ' '), x, y);
    x += 34;
    const cols = [0.95, 0.6, 0.95];
    l.forEach((part, j) => {
      g.fillStyle = alpha(p.accent, cols[j]);
      g.fillText(part, x, y);
      x += g.measureText(part).width;
    });
  });
}

function native(g: CanvasRenderingContext2D, p: Palette) {
  const a = (v: number) => alpha(p.accent, v);
  const labels = ['UIView', 'ViewGroup', 'CALayer', 'Choreographer', 'Swift', 'Kotlin', 'JSI', 'Fabric'];
  g.font = '600 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  labels.forEach((t, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 28 + col * 116, y = 30 + row * 66;
    rr(g, x, y, 104, 50, 12); g.fillStyle = a(row ? 0.12 : 0.22); g.fill();
    g.strokeStyle = a(0.55); g.lineWidth = 2; g.stroke();
    g.fillStyle = a(0.95);
    g.fillText(t, x + 10, y + 31, 86);
  });
  // thread lanes
  ['main', 'ui', 'bg'].forEach((t, i) => {
    const y = 180 + i * 34;
    g.fillStyle = a(0.5); g.font = MONO_S; g.fillText(t, 28, y + 14);
    for (let k = 0; k < 9; k++) {
      const w = 22 + ((k * 37 + i * 13) % 30);
      rr(g, 70 + k * 46, y, w, 18, 5); g.fillStyle = a(0.2 + ((k + i) % 3) * 0.2); g.fill();
    }
  });
}

function wasm(g: CanvasRenderingContext2D, p: Palette) {
  const magic = ['00', '61', '73', '6d', '01', '00', '00', '00'];
  g.font = '500 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  for (let r = 0; r < 7; r++) {
    g.fillStyle = alpha(p.accent, 0.45);
    g.fillText((r * 16).toString(16).padStart(6, '0'), 28, 48 + r * 34);
    for (let c = 0; c < 8; c++) {
      const byte = r === 0 ? magic[c] : ((r * 31 + c * 17 + r * c * 7) & 255).toString(16).padStart(2, '0');
      const hot = r === 0 || (r * 3 + c) % 11 === 0;
      g.fillStyle = alpha(p.accent, hot ? 1 : 0.55);
      g.fillText(byte, 112 + c * 34, 48 + r * 34);
    }
  }
  g.fillStyle = alpha(p.accent, 0.8);
  g.fillText('\\0asm', 400, 48);
  g.fillText('memory', 400, 116);
  rr(g, 400, 128, 80, 90, 8); g.strokeStyle = alpha(p.accent, 0.6); g.lineWidth = 2; g.stroke();
  for (let i = 0; i < 5; i++) { rr(g, 408, 136 + i * 16, 64, 10, 3); g.fillStyle = alpha(p.accent, 0.2 + i * 0.12); g.fill(); }
}

function frames(g: CanvasRenderingContext2D, p: Palette, warn: string) {
  const base = 290, budget = 170;
  for (let i = 0; i < 38; i++) {
    const v = 60 + ((i * 53) % 70) + (i % 9 === 4 ? 150 : 0) + (i % 17 === 11 ? 90 : 0);
    const over = v > budget;
    g.fillStyle = over ? alpha(warn, 0.95) : alpha(p.accent, 0.55);
    rr(g, 28 + i * 12, base - v, 8, v, 2); g.fill();
  }
  g.setLineDash([8, 6]);
  g.strokeStyle = alpha(p.ink, 0.8);
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(24, base - budget); g.lineTo(488, base - budget); g.stroke();
  g.setLineDash([]);
  g.font = MONO_S; g.fillStyle = alpha(p.ink, 0.85);
  g.fillText('16.7 ms · vsync', 30, base - budget - 10);
}

const PAINTERS = [surface, code, native, wasm];

export function paintLayer(g: CanvasRenderingContext2D, i: number, p: Palette, label: string, name: string, warn: string) {
  frame(g, p, label, name);
  if (i < PAINTERS.length) PAINTERS[i](g, p);
  else frames(g, p, warn);
}

/** Soft rounded glow used under each slab. */
export function paintHalo(g: CanvasRenderingContext2D, size: number) {
  g.clearRect(0, 0, size, size);
  const grd = g.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
}

export function paintDot(g: CanvasRenderingContext2D, size: number) {
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
}
