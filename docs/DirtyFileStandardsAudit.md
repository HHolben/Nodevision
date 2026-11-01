# Dirty-file programming standards audit

Audit date: November 1, 2026. Authority: [NodevisionProgrammingStandards.md](../NodevisionProgrammingStandards.md). The standards document was not modified.

**Result: the dirty file set is not fully compliant.** Required file headers were corrected, but file-length, readability, section-comment, and UI-customization issues remain.

## Scope and method

The audit covered all 123 modified and untracked, non-ignored files present at its start. Of these, 102 are under ApplicationSystem: 99 native JavaScript modules, two JSON files, and one CSV file. The other 21 files are documentation, development scripts, and synthetic fixtures. The audit report itself was added afterward.

The ApplicationSystem header and length rules apply to its 99 JavaScript files. JSON and CSV do not support the required comments and are explicitly exempt from the length limit. No dirty vendor files were identified. Documentation and fixtures outside ApplicationSystem are listed below without applying application-only header or length requirements.

JavaScript was tokenized with Acorn. A code line is a nonblank physical line intersecting a JavaScript token; comment-only lines are excluded. This preserves strings and template literals as code instead of incorrectly treating embedded text as JavaScript comments. The standard requires fewer than 200 such lines, so the maximum passing count is 199.

## Initial audit corrections

- Corrected missing or displaced path/purpose headers in 45 application files. Existing import order and executable content were preserved.
- All 99 applicable application files now have their exact Nodevision-rooted path on the first line and a complete purpose description on the second line. New descriptions use full sentences on one physical line.
- Parsed all 112 dirty JavaScript files and compared their executable-token fingerprints before and after these edits: all parsed, and every fingerprint was identical.
- Parsed both JSON files, the CSV file, and the Python script successfully. `git diff --check` passed.
- Only comments were changed during the initial audit, so behavioral regression suites were not rerun. No Notebook content, settings, dependency manifests, or third-party code was changed.

## Save dispatcher remediation

The follow-up refactor resolves the `saveFile.mjs` length violation by extracting editor context, ownership guards, inline-image finalization, and SVG persistence into cohesive helpers. Save priority, path checks, failure handling, and the existing global entry points are retained. All changed and added JavaScript files have the required path/purpose headers and descriptive section comments.

| File under `public/ToolbarCallbacks/file/` | Code lines |
|---|---:|
| `saveFile.mjs` | 184 |
| `saveFile/EditorContext.mjs` | 90 |
| `saveFile/SvgSave.mjs` | 34 |
| `saveFile/SaveDispatch.test.mjs` | 141 |
| `saveFile/SaveFailure.test.mjs` | 92 |
| `saveFile/SaveTestEnvironment.mjs` | 36 |

The 16 save-dispatch regression tests pass against both the pre-refactor working-tree implementation and the refactored implementation. Existing HTML save-safety and SVG request-recovery tests also pass. Acorn parsing, token-based length checks, and `git diff --check` pass. Tests stub persistence or use temporary files; Notebook content is unchanged. The five new helper/test files are additions to the initial 123-file audit scope. Seven previously identified oversized files remain.

## Remaining file-length violations

All seven of these modules already exceeded the limit in HEAD. They remain subject to the standard when modified; their existing size does not establish an exemption.

| File | Current code lines | HEAD code lines | Limit |
|---|---:|---:|---:|
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs) | 3607 | 3596 | 199 |
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs) | 1200 | 1197 | 199 |
| [ApplicationSystem/public/ToolbarCallbacks/insertCallbacks.js](../ApplicationSystem/public/ToolbarCallbacks/insertCallbacks.js) | 1027 | 1073 | 199 |
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs) | 1006 | 1001 | 199 |
| [ApplicationSystem/public/panels/panelTabs.mjs](../ApplicationSystem/public/panels/panelTabs.mjs) | 499 | 498 | 199 |
| [ApplicationSystem/routes/api/fileSaveRoutes.js](../ApplicationSystem/routes/api/fileSaveRoutes.js) | 257 | 254 | 199 |
| [ApplicationSystem/public/TemplateSystem/TemplateFormDialog.mjs](../ApplicationSystem/public/TemplateSystem/TemplateFormDialog.mjs) | 239 | 238 | 199 |

