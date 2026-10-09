# Nodevision/scripts/test-png-analysis-browser.py
# This runner serves synthetic PNG analysis fixtures and the real panel factory locally without accessing Notebook files.
import http.server
import pathlib
import subprocess
import threading
import mimetypes
import sys
import struct
import zlib
root = pathlib.Path(__file__).resolve().parents[1]
public = root / 'ApplicationSystem/public'
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/':
            content = b'<html><body><pre id="result">RUNNING</pre><script type="module" src="/scripts/png-analysis-browser.mjs"></script></body></html>'
            if '--toolbar' in sys.argv:
                content = content.replace(b'png-analysis-browser.mjs', b'png-analysis-toolbar-browser.mjs').replace(b'<body>', b'<body><div id="global-toolbar"></div><div id="sub-toolbar"></div>')
            mime = 'text/html'
        elif path == '/Notebook/fixture.png':
            def chunk(kind, data):
                return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
            row = b'\0' + bytes([255,0,0,255]) * 50 + bytes([0,0,255,255]) * 50
            content = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', 100, 100, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(row * 100)) + chunk(b'IEND', b'')
            mime = 'image/png'
        elif path == '/panels/actualCreateToolbar.mjs':
            content = (public / 'panels/createToolbar.mjs').read_bytes()
            mime = 'text/javascript'
        elif '--toolbar' in sys.argv and path == '/ToolbarJSONfiles/defaultToolbar.json':
            content = b'[{"heading":"View","ToolbarCategory":"View"}]'
            mime = 'application/json'
        elif path == '/panels/createToolbar.mjs':
            content = b'export function updateToolbarState() {}'
            mime = 'text/javascript'
        else:
            file = root / path.lstrip('/') if path.startswith('/scripts/') else public / path.lstrip('/')
            if not file.is_file():
                self.send_error(404)
                return
            content = file.read_bytes()
            mime = 'text/javascript' if file.suffix in ['.js','.mjs'] else mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.end_headers()
        self.wfile.write(content)
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    result = subprocess.run(['node', str(root / 'scripts/run-browser-regression.mjs'), f'http://127.0.0.1:{server.server_port}/', 'chromium', '90000', '/tmp/nodevision-png-analysis-results.txt'], timeout=110)
    sys.exit(result.returncode)
finally:
    server.shutdown()
