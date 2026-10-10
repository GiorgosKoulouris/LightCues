import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';
import { bundledPackages } from './scripts/bundled-packages.mjs';

export default defineConfig({
  main: {
    plugins: [bundledPackages()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          engine: resolve(__dirname, 'src/main/engine-process.ts'),
        },
      },
    },
  },
  preload: { plugins: [bundledPackages()] },
  renderer: {
    plugins: [react(), bundledPackages()],
  },
});
