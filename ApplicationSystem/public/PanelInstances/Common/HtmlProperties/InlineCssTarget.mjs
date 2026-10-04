// Nodevision/ApplicationSystem/public/PanelInstances/Common/HtmlProperties/InlineCssTarget.mjs
// This module patches one inline declaration without asking CSSOM to reserialize unrelated declarations, comments, duplicate fallbacks or authored whitespace.
import { indexCssSource, patchCssDeclaration } from './CssSourceIndex.mjs';
export function inlineCssTarget(style, property) {
  const prefix = 'x {', source = prefix + (style || '') + '}';
  const index = indexCssSource(source), rule = index.rules[0];
  const declarations = rule?.declarations.filter(entry => entry.name === property) || [];
  const reason = index.error || rule?.reason || (declarations.length > 1 ? 'Duplicate inline declarations are read-only' : declarations[0]?.reason) || '';
  return { reason, value: declarations[0]?.value || '',
    patch(value) {
      if (reason) throw new Error(reason);
      if (declarations.length) return patchCssDeclaration(index, rule.id, property, value).slice(prefix.length, -1);
      if (/[;{}!\\]|\/\*/.test(value)) throw new Error('Unsupported CSS value');
      const original = style || '';
      return original + (original.trim() ? (original.trimEnd().endsWith(';') ? ' ' : '; ') : '') + property + ': ' + value.trim() + ';';
    },
  };
}