These files require deliberate extraction of cohesive responsibilities into shared modules. In particular, world loading, object inspection, world serialization, toolbar insertion behavior, and tab management contain substantial interacting state. The header-only corrections do not resolve these architectural violations.

## Readability and section comments

Principle 6 requires readable, modifiable modules, and the commenting section requires frequent descriptive section comments. The terrain-map and education implementations contain densely packed multi-statement functions with few internal sections. For example, `TerrainMaps/Editor/Document.mjs` packs document editing into 38 code lines, and `EducationalLinksPanel.mjs` packs panel construction, commands, navigation, selection, and subscriptions into 45 code lines. Their small physical counts alone do not establish readability compliance.

32 application files contain at least one code line longer than 400 characters. **400 characters is an audit indicator, not a column limit stated by the standards.** The following list identifies review locations; long declarative lists should be distinguished from tightly packed control flow.

| File | Longest code line | Characters |
|---|---:|---:|
| [ApplicationSystem/public/CursorFamilies/providers/TerrainMapCursorProvider.mjs](../ApplicationSystem/public/CursorFamilies/providers/TerrainMapCursorProvider.mjs) | 4 | 434 |
| [ApplicationSystem/public/Education/Education.test.mjs](../ApplicationSystem/public/Education/Education.test.mjs) | 10 | 1007 |
| [ApplicationSystem/public/Education/HtmlController.mjs](../ApplicationSystem/public/Education/HtmlController.mjs) | 16 | 1340 |
| [ApplicationSystem/public/Education/Records.mjs](../ApplicationSystem/public/Education/Records.mjs) | 14 | 949 |
| [ApplicationSystem/public/Education/RouteReferences.mjs](../ApplicationSystem/public/Education/RouteReferences.mjs) | 6 | 573 |
| [ApplicationSystem/public/Education/WorldLinks.mjs](../ApplicationSystem/public/Education/WorldLinks.mjs) | 17 | 552 |
| [ApplicationSystem/public/MetaWorld/Constructions/Authoring.mjs](../ApplicationSystem/public/MetaWorld/Constructions/Authoring.mjs) | 67 | 577 |
| [ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.mjs](../ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.mjs) | 7 | 546 |
| [ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.test.mjs](../ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.test.mjs) | 10 | 634 |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs) | 126 | 497 |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs) | 38 | 582 |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelBaseTerrain.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelBaseTerrain.mjs) | 105 | 1097 |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDialog.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDialog.mjs) | 50 | 729 |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldProperties.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldProperties.mjs) | 22 | 481 |
| [ApplicationSystem/public/MetaWorld/SessionVoxels/Authoring.mjs](../ApplicationSystem/public/MetaWorld/SessionVoxels/Authoring.mjs) | 11 | 775 |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Binding.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Binding.mjs) | 22 | 781 |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Canvas.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Canvas.mjs) | 25 | 983 |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Create.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Create.mjs) | 7 | 1363 |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.mjs) | 34 | 1427 |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.test.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.test.mjs) | 17 | 1451 |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Open.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Open.mjs) | 4 | 489 |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Panel.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Panel.mjs) | 30 | 1684 |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Persistence.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Persistence.mjs) | 8 | 481 |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Format.test.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Format.test.mjs) | 14 | 1066 |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Integration.test.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Integration.test.mjs) | 27 | 1102 |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Reader.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Reader.mjs) | 42 | 644 |
| [ApplicationSystem/public/MetaWorld/WorldAuthoringPermissions.mjs](../ApplicationSystem/public/MetaWorld/WorldAuthoringPermissions.mjs) | 26 | 461 |
| [ApplicationSystem/public/PanelInstances/InfoPanels/EducationalLinksPanel.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/EducationalLinksPanel.mjs) | 45 | 1138 |
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs) | 498 | 522 |
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs) | 3779 | 590 |
| [ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.mjs](../ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.mjs) | 16 | 651 |
| [ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.test.mjs](../ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.test.mjs) | 5 | 1924 |

Format dense control flow into readable statements, introduce meaningful section boundaries, and then recount file length. Extract reusable components wherever the resulting module reaches 200 code lines. Particularly useful boundaries are record persistence versus HTML selection, association commands versus panel rendering, and map document operations versus pointer interaction and rendering.

## UI customization gaps

The aesthetics section requires user-customizable colors, typography, and panel dimensions. These application UI values remain hard-coded without theme variables or corresponding customization parameters at their use sites:

