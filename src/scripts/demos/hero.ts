// A web port of react-native-shared-hero. Two screens share a hero by index;
// opening or closing captures the source and destination frames, hides both
// and flies a clone in an overlay above every screen (transform and opacity
// only, one rAF loop), then hands off softly to the real destination.
//   snapshot: the image flies and crossfades from source clone to dest clone
//   morph:    the whole card becomes the detail screen (container transform),
//             interpolating corner radius and background as well
// The detail screen can be dragged down (or swiped right) to dismiss: the
// overlay tracks the pointer frame by frame, then commits or springs back.
import { sfx } from '../sound';
import { motionOn } from '../store';

type Mode = 'snapshot' | 'morph';
type Timing = 'spring' | 'duration';
type Path = 'linear' | 'arc';
type RGBA = [number, number, number, number];
interface Box { x: number; y: number; w: number; h: number; r: number; bg: RGBA }
interface Layer { el: HTMLElement; w: number; h: number }

const SPRING = { k: 320, c: 28 };
const DURATION = 320;
const MAX_DT = 1 / 20;

// cubic-bezier(.2, 0, 0, 1), the "standard" easing preset.
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const a = (p1: number, p2: number) => 1 - 3 * p2 + 3 * p1;
  const b = (p1: number, p2: number) => 3 * p2 - 6 * p1;
  const c = (p1: number) => 3 * p1;
  const at = (t: number, p1: number, p2: number) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
  const slope = (t: number, p1: number, p2: number) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const s = slope(t, x1, x2);
      if (Math.abs(s) < 1e-6) break;
      t -= (at(t, x1, x2) - x) / s;
    }
    return at(Math.max(0, Math.min(1, t)), y1, y2);
  };
}
const standard = bezier(0.2, 0, 0, 1);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rgba = (s: string): RGBA => {
  const m = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
  return [m[0], m[1], m[2], m[3] ?? 1];
};

