// Nodevision/ApplicationSystem/public/PanelInstances/Common/HtmlProperties/CssSourceIndex.mjs
// This module indexes a deliberately bounded CSS grammar without reprinting source, retaining declaration ranges and grouping ancestry while rejecting syntax whose boundaries it cannot safely establish.

function tokens(source) {
  const result = [];
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unclosed CSS comment');
      i = end + 1;
    } else if (c === '"' || c === "'") {
      const quote = c; let closed = false;
      while (++i < source.length) {
        if (source[i] === '\\') i++;
        else if (source[i] === quote) { closed = true; break; }
      }
      if (!closed) throw new Error('Unclosed CSS string');
    } else if (c === '\\') i++;
    else if ('{}:;()[]'.includes(c)) result.push({ c, at: i });
  }
  const stack = [], pairs = { ')': '(', ']': '[', '}': '{' };
  for (const token of result) {
    if ('([{'.includes(token.c)) stack.push(token.c);
    else if (pairs[token.c] && stack.pop() !== pairs[token.c]) throw new Error('Mismatched CSS delimiters');
  }
  if (stack.length) throw new Error('Unclosed CSS delimiters');
  return result;
}
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').trim();
function declarations(source, start, end) {
  const entries = []; let segment = start, colon = null, depth = 0;
  const list = tokens(source.slice(start, end)).map(t => ({ ...t, at: t.at + start }));
  list.push({ c: ';', at: end });
  for (const t of list) {
    if ('(['.includes(t.c)) depth++;
    if (')]'.includes(t.c)) depth--;
    if (depth < 0 || '{}'.includes(t.c)) throw new Error('Nested declarations are read-only');
    if (depth) continue;
    if (t.c === ':' && colon === null) colon = t.at;
    if (t.c !== ';') continue;
    if (colon !== null) {
      const name = withoutComments(source.slice(segment, colon)).toLowerCase();
      if (!/^[-a-z]+$/.test(name)) throw new Error('Unsupported declaration name');
      let a = colon + 1, b = t.at;
      while (/\s/.test(source[a] || '') && a < b) a++;
      while (/\s/.test(source[b - 1] || '') && b > a) b--;
      const raw = source.slice(a, b), important = /\s*!\s*important\s*$/i.exec(raw);
      const valueEnd = important ? a + important.index : b;
      entries.push({ name, value: source.slice(a, valueEnd), priority: important ? 'important' : '', start: a, end: valueEnd,
        reason: raw.includes('/*') || raw.includes('\\') ? 'Comments or escapes within this value are read-only' : '' });
    } else if (withoutComments(source.slice(segment, t.at))) throw new Error('Malformed declaration');
    segment = t.at + 1; colon = null;
  }
  if (depth) throw new Error('Unbalanced CSS value');
  return entries;
}
export function indexCssSource(source) {
  const rules = [], unsupported = []; let order = 0;
  try {
    const list = tokens(source);
    function scan(start, end, ancestry = []) {
      let begin = start, depth = 0;
      for (let i = 0; i < list.length; i++) {
        const t = list[i]; if (t.at < start || t.at >= end) continue;
        if ('(['.includes(t.c)) depth++;
        if (')]'.includes(t.c)) depth--;
        if (depth < 0) throw new Error('Unbalanced CSS prelude');
        if (depth) continue;
        if (t.c === ';') { unsupported.push(withoutComments(source.slice(begin, t.at + 1))); begin = t.at + 1; }
        if (t.c !== '{') continue;
        let level = 1, j = i + 1;
        for (; j < list.length && list[j].at < end; j++) {
          if (list[j].c === '{') level++;
          if (list[j].c === '}' && --level === 0) break;
        }
        if (level) throw new Error('Unclosed CSS rule');
        const close = list[j].at, selector = withoutComments(source.slice(begin, t.at));
        if (/^@(media|supports|layer)\b/i.test(selector)) scan(t.at + 1, close, [...ancestry, selector]);
        else if (selector.startsWith('@')) unsupported.push(selector);
        else {
          const rule = { id: `${t.at}:${close}`, selector, order: order++, ancestry, declarations: [], reason: '' };
          try { rule.declarations = declarations(source, t.at + 1, close); } catch (error) { rule.reason = error.message; }
          if (!selector || /[\\&]/.test(selector)) rule.reason = 'Escaped or nested selectors are read-only';
          rules.push(rule);
        }
        begin = close + 1; i = j;
      }
      if (depth || withoutComments(source.slice(begin, end))) throw new Error('Unsupported or trailing CSS syntax');
    }
    scan(0, source.length);
    return { source, rules, unsupported, error: '' };
  } catch (error) { return { source, rules: [], unsupported, error: error.message }; }
}
export function cssDeclarationTarget(index, ruleId, property) {
  const rule = index.rules.find(candidate => candidate.id === ruleId);
  if (!rule) throw new Error('CSS rule identity is stale');
  const matches = rule.declarations.filter(entry => entry.name === property);
  const reason = index.error || rule.reason || (rule.ancestry.length ? 'Conditional rules are read-only in this prototype' : '') ||
    (matches.length !== 1 ? 'Choose a rule with exactly one existing declaration of this property' : matches[0].reason);
  return { rule, declaration: matches[0] || null, reason };
}
export function patchCssDeclaration(index, ruleId, property, value, currentSource = index.source) {
  if (currentSource !== index.source) throw new Error('CSS source revision changed');
  const target = cssDeclarationTarget(index, ruleId, property);
  if (target.reason) throw new Error(target.reason);
  if (!value.trim() || /[;{}!\\]|\/\*/.test(value)) throw new Error('Unsupported CSS value');
  const { start, end } = target.declaration;
  return currentSource.slice(0, start) + value.trim() + currentSource.slice(end);
}
