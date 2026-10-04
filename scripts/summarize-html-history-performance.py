"""Summarize matched native history matrices without conflating rAF proxies and renderer CPU time."""
import json
from pathlib import Path

def distribution(values):
    values=sorted(values)
    if not values:return None
    return {"n":len(values),"p50":round(values[len(values)//2],3),"p95":round(values[int((len(values)-1)*.95)],3),"max":round(values[-1],3)}

def summarize(row):
    typing=row['typing']
    result={"fixture":row['fixture'],"typing":{
        "firstRaf":distribution([s['firstRafMs'] for s in typing['samples']]),
        "secondRaf":distribution([s['secondRafMs'] for s in typing['samples']]),
        "beforeinput":distribution(typing['journal'].get('beforeinput',[])),
        "input":distribution(typing['journal'].get('input',[])),
        "capture":distribution(typing['journal'].get('capture',[])),
        "coalesce":distribution(typing['journal'].get('coalesce',[])),
        "longTasks":typing['probes']['longTasks'],"counts":typing['probes']['counts'],
        "history":typing['history'],"renderer":typing['renderer']},"operations":[]}
    for op in row['operations']:
        if op['label'].endswith(' undo') and op['history']['redoEntries']!=1:raise ValueError('Replay did not take effect: '+str(row['fixture'])+op['label'])
        result['operations'].append({"label":op['label'],"syncMs":op.get('result'),
            "phases":{k:round(sum(v),4) for k,v in op['journal'].items()},
            "observerMs":round(sum(op['probes']['values'].get('mutationObservers',[])),4),
            "serializationMs":round(sum(op['probes']['values'].get('serialization',[])),4),
            "counts":op['probes']['counts'],"refresh":op['refresh'],"toolbarCalls":op['toolbarCalls'],"renderer":op['renderer'],"history":op['history']})
    result['heapGrowth']=row['memory']['after']['usedSize']-row['memory']['before']['usedSize']
    return result

output={}
for phase in ['before','after']:
    path=Path('docs/html-history-performance-'+phase+'.json')
    if path.exists():
        raw=json.loads(path.read_text());output[phase]={"matrix":[summarize(row) for row in raw['matrix']],"longSession":raw.get('longSession'),"traces":raw.get('traces'),"disposed":raw.get('disposed')}
Path('docs/html-history-performance-summary.json').write_text(json.dumps(output,indent=2)+'\n')
for phase,data in output.items():
    print(phase)
    for row in data['matrix']:
        f=row['fixture']
        if f['words']==20000:
            ops={op['label']:op for op in row['operations']}
            print(f['fragmented'],f['config'],'second-rAF p95',row['typing']['secondRaf']['p95'],'typing undo',ops['typing undo']['syncMs'],'style undo',ops['properties undo']['syncMs'])
