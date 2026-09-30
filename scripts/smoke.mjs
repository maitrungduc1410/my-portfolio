#!/usr/bin/env node
// Playwright smoke test against a running server (default: astro preview).
//   SMOKE_URL=http://localhost:4321 SMOKE_SHOTS=./screens node scripts/smoke.mjs
// Checks / and /vi/ in light and dark at 390px and 1440px: no console
// errors, no failed requests, no horizontal overflow. Also exercises the
// palette, the theme toggle and every demo once.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4321';
const SHOTS = process.env.SMOKE_SHOTS ?? 'screens';
const EXE = process.env.CHROMIUM_PATH;
const PAGES = ['/', '/vi/'];
const THEMES = ['light', 'dark'];
const WIDTHS = [390, 1440];

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({
  executablePath: EXE || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const failures = [];
const report = [];

for (const path of PAGES) {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: width < 600 ? 844 : 900 },
        deviceScaleFactor: 1,
        colorScheme: theme,
        reducedMotion: 'no-preference',
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('requestfailed', (r) => {
        const u = r.url();
        if (u.startsWith(BASE)) errors.push(`requestfailed: ${u} ${r.failure()?.errorText}`);
      });
      page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });

      const tag = `${path === '/' ? 'en' : path.replaceAll('/', '')}-${theme}-${width}`;
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const mode = await page.evaluate(() => document.getElementById('stage')?.dataset.mode);
      const resolvedTheme = await page.evaluate(() => document.documentElement.dataset.theme);
      await page.screenshot({ path: `${SHOTS}/${tag}-hero.png` });

      // Walk the page so every lazy demo initialises and the dive runs.
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < h; y += 500) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(90);
      }
      await page.waitForTimeout(500);
      const layer = await page.evaluate(() => document.documentElement.dataset.layer);

      // Interact with each demo once.
      if (width === 1440) {
        await page.locator('[data-vv-start]').click();
        await page.locator('[data-mesh-emit]').click();
        await page.locator('.ld').nth(3).click();
        await page.locator('[data-wave-play]').click();
        const tile = page.locator('[data-sh-tile]').nth(1);
        await tile.scrollIntoViewIfNeeded();
        await tile.click();
        await page.waitForTimeout(700);
        await page.locator('[data-sh-back]').click();
        await page.waitForTimeout(700);
        const ink = page.locator('[data-ink-cv]');
        const ib = await ink.boundingBox();
        if (ib) {
          await page.mouse.move(ib.x + 40, ib.y + 80);
          await page.mouse.down();
          await page.mouse.move(ib.x + 200, ib.y + 120, { steps: 8 });
          await page.mouse.up();
        }
        await page.locator('.tl__btn').nth(2).click();
        await page.locator('[data-filter="2"]').click();
      }

      const overflow = await page.evaluate(() => {
        const d = document.documentElement;
        const wide = [...document.querySelectorAll('body *')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.right > d.clientWidth + 1 && getComputedStyle(el).position !== 'fixed' && r.width > 0;
        }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
        return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, wide };
      });
      if (overflow.scrollWidth > overflow.clientWidth) errors.push(`horizontal overflow: ${overflow.scrollWidth} > ${overflow.clientWidth} ${overflow.wide.join(', ')}`);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SHOTS}/${tag}-full.png`, fullPage: true });

      // Palette + terminal.
      await page.keyboard.press('Control+k');
      await page.waitForSelector('#palette[open]');
      await page.keyboard.type('whoami');
      await page.keyboard.press('Enter');
      const termOut = await page.locator('#pal-out').innerText();
      if (!termOut.includes('Duc') && !termOut.includes('Đức')) errors.push('palette: whoami produced no output');
      if (width === 1440 && theme === 'dark') await page.screenshot({ path: `${SHOTS}/${tag}-palette.png` });
      await page.keyboard.press('Escape');

      // Theme toggle cycles and persists.
      await page.locator('.nav [data-action="theme"]').click();
      const pref = await page.evaluate(() => localStorage.getItem('dm:theme'));
      if (pref !== 'light') errors.push(`theme toggle: expected light, got ${pref}`);

      report.push({ tag, mode, theme: resolvedTheme, layer, errors: errors.length });
      if (errors.length) failures.push({ tag, errors });
      await ctx.close();
    }
  }
}

// Reduced motion must fall back to the static stack.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const state = await page.evaluate(() => ({ motion: document.documentElement.dataset.motion, mode: document.getElementById('stage')?.dataset.mode }));
  await page.screenshot({ path: `${SHOTS}/en-dark-1440-reduced-motion.png` });
  report.push({ tag: 'en-dark-1440-reduced-motion', ...state, errors: errors.length });
  if (state.motion !== 'off' || state.mode !== 'static') errors.push(`reduced motion: expected off/static, got ${state.motion}/${state.mode}`);
  if (errors.length) failures.push({ tag: 'reduced-motion', errors });
  await ctx.close();
}

await browser.close();
console.table(report);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log(`smoke: ${report.length} runs, 0 failures. Screenshots in ${SHOTS}/`);
