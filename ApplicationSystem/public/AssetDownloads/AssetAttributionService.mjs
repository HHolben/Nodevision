// Nodevision/ApplicationSystem/public/AssetDownloads/AssetAttributionService.mjs
// Separates required credit from optional provenance and exposes project credits without claiming license compliance.
export function assetCredit(asset) {
  return [asset.requiredAttribution || `${asset.name || 'Untitled asset'}${asset.creator ? ` by ${asset.creator}` : ''} — ${asset.license || 'unknown license'}`,
    asset.source, asset.licenseUrl, asset.modificationStatus && asset.modificationStatus !== 'original' ? `Modifications: ${asset.modificationStatus}` : ''].filter(Boolean).join(' · ');
}
export function assetLicenseState(asset) {
  if (asset.licenseVerified !== true || !asset.license || asset.license === 'unknown') return 'unknown';
  if (asset.attributionRequired === true) return 'required';
  if (asset.attributionRecommended === true) return 'recommended';
  return 'optional';
}
export async function recordAttribution(download, document, referenced) {
  const response = await fetch('/api/asset-downloads/attributions', { method: 'POST', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorized: true, download, document, referenced }) });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || 'Attribution could not be recorded');
  return result;
}
export function exportAssetCredits(text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'AssetCredits.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
