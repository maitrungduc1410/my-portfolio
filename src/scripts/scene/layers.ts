// The Layer Dive scene. Five slabs, generated in code, one per layer of the
// stack. Scrolling peels the upper slabs away and the camera follows the
// current one down; the pointer tilts the stack; small packets fall through
// the layers like a request travelling from a tap down to a frame.
//
// Budget rules: render on demand, stop when idle, hidden or paused, clamp the
// device pixel ratio, and step quality down (then give up to the CSS stack)
// when the measured frame time says the device cannot keep up.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Blending,
} from 'three';
import { paintDot, paintHalo, paintLayer, TEX_H, TEX_W, type Palette } from './textures';

export type Tier = 'high' | 'medium' | 'low';

export interface LayerScene {
  ready: Promise<void>;
  tier: Tier;
  setDive(p: number): void;
  setTheme(): void;
  pause(): void;
  resume(): void;
}

interface Options {
  labels: { code: string; name: string }[];
  onTier(t: Tier): void;
  onGiveUp(): void;
}

const N = 5;
const W = 4.2;
const D = W * (TEX_H / TEX_W);
const GAP = 1.15;
const TIERS: Record<Tier, { dpr: number; packets: number; aa: boolean }> = {
  high: { dpr: 2, packets: 54, aa: true },
  medium: { dpr: 1.35, packets: 30, aa: true },
  low: { dpr: 1, packets: 14, aa: false },
};

const smooth = (e0: number, e1: number, x: number) => {
  const t = MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function roundedRect(w: number, d: number, r: number) {
  const s = new Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    light: document.documentElement.dataset.theme === 'light',
    layers: [0, 1, 2, 3, 4].map((i) => v(`--l${i}`)),
    ink: v('--ink'),
    dim: v('--ink-3'),
    warn: v('--warn'),
  };
}

