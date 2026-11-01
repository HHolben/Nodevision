# Greek Alphabet Memory Palace — Phase 1 implementation report

This phase adds reusable, opt-in educational associations to Nodevision's existing HTML editor and world editor. The supplied document remains the authoritative text. No mnemonic scenes, scientific corrections, biographies, gameplay state, or replacement terrain engine were generated.

## Architecture and persistence

Educational records live in an inert body-level JSON-LD block:

```html
<script type="application/ld+json" data-nv-education="1">
{
  "@context": {"@vocab":"https://schema.org/", "nv":"urn:nodevision:education:"},
  "@type":"Dataset",
  "nv:version":1,
  "@graph":[{
    "@type":"DefinedTerm",
    "@id":"#nv-record-greek-alpha",
    "identifier":"greek-alpha",
    "additionalType":"alphabet-letter",
    "name":"Alpha",
    "nv:htmlAnchors":["greek-alpha"],
    "nv:relatedIds":[]
  }]
}
</script>
```

Existing elements receive an ordinary `id` if they lack one and a space-separated `data-nv-semantic-ids` attribute. Existing IDs are retained. A record can reference multiple HTML elements; an element can reference multiple records. Legacy singular `data-nv-semantic-id` is readable. Metadata text escapes `<` to keep JSON safely inside its inert script. Ordinary HTML text, structure, hyperlinks, bibliography, existing editing attributes and Unicode remain intact.

IDs become persistent when first assigned; subsequent text edits do not recompute them. The explicit alphabet-table action uses the source name for an initial readable letter ID, then reuses that identity. Each nonempty STEM list entry receives an independent UUID-backed record. Blank entries remain blank. The supplied fixture produces **24 letters and 14 STEM records**. Pronunciation text is copied with its scheme marked `unspecified`; concepts are not automatically classified as constants, variables, or physical quantities.

Records support optional related IDs, Notebook `url`, bibliography `citation` references, and arbitrary additional fields. Unknown fields round-trip. Invalid JSON, duplicate identities and unsupported schema versions produce diagnostics rather than migrations or destructive repairs. Deleting a record retains unresolved element/world references so that validation and undo remain useful. Removing an association leaves the underlying content or object intact.

World objects own the other side of the relationship:

```json
{"id":"alpha-scene", "educationalLinks":[
  {"document":"../Education/GreekAlphabet.html", "recordId":"greek-alpha"}
]}
```

The HTML document owns educational facts; scene definitions own object associations. This avoids maintaining two contradictory copies of world-object lists. Reverse lookups are derived from the loaded world's stable object IDs. An educational record needs no world object. Multiple records may share an object, and one record may bind several objects, imported model groups or construction instances.

HTML edits use existing HTML transactions and DOM history. World association edits use existing session transactions; they do not rebuild geometry. The normal world serializer preserves links, and replacement paths for physical paths, text, terrain and constructions retain them. Linked individual voxels/terrain blocks are excluded from anonymous save-time compaction, preserving their identities. Lights retain IDs and links. Terrain representation changes leave imported GOX/STL/glTF/GLB behavior unchanged.

The HTML source projection permits only the specifically marked inert JSON-LD script to participate directly in body history. Existing executable-script protections remain in place. The metadata MIME type differs from embedded-world `application/json`, avoiding the world's existing script discovery fallback.

## Native editor controls

Open **Edit → Educational Associations**, or use **Educational Associations** in the existing world object inspector. This is an ordinary Nodevision InfoPanel with inherited styling, selection and cleanup conventions.

The panel supports:

- Choose an open HTML document and inspect stable record identities.
- Select an existing table row or STEM list entry; create a record or assign an existing one.
- Explicitly create records from the six-column alphabet table.
- Edit the name, user-defined classification, related IDs, Notebook link and source references.
- Remove an HTML association or delete a record while retaining unresolved references.
- Select a world object, assign/remove records, focus a linked object, or navigate to its document entry.
- Create a normal world portal from a record's existing Notebook link. The destination is checked before creation; no linked page is copied.
- Associate an existing physical path's start/end endpoint with a record.
- Validate references in open documents; browse existing bibliography anchors/source links.

