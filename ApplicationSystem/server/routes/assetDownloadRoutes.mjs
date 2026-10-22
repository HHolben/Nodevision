// Nodevision/ApplicationSystem/server/routes/assetDownloadRoutes.mjs
// Exposes authenticated discovery and cancellable download streams for registered asset providers.
import { rejectIfLanWriteDenied } from '../../routes/api/lanCooperationRoutes.js';
import { categories, getAssetProvider, listAssetProviders, listProviderDirectory } from '../../AssetDownloads/ProviderRegistry.mjs';
import { listDownloadDestinations } from '../../AssetDownloads/DownloadDestinations.mjs';
import { recordAssetAttribution, readAssetAttributions } from '../../AssetDownloads/AssetAttributionStore.mjs';
import { downloadAsset } from '../../AssetDownloads/DownloadAsset.mjs';
export function registerAssetDownloadRoutes(app, ctx) {
  const route = (method, endpoint, handler) => app[method](`/api/asset-downloads${endpoint}`, async (req, res) => {
    if (!req.identity) return res.status(401).json({ error: 'Authentication required' });
    if (method === 'post' && req.body?.authorized !== true) return res.status(400).json({ error: 'Explicit authorization required' });
    if (method === 'post' && await rejectIfLanWriteDenied(req, res, ctx)) return;
    const controller = new AbortController();
    const closed = () => controller.abort();
    res.on('close', closed);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(method === 'post' ? 600000 : 120000)]);
    try { await handler(req, res, signal); }
    catch (error) {
      if (!res.destroyed) {
        if (res.headersSent) res.end(`${JSON.stringify({ error: error.message })}\n`);
        else res.status(400).json({ error: error.message });
      }
    } finally { res.off('close', closed); }
  });
  route('get', '/config', async (req, res) => res.json({ providers: listAssetProviders(), sourceDirectory: listProviderDirectory(), categories,
    destinations: (await listDownloadDestinations(ctx, req.query?.document || '')).map(({ source, ...item }) => item) }));
  route('get', '/search', async (req, res, signal) => res.json(await getAssetProvider(req.query.provider, 'search').search(req.query, signal)));
  route('get', '/inspect', async (req, res, signal) => res.json(await getAssetProvider(req.query.provider, 'inspect').inspect(req.query.asset, signal)));
  route('get', '/attributions', async (req, res) => res.json(await readAssetAttributions(ctx, req.query.document)));
  route('post', '/attributions', async (req, res) => res.json(await recordAssetAttribution(ctx, req.body)));
  const active = new Set();
  route('post', '/download', async (req, res, signal) => {
    const identity = req.identity.userId || req.identity.username || JSON.stringify(req.identity);
    if (active.has(identity)) throw new Error('A download is already running. Cancel it or wait for completion.');
    if (req.body?.authorized !== true) throw new Error('Explicit download authorization required');
    active.add(identity);
    try {
      res.setHeader('Content-Type', 'application/x-ndjson'); res.setHeader('Cache-Control', 'no-store');
      res.flushHeaders();
      const result = await downloadAsset(ctx, req.body, { signal, progress: value => { if (!res.destroyed) res.write(`${JSON.stringify({ progress: value })}\n`); } });
      res.end(`${JSON.stringify({ result })}\n`);
    } finally { active.delete(identity); }
  });
}
