# Serve real session modules and run the complete workflow in headless Chromium.
import http.server
import pathlib
import subprocess
import threading
import sys
root = pathlib.Path(__file__).resolve().parents[1]
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        if self.path == '/':
            content = '<html><body style="margin:0"><div id="nv-session-root"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/solder-analysis-browser.mjs"></script></body></html>'
            mime = 'text/html'
        elif self.path == '/favicon.ico': self.send_error(404); return
        else:
            path = root / self.path.lstrip('/') if self.path.startswith('/scripts/') else root / 'ApplicationSystem/public' / self.path.lstrip('/')
            if not path.is_file(): self.send_error(404); return
            content = path.read_text(); mime = 'text/javascript'
        self.send_response(200); self.send_header('Content-Type',mime); self.end_headers(); self.wfile.write(content.encode())
server = http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    sys.exit(subprocess.run(['node',str(root/'scripts/run-browser-regression.mjs'),f'http://127.0.0.1:{server.server_port}/',sys.argv[1] if len(sys.argv)>1 else 'chromium','90000'],timeout=100).returncode)
finally: server.shutdown()
