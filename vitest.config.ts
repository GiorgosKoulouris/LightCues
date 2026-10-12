import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // npm run coverage. Not part of check, not a CI gate.
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.module.css',
        'src/renderer/src/test-setup.ts',
        'src/renderer/index.html',
      ],
    },
    projects: [
      {
        test: {
          name: 'logic',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.{mjs,ts}'],
          environment: 'node',
        },
      },
      {
        // Component tests (Testing Library + jsdom).
        plugins: [react()],
        test: {
          name: 'components',
          include: ['src/renderer/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['src/renderer/src/test-setup.ts'],
        },
      },
    ],
  },
});
