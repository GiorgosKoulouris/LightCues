import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['out/**', 'dist/**', 'node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/main/**', 'src/preload/**', 'src/engine/**', 'src/shared/**', '*.config.*'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/renderer/**'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    languageOptions: { globals: globals.browser },
  },
  {
    // The engine runs standalone in its own process (ADR 0002).
    files: ['src/engine/**', 'src/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'electron/*', 'react', 'react/*', 'react-dom', 'react-dom/*'],
              message: 'Engine and shared code must not depend on Electron or the UI.',
            },
            {
              group: [
                '**/main',
                '**/main/*',
                '**/preload',
                '**/preload/*',
                '**/renderer',
                '**/renderer/*',
              ],
              message: 'Engine and shared code must not import Electron-side or UI code.',
            },
          ],
        },
      ],
    },
  },
);
