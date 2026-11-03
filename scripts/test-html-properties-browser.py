# Nodevision/scripts/test-html-properties-browser.py
# This runner supplies the retained-editor workspace required by the existing HTML Properties regression and waits for its final result rather than an imported setup suite's intermediate success.
import http.server
import pathlib
import subprocess
import threading
import re
from urllib.parse import urljoin

root = pathlib.Path(__file__).resolve().parents[1]
stubs = {
    '/panels/createToolbar.mjs': 'window.toolbarUpdates=0; export function updateToolbarState(patch){window.toolbarUpdates++;Object.assign(window.NodevisionState,patch);}',
    '/panels/workspace.mjs': 'export function rebuildLayoutDividersForContainer(){} export async function loadPanelIntoCell(){}',
    '/ToolbarJSONfiles/insertMediaPanel.mjs': 'export function registerSvgEditorContextForInsertMedia(){return {dispose(){}};}',
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root / 'ApplicationSystem/public'), **kwargs)

    def handle(self):
        try:
            super().handle()
        except BrokenPipeError:
            pass

    def log_message(self, *args):
        pass

    def do_GET(self):
        url = self.path.split('?')[0]
        if url == '/':
            content = '<div id="editor"></div><div id="viewer"></div><div id="layers"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/html-properties-browser.mjs"></script>'
            mime = 'text/html'
        elif url.startswith('/__baseline/'):
            name = pathlib.Path(url).name
            target = 'KeyboardShortcuts/ShortcutSave.js' if name == 'ShortcutSave.js' else 'PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/' + name
            content = subprocess.check_output(['git', 'show', '729280e:ApplicationSystem/public/' + target], cwd=root, text=True)
            content = re.sub(r"from [\"'](\.[^\"']+)[\"']", lambda match: 'from "' + urljoin('/' + target, match[1]) + '"', content)
            mime = 'text/javascript'
        elif url in stubs:
            content, mime = stubs[url], 'text/javascript'
        elif url.startswith('/scripts/'):
            file = (root / url.lstrip('/')).resolve()
            if not file.is_relative_to(root / 'scripts') or not file.is_file():
                self.send_error(404)
                return
            content, mime = file.read_text(), 'text/javascript'
        else:
            return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.end_headers()
        self.wfile.write(content.encode())


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    result = subprocess.run([
        'node', str(root / 'scripts/run-browser-regression.mjs'),
        f'http://127.0.0.1:{server.server_port}/', 'chromium', '60000',
        '/tmp/nodevision-html-properties-browser.txt', 'PASS: HTML Properties browser integration',
    ], timeout=70)
finally:
    server.shutdown()
raise SystemExit(result.returncode)