- `MetaWorld/TerrainMaps/Editor/Canvas.mjs`: orange brush outline (`#ff9f20`), viewport background (`#34383e`), and selection/grid rendering colors.
- `PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs`: dark preview background (`rgba(8,12,20,0.95)`) and several fixed border colors.
- `PanelInstances/InfoPanels/SVGLayersPanel.mjs`: fixed error color (`#b00020`) and provider-selector font size.

Move application presentation defaults into the shared theme/customization system and validate both light and dark configurations. Authored document formatting and terrain-data palettes are separate concerns; their numeric or color values should not be indiscriminately replaced with UI theme values.

## Architectural observations

The dirty features generally reuse native document history, panel lifecycles, toolbar routing, and world serialization. Educational metadata is inert JSON-LD attached to ordinary HTML elements; reference content remains ordinary HTML. Terrain assets stay external to the HTML world definition. These choices support the HTML-first, offline, and reusable-module principles.

This audit does not certify every runtime behavior covered by the broader design principles. In particular, complete external-resource placement/layering support and independent deployment behavior require feature-specific integration checks beyond header, size, and syntax validation. No new dependency or private-data files are part of this dirty set.

## Complete audited inventory

“Header OK” applies to the path and second-line description after correction. “Size OK” addresses only the physical-line rule; readability and UI issues above remain independent.

