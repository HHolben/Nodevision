# Converts the browser result into a portable raw JSON baseline and compact Markdown tables.
import json, pathlib, sys
source=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/graph-viewer-performance.txt')
text=source.read_text()
if not text.startswith('PASS: '): raise SystemExit('Browser benchmark did not finish successfully')
data=json.loads(text[6:]); out=pathlib.Path(sys.argv[2] if len(sys.argv)>2 else 'docs/benchmarks/graph-viewer-baseline.json')
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(data,indent=2)+'\n')
rows=data['results']
print('| Nodes / edges | Operation | Handler mean / max ms | Frame mean / p95 / max ms | Paint opportunity mean ms | Renders | Toolbar |')
print('|---|---|---:|---:|---:|---:|---:|')
for r in rows:
 if r.get('repeat')!=1 or 'handler' not in r:continue
 h,f,v=r['handler'],r['frame'],r['paintOpportunity']
 print(f"| {r['n']} / {r['e']} | {r['operation']} | {h['mean']:.2f} / {h['max']:.2f} | {f['mean']:.2f} / {f['p95']:.2f} / {f['max']:.2f} | {v['mean']:.2f} | {r['events'].get('render',0)} | {r['toolbar']} |")
print('\nOther results:')
for r in rows:
 if 'repeat' not in r:print(json.dumps(r))
