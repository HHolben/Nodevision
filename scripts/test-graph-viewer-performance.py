# Development-only server: instruments source in memory; never serves or writes Notebook data.
import http.server, pathlib, subprocess, threading, sys, json, mimetypes
root = pathlib.Path(__file__).resolve().parents[1]
public = root / 'ApplicationSystem/public'
source_revision = next((arg.split('=', 1)[1] for arg in sys.argv if arg.startswith('--source-revision=')), None)
suite = 'graph-divider-browser' if '--divider' in sys.argv else 'graph-viewer-layout-control' if '--layout-control' in sys.argv else 'graph-viewer-phase1-browser' if '--lifecycle' in sys.argv else 'graph-viewer-open-probe' if '--open-only' in sys.argv else 'graph-viewer-performance'
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        resource = self.path.split('?', 1)[0]
        if resource == '/':
            content = '<body><link rel="stylesheet" href="/Stylesheets/style.css"><div id="workspace"></div><pre id="result">RUNNING</pre>' + ''.join('<script src="/vendor/'+p+'"></script>' for p in ['cytoscape/cytoscape.min.js','layout-base/layout-base.js','cose-base/cose-base.js','cytoscape-fcose/cytoscape-fcose.js']) + '<script type="module" src="/scripts/' + suite + '.mjs"></script>'
        elif resource == '/panels/createToolbar.mjs' and '--divider' not in sys.argv:
            content = 'export function updateToolbarState() { window.__perf.toolbar++; }'
        elif resource == '/MessageBroker/MQTTModelClient.mjs' and '--lifecycle' in sys.argv:
            content = """const listeners = new Set(); let value = {topics:[],devices:[]};
export function formatMqttTimestamp(value) { return String(value); }
export function getMqttModelClient() { return { snapshot:()=>value, subscribe(fn){listeners.add(fn); return ()=>listeners.delete(fn);}, connect:async()=>{} }; }
window.__mqtt = { count:()=>listeners.size, publish(snapshot){value=snapshot; for(const fn of listeners)fn(snapshot);} };"""
        elif resource == '/ToolbarCallbacks/file/phase1Refresh.mjs' and '--lifecycle' in sys.argv:
            content = 'export default async function() { await window.refreshGraphManager({fit:false}); window.__fileActionCompleted = true; }'
        elif resource == '/EditorSwitchGuard.mjs':
            content = 'export function requestNodevisionFileSelection() { window.__perf.selectionRequests++; }'
        else:
            path = (root if resource.startswith('/scripts/') else public) / resource.lstrip('/')
            allowed = root / 'scripts' if resource.startswith('/scripts/') else public
            if not path.is_file() or not path.resolve().is_relative_to(allowed):
                self.send_error(404); return
            if path.suffix not in ('.mjs', '.js', '.css', '.json', '.html'):
                self.send_response(200); self.send_header('Content-Type', mimetypes.guess_type(path)[0] or 'application/octet-stream'); self.end_headers(); self.wfile.write(path.read_bytes()); return
            if source_revision and path.is_relative_to(public):
                content = subprocess.check_output(['git', 'show', f'{source_revision}:{path.relative_to(root)}'], cwd=root, text=True)
            else:
                content = path.read_text()
            if path.name == 'GraphManagerCore.mjs':
                probe = (root / 'scripts/graph-scope-core-probe.mjs').read_text()
                probe += '\nexport const performanceProbe = { runRelayout, buildGraphLayoutOptions, resetLayout() { layoutHasInitialized = false; } };\n'
                names = ['rebuildVisibleEdges','runRelayout','queueRelayout','applyGraphAbstractionFilter','applyGraphSelectedFileEntries','publishGraphSelectedFileEntries','applyGraphViewportSize','scheduleGraphViewportResize','renderGraphLinkInspector','findDirectoryAtRenderedPoint','findFileAtRenderedPoint']
                for name in names:
                    probe += f'\n{{ const original = {name}; {name} = function(...args) {{ const t = performance.now(); try {{ return original.apply(this,args); }} finally {{ window.__record({json.dumps(name)}, performance.now()-t); }} }}; }}\n'
                if 'export function createGraphManagerInstance' in content:
                    probe = probe.replace('export const ', 'const ')
                    probe += """
instance.__performanceProbe = { scopeInvestigation, performanceProbe,
resources: () => ({ disposed, root:!!root, container:!!container, cy:!!cy,
observer:!!resizeObserver, listeners:cleanups.length, layoutTimer:!!layoutDebounceTimer,
resizeFrame:!!graphViewportResizeFrame, collisionFrame:!!expandedDirectoryCollisionFrame,
layers:!!mqttGraphLayer || !!tdGraphLayer, cacheEntries:discoveredLinks.size + htmlPreviewCache.size }) };
"""
                    content = content.replace('return instance;\n}', probe + '\nreturn instance;\n}', 1)
                    content += """
const currentProbe = () => activeGraphManager()?.__performanceProbe;
export const scopeInvestigation = new Proxy({}, {get:(_,key)=>(...args)=>currentProbe()?.scopeInvestigation[key](...args)});
export const performanceProbe = new Proxy({}, {get:(_,key)=>(...args)=>currentProbe()?.performanceProbe[key](...args)});
"""
                else:
                    content += probe
        self.send_response(200)
        self.send_header('Content-Type', 'text/html' if resource == '/' else 'text/css' if resource.endswith('.css') else 'text/javascript')
        self.end_headers(); self.wfile.write(content.encode())
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    result = subprocess.run(['node', str(root/'scripts/run-browser-regression.mjs'), f'http://127.0.0.1:{server.server_port}/', 'chromium', '900000', sys.argv[1] if len(sys.argv)>1 else '/tmp/graph-viewer-performance.txt'], timeout=920)
    output = pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else None
    if result.returncode == 0 and output and output.suffix == '.json':
        output.write_text(json.dumps(json.loads(output.read_text().removeprefix('PASS: ')), indent=2) + '\n')
    sys.exit(result.returncode)
finally: server.shutdown()
