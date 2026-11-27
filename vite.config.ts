import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function serveAndCopyMobileGodotPlugin(): Plugin {
  const mobileGodotDir = path.resolve(__dirname, 'mobile-godot');

  const mimeMap: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
    '.pck': 'application/octet-stream',
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.tscn': 'text/plain; charset=utf-8',
    '.ttf': 'font/ttf',
  };

  return {
    name: 'mobile-godot-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const cleanUrl = req.url.split('?')[0];
        if (
          cleanUrl === '/data.json' ||
          cleanUrl.startsWith('/assets/') ||
          cleanUrl.startsWith('/missions/')
        ) {
          const candidate = path.resolve(mobileGodotDir, cleanUrl.slice(1));
          if (
            candidate.startsWith(mobileGodotDir) &&
            fs.existsSync(candidate) &&
            fs.statSync(candidate).isFile()
          ) {
            const ext = path.extname(candidate).toLowerCase();
            res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
            fs.createReadStream(candidate).pipe(res);
            return;
          }
        }
        next();
      });
    },
    closeBundle(error?: Error): void {
      if (error) return;
      const distDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) return;

      const dataJsonSrc = path.join(mobileGodotDir, 'data.json');
      if (fs.existsSync(dataJsonSrc)) {
        fs.copyFileSync(dataJsonSrc, path.join(distDir, 'data.json'));
      }

      for (const folder of ['assets', 'missions']) {
        const srcFolder = path.join(mobileGodotDir, folder);
        const destFolder = path.join(distDir, folder);
        if (fs.existsSync(srcFolder)) {
          fs.cpSync(srcFolder, destFolder, { recursive: true, force: true });
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      serveAndCopyMobileGodotPlugin(),
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
