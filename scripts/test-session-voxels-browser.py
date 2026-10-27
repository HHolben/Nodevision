# Nodevision/scripts/test-constructions-browser.py
# Serves real path modules and Three.js with isolated persistence and toolbar hosts.
import http.server,pathlib,subprocess,threading,sys,os
root=pathlib.Path(__file__).resolve().parents[1]
sandbox='--sandbox' in sys.argv
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(root/'ApplicationSystem/public'),**kw)
 def log_message(self,*a):pass
 def do_GET(self):
  url=self.path.split('?')[0]
  if url=='/' and sandbox:content='<div class="panel-cell"><div id="editor" style="width:800px;height:600px"></div></div><pre id="result">RUNNING</pre><script type="importmap">{"imports":{"three":"/lib/three/three.module.js"}}</script><script type="module" src="/scripts/session-voxels-sandbox-browser.mjs"></script>';mime='text/html'
  elif url=='/':content='<div id="editor" style="width:800px;height:600px"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/session-voxels-browser.mjs"></script>';mime='text/html'
  elif url.startswith('/scripts/'):content=(root/url.lstrip('/')).read_text();mime='text/javascript'
  elif url=='/panels/createToolbar.mjs':content='export function hideToolbarSubToolbar(){} export function showToolbarSubToolbar(){} export function updateToolbarState(patch){Object.assign(window.NodevisionState ||= {},patch);}';mime='text/javascript'
  elif url.startswith('/sandbox-builtins/') and sandbox:content=(root/'ApplicationSystem/Sessions/BuiltIn'/pathlib.Path(url).name).read_text();mime='text/javascript'
  elif url=='/panels/panelFactory.mjs' and sandbox:content='export function createPanelDOM(){return document.createElement("div")}';mime='text/javascript'
  elif url=='/TemplateSystem/NodevisionOverlayPanel.mjs' and sandbox:content='export async function openNodevisionOverlayPanel(type,options){window.fixtureSessionError=options.message;console.error(options.message);return "quit";}';mime='text/javascript'
  elif url=='/ToolbarJSONfiles/insertMediaPanel.mjs' and sandbox:content='export function registerSvgEditorContextForInsertMedia(){return {dispose(){}}} export function openInsertMediaPanel(){}';mime='text/javascript'
  elif url=='/panels/workspace.mjs' and sandbox:
   content='''export {ensureSvgEditingSplit} from '/panels/workspaceParts/workspaceSvgSplit.mjs';
export function ensureSvgEditorModeLayout(){} export function rebuildLayoutDividersForContainer(){}
export async function loadPanelIntoCell(type,vars){const {openPanelTabInCell}=await import('/panels/panelTabs.mjs');return openPanelTabInCell(window.activeCell.closest('.panel-cell'),{panelType:type,panelClass:vars.panelClass||'InfoPanel',panelVars:vars,allowDuplicate:vars.allowDuplicateTab},async host=>{if(type==='GameView')await(await import('/PanelInstances/ViewPanels/GameView.mjs')).setupPanel(host,vars);else host.textContent='Layers';});}''';mime='text/javascript'
  elif url=='/panels/workspace.mjs':content='export function rebuildLayoutDividersForContainer(){} export function ensureSvgEditingSplit(){return {};} export async function loadPanelIntoCell(){}';mime='text/javascript'
  elif url.startswith('/api/'):content='{}';mime='application/json'
  else:return super().do_GET()
  self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(content.encode())
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
try:sys.exit(subprocess.run(['node',str(root/'scripts/run-browser-regression.mjs'),f'http://127.0.0.1:{server.server_port}/','chromium','180000'],env={**os.environ,'NODEVISION_TEST_WEBGL':'1'},timeout=190).returncode)
finally:server.shutdown()