Source citations reuse ordinary bibliography/footnote anchors and links. No competing citation database is introduced. Portal creation uses the existing world bridge and native `/Notebook/...` application route, while the record retains its original relative hyperlink. Application routes contain no machine-specific filesystem paths.

Document and world registry events update the panel. No semantic selection triggers a toolbar rebuild, no per-frame DOM scans are added, and cached record parsing is unaffected by pointer movement. Panel subscriptions and document observers are released on cleanup.

## Alphabet-trail compatibility

Existing physical paths have persistent IDs and control points, including start and end points. Geometric snapping/joining currently does **not** constitute a persistent junction/connectivity graph.

`RouteReferences.mjs` adds references of the form:

```json
{"worldDocument":"../Worlds/Pelion.html", "pathId":"alphabet-trail", "endpoint":"end"}
```

These live in a record's optional `nv:routeAnchors`. Endpoint position is resolved from the current path definition, including its translation; coordinates are not the identity. Supply the source-document and loaded-world paths to the resolver when validating cross-document endpoint references. The world-document reference distinguishes equal path IDs in different worlds. Missing paths resolve to null. Junction identities, connectivity, route planning, NPC movement and learning-session state remain future work.

## Supplied geographic fixtures

Actual read-only location: `Notebook/test-fixtures/GreekAlphabet/`, with TIFFs under `Terrain/`.

| Property | Topographic TIFF | Raw DEM TIFF |
|---|---|---|
| Filename | `2026-10-28-00_00_2026-10-28-23_59_DEM_COPERNICUS_90_Topographic.tiff` | `2026-10-31-00_00_2026-10-31-23_59_DEM_COPERNICUS_90_DEM_(Raw).tiff` |
| File bytes | 3,278,622 | 1,315,230 |
| Dimensions | 707 × 1250 | 614 × 699 |
| Bands / samples | 3 × float32, RGB photometric interpretation | 1 × float32, grayscale photometric interpretation |
| CRS | EPSG:4326, WGS84 | EPSG:4326, WGS84 |
| Bounds W,S,E,N | 22.996669, 39.062198, 23.372920, 39.576348 | 23.038180, 39.390376, 23.043695, 39.395230 |
| Pixel step longitude, latitude | +0.000532179632°, −0.000411320000° | +0.000008982085°, −0.000006944206° |
| Raster placement | PixelIsArea, north-up | PixelIsArea, north-up |
| Compression / storage | Deflate (32946), strips 707 × 8 | Deflate (32946), strips 614 × 8 |
| NoData | Not encoded | Not encoded |
| Vertical units / datum | Not encoded | Not encoded |
| Direct terrain import | Rejected: three-band visualization | Accepted: single-band numeric elevation candidate |

The raw raster's complete extent is inside the topographic extent. The topographic image covers the [GeoNames Pílion reference point, 39.40000°N, 23.03333°E](https://www.geonames.org/255302/pilion.html). The raw raster excludes that point and covers only a small nearby area; it is insufficient for a complete mountain-scale memory palace. A requested northward crop `[23.035,39.43,23.055,39.45]` correctly fails with a no-overlap diagnostic.

The raw export's very fine grid spacing does not establish comparable survey accuracy. [Copernicus documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM.html) describes COPERNICUS_90 as a 90-meter product and identifies EGM2008 for Copernicus DEMs. Treat meters/EGM2008 as a provenance-dependent interpretation of the filename, not metadata verified in these exported TIFFs. The current importer assumes elevation meters and performs no vertical-datum conversion.

Production range access was exercised through `openRangeRaster`, `rasterMetadata`, `planCrop` and `importCrop`, using read-only local file-backed HTTP-range responses. Metadata consumed **65,536 bytes per TIFF**, with no raster decoding. A valid center crop from the raw file decoded **18 × 19 samples**, retained values **1114.999755859375–1120.5537109375**, and consumed **196,608 bytes total** including metadata. No full-raster read or raster write was performed.

