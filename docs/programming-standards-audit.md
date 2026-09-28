# Programming standards audit

The audit uses `NodevisionProgrammingStandards.md` without changing it. Its limit is **fewer than 200 nonblank, noncomment lines**, not 200 total physical lines. The original dirty set was based on `c151990`; those edits were committed as `c6bcac0` while this audit was in progress. The table below retains that original scope instead of treating the subsequent clean working tree as proof that all files comply.

## Outstanding violations

The following 12 native application files still exceed the limit. Every one was already oversized in the original baseline. That history explains the origin; it does not exempt them from the standard. These files require further modular refactoring, and the original change set cannot be described as fully compliant.

| File | Baseline code lines | Audited code lines |
| --- | ---: | ---: |
| [GraphicalEditor.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditor.mjs) | 502 | 534 |
| [SVGeditorRuntime.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs) | 6192 | 6229 |
| [FileManagerCore.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerCore.mjs) | 1154 | 1156 |
| [GameView.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameView.mjs) | 239 | 256 |
| [collisionCheck.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs) | 248 | 255 |
| [equationColliderTool.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationColliderTool.mjs) | 613 | 628 |
| [initScene.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/initScene.mjs) | 573 | 584 |
| [objectInspector.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs) | 1132 | 1156 |
| [worldLoading.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs) | 3441 | 3468 |
| [worldSave.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs) | 975 | 979 |
| [saveFile.mjs](../ApplicationSystem/public/ToolbarCallbacks/file/saveFile.mjs) | 257 | 265 |
| [metaWorldAssetRoutes.mjs](../ApplicationSystem/server/routes/metaWorldAssetRoutes.mjs) | 384 | 385 |

Some inherited user-interface code also retains fixed colors, fonts, or dimensions. Examples include the equation inspector's inline preview/control styling in `objectInspector.mjs`, the temporal panel styling in `initScene.mjs`, and editor styling in `SVGeditorRuntime.mjs`. Converting these surfaces to user-overridable appearance settings remains outstanding. Modularizing their behavior and separating presentation would address both findings together.

## Corrections completed

- `equationObjectsPanel.mjs` was reduced from 813 code lines in the initial working tree to 146. Its seven extracted modules each have fewer than 200 code lines and separate reusable defaults, layer definitions, material selection, controls, configuration, quick-input parsing, and mesh mutations.
- Four new native files lacked the required opening path and description. Their headers were repaired, along with fragmentary second-line descriptions in several touched SVG, equation, projection, and test modules.
- The new file-switch prompt now uses shared `OverlayAppearance.mjs` defaults. The pause menu, startup error panel, equation form, and CSV selection view expose CSS custom properties for their appearance. Default colors in saved world objects remain editable object data.
- Equation material loading now ignores a completed asynchronous catalog request after its panel has been disposed.

## Other standards reviewed

The changed application modules use local imports and existing dependencies. The review found no newly introduced third-party runtime dependency, telemetry endpoint, mandatory sharing, or remote dependency for core editing. No Notebook content, private user settings, or programming standards were rewritten by this audit. HTML world definitions remain inert metadata in ordinary HTML, with the world renderer covered by the standard's explicit exception for virtual worlds. Functional verification runs in local Chromium on Linux.

The opening-description grammar and module responsibilities were reviewed manually. The checker validates header placement, sentence capitalization/punctuation, syntax tokenization, and file length; it does not certify grammar, privacy, architectural quality, licensing, or aesthetic compliance automatically.

## Reproducing the checks

```sh
node scripts/audit-dirty-standards.mjs
node scripts/audit-dirty-standards.mjs --base=c151990
```

The first command checks currently dirty native JavaScript files, including staged and untracked files. The second includes the original audit scope even after its commit. The tool uses the available Acorn tokenizer so comments inside strings or shader source do not distort counts. Acorn must be available to Node for this development check; no application runtime dependency was added. The checker exits with a failure status while the remaining oversized files are included. JSON, YAML, and CSV are exempt from the length rule; other file types are explicitly marked for manual review.

Browser validation covers startup and cleanup of the composed world editor, equation form insertion and mutation, and the themed file-switch prompt. The CSV browser harness additionally checks interaction cursor transitions and large-grid pointer-work costs.
