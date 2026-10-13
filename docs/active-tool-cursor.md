# Cursor button: active tool state

The Cursor widget displays semantic tool state, independently of CSS pointer presentation. It subscribes to tool, editor-attention, and panel-activation events; it does not subscribe to pointer motion, hover, resize, drag, or CSS mutation observers. Equivalent snapshots retain the current button DOM.

`PanelActiveTool.mjs` registers sources on their owning editor instance and releases them with that editor. SVG sources read the owning editor context rather than a different panel's last-published global context. Selection explicitly resolves to the selection arrow instead of the rectangle-selection alias. HTML and raster sources remember their selected tools per panel; CSV publishes entry/exit from cell text editing independently of hover and drag cursors. Raster eyedropper completion publishes the existing return to Brush.

Provider resolution prioritizes the interaction mode over file extension: an HTML document in Virtual World mode displays World Interaction, rather than HTML text selection. `ActiveToolPresentation.mjs` supplies selection, line, text, shape, hand, and gameplay symbols. A registered semantic `pan`/`hand` mode displays a hand continuously. This does not introduce a new Pan tool or promote temporary drag cursors into tool state. World interaction is a read-only indicator; it does not change gameplay behavior.

The existing widget styling was extracted to `ContextualCursorStyle.mjs` to keep the widget under the file-size limit. Providers and the existing editor lifecycles contain small registration/notification hooks. Changes are in `CursorFamilies/`, `ToolbarJSONfiles/contextualCursorFamilyWidget.mjs` and `defaultToolbar.json`, CSV range interactions, HTML attention reporting, PNG editor lifecycle, SVG context publication, and Game View lifecycle.

Validation: the provider registry tests and `scripts/active-tool-browser.mjs` pass. Browser assertions cover two SVG panels, selection/Line lifecycle changes, hover/text/resize/grabbing CSS changes without icon or DOM changes, text/Pan/gameplay indicators, mode precedence, inactive-editor isolation, and real CSV F2/Escape edit-state transitions.
