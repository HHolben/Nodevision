# SVG Properties Panel Lifecycle Benchmark

Generated: 2026-09-16T13:34:25.454Z

## Environment

- Electron: 42.2.0
- Chrome: 148.0.7778.97
- Node: 24.15.0
- Platform: linux 6.19.10-300.fc44.x86_64 x64

## Results

| Variant | Cycles | Listener registrations | Listener removals | Active listeners | Observers created | Observers disconnected | Active observers | Selection callbacks | Geometry callbacks | Style callbacks | Removed callbacks | Correct active panel | Cleanup returned | Setup ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: |
| baseline | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | no | no | 0 |
| baseline | 1 | 4 | 4 | 0 | 2 | 2 | 0 | 1 | 1 | 1 | 0 | yes | no | 5.6 |
| baseline | 5 | 12 | 12 | 0 | 6 | 6 | 0 | 5 | 5 | 5 | 0 | yes | no | 8.9 |
| baseline | 20 | 42 | 42 | 0 | 21 | 21 | 0 | 20 | 20 | 20 | 0 | yes | no | 23.8 |
| baseline | 50 | 102 | 102 | 0 | 51 | 51 | 0 | 50 | 50 | 50 | 0 | yes | no | 60.2 |
| current | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | no | no | 0 |
| current | 1 | 4 | 4 | 0 | 2 | 2 | 0 | 1 | 1 | 1 | 0 | yes | yes | 5.4 |
| current | 5 | 12 | 12 | 0 | 6 | 6 | 0 | 1 | 1 | 1 | 0 | yes | yes | 8.8 |
| current | 20 | 42 | 42 | 0 | 21 | 21 | 0 | 1 | 1 | 1 | 0 | yes | yes | 24.2 |
| current | 50 | 102 | 102 | 0 | 51 | 51 | 0 | 1 | 1 | 1 | 0 | yes | yes | 51.7 |