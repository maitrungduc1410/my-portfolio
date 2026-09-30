// Kinetic hero headline. Loaded after first paint and only with motion on, so
// the server-rendered <h1> is what paints first and LCP never waits for it.
// Letters are split by grapheme (Vietnamese marks and Han characters stay
// whole) inside nowrap word boxes, so the line breaks match the plain text.
// Near the pointer they lift away, tilt and tint; a spring brings them home.
import { sfx } from './sound';

interface Letter { el: HTMLElement; i: number; cx: number; cy: number; x: number; y: number; r: number; s: number; vx: number; vy: number; vr: number; vs: number; tint: number }

const K = 170, C = 17;
const MAX_DT = 1 / 30;
const IDLE_RIPPLE_MS = 9000;

let teardown: (() => void) | null = null;

export function initKinetic(h1: HTMLElement) {
  if (teardown || !('Segmenter' in Intl)) return;
  const text = h1.textContent!.replace(/\s+/g, ' ').trim();
  const original = h1.innerHTML;
  const lang = document.documentElement.lang || 'en';
  const words = new Intl.Segmenter(lang, { granularity: 'word' });
  const graphemes = new Intl.Segmenter(lang, { granularity: 'grapheme' });
  const letters: Letter[] = [];

  // Word boxes keep punctuation glued to the word before it (no "。" or "."
  // alone at the start of a line), and spaces stay real text nodes.
  const split = (src: string, into: Node, grad: boolean) => {
    const frag = document.createDocumentFragment();
    let box: HTMLElement | null = null;
    for (const w of words.segment(src)) {
      if (/^\s+$/.test(w.segment)) { frag.append(w.segment); box = null; continue; }
      if (!box || w.isWordLike) {
        box = document.createElement('span');
        box.className = 'kw';
        box.setAttribute('aria-hidden', 'true');
        frag.append(box);
      }
      for (const g of graphemes.segment(w.segment)) {
        const el = document.createElement('span');
        el.className = grad ? 'kc kc--g' : 'kc';
        el.textContent = g.segment;
        box.append(el);
        letters.push({ el, i: letters.length, cx: 0, cy: 0, x: 0, y: 0, r: 0, s: 1, vx: 0, vy: 0, vr: 0, vs: 0, tint: -1 });
      }
    }
    into.textContent = '';
    into.appendChild(frag);
  };

  h1.setAttribute('aria-label', text);
  for (const n of [...h1.childNodes]) {
    if (n.nodeType === Node.TEXT_NODE) {
      const holder = document.createElement('span');
      holder.className = 'kh';
      split(n.textContent!, holder, false);
      h1.replaceChild(holder, n);
    } else if (n instanceof HTMLElement) {
      split(n.textContent!, n, n.classList.contains('grad'));
      if (n.classList.contains('grad')) n.classList.add('is-split');
    }
  }
  h1.classList.add('is-kinetic');

  /* ------------------------------------------------ geometry, cached */
  let fs = 96;
  const grad = h1.querySelector<HTMLElement>('.grad');
  const measure = () => {
    const hr = h1.getBoundingClientRect();
    const ox = hr.left + scrollX, oy = hr.top + scrollY;
    fs = parseFloat(getComputedStyle(h1).fontSize) || 96;
    for (const l of letters) {
      l.cx = ox + l.el.offsetLeft + l.el.offsetWidth / 2;
      l.cy = oy + l.el.offsetTop + l.el.offsetHeight / 2;
    }
    // One gradient across the highlighted word, as if it were a single
    // run: each letter shows its own slice of it.
    if (grad) {
      const pad = parseFloat(getComputedStyle(letters.find((l) => l.el.classList.contains('kc--g'))?.el ?? grad).paddingLeft) || 0;
      let cum = 0;
      for (const l of letters) {
        if (!l.el.classList.contains('kc--g')) continue;
        l.el.style.setProperty('--gx', `${pad - cum}px`);
        cum += l.el.offsetWidth - 2 * pad;
      }
      grad.style.setProperty('--gw', `${cum}px`);
    }
  };

  /* ---------------------------------------------------------- physics */
  let px = -1e5, py = -1e5, active = false, raf = 0, last = 0, near = -1;
  const impulses: { at: number; i: number; v: number }[] = [];

  const frame = (t: number) => {
    const dt = Math.min(MAX_DT, Math.max(0, t - last) / 1000 || 1 / 60);
    last = t;
    const R = fs * 1.7, k = fs / 96;
    let moving = impulses.length > 0;
    let best = -1, bestF = 0.45;
    for (let j = impulses.length - 1; j >= 0; j--) {
      if (impulses[j].at <= t) { letters[impulses[j].i].vy += impulses[j].v * k; impulses.splice(j, 1); }
    }
    for (const l of letters) {
      let tx = 0, ty = 0, tr = 0, ts = 1, f = 0;
      if (active) {
        const dx = px - (l.cx - scrollX), dy = py - (l.cy - scrollY);
        f = Math.max(0, 1 - Math.hypot(dx, dy) / R);
        if (f > 0) {
          tx = -dx * f * 0.25;
          ty = -dy * f * 0.45 - f * 16 * k;
          tr = dx * f * 0.08 / k;
          ts = 1 + f * 0.22;
          if (f > bestF) { bestF = f; best = l.i; }
        }
      }
      l.vx += (K * (tx - l.x) - C * l.vx) * dt;
      l.vy += (K * (ty - l.y) - C * l.vy) * dt;
      l.vr += (K * (tr - l.r) - C * l.vr) * dt;
      l.vs += (K * (ts - l.s) - C * l.vs) * dt;
      l.x += l.vx * dt; l.y += l.vy * dt; l.r += l.vr * dt; l.s += l.vs * dt;
      const settled = Math.abs(l.x) + Math.abs(l.y) + Math.abs(l.r) + Math.abs(l.s - 1) < 0.02 && Math.abs(l.vx) + Math.abs(l.vy) < 0.05;
      if (settled && f === 0) { l.x = l.y = l.r = l.vx = l.vy = l.vr = l.vs = 0; l.s = 1; }
      else moving = true;
      l.el.style.transform = l.x || l.y || l.r || l.s !== 1 ? `translate(${l.x.toFixed(2)}px,${l.y.toFixed(2)}px) rotate(${l.r.toFixed(2)}deg) scale(${l.s.toFixed(3)})` : '';
      const tint = f > 0.18 ? l.i % 5 : -1;
      if (tint !== l.tint) { l.tint = tint; l.el.style.color = tint < 0 ? '' : `var(--l${tint})`; }
    }
    if (best >= 0 && best !== near) sfx('letter', best / Math.max(1, letters.length - 1));
    near = best;
    raf = moving ? requestAnimationFrame(frame) : 0;
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  const wave = (strength: number) => {
    const now = performance.now();
    letters.forEach((l) => impulses.push({ at: now + l.i * 32, i: l.i, v: -strength }));
    kick();
  };

  /* ----------------------------------------------------------- input */
  const hero = h1.closest<HTMLElement>('.hero') ?? h1;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    px = e.clientX; py = e.clientY; active = true; lastInput = performance.now(); kick();
  };
  const onLeave = () => { active = false; near = -1; kick(); };
  const onTouch = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return onLeave();
    px = t.clientX; py = t.clientY; active = true; lastInput = performance.now(); kick();
  };
  hero.addEventListener('pointermove', onMove, { passive: true });
  hero.addEventListener('pointerleave', onLeave, { passive: true });
  hero.addEventListener('pointerenter', measure, { passive: true });
  h1.addEventListener('touchstart', onTouch, { passive: true });
  h1.addEventListener('touchmove', onTouch, { passive: true });
  h1.addEventListener('touchend', onTouch, { passive: true });
  h1.addEventListener('touchcancel', onLeave, { passive: true });

  let lastInput = 0, visible = true;
  const ro = new ResizeObserver(measure);
  ro.observe(h1);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(h1);
  document.fonts?.ready.then(measure);
  const ripple = setInterval(() => {
    if (visible && !document.hidden && !active && performance.now() - lastInput > IDLE_RIPPLE_MS) wave(90);
  }, IDLE_RIPPLE_MS);

  measure();
  wave(160);

  teardown = () => {
    cancelAnimationFrame(raf);
    clearInterval(ripple);
    ro.disconnect();
    io.disconnect();
    hero.removeEventListener('pointermove', onMove);
    hero.removeEventListener('pointerleave', onLeave);
    hero.removeEventListener('pointerenter', measure);
    for (const ev of ['touchstart', 'touchmove', 'touchend'] as const) h1.removeEventListener(ev, onTouch);
    h1.removeEventListener('touchcancel', onLeave);
    h1.innerHTML = original;
    h1.removeAttribute('aria-label');
    h1.classList.remove('is-kinetic');
    teardown = null;
  };
}

export function stopKinetic() {
  teardown?.();
}
