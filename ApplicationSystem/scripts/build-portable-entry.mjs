// Nodevision/ApplicationSystem/scripts/build-portable-entry.mjs
// This file bundles the Nodevision CLI into a CommonJS entry so that pkg can build portable Nodevision binaries from a consistent runtime entry point.

import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// pkg's bootstrap loads the entry via CommonJS `require()`, so emit CJS.
const outfile = path.resolve('ApplicationSystem', 'build', 'nodevision-cli.cjs');
mkdirSync(path.dirname(outfile), { recursive: true });

await build({
  entryPoints: ['nodevision-cli.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile,
  logLevel: 'info',
});
