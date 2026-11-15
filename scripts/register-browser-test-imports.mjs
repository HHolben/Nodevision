// Nodevision/scripts/register-browser-test-imports.mjs
// Node tests import browser adapters whose root URLs are served from public in the application. Resolve only public namespaces, and only for application importers; leave filesystem paths and production modules unchanged.
import {registerHooks} from 'node:module';
import {readdirSync} from 'node:fs';
const publicRoot=new URL('../ApplicationSystem/public/',import.meta.url);
const namespaces=new Set(readdirSync(publicRoot));
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier.startsWith('/')&&namespaces.has(specifier.split('/')[1])&&context.parentURL?.startsWith(publicRoot.href)){
    const target=new URL('.'+specifier,publicRoot);
    if(target.href.startsWith(publicRoot.href))return nextResolve(target.href,context);
  }
  return nextResolve(specifier,context);
}});
