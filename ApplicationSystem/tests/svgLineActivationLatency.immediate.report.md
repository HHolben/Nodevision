# SVG Line Stationary Feedback Benchmark

Generated: 2026-09-17T16:45:30.409Z

Electron: 42.2.0
Node: 24.15.0
Platform: linux 6.19.10-300.fc44.x86_64

## Summary

### dispatched-pointer / empty
- Activation: {"steps":[{"label":"Draw","clicked":true},{"label":"Vector Draw","clicked":true},{"label":"Line","clicked":true},{"label":"fallback-svgModeLine","clicked":true}],"mode":"line","timings":[{"label":"import:createToolbar","started":537.7000000001863,"ended":548.6000000005588,"duration":10.900000000372529},{"label":"createToolbar:SVG Editing","started":548.6000000005588,"ended":986.2999999998137,"duration":437.69999999925494},{"label":"click:Draw","started":986.2999999998137,"ended":990,"duration":3.7000000001862645},{"label":"showToolbarSubToolbar:Vector Draw","started":990,"ended":1005.9000000003725,"duration":15.900000000372529},{"label":"click:Vector Draw","started":1011.2999999998137,"ended":1014.7999999998137,"duration":3.5},{"label":"showToolbarSubToolbar:Vector Draw","started":1014.9000000003725,"ended":1029.1000000005588,"duration":14.200000000186265},{"label":"click:Line","started":1063,"ended":1063.9000000003725,"duration":0.900000000372529},{"label":"fallback-import:svgModeLine","started":1063.9000000003725,"ended":2124.2000000001863,"duration":1060.2999999998137},{"label":"fallback-run:svgModeLine","started":2124.2000000001863,"ended":2442.5,"duration":318.29999999981374}]}
- Screenshot diffs: {"firstImmediate":null,"firstAfter1s":null,"firstAfterMove":null,"secondImmediate":null,"secondAfter1s":null,"secondAfterMove":null}
- Event spans: [{"type":"pointerdown","duration":312.5,"phase":"first"},{"type":"pointermove","duration":7.5,"phase":"first-small-move"},{"type":"pointerdown","duration":4.7,"phase":"second"},{"type":"pointermove","duration":1.2,"phase":"second-small-move"}]
- First still DOM/state: {"active":true,"pointCount":1,"placedLineCount":0,"vertexMarkerCount":1,"startRoot":{"x":219.75880432128906,"y":180.330322265625},"cursorRoot":{"x":219.75880432128906,"y":180.330322265625}}
- Second still DOM/state: {"active":true,"pointCount":2,"placedLineCount":1,"vertexMarkerCount":2,"startRoot":{"x":359.8930358886719,"y":260.0618591308594},"cursorRoot":{"x":359.8930358886719,"y":260.0618591308594}}
- Marker counts: first=1, second=2
