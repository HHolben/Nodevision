# SVG Line Stationary Feedback Benchmark

Generated: 2026-09-17T16:57:54.452Z

Electron: 42.2.0
Node: 24.15.0
Platform: linux 6.19.10-300.fc44.x86_64

## Summary

### dispatched-pointer / empty
- Activation: {"steps":[{"label":"Draw","clicked":true},{"label":"Vector Draw","clicked":true},{"label":"Line","clicked":true},{"label":"fallback-svgModeLine","clicked":true}],"mode":"line","timings":[{"label":"import:createToolbar","started":529.6000000005588,"ended":540.7999999998137,"duration":11.199999999254942},{"label":"createToolbar:SVG Editing","started":540.7999999998137,"ended":1030,"duration":489.20000000018626},{"label":"click:Draw","started":1030.1000000005588,"ended":1034.4000000003725,"duration":4.2999999998137355},{"label":"showToolbarSubToolbar:Vector Draw","started":1034.5,"ended":1064.2999999998137,"duration":29.799999999813735},{"label":"click:Vector Draw","started":1081.1000000005588,"ended":1086.1000000005588,"duration":5},{"label":"showToolbarSubToolbar:Vector Draw","started":1086.1000000005588,"ended":1106.6000000005588,"duration":20.5},{"label":"click:Line","started":1146.4000000003725,"ended":1147.4000000003725,"duration":1},{"label":"fallback-import:svgModeLine","started":1147.4000000003725,"ended":2117.7000000001863,"duration":970.2999999998137},{"label":"fallback-run:svgModeLine","started":2117.7000000001863,"ended":2412.7999999998137,"duration":295.09999999962747}]}
- Screenshot diffs: {"firstImmediate":null,"firstAfter1s":null,"firstAfterMove":null,"secondImmediate":null,"secondAfter1s":null,"secondAfterMove":null}
- Event spans: [{"type":"pointerdown","duration":293.3,"phase":"first"},{"type":"pointermove","duration":7.9,"phase":"first-small-move"},{"type":"pointerdown","duration":2.8,"phase":"second"},{"type":"pointermove","duration":1.9,"phase":"second-small-move"}]
- First still DOM/state: {"active":true,"pointCount":1,"placedLineCount":0,"vertexMarkerCount":1,"startRoot":{"x":219.75880432128906,"y":180.330322265625},"cursorRoot":{"x":219.75880432128906,"y":180.330322265625}}
- Second still DOM/state: {"active":true,"pointCount":2,"placedLineCount":1,"vertexMarkerCount":2,"startRoot":{"x":359.8930358886719,"y":260.0618591308594},"cursorRoot":{"x":359.8930358886719,"y":260.0618591308594}}
- Marker counts: first=1, second=2
