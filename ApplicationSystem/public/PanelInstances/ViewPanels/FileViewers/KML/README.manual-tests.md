# KML Editor Manual Tests

Run these in Nodevision with `.kml` files opened in File View or Graphical Editing.

1. Open a KML with one Point Placemark; confirm it renders, fits bounds, and selecting the marker highlights the tree row and properties.
2. Open a KML with Document/Folder nesting and multiple Placemarks; confirm document order appears in the layer tree.
3. Open a KML with a LineString; confirm the path renders, selects, and fits.
4. Open a KML with a Polygon; confirm the polygon renders, selects, and fits.
5. Toggle feature visibility from the layer tree; confirm the map layer hides/shows without removing XML.
6. Select a feature from the map and from the tree; confirm the map pans/flys and properties update.
7. Add Placemark, Save KML, reload the file, and confirm the point persists.
8. Draw Path, Save KML, reload the file, and confirm the path persists.
9. Draw Polygon, Save KML, reload the file, and confirm the polygon persists.
10. Edit name and description, Save KML, reload the file, and confirm they persist.
11. Delete a feature, Save KML, reload the file, and confirm it is gone.
12. Open a KML containing unsupported tags, Save KML after a small supported edit, and confirm unsupported tags remain in the XML.

Unsupported in Phase 1: KMZ, NetworkLink refresh, gx:Tour, time sliders, terrain/3D buildings, altitude rendering, MultiGeometry editing, GroundOverlay, PhotoOverlay, and Cesium globe mode.
