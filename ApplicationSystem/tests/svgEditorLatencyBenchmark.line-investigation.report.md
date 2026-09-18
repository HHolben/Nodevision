# SVG Editor Latency Benchmark

Generated: 2026-09-17T01:57:02.685Z

## Environment

- Electron: 42.2.0
- Chrome: 148.0.7778.97
- Node: 24.15.0
- Platform: linux 6.19.10-300.fc44.x86_64 x64

## Summary

| Fixture | Objects | Setup ms | Context ready ms | First frame ms | 0ms timer delay | RAF delay | Unrelated handler delay | Panel cells | Mode roots | Layers panels | Properties panels | qSA * | getBBox | Serialize | getScreenCTM | SVG attrs | Longest task | Loop max delay | Line mode | Line first | Line mid | Line final | Shift first | Shift mid | Line handler |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| empty | 0 | 244.8 | 241.3 | 252.6 | 6 | 4.8 | 7.9 | 4 | 1 | 1 | 1 | 7 | 4 | 0 | 89 | 406 | 0 | 8.8 | 57.3 | 31.9 | 30.9 | 34.6 | 35.1 | 32.9 | 1.2 |
| 1-objects | 1 | 25 | 23.1 | 41.9 | 3.3 | 5.6 | 33.8 | 4 | 1 | 1 | 1 | 7 | 4 | 0 | 113 | 406 | 0 | 1.9 | 26.2 | 33.4 | 33.4 | 33.4 | 33.4 | 33.1 | 1.4 |
| 10-objects | 10 | 28.8 | 27.2 | 37.1 | 4.2 | 4.8 | 16.8 | 4 | 1 | 1 | 1 | 7 | 4 | 0 | 329 | 406 | 0 | 1.1 | 28.1 | 33 | 33.3 | 33.3 | 38 | 33.4 | 0.9 |
| 100-objects | 100 | 32.4 | 30.5 | 42 | 3.6 | 4.1 | 41.7 | 4 | 1 | 1 | 1 | 7 | 4 | 0 | 2489 | 406 | 0 | 0.3 | 41.4 | 33.5 | 33.5 | 34.3 | 32.4 | 33.3 | 1.6 |
| 1000-objects | 1000 | 48.3 | 46.9 | 58.6 | 2.7 | 5.9 | 36.9 | 4 | 1 | 1 | 1 | 7 | 4 | 0 | 24089 | 406 | 0 | 0.3 | 26.6 | 33.3 | 33.3 | 35.8 | 36.3 | 35.7 | 2.7 |
| mixed | mixed | 38.6 | 36.2 | 46.7 | 5.2 | 6.1 | 27.5 | 4 | 1 | 1 | 1 | 7 | 4 | 0 | 167 | 407 | 0 | 0.9 | 38.2 | 32.8 | 33.4 | 35 | 36.3 | 33.4 | 0.8 |

## Deferred Layout Safety

- Rapid close: {"modeLayoutRootsAfterClose":0,"layerPanelsAfterClose":0,"propertiesPanelsAfterClose":0}
- File switch: {"activePath":"__nv_svg_editor_latency_benchmark/mixed.svg","expectedPath":"__nv_svg_editor_latency_benchmark/mixed.svg","modeLayoutRootsAfterSwitch":1,"layerPanelsAfterSwitch":1,"propertiesPanelsAfterSwitch":1}

## Captured Console Diagnostics

- [warn] %cElectron Security Warning (Insecure Content-Security-Policy) font-weight: bold; This renderer process has either no Content Security Policy set or a policy with "unsafe-eval" enabled. This exposes users of this app to unnecessary security risks. For more information and help, consult https://electronjs.org/docs/tutorial/security. This warning will not show up once the app is packaged.