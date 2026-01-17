


import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync } from 'fs';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const _dirname = process.cwd();

export default defineConfig({
  base: './',
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    {
      name: 'copy-extension-files',
      writeBundle() {
        // Copy manifest.json
          copyFileSync(
            resolve(_dirname, 'manifest.json'),
            resolve(_dirname, 'dist/manifest.json')
        );
        // Copy background.js
          copyFileSync(
            resolve(_dirname, 'background.js'),
            resolve(_dirname, 'dist/background.js')
        );
        // Copy content.js
          copyFileSync(
            resolve(_dirname, 'content.js'),
            resolve(_dirname, 'dist/content.js')
        );
        // Copy offscreen.js
          copyFileSync(
            resolve(_dirname, 'offscreen.js'),
            resolve(_dirname, 'dist/offscreen.js')
        );
        // Copy offscreen.html
          copyFileSync(
            resolve(_dirname, 'offscreen.html'),
            resolve(_dirname, 'dist/offscreen.html')
        );
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(_dirname, 'index.html')
      }
    }
  }
  ,
  resolve: {
    alias: {
      buffer: 'buffer',
    }
  },
  define: {
    'process.env': {},
    global: 'window',
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  server: {
    historyApiFallback: true,
  }
})
