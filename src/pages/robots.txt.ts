import type { APIRoute } from 'astro';

export const GET: APIRoute = () =>
  new Response('User-agent: *\nAllow: /\n\nSitemap: https://ducmai.me/sitemap.xml\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
