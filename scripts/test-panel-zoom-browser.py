# Nodevision/scripts/test-panel-zoom-browser.py
# This runner serves isolated zoom fixtures and local dependencies to Chromium without reading or writing a user's Notebook.
import http.server
import pathlib
import subprocess
import threading
import mimetypes
import sys
root = pathlib.Path(__file__).resolve().parents[1]
public = root / 'ApplicationSystem/public'
stubs = {
    '/panels/createToolbar.mjs': 'export function updateToolbarState(p={}) {window.toolbarUpdates=(window.toolbarUpdates||0)+1; Object.assign(window.NodevisionState ||= {},p);}',
    '/panels/panelFactory.mjs': 'export function createPanelDOM() {return document.createElement("div")}',
    '/panels/workspace.mjs': 'export function rebuildLayoutDividersForContainer() {} export async function ensureSvgEditorModeLayout() {} export function ensureSvgEditingSplit() {return {}} export async function loadPanelIntoCell() {}',
    '/TemplateSystem/NodevisionOverlayPanel.mjs': 'export function openNodevisionOverlayPanel() {}',
    '/ToolbarJSONfiles/insertMediaPanel.mjs': 'export function registerSvgEditorContextForInsertMedia() {return {dispose(){}}}',
}
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_GET(self):
        resource = self.path.split('?')[0]
        mime = 'text/javascript'
        if resource == '/':
            content = '<!doctype html><pre id="result">RUNNING</pre><script src="/vendor/cytoscape/cytoscape.min.js"></script><script type="module" src="/scripts/panel-zoom-browser.mjs"></script>'
            mime = 'text/html'
        elif resource in stubs:
            content = stubs[resource]
        elif resource == '/api/fileCodeContent':
            content = '{"content":"const answer = 42;","encoding":"utf8"}'
            mime = 'application/json'
        elif resource.endswith('.csv') and resource.startswith('/Notebook/'):
            content, mime = 'Name,Value\nFirst,42', 'text/csv'
        elif resource.endswith('.php') and resource.startswith('/Notebook/'):
            content, mime = '<main id="php-content">PHP output</main>', 'text/html'
        elif resource.startswith('/Notebook/'):
            content = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect id="shape" width="200" height="100"/></svg>' if resource.endswith('.svg') else '<p>Frame content</p>'
            mime = 'image/svg+xml' if resource.endswith('.svg') else 'text/html'
        else:
            file = root / resource.lstrip('/') if resource.startswith('/scripts/') else public / resource.lstrip('/')
            if not file.is_file():
                self.send_error(404)
                return
            content = file.read_bytes()
            mime = 'text/javascript' if file.suffix in ['.js', '.mjs'] else mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.end_headers()
        self.wfile.write(content.encode() if isinstance(content, str) else content)
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    result = subprocess.run(['node', str(root / 'scripts/run-browser-regression.mjs'), f'http://127.0.0.1:{server.server_port}/', 'chromium', '180000', '/tmp/nodevision-panel-zoom-results.txt'], timeout=200)
    sys.exit(result.returncode)
finally:
    server.shutdown()
