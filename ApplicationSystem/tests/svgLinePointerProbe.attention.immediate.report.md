# SVG Line Stationary Feedback Benchmark

Generated: 2026-09-17T17:04:11.748Z

Electron: 42.2.0
Node: 24.15.0
Platform: linux 6.19.10-300.fc44.x86_64

## Summary

### dispatched-pointer / empty
- Activation: {"steps":[{"label":"Draw","clicked":true},{"label":"Vector Draw","clicked":true},{"label":"Line","clicked":true},{"label":"fallback-svgModeLine","clicked":true}],"mode":"line","timings":[{"label":"import:createToolbar","started":559.6000000005588,"ended":575.8000000007451,"duration":16.200000000186265},{"label":"createToolbar:SVG Editing","started":575.8000000007451,"ended":1282.5,"duration":706.6999999992549},{"label":"click:Draw","started":1282.7000000001863,"ended":1291.7000000001863,"duration":9},{"label":"showToolbarSubToolbar:Vector Draw","started":1291.800000000745,"ended":1347.9000000003725,"duration":56.09999999962747},{"label":"click:Vector Draw","started":1362.800000000745,"ended":1367.2000000001863,"duration":4.3999999994412065},{"label":"showToolbarSubToolbar:Vector Draw","started":1367.2000000001863,"ended":1414.300000000745,"duration":47.10000000055879},{"label":"click:Line","started":1512.1000000005588,"ended":1516,"duration":3.8999999994412065},{"label":"fallback-import:svgModeLine","started":1516,"ended":2116.800000000745,"duration":600.8000000007451},{"label":"fallback-run:svgModeLine","started":2116.9000000003725,"ended":2527.800000000745,"duration":410.90000000037253}]}
- Screenshot diffs: {"firstImmediate":null,"firstAfter1s":null,"firstAfterMove":null,"secondImmediate":null,"secondAfter1s":null,"secondAfterMove":null}
- Event spans: [{"type":"pointerdown","duration":416.2,"phase":"first"},{"type":"pointermove","duration":8.3,"phase":"first-small-move"},{"type":"pointerdown","duration":4.5,"phase":"second"},{"type":"pointermove","duration":1.7,"phase":"second-small-move"}]
- First still DOM/state: {"active":true,"pointCount":1,"placedLineCount":0,"vertexMarkerCount":1,"startRoot":{"x":219.75880432128906,"y":180.330322265625},"cursorRoot":{"x":219.75880432128906,"y":180.330322265625}}
- Second still DOM/state: {"active":true,"pointCount":2,"placedLineCount":1,"vertexMarkerCount":2,"startRoot":{"x":359.8930358886719,"y":260.0618591308594},"cursorRoot":{"x":359.8930358886719,"y":260.0618591308594}}
- Marker counts: first=1, second=2
