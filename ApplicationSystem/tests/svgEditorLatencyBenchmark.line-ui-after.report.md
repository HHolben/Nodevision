# SVG Editor Latency Benchmark

Generated: 2026-09-17T03:34:04.692Z

## Environment

- Electron: 42.2.0
- Chrome: 148.0.7778.97
- Node: 24.15.0
- Platform: linux 6.19.10-300.fc44.x86_64 x64

## Summary

| Fixture | Objects | Setup ms | Context ready ms | First frame ms | 0ms timer delay | RAF delay | Unrelated handler delay | Panel cells | Mode roots | Layers panels | Properties panels | qSA * | getBBox | Serialize | getScreenCTM | SVG attrs | Longest task | Loop max delay | Line mode | First handler | First DOM | First frame | Mid handler | Mid DOM | Shift mid handler | Shift mid DOM | Mouse geometry | Handler median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| empty | 0 | 202.6 | 199.3 | 210.6 | 7.4 | 5.9 | 29.1 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 75 | 409 | 1376 | 10.5 | 2202.8 | 296.2 | 0 | 968.9 | 3.6 | 716.8 | 2.7 | 608.8 | 0 | 2.7 |
| 1-objects | 1 | 510.4 | 302.5 | 517.6 | 137.8 | 136.1 | 139 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 83 | 408 | 2438 | 135.8 | 1065.8 | 689.5 | 0 | 1976.2 | 6.2 | 1408 | 2.5 | 1252 | 0 | 2.5 |
| 10-objects | 10 | 950.8 | 582.6 | 963.5 | 273.9 | 272.1 | 274.9 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 155 | 408 | 3783 | 277.7 | 1417.6 | 885.9 | 0 | 2707.5 | 2.6 | 1890.8 | 2.7 | 1849.1 | 0 | 2.6 |
| 100-objects | 100 | 1357.7 | 754 | 1371.3 | 349.1 | 347.3 | 349.8 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 875 | 408 | 4801 | 349.4 | 1792.9 | 1209.9 | 0 | 3733.5 | 2.9 | 2391.2 | 2.5 | 2434.6 | 0 | 2.5 |
| 1000-objects | 1000 | 2060.9 | 1099.8 | 2080.9 | 455.8 | 454.1 | 456.7 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 8075 | 408 | 6944 | 458.4 | 2099.1 | 1620.2 | 0 | 4735.3 | 2.8 | 3180.4 | 2.7 | 3034.7 | 0 | 2.7 |
| mixed | mixed | 2400.1 | 1452.4 | 2415.9 | 661.5 | 659.9 | 662.6 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 101 | 409 | 7679 | 670.2 | 2551.7 | 1733.7 | 0 | 5465.3 | 2.5 | 3469.7 | 2.9 | 3553.5 | 0 | 2.5 |

## Deferred Layout Safety

- Rapid close: {"modeLayoutRootsAfterClose":0,"layerPanelsAfterClose":0,"propertiesPanelsAfterClose":0}
- File switch: {"activePath":"__nv_svg_editor_latency_benchmark/mixed.svg","expectedPath":"__nv_svg_editor_latency_benchmark/mixed.svg","modeLayoutRootsAfterSwitch":1,"layerPanelsAfterSwitch":1,"propertiesPanelsAfterSwitch":1}

## Captured Console Diagnostics

- [warn] %cElectron Security Warning (Insecure Content-Security-Policy) font-weight: bold; This renderer process has either no Content Security Policy set or a policy with "unsafe-eval" enabled. This exposes users of this app to unnecessary security risks. For more information and help, consult https://electronjs.org/docs/tutorial/security. This warning will not show up once the app is packaged.