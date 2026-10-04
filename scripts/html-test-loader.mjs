// Resolve browser-root imports to local application modules for focused Node tests.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('/') && !specifier.startsWith(process.cwd())) return next(pathToFileURL(path.join(process.cwd(), 'ApplicationSystem/public', specifier)).href, context);
  return next(specifier, context);
}
