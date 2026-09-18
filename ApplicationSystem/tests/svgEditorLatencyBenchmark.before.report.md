# SVG Editor Latency Benchmark

Generated: 2026-09-16T13:43:04.510Z

## Environment

- Electron: 42.2.0
- Chrome: 148.0.7778.97
- Node: 24.15.0
- Platform: linux 6.19.10-300.fc44.x86_64 x64

## Summary

| Fixture | Objects | Setup ms | Context ready ms | First frame ms | 0ms timer delay | RAF delay | Unrelated handler delay | Panel cells | qSA * | getBBox | Longest task | Loop max delay | Line first | Line mid | Line final | Line handler |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| empty | 0 | 226.9 | 222.8 | 230.8 | 3.5 | 2.7 | 7.1 | 4 | 1 | 0 | 0 | 21 | 33 | 24.9 | 32.9 | 0.8 |
| 1-objects | 1 | 28.6 | 27.9 | 42.9 | 2.7 | 8.6 | 15.2 | 5 | 1 | 0 | 0 | 5.7 | 33.3 | 31.9 | 33.1 | 0.7 |
| 10-objects | 10 | 33 | 31.8 | 41.2 | 2.8 | 6.5 | 21.1 | 6 | 1 | 0 | 0 | 5 | 33.3 | 32.1 | 33.3 | 0.5 |
| 100-objects | 100 | 29.7 | 28.8 | 41 | 2.6 | 7.7 | 3 | 7 | 1 | 0 | 0 | 6.6 | 33.3 | 31.9 | 33.2 | 0.7 |
| 1000-objects | 1000 | 40.6 | 39.9 | 57.7 | 2.8 | 7.6 | 9.8 | 8 | 1 | 0 | 0 | 18 | 33.2 | 31.2 | 33.3 | 0.8 |
| mixed | mixed | 39.8 | 38.9 | 58.4 | 3.6 | 8 | 4.4 | 9 | 1 | 0 | 0 | 10.8 | 33.3 | 31.9 | 33.3 | 0.5 |