// Nodevision/scripts/download-assets-browser.mjs
// Verifies real workspace docking, singleton lifecycle, text safety, cancellation and explicit download behavior.
import open from '/ToolbarCallbacks/file/downloadAssets.mjs';
import { ensureWorkspace, ensureTopRow, createCell } from '/panels/workspaceParts/workspaceCells.mjs';
let count = 0;
const check = (condition, message) => { if (!condition) throw Error(message); count++; };
const wait = async predicate => { for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw Error('Timed out'); };
try {
  const workspace = ensureWorkspace(); workspace.style.height = '800px'; const row = ensureTopRow(workspace);
  const editor = createCell(row); editor.dataset.id = 'GraphicalEditor'; editor.dataset.panelClass = 'EditorPanel';
  const content = document.createElement('div'); content.contentEditable = true; content.textContent = 'World editor text'; editor.append(content);
  const other = createCell(row); other.dataset.id = 'FileManager'; other.textContent = 'Existing file manager';
  window.activeCell = editor; window.activePanel = 'GraphicalEditor'; window.NodevisionState = { selectedFile: 'world.html' };
  const selection = getSelection(); selection.selectAllChildren(content); selection.collapse(content.firstChild, 3);
  const requests = []; const downloads = []; let pendingTransfer;
  const config = { providers: [{ id: 'polyhaven', name: 'Poly Haven', formats: ['png', 'glb'], licenses: ['CC0-1.0'] }],
    categories: [{ id: 'textures', name: 'Textures' }, { id: 'voxels', name: 'Voxel structures' }],
    destinations: [{ id: 'image:notebook', name: 'Notebook images', type: 'image', path: 'Resources/Images' }, { id: 'image:managed', name: 'Shared library', type: 'image', path: 'Resources/Images' }] };
  const asset = { id: 'rock', name: '<img src=x onerror=alert(1)>', provider: 'polyhaven', creator: 'Artist', description: 'A rock', source: 'https://polyhaven.com/a/rock', preview: 'data:image/png;base64,', license: 'CC0-1.0', attribution: 'No attribution required', formats: [{ id: '1k/png', label: '1k PNG', extension: 'png', size: 123 }] };
  window.fetch = (url, options = {}) => {
    if (String(url).endsWith('/download')) {
      downloads.push(JSON.parse(options.body));
      const stream = new ReadableStream({ start(controller) { pendingTransfer = { controller, signal: options.signal }; options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError'))); } });
      return Promise.resolve(new Response(stream));
    }
    return new Promise(resolve => requests.push({ url: String(url), signal: options.signal, resolve: data => resolve(new Response(JSON.stringify(data))) }));
  };
  const [panel, same] = await Promise.all([open(), open()]);
  check(panel === same && document.querySelectorAll('[data-instance-name="DownloadAssetsPanel"]').length === 1, 'Concurrent opens create one panel');
  check(panel.classList.contains('docked'), 'Normal docked panel');
  check(panel.closest('.panel-cell').getBoundingClientRect().left >= other.getBoundingClientRect().right - 1, 'Panel docks right of existing panels');
  check(editor.isConnected && other.isConnected && other.textContent.includes('Existing file manager'), 'Existing panels preserved');
  check(window.activeCell === editor && window.activePanel === 'GraphicalEditor' && window.NodevisionState.selectedFile === 'world.html', 'Opening preserves editor context');
  check(selection.anchorNode === content.firstChild && selection.anchorOffset === 3, 'Opening preserves text caret');
  check(requests.length === 1 && panel.textContent.includes('Loading asset sources'), 'Panel appears before API returns');
  requests[0].resolve(config); await wait(() => requests.length === 2);
  requests[1].resolve({ items: [asset], next: 12 }); await wait(() => panel.textContent.includes(asset.name));
  check(!panel.querySelector('[onerror]'), 'Provider title is inert text');
  check(downloads.length === 0, 'Search does not download or insert');
  const button = text => [...panel.querySelectorAll('button')].find(node => node.textContent === text);
  [...panel.querySelectorAll('button')].find(node => node.textContent.includes(asset.name)).click();
  requests.at(-1).resolve(asset); await wait(() => !button('Download').disabled);
  check(panel.textContent.includes('Artist') && panel.textContent.includes('CC0-1.0') && panel.textContent.includes('0.00 MB'), 'Inspection shows creator license and size');
  button('Download').click(); await wait(() => pendingTransfer);
  check(downloads[0].authorized === true && downloads[0].asset === 'rock', 'Only explicit click authorizes selected download');
  pendingTransfer.controller.enqueue(new TextEncoder().encode('{"progress":{"received":50,"total":100}}\n'));
  await wait(() => panel.querySelector('progress').value === 0.5);
  button('Cancel download').click(); await wait(() => panel.textContent.includes('Download cancelled'));
  check(pendingTransfer.signal.aborted, 'Cancellation aborts transport');
  pendingTransfer = null; button('Download').click(); await wait(() => pendingTransfer);
  pendingTransfer.controller.enqueue(new TextEncoder().encode('{"result":{"name":"Rock","path":"Notebook/Resources/Images/rock.png","license":"CC0-1.0"}}\n')); pendingTransfer.controller.close();
  await wait(() => panel.textContent.includes('Saved to Notebook/Resources/Images/rock.png'));
  check(panel.querySelector('li').textContent.includes('rock.png'), 'Recent downloads expose exact File Manager location');
  const form = panel.querySelector('form'); form.dispatchEvent(new Event('submit', { cancelable: true })); const stale = requests.at(-1);
  form.dispatchEvent(new Event('submit', { cancelable: true })); check(stale.signal.aborted, 'Superseded search aborted');
  requests.at(-1).resolve({ items: [], next: null }); stale.resolve({ items: [asset], next: null });
  await wait(() => panel.textContent.includes('No matches')); check(!panel.textContent.includes(asset.name), 'Stale search cannot overwrite latest results');
  const before = document.querySelectorAll('.panel-cell').length; await open(); check(document.querySelectorAll('.panel-cell').length === before, 'Repeated open does not split again');
  form.dispatchEvent(new Event('submit', { cancelable: true })); const closing = requests.at(-1);
  panel.querySelector('.panel-close-btn').click(); await wait(() => closing.signal.aborted);
  check(!panel.isConnected, 'Normal close cleans up pending work');
  const reopened = await open(); check(document.querySelectorAll('.panel-cell').length === before, 'Reopening reuses prior download cell');
  check(reopened.textContent.includes('rock.png'), 'Recent downloads survive panel reopen');
  reopened.querySelector('.panel-close-btn').click();
  workspace.remove(); const fallback = await open(); check(fallback.isConnected && fallback.closest('#workspace'), 'Empty workspace uses standard row/cell fallback');
  fallback.querySelector('.panel-close-btn').click();
  document.getElementById('result').textContent = `PASS: ${count} download panel checks`;
} catch (error) { document.getElementById('result').textContent = `FAIL: ${error.stack}`; }
