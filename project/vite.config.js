import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      writeBundle() {
        // Copy manifest.json
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );
        // Copy background.js
        copyFileSync(
          resolve(__dirname, 'background.js'),
          resolve(__dirname, 'dist/background.js')
        );
        // Copy content.js
        copyFileSync(
          resolve(__dirname, 'content.js'),
          resolve(__dirname, 'dist/content.js')
        );
        // Copy offscreen.js
        copyFileSync(
          resolve(__dirname, 'offscreen.js'),
          resolve(__dirname, 'dist/offscreen.js')
        );
        // Copy offscreen.html
        copyFileSync(
          resolve(__dirname, 'offscreen.html'),
          resolve(__dirname, 'dist/offscreen.html')
        );
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html')
      }
    }
  }
})
