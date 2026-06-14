import { defineConfig } from 'vite';

// `server.host` exposes the dev server on the LAN so the app can be tested on a
// real tablet / phone (touch acceptance criteria).
//
// `base` is '/' in dev but '/anatomy-viewer/' for the production build, because
// GitHub Pages serves a project site under https://<user>.github.io/<repo>/.
// Runtime asset paths (models, Draco decoder) use import.meta.env.BASE_URL so
// they resolve correctly under that sub-path.
export default defineConfig(({ command }) => ({
  root: '.',
  publicDir: 'public',
  base: command === 'build' ? '/anatomy-viewer/' : '/',
  server: {
    host: true,
    port: 5173,
  },
}));
