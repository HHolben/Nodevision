// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/HTMLeditorImplStyleSection7.mjs
// This module implements hTMLeditor Impl Style Section7 behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// HTMLeditor Impl Style Section7 operations.
export const HTMLeditorImplStyleSection7 = ` {
      outline: 2px solid #a855f7;
      outline-offset: 2px;
    }
    #wysiwyg .nv-inline-equation[data-nv-inline-equation] {
      display: inline-block;
      min-width: 1em;
      min-height: 1.2em;
      padding: 0 2px;
      vertical-align: middle;
      cursor: pointer;
      border-radius: 3px;
    }
    #wysiwyg .nv-inline-equation[data-nv-equation-active="true"],
    #wysiwyg .nv-inline-equation[data-nv-inline-equation]:focus {
      outline: 2px solid #2f80ff;
      outline-offset: 2px;
    }
    #wysiwyg .nv-inline-equation .nv-inline-equation-fallback {
      font-family: "Times New Roman", serif;
    }
    #wysiwyg .nv-inline-equation mjx-container {
      margin: 0;
    }
    .nv-image-corner-handle {
      position: fixed;
      width: 12px;
      height: 12px;
      border: 1px solid #2f80ff;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      transform: translate(-50%, -50%);
      z-index: 26000;
      cursor: nwse-resize;
      touch-action: none;
    }
    .nv-image-corner-handle[data-corner="ne"],
    .nv-image-corner-handle[data-corner="sw"] {
      cursor: nesw-resize;
    }
    #wysiwyg .nv-canvas-item.nv-selected-image-item {
      border-color: #2f80ff;
      box-shadow: 0 0 0 2px rgba(47, 128, 255, 0.3);
    }
    #wysiwyg .nv-inline-embedded-panel {
      position: relative;
      border: 1px solid #6a7f9c;
      background: #fff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      box-sizing: border-box;
      overflow: hidden;
    }
    #wysiwyg .nv-inline-embedded-panel-header {
      min-height: 24px;
      height: 24px;
      padding: 0 6px;
      background: linear-gradient(#dde9f8, #c9d9ee);
      border-bottom: 1px solid #97abc5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      user-select: none;
    }
    #wysiwyg .nv-inline-embedded-panel-title {
      font: 11px monospace;
      color: #15324f;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    #wysiwyg .nv-inline-embedded-panel-controls {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    #wysiwyg .nv-inline-embedded-panel-controls button {
      font: 11px monospace;
      padding: 1px 8px;
      border: 1px solid #355b7f;
      background: #e8f3ff;
      color: #0f2740;
      cursor: pointer;
    }
    #wysiwyg .nv-inline-embedded-panel-content {
      position: absolute;
      top: 24px;
      right: 0;
      bottom: 0;
      left: 0;
      overflow: hidden;
      background: #fff;
`;
