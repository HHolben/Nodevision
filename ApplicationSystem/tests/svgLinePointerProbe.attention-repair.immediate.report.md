# SVG Line Stationary Feedback Benchmark

Generated: 2026-09-17T22:52:48.024Z

Electron: 42.2.0
Node: 24.15.0
Platform: linux 6.19.10-300.fc44.x86_64

## Summary

### dispatched-pointer / empty
- Activation: {"steps":[{"label":"Draw","clicked":true},{"label":"Vector Draw","clicked":true},{"label":"Line","clicked":true},{"label":"fallback-svgModeLine","clicked":true}],"mode":"line","timings":[{"label":"import:createToolbar","started":520.1000000005588,"ended":532.6000000005588,"duration":12.5},{"label":"createToolbar:SVG Editing","started":532.6000000005588,"ended":1101.7000000001863,"duration":569.0999999996275},{"label":"click:Draw","started":1101.800000000745,"ended":1105.4000000003725,"duration":3.599999999627471},{"label":"showToolbarSubToolbar:Vector Draw","started":1105.5,"ended":1133.5,"duration":28},{"label":"click:Vector Draw","started":1157.7000000001863,"ended":1160.2000000001863,"duration":2.5},{"label":"showToolbarSubToolbar:Vector Draw","started":1160.300000000745,"ended":1181.800000000745,"duration":21.5},{"label":"click:Line","started":1214.5,"ended":1215.6000000005588,"duration":1.1000000005587935},{"label":"fallback-import:svgModeLine","started":1215.6000000005588,"ended":1419.6000000005588,"duration":204},{"label":"fallback-run:svgModeLine","started":1419.6000000005588,"ended":1464.2000000001863,"duration":44.59999999962747}]}
- Screenshot diffs: {"firstImmediate":null,"firstAfter1s":null,"firstAfterMove":null,"secondImmediate":null,"secondAfter1s":null,"secondAfterMove":null}
- Event spans: [{"type":"pointerdown","duration":39.4,"phase":"first"},{"type":"pointermove","duration":7.6,"phase":"first-small-move"},{"type":"pointerdown","duration":2.7,"phase":"second"},{"type":"pointermove","duration":2.3,"phase":"second-small-move"}]
- First still DOM/state: {"active":true,"pointCount":1,"placedLineCount":0,"vertexMarkerCount":1,"startRoot":{"x":219.75880432128906,"y":180.0629119873047},"cursorRoot":{"x":219.75880432128906,"y":180.0629119873047}}
- Second still DOM/state: {"active":true,"pointCount":2,"placedLineCount":1,"vertexMarkerCount":2,"startRoot":{"x":359.8930358886719,"y":259.7944641113281},"cursorRoot":{"x":359.8930358886719,"y":259.7944641113281}}
- Marker counts: first=1, second=2
