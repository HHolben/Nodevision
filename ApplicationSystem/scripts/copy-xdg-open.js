// Nodevision/ApplicationSystem/scripts/copy-xdg-open.js
// This file defines the copy xdg open module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
import path from 'node:path';
import { copyFileSync, chmodSync, existsSync } from 'node:fs';

const sourcePath = path.resolve('node_modules', 'open', 'xdg-open');
const destinationPath = path.resolve('xdg-open');

if (!existsSync(sourcePath)) {
  console.error('Cannot find open/xdg-open in node_modules. Did you run npm install?');
  process.exitCode = 1;
} else {
  try {
    copyFileSync(sourcePath, destinationPath);
    try {
      chmodSync(destinationPath, 0o755);
    } catch {
      // chmod is not required on all platforms
    }
    console.log('Copied xdg-open next to the portable binaries.');
  } catch (err) {
    console.error('Failed to copy xdg-open:', err);
    process.exitCode = 1;
  }
}
