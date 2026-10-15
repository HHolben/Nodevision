# Aegean wilderness implementation

Current follow-up: [calendar-driven seasons and measured performance improvements](aegean-seasons-performance.md).

## Architecture investigation (before implementation)

The Virtual World editor uses `worldLoading.mjs` and the MetaWorld layer bridge for logical objects, selection, dirty state and snapshot history. `worldSave.mjs` persists declarative definitions in HTML/JSON and excludes generated chunk meshes. Build/Play permissions are shared through `WorldAuthoringPermissions.mjs`. Insert commands use `insertToolbar.json`, callback modules and floating inventory panels.

`VoxelWorldDefinition` validates a trusted generator and signed 32-bit seed. The current generator composes `VoxelBaseTerrain`, `PathTerrainField`, and bounded `FeatureField` providers. Spatial hashing/noise make queries independent of generation order. The 0.25 m grid uses minimum-corner coordinates, 32-cell chunks and a local height offset. `VoxelChunkManager` streams one chunk or occupancy column per update; no full volume is allocated. Analytic ground collision and local solid-voxel body checks share the generator. Existing bounded caves already have floor/ceiling-aware ground queries; unrestricted volumetric editing is not implemented.

Existing pine, oak, maple and orchard shapes are separate modules. `TreePlacement` selects candidates on a stable grid, with slope, water and biome rejection. `FeatureField` caches bounded neighborhoods. `VoxelMaterialIds` maps byte indices to the shared material catalog, JSON files and layered resolver. Water uses the existing liquid material, mesher and swimming volume. Aegean additions must append palette IDs without renumbering existing entries.

Physical paths already have editable control points, curves, ribbon collision, terrain grading and vegetation exclusion. They are independent persisted objects; they are not portals. The ordinary terrain tool edits authored terrain surfaces; generated voxel cells currently have no persisted edit layer. Regenerating a field preserves unrelated object definitions but can change their underlying ground. Protection therefore requires explicit stable terrain constraints rather than a claim that object persistence alone is sufficient.

Weather is owned by `WorldWeatherController`/`WeatherRuntime`, using existing clouds and atmosphere. Astronomy uses `AstronomyRuntime`, `WorldCalendar` and world-level observer/clock settings. There is no reason to add a clock or overwrite saved astronomy preferences. Existing media objects are the audio integration boundary. Seasonal plant rendering and environmental audio are not already provided by the vegetation generator.

Application modules and built-in material assets live under ApplicationSystem. Notebook content and private UserData are not implementation targets. Material resolution retains existing Notebook dependency overrides; no external asset package or runtime dependency is needed for the initial procedural implementation.

## Implementation sequence

1. Add versioned Aegean configuration, reusable species/biome registries and canonical materials.
2. Extend the existing base/feature pipeline with bounded coastal generation and ecological placement; retain legacy output when the preset is absent.
3. Expose actual supported parameters through the existing insertion dialog and validate deterministic save/load and compatibility.
4. Integrate persistent stations, protection, editing and environment behavior in separately verified increments. Unsupported controls must not imply functionality.

The completion section below records actual delivery and limitations; this plan is not a statement that all requested features are implemented.

## Delivered milestone — not completion of the full request

This implementation delivers the environmental generator foundation and editor integration. The full request is **not complete**. In particular, there is no 24-station memory palace, practice mode, painting UI, individual vegetation editor or environmental audio. No placeholder station objects or nonfunctional Insert tools are exposed.

### User workflow

Open **Insert → Voxel World**, choose **Aegean Greek Wilderness**, and configure seed, dimensions, elevation range, sea level, island/peninsula, geology, vegetation density and season. Optional checkboxes enable upland oak woodland and larger rocky mountains. Existing water, vegetation and bounded-cave switches remain available. Aegean worlds require at least 32 × 32 m horizontally, a 16 m vertical span and a sea level strictly inside the elevation limits. Legacy worlds retain their previous defaults and generator output.

