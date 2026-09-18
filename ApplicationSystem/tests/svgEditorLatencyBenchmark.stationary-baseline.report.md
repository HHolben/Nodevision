# SVG Editor Latency Benchmark

Generated: 2026-09-17T04:04:37.401Z

## Environment

- Electron: 42.2.0
- Chrome: 148.0.7778.97
- Node: 24.15.0
- Platform: linux 6.19.10-300.fc44.x86_64 x64

## Summary

| Fixture | Objects | Setup ms | Context ready ms | First frame ms | 0ms timer delay | RAF delay | Unrelated handler delay | Panel cells | Mode roots | Layers panels | Properties panels | qSA * | getBBox | Serialize | getScreenCTM | SVG attrs | Longest task | Loop max delay | Line mode | First handler | First DOM | First frame | Mid handler | Mid DOM | Shift mid handler | Shift mid DOM | Mouse geometry | Handler median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| empty | 0 | 191.9 | 189 | 202.7 | 7.2 | 5.8 | 20.8 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 75 | 409 | 1284 | 6.9 | 1936.1 | 296.1 | 0 | 916.1 | 2.6 | 603.7 | 2.9 | 584.4 | 0 | 2.4 |
| 1-objects | 1 | 644.9 | 404.9 | 668.2 | 128.1 | 126.4 | 128.7 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 83 | 408 | 2375 | 124.7 | 2253.1 | 576.6 | 0 | 1783.7 | 2.5 | 1188.6 | 2.4 | 1191.7 | 0 | 2.4 |
| 10-objects | 10 | 1163.4 | 734.6 | 1179.9 | 227.6 | 225.8 | 228.3 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 155 | 408 | 3536 | 225.6 | 3126.1 | 908.4 | 0 | 2729.9 | 2.5 | 1765.2 | 2.8 | 1748.2 | 0 | 2.5 |
| 100-objects | 100 | 1731.4 | 1167.6 | 1751.2 | 360.4 | 358.7 | 360.9 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 875 | 408 | 4869 | 359.3 | 3955.6 | 1193.4 | 0 | 3573.1 | 3.7 | 2344.6 | 2.7 | 2338.1 | 0 | 2.6 |
| 1000-objects | 1000 | 2891.7 | 1844.1 | 2918.7 | 471.3 | 469.5 | 471.9 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 8075 | 408 | 6430 | 472.1 | 5422.8 | 1628.4 | 0 | 4869.8 | 3.1 | 3329.8 | 3.6 | 3204.9 | 0 | 2.9 |
| mixed | mixed | 2881.7 | 1905.3 | 2911 | 610.1 | 608 | 610.8 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 101 | 409 | 7332 | 613.2 | 5788.3 | 1710.3 | 0 | 5309 | 2.5 | 3546.3 | 2.6 | 3547 | 0 | 2.5 |

## Deferred Layout Safety

- Rapid close: {"modeLayoutRootsAfterClose":0,"layerPanelsAfterClose":0,"propertiesPanelsAfterClose":0}
- File switch: {"activePath":"__nv_svg_editor_latency_benchmark/mixed.svg","expectedPath":"__nv_svg_editor_latency_benchmark/mixed.svg","modeLayoutRootsAfterSwitch":1,"layerPanelsAfterSwitch":1,"propertiesPanelsAfterSwitch":1}

## Captured Console Diagnostics

- [warn] %cElectron Security Warning (Insecure Content-Security-Policy) font-weight: bold; This renderer process has either no Content Security Policy set or a policy with "unsafe-eval" enabled. This exposes users of this app to unnecessary security risks. For more information and help, consult https://electronjs.org/docs/tutorial/security. This warning will not show up once the app is packaged.