Reproduce metadata/crop inspection:

```sh
node scripts/inspect-memory-palace-fixtures.mjs
# Or supply another terrain directory as the first argument.
```

The script writes its report to stdout. It introduces no dependency and does not write to Notebook.

Neither file is land-cover data. The RGB visualization is not converted into biome categories. Existing independent land-cover import, CRS mapping, overlap checks and explicit fallback biome remain available; actual Pelion biome data is still needed.

## Resource configuration and terrain reuse

In the existing **Settings → Resources** panel, set **Terrain / Elevation Data** (`maps.terrain`) to:

```text
Library/Collection3_Atlases/Section1_TerrainMaps
```

This is relative to the active Notebook, not to a username or operating-system home directory. The geographic importer's existing Browse Notebook control now starts in this configured directory. Configuration was not changed on the user's behalf.

Use the existing geographic voxel-world dialog to select the raw TIFF, choose a crop within its actual coverage, preview, and place/regenerate terrain. Existing georeferencing, origin mapping, vertical scaling, bounded byte/window budgets, incremental chunks, paths, construction cuts and voxel/polygonal representations are reused. No arbitrary 512-meter limit was added. Current geographic support remains WGS84 EPSG:4326 and UTM EPSG:32634, with the existing 18–24°E crop restriction. Larger appropriate raw elevation coverage is needed for the full proposed Pelion world.

## User walkthrough

1. Open a working copy of `GreekAlphabet.html` in the graphical HTML editor. Open its embedded world through Nodevision's existing Virtual World/Build workflow, and author a mnemonic object normally.
2. Select Alpha's table row or a STEM list entry. Open **Edit → Educational Associations**.
3. Choose **Create Records from Alphabet Table** for explicit batch annotation, or choose kind `alphabet-letter`, identity `greek-alpha`, name `Alpha`, and **Create Record** for a single row. Existing STEM list entries can be assigned independent records.
4. Choose `greek-alpha` and the desired world object, then **Link to World Object**. Repeat for additional mnemonic objects or other records.
5. Use **Go to Linked Object**. From the world inspector, reopen the panel, select the object and use **Go to Document Entry**. Removing either association leaves the object and educational text intact.
6. For a STEM portal, select the concept with its existing Notebook link and choose **Create Portal Using Notebook Link**. Broken/unresolvable destinations are reported. Relative links in the shallow representative fixture may not resolve because the primary Notebook's directory hierarchy is absent; do not rewrite them to match the VM.
7. Configure `maps.terrain` as described above. Select the raw DEM and a crop within its coverage; the topographic TIFF cannot provide heights.
8. Save the HTML document and use the normal world save operation for scene changes. Close/reopen and inspect the same record/object link. HTML and world undo/redo use their respective existing histories.

## Implementation files

New reusable modules are under `ApplicationSystem/public/Education/`: `Records`, `HtmlController`, `WorldLinks`, `Navigation`, `PanelNavigation`, `Resources`, `RouteReferences`, plus focused tests.

Editor integration extends `InitializeHtmlEditorTools.mjs`, `HtmlSourceDocument.mjs`, `objectInspector.mjs`, `WorldAuthoringPermissions.mjs`, `editToolbar.json`, the new `edit/educationalAssociations.mjs` callback, and the new `InfoPanels/EducationalLinksPanel.mjs`.

Persistence changes extend `worldLoading.mjs`, `worldSave.mjs`, `Paths/PathDefinition.mjs`, `Paths/PathAuthoringBridge.mjs`, `ProceduralVoxelWorld/VoxelWorldAuthoringBridge.mjs`, `Text/TextAuthoringBridge.mjs`, and `Constructions/Authoring.mjs`.

Geographic changes add `Geographic/InspectRaster.mjs` and its tests, extend `ImportControls.mjs` and the existing Notebook picker's optional starting directory, and add `scripts/inspect-memory-palace-fixtures.mjs`.

