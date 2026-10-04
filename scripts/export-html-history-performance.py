import json,csv
from pathlib import Path
before=json.load(open('docs/html-history-performance-before.json'));after=json.load(open('docs/html-history-performance-after.json'))
key=lambda r:tuple(r['fixture'][k] for k in ['words','fragmented','config'])
b={key(r):r for r in before['matrix']};a={key(r):r for r in after['matrix']}
assert len(a)==len(b)==48 and a.keys()==b.keys()
lines=['# Matched HTML journal replay matrix','', 'Milliseconds; single samples, not p95. B/A = baseline/optimized. Both directions and every measured operation are in [the CSV](html-history-performance-matrix.csv). Deferred preview work is excluded from synchronous replay.','', '| Words | Markup | Configuration | Typing Undo B/A | Color Undo B/A | Table Undo B/A |','| ---: | --- | --- | ---: | ---: | ---: |']
with open('docs/html-history-performance-matrix.csv','w') as f:
 w=csv.writer(f);w.writerow(['words','fragmented','configuration','operation','before_sync_ms','after_sync_ms','after_patch_ms','after_caret_ms','after_layers_collect_ms','after_notification_ms','after_serialization_window_ms'])
 for k,r in a.items():
  old={o['label']:o for o in b[k]['operations']};new={o['label']:o for o in r['operations']};assert old.keys()==new.keys()
  cells=[]
  for label in ['typing undo','properties undo','structure undo']:cells.append(f"{old[label]['result']:.1f} / {new[label]['result']:.1f}")
  lines.append('| '+' | '.join([str(k[0]),'fragmented' if k[1] else 'clean',k[2]]+cells)+' |')
  for label,o in new.items():
   if not label.endswith((' undo',' redo')):continue
   j=o['journal'];w.writerow([*k,label,old[label]['result'],o['result'],sum(j.get('replayDom',[])),sum(j.get('restoreCaret',[])),sum(j.get('layersCollect',[])),sum(j.get('notifyInput',[])),sum(o['probes']['values'].get('serialization',[]))])
Path('docs/html-history-performance-matrix.md').write_text('\n'.join(lines)+'\n')
print('48 matched fixtures; 576 matched replay pairs exported')
