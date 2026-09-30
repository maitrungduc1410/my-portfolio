import type { APIRoute } from 'astro';

// Link-preview crawlers are named explicitly: some scrapers (Facebook's among
// them) look for their own group instead of reading the wildcard one.
const PREVIEW_BOTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'Slackbot-LinkExpanding',
  'Discordbot',
  'TelegramBot',
  'WhatsApp',
  'Pinterestbot',
  'redditbot',
  'Applebot',
];

const body = [
  '# Link previews for social networks and chat apps.',
  ...PREVIEW_BOTS.map((ua) => `User-agent: ${ua}`),
  'Allow: /',
  '',
  'User-agent: *',
  'Allow: /',
  '',
  'Sitemap: https://ducmai.me/sitemap.xml',
  '',
].join('\n');

export const GET: APIRoute = () => new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });