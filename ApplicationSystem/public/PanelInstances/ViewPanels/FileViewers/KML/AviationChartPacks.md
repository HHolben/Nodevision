# Aviation Chart Packs

The KML viewer can display a local aviation chart pack as a read-only Leaflet basemap under editable KML overlays.

Chart packs are loaded from the runtime Notebook through `/Notebook/...`. Use a Notebook-relative path in the KML View Type toolbar, for example:

```text
Samples/AviationChartPackExample/chart-pack.json
```

A minimal manifest looks like this:

```json
{
  "type": "nodevision-aviation-chart-pack",
  "version": 1,
  "name": "FAA Sectional Example",
  "chartType": "sectional",
  "effectiveDate": "2026-01-01",
  "expirationDate": "2026-12-31",
  "source": "FAA",
  "layers": [
    {
      "name": "Local Sectional",
      "format": "xyz",
      "tileUrl": "./tiles/{z}/{x}/{y}.png",
      "minZoom": 0,
      "maxZoom": 12,
      "bounds": [[24.0, -125.0], [50.0, -66.0]],
      "attribution": "FAA chart data"
    }
  ]
}
```

Suggested Notebook layout:

```text
Notebook/
`-- Samples/
    `-- AviationChartPackExample/
        |-- chart-pack.json
        `-- tiles/
            `-- 0/
                `-- 0/
                    `-- 0.png
```

Manual verification checklist:

1. Open an existing `.kml` file and confirm Street mode still renders KML features.
2. Switch to Globe and confirm the existing globe renderer still works.
3. Switch to Aviation with no chart pack and confirm the inline empty-state message appears.
4. Enter a valid Notebook-relative `chart-pack.json` path and click Apply.
5. Confirm local XYZ tiles render underneath placemarks, paths, and polygons.
6. Confirm KML editing tools still operate in Aviation mode.
7. Switch back to Street and confirm aviation chart tiles disappear.
8. Try invalid JSON, a wrong manifest type, and a missing `tileUrl`; each should show an in-view error.

This MVP only loads existing local XYZ tile folders. FAA GeoTIFF, geospatial PDF, and MBTiles conversion is intentionally future work.
