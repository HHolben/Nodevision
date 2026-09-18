# SVG Line Stationary Feedback Benchmark

Generated: 2026-09-17T22:54:42.451Z

Electron: 42.2.0
Node: 24.15.0
Platform: linux 6.19.10-300.fc44.x86_64

## Summary

### dispatched-pointer / empty
- Activation: {"steps":[{"label":"Draw","clicked":true},{"label":"Vector Draw","clicked":true},{"label":"Line","clicked":true},{"label":"fallback-svgModeLine","clicked":true}],"mode":"line","timings":[{"label":"import:createToolbar","started":608,"ended":643,"duration":35},{"label":"createToolbar:SVG Editing","started":643,"ended":1240.7000000001863,"duration":597.7000000001863},{"label":"click:Draw","started":1240.7999999998137,"ended":1246.0999999996275,"duration":5.2999999998137355},{"label":"showToolbarSubToolbar:Vector Draw","started":1246.0999999996275,"ended":1271.2000000001863,"duration":25.100000000558794},{"label":"click:Vector Draw","started":1289.8999999994412,"ended":1291.8999999994412,"duration":2},{"label":"showToolbarSubToolbar:Vector Draw","started":1291.8999999994412,"ended":1310.7000000001863,"duration":18.800000000745058},{"label":"click:Line","started":1358,"ended":1359.2999999998137,"duration":1.2999999998137355},{"label":"fallback-import:svgModeLine","started":1359.2999999998137,"ended":1592,"duration":232.70000000018626},{"label":"fallback-run:svgModeLine","started":1592,"ended":1636.5999999996275,"duration":44.59999999962747}]}
- Screenshot diffs: {"firstImmediate":null,"firstAfter1s":null,"firstAfterMove":null,"secondImmediate":null,"secondAfter1s":null,"secondAfterMove":null}
- Event spans: [{"type":"pointerdown","duration":56.7,"phase":"first"},{"type":"pointermove","duration":9.4,"phase":"first-small-move"},{"type":"pointerdown","duration":3.4,"phase":"second"},{"type":"pointermove","duration":2.7,"phase":"second-small-move"}]
- First still DOM/state: {"active":true,"pointCount":1,"placedLineCount":0,"vertexMarkerCount":1,"startRoot":{"x":219.75880432128906,"y":180.0629119873047},"cursorRoot":{"x":219.75880432128906,"y":180.0629119873047}}
- Second still DOM/state: {"active":true,"pointCount":2,"placedLineCount":1,"vertexMarkerCount":2,"startRoot":{"x":359.8930358886719,"y":259.7944641113281},"cursorRoot":{"x":359.8930358886719,"y":259.7944641113281}}
- Marker counts: first=1, second=2
