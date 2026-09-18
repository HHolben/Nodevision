# SVG Line Stationary Feedback Benchmark

Generated: 2026-09-17T17:04:22.360Z

Electron: 42.2.0
Node: 24.15.0
Platform: linux 6.19.10-300.fc44.x86_64

## Summary

### dispatched-pointer / empty
- Activation: {"steps":[{"label":"Draw","clicked":true},{"label":"Vector Draw","clicked":true},{"label":"Line","clicked":true},{"label":"fallback-svgModeLine","clicked":true}],"mode":"line","timings":[{"label":"import:createToolbar","started":538.8999999994412,"ended":695.7999999998137,"duration":156.90000000037253},{"label":"createToolbar:SVG Editing","started":695.8999999994412,"ended":1242.5999999996275,"duration":546.7000000001863},{"label":"click:Draw","started":1242.7999999998137,"ended":1247.5999999996275,"duration":4.7999999998137355},{"label":"showToolbarSubToolbar:Vector Draw","started":1247.7999999998137,"ended":1283.7999999998137,"duration":36},{"label":"click:Vector Draw","started":1300.199999999255,"ended":1304,"duration":3.800000000745058},{"label":"showToolbarSubToolbar:Vector Draw","started":1304,"ended":1341,"duration":37},{"label":"click:Line","started":1388.199999999255,"ended":1389.5,"duration":1.300000000745058},{"label":"fallback-import:svgModeLine","started":1389.5,"ended":1847.2999999998137,"duration":457.79999999981374},{"label":"fallback-run:svgModeLine","started":1847.2999999998137,"ended":2207.5999999996275,"duration":360.29999999981374}],"activationWaitAppliedMs":1000.2999999998137}
- Screenshot diffs: {"firstImmediate":null,"firstAfter1s":null,"firstAfterMove":null,"secondImmediate":null,"secondAfter1s":null,"secondAfterMove":null}
- Event spans: [{"type":"pointerdown","duration":346.9,"phase":"first"},{"type":"pointermove","duration":8.5,"phase":"first-small-move"},{"type":"pointerdown","duration":3,"phase":"second"},{"type":"pointermove","duration":3.1,"phase":"second-small-move"}]
- First still DOM/state: {"active":true,"pointCount":1,"placedLineCount":0,"vertexMarkerCount":1,"startRoot":{"x":219.75880432128906,"y":180.330322265625},"cursorRoot":{"x":219.75880432128906,"y":180.330322265625}}
- Second still DOM/state: {"active":true,"pointCount":2,"placedLineCount":1,"vertexMarkerCount":2,"startRoot":{"x":359.8930358886719,"y":260.0618591308594},"cursorRoot":{"x":359.8930358886719,"y":260.0618591308594}}
- Marker counts: first=1, second=2
