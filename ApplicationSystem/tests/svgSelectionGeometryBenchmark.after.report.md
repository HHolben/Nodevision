# SVG Selection Geometry Benchmark

Generated: 2026-09-16T11:24:56.945Z

## Command

```sh
/home/henry/CodexPlayground/Nodevision/node_modules/electron/dist/electron --no-sandbox ApplicationSystem/tests/svgSelectionGeometryBenchmark.electron.cjs
```

## Configuration

- Warmups: 1
- Measured repetitions: 3
- Pointer updates per drag: 60
- Drag client delta: 120, 72
- Expect optimized assertions: yes

## Environment

- Electron: 42.2.0
- Chrome: 148.0.7778.97
- Node: 24.15.0
- Platform: linux 6.19.10-300.fc44.x86_64 x64

## Aggregate Results

| Objects | Total ms median | Pointer ms median | Pointer ms p95 | getSelectableElements | qSA(*) selection | Bounds calcs | getBBox visual | Handle refreshes | Mutated events | Unrelated data-selected writes | Properties refreshes | Final position |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0 | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | empty SVG control |
| 1 | 65.5 | 1 | 1.6 | 0 | 0 | 63 | 63 | 60 | 1 | 0 | 7 | x=157, y=110.2, transform= |
| 10 | 64.9 | 1.1 | 1.8 | 0 | 0 | 67 | 67 | 60 | 1 | 0 | 11 | x=157, y=110.2, transform= |
| 100 | 58 | 0.9 | 1.4 | 0 | 0 | 71 | 71 | 60 | 1 | 0 | 15 | x=157, y=110.2, transform= |
| 1000 | 59.7 | 0.9 | 1.3 | 0 | 0 | 75 | 75 | 60 | 1 | 0 | 19 | x=157, y=110.2, transform= |