# SVG Selection Geometry Benchmark

Generated: 2026-09-16T11:22:57.378Z

## Command

```sh
/home/henry/CodexPlayground/Nodevision/node_modules/electron/dist/electron --no-sandbox ApplicationSystem/tests/svgSelectionGeometryBenchmark.electron.cjs
```

## Configuration

- Warmups: 1
- Measured repetitions: 3
- Pointer updates per drag: 60
- Drag client delta: 120, 72
- Expect optimized assertions: no

## Environment

- Electron: 42.2.0
- Chrome: 148.0.7778.97
- Node: 24.15.0
- Platform: linux 6.19.10-300.fc44.x86_64 x64

## Aggregate Results

| Objects | Total ms median | Pointer ms median | Pointer ms p95 | getSelectableElements | qSA(*) selection | Bounds calcs | getBBox visual | Handle refreshes | Mutated events | Unrelated data-selected writes | Properties refreshes | Final position |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0 | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | skipped | empty SVG control |
| 1 | 79.4 | 1.3 | 1.9 | 60 | 60 | 123 | 123 | 60 | 1 | 0 | 7 | x=157, y=110.2, transform= |
| 10 | 81.4 | 1.3 | 2 | 60 | 60 | 127 | 127 | 60 | 1 | 540 | 11 | x=157, y=110.2, transform= |
| 100 | 82.7 | 1.3 | 1.9 | 60 | 60 | 131 | 131 | 60 | 1 | 5940 | 15 | x=157, y=110.2, transform= |
| 1000 | 175.8 | 2.8 | 5 | 60 | 60 | 135 | 135 | 60 | 1 | 59940 | 19 | x=157, y=110.2, transform= |