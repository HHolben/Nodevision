# Nodevision/scripts/test-universal-assets-browser.py
# Serves real editor and insertion modules with local document fixtures and lightweight toolbar/workspace hosts.
import http.server
import pathlib
import subprocess
import threading
import sys
import struct
import zlib
root = pathlib.Path(__file__).resolve().parents[1]
def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', 64, 64, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress((b'\0' + bytes([180, 30, 10]) * 64) * 64)) + chunk(b'IEND', b'')
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root / 'ApplicationSystem/public'), **kwargs)
    def log_message(self, *args):
        pass
    def do_GET(self):
        url = self.path.split('?')[0]
        if url == '/':
            content = '<pre id="result">RUNNING</pre><script type="module" src="/scripts/universal-assets-browser.mjs"></script>'
            mime = 'text/html'
        elif url.startswith('/scripts/'):
            content = (root / url.lstrip('/')).read_text(); mime = 'text/javascript'
        elif url == '/panels/createToolbar.mjs':
            content = 'export function hideToolbarSubToolbar(){} export function showToolbarSubToolbar(){} export function updateToolbarState(patch) {Object.assign(window.NodevisionState ||= {},patch);}'; mime = 'text/javascript'
        elif url == '/panels/workspace.mjs':
            content = 'export {ensureAdjacentPanelCell} from "/panels/workspaceParts/workspaceAdjacentPanel.mjs"; export function rebuildLayoutDividersForContainer(){} export async function ensureSvgEditorModeLayout(){} export function ensureSvgEditingSplit(){return {};} export async function loadPanelIntoCell(){}'; mime = 'text/javascript'
        elif url.startswith('/Notebook/') and url.endswith('.html'):
            content = '<!doctype html><html><body><p>Hello world</p></body></html>'; mime = 'text/html'
        elif url.startswith('/Notebook/') and url.endswith('.svg'):
            content = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><g id="layer-a" data-layer="true" data-layer-name="A"><rect width="10" height="10"/></g><g id="layer-b" data-layer="true" data-layer-name="B"/></svg>'; mime = 'image/svg+xml'
        elif url.startswith('/Notebook/') and url.endswith('.png') or url.startswith('/api/file-binary'):
            content = png; mime = 'image/png'
        elif url.startswith('/api/'):
            content = '{}'; mime = 'application/json'
        else:
            return super().do_GET()
        self.send_response(200); self.send_header('Content-Type', mime); self.end_headers()
        self.wfile.write(content if isinstance(content, bytes) else content.encode())
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    sys.exit(subprocess.run(['node', str(root / 'scripts/run-browser-regression.mjs'), f'http://127.0.0.1:{server.server_port}/', 'chromium', '60000'], timeout=70).returncode)
finally:
    server.shutdown()
