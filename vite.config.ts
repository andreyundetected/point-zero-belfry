import { defineConfig, type Plugin } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

/** Раздаёт /assets как статику (dev: middleware, build: копирование в dist/assets). */
function serveAssets(): Plugin {
  const root = path.resolve(__dirname, 'assets');
  const mime: Record<string, string> = {
    '.glb': 'model/gltf-binary', '.png': 'image/png', '.exr': 'application/octet-stream', '.ogg': 'audio/ogg',
    '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.json': 'application/json', '.jpg': 'image/jpeg',
  };
  return {
    name: 'serve-assets',
    configureServer(server) {
      server.middlewares.use('/assets', (req, res, next) => {
        const rel = decodeURIComponent((req.url || '/').split('?')[0]);
        const file = path.join(root, rel);
        if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next();
        res.setHeader('Content-Type', mime[path.extname(file).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const dest = path.resolve(__dirname, 'dist/assets');
      if (fs.existsSync(root)) fs.cpSync(root, dest, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [serveAssets()],
  publicDir: false,
  server: { host: true, port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
