import { en, type Dict } from './en';
import { vi } from './vi';

export const LOCALES = ['en', 'vi'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_META: Record<Locale, { label: string; short: string; htmlLang: string; og: string; intl: string; path: string }> = {
  en: { label: 'English', short: 'EN', htmlLang: 'en', og: 'en_US', intl: 'en-US', path: '/' },
  vi: { label: 'Tiếng Việt', short: 'VI', htmlLang: 'vi', og: 'vi_VN', intl: 'vi-VN', path: '/vi/' },
};

const DICTS: Record<Locale, Dict> = { en, vi };

export function useI18n(locale: Locale) {
  const intl = LOCALE_META[locale].intl;
  const nf = new Intl.NumberFormat(intl);
  const df = new Intl.DateTimeFormat(intl, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  return {
    t: DICTS[locale],
    locale,
    num: (n: number) => nf.format(n),
    date: (iso: string) => df.format(new Date(iso + 'T00:00:00Z')),
  };
}

export type { Dict };
