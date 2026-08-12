<!-- Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/KML/AviationChartPacks.md -->
<!-- This document explains how local aviation chart packs are referenced and displayed as KML viewer basemaps. -->
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

## FAA Sectional GeoTIFF Storage

Server Settings now includes **Maps / Aviation -> Sectional Maps Directory**. The value is stored as a Notebook-relative path, for example:

```text
Library/Collection3_Atlases/Section2_SectionalMaps
```

Notebook-relative storage keeps the map collection portable with the Notebook. Nodevision resolves the final filesystem location through the active Notebook root and rejects traversal or paths outside the Notebook.

The **Update Sectional Maps** action is explicit and user-triggered. It checks the official FAA VFR Raster Charts page, discovers the current Sectional GeoTIFF ZIP links hosted by `aeronav.faa.gov`, downloads into a hidden staging directory, and publishes completed ZIP files only after the update succeeds. Existing local maps remain usable offline and are not deleted when an update fails.

The same update operation is exposed to the Nodevision Console as **Update Sectional Maps** and to Sessions as `sectionals.update`. Both call the server update job; they do not duplicate FAA download logic.

Nodevision writes a small metadata file beside the downloaded packages:

```text
.nodevision-sectionals.json
```

That file records the FAA edition, update time, and managed chart filenames. The FAA ZIP packages themselves are left untouched and remain ordinary user-owned Notebook files.

Other modules should use the Sectional Maps settings service rather than hard-coding a path. The current implementation stores and updates GeoTIFF packages for future KML/Terrain/Aviation consumption; it does not yet render FAA GeoTIFFs directly as map tiles.
