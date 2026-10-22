// Nodevision/ApplicationSystem/AssetDownloads/ProviderNetwork.mjs
// Bounds provider HTTP requests and validates every redirect against explicit HTTPS hosts.
export const MAX_ASSET_BYTES = 128 * 1024 * 1024;
export function validateProviderUrl(value, hosts) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !hosts.includes(url.hostname)) throw new Error('Untrusted provider URL');
  return url.href;
}
export async function providerFetch(url, hosts, { signal, fetchImpl = fetch, method = 'GET' } = {}) {
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetchImpl(validateProviderUrl(url, hosts), {
      signal, method, redirect: 'manual', headers: { 'User-Agent': 'Nodevision-AssetDownloads/1.0' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      url = new URL(response.headers.get('location'), url).href;
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); const error = new Error(`Provider returned HTTP ${response.status}`); error.status = response.status; throw error; }
    return response;
  }
  throw new Error('Too many provider redirects');
}
export async function providerJson(url, signal, hosts = ['api.polyhaven.com']) {
  const response = await providerFetch(url, hosts, { signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(30000)]) });
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 16 * 1024 * 1024) throw new Error('Provider catalog is too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
