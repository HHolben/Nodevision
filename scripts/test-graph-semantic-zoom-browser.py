# Nodevision/scripts/test-graph-semantic-zoom-browser.py
# This standalone runner serves the graph semantic zoom modules to headless Chromium with the bundled Cytoscape renderer and reports the browser regression result without adding application dependencies.
import http.server
import pathlib
import subprocess
import threading
import sys
import re
import os

root = pathlib.Path(__file__).resolve().parents[1]
public = root / 'ApplicationSystem/public'
scope_investigation = '--scope-investigation' in sys.argv
suite = 'graph-scope-investigation-browser' if scope_investigation else 'graph-semantic-zoom-browser'
browser = next((arg for arg in sys.argv[1:] if not arg.startswith('--')), 'chromium')
scope_case = os.environ.get('NV_SCOPE_CASE', '')
if scope_case not in ('', '1000:1', '1000:4', '10000:1', '10000:4'):
    raise ValueError('NV_SCOPE_CASE must name an existing size:density fixture')

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/':
            content = '<html><body><link rel="stylesheet" href="/Stylesheets/style.css"><div id="workspace"></div><pre id="result">RUNNING</pre><script src="/vendor/cytoscape/cytoscape.min.js"></script><script src="/vendor/layout-base/layout-base.js"></script><script src="/vendor/cose-base/cose-base.js"></script><script src="/vendor/cytoscape-fcose/cytoscape-fcose.js"></script><script type="module" src="/scripts/' + suite + '.mjs?case=' + scope_case + '"></script></body></html>'
            mime = 'text/html'
        elif self.path == '/favicon.ico':
            self.send_error(404)
            return
        elif self.path == '/panels/createToolbar.mjs':
            content, mime = 'export function updateToolbarState() {}', 'text/javascript'
        elif self.path == '/EditorSwitchGuard.mjs':
            content, mime = 'export function requestNodevisionFileSelection() {}', 'text/javascript'
        else:
            resource = self.path.split('?', 1)[0]
            path = root / resource.lstrip('/') if resource.startswith('/scripts/') else public / resource.lstrip('/')
            if not path.is_file():
                self.send_error(404)
                return
            content = path.read_text()
            if path.name == 'GraphManagerCore.mjs':
                for name in ['queueRelayout', 'runRelayout', 'applyGraphAbstractionFilter', 'rebuildVisibleEdges']:
                    # Counters only: leave the real function body and behavior intact.
                    pattern = r'(function ' + name + r'\([^\n]*\) \{)'
                    content = re.sub(pattern, r'\1' + '\nwindow.__graphCalls ||= {}; window.__graphCalls["' + name + '"] = (window.__graphCalls["' + name + '"] || 0) + 1;', content)
                if scope_investigation:
                    content += (root / 'scripts/graph-scope-core-probe.mjs').read_text()
            mime = 'text/css' if path.suffix == '.css' else 'text/javascript'
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.end_headers()
        self.wfile.write(content.encode())

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    result = subprocess.run(['node', str(root / 'scripts/run-browser-regression.mjs'), f'http://127.0.0.1:{server.server_port}/', browser, '1800000' if scope_investigation else '180000', '/tmp/nodevision-graph-scope-results.txt' if scope_investigation else '/tmp/nodevision-graph-semantic-results.txt'], timeout=1820 if scope_investigation else 200)
    sys.exit(result.returncode)

finally:
    server.shutdown()
