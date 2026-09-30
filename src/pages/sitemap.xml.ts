import type { APIRoute } from 'astro';
import { LOCALES, LOCALE_META } from '../i18n';
import { stats } from '../data/stats';

const SITE = 'https://ducmai.me';

export const GET: APIRoute = () => {
  const alternates = LOCALES.map(
    (l) => `    <xhtml:link rel="alternate" hreflang="${LOCALE_META[l].htmlLang}" href="${SITE}${LOCALE_META[l].path}"/>`,
  )
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`)
    .join('\n');
  const urls = LOCALES.map(
    (l) => `  <url>\n    <loc>${SITE}${LOCALE_META[l].path}</loc>\n    <lastmod>${stats.asOf}</lastmod>\n${alternates}\n  </url>`,
  ).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
