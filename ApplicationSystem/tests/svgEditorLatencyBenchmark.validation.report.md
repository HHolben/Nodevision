# SVG Editor Latency Benchmark

Generated: 2026-09-16T20:16:47.934Z

## Environment

- Electron: 42.2.0
- Chrome: 148.0.7778.97
- Node: 24.15.0
- Platform: linux 6.19.10-300.fc44.x86_64 x64

## Summary

| Fixture | Objects | Setup ms | Context ready ms | First frame ms | 0ms timer delay | RAF delay | Unrelated handler delay | Panel cells | qSA * | getBBox | Longest task | Loop max delay | Line first | Line mid | Line final | Line handler |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| empty | 0 | 198.8 | 195.6 | 206.9 | 8.4 | 7 | 25.7 | 4 | 1 | 0 | 0 | 10.1 | 40 | 21 | 33.1 | 1.3 |
| 1-objects | 1 | 27.5 | 25.2 | 39.9 | 4.2 | 5.2 | 13.4 | 5 | 1 | 0 | 0 | 1.7 | 33.4 | 30.4 | 33.2 | 1.6 |
| 10-objects | 10 | 26.2 | 24.2 | 37.2 | 3.6 | 4.3 | 10.8 | 6 | 1 | 0 | 0 | 0.8 | 33.9 | 30 | 31.4 | 1.3 |
| 100-objects | 100 | 38.1 | 36.4 | 61.7 | 5 | 10.8 | 12 | 7 | 1 | 0 | 0 | 3.2 | 33.1 | 30.2 | 33.1 | 1.6 |
| 1000-objects | 1000 | 67 | 64.4 | 74.6 | 2.9 | 5.4 | 53.5 | 8 | 1 | 0 | 50 | 3.6 | 33.3 | 27.3 | 33.1 | 2.4 |
| mixed | mixed | 42.6 | 36.9 | 48.1 | 7.5 | 14.7 | 8.1 | 9 | 1 | 0 | 0 | 3.1 | 32.9 | 28.6 | 33.2 | 2.2 |