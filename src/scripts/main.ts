import { inView, scroll } from 'motion';
import { getPref, setPref, onPref, strings, toast, motionOn, type ThemePref } from './store';
import { sfx, unlock, preloadIfEnabled } from './sound';

const root = document.documentElement;
const $ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => el.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => [...el.querySelectorAll<T>(s)];

/* ------------------------------------------------------------------ prefs */
const THEMES: ThemePref[] = ['system', 'light', 'dark'];

function syncPrefUI() {
  const theme = getPref('theme');
  const tl = strings.nav.theme;
  for (const b of $$<HTMLButtonElement>('[data-action="theme"]')) {
    const label = `${tl.label}: ${tl[theme]}`;
    b.setAttribute('aria-label', label);
    b.title = label;
    if (b.hasAttribute('data-foot-theme')) b.textContent = label;
  }
  for (const key of ['sound', 'motion', 'hud'] as const) {
    const on = getPref(key) === 'on';
    const s = strings.nav[key];
    for (const b of $$<HTMLButtonElement>(`[data-action="${key}"]`)) {
      if (b.classList.contains('hud__x')) continue;
      b.setAttribute('aria-pressed', String(on));
      b.title = on ? s.on : s.off;
      if (b.classList.contains('tbtn')) b.textContent = on ? s.on : s.off;
    }
  }
}

export function toggle(key: 'theme' | 'sound' | 'motion' | 'hud') {
  if (key === 'theme') {
    const next = THEMES[(THEMES.indexOf(getPref('theme')) + 1) % THEMES.length];
    setPref('theme', next);
    sfx('click');
    return next;
  }
  const next = getPref(key) === 'on' ? 'off' : 'on';
  if (key === 'sound' && next === 'on') {
    setPref('sound', 'on');
    unlock().then(() => sfx('toggleOn'));
    return next;
  }
  sfx(next === 'on' ? 'toggleOn' : 'toggleOff');
  setPref(key, next);
  return next;
}
(window as unknown as { __dmToggle: typeof toggle }).__dmToggle = toggle;

document.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLElement>('[data-action]');
  if (!btn) return;
  const a = btn.dataset.action!;
  if (a === 'palette') openPalette();
  else if (a === 'theme' || a === 'sound' || a === 'motion' || a === 'hud') toggle(a);
});
onPref(syncPrefUI);
syncPrefUI();
preloadIfEnabled();

/* ------------------------------------------------------ interaction sounds */
const INTERACTIVE = 'a[href], button, [role="button"], [role="tab"], input[type="range"], .pal__opt';
let lastHover: Element | null = null;
document.addEventListener('pointerover', (e) => {
  if ((e as PointerEvent).pointerType !== 'mouse') return;
  const el = (e.target as Element).closest(INTERACTIVE);
  if (el && el !== lastHover) sfx('hover');
  lastHover = el;
}, { passive: true });
document.addEventListener('click', (e) => {
  const el = (e.target as Element).closest(INTERACTIVE);
  if (!el || el.matches('[data-action="sound"], [data-action="motion"], [data-action="hud"], [data-action="theme"], [data-hint]')) return;
  sfx('click');
}, { capture: true, passive: true });

/* ---------------------------------------------------------- language menu */
const lang = $('[data-lang]');
const langBtn = $<HTMLButtonElement>('[data-lang-btn]');
function setLangOpen(open: boolean) {
  if (!lang || !langBtn) return;
  lang.toggleAttribute('data-open', open);
  langBtn.setAttribute('aria-expanded', String(open));
  if (open) $<HTMLAnchorElement>('[data-lang-link]', lang)?.focus();
}
langBtn?.addEventListener('click', () => setLangOpen(!lang?.hasAttribute('data-open')));
document.addEventListener('click', (e) => {
  if (lang && !lang.contains(e.target as Node)) setLangOpen(false);
});
lang?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { setLangOpen(false); langBtn?.focus(); }
});
// Keep the reader's place when switching language.
for (const a of $$<HTMLAnchorElement>('[data-lang-link]')) {
  a.addEventListener('click', () => {
    if (location.hash) a.href = a.pathname + location.hash;
  });
}

