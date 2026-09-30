export const GH_USER = 'maitrungduc1410';
export const GH = `https://github.com/${GH_USER}`;
export const repo = (name: string) => `${GH}/${name}`;
export const EMAIL = 'maitrungduc1410@gmail.com';

export const SOCIAL = {
  github: GH,
  linkedin: 'https://www.linkedin.com/in/maitrungduc1410',
  x: 'https://x.com/maitrungduc1410',
  viblo: 'https://viblo.asia/u/maitrungduc1410',
  vivari: 'https://vivari.run',
  lynx: 'https://lynxjs.org',
};

/** Native modules not featured with their own card. npm name equals repo name. */
export const NATIVE_FAMILY = [
  'react-native-loader-kit',
  'react-native-waveform-player',
  'react-native-waveform-recorder',
  'react-native-signature-ink',
  'react-native-pointer-location',
  'react-native-zalo-kit',
  'react-native-textflow',
  'react-native-new-feature',
  'react-native-tooltipster',
  'react-native-motion-splash',
];

export type LayerIndex = 0 | 1 | 2 | 3 | 4;

/** Rebuilds of famous product behaviours, tagged with the layer they mostly live in. */
export const LAB: { repo: string; layer: LayerIndex }[] = [
  { repo: 'youtube-heatmap', layer: 1 },
  { repo: 'youtube-video-preview', layer: 1 },
  { repo: 'twitter-hacking', layer: 1 },
  { repo: 'InstagramImageGallery', layer: 2 },
  { repo: 'iOSCompass', layer: 2 },
  { repo: 'react-native-pointer-location', layer: 2 },
  { repo: 'react-native-motion-splash', layer: 2 },
  { repo: 'devtools-frontend-demo', layer: 3 },
  { repo: 'wasm-hybrid-build', layer: 3 },
  { repo: 'youtube-smooth-progressbar', layer: 4 },
  { repo: 'double-raf-demo', layer: 4 },
  { repo: 'HardwareVideoDemo', layer: 4 },
];

/** Section anchors, in scroll order, with the layer each one belongs to. */
export const SECTIONS: { id: string; layer: LayerIndex; nav: 'now' | 'native' | 'runtime' | 'lab' | 'writing' | 'career' | 'contact' | null }[] = [
  { id: 'top', layer: 0, nav: null },
  { id: 'now', layer: 1, nav: 'now' },
  { id: 'native', layer: 2, nav: 'native' },
  { id: 'runtime', layer: 3, nav: 'runtime' },
  { id: 'lab', layer: 4, nav: 'lab' },
  { id: 'writing', layer: 4, nav: 'writing' },
  { id: 'career', layer: 4, nav: 'career' },
  { id: 'contact', layer: 4, nav: 'contact' },
];

/** First section of each layer, for the depth gauge and `cd`. */
export const LAYER_ANCHORS = ['top', 'now', 'native', 'runtime', 'lab'] as const;
