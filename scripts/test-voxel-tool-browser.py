# Nodevision/scripts/test-voxel-tool-browser.py
# This runner serves the production voxel authoring, inventory, and movement modules to Chromium and reports the local browser integration result.
import http.server
import pathlib
import subprocess
import threading
import sys
import os
root = pathlib.Path(__file__).resolve().parents[1]
public = root / 'ApplicationSystem/public'
suite = 'hang-glider' if '--glider' in sys.argv else 'flashlight' if '--flashlight' in sys.argv else 'inventory-hotbar' if '--inventory' in sys.argv else 'insert-voxel-world' if '--insert' in sys.argv else 'voxel-tool'
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(public), **kwargs)
    def log_message(self, *args):
        pass
    def do_GET(self):
        if self.path == '/':
            content = '<html><body><div id="editor" style="width:800px;height:500px"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/' + suite + '-browser.mjs"></script></body></html>'
        elif self.path == '/panels/workspace.mjs':
            content = 'export async function ensureSvgEditorModeLayout() {} export function rebuildLayoutDividersForContainer() {} export async function loadPanelIntoCell() {} export function ensureSvgEditingSplit() {}'
        elif self.path == '/panels/panelFactory.mjs':
            content = 'export function createPanelDOM() {return document.createElement("div");}'
        elif self.path == '/panels/createToolbar.mjs':
            content = 'export function updateToolbarState(patch) {Object.assign(window.NodevisionState,patch);}'
        elif self.path == '/scripts/' + suite + '-browser.mjs':
            content = (root / ('scripts/' + suite + '-browser.mjs')).read_text()
        else:
            return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html' if self.path == '/' else 'text/javascript')
        self.end_headers()
        self.wfile.write(content.encode())
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    sys.exit(subprocess.run(['node', str(root / ('scripts/svg-text-native.mjs' if suite == 'inventory-hotbar' else 'scripts/run-browser-regression.mjs')), f'http://127.0.0.1:{server.server_port}/', 'chromium', '60000'], timeout=70, env={**os.environ, 'NODEVISION_TEST_WEBGL':'1'}).returncode)
finally:
    server.shutdown()
