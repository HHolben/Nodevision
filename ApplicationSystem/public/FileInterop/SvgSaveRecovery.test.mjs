// Nodevision/ApplicationSystem/public/FileInterop/SvgSaveRecovery.test.mjs
// These tests verify HTTP size classification and exact recovery content independently from the browser dialog.
import assert from 'node:assert/strict';
import { saveSvgRequest } from './SvgSaveRecovery.mjs';
import { requestSizeError } from '../../server/middleware/requestSizeError.mjs';
const payload = { path: 'drawing.svg', content: '<svg><text>unsaved Ω</text></svg>' };
let recovery;
assert.equal(await saveSvgRequest(payload, { request: async () => ({ ok: true }), recover: () => assert.fail() }), true);
for (const json of [async () => ({ limitBytes: 52428800 }), async () => { throw Error('HTML'); }]) {
  assert.equal(await saveSvgRequest(payload, { request: async () => ({ status: 413, json }), recover: data => { recovery = data; } }), false);
  assert.equal(recovery.content, payload.content);
}
await assert.rejects(saveSvgRequest(payload, { request: async () => ({ status: 500, json: async () => ({ error: 'disk failure' }) }) }), /disk failure/);
let response;
requestSizeError({ type: 'entity.too.large', limit: 100 }, {}, { status(code) { assert.equal(code, 413); return this; }, json(value) { response = value; } }, () => assert.fail());
assert.equal(response.limitBytes, 100);
assert.equal(response.code, 'REQUEST_TOO_LARGE');
let forwarded; const other = Error('other'); requestSizeError(other, {}, {}, value => { forwarded = value; }); assert.equal(forwarded, other);
