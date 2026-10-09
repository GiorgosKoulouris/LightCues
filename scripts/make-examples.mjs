// Writes the example Venue Patch and Show to examples/ from
// scripts/make-examples/demo.ts. The files are committed, so packaging
// doesn't need this script.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

// Vite's module runner loads the TypeScript and the app modules it imports.
const { module } = await runnerImport(
  fileURLToPath(new URL('./make-examples/demo.ts', import.meta.url)),
  { configFile: false, logLevel: 'warn' },
);
const { venue, show } = module.demoFiles();
const folder = new URL('../examples/', import.meta.url);
mkdirSync(folder, { recursive: true });
writeFileSync(new URL('demo.lcvenue', folder), venue);
writeFileSync(new URL('demo.lcshow', folder), show);
console.log('Wrote examples/demo.lcvenue and examples/demo.lcshow');
