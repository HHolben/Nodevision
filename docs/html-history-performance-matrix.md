# Matched HTML journal replay matrix

Milliseconds; single samples, not p95. B/A = baseline/optimized. Both directions and every measured operation are in [the CSV](html-history-performance-matrix.csv). Deferred preview work is excluded from synchronous replay.

| Words | Markup | Configuration | Typing Undo B/A | Color Undo B/A | Table Undo B/A |
| ---: | --- | --- | ---: | ---: | ---: |
| 1000 | clean | editor | 3.6 / 2.7 | 0.8 / 0.8 | 1.5 / 1.1 |
| 1000 | clean | fileview | 2.8 / 2.1 | 1.2 / 0.8 | 1.9 / 1.6 |
| 1000 | clean | layers | 21.6 / 2.5 | 17.8 / 0.8 | 15.2 / 1.6 |
| 1000 | clean | properties | 4.6 / 1.8 | 2.0 / 0.9 | 2.7 / 1.2 |
| 1000 | clean | heavy | 18.8 / 2.0 | 16.0 / 0.7 | 18.0 / 1.3 |
| 1000 | clean | retained | 2.7 / 2.6 | 1.2 / 0.9 | 1.4 / 1.3 |
| 1000 | fragmented | editor | 4.1 / 2.7 | 1.9 / 0.9 | 2.0 / 1.7 |
| 1000 | fragmented | fileview | 4.4 / 2.8 | 1.4 / 1.1 | 1.6 / 1.7 |
| 1000 | fragmented | layers | 22.2 / 2.2 | 23.3 / 1.6 | 25.5 / 1.2 |
| 1000 | fragmented | properties | 4.6 / 2.7 | 2.8 / 1.0 | 3.7 / 1.2 |
| 1000 | fragmented | heavy | 22.0 / 2.2 | 33.8 / 1.1 | 24.6 / 1.4 |
| 1000 | fragmented | retained | 4.1 / 2.3 | 1.8 / 1.2 | 1.6 / 1.1 |
| 10000 | clean | editor | 4.9 / 3.3 | 1.7 / 1.0 | 2.1 / 1.7 |
| 10000 | clean | fileview | 4.1 / 2.3 | 1.6 / 0.9 | 3.1 / 2.5 |
| 10000 | clean | layers | 16.9 / 2.6 | 14.1 / 0.9 | 17.8 / 1.6 |
| 10000 | clean | properties | 6.1 / 2.7 | 3.4 / 0.9 | 4.0 / 1.7 |
| 10000 | clean | heavy | 16.3 / 2.7 | 15.1 / 1.0 | 17.7 / 2.4 |
| 10000 | clean | retained | 3.7 / 3.2 | 2.1 / 0.6 | 2.9 / 1.9 |
| 10000 | fragmented | editor | 6.7 / 3.6 | 5.3 / 1.1 | 6.6 / 1.8 |
| 10000 | fragmented | fileview | 6.4 / 2.6 | 4.8 / 0.7 | 4.2 / 1.7 |
| 10000 | fragmented | layers | 65.5 / 2.5 | 50.5 / 1.1 | 54.4 / 2.2 |
| 10000 | fragmented | properties | 8.2 / 2.8 | 8.1 / 0.9 | 6.2 / 1.5 |
| 10000 | fragmented | heavy | 46.1 / 2.3 | 43.2 / 0.9 | 44.0 / 1.5 |
| 10000 | fragmented | retained | 5.6 / 2.4 | 3.7 / 0.8 | 4.8 / 2.1 |
| 20000 | clean | editor | 4.6 / 2.7 | 1.7 / 0.9 | 2.9 / 2.0 |
| 20000 | clean | fileview | 5.8 / 3.3 | 3.7 / 0.7 | 3.2 / 3.1 |
| 20000 | clean | layers | 22.2 / 2.6 | 19.6 / 0.8 | 22.6 / 1.7 |
| 20000 | clean | properties | 5.8 / 2.5 | 2.8 / 0.9 | 3.8 / 1.9 |
| 20000 | clean | heavy | 27.4 / 2.9 | 21.8 / 0.9 | 19.7 / 2.9 |
| 20000 | clean | retained | 4.6 / 3.2 | 1.9 / 1.0 | 2.4 / 2.1 |
| 20000 | fragmented | editor | 9.2 / 3.0 | 7.5 / 0.8 | 9.0 / 1.9 |
| 20000 | fragmented | fileview | 9.0 / 3.0 | 5.6 / 1.1 | 8.7 / 3.6 |
| 20000 | fragmented | layers | 100.1 / 3.8 | 99.0 / 1.2 | 89.4 / 2.2 |
| 20000 | fragmented | properties | 11.2 / 2.9 | 8.7 / 0.9 | 10.4 / 2.0 |
| 20000 | fragmented | heavy | 76.7 / 4.0 | 78.6 / 1.0 | 78.5 / 2.9 |
| 20000 | fragmented | retained | 8.4 / 3.7 | 6.1 / 0.9 | 7.1 / 2.7 |
| 40000 | clean | editor | 5.9 / 3.8 | 3.0 / 1.0 | 5.5 / 3.8 |
| 40000 | clean | fileview | 5.4 / 4.0 | 2.2 / 0.8 | 4.4 / 3.0 |
| 40000 | clean | layers | 35.5 / 3.8 | 31.4 / 1.0 | 33.6 / 3.8 |
| 40000 | clean | properties | 7.3 / 3.1 | 5.2 / 1.0 | 6.7 / 3.7 |
| 40000 | clean | heavy | 25.7 / 5.3 | 26.9 / 0.6 | 25.5 / 4.5 |
| 40000 | clean | retained | 7.7 / 3.8 | 3.3 / 1.3 | 4.2 / 2.6 |
| 40000 | fragmented | editor | 15.3 / 4.3 | 12.6 / 1.2 | 13.9 / 3.1 |
| 40000 | fragmented | fileview | 15.9 / 5.2 | 10.2 / 0.7 | 12.6 / 6.8 |
| 40000 | fragmented | layers | 171.1 / 4.4 | 160.4 / 1.1 | 156.0 / 3.8 |
| 40000 | fragmented | properties | 18.1 / 4.1 | 15.3 / 1.2 | 18.9 / 4.7 |
| 40000 | fragmented | heavy | 147.0 / 4.0 | 143.1 / 0.6 | 154.1 / 3.5 |
| 40000 | fragmented | retained | 15.1 / 5.0 | 12.0 / 0.8 | 13.2 / 2.8 |