Browser coverage is in `scripts/education-browser.mjs`, with a public synthetic fallback and a read-only fixture route in the existing browser runner. The existing terrain-map browser test additionally checks semantic links on imported models. The HTML attention unit test's DOM mock now implements the attribute methods already required by the active-tool registry; production attention behavior was not changed.

## Validation and remaining limits

Final targeted runs passed:

| Command / suite | Result |
|---|---|
| `node scripts/run-footnotes-browser.mjs education-browser.mjs` | 59 checks, supplied read-only fixture, 38 source-derived records |
| `node scripts/run-footnotes-browser.mjs education-browser.mjs --synthetic` | 59 checks, public synthetic fallback, 27 records |
| `node scripts/run-footnotes-browser.mjs` | 54 native HTML/footnote checks |
| `python3 scripts/test-terrain-maps-browser.py` | Passed terrain, collision, model-link, representation, persistence and history checks |
| `python3 scripts/test-construction-editing-browser.py` | 94 native construction-editing checks |
| Focused Node regression command below | 19 test files passed, zero failures |
| `node scripts/inspect-memory-palace-fixtures.mjs` | Both real TIFFs inspected; bounded raw center crop imported; outside-coverage crop correctly rejected |
| `git diff --check` | Passed |

The focused Node command was:

```sh
node --loader ./scripts/html-test-loader.mjs --test \
  ApplicationSystem/public/Education/Education.test.mjs \
  ApplicationSystem/public/MetaWorld/Geographic/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Paths/*.test.mjs \
  ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldAuthoring.test.mjs \
  ApplicationSystem/public/MetaWorld/Constructions/Constructions.test.mjs \
  ApplicationSystem/public/utils/notebookPath.test.mjs \
  ApplicationSystem/public/LinkPortalParity.test.mjs \
  ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/Html*.test.mjs
```

New focused coverage includes eight educational model/relationship tests and three raster inspection/error tests. Browser assertions cover normalized body-markup preservation, Unicode, hyperlinks, bibliography, unchanged editable-element count, explicit batch annotation, missing references, unknown fields, metadata version/head errors, multiple relationships, HTML/world history, real panel-factory initialization, both navigation controls, portal creation, path edits, terrain regeneration, linked-voxel compaction protection, light identity, full save/reopen, and duplicate-view cleanup. All application writes in the education browser fixture are intercepted in memory.

Performance assertions verify no additional parsing across 1,000 pointer events/repeated record reads, unchanged mesh identity for association-only edits, and no rebuilding of HTML record controls when world associations change. A local footnote regression run measured 30 edits in a 60,000-word/300-note document at 30.9 ms with zero reconciliation scans; this is a local observation, not a general performance guarantee. Terrain tests retained five renderer geometries across repeated representation switches and preserved imported asset identities and source-fetch counts.

The initial attention-test failure was a missing DOM attribute method in its fake element; the mock was updated to the existing runtime contract and the final suite passed. No known failures remain in these targeted runs. The entire repository suite and full desktop UI were not run.

Implemented limitations:

- The editable JSON-LD block must be in the HTML body. An existing head-level educational block is preserved and diagnosed; editing is blocked until explicitly moved in Source Editor. Unsupported versions and malformed blocks are never automatically migrated.
- A world must be loaded to locate its objects. Missing/closed documents and unresolved records receive diagnostics; there is no repository-wide semantic search service.
- IDs remain stable through text/geometry edits. Moving or renaming a document file can still require repairing relative references, as with other Notebook links; automatic cross-file refactoring is not included.
- The record stores source text at annotation time. Later prose edits do not silently reinterpret scientific facts or regenerate record fields.
- Arbitrary record fields are preserved and editable through the controller/source editor; the initial panel exposes common fields rather than a full ontology editor.
- Real fixture navigation/save uses the native editor and world loader with writes intercepted in memory. Full desktop interaction, closed-document tab creation, and every imported construction refresh combination have not been exhaustively exercised.
- No separate citation system, complete junction graph, NPC, archery targets, lesson engine, scoring, adaptive learning, or terrain assets were created. These should reference the stable educational and route identities while keeping session state separate.