The terrain inspector also offers vegetation-only regeneration, optionally restricted to local rectangular bounds and one biome. This appends a deterministic vegetation revision without changing the terrain seed. Bounds are in meters relative to the terrain minimum corner. Spatial ownership is by the 5 m vegetation placement cell, so a plant's footprint can extend outside a revision boundary. Existing path clearance and protected authored areas still take precedence. At most 64 revision scopes are stored; exceeding that limit reports an error without mutation. Replacing the procedural runtime uses existing undo/redo and chunk streaming; this is not an incremental remesh-only operation.

### Species and material schema

`Aegean/SpeciesData.mjs` contains 35 declarative species/community entries. Every entry stores scientific/common names, category, growth forms, dimensions in meters, geometry generator identity, material references, temperature/moisture/soil/elevation/slope/coastal preferences, drought tolerance, seasonal metadata, density, variation flags, collision intent, LOD metadata and dependencies. `PlantPlacement.mjs` consumes these definitions through the existing bounded feature provider. Actual placement checks temperature, moisture, soil, elevation, slope, coast exposure, water, finite bounds, coherent clustering, path clearance and protection.

Trees: olive, Turkish pine, Aleppo pine, cypress, Kermes oak, carob, juniper, holm oak, wild fig, strawberry tree, bay laurel and almond. Ground plants: Greek sage, wild thyme, pink and white rockrose, mastic, thorny burnet, rosemary, spurge, coastal juniper, evergreen maquis shrub, everlasting, asphodel, anemone, poppy, sea lavender, sea holly, seasonal wildflowers, dry grass, spring grass, sparse grass, tall grass, dune grass and rock tufts.

The existing broadleaf geometry sampler supplies crooked trunks, branches and asymmetric lobes. Aegean parameters add young/mature/ancient olive size variation, optional hollow-looking ancient trunks, narrow cypress, low juniper, windswept lean, and flattened irregular pine crowns. Flowers and ground plants currently use coarse noncolliding voxel clusters, not species-specific botanical flower meshes. Seeded variation changes dimensions, lobes, orientation, density and lean. Separate fruit geometry, growth simulation, real needle geometry, wind animation and distance-dependent plant LOD are not implemented. LOD and several ecological metadata fields are extension contracts, not implemented simulations.

Material JSON files use the existing canonical schema, catalog CSV, fallback rows, aliases and resolver. Notebook overrides retain their existing priority. Runtime byte indices are append-only; legacy terrain allocates its original 36 render materials. New Aegean materials are pooled per Aegean runtime. There are 84 new material definitions: 20 geological/ground materials, 36 tree wood/bark/foliage materials, 23 ground-plant foliage materials and 5 water materials. Existing marble, schist, basalt, limestone gravel and pine litter are reused.

New ground materials: PaleLimestone, WeatheredLimestone, FracturedLimestone, BrownSchist, Sandstone, Pumice, VolcanicAsh, DryMediterraneanSoil, TerraRossa, RockySoil, PaleGravel, BeachPebbles, FineBeachSand, CoarseBeachSand, CoastalSediment, StreambedGravel, DryMediterraneanGrass, LivingMediterraneanGrass, LeafLitter and SparseGroundCover. Each tree has `<Species>Wood`, `<Species>Bark` and `<Species>Foliage`; each ground plant has `<Species>Foliage`. Water additions are AegeanDeepWater, AegeanShallowWater, AegeanClearWater, AegeanFreshwater and AegeanStreamWater. Not every reusable library material is selected by the initial terrain sampler.

### Biomes and coastline

The ten reusable communities are phrygana, maquis, pine woodland, olive terraces, coastal cliffs, dunes/coves, seasonal stream valleys, optional upland oak, optional rocky mountains and volcanic terrain. The classifier computes continuous weights from height, slope, moisture, exposure, coast proximity, drainage and cultural-region noise. Plant selection samples those weights; ground materials use a coherent biome sample. Thus plant communities blend, though voxel ground-material edges remain discrete.

