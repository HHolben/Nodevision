# SVG Line Stationary Feedback Benchmark

Generated: 2026-09-17T22:52:56.153Z

Electron: 42.2.0
Node: 24.15.0
Platform: linux 6.19.10-300.fc44.x86_64

## Summary

### dispatched-pointer / empty
- Activation: {"steps":[{"label":"Draw","clicked":true},{"label":"Vector Draw","clicked":true},{"label":"Line","clicked":true},{"label":"fallback-svgModeLine","clicked":true}],"mode":"line","timings":[{"label":"import:createToolbar","started":546.2999999998137,"ended":677.5999999996275,"duration":131.29999999981374},{"label":"createToolbar:SVG Editing","started":677.5999999996275,"ended":1120.5999999996275,"duration":443},{"label":"click:Draw","started":1120.7000000001863,"ended":1123.5999999996275,"duration":2.8999999994412065},{"label":"showToolbarSubToolbar:Vector Draw","started":1123.5999999996275,"ended":1142.0999999996275,"duration":18.5},{"label":"click:Vector Draw","started":1148.7999999998137,"ended":1151.5,"duration":2.7000000001862645},{"label":"showToolbarSubToolbar:Vector Draw","started":1151.5,"ended":1169,"duration":17.5},{"label":"click:Line","started":1196.7000000001863,"ended":1197.4000000003725,"duration":0.7000000001862645},{"label":"fallback-import:svgModeLine","started":1197.4000000003725,"ended":1350.5,"duration":153.09999999962747},{"label":"fallback-run:svgModeLine","started":1350.5,"ended":1383.0999999996275,"duration":32.59999999962747}],"activationWaitAppliedMs":1000.3999999994412}
- Screenshot diffs: {"firstImmediate":null,"firstAfter1s":null,"firstAfterMove":null,"secondImmediate":null,"secondAfter1s":null,"secondAfterMove":null}
- Event spans: [{"type":"pointerdown","duration":34.1,"phase":"first"},{"type":"pointermove","duration":8.9,"phase":"first-small-move"},{"type":"pointerdown","duration":3.9,"phase":"second"},{"type":"pointermove","duration":2,"phase":"second-small-move"}]
- First still DOM/state: {"active":true,"pointCount":1,"placedLineCount":0,"vertexMarkerCount":1,"startRoot":{"x":219.75880432128906,"y":180.0629119873047},"cursorRoot":{"x":219.75880432128906,"y":180.0629119873047}}
- Second still DOM/state: {"active":true,"pointCount":2,"placedLineCount":1,"vertexMarkerCount":2,"startRoot":{"x":359.8930358886719,"y":259.7944641113281},"cursorRoot":{"x":359.8930358886719,"y":259.7944641113281}}
- Marker counts: first=1, second=2
