# Nodevision/scripts/test-svg-layers-browser.py
# This standalone runner serves the real SVG Layers modules to headless Chromium with a minimal toolbar host and reports the browser regression result without adding application dependencies.
import http.server
import pathlib
import subprocess
import threading
import sys
import re
import html

suite = 'editor-switch' if '--editor-switch' in sys.argv else 'world-startup' if '--world-startup' in sys.argv else 'world' if '--world' in sys.argv else 'svg-layers'
root = pathlib.Path(__file__).resolve().parents[1]
public = root / 'ApplicationSystem/public'

stubs = {
    '/panels/panelFactory.mjs': 'export function createPanelDOM() { return document.createElement("div"); }',
    '/panels/workspace.mjs': 'export async function ensureSvgEditorModeLayout() {} export function ensureSvgEditingSplit() { window.layersOpened = (window.layersOpened || 0) + 1; return {}; } export async function loadPanelIntoCell() {}',
    '/TemplateSystem/NodevisionOverlayPanel.mjs': 'export function openNodevisionOverlayPanel() {}',
    '/ToolbarJSONfiles/insertMediaPanel.mjs': 'export function registerSvgEditorContextForInsertMedia() {return {dispose(){}};}',
}

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/':
            content = '<html><body><div id="viewer" style="height:300px;width:500px"></div><div id="editor" style="height:500px;width:800px"></div><div id="layers"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/' + suite + '-browser.mjs"></script></body></html>'
            mime = 'text/html'
        elif self.path == '/Notebook/page.html':
            content, mime = '<!doctype html><title>My page</title><h1>My page</h1>', 'text/html'
        elif self.path == '/favicon.ico':
            self.send_error(404)
            return
        elif self.path == '/panels/createToolbar.mjs':
            content = 'window.toolbarUpdates=0; export function updateToolbarState(patch) { window.toolbarUpdates++; Object.assign(window.NodevisionState,patch); }'
            mime = 'text/javascript'
        elif self.path.split('?')[0] == '/Notebook/fixture.svg' or self.path.startswith('/api/file-content') or self.path.startswith('/api/readFile'):
            content, mime = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><g id="layer-a"><rect id="object-a" width="20" height="10"/></g><g id="layer-b"/></svg>', 'image/svg+xml'
        elif self.path in stubs:
            content, mime = stubs[self.path], 'text/javascript'
        else:
            url_path = self.path.split('?')[0]
            path = root / url_path.lstrip('/') if url_path.startswith('/scripts/') else public / url_path.lstrip('/')
            if not path.is_file() or path.suffix not in ['.js','.mjs']:
                self.send_error(404)
                return
            content, mime = path.read_text(), 'text/javascript'
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.end_headers()
        self.wfile.write(content.encode())

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    result = subprocess.run([next((arg for arg in sys.argv[1:] if not arg.startswith('--')), 'chromium'), '--headless', '--enable-logging=stderr', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--dump-dom', '--virtual-time-budget=15000', f'http://127.0.0.1:{server.server_port}/'], capture_output=True, text=True, timeout=90)
    match = re.search(r'<pre id="result">(.*?)</pre>', result.stdout, re.S)
    report = html.unescape(match.group(1)) if match else result.stderr
    print(report)
    if not report.startswith('PASS:'): print(result.stderr[-12000:])
    sys.exit(0 if report.startswith('PASS:') else 1)
finally:
    server.shutdown()
