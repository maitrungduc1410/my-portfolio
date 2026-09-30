#!/usr/bin/env node
// Renders public/og/{en,vi}.png (1200×630) from an HTML template with the
// local Chromium used by the smoke test. Run after changing the headline.
//   CHROMIUM_PATH=/path/to/chrome npm run og
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/og');
await mkdir(out, { recursive: true });

const font = async (f) => (await readFile(join(root, 'public/fonts', f))).toString('base64');
const [sans, sansVi, sansSym, mono, monoVi, monoSym] = await Promise.all(
  ['geist-latin', 'geist-vi', 'geist-symbols', 'geist-mono-latin', 'geist-mono-vi', 'geist-mono-symbols'].map((f) => font(`${f}.woff2`)),
);

// HEADLINE in src/config/headline.ts stays the single source of truth.
const cfg = await readFile(join(root, 'src/config/headline.ts'), 'utf8');
const block = cfg.slice(cfg.indexOf('HEADLINE:'), cfg.indexOf('};', cfg.indexOf('HEADLINE:')));
const headline = (l) => block.match(new RegExp(`${l}:\\s*'([^']+)'`))[1];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const copy = {
  en: { name: 'Duc Trung Mai', head: headline('en'), role: 'Software engineer · native, runtime, frames', l: ['UI', 'React Native', 'Swift · Kotlin', 'C · Rust → Wasm', 'GPU · frames'] },
  vi: { name: 'Mai Trung Đức', head: headline('vi'), role: 'Kỹ sư phần mềm · native, runtime, khung hình', l: ['UI', 'React Native', 'Swift · Kotlin', 'C · Rust → Wasm', 'GPU · khung hình'] },
};
const acc = ['#f5a524', '#38bdf8', '#a78bfa', '#34d399', '#fb7185'];

const html = (c, lang) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
@font-face{font-family:G;src:url(data:font/woff2;base64,${sans}) format('woff2');font-weight:100 900;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F}
@font-face{font-family:G;src:url(data:font/woff2;base64,${sansVi}) format('woff2');font-weight:100 900;unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB}
@font-face{font-family:G;src:url(data:font/woff2;base64,${sansSym}) format('woff2');font-weight:100 900;unicode-range:U+2190-2199}
@font-face{font-family:M;src:url(data:font/woff2;base64,${mono}) format('woff2');font-weight:100 900;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F}
@font-face{font-family:M;src:url(data:font/woff2;base64,${monoVi}) format('woff2');font-weight:100 900;unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9}
@font-face{font-family:M;src:url(data:font/woff2;base64,${monoSym}) format('woff2');font-weight:100 900;unicode-range:U+2190-2199,U+23CE}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0a0a0c;color:#f4f4f5;font-family:G,sans-serif;position:relative;overflow:hidden}
body::before{content:"";position:absolute;inset:0;background:radial-gradient(60% 70% at 78% 55%,rgba(167,139,250,.18),transparent 70%),radial-gradient(40% 40% at 10% 0%,rgba(245,165,36,.10),transparent 70%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:40px 40px}
.txt{position:absolute;left:72px;top:72px;width:620px}
.brand{display:flex;align-items:center;gap:14px;font:600 22px G,sans-serif}
.brand b{width:44px;height:44px;border-radius:10px;background:#f4f4f5;color:#0a0a0c;display:grid;place-items:center;font:700 17px M,monospace;box-shadow:0 3px 0 #f5a524}
h1{margin-top:88px;font-size:74px;line-height:1.04;font-weight:700;letter-spacing:-.035em;text-wrap:balance}
p{margin-top:26px;font:500 22px M,monospace;color:#a1a1aa}
.url{position:absolute;left:72px;bottom:60px;font:600 26px M,monospace;color:#f4f4f5;display:flex;gap:12px;align-items:center}
.url::before{content:"";width:28px;height:2px;background:#a78bfa}
.stack{position:absolute;right:40px;top:50%;width:440px;height:520px;transform:translateY(-50%);perspective:1400px}
.sl{position:absolute;left:60px;width:300px;height:210px;border-radius:22px;border:2px solid var(--c);background:linear-gradient(135deg,color-mix(in srgb,var(--c) 26%,transparent),color-mix(in srgb,var(--c) 6%,transparent));transform:rotateX(58deg) rotateZ(-38deg);box-shadow:0 0 50px color-mix(in srgb,var(--c) 30%,transparent)}
.sl span{position:absolute;left:18px;bottom:14px;font:600 15px M,monospace;color:var(--c)}
</style></head><body><div class="grid"></div>
<div class="txt"><div class="brand"><b>DM</b>${c.name}</div><h1>${esc(c.head)}</h1><p>${c.role}</p></div>
<div class="url">ducmai.me</div>
<div class="stack">${c.l.map((t, i) => `<div class="sl" style="--c:${acc[i]};top:${i * 72}px;z-index:${5 - i}"><span>L${i} · ${t}</span></div>`).join('')}</div>
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const [lang, c] of Object.entries(copy)) {
  await page.setContent(html(c, lang), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, `${lang}.png`), type: 'png' });
  console.log(`og/${lang}.png`);
}
await browser.close();
