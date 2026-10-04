# Dirty-tree programming standards audit

Audited 2026-10-03 against [NodevisionProgrammingStandards.md](../NodevisionProgrammingStandards.md), comparing tracked files with HEAD `729280e`. **Result: not fully compliant.** This is an audit, not a refactoring pass; no product source or standards text was changed by this audit.

## Scope and method

The starting inventory contains **123 dirty files**: 70 under ApplicationSystem, 28 under scripts, 24 under docs, and electron-main.js. Expanded untracked directories are included. Of the ApplicationSystem files, 69 are native comment-supporting JS/CSS and one is JSON. The new report itself is not part of that starting inventory.

The explicit path/purpose header requirement applies to native comment-supporting files under ApplicationSystem, including tests. JSON is exempt from comments and the file-length rule. Root scripts, benchmark artifacts and documentation are not classified as missing ApplicationSystem headers. No third-party dependency files or dependency manifests are dirty.

Source-line counts exclude blank lines and standalone line/block comments; multiline strings/templates count as code. This matches the earlier checkpoint's source-line methodology, not an AST statement count. Mixed code/comment lines count as code. The threshold is strictly **fewer than 200**, so 200 fails. Compression into one physical line does not demonstrate readability. All over-limit findings are far enough over the boundary that borderline lexical counting would not change the verdict.

## Findings

### 1. Twelve touched application files remain over the length limit (inherited)

The complete table below records baseline and current counts. All twelve were already oversized in HEAD; none is newly crossing the threshold. Nevertheless, the standard contains no grandfathering exception. The largest are SVGeditorRuntime (6,211), HTMLeditorImpl (5,365), and FileView (2,172). HTML and SVG shrink, which is useful but does not make them compliant. Other failures include tableTools, LayoutStyles, panelFactory, GraphicalEditor, cartoonTools, htmlLayersContext, HtmlInlineEquation, HtmlImageText, and the FileView iframe-activation test.

Remediation: extract cohesive reusable modules and split test responsibilities. Prioritize the modules being actively developed. Do not meet the physical-line cap by combining statements. Broad refactoring requires behavioral validation and is not part of this read-only source audit.

### 2. Two tests lack the mandatory path and second-line purpose headers

