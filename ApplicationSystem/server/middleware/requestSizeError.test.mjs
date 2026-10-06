// Nodevision/ApplicationSystem/server/middleware/requestSizeError.test.mjs
// This regression verifies the recovery response produced by a real Express body parser when a JSON request crosses its configured limit, and checks that the server can accept a subsequent normal save.
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { requestSizeError } from './requestSizeError.mjs';
const app = express(); let writes = 0;
app.use(express.json({ limit: 128 })); app.use(requestSizeError);
app.post('/api/save', (req,res) => { writes++; res.json({ success: true }); });
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  const save = content => fetch(`http://127.0.0.1:${server.address().port}/api/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
  const rejected = await save('x'.repeat(512));
  assert.equal(rejected.status, 413);
  assert.deepEqual(await rejected.json(), { code: 'REQUEST_TOO_LARGE', error: 'The document exceeds the save request size limit.', limitBytes: 128 });
  assert.equal(writes, 0);
  assert.equal((await save('<svg/>')).status, 200); assert.equal(writes, 1);
} finally { await new Promise(resolve => server.close(resolve)); }
