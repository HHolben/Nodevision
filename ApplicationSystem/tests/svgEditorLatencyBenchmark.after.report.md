# SVG Editor Latency Benchmark

Generated: 2026-09-16T13:44:08.575Z

## Environment

- Electron: 42.2.0
- Chrome: 148.0.7778.97
- Node: 24.15.0
- Platform: linux 6.19.10-300.fc44.x86_64 x64

## Summary

| Fixture | Objects | Setup ms | Context ready ms | First frame ms | 0ms timer delay | RAF delay | Unrelated handler delay | Panel cells | qSA * | getBBox | Longest task | Loop max delay | Line first | Line mid | Line final | Line handler |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| empty | 0 | 107.5 | 106 | 125 | 3.7 | 2.9 | 10.6 | 4 | 1 | 0 | 0 | 1.7 | 33.2 | 24 | 33.5 | 1.2 |
| 1-objects | 1 | 21.2 | 19.3 | 51 | 3.8 | 6.7 | 10 | 5 | 1 | 0 | 0 | 0.2 | 33.6 | 31.9 | 33.5 | 0.7 |
| 10-objects | 10 | 18.8 | 17.3 | 49.8 | 2.6 | 7.9 | 4.4 | 6 | 1 | 0 | 0 | 0.1 | 33.5 | 32.5 | 33.1 | 0.5 |
| 100-objects | 100 | 16.3 | 15.6 | 50.2 | 2.7 | 7.7 | 5.3 | 7 | 1 | 0 | 0 | 0.1 | 33.7 | 31.6 | 33.2 | 0.7 |
| 1000-objects | 1000 | 32.5 | 31.9 | 48.5 | 3.3 | 7.5 | 15.6 | 8 | 1 | 0 | 0 | 0.2 | 31 | 32.4 | 35.1 | 1 |
| mixed | mixed | 17.1 | 15.8 | 50.7 | 2.5 | 8.6 | 10.4 | 9 | 1 | 0 | 0 | 0.1 | 33.2 | 31.7 | 33.2 | 0.6 |