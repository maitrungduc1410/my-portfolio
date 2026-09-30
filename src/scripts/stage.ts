// Decides how the layer stack is drawn and drives whichever renderer is live.
//
//   webgl  : the Three.js scene, fetched after first paint and idle
//   css    : the DOM/CSS 3D stack (no WebGL, low-end device, or runtime downgrade)
//   static : the same DOM stack with no motion at all (Motion off / reduced motion)
//
// The DOM stack is server-rendered, so it is also what everyone sees before
// the 3D chunk arrives. Nothing on the page waits for any of this.
import { motionOn, onPref, onTheme, strings } from './store';
import type { LayerScene, Tier } from './scene/layers';

export type StageMode = 'webgl' | 'css' | 'static';

const stage = document.getElementById('stage')!;
const cstack = document.getElementById('cstack')!;
const cls = [...cstack.querySelectorAll<HTMLElement>('.cl')];
let scene: LayerScene | null = null;
let loading = false;
let mode: StageMode = 'css';
let dive = { layer: 0, p: 0 };
let tierLabel = strings.hud.tiers.loading;

function setTier(label: string) {
  tierLabel = label;
  const el = document.getElementById('hud-q');
  if (el) el.textContent = label;
}
export const currentTier = () => tierLabel;

function capability(): { webgl: boolean; reason?: string } {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return { webgl: false, reason: 'save-data' };
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return { webgl: false, reason: 'memory' };
  if ((nav.hardwareConcurrency ?? 8) < 4) return { webgl: false, reason: 'cpu' };
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { webgl: false, reason: 'no-webgl' };
    (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    return { webgl: false, reason: 'no-webgl' };
  }
  return { webgl: true };
}

function applyCss() {
  const cur = Math.round(dive.p);
  for (const el of cls) {
    const i = Number(el.dataset.l);
    el.classList.toggle('is-up', i < cur);
    el.classList.toggle('is-cur', i === cur);
  }
}

function setMode(next: StageMode) {
  mode = next;
  stage.dataset.mode = next;
  if (next !== 'webgl') {
    scene?.pause();
    setTier(next === 'css' ? strings.hud.tiers.css : strings.hud.tiers.static);
  }
  applyCss();
}

async function startWebgl() {
  if (scene) {
    scene.resume();
    setMode('webgl');
    setTier(strings.hud.tiers[scene.tier]);
    return;
  }
  if (loading) return;
  loading = true;
  try {
    const { createLayerScene } = await import('./scene/layers');
    if (!motionOn()) return;
    scene = createLayerScene(stage, {
      labels: strings.layers,
      onTier: (t: Tier) => setTier(strings.hud.tiers[t]),
      onGiveUp: () => setMode('css'),
    });
    scene.setDive(dive.p);
    scene.ready.then(() => { if (motionOn()) { scene?.setDive(dive.p); setMode('webgl'); } });
  } catch (err) {
    console.warn('[stage] 3D unavailable, using CSS stack', err);
    setMode('css');
  } finally {
    loading = false;
  }
}

function decide() {
  if (!motionOn()) { setMode('static'); return; }
  const cap = capability();
  if (!cap.webgl) { setMode('css'); return; }
  startWebgl();
}

export function initStage() {
  window.addEventListener('dm:dive', (e) => {
    dive = (e as CustomEvent).detail;
    scene?.setDive(dive.p);
    if (mode !== 'webgl') applyCss();
  });

  // Pointer parallax for the CSS stack (the WebGL scene handles its own).
  let raf = 0;
  addEventListener('pointermove', (e) => {
    if (mode !== 'css' || !motionOn()) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      cstack.style.setProperty('--px', `${(e.clientX / innerWidth - 0.5) * 16}px`);
      cstack.style.setProperty('--py', `${(e.clientY / innerHeight - 0.5) * 16}px`);
    });
  }, { passive: true });

  onPref((k) => { if (k === 'motion') decide(); });
  onTheme(() => scene?.setTheme());
  document.addEventListener('visibilitychange', () => {
    if (!scene || mode !== 'webgl') return;
    if (document.hidden) scene.pause(); else scene.resume();
  });
  decide();
}
