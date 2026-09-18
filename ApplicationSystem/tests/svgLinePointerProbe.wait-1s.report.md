# SVG Line Stationary Feedback Benchmark

Generated: 2026-09-17T16:58:04.862Z

Electron: 42.2.0
Node: 24.15.0
Platform: linux 6.19.10-300.fc44.x86_64

## Summary

### dispatched-pointer / empty
- Activation: {"steps":[{"label":"Draw","clicked":true},{"label":"Vector Draw","clicked":true},{"label":"Line","clicked":true},{"label":"fallback-svgModeLine","clicked":true}],"mode":"line","timings":[{"label":"import:createToolbar","started":525.5,"ended":536.9000000003725,"duration":11.400000000372529},{"label":"createToolbar:SVG Editing","started":537,"ended":1025.800000000745,"duration":488.80000000074506},{"label":"click:Draw","started":1025.9000000003725,"ended":1029.800000000745,"duration":3.900000000372529},{"label":"showToolbarSubToolbar:Vector Draw","started":1029.800000000745,"ended":1048.1000000005588,"duration":18.299999999813735},{"label":"click:Vector Draw","started":1067.6000000005588,"ended":1069.7000000001863,"duration":2.099999999627471},{"label":"showToolbarSubToolbar:Vector Draw","started":1069.7000000001863,"ended":1084.2000000001863,"duration":14.5},{"label":"click:Line","started":1126.7000000001863,"ended":1128.6000000005588,"duration":1.900000000372529},{"label":"fallback-import:svgModeLine","started":1128.6000000005588,"ended":2162.300000000745,"duration":1033.7000000001863},{"label":"fallback-run:svgModeLine","started":2162.300000000745,"ended":2464.5,"duration":302.19999999925494}],"activationWaitAppliedMs":1000.4000000003725}
- Screenshot diffs: {"firstImmediate":null,"firstAfter1s":null,"firstAfterMove":null,"secondImmediate":null,"secondAfter1s":null,"secondAfterMove":null}
- Event spans: [{"type":"pointerdown","duration":314.5,"phase":"first"},{"type":"pointermove","duration":8.2,"phase":"first-small-move"},{"type":"pointerdown","duration":2.8,"phase":"second"},{"type":"pointermove","duration":1.2,"phase":"second-small-move"}]
- First still DOM/state: {"active":true,"pointCount":1,"placedLineCount":0,"vertexMarkerCount":1,"startRoot":{"x":219.75880432128906,"y":180.330322265625},"cursorRoot":{"x":219.75880432128906,"y":180.330322265625}}
- Second still DOM/state: {"active":true,"pointCount":2,"placedLineCount":1,"vertexMarkerCount":2,"startRoot":{"x":359.8930358886719,"y":260.0618591308594},"cursorRoot":{"x":359.8930358886719,"y":260.0618591308594}}
- Marker counts: first=1, second=2
