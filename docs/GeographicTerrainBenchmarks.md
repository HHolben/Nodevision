<!-- Nodevision/docs/GeographicTerrainBenchmarks.md -->
<!-- Records reproducible measurements and limitations of cropped geographic import and progressive traversal. -->

# Geographic terrain benchmark evidence

Measured on 2026-10-24 in the development Linux environment. These are synthetic workload measurements, not a claim about every Pelion dataset or end-user device. Reproduction commands are in [GeographicTerrain.md](GeographicTerrain.md).

The source is a 2048 × 2048 tiled Float32 DEM at 10 m resolution, with a distant summit and NoData outside the selection. A matching categorical raster supplies vegetation biomes. The selected 5 km × 5 km region uses horizontal scale 1 and 0.25 m voxels, with 252,004 elevation samples including interpolation support. Its low relief fits the unchanged vertical engine limit. Actual mountainous crops may require reduced vertical exaggeration.

Both benchmarks enable vegetation and two joined 2400 m graded paths. Traversal visits four widely separated corners and the center repeatedly. The Node run uses three rounds and 1350 updates; Chromium uses two rounds and 450 animation frames. The configured load radius is one chunk. Visits are time limited and do not wait for every queued chunk to finish; the browser ends with eight queued chunks. This exercises cancellation and progressive appearance, not complete instantaneous terrain visibility after teleporting.

| Measurement | Node CPU run | Headless Chromium / SwiftShader |
| --- | ---: | ---: |
| Import including land cover and snapshot preparation | 746 ms | 840 ms |
| Elevation source bytes transferred | 2,031,616 (26 requests) | 2,031,616 (26 requests) |
| Elevation source file size | 16,779,648 bytes | 16,779,648 bytes |
| Estimated peak import working memory | 224.5 MiB | 224.5 MiB |
| Serialized geographic recipe | 5,415,224 bytes | 5,415,150 bytes |
| Maximum resident chunks | 22 | 4 |
| Maximum resident mesh buffers | 4,341,576 bytes | 1,138,936 bytes |
| Streaming update mean / p95 / maximum | 2.62 / 4.27 / 17.00 ms | 4.30 / 6.20 / 15.80 ms |
| Wall-clock animation-frame interval mean / p95 / maximum | Not measured | 16.69 / 17.10 / 24.80 ms |
| Largest chunk build, accumulated active CPU time | 75.17 ms | 54.80 ms |

Chunk builds are spread over updates; accumulated build time is not a single-frame stall. The 4 ms generation deadline is soft, as the measured overruns show. Browser render submission averaged 0.24 ms, but submission time does not measure GPU completion. SwiftShader results do not guarantee hardware-GPU frame rates. Node event-loop intervals are reported separately and must not be interpreted as display frame times.

The memory figure is an admission estimate with empirical JavaScript/clipping/garbage-collection headroom, not measured peak RSS or a process-memory ceiling. Node RSS snapshots were 90.8 MiB before import, 304.7 MiB after import, and 331.2 MiB after traversal. These snapshots can miss transient peaks and include the runtime, server, retained heap and libraries. Mesh-byte counters cover geometry buffers, not all renderer/object overhead. Browser process memory was not measured.

Node terrain-column and feature caches reached their fixed caps of 8192 and 512 entries. Path lookup tiles stabilized at 44, feature neighborhoods at 42, and chunk-level entries at 45 on repeated visits. Path columns stayed within 8192. Twelve vegetation features were observed. The regression suite additionally tests resident chunk/byte eviction and cancellation of unfinished work after teleporting. World extent does not size these caches or allocate a full-world voxel array.

The browser workflow passed worker import, preview, placement, rendering, G settings, undo/redo, source-change checks, cancellation, rapid crop changes, and HTML save/reload. A small selection from the large source remained portable after source serving was disabled, with an authored object retained. The first two chunks in the separate small-world workflow appeared in 293 ms. A single-strip fixture exceeding the decode budget was rejected before pixel decoding.

All 22 geographic, procedural voxel, Aegean, and path test files passed. The geographic regressions include crop-specific elevation/NoData support, holes, exact sample centers, both CRSs, PixelIsArea/PixelIsPoint, adjacent windows, version-1 compatibility, recropping placement, and stale worker replies.

Raw reports: [Node](benchmarks/geographic-v2-node.json) and [Chromium](benchmarks/geographic-v2-browser.json). The reports retain individual visits and cache counters. Timing and resident counts vary with scheduling and how much queued work completes per visit.

Remaining practical limits include the 256 m vertical span, import/decode/snapshot budgets, the 20 km local-projection envelope, 8–64 m configured viewing radius, and no distant-terrain LOD. Connected long routes use multiple path objects because the existing per-path limit remains 4096 m. This verifies a bounded 5 km world traversal workload; it does not establish seamless long-distance vistas or a hard frame-time guarantee.
