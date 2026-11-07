import { defineConfig } from 'vite';

// assets/ is served at the web root in dev and copied into dist/ on build,
// so the game references /textures/..., /models/..., /hdri/...
export default defineConfig({
  publicDir: 'assets',
  server: { host: '0.0.0.0', port: 3000, strictPort: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
