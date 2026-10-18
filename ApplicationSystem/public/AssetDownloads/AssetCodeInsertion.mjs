// Nodevision/ApplicationSystem/public/AssetDownloads/AssetCodeInsertion.mjs
// Conservatively identifies markup text locations and performs one undoable Monaco insertion.
export function markupInsertionAllowed(source, offset, extension) {
  const prefix = source.slice(0, offset);
  let text = '', php = false, quote = '', comment = '';
  for (let i = 0; i < prefix.length; i++) {
    const pair = prefix.slice(i, i + 2);
    if (!php && pair === '<?') { php = true; i++; continue; }
    if (php) {
      if (comment === 'line') { if (prefix[i] === '\n') comment = ''; continue; }
      if (comment === 'block') { if (pair === '*/') { comment = ''; i++; } continue; }
      if (quote) { if (prefix[i] === '\\') i++; else if (prefix[i] === quote) quote = ''; continue; }
      if (pair === '?>') { php = false; i++; continue; }
      if (pair === '//' || prefix[i] === '#') { comment = 'line'; continue; }
      if (pair === '/*') { comment = 'block'; i++; continue; }
      if (prefix[i] === '"' || prefix[i] === "'") quote = prefix[i];
      if (prefix.slice(i, i + 3) === '<<<') return false;
      continue;
    }
    text += prefix[i];
  }
  if (php || text.lastIndexOf('<!--') > text.lastIndexOf('-->')) return false;
  if (text.lastIndexOf('<') > text.lastIndexOf('>')) return false;
  if (/<(script|style|textarea|title)\b[^>]*>(?:(?!<\/\1\s*>)[\s\S])*$/i.test(text)) return false;
  if (extension === 'svg') return /<svg\b/i.test(text) && !/<\/svg\s*>\s*$/i.test(text) && !/<(?:text|tspan|metadata|desc|title)\b[^>]*>[^<]*$/i.test(text);
  return ['html', 'htm', 'php'].includes(extension) && !/<head\b[^>]*>(?:(?!<\/head\s*>)[\s\S])*$/i.test(text);
}
export function insertAssetCode(context, text) {
  const editor = context.api;
  editor.pushUndoStop();
  const success = editor.executeEdits('nodevision.asset-insertion', [{ range: context.selection, text, forceMoveMarkers: true }]);
  editor.pushUndoStop();
  if (success === false) throw new Error('Code editor rejected insertion');
  editor.focus(); return { inserted: true };
}
