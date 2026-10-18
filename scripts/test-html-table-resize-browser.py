# Nodevision/scripts/test-html-table-resize-browser.py
# This standalone runner serves the real HTML editor modules to headless Chromium with a minimal toolbar host and reports the browser regression result without adding application dependencies.
import http.server
import pathlib
import subprocess
import threading
import sys

suite = sys.argv[1] if len(sys.argv) > 1 else 'html-table-resize'
root = pathlib.Path(__file__).resolve().parents[1]
public = root / 'ApplicationSystem/public'

stubs = {
    '/panels/panelFactory.mjs': 'export function createPanelDOM() { return document.createElement("div"); }',
    '/panels/workspace.mjs': 'export function rebuildLayoutDividersForContainer() {} export async function loadPanelIntoCell() {}',
    '/TemplateSystem/NodevisionOverlayPanel.mjs': 'export function openNodevisionOverlayPanel() {}',
    '/ToolbarJSONfiles/insertMediaPanel.mjs': 'export function registerSvgEditorContextForInsertMedia() {return {dispose(){}};}',
}

if suite == "bridging":
    stubs["/TemplateSystem/NodevisionOverlayPanel.mjs"] = "export async function openNodevisionOverlayPanel() {return window.__bridgingNewDocumentRequest || null;}"

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/':
            content = '<html><body><div id="viewer" style="height:300px;width:500px"></div><div id="editor" style="height:500px;width:800px"></div><div id="layers"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/' + suite + '-browser.mjs"></script></body></html>'
            mime = 'text/html'
        elif self.path == '/favicon.ico':
            self.send_error(404)
            return
        elif self.path == '/panels/createToolbar.mjs':
            content = 'window.toolbarUpdates=0; export function updateToolbarState(patch) { window.toolbarUpdates++; Object.assign(window.NodevisionState,patch); }'
            mime = 'text/javascript'
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
    sys.exit(subprocess.run(['node', str(root / f'scripts/{suite}-native.mjs'),
        f'http://127.0.0.1:{server.server_port}/', 'chromium', '60000'], timeout=70).returncode)
finally:
    server.shutdown()