| File | Scope | Code lines | Header | Size |
|---|---|---:|---|---|
| [ApplicationSystem/public/CursorFamilies/providers/TerrainMapCursorProvider.mjs](../ApplicationSystem/public/CursorFamilies/providers/TerrainMapCursorProvider.mjs) | Application | 2 | OK | OK |
| [ApplicationSystem/public/Education/Education.test.mjs](../ApplicationSystem/public/Education/Education.test.mjs) | Application | 13 | OK | OK |
| [ApplicationSystem/public/Education/HtmlController.mjs](../ApplicationSystem/public/Education/HtmlController.mjs) | Application | 19 | OK | OK |
| [ApplicationSystem/public/Education/Navigation.mjs](../ApplicationSystem/public/Education/Navigation.mjs) | Application | 6 | OK | OK |
| [ApplicationSystem/public/Education/PanelNavigation.mjs](../ApplicationSystem/public/Education/PanelNavigation.mjs) | Application | 4 | OK | OK |
| [ApplicationSystem/public/Education/Records.mjs](../ApplicationSystem/public/Education/Records.mjs) | Application | 12 | OK | OK |
| [ApplicationSystem/public/Education/Resources.mjs](../ApplicationSystem/public/Education/Resources.mjs) | Application | 11 | OK | OK |
| [ApplicationSystem/public/Education/RouteReferences.mjs](../ApplicationSystem/public/Education/RouteReferences.mjs) | Application | 3 | OK | OK |
| [ApplicationSystem/public/Education/WorldLinks.mjs](../ApplicationSystem/public/Education/WorldLinks.mjs) | Application | 17 | OK | OK |
| [ApplicationSystem/public/MetaWorld/Constructions/Authoring.mjs](../ApplicationSystem/public/MetaWorld/Constructions/Authoring.mjs) | Application | 73 | OK | OK |
| [ApplicationSystem/public/MetaWorld/Geographic/Definition.mjs](../ApplicationSystem/public/MetaWorld/Geographic/Definition.mjs) | Application | 71 | OK | OK |
| [ApplicationSystem/public/MetaWorld/Geographic/ImportControls.mjs](../ApplicationSystem/public/MetaWorld/Geographic/ImportControls.mjs) | Application | 31 | OK | OK |
| [ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.mjs](../ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.mjs) | Application | 9 | OK | OK |
| [ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.test.mjs](../ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.test.mjs) | Application | 8 | OK | OK |
| [ApplicationSystem/public/MetaWorld/Geographic/Vegetation.mjs](../ApplicationSystem/public/MetaWorld/Geographic/Vegetation.mjs) | Application | 17 | OK | OK |
| [ApplicationSystem/public/MetaWorld/Paths/PathAuthoringBridge.mjs](../ApplicationSystem/public/MetaWorld/Paths/PathAuthoringBridge.mjs) | Application | 76 | OK | OK |
| [ApplicationSystem/public/MetaWorld/Paths/PathDefinition.mjs](../ApplicationSystem/public/MetaWorld/Paths/PathDefinition.mjs) | Application | 33 | OK | OK |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs) | Application | 193 | OK | OK |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs) | Application | 77 | OK | OK |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelBaseTerrain.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelBaseTerrain.mjs) | Application | 103 | OK | OK |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs) | Application | 60 | OK | OK |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldAuthoringBridge.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldAuthoringBridge.mjs) | Application | 47 | OK | OK |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDefinition.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDefinition.mjs) | Application | 38 | OK | OK |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDialog.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDialog.mjs) | Application | 96 | OK | OK |
| [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldProperties.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldProperties.mjs) | Application | 26 | OK | OK |
| [ApplicationSystem/public/MetaWorld/SessionVoxels/Authoring.mjs](../ApplicationSystem/public/MetaWorld/SessionVoxels/Authoring.mjs) | Application | 40 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Binding.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Binding.mjs) | Application | 23 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Canvas.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Canvas.mjs) | Application | 28 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Create.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Create.mjs) | Application | 5 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.mjs) | Application | 38 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.test.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.test.mjs) | Application | 15 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Open.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Open.mjs) | Application | 3 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Palette.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Palette.mjs) | Application | 5 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Panel.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Panel.mjs) | Application | 32 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Persistence.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Persistence.mjs) | Application | 7 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Tools.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Tools.mjs) | Application | 2 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Format.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Format.mjs) | Application | 62 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Format.test.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Format.test.mjs) | Application | 13 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Integration.test.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Integration.test.mjs) | Application | 26 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Preview.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Preview.mjs) | Application | 4 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Reader.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Reader.mjs) | Application | 44 | OK | OK |
| [ApplicationSystem/public/MetaWorld/TerrainMaps/Source.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Source.mjs) | Application | 23 | OK | OK |
| [ApplicationSystem/public/MetaWorld/Text/TextAuthoringBridge.mjs](../ApplicationSystem/public/MetaWorld/Text/TextAuthoringBridge.mjs) | Application | 54 | OK | OK |
| [ApplicationSystem/public/MetaWorld/WorldAuthoringPermissions.mjs](../ApplicationSystem/public/MetaWorld/WorldAuthoringPermissions.mjs) | Application | 42 | OK | OK |
| [ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapNotebookPicker.mjs](../ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapNotebookPicker.mjs) | Application | 61 | OK | OK |
| [ApplicationSystem/public/PanelInstances/Common/SnapshotHistory.mjs](../ApplicationSystem/public/PanelInstances/Common/SnapshotHistory.mjs) | Application | 6 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditorParts/GetGraphicalEditorHost.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditorParts/GetGraphicalEditorHost.mjs) | Application | 127 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditorParts/ReadGraphicalLiveContent.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditorParts/ReadGraphicalLiveContent.mjs) | Application | 136 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVHistory.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVHistory.mjs) | Application | 2 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/ConnectHtmlImageInteraction.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/ConnectHtmlImageInteraction.mjs) | Application | 98 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateCalligraphyHandler.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateCalligraphyHandler.mjs) | Application | 30 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateCloseInlineImageEditorHandler.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateCloseInlineImageEditorHandler.mjs) | Application | 143 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateSetEditorHtmlForPathHandler.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateSetEditorHtmlForPathHandler.mjs) | Application | 89 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/InitializeHtmlEditorTools.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/InitializeHtmlEditorTools.mjs) | Application | 153 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MountHtmlEditorShell.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MountHtmlEditorShell.mjs) | Application | 128 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MountInlineImageEditor.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MountInlineImageEditor.mjs) | Application | 117 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/OpenInsertImageForm.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/OpenInsertImageForm.mjs) | Application | 111 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/PrepareInlineImageEditor.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/PrepareInlineImageEditor.mjs) | Application | 128 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/RegisterHTMLLayoutTools.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/RegisterHTMLLayoutTools.mjs) | Application | 172 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlAttentionReporting.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlAttentionReporting.test.mjs) | Application | 35 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlBodySerialization.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlBodySerialization.mjs) | Application | 13 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlCalligraphy.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlCalligraphy.mjs) | Application | 62 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.mjs) | Application | 151 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.test.mjs) | Application | 82 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceDocument.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceDocument.mjs) | Application | 126 | OK | OK |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/NVMAPeditor.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/NVMAPeditor.mjs) | Application | 1 | OK | OK |
| [ApplicationSystem/public/PanelInstances/InfoPanels/EducationalLinksPanel.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/EducationalLinksPanel.mjs) | Application | 45 | OK | OK |
| [ApplicationSystem/public/PanelInstances/InfoPanels/NewDocumentOverlay.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/NewDocumentOverlay.mjs) | Application | 149 | OK | OK |
| [ApplicationSystem/public/PanelInstances/InfoPanels/SVGLayersPanel.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/SVGLayersPanel.mjs) | Application | 197 | OK | OK |
| [ApplicationSystem/public/PanelInstances/ModuleMap.csv](../ApplicationSystem/public/PanelInstances/ModuleMap.csv) | Exempt file type | — | Exempt | Exempt |
| [ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNVMAP.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNVMAP.mjs) | Application | 2 | OK | OK |
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs) | Application | 1200 | OK | FAIL |
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs) | Application | 3607 | OK | FAIL |
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs) | Application | 1006 | OK | FAIL |
| [ApplicationSystem/public/References/ActiveFootnoteCommand.mjs](../ApplicationSystem/public/References/ActiveFootnoteCommand.mjs) | Application | 9 | OK | OK |
| [ApplicationSystem/public/References/FootnoteClipboard.mjs](../ApplicationSystem/public/References/FootnoteClipboard.mjs) | Application | 90 | OK | OK |
| [ApplicationSystem/public/References/FootnoteCommands.mjs](../ApplicationSystem/public/References/FootnoteCommands.mjs) | Application | 84 | OK | OK |
| [ApplicationSystem/public/References/HtmlFootnotes.mjs](../ApplicationSystem/public/References/HtmlFootnotes.mjs) | Application | 44 | OK | OK |
| [ApplicationSystem/public/References/ReconcileFootnotes.mjs](../ApplicationSystem/public/References/ReconcileFootnotes.mjs) | Application | 116 | OK | OK |
| [ApplicationSystem/public/References/ReferenceChanges.mjs](../ApplicationSystem/public/References/ReferenceChanges.mjs) | Application | 38 | OK | OK |
| [ApplicationSystem/public/References/ReferenceModel.mjs](../ApplicationSystem/public/References/ReferenceModel.mjs) | Application | 49 | OK | OK |
| [ApplicationSystem/public/TemplateSystem/NewDocumentController.mjs](../ApplicationSystem/public/TemplateSystem/NewDocumentController.mjs) | Application | 71 | OK | OK |
| [ApplicationSystem/public/TemplateSystem/TemplateFormDialog.mjs](../ApplicationSystem/public/TemplateSystem/TemplateFormDialog.mjs) | Application | 239 | OK | FAIL |
| [ApplicationSystem/public/ToolbarCallbacks/edit/deleteFootnote.mjs](../ApplicationSystem/public/ToolbarCallbacks/edit/deleteFootnote.mjs) | Application | 2 | OK | OK |
| [ApplicationSystem/public/ToolbarCallbacks/edit/editFootnote.mjs](../ApplicationSystem/public/ToolbarCallbacks/edit/editFootnote.mjs) | Application | 2 | OK | OK |
| [ApplicationSystem/public/ToolbarCallbacks/edit/educationalAssociations.mjs](../ApplicationSystem/public/ToolbarCallbacks/edit/educationalAssociations.mjs) | Application | 1 | OK | OK |
| [ApplicationSystem/public/ToolbarCallbacks/edit/returnFromFootnote.mjs](../ApplicationSystem/public/ToolbarCallbacks/edit/returnFromFootnote.mjs) | Application | 2 | OK | OK |
| [ApplicationSystem/public/ToolbarCallbacks/edit/validateFootnotes.mjs](../ApplicationSystem/public/ToolbarCallbacks/edit/validateFootnotes.mjs) | Application | 2 | OK | OK |
| [ApplicationSystem/public/ToolbarCallbacks/file/saveFile.mjs](../ApplicationSystem/public/ToolbarCallbacks/file/saveFile.mjs) | Application | 184 | OK | OK |
| [ApplicationSystem/public/ToolbarCallbacks/insert/insertCalligraphyLetter.mjs](../ApplicationSystem/public/ToolbarCallbacks/insert/insertCalligraphyLetter.mjs) | Application | 7 | OK | OK |
| [ApplicationSystem/public/ToolbarCallbacks/insert/insertFootnote.mjs](../ApplicationSystem/public/ToolbarCallbacks/insert/insertFootnote.mjs) | Application | 2 | OK | OK |
| [ApplicationSystem/public/ToolbarCallbacks/insertCallbacks.js](../ApplicationSystem/public/ToolbarCallbacks/insertCallbacks.js) | Application | 1027 | OK | FAIL |
| [ApplicationSystem/public/ToolbarCallbacks/view/ViewLayers.mjs](../ApplicationSystem/public/ToolbarCallbacks/view/ViewLayers.mjs) | Application | 23 | OK | OK |
| [ApplicationSystem/public/ToolbarJSONfiles/editToolbar.json](../ApplicationSystem/public/ToolbarJSONfiles/editToolbar.json) | Exempt file type | — | Exempt | Exempt |
| [ApplicationSystem/public/ToolbarJSONfiles/insertToolbar.json](../ApplicationSystem/public/ToolbarJSONfiles/insertToolbar.json) | Exempt file type | — | Exempt | Exempt |
| [ApplicationSystem/public/Typography/CalligraphyGlyph.mjs](../ApplicationSystem/public/Typography/CalligraphyGlyph.mjs) | Application | 64 | OK | OK |
| [ApplicationSystem/public/panels/panelTabs.mjs](../ApplicationSystem/public/panels/panelTabs.mjs) | Application | 499 | OK | FAIL |
| [ApplicationSystem/public/panels/savedLayouts.mjs](../ApplicationSystem/public/panels/savedLayouts.mjs) | Application | 43 | OK | OK |
| [ApplicationSystem/routes/api/fileSaveRoutes.js](../ApplicationSystem/routes/api/fileSaveRoutes.js) | Application | 257 | OK | FAIL |
| [ApplicationSystem/routes/api/fileSaveRoutes/conditionalWrite.mjs](../ApplicationSystem/routes/api/fileSaveRoutes/conditionalWrite.mjs) | Application | 16 | OK | OK |
| [ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.mjs](../ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.mjs) | Application | 20 | OK | OK |
| [ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.test.mjs](../ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.test.mjs) | Application | 3 | OK | OK |
| [docs/CustomTerrainMaps.md](../docs/CustomTerrainMaps.md) | Outside application rules | — | N/A | N/A |
| [docs/GreekAlphabetMemoryPalace.md](../docs/GreekAlphabetMemoryPalace.md) | Outside application rules | — | N/A | N/A |
| [docs/TerrainMapEditor.md](../docs/TerrainMapEditor.md) | Outside application rules | — | N/A | N/A |
| [docs/calligraphy-letter-implementation.md](../docs/calligraphy-letter-implementation.md) | Outside application rules | — | N/A | N/A |
| [docs/footnote-architecture.md](../docs/footnote-architecture.md) | Outside application rules | — | N/A | N/A |
| [scripts/calligraphy-browser.mjs](../scripts/calligraphy-browser.mjs) | Outside application rules | 84 | N/A | N/A |
| [scripts/education-browser.mjs](../scripts/education-browser.mjs) | Outside application rules | 52 | N/A | N/A |
| [scripts/education-synthetic-fixture.mjs](../scripts/education-synthetic-fixture.mjs) | Outside application rules | 1 | N/A | N/A |
| [scripts/fixtures/terrain-maps/CustomTerrain.html](../scripts/fixtures/terrain-maps/CustomTerrain.html) | Outside application rules | — | N/A | N/A |
| [scripts/fixtures/terrain-maps/CustomTerrain.nvmap](../scripts/fixtures/terrain-maps/CustomTerrain.nvmap) | Outside application rules | — | N/A | N/A |
| [scripts/footnotes-browser.mjs](../scripts/footnotes-browser.mjs) | Outside application rules | 150 | N/A | N/A |
| [scripts/generate-sample-nvmap.mjs](../scripts/generate-sample-nvmap.mjs) | Outside application rules | 10 | N/A | N/A |
| [scripts/inspect-memory-palace-fixtures.mjs](../scripts/inspect-memory-palace-fixtures.mjs) | Outside application rules | 14 | N/A | N/A |
| [scripts/run-browser-regression.mjs](../scripts/run-browser-regression.mjs) | Outside application rules | 45 | N/A | N/A |
| [scripts/run-calligraphy-browser.mjs](../scripts/run-calligraphy-browser.mjs) | Outside application rules | 20 | N/A | N/A |
| [scripts/run-footnotes-browser.mjs](../scripts/run-footnotes-browser.mjs) | Outside application rules | 48 | N/A | N/A |
| [scripts/terrain-map-editor-browser.mjs](../scripts/terrain-map-editor-browser.mjs) | Outside application rules | 26 | N/A | N/A |
| [scripts/terrain-map-native-input.mjs](../scripts/terrain-map-native-input.mjs) | Outside application rules | 20 | N/A | N/A |
| [scripts/terrain-maps-browser.mjs](../scripts/terrain-maps-browser.mjs) | Outside application rules | 64 | N/A | N/A |
| [scripts/test-terrain-map-editor-browser.mjs](../scripts/test-terrain-map-editor-browser.mjs) | Outside application rules | 8 | N/A | N/A |
| [scripts/test-terrain-maps-browser.py](../scripts/test-terrain-maps-browser.py) | Outside application rules | — | N/A | N/A |