The coastal field uses normalized island/peninsula distance perturbed by seeded noise, shelves below sea level, interior ridges, local cliff steps, seasonal shallow channels and quantized terrace bands. Geology selects limestone, schist, basalt or mixed limestone/schist substrate. Cultural regions can produce olives and stepped terrain; dry-stone retaining walls and an intentional agricultural parcel layout are not yet generated. Small coves and headlands arise from the perturbed shoreline. There is no sediment transport, downhill drainage solver, erosion simulation or coastal topology guarantee.

Bounded coastal passages use the existing cavern column floor/ceiling contract and body collision. They are actual carved voxel voids, not heightfield overhang claims. Cave clearance is about 3 m where the terrain permits; this is not an unrestricted volumetric editor. Sea caves are not guaranteed for every seed/size. Cave-specific reachability has not been verified by a walking test.

Water stays in the existing transparent liquid renderer, canonical collision/swimming adapter and chunk mesher. Column depth and sandy versus rocky bed select shallow, clear or deep water; seasonal inland water selects the stream material. Adjacent water variants suppress internal faces. Colors are discrete palette approximations, not continuous optical depth scattering. The freshwater material is reusable but dedicated pond generation is not implemented.

### Season and environment integration

Season source now supports **Manual** and **World calendar**. Calendar mode follows the existing astronomy clock, timezone and observer hemisphere, with the authored manual season as fallback when astronomy is absent. Grass, flowers and seasonal channel water refresh through the existing chunk streamer; evergreen placement, terrain elevations, path grading and protected recipes remain stable. Old worlds retain manual behavior. No world observer, clock or weather preference is overwritten.

See [calendar seasons and performance](aegean-seasons-performance.md) for configuration, lifecycle, validation and measured results. Astronomy observer/date editing still uses the existing world declaration; no new astronomy properties panel, weather effects or environmental audio were added. No animal assets, behavior or audio were added.

### Persistence and regeneration safety

A procedural object retains the existing world schema and generator, plus `environment: {id:'aegean',version:1,...}`, optional `protectedRegions` and optional `vegetationRevisions`. Unknown Aegean versions fail validation explicitly instead of silently falling back to another landscape. Save/load continues to serialize definitions rather than mesh buffers. Future incompatible changes to the Aegean algorithms or built-in definitions must introduce a new environment version and keep the V1 implementation available.

Before Aegean regeneration, the authoring bridge captures bounded original terrain recipes beneath authored scene objects, including hidden objects. Recipes contain the original seed, environment and generation flags, plus local rectangular bounds with a 2 m margin. Existing protected recipes are retained. Querying a protected region uses that original recipe; procedural vegetation is excluded there. Authored object definitions and path objects remain separate. Existing path grading continues after terrain replacement. No full voxel snapshot is created. The implementation caps protection at 256 regions and rejects resizing/minimum-height changes that would invalidate protected coordinates.

Protection is conservative and rectangular, with potentially abrupt edges. It preserves ground beneath authored bounding boxes, not every manually imagined landmark or all surrounding scenery. It does not snapshot generated vegetation, preserve arbitrary sculpted cells, create editable protection brushes, or implement a general authored terrain delta layer. Large authored meshes can protect large areas. No memory stations exist yet to protect.

### Verification and performance

Commands:

```sh
node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs ApplicationSystem/public/MetaWorld/Aegean/*.test.mjs ApplicationSystem/public/MetaWorld/Paths/Paths.test.mjs ApplicationSystem/public/MetaWorld/Weather/Weather.test.mjs ApplicationSystem/public/MetaWorld/Astronomy/*.test.mjs ApplicationSystem/public/MetaWorld/SandboxWorldPlanner.test.mjs
node scripts/aegean-benchmark.mjs
NV_WORLD_BROWSER=aegean-world-browser.mjs xvfb-run -a node_modules/.bin/electron --no-sandbox --disable-dev-shm-usage scripts/procedural-world.electron.cjs
```

The current 20-file Node regression run passed, including calendar-season and greedy-mesher regressions. Aegean tests cover version rejection, all species/material references, finite deterministic shapes, configuration round-trip, wet/dry terrain, random-access/chunk agreement, optional geology/biomes, protected terrain recipe preservation and scoped vegetation regeneration. Existing legacy terrain/material/tree/water, path, weather, astronomy and Sandbox-planner tests passed. Existing test assumptions about the material list were narrowed to their legacy entries; fixed legacy terrain expectations were retained.

