# Nodevision/scripts/test-geographic-browser.py
# Serves real geographic modules and Three.js with isolated persistence and toolbar hosts.
import http.server,pathlib,subprocess,threading,sys,os,tempfile,re,shutil
fixture=tempfile.TemporaryDirectory(prefix="nodevision-geographic-")
root=pathlib.Path(__file__).resolve().parents[1]
subprocess.run(['node',str(root/'scripts/geographic-fixtures.mjs'),fixture.name],check=True)
large=pathlib.Path(os.environ.get('NV_GEO_LARGE_FIXTURES','/tmp/nodevision-geographic-large'))
if not (large/'large-dem.tif').is_file():raise RuntimeError('Generate large fixtures with scripts/geographic-large-fixtures.py first.')
for file in large.glob('*.tif'):shutil.copyfile(file,pathlib.Path(fixture.name)/file.name)
class Handler(http.server.SimpleHTTPRequestHandler):
 changed=False
 offline=False
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(root/'ApplicationSystem/public'),**kw)
 def log_message(self,*a):pass
 def do_GET(self):
  url=self.path.split('?')[0]
  if url=='/':content='<div id="editor" style="width:800px;height:600px"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/geographic-browser.mjs"></script>';mime='text/html'
  elif url in ['/test/offline','/test/online']:
   Handler.offline=url=='/test/offline';self.send_response(200);self.end_headers();return
  elif url in ['/test/change','/test/restore']:
   Handler.changed=url=='/test/change';self.send_response(200);self.end_headers();return
  elif url.startswith('/Notebook/'):
   file=pathlib.Path(fixture.name)/('changed.tif' if Handler.changed and url=='/Notebook/dem.tif' else url.removeprefix('/Notebook/'))
   if Handler.offline or not file.is_file():self.send_error(404);return
   length=file.stat().st_size;match=re.fullmatch(r'bytes=(\d+)-(\d+)',self.headers.get('Range',''))
   if match:
    start=int(match[1]);end=min(int(match[2]),length-1)
    if start>=length:self.send_error(416);return
    self.send_response(206);self.send_header('Content-Range',f'bytes {start}-{end}/{length}');self.send_header('Content-Length',str(end-start+1));self.send_header('ETag',str(file.stat().st_mtime_ns));self.end_headers()
    with file.open('rb') as stream:stream.seek(start);self.wfile.write(stream.read(end-start+1))
   else:self.send_response(200);self.end_headers();self.wfile.write(file.read_bytes())
   return
  elif url.startswith('/scripts/'):content=(root/url.lstrip('/')).read_text();mime='text/javascript'
  elif url=='/panels/createToolbar.mjs':content='export function hideToolbarSubToolbar(){} export function showToolbarSubToolbar(){} export function updateToolbarState(patch){Object.assign(window.NodevisionState ||= {},patch);}';mime='text/javascript'
  elif url=='/panels/workspace.mjs':content='export function rebuildLayoutDividersForContainer(){} export function ensureSvgEditingSplit(){return {};} export async function loadPanelIntoCell(){}';mime='text/javascript'
  elif url.startswith('/api/'):content='{}';mime='application/json'
  else:return super().do_GET()
  self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(content.encode())
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
try:sys.exit(subprocess.run(['node',str(root/'scripts/run-browser-regression.mjs'),f'http://127.0.0.1:{server.server_port}/','chromium','180000',os.environ.get('NV_GEO_BROWSER_REPORT','/tmp/geographic-browser-report.txt')],env={**os.environ,'NODEVISION_TEST_WEBGL':'1'},timeout=190).returncode)
finally:server.shutdown();fixture.cleanup()
