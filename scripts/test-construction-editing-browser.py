# Nodevision/scripts/test-constructions-browser.py
# Serves real path modules and Three.js with isolated persistence and toolbar hosts.
import http.server,pathlib,subprocess,threading,sys,os
root=pathlib.Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(root/'ApplicationSystem/public'),**kw)
 def log_message(self,*a):pass
 def do_GET(self):
  url=self.path.split('?')[0]
  if url=='/':content='<div id="editor" style="width:800px;height:600px"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/construction-editing-browser.mjs"></script>';mime='text/html'
  elif url.startswith('/scripts/'):content=(root/url.lstrip('/')).read_text();mime='text/javascript'
  elif url=='/panels/createToolbar.mjs':content='export function hideToolbarSubToolbar(){} export function showToolbarSubToolbar(){} export function updateToolbarState(patch){Object.assign(window.NodevisionState ||= {},patch);}';mime='text/javascript'
  elif url=='/panels/workspace.mjs':content='export function rebuildLayoutDividersForContainer(){} export function ensureSvgEditingSplit(){return {};} export async function loadPanelIntoCell(){}';mime='text/javascript'
  elif url.startswith('/api/'):content='{}';mime='application/json'
  else:return super().do_GET()
  self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(content.encode())
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
try:sys.exit(subprocess.run(['node',str(root/'scripts/run-browser-regression.mjs'),f'http://127.0.0.1:{server.server_port}/','chromium','180000'],env={**os.environ,'NODEVISION_TEST_WEBGL':'1'},timeout=190).returncode)
finally:server.shutdown()
