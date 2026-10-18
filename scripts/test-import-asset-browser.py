# Nodevision/scripts/test-import-asset-browser.py
# Serve the production import panel to Chromium with only a minimal panel shell and a controllable Notebook transport.
import http.server
import pathlib
import subprocess
import threading
import sys
root = pathlib.Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root / 'ApplicationSystem/public'), **kwargs)
    def log_message(self, *args):
        pass
    def do_GET(self):
        if self.path == '/':
            content = '<pre id="result">RUNNING</pre><script type="module" src="/test.mjs"></script>'
            mime = 'text/html'
        elif self.path == '/test.mjs':
            content = (root / 'scripts/import-asset-browser.mjs').read_text()
            mime = 'text/javascript'
        elif self.path == '/panels/panelFactory.mjs':
            content = '''import {createPanel} from '/PanelInstances/EditorPanels/MetaWorldImportPanel.mjs';
export async function createPanelDOM(name,id,type,vars) {
 const panel=document.createElement('section'),content=document.createElement('div');panel.className='panel';panel.dataset.instanceId=id;panel.append(content);
 panel.__nvSetLayout=layout=>panel.dataset.layout=layout;await createPanel(content,vars);return {panel,content};
}'''
            mime = 'text/javascript'
        else:
            return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.end_headers()
        self.wfile.write(content.encode())
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    sys.exit(subprocess.run(['node', str(root / 'scripts/run-browser-regression.mjs'), f'http://127.0.0.1:{server.server_port}/', 'chromium', '30000'], timeout=40).returncode)
finally:
    server.shutdown()
