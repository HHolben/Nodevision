# Nodevision/scripts/test-uppercase-handwriting-browser.py
# This runner serves the isolated uppercase Session and its local assets to Chromium without opening the application server or accessing user Notebook files.
import http.server
import pathlib
import subprocess
import threading
import mimetypes
import sys

root = pathlib.Path(__file__).resolve().parents[1]
public = root / 'ApplicationSystem/public'

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        resource = self.path.split('?')[0]
        if resource == '/':
            content = '<!doctype html><div id="nv-session-root" style="position:fixed;inset:0;display:grid;place-items:center"><strong>Session title</strong></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/uppercase-handwriting-browser.mjs"></script>'
            mime = 'text/html'
        else:
            file = (root if resource.startswith('/scripts/') else public) / resource.lstrip('/')
            if not file.resolve().is_relative_to(root) or not file.is_file():
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
    result = subprocess.run(['node', str(root / 'scripts/run-browser-regression.mjs'), f'http://127.0.0.1:{server.server_port}/', 'chromium', '30000', '/tmp/nodevision-uppercase-results.txt'], timeout=45)
    sys.exit(result.returncode)
finally:
    server.shutdown()