/* ----------------------------------------------------------- palette (⌘K) */
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
for (const k of $$('[data-kbd]')) k.textContent = isMac ? '⌘K' : 'Ctrl K';

let paletteMod: Promise<typeof import('./palette')> | null = null;
function openPalette(initial?: string) {
  paletteMod ??= import('./palette');
  paletteMod.then((m) => m.open(initial));
}
document.addEventListener('keydown', (e) => {
  const typing = (e.target as Element)?.closest?.('input, textarea, [contenteditable="true"]');
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
  } else if (!typing && e.key === '/' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    openPalette();
  }
});

/* ------------------------------------------------------------------- dive */
const anchors = ['top', 'now', 'native', 'runtime', 'lab'].map((id) => document.getElementById(id));
const sections = $$('[data-sec]');
const navLinks = $$<HTMLAnchorElement>('[data-nav]');
const depthLinks = $$<HTMLAnchorElement>('[data-depth]');
const stageEl = document.getElementById('stage');
const mobile = matchMedia('(max-width: 899px)');
let tops: number[] = [];
let secTops: number[] = [];
let layer = -1;
let section = '';
let userScrolled = false;

function measure() {
  const y = scrollY;
  tops = anchors.map((a) => (a ? a.getBoundingClientRect().top + y : Infinity));
  secTops = sections.map((s) => s.getBoundingClientRect().top + y);
}

function onScroll() {
  if (!tops.length) measure();
  const probe = scrollY + innerHeight * 0.45;
  let i = 0;
  while (i < tops.length - 1 && probe >= tops[i + 1]) i++;
  const next = tops[i + 1];
  const span = next - tops[i];
  const frac = Number.isFinite(span) && span > 0 ? Math.min(1, Math.max(0, (probe - tops[i]) / span)) : 0;
  const p = i + frac;

  let s = 0;
  while (s < secTops.length - 1 && probe >= secTops[s + 1]) s++;
  const secId = sections[s]?.id ?? '';

  if (i !== layer) {
    const first = layer === -1;
    layer = i;
    root.dataset.layer = String(i);
    for (const d of depthLinks) d.setAttribute('aria-current', String(Number(d.dataset.depth) === i));
    if (!first && userScrolled) sfx('layer', i);
  }
  if (secId !== section) {
    section = secId;
    for (const n of navLinks) n.setAttribute('aria-current', String(n.dataset.nav === secId));
  }
  if (stageEl) {
    const floor = mobile.matches ? 0.14 : 0.3;
    const heroOut = Math.min(1, p);
    stageEl.style.setProperty('--stage-o', String(1 - heroOut * (1 - floor)));
  }
  window.dispatchEvent(new CustomEvent('dm:dive', { detail: { layer: i, p } }));
}

addEventListener('wheel', () => (userScrolled = true), { passive: true, once: true });
addEventListener('touchmove', () => (userScrolled = true), { passive: true, once: true });
addEventListener('keydown', () => (userScrolled = true), { once: true });
addEventListener('click', () => (userScrolled = true), { once: true });
new ResizeObserver(() => { measure(); onScroll(); }).observe(document.body);
scroll(() => onScroll());
onScroll();

/* ----------------------------------------------------------------- reveal */
function setupReveal() {
  const items = $$('.rv');
  if (!motionOn() || !items.length) return;
  root.classList.add('js-reveal');
  for (const el of items) {
    // Anything already on screen is shown immediately, never hidden.
    if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in');
    else inView(el, () => { el.classList.add('in'); }, { margin: '0px 0px -6% 0px' });
  }
  // Failsafe: content must never stay hidden behind a missed observer.
  setTimeout(() => items.forEach((el) => el.classList.add('in')), 1600);
}
setupReveal();
onPref((k, v) => { if (k === 'motion' && v === 'off') root.classList.remove('js-reveal'); });

