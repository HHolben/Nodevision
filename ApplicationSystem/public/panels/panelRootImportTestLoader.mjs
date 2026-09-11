// Nodevision/ApplicationSystem/public/panels/panelRootImportTestLoader.mjs
// Test-only loader that resolves browser-root public imports for panel tab Node regressions.

import { pathToFileURL } from "node:url";
import path from "node:path";

const publicRoot = path.resolve(process.cwd(), "ApplicationSystem/public");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("/") && specifier.endsWith(".mjs")) {
    return {
      url: pathToFileURL(path.join(publicRoot, specifier.slice(1))).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