- [HtmlDomHistory.test.mjs:1](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.test.mjs#L1) is new and starts directly with imports. This is a new violation introduced during the history teardown work.
- [FileViewIframeActivation.test.mjs:1](../ApplicationSystem/public/PanelInstances/ViewPanels/FileViewIframeActivation.test.mjs#L1) starts with a generic fragment and a blank line. This is inherited, but the file is dirty and still fails. It also exceeds the length cap.

Add the exact `Nodevision/...` path on the first line and a complete single-line purpose paragraph on the second. Tests are not exempt.

### 3. Three existing second-line descriptions are sentence fragments

- CSVGridModel.mjs:2: “Pure CSV grid helpers used by the graphical CSV editor and its regression tests.”
- CSVGridModel.test.mjs:2: “Regression coverage for the graphical CSV editor's model-backed grid behavior.”
- SvgSelectionRefreshSplit.test.mjs:2: “Static guardrails for separating full selection-state refresh from geometry-only overlay refresh.”

Each lacks a subject/predicate forming a full declarative sentence. All three are inherited. The standard expressly requires complete sentences, capitalization and a final period, entirely on the second line. The other inspected purpose lines satisfy the mechanical sentence form; “college-level paragraph” quality is qualitative and cannot be certified by a line-count check.

### 4. New modules need section comments and more readable control flow

Principle 6 requires readable, maintainable modules; File Commenting Conventions asks for frequent descriptive section comments. New multi-responsibility helpers such as CssSourceIndex, CssSourceStore, HtmlCssDocument, PropertiesController, PropertiesEdit, and HtmlHistoryRouting have only their two header comments and no explanatory section comments. Particularly useful boundaries are CSS tokenization/indexing/patching, buffer acquisition/conflict/save/disposal, scoped projection lifetime, UI ownership/commands, and desktop/native routing installation/removal.

Examples of compressed control flow are [PropertiesController.mjs:63](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/PropertiesController.mjs#L63) (Undo/Redo dispatch, state cleanup and status reporting in one line) and [HtmlDomHistory.mjs:145](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.mjs#L145) (the complete disposal sequence in one line). Their physical counts are below 200, but they need expansion and, if necessary, responsibility extraction. This is a readability finding under the stated principle, not an invented maximum line-width or formatter rule. Tiny single-purpose helpers do not need artificial section headings.

### 5. Previous standards checkpoint is no longer a current-tree certification

[html-foundation-standards-audit.md](html-foundation-standards-audit.md) is dated 2026-09-29 and describes the earlier foundation scope. It predates the new headerless history test and Properties additions; its claims that no Properties UI was added and all new modules have headers cannot describe today's complete dirty tree. Preserve it as a historical checkpoint and use this audit for current compliance.

## Other design principles reviewed

- **Privacy/local operation:** the new CSS source reader accepts same-origin Notebook CSS and explicit saves use `/api/save`. The journal/routing changes introduce no remote telemetry or history-persistence sink. This is a source-change assessment, not a network security certification for every existing application subsystem.
- **Offline operation/dependencies:** no new external dependency or CDN endpoint is introduced by the product-code changes. Existing MathJax CDN fallback remains inherited in HtmlInlineEquation; the earlier performance report documents the missing local MathJax bundle. Complete offline equation-rendering readiness is not established by these changes.
- **Independent Notebook deployment:** the new source/provenance helpers remove private editor presentation from detached save output and preserve authored source paths. Existing browser preservation/resource tests provide supporting evidence; unrelated legacy widget behavior is not newly certified.
- **Shared modules:** history patches/routing/restoration, source provenance, Layers invalidation and presentation helpers move work into reusable modules. The oversized call sites remain the explicit exceptions above.
- **Customizable aesthetics:** the changed row-divider background now uses `--nv-layout-divider-background` with a fallback, which supports customization. New Properties controls use native controls and the shared hex-color control; no new fixed application palette or fixed panel dimensions were found in those additions. The red filter literal in SvgSelectionMarkers identifies/removes a legacy filter; it does not introduce a new hardcoded theme. Benchmark dimensions/colors are fixture conditions. This does not certify all inherited styles as customizable.
- **Linux:** the recorded Electron/Xvfb regressions and current Node syntax checks run on Linux. This audit does not rerun performance tests or change functionality.

## Verification

All **95 dirty JS/MJS/CJS files** pass `node --check`. `git diff --check` passes. These establish syntax and whitespace integrity, not standards compliance or functional correctness. Generated JSON artifacts and toolbar JSON were parsed successfully. Existing behavioral results are in [the final regression record](html-history-final-regressions.json).

## Complete native ApplicationSystem inventory

| File | HEAD code lines | Current code lines | Path header | Purpose line | Length |
| --- | ---: | ---: | --- | --- | --- |
| [ElectronHtmlHistory.mjs](../ApplicationSystem/Desktop/ElectronHtmlHistory.mjs) | new | 11 | yes | complete sentence | pass |
| [ElectronHtmlHistory.test.mjs](../ApplicationSystem/Desktop/ElectronHtmlHistory.test.mjs) | new | 17 | yes | complete sentence | pass |
| [HtmlInlineEquation.mjs](../ApplicationSystem/public/Equation/HtmlInlineEquation.mjs) | 333 | 336 | yes | complete sentence | FAIL |
| [ShortcutSave.js](../ApplicationSystem/public/KeyboardShortcuts/ShortcutSave.js) | 21 | 22 | yes | complete sentence | pass |
| [ListenHighlights.mjs](../ApplicationSystem/public/Listen/ListenHighlights.mjs) | 144 | 153 | yes | complete sentence | pass |
| [LiveFileContent.mjs](../ApplicationSystem/public/LiveFileContent.mjs) | 157 | 157 | yes | complete sentence | pass |
| [CssSourceIndex.mjs](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/CssSourceIndex.mjs) | new | 107 | yes | complete sentence | pass |
| [CssSourceIndex.test.mjs](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/CssSourceIndex.test.mjs) | new | 41 | yes | complete sentence | pass |
| [CssSourceStore.mjs](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/CssSourceStore.mjs) | new | 76 | yes | complete sentence | pass |
| [HtmlCssDocument.mjs](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/HtmlCssDocument.mjs) | new | 95 | yes | complete sentence | pass |
| [HtmlPropertiesContexts.mjs](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/HtmlPropertiesContexts.mjs) | new | 15 | yes | complete sentence | pass |
| [InlineCssTarget.mjs](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/InlineCssTarget.mjs) | new | 16 | yes | complete sentence | pass |
| [PropertiesController.mjs](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/PropertiesController.mjs) | new | 100 | yes | complete sentence | pass |
| [PropertiesEdit.mjs](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/PropertiesEdit.mjs) | new | 62 | yes | complete sentence | pass |
| [PropertiesSurface.mjs](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/PropertiesSurface.mjs) | new | 30 | yes | complete sentence | pass |
| [PropertiesUndoFence.mjs](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/PropertiesUndoFence.mjs) | new | 20 | yes | complete sentence | pass |
| [HtmlImageMapAdapter.mjs](../ApplicationSystem/public/PanelInstances/Common/ImageMap/HtmlImageMapAdapter.mjs) | 133 | 134 | yes | complete sentence | pass |
| [HtmlLayerInvalidation.mjs](../ApplicationSystem/public/PanelInstances/Common/Layers/HtmlLayerInvalidation.mjs) | new | 20 | yes | complete sentence | pass |
| [HtmlLayerInvalidation.test.mjs](../ApplicationSystem/public/PanelInstances/Common/Layers/HtmlLayerInvalidation.test.mjs) | new | 13 | yes | complete sentence | pass |
| [htmlLayersContext.mjs](../ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContext.mjs) | 335 | 346 | yes | complete sentence | FAIL |
| [GraphicalEditor.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditor.mjs) | 534 | 540 | yes | complete sentence | FAIL |
| [CSVEditorLatency.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVEditorLatency.test.mjs) | new | 59 | yes | complete sentence | pass |
| [CSVGridModel.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridModel.mjs) | 132 | 140 | yes | fragment | pass |
| [CSVGridModel.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridModel.test.mjs) | 65 | 65 | yes | fragment | pass |
| [CSVGridView.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridView.mjs) | 59 | 60 | yes | complete sentence | pass |
| [CSVHistory.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVHistory.mjs) | new | 27 | yes | complete sentence | pass |
| [CSVHistory.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVHistory.test.mjs) | new | 45 | yes | complete sentence | pass |
| [CSVeditor.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVeditor.mjs) | 162 | 163 | yes | complete sentence | pass |
| [CircuitCanvasRenderer.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitCanvasRenderer.mjs) | 181 | 182 | yes | complete sentence | pass |
| [HTMLeditorImpl.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImpl.mjs) | 5417 | 5365 | yes | complete sentence | FAIL |
| [HtmlAttentionReporting.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlAttentionReporting.mjs) | new | 56 | yes | complete sentence | pass |
| [HtmlAttentionReporting.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlAttentionReporting.test.mjs) | new | 32 | yes | complete sentence | pass |
| [HtmlBodySerialization.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlBodySerialization.mjs) | 60 | 10 | yes | complete sentence | pass |
| [HtmlDomHistory.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.mjs) | new | 145 | yes | complete sentence | pass |
| [HtmlDomHistory.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.test.mjs) | new | 48 | MISSING | missing | pass |
| [HtmlEditorSelection.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorSelection.mjs) | 91 | 103 | yes | complete sentence | pass |
| [HtmlEditorTransactions.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorTransactions.mjs) | 81 | 110 | yes | complete sentence | pass |
| [HtmlEditorTransactions.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorTransactions.test.mjs) | new | 122 | yes | complete sentence | pass |
| [HtmlHistoryPatches.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlHistoryPatches.mjs) | new | 80 | yes | complete sentence | pass |
| [HtmlHistoryPatches.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlHistoryPatches.test.mjs) | new | 24 | yes | complete sentence | pass |
| [HtmlHistoryRestore.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlHistoryRestore.mjs) | new | 21 | yes | complete sentence | pass |
| [HtmlHistoryRestore.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlHistoryRestore.test.mjs) | new | 20 | yes | complete sentence | pass |
| [HtmlHistoryRouting.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlHistoryRouting.mjs) | new | 65 | yes | complete sentence | pass |
| [HtmlImageText.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlImageText.mjs) | 212 | 213 | yes | complete sentence | FAIL |
| [HtmlLiveContent.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlLiveContent.mjs) | new | 31 | yes | complete sentence | pass |
| [HtmlPresentation.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs) | new | 19 | yes | complete sentence | pass |
| [HtmlSourceDocument.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceDocument.mjs) | 101 | 125 | yes | complete sentence | pass |
| [HtmlSourceProvenance.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceProvenance.mjs) | new | 106 | yes | complete sentence | pass |
| [HtmlToolbarPublishing.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlToolbarPublishing.mjs) | new | 8 | yes | complete sentence | pass |
| [HtmlToolbarPublishing.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlToolbarPublishing.test.mjs) | new | 11 | yes | complete sentence | pass |
| [HtmlTransactionBoundary.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlTransactionBoundary.mjs) | new | 36 | yes | complete sentence | pass |
| [HtmlWorkDiagnostics.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlWorkDiagnostics.mjs) | new | 3 | yes | complete sentence | pass |
| [WysiwygProgrammaticHistory.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/WysiwygProgrammaticHistory.mjs) | 112 | 119 | yes | complete sentence | pass |
| [SVGeditorRuntime.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs) | 6229 | 6211 | yes | complete sentence | FAIL |
| [SvgSelectionMarkers.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgSelectionMarkers.mjs) | new | 25 | yes | complete sentence | pass |
| [SvgSelectionMarkers.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgSelectionMarkers.test.mjs) | new | 44 | yes | complete sentence | pass |
| [SvgSelectionRefreshSplit.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgSelectionRefreshSplit.test.mjs) | 46 | 47 | yes | fragment | pass |
| [HTMLPropertiesPanel.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/HTMLPropertiesPanel.mjs) | new | 9 | yes | complete sentence | pass |
| [FileView.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/FileView.mjs) | 2172 | 2172 | yes | complete sentence | FAIL |
| [FileViewIframeActivation.test.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/FileViewIframeActivation.test.mjs) | 287 | 288 | MISSING | missing | FAIL |
| [FileViewLiveRefresh.test.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/FileViewLiveRefresh.test.mjs) | 119 | 128 | yes | complete sentence | pass |
| [LayoutStyles.css](../ApplicationSystem/public/Stylesheets/LayoutStyles.css) | 577 | 577 | yes | complete sentence | FAIL |
| [cartoonTools.mjs](../ApplicationSystem/public/ToolbarCallbacks/insert/cartoonTools.mjs) | 475 | 478 | yes | complete sentence | FAIL |
| [tableTools.mjs](../ApplicationSystem/public/ToolbarCallbacks/insert/tableTools.mjs) | 706 | 707 | yes | complete sentence | FAIL |
| [htmlPropertiesButton.mjs](../ApplicationSystem/public/ToolbarJSONfiles/htmlPropertiesButton.mjs) | new | 6 | yes | complete sentence | pass |
| [mathmlEquationStructureWidget.mjs](../ApplicationSystem/public/ToolbarJSONfiles/mathmlEquationStructureWidget.mjs) | 101 | 102 | yes | complete sentence | pass |
| [panelFactory.mjs](../ApplicationSystem/public/panels/panelFactory.mjs) | 568 | 573 | yes | complete sentence | FAIL |
| [panelRemovalCleanup.mjs](../ApplicationSystem/public/panels/panelRemovalCleanup.mjs) | new | 10 | yes | complete sentence | pass |
| [panelResize.mjs](../ApplicationSystem/public/panels/panelResize.mjs) | 138 | 148 | yes | complete sentence | pass |

The JSON exemption applies to `ApplicationSystem/public/ToolbarJSONfiles/viewToolbar.json`. All 39 newly added native comment-supporting ApplicationSystem files are below the physical 200-line cap. New files still have the header/readability findings above.

## Module split follow-up

The 12 oversized files and their extracted modules now pass the scoped header and length checks. See [the follow-up report](native-module-split.md) for current counts, module organization, regression results, and the three unchanged SVG recognition test failures. The inventory above records the original audit state.