## Header corrections

- [ApplicationSystem/public/CursorFamilies/providers/TerrainMapCursorProvider.mjs](../ApplicationSystem/public/CursorFamilies/providers/TerrainMapCursorProvider.mjs).
- [ApplicationSystem/public/Education/Education.test.mjs](../ApplicationSystem/public/Education/Education.test.mjs).
- [ApplicationSystem/public/Education/HtmlController.mjs](../ApplicationSystem/public/Education/HtmlController.mjs).
- [ApplicationSystem/public/Education/Navigation.mjs](../ApplicationSystem/public/Education/Navigation.mjs).
- [ApplicationSystem/public/Education/PanelNavigation.mjs](../ApplicationSystem/public/Education/PanelNavigation.mjs).
- [ApplicationSystem/public/Education/Records.mjs](../ApplicationSystem/public/Education/Records.mjs).
- [ApplicationSystem/public/Education/Resources.mjs](../ApplicationSystem/public/Education/Resources.mjs).
- [ApplicationSystem/public/Education/RouteReferences.mjs](../ApplicationSystem/public/Education/RouteReferences.mjs).
- [ApplicationSystem/public/Education/WorldLinks.mjs](../ApplicationSystem/public/Education/WorldLinks.mjs).
- [ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.mjs](../ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.mjs).
- [ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.test.mjs](../ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.test.mjs).
- [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs).
- [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs).
- [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelBaseTerrain.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelBaseTerrain.mjs).
- [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs).
- [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDefinition.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDefinition.mjs).
- [ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDialog.mjs](../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDialog.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Binding.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Binding.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Canvas.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Canvas.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Create.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Create.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.test.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Document.test.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Open.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Open.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Palette.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Palette.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Panel.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Panel.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Persistence.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Persistence.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Tools.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Tools.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Format.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Format.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Format.test.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Format.test.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Integration.test.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Integration.test.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Preview.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Preview.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Reader.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Reader.mjs).
- [ApplicationSystem/public/MetaWorld/TerrainMaps/Source.mjs](../ApplicationSystem/public/MetaWorld/TerrainMaps/Source.mjs).
- [ApplicationSystem/public/PanelInstances/Common/SnapshotHistory.mjs](../ApplicationSystem/public/PanelInstances/Common/SnapshotHistory.mjs).
- [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVHistory.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVHistory.mjs).
- [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/InitializeHtmlEditorTools.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/InitializeHtmlEditorTools.mjs).
- [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/NVMAPeditor.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/NVMAPeditor.mjs).
- [ApplicationSystem/public/PanelInstances/InfoPanels/EducationalLinksPanel.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/EducationalLinksPanel.mjs).
- [ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNVMAP.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNVMAP.mjs).
- [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs).
- [ApplicationSystem/public/ToolbarCallbacks/edit/educationalAssociations.mjs](../ApplicationSystem/public/ToolbarCallbacks/edit/educationalAssociations.mjs).
- [ApplicationSystem/routes/api/fileSaveRoutes.js](../ApplicationSystem/routes/api/fileSaveRoutes.js).
- [ApplicationSystem/routes/api/fileSaveRoutes/conditionalWrite.mjs](../ApplicationSystem/routes/api/fileSaveRoutes/conditionalWrite.mjs).
- [ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.mjs](../ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.mjs).
- [ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.test.mjs](../ApplicationSystem/routes/api/fileSaveRoutes/terrainMapSave.test.mjs).