Electron checks passed for the original insertion workflow, Aegean insertion/material loading/rendering, scope regeneration and undo, HTML save/reopen, authored-object preservation, protected ground creation, deletion/teardown, and existing Sandbox Build/Play permissions/lifecycle. These are synthetic editor fixtures; they are not a full human walkthrough of every biome. Electron needed execution outside the filesystem sandbox to start Chromium. The harness emitted its existing missing external material-registry fallback and Electron warnings without assertion failures.

CPU measurements are in `aegean-performance.json`; rendered measurements are in `aegean-render-performance.json`. The CPU fixture samples 16 central surface chunks at low/high density and reports generation, meshing, 10,000 point samples, bounded feature count, approximate geometry bytes, heap delta and declarative save/load. The browser fixture reports 100 streamed/rendered frames, mean/p95 frame and streaming update durations, resident chunks and triangles using SwiftShader. Results are machine-dependent and do not establish hardware GPU performance or a 60 FPS guarantee. Heap delta includes temporary allocations and garbage collection; feature count is not a GPU instance count.

Generation remains lazy and chunked on the existing main-thread scheduler, with pooled materials and existing frustum culling. No world-sized volume is built. Individual chunks can exceed a 16 ms frame budget. Worker generation/meshing, measured time-budget scheduling, instancing, plant LOD and wider dense-biome profiling remain necessary performance work.

### Extending the system

Add a species entry with stable identity and material dependencies, append any new palette IDs, register canonical JSON material definitions, and reference the species by weighted ID in biome definitions. Do not renumber existing palette IDs or change an established environment version's output. Add a new version for incompatible generator changes. The 8-bit palette must remain below 256 entries. Custom material overrides use the existing layered dependency resolver; arbitrary external species-library loading is not yet implemented.

Add or change biome preference/weight logic in a new environment version and test the weighted transitions, finite terrain bounds, material resolution, save/load and protection. New terrain representations must share collision queries and existing path constraints rather than adding a separate renderer-only landscape.

### Remaining milestones and recommended order

1. Implement persistent 24-station objects, actual distinctive landmarks, ordered path planning, note/file associations, navigation and practice controls. No memory-palace functionality has been delivered in this milestone.
2. Add a validated authored terrain/vegetation edit layer, brushes, explicit protected vegetation and individual species/growth-form selection in the editor.
3. Add observer/time editing controls without replacing saved world preferences. Calendar-driven seasonal appearance is now implemented. Extend existing weather/media systems for rain, haze and optional non-animal ambient audio.
4. Improve botanical meshes, ecological suitability, cultural terrace walls, hydrological drainage, coves and continuous depth rendering; verify walking access to caves and all stations.
5. Move expensive chunk work off the UI thread and add measured plant LOD/instancing before claiming large dense worlds meet frame budgets.

### Files

The complete file inventory is in [aegean-files.txt](aegean-files.txt). Added native modules live under `ApplicationSystem/public/MetaWorld/Aegean/`: configuration validation, species/material data, biome weights, coastal sampling, plant placement, protected recipes, vegetation revision logic/controls and tests. The 84 new JSON assets live in the existing `Materials/Solids` and `Materials/Liquids` libraries.

Changed integration modules are the canonical material catalog/CSV; voxel authoring/validation/dialog/properties; base terrain, feature composition, palette, liquid face suppression and runtime allocation; and the terrain authoring bridge. Two existing material tests retain their legacy expectations with explicit legacy palette bounds. New CPU/Electron fixtures and a small existing runner extension provide measurements. No Notebook, private UserData, package dependencies or programming standards were changed.

The initial milestone audit is in [aegean-standards.json](aegean-standards.json). The calendar/performance follow-up audit is in [aegean-season-standards.json](aegean-season-standards.json): new modules pass; the existing oversized `initScene.mjs` receives one changed integration line. `git diff --check` passes.
