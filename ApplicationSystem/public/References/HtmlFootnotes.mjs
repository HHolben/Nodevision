// Nodevision/ApplicationSystem/public/References/HtmlFootnotes.mjs
// This module attaches the reference model to one HTML editor, reconciles only meaningful journal changes, and owns the navigation and clipboard lifecycle without maintaining another history stack.
import { reconcileFootnotes } from './ReconcileFootnotes.mjs';
import { referenceChanges, preserveReferenceSelection } from './ReferenceChanges.mjs';
import { createFootnoteCommands } from './FootnoteCommands.mjs';
import { createFootnoteClipboard } from './FootnoteClipboard.mjs';
export function installHtmlFootnotes(root, {getRange, report = () => {}, markDirty = () => {}}) {
  root.__nvReferences?.dispose();
  const history = root.__nvProgrammaticHistory;
  let disposed = false, scans = 0, lastDiagnostics = '';
  const run = (label, action) => {
    if (disposed || !root.isConnected) throw new Error('The footnote editor is no longer open.');
    if (root.__nvHtmlTransactions) return root.__nvHtmlTransactions.run(label, action);
    const result = history.captureCommand(action); markDirty(); return result;
  };
  function reconcile() {
    scans++;
    const result = preserveReferenceSelection(root, () => reconcileFootnotes(root));
    const message = result.diagnostics.join(' ');
    if (message && message !== lastDiagnostics) report(message);
    lastDiagnostics = message;
    return result;
  }
  const release = history.subscribeBeforeCommit(patches => { if (referenceChanges(patches)) reconcile(); });
  const commands = createFootnoteCommands(root, {getRange, run, report});
  const runNative = (_label, action) => {
    root.__nvHtmlTransactions?.assertSettled();
    const result = history.captureCommand(action); markDirty(); return result;
  };
  const clipboard = createFootnoteClipboard(root, {getRange, run, runNative, report});
  const api = {
    ...commands,
    reconcile,
    validate() {
      let result;
      run('Validate footnotes', () => { result = reconcile(); });
      report(result.diagnostics.join(' ') || `${result.count} footnote(s): numbering and navigation are valid.`);
      return result;
    },
    get scans() { return scans; },
    dispose() { if (disposed) return; disposed = true; release(); commands.dispose(); clipboard.dispose(); if (root.__nvReferences === api) delete root.__nvReferences; }
  };
  root.__nvReferences = api;
  // Initial normalization precedes the new editing baseline; the persisted HTML remains authoritative.
  reconcile(); history.clear();
  return api;
}