export function init(root: HTMLElement) {
  const scr = root.querySelector<HTMLElement>('.sh__scr')!;
  const list = root.querySelector<HTMLElement>('.sh__list')!;
  const detail = root.querySelector<HTMLElement>('.sh__detail')!;
  const hero = detail.querySelector<HTMLElement>('.sh__hero')!;
  const back = detail.querySelector<HTMLButtonElement>('[data-sh-back]')!;
  const title = detail.querySelector<HTMLElement>('[data-sh-title]')!;
  const meta = detail.querySelector<HTMLElement>('[data-sh-meta]')!;
  const tiles = [...root.querySelectorAll<HTMLButtonElement>('[data-sh-tile]')];
  const opts: { mode: Mode; timing: Timing; path: Path } = { mode: 'snapshot', timing: 'spring', path: 'linear' };

  let open = -1;
  let flight: { cancel: () => void } | null = null;

  const boxOf = (el: HTMLElement): Box => {
    const s = scr.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height, r: parseFloat(cs.borderTopLeftRadius) || 0, bg: rgba(cs.backgroundColor) };
  };
  const clone = (el: HTMLElement, box: Box): Layer => {
    const c = el.cloneNode(true) as HTMLElement;
    const hue = getComputedStyle(el).getPropertyValue('--h');
    c.removeAttribute('data-sh-tile');
    c.style.cssText = '';
    if (hue) c.style.setProperty('--h', hue);
    c.style.width = `${box.w}px`;
    c.style.height = `${box.h}px`;
    c.setAttribute('aria-hidden', 'true');
    c.inert = true;
    c.classList.add('sh__layer');
    return { el: c, w: box.w, h: box.h };
  };
  const art = (i: number) => tiles[i].querySelector<HTMLElement>('.sh__art')!;
  const setDetail = (on: boolean, alpha = on ? 1 : 0) => {
    detail.style.opacity = String(alpha);
    detail.style.visibility = on || alpha > 0 ? 'visible' : 'hidden';
    detail.inert = !on;
    list.inert = on;
    scr.toggleAttribute('data-open', on);
  };
  const fill = (i: number) => {
    const t = tiles[i];
    hero.style.setProperty('--h', t.style.getPropertyValue('--h'));
    title.textContent = t.dataset.name!;
    meta.textContent = `places::${i}`;
  };

  /* ----------------------------------------------------------- overlay */
  // The container is laid out once at a fixed size and moved with
  // translate + scale. Children are counter-scaled so their content keeps its
  // aspect (cover for snapshot, fit-width-from-top for morph), and the radius
  // is given per axis so it stays round under a non-uniform scale.
  function overlay(L: { w: number; h: number }, layers: Layer[], fit: 'cover' | 'top') {
    const el = document.createElement('div');
    el.className = 'sh__fly';
    el.setAttribute('aria-hidden', 'true');
    el.style.width = `${L.w}px`;
    el.style.height = `${L.h}px`;
    for (const l of layers) {
      l.el.style.position = 'absolute';
      l.el.style.left = `${(L.w - l.w) / 2}px`;
      l.el.style.top = fit === 'cover' ? `${(L.h - l.h) / 2}px` : '0';
      l.el.style.transformOrigin = fit === 'cover' ? '50% 50%' : '50% 0';
      el.appendChild(l.el);
    }
    scr.appendChild(el);
    const set = (b: Box, alphas: number[]) => {
      const sx = b.w / L.w, sy = b.h / L.h;
      el.style.transform = `translate(${b.x}px, ${b.y}px) scale(${sx}, ${sy})`;
      el.style.borderRadius = `${b.r / sx}px / ${b.r / sy}px`;
      el.style.backgroundColor = `rgba(${b.bg.map((v, i) => (i < 3 ? Math.round(v) : v.toFixed(3))).join(',')})`;
      layers.forEach((l, i) => {
        const u = fit === 'cover' ? Math.max(b.w / l.w, b.h / l.h) : b.w / l.w;
        l.el.style.transform = `scale(${u / sx}, ${u / sy})`;
        l.el.style.opacity = String(clamp01(alphas[i]));
      });
    };
    const done = () => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-out' }).finished.then(() => el.remove(), () => el.remove());
    return { el, set, done };
  }

  const mix = (a: Box, b: Box, t: number, arc: boolean): Box => {
    const w = lerp(a.w, b.w, t), h = lerp(a.h, b.h, t);
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    let cx = lerp(ax, bx, t), cy = lerp(ay, by, t);
    if (arc) {
      // Quadratic bezier through the corner of the two frames.
      const u = 1 - t;
      cx = u * u * ax + 2 * u * t * bx + t * t * bx;
      cy = u * u * ay + 2 * u * t * ay + t * t * by;
    }
    const tc = clamp01(t);
    return { x: cx - w / 2, y: cy - h / 2, w, h, r: Math.max(0, lerp(a.r, b.r, tc)), bg: a.bg.map((v, i) => lerp(v, b.bg[i], tc)) as RGBA };
  };

  /* ------------------------------------------------------------ driver */
  function run(o: {
    from: Box; to: Box; L: { w: number; h: number }; layers: Layer[]; fit: 'cover' | 'top';
    alphas: (p: number) => number[]; timing: Timing; path: Path;
    frame?: (p: number) => void; end: () => void;
  }) {
    const ov = overlay(o.L, o.layers, o.fit);
    const arc = o.path === 'arc';
    let p = 0, v = 0, raf = 0, t0 = 0, last = 0;
    const apply = () => { ov.set(mix(o.from, o.to, p, arc), o.alphas(p)); o.frame?.(clamp01(p)); };
    const finish = () => {
      cancelAnimationFrame(raf);
      p = 1; apply();
      flight = null;
      o.end();
      ov.done();
    };
    const tick = (t: number) => {
      if (!t0) { t0 = last = t; }
      const dt = Math.min(MAX_DT, (t - last) / 1000);
      last = t;
      if (o.timing === 'spring') {
        v += (-SPRING.k * (p - 1) - SPRING.c * v) * dt;
        p += v * dt;
        if (Math.abs(p - 1) < 0.001 && Math.abs(v) < 0.01) return finish();
      } else {
        const x = (t - t0) / DURATION;
        if (x >= 1) return finish();
        p = standard(x);
      }
      apply();
      raf = requestAnimationFrame(tick);
    };
    apply();
    raf = requestAnimationFrame(tick);
    flight = { cancel: finish };
  }

  // The destination clone paints over an opaque source, so nothing behind
  // the hero shows through mid-flight.
  const fadeCross = (p: number) => [1, p];
  const screenFade = (p: number) => Math.min(1, p * 1.6);
  const fadeThrough = (p: number) => [1 - p / 0.35, (p - 0.25) / 0.75];

  /* ------------------------------------------------------ open / close */
  function show(i: number) {
    flight?.cancel();
    if (open >= 0) return;
    open = i;
    fill(i);
    sfx('open');
    const tile = tiles[i];
    if (!motionOn()) { setDetail(true); back.focus({ preventScroll: true }); return; }

    if (opts.mode === 'snapshot') {
      const src = art(i);
      const a = boxOf(src);
      setDetail(false, 0.001);
      const b = boxOf(hero);
      src.style.visibility = hero.style.visibility = 'hidden';
      run({
        from: a, to: b, L: b, fit: 'cover', layers: [clone(src, a), clone(hero, b)], alphas: fadeCross,
        timing: opts.timing, path: opts.path,
        frame: (p) => { detail.style.opacity = String(screenFade(p)); },
        end: () => { src.style.visibility = hero.style.visibility = ''; setDetail(true); back.focus({ preventScroll: true }); },
      });
    } else {
      const a = boxOf(tile);
      setDetail(false, 0.001);
      const b = { ...boxOf(scr), x: 0, y: 0, bg: rgba(getComputedStyle(detail).backgroundColor) };
      const cd = clone(detail, b);
      cd.el.style.opacity = '1';
      cd.el.style.visibility = 'visible';
      tile.style.visibility = 'hidden';
      setDetail(false, 0);
      run({
        from: a, to: b, L: b, fit: 'top', layers: [clone(tile, a), cd], alphas: fadeThrough,
        timing: opts.timing, path: opts.path,
        frame: (p) => { list.style.opacity = String(1 - 0.4 * p); },
        end: () => { tile.style.visibility = ''; list.style.opacity = ''; setDetail(true); back.focus({ preventScroll: true }); },
      });
    }
  }

  // `from` overrides the start frame, for a return that begins mid-drag.
  function hide(from?: { box: Box; alpha: number }, focus = true) {
    flight?.cancel();
    if (open < 0) return;
    const i = open;
    open = -1;
    sfx('close');
    const tile = tiles[i];
    const done = () => { setDetail(false); if (focus) tile.focus({ preventScroll: true }); };
    if (!motionOn()) { done(); return; }

    if (opts.mode === 'snapshot') {
      const dst = art(i);
      const b = boxOf(dst);
      const h0 = boxOf(hero);
      const a = from?.box ?? h0;
      const alpha0 = from?.alpha ?? 1;
      hero.style.visibility = dst.style.visibility = 'hidden';
      run({
        from: a, to: b, L: h0, fit: 'cover', layers: [clone(hero, h0), clone(dst, b)], alphas: fadeCross,
        timing: opts.timing, path: opts.path,
        frame: (p) => { detail.style.opacity = String(alpha0 * (1 - screenFade(p))); },
        end: () => { hero.style.visibility = dst.style.visibility = ''; done(); },
      });
    } else {
      const b = boxOf(tile);
      const s = { ...boxOf(scr), x: 0, y: 0, bg: rgba(getComputedStyle(detail).backgroundColor) };
      const a = from?.box ?? s;
      const cd = clone(detail, s);
      cd.el.style.opacity = '1';
      cd.el.style.visibility = 'visible';
      tile.style.visibility = 'hidden';
      setDetail(false, 0);
      const l0 = from ? 0.6 + 0.4 * (1 - from.alpha) : 0.6;
      run({
        from: a, to: b, L: s, fit: 'top', layers: [cd, clone(tile, b)], alphas: (p) => [1 - p / 0.5, (p - 0.3) / 0.7],
        timing: opts.timing, path: opts.path,
        frame: (p) => { list.style.opacity = String(lerp(l0, 1, p)); },
        end: () => { tile.style.visibility = ''; list.style.opacity = ''; done(); },
      });
    }
  }

  /* ------------------------------------------ interactive drag to dismiss */
  let drag: {
    id: number; x0: number; y0: number; gx: number; gy: number; dx: number; dy: number;
    vy: number; lt: number; ly: number; lx: number; vx: number; active: boolean; raf: number;
    base?: Box; ov?: ReturnType<typeof overlay>; p: number;
  } | null = null;

  const dragBox = (d: NonNullable<typeof drag>): Box => {
    const b = d.base!;
    const s = 1 - (opts.mode === 'morph' ? 0.55 : 0.45) * d.p;
    return {
      x: d.gx + d.dx + (b.x - d.gx) * s, y: d.gy + d.dy + (b.y - d.gy) * s, w: b.w * s, h: b.h * s,
      r: opts.mode === 'morph' ? lerp(b.r, 22, d.p) : b.r, bg: b.bg,
    };
  };
  const dragFrame = () => {
    const d = drag;
    if (!d || !d.active) return;
    const H = scr.clientHeight;
    d.p = clamp01(Math.max(d.dy, d.dx * 0.9) / (H * 0.55));
    d.ov!.set(dragBox(d), [1]);
    if (opts.mode === 'snapshot') detail.style.opacity = String(1 - d.p);
    else list.style.opacity = String(0.6 + 0.4 * d.p);
    d.raf = requestAnimationFrame(dragFrame);
  };
  const beginDrag = (d: NonNullable<typeof drag>) => {
    d.active = true;
    const s = scr.getBoundingClientRect();
    d.gx = d.x0 - s.left; d.gy = d.y0 - s.top;
    if (opts.mode === 'snapshot') {
      d.base = boxOf(hero);
      d.ov = overlay(d.base, [clone(hero, d.base)], 'cover');
      hero.style.visibility = 'hidden';
    } else {
      d.base = { ...boxOf(scr), x: 0, y: 0, r: parseFloat(getComputedStyle(scr).borderTopLeftRadius) || 0, bg: rgba(getComputedStyle(detail).backgroundColor) };
      const cd = clone(detail, d.base);
      cd.el.style.opacity = '1';
      cd.el.style.visibility = 'visible';
      d.ov = overlay(d.base, [cd], 'top');
      detail.style.opacity = '0';
      list.style.opacity = '0.6';
    }
    dragFrame();
  };
  const endDrag = (commit: boolean) => {
    const d = drag;
    drag = null;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    if (!d.active) return;
    const cur = dragBox(d);
    d.ov!.el.remove();
    if (commit) {
      if (opts.mode === 'snapshot') hero.style.visibility = '';
      hide({ box: cur, alpha: 1 - d.p });
      return;
    }
    // Cancel: always spring back, whatever the timing control says.
    sfx('spring', 0.25 + d.p * 0.6);
    const base = d.base!;
    if (opts.mode === 'snapshot') {
      const a0 = 1 - d.p;
      run({
        from: cur, to: base, L: base, fit: 'cover', layers: [clone(hero, base)], alphas: () => [1],
        timing: 'spring', path: 'linear',
        frame: (p) => { detail.style.opacity = String(lerp(a0, 1, p)); },
        end: () => { hero.style.visibility = ''; detail.style.opacity = '1'; },
      });
    } else {
      const cd = clone(detail, base);
      cd.el.style.opacity = '1';
      cd.el.style.visibility = 'visible';
      const l0 = 0.6 + 0.4 * d.p;
      run({
        from: cur, to: base, L: base, fit: 'top', layers: [cd], alphas: () => [1],
        timing: 'spring', path: 'linear',
        frame: (p) => { list.style.opacity = String(lerp(l0, 0.6, p)); },
        end: () => { detail.style.opacity = '1'; list.style.opacity = ''; },
      });
    }
  };

  detail.addEventListener('pointerdown', (e) => {
    if (open < 0 || flight || drag || !e.isPrimary || (e.target as Element).closest('button')) return;
    detail.setPointerCapture(e.pointerId);
    const now = performance.now();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, gx: 0, gy: 0, dx: 0, dy: 0, vy: 0, vx: 0, lt: now, ly: e.clientY, lx: e.clientX, active: false, raf: 0, p: 0 };
  });
  detail.addEventListener('pointermove', (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    d.dx = e.clientX - d.x0; d.dy = e.clientY - d.y0;
    const now = performance.now();
    const dt = Math.max(1, now - d.lt);
    d.vy = (e.clientY - d.ly) / dt; d.vx = (e.clientX - d.lx) / dt;
    d.lt = now; d.ly = e.clientY; d.lx = e.clientX;
    if (!d.active && Math.max(d.dy, d.dx) > 6 && motionOn()) beginDrag(d);
  });
  const release = (e: PointerEvent) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    if (!motionOn()) { drag = null; if (Math.max(d.dy, d.dx) > 60) hide(); return; }
    const fling = d.vy > 0.5 || d.vx > 0.5;
    endDrag(d.active && (d.p > 0.3 || (fling && d.p > 0.05)));
  };
  detail.addEventListener('pointerup', release);
  detail.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) endDrag(false); });

  /* ------------------------------------------------------------ wiring */
  tiles.forEach((t, i) => t.addEventListener('click', () => show(i)));
  back.addEventListener('click', () => hide());
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open >= 0 && scr.contains(e.target as Node)) { e.preventDefault(); hide(); }
  });
  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-sh-opt]')) {
    b.addEventListener('click', () => {
      const [k, v] = b.dataset.shOpt!.split(':') as [keyof typeof opts, string];
      (opts as Record<string, string>)[k] = v;
      for (const o of root.querySelectorAll<HTMLButtonElement>(`[data-sh-opt^="${k}:"]`)) o.setAttribute('aria-pressed', String(o === b));
    });
  }

  return {
    stop: () => {
      if (drag) endDrag(false);
      flight?.cancel();
    },
  };
}
