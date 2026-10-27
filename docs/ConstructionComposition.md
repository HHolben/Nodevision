# Construction composition — Phase 5

Constructions reference independent `.construction.json` and GOX files. World HTML retains instance identity, scene placement, visibility, activation and the definition reference. Geometry and terrain operators are separate sources; derived overall bounds never excavate terrain.

The only accepted construction schema is version 2. Experimental version 1 definitions are intentionally rejected. See `ApplicationSystem/public/MetaWorld/Constructions/construction-v2.schema.json`.

```json
{
  "schema": "nodevision-construction",
  "version": 2,
  "id": "house",
  "name": "House",
  "voxelSize": 0.25,
  "gridOrigin": [0, 0, 0],
  "position": [0, 0, 0],
  "terrainVolumes": [
    {"id":"room", "type":"TerrainCut", "shape":"box", "position":[0,0,0], "size":[20,12,20], "operation":"subtract", "active":true},
    {"id":"cellar", "type":"TerrainCut", "shape":"box", "position":[5,-8,5], "size":[10,8,10], "operation":"subtract", "active":true}
  ],
  "geometry": {"source":"./House.gox", "position":[0,0,0]}
}
```

Positions and dimensions use integer voxel units, Y-up. Grid origins use meters. Boxes use half-open intervals. Volumes have unique stable identities, positive dimensions, bounded endpoints and explicit activation. A construction may have zero volumes or up to 256; overlapping volumes within it are permitted. Geometry can extend above or beyond every cut. GOX uses its established Z-up mapping `(x,y,z) → (x,-z-1,y)`.

The scene hierarchy contains `/World/Constructions/c_<instance>/TerrainVolumes/cut_<volume>` typed `TerrainCut` children and a distinct `/Geometry` referenced asset. Renaming or transforming does not change identities. No USD serialization is implemented.

Composition evaluates procedural terrain, existing path operations, the union of active cuts, referenced geometry, focused construction opinions, and ordinary temporary opinions. Render sampling, collision and material queries share that composition. Volumes are stored as boxes rather than dense deletion records. Horizontal chunk candidate caches filter relevant cuts. Changing volumes invalidates changed previous and proposed regions with one-cell boundary neighbors. Resident chunks have an axis index for regional invalidation; unrelated resident chunks remain available.

Different constructions with intersecting active cuts are rejected during authoring/publication. Conflicting loaded instances are disabled deterministically until corrected; load order never chooses a winner. `visible:false` hides geometry while retaining physical occupancy and excavation; `active:false` removes both. Same-owner cut overlap is a union. Coincident geometry retains stable instance ordering.

Capture initially authors one cut for the selected region and retains all intended occupied cells. Construction editing can subsequently change or remove that cut, add others, and extend geometry independently. Geometry/terrain intersections outside intentional cuts are highlighted and block construction publication. They do not create additional cuts.

Insertion supports an initial numeric box and optional GOX reference. Focused editing uses the native inspector, numerical volume fields, selectable boxes and face handles. See [Construction editing](ConstructionEditing.md) for controls, persistence and limits.
