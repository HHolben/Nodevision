# Working-tree standards checkpoint

Reviewed 2026-09-29 against `NodevisionProgrammingStandards.md` and HEAD `729280e`. This includes all dirty native application JS/CSS, including pre-existing CSV/SVG latency changes and the independently changed LayoutStyles.css. Those unrelated changes were not rewritten by the HTML task.

Counts exclude blank lines and standalone line/block comments; multiline strings count as code. The rule is **fewer than 200**, not 200 or fewer. These are transparent source-line counts, not an AST complexity score.

| File | HEAD lines | Current lines | Path header | Length result |
| --- | ---: | ---: | --- | --- |
| [HtmlInlineEquation.mjs](../ApplicationSystem/public/Equation/HtmlInlineEquation.mjs) | 333 | 336 | yes | over limit |
| [ShortcutSave.js](../ApplicationSystem/public/KeyboardShortcuts/ShortcutSave.js) | 21 | 22 | yes | within limit |
| [ListenHighlights.mjs](../ApplicationSystem/public/Listen/ListenHighlights.mjs) | 144 | 153 | yes | within limit |
| [LiveFileContent.mjs](../ApplicationSystem/public/LiveFileContent.mjs) | 157 | 157 | yes | within limit |
| [HtmlImageMapAdapter.mjs](../ApplicationSystem/public/PanelInstances/Common/ImageMap/HtmlImageMapAdapter.mjs) | 133 | 134 | yes | within limit |
| [htmlLayersContext.mjs](../ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContext.mjs) | 335 | 342 | yes | over limit |
| [GraphicalEditor.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditor.mjs) | 534 | 540 | yes | over limit |
| [CSVEditorLatency.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVEditorLatency.test.mjs) | new | 59 | yes | within limit |
| [CSVGridModel.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridModel.mjs) | 132 | 140 | yes | within limit |
| [CSVGridModel.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridModel.test.mjs) | 65 | 65 | yes | within limit |
| [CSVGridView.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridView.mjs) | 59 | 60 | yes | within limit |
| [CSVHistory.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVHistory.mjs) | new | 27 | yes | within limit |
| [CSVHistory.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVHistory.test.mjs) | new | 45 | yes | within limit |
| [CSVeditor.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVeditor.mjs) | 162 | 163 | yes | within limit |
| [CircuitCanvasRenderer.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitCanvasRenderer.mjs) | 181 | 182 | yes | within limit |
| [HTMLeditorImpl.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImpl.mjs) | 5417 | 5396 | yes | over limit |
| [HtmlBodySerialization.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlBodySerialization.mjs) | 60 | 10 | yes | within limit |
| [HtmlEditorSelection.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorSelection.mjs) | 91 | 95 | yes | within limit |
| [HtmlEditorTransactions.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorTransactions.mjs) | 81 | 92 | yes | within limit |
| [HtmlEditorTransactions.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorTransactions.test.mjs) | new | 79 | yes | within limit |
| [HtmlImageText.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlImageText.mjs) | 212 | 213 | yes | over limit |
| [HtmlLiveContent.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlLiveContent.mjs) | new | 31 | yes | within limit |
| [HtmlPresentation.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs) | new | 19 | yes | within limit |
| [HtmlSourceDocument.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceDocument.mjs) | 101 | 123 | yes | within limit |
| [HtmlSourceProvenance.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceProvenance.mjs) | new | 95 | yes | within limit |
| [WysiwygProgrammaticHistory.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/WysiwygProgrammaticHistory.mjs) | 112 | 115 | yes | within limit |
| [SVGeditorRuntime.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs) | 6229 | 6211 | yes | over limit |
| [SvgSelectionMarkers.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgSelectionMarkers.mjs) | new | 25 | yes | within limit |
| [SvgSelectionMarkers.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgSelectionMarkers.test.mjs) | new | 44 | yes | within limit |
| [SvgSelectionRefreshSplit.test.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgSelectionRefreshSplit.test.mjs) | 46 | 47 | yes | within limit |
| [FileView.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/FileView.mjs) | 2172 | 2172 | yes | over limit |
| [FileViewLiveRefresh.test.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/FileViewLiveRefresh.test.mjs) | 119 | 128 | yes | within limit |
| [LayoutStyles.css](../ApplicationSystem/public/Stylesheets/LayoutStyles.css) | 577 | 577 | yes | over limit |
| [cartoonTools.mjs](../ApplicationSystem/public/ToolbarCallbacks/insert/cartoonTools.mjs) | 475 | 478 | yes | over limit |
| [tableTools.mjs](../ApplicationSystem/public/ToolbarCallbacks/insert/tableTools.mjs) | 706 | 707 | yes | over limit |
| [mathmlEquationStructureWidget.mjs](../ApplicationSystem/public/ToolbarJSONfiles/mathmlEquationStructureWidget.mjs) | 101 | 102 | yes | within limit |

New HTML modules have repository-path headers and full-sentence purpose descriptions. They own resource/presentation provenance, explicit presentation writes, scoped live providers, and transaction regression coverage. The serializer composes detached cleanup and source assembly; it does not disguise the HTML implementation behind another entry file. No dependency, framework, Notebook data, network telemetry, application theme, or Properties UI was added.

The existing HTML implementation shrank, but remains substantially oversized. GraphicalEditor, FileView, HTML Layers, table/cartoon helpers, inline equations and image-text helpers remain inherited violations. Small changes at their existing call sites route work into focused modules; this is not full standards compliance. Touched LiveFileContent, HtmlImageText, cartoon helpers and FileView refresh tests now have full-sentence purpose comments. Other pre-existing dirty files can still have incomplete headers; the table records those rather than claiming whole-tree compliance.

Aesthetics: no new product controls, fixed colors, fonts, or panel dimensions were introduced. Fixed viewport dimensions in the standalone measurement harness are test conditions. Source output remains ordinary HTML with private runtime identities removed. Existing widget normalization and legacy global APIs are documented in the foundation report.

Validation: dirty JS modules passed `node --check`; `git diff --check` passed. These checks do not establish behavior or certify unrelated working-tree features. Behavioral evidence is listed in [the HTML checkpoint](html-foundation-verification.md).
