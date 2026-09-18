# SVG Editor Latency Benchmark

Generated: 2026-09-17T02:00:04.527Z

## Environment

- Electron: 42.2.0
- Chrome: 148.0.7778.97
- Node: 24.15.0
- Platform: linux 6.19.10-300.fc44.x86_64 x64

## Summary

| Fixture | Objects | Setup ms | Context ready ms | First frame ms | 0ms timer delay | RAF delay | Unrelated handler delay | Panel cells | Mode roots | Layers panels | Properties panels | qSA * | getBBox | Serialize | getScreenCTM | SVG attrs | Longest task | Loop max delay | Line mode | Line first | Line mid | Line final | Shift first | Shift mid | Line handler |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| empty | 0 | 200.9 | 198.4 | 208.2 | 9.1 | 7.3 | 26.4 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 73 | 406 | 53 | 7.3 | 58.7 | 37.4 | 25.1 | 33.3 | 35.3 | 33.4 | 1.2 |
| 1-objects | 1 | 24 | 20.7 | 40.7 | 3.1 | 5.7 | 26 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 81 | 406 | 0 | 0.3 | 28.2 | 33.3 | 33.5 | 33.2 | 34.9 | 33.3 | 0.9 |
| 10-objects | 10 | 22.6 | 20.2 | 45.6 | 3.2 | 6.5 | 14.2 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 153 | 406 | 0 | 3.1 | 22.7 | 34.1 | 33 | 33.4 | 33.1 | 33.1 | 0.9 |
| 100-objects | 100 | 25.3 | 23 | 52.1 | 3 | 6.7 | 29.1 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 873 | 406 | 0 | 0.7 | 34 | 35.1 | 33.3 | 33.2 | 32.7 | 33.5 | 1.1 |
| 1000-objects | 1000 | 48.7 | 47.2 | 58.8 | 3.4 | 6.1 | 36.9 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 8073 | 406 | 0 | 2.7 | 25.5 | 33.1 | 32.4 | 33.9 | 38.2 | 27.2 | 1.5 |
| mixed | mixed | 26.9 | 24.7 | 40.2 | 3.4 | 5.8 | 14 | 4 | 1 | 1 | 1 | 5 | 4 | 0 | 99 | 407 | 0 | 0.4 | 28.5 | 32.8 | 33.5 | 33.3 | 38.9 | 33.4 | 0.8 |

## Deferred Layout Safety

- Rapid close: {"modeLayoutRootsAfterClose":0,"layerPanelsAfterClose":0,"propertiesPanelsAfterClose":0}
- File switch: {"activePath":"__nv_svg_editor_latency_benchmark/mixed.svg","expectedPath":"__nv_svg_editor_latency_benchmark/mixed.svg","modeLayoutRootsAfterSwitch":1,"layerPanelsAfterSwitch":1,"propertiesPanelsAfterSwitch":1}

## Captured Console Diagnostics

- [warn] %cElectron Security Warning (Insecure Content-Security-Policy) font-weight: bold; This renderer process has either no Content Security Policy set or a policy with "unsafe-eval" enabled. This exposes users of this app to unnecessary security risks. For more information and help, consult https://electronjs.org/docs/tutorial/security. This warning will not show up once the app is packaged.