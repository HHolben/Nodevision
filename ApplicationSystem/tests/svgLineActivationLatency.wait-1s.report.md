# SVG Line Stationary Feedback Benchmark

Generated: 2026-09-17T16:45:41.722Z

Electron: 42.2.0
Node: 24.15.0
Platform: linux 6.19.10-300.fc44.x86_64

## Summary

### dispatched-pointer / empty
- Activation: {"steps":[{"label":"Draw","clicked":true},{"label":"Vector Draw","clicked":true},{"label":"Line","clicked":true},{"label":"fallback-svgModeLine","clicked":true}],"mode":"line","timings":[{"label":"import:createToolbar","started":564,"ended":688.4000000003725,"duration":124.40000000037253},{"label":"createToolbar:SVG Editing","started":688.4000000003725,"ended":1215.5,"duration":527.0999999996275},{"label":"click:Draw","started":1215.6000000005588,"ended":1220.9000000003725,"duration":5.2999999998137355},{"label":"showToolbarSubToolbar:Vector Draw","started":1220.9000000003725,"ended":1250.9000000003725,"duration":30},{"label":"click:Vector Draw","started":1272.1000000005588,"ended":1273.7000000001863,"duration":1.599999999627471},{"label":"showToolbarSubToolbar:Vector Draw","started":1273.7000000001863,"ended":1285.2999999998137,"duration":11.599999999627471},{"label":"click:Line","started":1301.4000000003725,"ended":1302.2000000001863,"duration":0.7999999998137355},{"label":"fallback-import:svgModeLine","started":1302.2000000001863,"ended":2402.9000000003725,"duration":1100.7000000001863},{"label":"fallback-run:svgModeLine","started":2402.9000000003725,"ended":2721,"duration":318.09999999962747}],"activationWaitAppliedMs":1000.2999999998137}
- Screenshot diffs: {"firstImmediate":null,"firstAfter1s":null,"firstAfterMove":null,"secondImmediate":null,"secondAfter1s":null,"secondAfterMove":null}
- Event spans: [{"type":"pointerdown","duration":321.7,"phase":"first"},{"type":"pointermove","duration":7.3,"phase":"first-small-move"},{"type":"pointerdown","duration":2.6,"phase":"second"},{"type":"pointermove","duration":1,"phase":"second-small-move"}]
- First still DOM/state: {"active":true,"pointCount":1,"placedLineCount":0,"vertexMarkerCount":1,"startRoot":{"x":219.75880432128906,"y":-62.085777282714844},"cursorRoot":{"x":219.75880432128906,"y":-62.085777282714844}}
- Second still DOM/state: {"active":true,"pointCount":2,"placedLineCount":1,"vertexMarkerCount":2,"startRoot":{"x":359.8930358886719,"y":17.645763397216797},"cursorRoot":{"x":359.8930358886719,"y":17.645763397216797}}
- Marker counts: first=1, second=2
