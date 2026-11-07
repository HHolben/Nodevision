// Nodevision/ApplicationSystem/server/routes/worldJson.test.mjs
// These regressions protect encoded data and quoted comment markers while retaining legacy world comments and rejecting malformed JSON instead of repairing user data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorldJson } from './worldJson.mjs';

test('valid JSON preserves large Base64 strings and literal comment markers', () => {
  const expected = { samples: 'AAAA//AA'.repeat(90000), url: 'https://example.test/a//b', literal: '/* preserve */', escaped: '\\"//keep' };
  assert.deepEqual(parseWorldJson(JSON.stringify(expected, null, 2)), expected);
});

test('legacy comments are recognized only outside escaped strings', () => {
  const expected = { samples: 'AAA//AAA', text: '\\"/*keep*/', slash: '\\' };
  const source = '// leading\r\n' + JSON.stringify(expected).replace('{', '{/*block\ncomment*/') + '\n// trailing';
  assert.deepEqual(parseWorldJson(source), expected);
});

test('invalid strings, unfinished comments and split numeric tokens remain invalid', () => {
  for (const source of ['{"samples":"AAA\nAAA"}', '{"x":1/*comment*/2}', '{"x":1}/*unfinished', '{"x":"unfinished}']) {
    assert.throws(() => parseWorldJson(source), SyntaxError);
  }
});
