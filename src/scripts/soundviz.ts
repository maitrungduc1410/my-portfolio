// The nav sound icon's bars, driven by the synth's analyser. The loop only
// runs while something is audible and parks the bars at rest afterwards.
let an: AnalyserNode | null = null;
let buf: Uint8Array<ArrayBuffer>;
let bars: SVGElement[] = [];
let raf = 0, quiet = 0, lastKick = 0;

// Frequency bins per bar, at fftSize 64 (about 750 Hz per bin).
const BANDS: [number, number][] = [[0, 1], [1, 3], [3, 8]];

export function attachViz(a: AnalyserNode) {
  an = a;
  buf = new Uint8Array(a.frequencyBinCount);
  bars = [...document.querySelectorAll<SVGElement>('[data-snd-bar]')];
}

function frame() {
  if (!an || document.documentElement.dataset.sound !== 'on') return park();
  an.getByteFrequencyData(buf);
  let peak = 0;
  bars.forEach((b, i) => {
    const [lo, hi] = BANDS[i] ?? BANDS[0];
    let sum = 0;
    for (let k = lo; k <= hi; k++) sum += buf[k];
    const v = sum / (hi - lo + 1);
    peak = Math.max(peak, v);
    b.style.transform = `scaleY(${(0.22 + 0.78 * Math.min(1, v / 170)).toFixed(3)})`;
  });
  quiet = peak < 4 && performance.now() - lastKick > 250 ? quiet + 1 : 0;
  if (quiet > 12) return park();
  raf = requestAnimationFrame(frame);
}

function park() {
  raf = 0;
  quiet = 0;
  for (const b of bars) b.style.transform = '';
}

export function kickViz() {
  lastKick = performance.now();
  if (!raf && an) raf = requestAnimationFrame(frame);
}
