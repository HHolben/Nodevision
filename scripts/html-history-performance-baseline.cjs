// Reconstruct pre-optimization behavior at the same feature boundaries after module extraction.
const fs = require('node:fs');
const path = require('node:path');
module.exports = function baseline(repo) {
  const components = path.join(repo, 'ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents');
  const parts = path.join(components, 'HTMLeditorImplParts');
  const sources = {
    'HtmlHistoryRestore.mjs': 'export function createHtmlHistoryRestore(restorePresentation) { return restorePresentation; }',
    'HtmlToolbarPublishing.mjs': 'export function createHtmlToolbarPublisher(publish) { return publish; }',
    'HtmlLayerInvalidation.mjs': `import { htmlLayerMutationChangesStructure } from './htmlLayersContext.mjs';
      export function createHtmlLayerInvalidation() {
        return { read: collect => collect(), mutations: records => Array.from(records || []).some(htmlLayerMutationChangesStructure), clear() {} };
      }`,
  };
  let attention = fs.readFileSync(path.join(components, 'HtmlAttentionReporting.mjs'), 'utf8');
  attention = attention.replace(/  const report = event => \{[\s\S]*?\n  \};/, '  const report = event => setSelectionContext(describeHtmlAttentionSelection(event.target));')
    .replace(/^.*(?:add|remove)EventListener\("input", report\);\n/gm, '');
  sources['HtmlAttentionReporting.mjs'] = attention;
  const restoreFile = fs.readdirSync(parts).find(name => fs.readFileSync(path.join(parts, name), 'utf8').includes('Failed to rehydrate images after undo/redo:'));
  if (!restoreFile) throw new Error('Baseline adapter cannot find the HTML presentation restoration feature');
  let restore = fs.readFileSync(path.join(parts, restoreFile), 'utf8');
  const caret = '    rememberCurrentSelectionRange(owner.wysiwyg);';
  if (!restore.includes(caret)) throw new Error('Baseline adapter needs updating for the restored caret owner');
  restore = restore.replace(caret, '    if (direction !== "cancel") markHtmlEditorDirty(owner.wysiwyg, owner.editorFilePath);\n' + caret);
  sources[restoreFile] = restore;
  return sources;
};
