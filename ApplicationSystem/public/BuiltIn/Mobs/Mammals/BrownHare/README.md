# Brown Hare

Intended species: European brown hare (*Lepus europaeus*), with the Google Rabbit as its temporary visual representation.

Installed original resources are preserved in `Models/`:

- `Rabbit by Poly by Google - 9OBTRVYUSmt.glb`: runtime model; one textured rigid mesh, no skeleton or animation clips.
- `Mesh_Rabbit.obj`, `Mesh_Rabbit.mtl`, `Tex_Rabbit.png`: original source/fallback bundle, not simultaneously loaded by the mob runtime.
- `licenseNotice.md`: original user-supplied CC BY 3.0 attribution; retain it with every distribution of these resources.

The earlier M0 plan mentioned a Quaternius CC0 Bunny. The installed Google Rabbit replaces that plan and has different licensing; see the unchanged `Models/licenseNotice.md` for the actual attribution.

The runtime URL prefix is `/BuiltIn/Mobs/Mammals/BrownHare/Models/`, served by the existing public static mount. Preserve original filenames and relative references. Separate Textures/Animations directories remain reserved for independent assets; this GLB embeds its texture and is animated procedurally by M1.

See `docs/MobPhaseM1BrownHare.md` and `docs/BuiltInMobs.md` at the repository root. No automatic wildlife spawning is installed.

Phase C1's authoritative species assembly is `BrownHare.html` in this directory. Open it through the Virtual World Editor/Viewer as `/BuiltIn/Mobs/Mammals/BrownHare/BrownHare.html` for a single-creature scene. `Mobs/Registry.mjs` and the anatomy compatibility export now derive their data from that HTML. Existing saved `brown-hare` instances remain supported. See `docs/CreatureDesignerHTMLArchitecture.md` for custom HTML creatures, discovery, editing, persistence and resource boundaries.
