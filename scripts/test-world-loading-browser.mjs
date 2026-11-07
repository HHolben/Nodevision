// Nodevision/scripts/test-world-loading-browser.mjs
// Runs Chromium against production world-loading and file-saving endpoints in a temporary Notebook, tracing parser input and preserving the supplied source file.
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { registerWorldRoutes } from '../ApplicationSystem/server/routes/worldRoutes.mjs';
import createFileSaveRouter from '../ApplicationSystem/routes/api/fileSaveRoutes.js';
import { worldLoadingFixture } from './world-loading-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'nv-world-load-'));
const notebookDir = path.join(temp, 'Notebook'), userSettingsDir = path.join(temp, 'UserSettings');
await fs.mkdir(notebookDir); await fs.mkdir(userSettingsDir);
const html = process.argv[2] ? await fs.readFile(process.argv[2], 'utf8') : worldLoadingFixture();
await fs.writeFile(path.join(notebookDir, 'world.html'), html);
const raw = html.match(/<script\b[^>]*id="nodevision-metaworld"[^>]*>([\s\S]*?)<\/script>/i)[1];
const extracted = cheerio.load(html)('#nodevision-metaworld').html();
assert.equal(extracted, raw, 'HTML extraction is character-for-character identical');
const parse = JSON.parse, original = parse(raw), traces = [];
let currentScript = raw;
// Observe the production parser without substituting a definition or response.
JSON.parse = function (text, ...args) {
  if (typeof text === 'string' && text.includes('"samples"') && !text.startsWith('{"')) {
    traces.push({ length: text.length, identicalToOriginal: text === raw, identicalToSavedScript: text === currentScript });
  }
  return parse(text, ...args);
};
const app = express(); app.use(express.json({ limit: '32mb' }));
const ctx = { notebookDir, userSettingsDir, serverSettingsDir: path.join(temp, 'ServerSettings') };
app.use('/api/load-world', async (req, res, next) => {
  try {
    currentScript = cheerio.load(await fs.readFile(path.join(notebookDir, 'world.html'), 'utf8'))('#nodevision-metaworld').html();
    next();
  } catch (error) { next(error); }
});
registerWorldRoutes(app, ctx); app.use('/api', createFileSaveRouter(ctx));
app.get('/test/original', (req, res) => res.json(original));
app.get('/test/trace', (req, res) => res.json(traces));
app.get('/', (req, res) => res.type('html').send('<div id="editor"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/world-loading-browser.mjs"></script>'));
app.get('/panels/createToolbar.mjs', (req, res) => res.type('js').send('export function hideToolbarSubToolbar(){} export function showToolbarSubToolbar(){} export function updateToolbarState(p){Object.assign(window.NodevisionState ||= {},p);}'));
app.get('/panels/workspace.mjs', (req, res) => res.type('js').send('export function rebuildLayoutDividersForContainer(){} export function ensureSvgEditingSplit(){return {};} export async function loadPanelIntoCell(){}'));
app.use('/Notebook', express.static(notebookDir)); app.use('/scripts', express.static(path.join(root, 'scripts')));
app.use(express.static(path.join(root, 'ApplicationSystem/public')));
const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
try {
  const child = spawn(process.execPath, ['scripts/run-browser-regression.mjs', `http://127.0.0.1:${server.address().port}/`, 'chromium', '120000', '/tmp/nodevision-world-loading-results.json'], { cwd: root, stdio: 'inherit', env: { ...process.env, NODEVISION_TEST_WEBGL: '1' } });
  const code = await new Promise(resolve => child.on('exit', resolve));
  assert.equal(code, 0, 'Browser regression passes');
  assert.equal(traces[0]?.identicalToOriginal, true, 'First actual JSON.parse input is saved script verbatim');
  const saved = await fs.readFile(path.join(notebookDir, 'world.html'), 'utf8');
  const reopened = parse(cheerio.load(saved)('#nodevision-metaworld').html());
  const terrain = world => world.objects.find(o => o.type === 'procedural-voxel-world');
  assert.deepEqual(terrain(reopened).geographic, terrain(original).geographic);
  assert.deepEqual(reopened.objects, original.objects, 'Every complete object definition preserved');
  assert.equal(traces.length, 2, 'Initial load and reopen reach the real parser');
  assert.ok(traces.every(trace => trace.identicalToSavedScript), 'Both parser inputs equal their saved scripts');
  console.log('PASS: real parser input, production HTTP load/save/reopen, full geographic recipe and object IDs preserved', traces);
} finally {
  JSON.parse = parse; server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await fs.rm(temp, { recursive: true, force: true });
}
