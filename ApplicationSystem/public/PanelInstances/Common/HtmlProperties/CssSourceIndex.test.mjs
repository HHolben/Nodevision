// Nodevision/ApplicationSystem/public/PanelInstances/Common/HtmlProperties/CssSourceIndex.test.mjs
// This module verifies exact CSS patch boundaries, ambiguity refusal and stale source identities for the bounded Properties source index.
import assert from 'node:assert/strict';
import test from 'node:test';
import { indexCssSource, cssDeclarationTarget, patchCssDeclaration } from './CssSourceIndex.mjs';
import { inlineCssTarget } from './InlineCssTarget.mjs';
test('only the selected declaration value changes, retaining unrelated source exactly', () => {
  const css = '/* before */\n.card, #id {\n color: var(--color, red)  ! important; /* after */\n margin-left: calc(2rem + 3px); padding: 1px 2px; content: "};:";\n}\n.card { color: blue; }';
  const index = indexCssSource(css); assert.equal(index.error, '');
  assert.equal(index.rules.length, 2);
  const output = patchCssDeclaration(index, index.rules[0].id, 'color', '#3458c0');
  assert.equal(output, css.replace('var(--color, red)', '#3458c0'));
  assert.equal(patchCssDeclaration(index, index.rules[1].id, 'color', 'green'), css.replace('color: blue', 'color: green'));
  assert.equal(patchCssDeclaration(index, index.rules[0].id, 'margin-left', '3em'), css.replace('calc(2rem + 3px)', '3em'));
});
test('inline patch preserves comments, unrelated duplicates and expression syntax', () => {
  const style = '/* author */ color: red !important; display:block; display:flex; margin-left:calc(1em + 2px)';
  assert.equal(inlineCssTarget(style, 'color').patch('blue'), style.replace('red', 'blue'));
  assert.equal(inlineCssTarget(style, 'background-color').patch('pink'), style + '; background-color: pink;');
  assert.match(inlineCssTarget('color:red;color:blue', 'color').reason, /Duplicate/);
});
test('duplicates and missing longhands refuse without rewriting source', () => {
  const css = '.card { color: red; color: blue !important; margin: 1rem; }', index = indexCssSource(css);
  for (const property of ['color', 'margin-left']) assert.throws(() => patchCssDeclaration(index, index.rules[0].id, property, '1px'), /exactly one/);
  assert.equal(index.source, css);
});
test('conditional ancestry is retained and edits inside it are read-only', () => {
  const index = indexCssSource('@media (min-width: 1px) { @supports (display: grid) { @layer theme { .card { color: red; } } } }');
  assert.equal(index.error, ''); assert.equal(index.rules[0].ancestry.length, 3);
  assert.match(cssDeclarationTarget(index, index.rules[0].id, 'color').reason, /Conditional/);
});
test('unsupported syntax and stale revisions fail closed', () => {
  for (const css of ['.a { color: red;', '.a {color: "x}', '.a {color: calc(2px;}', '.a {color: fn([)];}', '/* missing']) {
    const result = indexCssSource(css); assert.ok(result.error || result.rules.some(rule => rule.reason));
  }
  const index = indexCssSource('.a { color: red; }');
  assert.throws(() => patchCssDeclaration(index, index.rules[0].id, 'color', 'blue', '.a {color: green}'), /revision/);
  assert.throws(() => patchCssDeclaration(index, 'unknown', 'color', 'blue'), /identity/);
  for (const value of ['blue; display:none', 'blue!important', '/*x*/blue']) assert.throws(() => patchCssDeclaration(index, index.rules[0].id, 'color', value), /Unsupported/);
  const comments = indexCssSource('.a { color: red /* inside */; }');
  assert.match(cssDeclarationTarget(comments, comments.rules[0].id, 'color').reason, /Comments/);
  assert.ok(indexCssSource('@import "theme.css"; .a {color:red}').unsupported.length);
});
