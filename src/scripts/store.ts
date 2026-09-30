import type { ClientStrings } from '../i18n/client';

export type ThemePref = 'system' | 'light' | 'dark';
export type Toggle = 'on' | 'off';
export interface Prefs {
  theme: ThemePref;
  motion: Toggle;
  sound: Toggle;
  hud: Toggle;
}

const root = document.documentElement;
const KEY = (k: string) => `dm:${k}`;

export const strings: ClientStrings = JSON.parse(document.getElementById('i18n')?.textContent || '{}');

export function getPref<K extends keyof Prefs>(k: K): Prefs[K] {
  const ds = root.dataset;
  if (k === 'theme') return (ds.themePref as Prefs[K]) ?? ('system' as Prefs[K]);
  return (ds[k] as Prefs[K]) ?? ('off' as Prefs[K]);
}

export function setPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
  try {
    localStorage.setItem(KEY(k), v);
  } catch {
    /* private mode: preference lasts for this page only */
  }
  if (k === 'theme') {
    root.dataset.themePref = v;
    applyTheme();
  } else {
    root.dataset[k] = v;
  }
  window.dispatchEvent(new CustomEvent('dm:pref', { detail: { key: k, value: v } }));
}

const lightMq = matchMedia('(prefers-color-scheme: light)');
function applyTheme() {
  const pref = getPref('theme');
  const next = pref === 'system' ? (lightMq.matches ? 'light' : 'dark') : pref;
  if (root.dataset.theme !== next) {
    root.dataset.theme = next;
    const meta = document.querySelector<HTMLMetaElement>('meta[name=theme-color]');
    if (meta) meta.content = next === 'light' ? '#f7f6f3' : '#07080b';
    window.dispatchEvent(new CustomEvent('dm:theme', { detail: next }));
  }
}
lightMq.addEventListener('change', applyTheme);

export const isLight = () => root.dataset.theme === 'light';
export const motionOn = () => root.dataset.motion === 'on';

/** Reads a CSS custom property off the root, resolved for the current theme. */
export function cssVar(name: string, el: Element = root): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function onPref(fn: (key: keyof Prefs, value: string) => void) {
  window.addEventListener('dm:pref', (e) => {
    const { key, value } = (e as CustomEvent).detail;
    fn(key, value);
  });
}
export function onTheme(fn: () => void) {
  window.addEventListener('dm:theme', fn);
}

let toastTimer = 0;
export function toast(msg: string) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('on'), 1800);
}

export function fill(template: string, x: string) {
  return template.replace('{x}', x);
}
