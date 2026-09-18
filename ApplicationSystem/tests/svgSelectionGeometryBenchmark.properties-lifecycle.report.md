# SVG Selection Geometry Benchmark

Generated: 2026-09-16T13:34:44.101Z

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
| 1 | 66.2 | 1 | 1.5 | 0 | 0 | 61 | 61 | 60 | 1 | 0 | 1 | x=157, y=110.2, transform= |
| 10 | 66.6 | 1.1 | 1.8 | 0 | 0 | 61 | 61 | 60 | 1 | 0 | 1 | x=157, y=110.2, transform= |
| 100 | 57.8 | 0.9 | 1.5 | 0 | 0 | 61 | 61 | 60 | 1 | 0 | 1 | x=157, y=110.2, transform= |
| 1000 | 58.4 | 0.9 | 1.2 | 0 | 0 | 61 | 61 | 60 | 1 | 0 | 1 | x=157, y=110.2, transform= |