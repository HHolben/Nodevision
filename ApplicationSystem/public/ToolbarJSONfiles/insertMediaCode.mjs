// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaCode.mjs
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
  if (php) return false;
  const stack = []; const voids = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'base', 'embed', 'param', 'track', 'wbr']);
  for (let index = 0; index < text.length; index++) {
    if (text[index] !== '<') continue;
    if (text.slice(index, index + 4) === '<!--') {
      const end = text.indexOf('-->', index + 4); if (end < 0) return false; index = end + 2; continue;
    }
    let end = index + 1, quoted = '';
    for (; end < text.length; end++) {
      if (quoted) { if (text[end] === quoted) quoted = ''; }
      else if (text[end] === '"' || text[end] === "'") quoted = text[end];
      else if (text[end] === '>') break;
    }
    if (end === text.length) return false;
    const token = text.slice(index + 1, end).trim(); index = end;
    if (token.startsWith('!')) continue;
    const match = token.match(/^(\/?)([a-z][\w:-]*)/i); if (!match) return false;
    const name = match[2].toLowerCase();
    if (match[1]) { if (stack.at(-1) !== name) return false; stack.pop(); }
    else if (!token.endsWith('/') && !voids.has(name)) stack.push(name);
  }
  if (stack.some(name => ['script', 'style', 'textarea', 'title', 'head', 'metadata', 'desc', 'text', 'tspan'].includes(name))) return false;
  if (['table', 'thead', 'tbody', 'tfoot', 'tr', 'ul', 'ol', 'select', 'option', 'html'].includes(stack.at(-1))) return false;
  if (extension === 'svg') return stack.includes('svg');
  return ['html', 'htm', 'php'].includes(extension) && !/<\/(?:html|body)\s*>\s*$/i.test(text);

}
export function insertAssetCode(context, text) {
  const editor = context.api;
  editor.pushUndoStop();
  const success = editor.executeEdits('nodevision.asset-insertion', [{ range: context.selection, text, forceMoveMarkers: true }]);
  editor.pushUndoStop();
  if (success === false) throw new Error('Code editor rejected insertion');
  editor.focus(); return { inserted: true };
}