/* ------------------------------------------------------------- agent loop */
const loop = $<SVGSVGElement>('#agent-loop');
if (loop) {
  const path = $<SVGPathElement>('#loop-path', loop)!;
  const dot = $<SVGCircleElement>('#loop-dot', loop)!;
  const nodes = $$<SVGGElement>('.node', loop);
  const len = path.getTotalLength();
  const stops = [0, 0.3, 0.5, 0.8].map((f) => f * len);
  let raf = 0, t0 = 0, visible = false;
  const frame = (t: number) => {
    if (!t0) t0 = t;
    const d = (((t - t0) / 6000) % 1) * len;
    const pt = path.getPointAtLength(d);
    dot.setAttribute('cx', String(pt.x));
    dot.setAttribute('cy', String(pt.y));
    let on = 0;
    stops.forEach((s, i) => { if (d >= s) on = i; });
    nodes.forEach((n, i) => n.classList.toggle('is-on', i === on));
    if (visible && motionOn() && !document.hidden) raf = requestAnimationFrame(frame);
  };
  inView(loop, () => {
    visible = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    return () => { visible = false; cancelAnimationFrame(raf); };
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) raf = requestAnimationFrame(frame); });
  onPref((k, v) => { if (k === 'motion' && v === 'on' && visible) raf = requestAnimationFrame(frame); });
}

/* --------------------------------------------------------------- timeline */
const tl = $('[data-tl]');
if (tl) {
  const tabs = $$<HTMLButtonElement>('[role="tab"]', tl);
  const list = $('.tl__list', tl)!;
  const select = (i: number, focus = false) => {
    tabs.forEach((t, j) => {
      const on = i === j;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')!)!.hidden = !on;
    });
    list.style.setProperty('--tl-p', `${tabs.length > 1 ? (i / (tabs.length - 1)) * 100 : 0}%`);
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
  list.addEventListener('keydown', (e) => {
    const cur = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    let n = cur;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = Math.min(tabs.length - 1, cur + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = Math.max(0, cur - 1);
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    else return;
    e.preventDefault();
    if (n !== cur) { select(n, true); sfx('tick', n / tabs.length); }
  });
}

/* ------------------------------------------------------------- lab filter */
const filters = $$<HTMLButtonElement>('[data-filter]');
const labCards = $$<HTMLElement>('.labgrid [data-lv]');
filters.forEach((b) => b.addEventListener('click', () => {
  const f = b.dataset.filter;
  filters.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  labCards.forEach((c) => (c.hidden = f !== 'all' && c.dataset.lv !== f));
}));

/* ------------------------------------------------------------------- copy */
for (const b of $$<HTMLButtonElement>('[data-copy]')) {
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(b.dataset.copy!);
      toast(strings.copied);
      sfx('success');
    } catch {
      location.href = `mailto:${b.dataset.copy}`;
    }
  });
}

/* ------------------------------------------------------------------ demos */
type DemoModule = { init: (el: HTMLElement) => { start?: () => void; stop?: () => void } | void };
const DEMOS: Record<string, () => Promise<DemoModule>> = {
  hero: () => import('./demos/hero'),
  loaders: () => import('./demos/loaders'),
  wave: () => import('./demos/wave'),
  ink: () => import('./demos/ink'),
  vivari: () => import('./demos/vivari'),
  mesh: () => import('./demos/mesh'),
};
for (const el of $$('[data-demo]')) {
  let inst: ReturnType<DemoModule['init']> | null = null;
  let loading: Promise<void> | null = null;
  inView(el, () => {
    el.classList.add('is-live');
    loading ??= DEMOS[el.dataset.demo!]?.().then((m) => { inst = m.init(el); });
    loading?.then(() => inst?.start?.());
    return () => { el.classList.remove('is-live'); inst?.stop?.(); };
  }, { margin: '120px 0px' });
}

