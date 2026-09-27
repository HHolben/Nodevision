# Nodevision/scripts/test-csv-browser.py
# This standalone runner serves the real CSV modules to headless Chromium with a minimal toolbar host and reports the browser regression result without adding application dependencies.
import http.server
import pathlib
import subprocess
import threading
import sys
import re
import html

root = pathlib.Path(__file__).resolve().parents[1]
public = root / 'ApplicationSystem/public'

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/':
            content = '<html><body><button id="toolbar-button">Toolbar</button><div id="test-editor" style="height:600px;width:1200px"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/csv-range-browser.mjs"></script></body></html>'
            mime = 'text/html'
        elif self.path == '/favicon.ico':
            self.send_error(404)
            return
        elif self.path == '/panels/createToolbar.mjs':
            content = 'window.toolbarUpdates=0; export function updateToolbarState() { window.toolbarUpdates++; }'
            mime = 'text/javascript'
        elif self.path == '/Notebook/fixture.csv':
            content, mime = 'A,B\nC,D', 'text/plain'
        else:
            path = root / self.path.lstrip('/') if self.path.startswith('/scripts/') else public / self.path.lstrip('/')
            if not path.is_file():
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
    result = subprocess.run([sys.argv[1] if len(sys.argv)>1 else 'chromium', '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--dump-dom', '--virtual-time-budget=15000', f'http://127.0.0.1:{server.server_port}/'], capture_output=True, text=True, timeout=90)
    match = re.search(r'<pre id="result">(.*?)</pre>', result.stdout, re.S)
    report = html.unescape(match.group(1)) if match else result.stderr
    print(report)
    sys.exit(0 if report.startswith('PASS:') else 1)
finally:
    server.shutdown()
