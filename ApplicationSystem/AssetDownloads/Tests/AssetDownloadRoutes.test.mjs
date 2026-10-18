// Nodevision/ApplicationSystem/AssetDownloads/Tests/AssetDownloadRoutes.test.mjs
// Checks route authentication, source validation, explicit authorization and cancellation propagation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { registerAssetDownloadRoutes } from '../../server/routes/assetDownloadRoutes.mjs';
import { assetProviders } from '../ProviderRegistry.mjs';
function fixture() {
  const routes = new Map();
  const app = Object.fromEntries(['get', 'post'].map(method => [method, (url, handler) => routes.set(`${method} ${url}`, handler)]));
  registerAssetDownloadRoutes(app, {});
  const response = new EventEmitter(); response.statusCode = 200; response.destroyed = false;
  response.status = code => { response.statusCode = code; return response; };
  response.json = data => { response.data = data; return response; };
  response.setHeader = () => {}; response.flushHeaders = () => { response.headersSent = true; };
  response.end = data => { response.data = data; }; response.write = () => {};
  const call = (method, endpoint, request = {}) => routes.get(`${method} /api/asset-downloads/${endpoint}`)(request, response);
  return { call, response };
}
test('all discovery and download endpoints require authentication', async () => {
  for (const [method, endpoint] of [['get', 'config'], ['get', 'search'], ['get', 'inspect'], ['post', 'download']]) {
    const { call, response } = fixture(); await call(method, endpoint);
    assert.equal(response.statusCode, 401);
  }
});
test('unknown provider cannot supply arbitrary download URLs', async () => {
  const { call, response } = fixture();
  await call('get', 'inspect', { identity: {}, query: { provider: 'https://evil.invalid', asset: 'x' } });
  assert.equal(response.statusCode, 400); assert.match(response.data.error, /Unsupported/);
});
test('download authorization is required before streaming starts', async () => {
  const { call, response } = fixture(); await call('post', 'download', { identity: {}, body: { authorized: false } });
  assert.equal(response.statusCode, 400); assert(!response.headersSent);
});
test('closing a discovery response aborts the provider request', async t => {
  const { call, response } = fixture(); let observed;
  assetProviders.set('test-route', { search: async (_query, signal) => {
    observed = signal;
    await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  t.after(() => assetProviders.delete('test-route'));
  const pending = call('get', 'search', { identity: {}, query: { provider: 'test-route' } });
  response.destroyed = true; response.emit('close'); await pending;
  assert(observed.aborted); assert.equal(response.listenerCount('close'), 0);
});
test('provider failures produce safe structured errors', async t => {
  assetProviders.set('test-route', { inspect: async () => { throw Error('Offline'); } });
  t.after(() => assetProviders.delete('test-route'));
  const { call, response } = fixture(); await call('get', 'inspect', { identity: {}, query: { provider: 'test-route' } });
  assert.equal(response.statusCode, 400); assert.equal(response.data.error, 'Offline');
});
