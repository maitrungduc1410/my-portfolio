// @ts-check
import { defineConfig } from 'astro/config';

// Behind an HTTPS reverse proxy the Vite client already derives the HMR socket
// from the page URL. These variables are only an escape hatch for proxies that
// expose the websocket on a different host or port.
const hmrHost = process.env.ASTRO_HMR_HOST;
const hmrClientPort = process.env.ASTRO_HMR_CLIENT_PORT ? Number(process.env.ASTRO_HMR_CLIENT_PORT) : undefined;
const hmrProtocol = process.env.ASTRO_HMR_PROTOCOL;
const hmr =
  hmrHost || hmrClientPort || hmrProtocol
    ? { host: hmrHost, clientPort: hmrClientPort, protocol: hmrProtocol }
    : undefined;

export default defineConfig({
  site: 'https://ducmai.me',
  output: 'static',
  trailingSlash: 'ignore',
  i18n: {
    locales: ['en', 'vi'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  server: {
    host: true,
    port: 4321,
    allowedHosts: true,
  },
  devToolbar: { enabled: false },
  build: {
    inlineStylesheets: 'always',
  },
  vite: {
    server: {
      allowedHosts: true,
      hmr,
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 700,
    },
  },
});
