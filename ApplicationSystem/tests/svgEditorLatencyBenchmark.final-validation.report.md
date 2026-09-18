# SVG Editor Latency Benchmark

Generated: 2026-09-17T03:40:21.681Z

## Environment

- Electron: 42.2.0
- Chrome: 148.0.7778.97
- Node: 24.15.0
- Platform: linux 6.19.10-300.fc44.x86_64 x64

## Summary

| Fixture | Objects | Setup ms | Context ready ms | First frame ms | 0ms timer delay | RAF delay | Unrelated handler delay | Panel cells | Mode roots | Layers panels | Properties panels | qSA * | getBBox | Serialize | getScreenCTM | SVG attrs | Longest task | Loop max delay | Line mode | First handler | First DOM | First frame | Mid handler | Mid DOM | Shift mid handler | Shift mid DOM | Mouse geometry | Handler median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| empty | 0 | 231.1 | 228.3 | 242.5 | 9.6 | 7.3 | 12.8 | 4 | 1 | 1 | 1 | 0 | 0 | 0 | 2 | 129 | 58 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1-objects | 1 | 58 | 55.6 | 85.4 | 8.9 | 10.6 | 14 | 4 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 128 | 0 | 8.4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 10-objects | 10 | 49.7 | 43.4 | 62.1 | 8 | 4.6 | 37.2 | 4 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 128 | 0 | 4.2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 100-objects | 100 | 31.3 | 28.9 | 45.4 | 4.2 | 7.7 | 18.6 | 4 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 128 | 0 | 0.9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1000-objects | 1000 | 59 | 57 | 69.5 | 4.1 | 4.5 | 48.7 | 4 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 128 | 0 | 3.3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mixed | mixed | 57.4 | 49.9 | 70.2 | 6.5 | 7.1 | 19.6 | 4 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 129 | 0 | 3.8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Deferred Layout Safety

- Rapid close: {"modeLayoutRootsAfterClose":0,"layerPanelsAfterClose":0,"propertiesPanelsAfterClose":0}
- File switch: {"activePath":"__nv_svg_editor_latency_benchmark/mixed.svg","expectedPath":"__nv_svg_editor_latency_benchmark/mixed.svg","modeLayoutRootsAfterSwitch":1,"layerPanelsAfterSwitch":1,"propertiesPanelsAfterSwitch":1}

## Captured Console Diagnostics

- [warn] %cElectron Security Warning (Insecure Content-Security-Policy) font-weight: bold; This renderer process has either no Content Security Policy set or a policy with "unsafe-eval" enabled. This exposes users of this app to unnecessary security risks. For more information and help, consult https://electronjs.org/docs/tutorial/security. This warning will not show up once the app is packaged.