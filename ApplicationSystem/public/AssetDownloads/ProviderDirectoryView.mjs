// Nodevision/ApplicationSystem/public/AssetDownloads/ProviderDirectoryView.mjs
// Shows implemented and planned sources without offering inactive integrations as working search providers.
import { element } from './DownloadView.mjs';
export function renderProviderDirectory(root, entries) {
  root.querySelector('[data-provider-directory]')?.remove();
  if (!entries.length) return;
  const details = element('details', '', root); details.dataset.providerDirectory = 'true';
  element('summary', 'Sources and integration status', details);
  element('p', 'Available sources appear in Source above. Planned sources are not connected; their listed asset types describe the proposal, not enabled imports.', details);
  const table = element('table', '', details); table.style.cssText = 'width:100%;font-size:12px;text-align:left';
  const header = element('tr', '', element('thead', '', table));
  for (const label of ['Source', 'Status', 'Enabled features / next step']) element('th', label, header);
  const body = element('tbody', '', table);
  for (const entry of entries) {
    const row = element('tr', '', body); const name = element('td', '', row);
    const link = element('a', entry.name, name); link.href = entry.website; link.target = '_blank'; link.rel = 'noopener noreferrer';
    element('td', entry.status === 'available' ? 'Available' : entry.status === 'needs-configuration' ? 'Needs configuration' : 'Planned', row);
    const description = element('td', '', row);
    element('div', Object.entries(entry.support || {}).filter(([, enabled]) => enabled).map(([feature]) => feature).join(', ') || 'Not integrated', description);
    element('div', entry.integrationNote, description);
    element('small', `Proposed types: ${(entry.assetTypes || []).join(', ')}. ${entry.authentication}`, description);
  }
}
