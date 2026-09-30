#!/usr/bin/env node
// Fetches the public numbers shown on the site: GitHub, npm and Viblo.
//
// Output: src/data/stats.live.json (git-ignored). The page merges it over the
// committed snapshot src/data/stats.snapshot.json, source by source, so a
// failed request only ever falls back to the last known good value and a build
// never fails because a network is missing.
//
//   node scripts/fetch-stats.mjs             refresh the live file
//   node scripts/fetch-stats.mjs --snapshot  refresh the committed snapshot too
//   STATS_OFFLINE=1                          skip the network entirely

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const LIVE = fileURLToPath(new URL('src/data/stats.live.json', root));
const SNAPSHOT = fileURLToPath(new URL('src/data/stats.snapshot.json', root));

const USER = 'maitrungduc1410';
const REPOS = [
  'vivari',
  'react-native-video-trim',
  'react-native-loader-kit',
  'react-native-shared-hero',
  'react-native-signature-ink',
  'react-native-waveform-player',
  'react-native-waveform-recorder',
  'react-native-zalo-kit',
  'react-native-motion-splash',
  'react-native-new-feature',
  'react-native-pointer-location',
  'react-native-textflow',
  'react-native-tooltipster',
  'node-scp-async',
  'konva-inspector',
  'socket.io-mesh-adapter',
];
const PACKAGES = [
  'node-scp',
  'react-native-video-trim',
  'react-native-loader-kit',
  'react-native-shared-hero',
  'react-native-signature-ink',
  'react-native-waveform-player',
  'react-native-waveform-recorder',
  'react-native-pointer-location',
  'react-native-zalo-kit',
  'react-native-textflow',
  'react-native-new-feature',
  'react-native-tooltipster',
  'react-native-motion-splash',
  'vivari',
  'socket.io-mesh-adapter',
];
const VIBLO_POSTS = ['bJzKmaoDK9N', 'aAY4q2zKJPw', '07LKX9WPZV4', 'RnB5pxEG5PG', '4dbZNnMnZYM'];

const snapshotMode = process.argv.includes('--snapshot');
const offline = process.env.STATS_OFFLINE === '1';

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'ducmai.me-build', accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function github() {
  const auth = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const user = await getJson(`https://api.github.com/users/${USER}`, auth);
  const repos = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await getJson(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner&page=${page}`, auth);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const stars = {};
  for (const name of REPOS) {
    const r = repos.find((x) => x.name === name);
    if (r) stars[name] = r.stargazers_count;
  }
  return { followers: user.followers, publicRepos: user.public_repos, stars };
}

async function npm() {
  const data = await getJson(`https://api.npmjs.org/downloads/point/last-month/${PACKAGES.join(',')}`);
  const downloads = {};
  for (const name of PACKAGES) downloads[name] = data[name]?.downloads ?? 0;
  const anyEntry = Object.values(data).find(Boolean);
  return { period: 'last-month', start: anyEntry?.start, end: anyEntry?.end, downloads };
}

async function viblo() {
  const user = (await getJson(`https://viblo.asia/api/users/${USER}`)).data;
  const posts = (await getJson(`https://viblo.asia/api/users/${USER}/posts?limit=100`)).data;
  const claps = posts.reduce((a, p) => a + (p.points || 0), 0);
  const latest = posts.reduce((a, p) => (p.published_at > a ? p.published_at : a), '');
  const featured = VIBLO_POSTS.map((slug) => posts.find((p) => p.slug === slug))
    .filter(Boolean)
    .map((p) => ({
      id: p.slug,
      title: p.title,
      url: p.url,
      claps: p.points,
      views: p.views_count,
      published: p.published_at.slice(0, 10),
    }));
  return {
    posts: user.posts_count,
    views: user.total_post_views,
    followers: user.followers_count,
    claps,
    latest: latest.slice(0, 10),
    featured,
  };
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

const snapshot = (await readJson(SNAPSHOT)) ?? {};
const out = { ...snapshot };
const sources = { github, npm, viblo };
const status = {};

if (!offline) {
  const results = await Promise.allSettled(Object.values(sources).map((fn) => fn()));
  Object.keys(sources).forEach((key, i) => {
    const r = results[i];
    if (r.status === 'fulfilled') {
      out[key] = r.value;
      status[key] = 'live';
    } else {
      status[key] = `snapshot (${r.reason?.message ?? r.reason})`;
    }
  });
}

// An API can answer 200 with an empty body; never let that zero out the page.
const plausible =
  out.github?.followers > 0 &&
  Object.keys(out.github?.stars ?? {}).length > 0 &&
  Object.values(out.npm?.downloads ?? {}).some((n) => n > 0) &&
  out.viblo?.posts > 0;
const allLive = Object.keys(sources).every((k) => status[k] === 'live') && plausible;
if (Object.values(status).some((s) => s === 'live')) out.asOf = new Date().toISOString().slice(0, 10);

await writeFile(LIVE, JSON.stringify(out, null, 2) + '\n');
if (snapshotMode) {
  if (!allLive) {
    console.error('[stats] refusing to overwrite the snapshot with partial or empty data:', status);
    process.exitCode = 1;
  } else {
    await writeFile(SNAPSHOT, JSON.stringify(out, null, 2) + '\n');
  }
}

for (const k of Object.keys(sources)) console.log(`[stats] ${k}: ${status[k] ?? 'snapshot (offline)'}`);
console.log(`[stats] as of ${out.asOf ?? 'unknown'}`);
