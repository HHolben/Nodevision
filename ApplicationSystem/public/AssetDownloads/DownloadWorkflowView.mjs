// Nodevision/ApplicationSystem/public/AssetDownloads/DownloadWorkflowView.mjs
// Presents target selection, insertion choices and an explicit preview before running an asset workflow.
import { element, fillOptions } from './DownloadView.mjs';
export function addDownloadWorkflowView(view) {
  const section = element('section'); view.download.before(section);
  const field = (label, tag) => { const parent = element('label', label, section); parent.style.display = 'block'; const input = element(tag, '', parent); input.setAttribute('aria-label', label); return input; };
  const target = field('Originating editor', 'select');
  const capture = element('button', 'Capture selected editor and insertion location', section);
  const action = field('Action', 'select');
  fillOptions(action, [{ id: 'only', name: 'Download Only' }, { id: 'insert', name: 'Download and Insert' }, { id: 'attribute', name: 'Download, Insert, and Attribute (recommended)' }]);
  const strategy = field('Insertion strategy', 'select'); fillOptions(strategy, [{ id: 'markup', name: 'Editor element / image placement' }, { id: 'path', name: 'Path only in code (review first)' }]);
  const creditPlacement = field('Attribution placement', 'select'); fillOptions(creditPlacement, [{ id: 'visible', name: 'Visible credit plus project manifest' }, { id: 'project', name: 'Project credits manifest' }]);
  const consent = field('I reviewed the license and accept responsibility for permitted use and any credits provided elsewhere.', 'input'); consent.type = 'checkbox';
  const confirmPath = field('I reviewed the source and confirm this exact path-only insertion, including escaping.', 'input'); confirmPath.type = 'checkbox';
  const preview = element('pre', '', section); preview.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
  const copy = element('button', 'Copy proposed snippet', section);
  const retry = element('button', 'Retry insertion / attribution (use saved asset)', section); retry.hidden = true;
  const commit = element('button', 'Commit raster placement', section); commit.hidden = true;
  const discard = element('button', 'Cancel raster placement', section); discard.hidden = true;
  const credits = element('details', '', section); element('summary', 'Project credits', credits);
  const creditsText = element('pre', '', credits); creditsText.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
  const refreshCredits = element('button', 'Load project credits', credits);
  const exportCredits = element('button', 'Export credits text', credits);
  return { target, capture, action, strategy, creditPlacement, consent, confirmPath, preview, copy, retry, commit, discard, creditsText, refreshCredits, exportCredits };
}