/* ------------------------------------------------------------ stage + HUD */
function whenIdle(fn: () => void) {
  const go = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
}
whenIdle(() => import('./stage').then((m) => m.initStage()));

/* ------------------------------------------------------------- sound hint */
// Sound is on by default, but the browser stays silent until the first
// gesture and many devices are muted. Once per visitor, and only if they
// have never chosen, point at the sound button and offer a test chord.
function soundHint() {
  const el = document.getElementById('sound-hint');
  const btn = $<HTMLElement>('.nav [data-action="sound"]');
  const stored = (k: string) => { try { return localStorage.getItem(k); } catch { return 'unavailable'; } };
  const skip = () => stored('dm:soundHint') !== null || stored('dm:sound') !== null || getPref('sound') !== 'on';
  if (!el || !btn || skip()) return;
  let timer = 0, open = false;
  const place = () => {
    if (innerWidth <= 640) { el.style.right = el.style.top = ''; return; }
    const r = btn.getBoundingClientRect();
    const right = Math.max(12, innerWidth - r.right - 10);
    el.style.top = `${r.bottom + 10}px`;
    el.style.right = `${right}px`;
    el.style.setProperty('--ax', `${Math.max(12, innerWidth - right - (r.left + r.width / 2) - 5)}px`);
  };
  const arm = (ms: number) => { clearTimeout(timer); timer = window.setTimeout(() => close(), ms); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  const close = (choice?: 'play' | 'mute') => {
    if (!open) return;
    open = false;
    try { localStorage.setItem('dm:soundHint', choice ?? 'dismissed'); } catch { /* private mode */ }
    clearTimeout(timer);
    removeEventListener('keydown', onKey);
    removeEventListener('resize', place);
    const hadFocus = el.contains(document.activeElement);
    el.classList.remove('on');
    setTimeout(() => { el.hidden = true; }, motionOn() ? 220 : 0);
    if (choice === 'play') { setPref('sound', 'on'); unlock().then(() => sfx('chord')); }
    else if (choice === 'mute') setPref('sound', 'off');
    if (hadFocus) btn.focus();
  };
  el.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLElement>('[data-hint]')?.dataset.hint;
    if (a) close(a === 'play' || a === 'mute' ? a : undefined);
  });
  // Reading it or tabbing into it pauses the auto-dismiss.
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', () => arm(4000));
  el.addEventListener('focusin', () => clearTimeout(timer));
  onPref((k) => { if (k === 'sound') close(); });
  setTimeout(() => {
    if (skip()) return;
    open = true;
    place();
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('on'));
    addEventListener('keydown', onKey);
    addEventListener('resize', place, { passive: true });
    arm(8000);
  }, 1500);
}
if (document.readyState === 'complete') soundHint();
else addEventListener('load', soundHint, { once: true });

/* ------------------------------------------------------- kinetic headline */
// Split only after the plain headline has painted, so it stays the LCP.
const heroH1 = $<HTMLElement>('.hero h1');
let kinetic: Promise<typeof import('./kinetic')> | null = null;
function syncKinetic() {
  if (!heroH1) return;
  if (motionOn()) (kinetic ??= import('./kinetic')).then((m) => motionOn() && m.initKinetic(heroH1));
  else kinetic?.then((m) => m.stopKinetic());
}
const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(syncKinetic));
if (document.readyState === 'complete') afterPaint();
else addEventListener('load', afterPaint, { once: true });
onPref((k) => { if (k === 'motion') syncKinetic(); });

let hudMod: Promise<typeof import('./hud')> | null = null;
function syncHud() {
  const on = getPref('hud') === 'on';
  const el = document.getElementById('hud');
  if (!el) return;
  el.hidden = !on;
  if (on) { hudMod ??= import('./hud'); hudMod.then((m) => m.start()); }
  else hudMod?.then((m) => m.stop());
}
onPref((k) => { if (k === 'hud') syncHud(); });
whenIdle(syncHud);
