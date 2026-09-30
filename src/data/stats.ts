import snapshot from './stats.snapshot.json';

export type Stats = typeof snapshot;

// stats.live.json is produced by scripts/fetch-stats.mjs before a build and is
// git-ignored. When it is missing the glob is empty and the snapshot wins.
const live = import.meta.glob<{ default: Partial<Stats> }>('./stats.live.json', { eager: true });
const liveData = Object.values(live)[0]?.default ?? {};

export const stats: Stats = { ...snapshot, ...liveData } as Stats;

export const totalDownloads = Object.values(stats.npm.downloads).reduce((a, b) => a + b, 0);
export const nativeDownloads = Object.entries(stats.npm.downloads)
  .filter(([name]) => name.startsWith('react-native-'))
  .reduce((a, [, n]) => a + n, 0);
export const totalStars = Object.values(stats.github.stars).reduce((a, b) => a + b, 0);

export const stars = (repo: string): number | undefined =>
  (stats.github.stars as Record<string, number>)[repo];
export const downloads = (pkg: string): number | undefined =>
  (stats.npm.downloads as Record<string, number>)[pkg];
