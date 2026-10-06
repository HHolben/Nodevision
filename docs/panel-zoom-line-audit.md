<!-- Nodevision/docs/panel-zoom-line-audit.md -->
<!-- This audit distinguishes zoom rollout conformance from existing violations elsewhere in the dirty working tree. -->

# Zoom rollout and dirty-tree line audit

The documented rule is **fewer than 200 nonblank, noncomment lines**. Comment spans are removed using the JavaScript parser (or CSS block-comment recognition), then nonblank lines are counted. Source lines are not compressed to satisfy the rule. Required file headers are checked as well.

The [zoom rollout manifest](panel-zoom-files.txt) contains **59 native application files** added or modified for this rollout. **All pass**, with a maximum of **187 code lines**. The large zoom/pan, toolbar, CodeEditor and PDF modules were split while retaining their entry points.

The subsequent audit of **all 126 dirty native JavaScript/CSS files** found **14 remaining length violations**. These files were already dirty and oversized before the zoom rollout. They are not included in the rollout's passing result. **The complete dirty working tree is not line-count conformant.** This audit reports the remaining work; it does not silently refactor unrelated world, export, raster, SVG-switching or file-management implementations.

| Existing dirty file | Nonblank, noncomment lines |
| --- | ---: |
| [ApplicationSystem/public/Commands/CommandDefinitions.mjs](../ApplicationSystem/public/Commands/CommandDefinitions.mjs) | 208 |
| [ApplicationSystem/public/ModelExport/STLExport.mjs](../ApplicationSystem/public/ModelExport/STLExport.mjs) | 794 |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers/panel.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers/panel.mjs) | 846 |
| [ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs) | 1771 |
| [ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerCore.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerCore.mjs) | 1157 |
| [ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerCore.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerCore.mjs) | 3144 |
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameView.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameView.mjs) | 265 |
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/initScene.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/initScene.mjs) | 588 |
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs) | 3484 |
| [ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs) | 986 |
| [ApplicationSystem/public/Stylesheets/style.css](../ApplicationSystem/public/Stylesheets/style.css) | 217 |
| [ApplicationSystem/public/SwitchToSVGediting/initSVGEditor.js](../ApplicationSystem/public/SwitchToSVGediting/initSVGEditor.js) | 1604 |
| [ApplicationSystem/public/ToolbarCallbacks/file/saveFile.mjs](../ApplicationSystem/public/ToolbarCallbacks/file/saveFile.mjs) | 271 |
| [ApplicationSystem/public/ToolbarCallbacks/fileCallbacks.js](../ApplicationSystem/public/ToolbarCallbacks/fileCallbacks.js) | 456 |

All audited files have the expected opening headers. No native dirty file type was omitted except the documented JSON exemption; the current dirty set contains no YAML/CSV source changes requiring additional counting. Documentation and development scripts outside ApplicationSystem are outside the native application limit.

Reproduce the rollout audit with:

```sh
node scripts/check-native-module-standards.mjs --files docs/panel-zoom-files.txt --inventory
```

The [machine-readable audit](panel-zoom-line-audit.json) includes every counted file and its pass/fail result. The full dirty-tree audit is expected to fail until the listed existing modules are refactored.
