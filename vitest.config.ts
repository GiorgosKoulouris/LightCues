import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'logic',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
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