export function createLayerScene(host: HTMLElement, opts: Options): LayerScene {
  const nav = navigator as Navigator & { deviceMemory?: number };
  let tier: Tier = (nav.hardwareConcurrency ?? 4) >= 8 && (nav.deviceMemory ?? 8) >= 8 ? 'high' : 'medium';

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: TIERS[tier].aa, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  const stack = new Group();
  stack.rotation.y = -0.62;
  scene.add(stack);

  /* ---------------------------------------------------------------- slabs */
  const shape = roundedRect(W, D, 0.32);
  const slabGeo = new ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 8 });
  slabGeo.rotateX(-Math.PI / 2);
  const topGeo = new ShapeGeometry(shape, 8);
  topGeo.rotateX(-Math.PI / 2);
  // ShapeGeometry UVs are in shape units; remap them to 0..1 for the texture.
  {
    const uv = topGeo.attributes.uv as BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / W + 0.5, uv.getY(i) / D + 0.5);
  }
  const haloGeo = new PlaneGeometry(W * 1.9, D * 2.1);
  haloGeo.rotateX(-Math.PI / 2);

  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = haloCanvas.height = 128;
  paintHalo(haloCanvas.getContext('2d')!, 128);
  const haloTex = new CanvasTexture(haloCanvas);

  interface Slab {
    group: Group;
    body: Mesh<ExtrudeGeometry, MeshBasicMaterial>;
    top: Mesh<ShapeGeometry, MeshBasicMaterial>;
    halo: Mesh<PlaneGeometry, MeshBasicMaterial>;
    edge: Line<BufferGeometry, LineBasicMaterial>;
    canvas: HTMLCanvasElement;
    tex: CanvasTexture;
    baseY: number;
  }
  const outline = new BufferGeometry().setFromPoints(shape.getPoints(12).map((p) => new Vector3(p.x, 0.1, -p.y)));

  const slabs: Slab[] = [];
  for (let i = 0; i < N; i++) {
    const group = new Group();
    const baseY = (2 - i) * GAP;
    group.position.y = baseY;
    const c = document.createElement('canvas');
    c.width = TEX_W;
    c.height = TEX_H;
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    const body = new Mesh(slabGeo, new MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }));
    const top = new Mesh(topGeo, new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    top.position.y = 0.101;
    const halo = new Mesh(haloGeo, new MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: AdditiveBlending }));
    halo.position.y = -0.05;
    const edge = new Line(outline, new LineBasicMaterial({ transparent: true }));
    group.add(halo, body, top, edge);
    stack.add(group);
    slabs.push({ group, body, top, halo, edge, canvas: c, tex, baseY });
  }

  /* ----------------------------------------------------- corner guide posts */
  const posts = new Group();
  const postMat = new LineDashedMaterial({ dashSize: 0.08, gapSize: 0.1, transparent: true, opacity: 0.35 });
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * (W / 2 - 0.25), sz * (D / 2 - 0.25)]);
  for (const [x, z] of corners) {
    const g = new BufferGeometry().setFromPoints([new Vector3(x, 2 * GAP + 0.1, z), new Vector3(x, -2 * GAP, z)]);
    const l = new Line(g, postMat);
    l.computeLineDistances();
    posts.add(l);
  }
  stack.add(posts);

  /* --------------------------------------------------------------- packets */
  const MAX_P = TIERS.high.packets;
  const pPos = new Float32Array(MAX_P * 3);
  const pCol = new Float32Array(MAX_P * 3);
  const pSeed = Array.from({ length: MAX_P }, () => ({
    x: (Math.random() - 0.5) * (W - 0.8),
    z: (Math.random() - 0.5) * (D - 0.6),
    speed: 0.35 + Math.random() * 0.5,
    off: Math.random(),
  }));
  const pGeo = new BufferGeometry();
  pGeo.setAttribute('position', new BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new BufferAttribute(pCol, 3));
  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = dotCanvas.height = 32;
  paintDot(dotCanvas.getContext('2d')!, 32);
  const pMat = new PointsMaterial({ size: 0.11, map: new CanvasTexture(dotCanvas), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending });
  const packets = new Points(pGeo, pMat);
  stack.add(packets);

  /* ----------------------------------------------------------------- theme */
  const layerColors = Array.from({ length: N }, () => new Color());
  let light = false;
  function setTheme() {
    const pal = readPalette();
    light = pal.light;
    const blend: Blending = light ? NormalBlending : AdditiveBlending;
    slabs.forEach((s, i) => {
      const accent = pal.layers[i];
      layerColors[i].set(accent);
      const p: Palette = { accent, ink: pal.ink, dim: pal.dim, light };
      paintLayer(s.canvas.getContext('2d')!, i, p, opts.labels[i]?.code ?? `L${i}`, opts.labels[i]?.name ?? '', pal.warn);
      s.tex.needsUpdate = true;
      s.body.material.color.set(light ? '#ffffff' : accent).lerp(new Color(accent), light ? 0.12 : 0.85);
      s.edge.material.color.set(accent);
      s.halo.material.color.set(accent);
      s.halo.material.blending = blend;
      s.halo.material.needsUpdate = true;
    });
    postMat.color.set(pal.dim);
    pMat.blending = blend;
    pMat.needsUpdate = true;
    kick();
  }

  /* ---------------------------------------------------------------- layout */
  let vw = 1, vh = 1, aspect = 1;
  function resize() {
    vw = host.clientWidth || innerWidth;
    vh = host.clientHeight || innerHeight;
    aspect = vw / vh;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TIERS[tier].dpr));
    renderer.setSize(vw, vh, false);
    camera.aspect = aspect;
    // Push the stack to the right on wide screens and down on tall ones, so
    // the hero copy keeps the clear side of the viewport.
    if (aspect >= 1.05) camera.setViewOffset(vw, vh, -vw * 0.22, 0, vw, vh);
    else camera.setViewOffset(vw, vh, 0, -vh * 0.3, vw, vh);
    camera.updateProjectionMatrix();
    kick();
  }

  /* ------------------------------------------------------------------ state */
  let target = 0;
  let dive = 0;
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  let lastInput = performance.now();
  let running = false;
  let paused = false;
  let raf = 0;
  let last = 0;
  let clock = 0;
  const camOffset = new Vector3(6.2, 5.0, 8.2);
  const look = new Vector3();

  function update(dt: number) {
    const k = 1 - Math.exp(-dt * 6);
    dive += (target - dive) * k;
    if (Math.abs(target - dive) < 0.0005) dive = target;
    mx += (tmx - mx) * (1 - Math.exp(-dt * 4));
    my += (tmy - my) * (1 - Math.exp(-dt * 4));
    clock += dt;

    const cur = MathUtils.clamp(dive, 0, N - 1);
    slabs.forEach((s, i) => {
      // Peel: slab i leaves as the dive moves from layer i towards i + 1.
      const peel = smooth(0.25, 0.95, dive - i);
      const near = 1 - MathUtils.clamp(Math.abs(cur - i), 0, 1);
      const spread = (1 - smooth(0, 0.6, dive)) * (i - 2) * -0.08;
      s.group.position.y = s.baseY + peel * 3.4 + spread + Math.sin(clock * 0.8 + i) * 0.02;
      s.group.rotation.x = peel * -0.35;
      s.group.rotation.z = peel * 0.12;
      const fade = 1 - peel;
      const focus = 0.55 + near * 0.45;
      s.top.material.opacity = fade * focus;
      s.body.material.opacity = fade * (light ? 0.75 : 0.28) * focus;
      s.edge.material.opacity = fade * (0.45 + near * 0.55);
      s.halo.material.opacity = fade * (light ? 0.1 + near * 0.12 : 0.12 + near * 0.35);
      s.group.visible = fade > 0.01;
    });
    postMat.opacity = 0.35 * (1 - smooth(3, 4, dive));

    // Packets fall from the surface to the frame layer, tinted by the layer they pass.
    const count = TIERS[tier].packets;
    const top = 2 * GAP, span = 4 * GAP;
    for (let i = 0; i < MAX_P; i++) {
      const s = pSeed[i];
      const o = i * 3;
      if (i >= count) { pPos[o + 1] = -999; continue; }
      const f = (s.off + clock * s.speed * 0.25) % 1;
      const y = top - f * span;
      pPos[o] = s.x; pPos[o + 1] = y; pPos[o + 2] = s.z;
      const li = MathUtils.clamp(Math.round(f * (N - 1)), 0, N - 1);
      const vis = y < slabs[Math.floor(cur)].group.position.y + 0.3 ? 1 : 0.15;
      const c = layerColors[li];
      pCol[o] = c.r * vis; pCol[o + 1] = c.g * vis; pCol[o + 2] = c.b * vis;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    // Camera follows the current slab down; the pointer tilts the whole stack.
    const y = (2 - cur) * GAP;
    const far = aspect < 1 ? Math.min(2.1, 1.08 / aspect) : 1;
    look.set(0, y, 0);
    camera.position.copy(camOffset).multiplyScalar(far).add(look);
    camera.lookAt(look);
    stack.rotation.y = -0.62 + mx * 0.28;
    stack.rotation.x = my * 0.08;
  }

  /* ----------------------------------------------------- adaptive quality */
  const samples: number[] = [];
  let warm = 0;
  function assess(dtMs: number) {
    if (++warm < 30) return;
    samples.push(dtMs);
    if (samples.length < 90) return;
    const med = [...samples].sort((a, b) => a - b)[samples.length >> 1];
    samples.length = 0;
    warm = 0;
    if (med > 22) {
      if (tier === 'high') tier = 'medium';
      else if (tier === 'medium') tier = 'low';
      else { opts.onGiveUp(); pause(); return; }
      opts.onTier(tier);
      resize();
    }
  }

  function wantsContinuous(now: number) {
    // Packets animate while the hero is in view; elsewhere render only while
    // something is actually moving.
    return target < 1.1 || Math.abs(target - dive) > 0.001 || now - lastInput < 1200;
  }

  function frame(now: number) {
    if (!running) return;
    // rAF timestamps are frame-start times and can precede the performance.now() taken in kick().
    const dtMs = Math.min(100, Math.max(0, now - last) || 16.7);
    last = now;
    update(dtMs / 1000);
    renderer.render(scene, camera);
    assess(dtMs);
    if (wantsContinuous(now) && !paused && !document.hidden) raf = requestAnimationFrame(frame);
    else running = false;
  }

  function kick() {
    if (running || paused || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    paused = true;
    running = false;
    cancelAnimationFrame(raf);
  }
  function resume() {
    paused = false;
    samples.length = 0;
    warm = 0;
    kick();
  }

  /* ----------------------------------------------------------------- input */
  addEventListener('pointermove', (e) => {
    tmx = e.clientX / innerWidth - 0.5;
    tmy = e.clientY / innerHeight - 0.5;
    lastInput = performance.now();
    kick();
  }, { passive: true });
  addEventListener('resize', resize, { passive: true });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); pause(); opts.onGiveUp(); });

  setTheme();
  resize();
  update(0);
  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => (resolveReady = r));
  requestAnimationFrame(() => {
    renderer.render(scene, camera);
    resolveReady();
    kick();
  });
  opts.onTier(tier);

  return {
    ready,
    get tier() { return tier; },
    setDive(p: number) {
      if (!Number.isFinite(p)) return;
      target = MathUtils.clamp(p, 0, N - 1);
      kick();
    },
    setTheme,
    pause,
    resume,
  };
}
