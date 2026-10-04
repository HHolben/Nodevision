// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/HTMLeditorImplStyleSection1.mjs
// This module implements hTMLeditor Impl Style Section1 behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// HTMLeditor Impl Style Section1 operations.
export const HTMLeditorImplStyleSection1 = `
    #wysiwyg > section,
    #wysiwyg > article,
    #wysiwyg > main,
    #wysiwyg > aside,
    #wysiwyg > div {
      content-visibility: auto;
      contain-intrinsic-size: auto 96px;
    }
    #wysiwyg > :focus-within {
      content-visibility: visible;
      contain-intrinsic-size: auto;
    }
    .nv-layout-canvas {
      position: relative;
      min-height: 260px;
      border: 1px dashed #9a9a9a;
      background-image:
        linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px);
      background-size: 20px 20px;
      margin: 12px 0;
      padding: 12px;
    }
    .nv-layout-canvas .nv-resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      border: 1px solid #555;
      border-radius: 50%;
      background: #fff;
      z-index: 8;
      transform: translate(-50%, -50%);
    }
    .nv-layout-canvas .nv-resize-handle[data-dir="n"] { left: 50%; top: 0%; cursor: n-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="s"] { left: 50%; top: 100%; cursor: s-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="e"] { left: 100%; top: 50%; cursor: e-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="w"] { left: 0%; top: 50%; cursor: w-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="ne"] { left: 100%; top: 0%; cursor: ne-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="nw"] { left: 0%; top: 0%; cursor: nw-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="se"] { left: 100%; top: 100%; cursor: se-resize; }
    .nv-layout-canvas .nv-resize-handle[data-dir="sw"] { left: 0%; top: 100%; cursor: sw-resize; }
    .nv-layout-canvas .nv-canvas-tools {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 6px;
      z-index: 1000;
    }
    .nv-layout-canvas .nv-canvas-tools button {
      border: 1px solid #777;
      background: #f6f6f6;
      font-size: 12px;
      padding: 2px 8px;
      cursor: pointer;
    }
    .nv-canvas-item {
      position: absolute;
      border: 1px solid #aaa;
      background: #fff;
      min-width: 80px;
      min-height: 40px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transform-origin: center center;
      touch-action: none;
    }
    .nv-canvas-item .nv-item-content {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 8px;
      overflow: auto;
    }
    .nv-canvas-item .nv-item-content[contenteditable="true"] {
      outline: none;
      cursor: text;
    }
    .nv-canvas-item .nv-item-content img,
    .nv-canvas-item .nv-item-content svg,
    .nv-canvas-item .nv-item-content video {
      display: block;
      max-width: 100%;
      height: auto;
      pointer-events: none;
    }
    .nodevision-circuit-reference {
      display: inline-block;
      vertical-align: middle;
      position: relative;
      min-width: 120px;
      min-height: 120px;
      max-width: 100%;
      resize: both;
      overflow: hidden;
`;
