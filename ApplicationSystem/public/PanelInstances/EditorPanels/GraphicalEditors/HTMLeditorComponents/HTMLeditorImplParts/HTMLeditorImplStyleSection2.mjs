// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/HTMLeditorImplStyleSection2.mjs
// This module implements hTMLeditor Impl Style Section2 behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// HTMLeditor Impl Style Section2 operations.
export const HTMLeditorImplStyleSection2 = `      border: 1px solid #94a3b8;
      background: #ffffff;
      box-sizing: border-box;
    }
    .nodevision-circuit-reference canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    .nodevision-circuit-reference.nv-selected-circuit {
      outline: 2px solid #38bdf8;
      outline-offset: 2px;
    }
    .nv-canvas-item .nv-resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      border: 1px solid #555;
      border-radius: 50%;
      background: #fff;
      z-index: 6;
      transform: translate(-50%, -50%);
    }
    .nv-canvas-item .nv-resize-handle[data-dir="n"] { left: 50%; top: 0%; cursor: n-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="s"] { left: 50%; top: 100%; cursor: s-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="e"] { left: 100%; top: 50%; cursor: e-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="w"] { left: 0%; top: 50%; cursor: w-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="ne"] { left: 100%; top: 0%; cursor: ne-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="nw"] { left: 0%; top: 0%; cursor: nw-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="se"] { left: 100%; top: 100%; cursor: se-resize; }
    .nv-canvas-item .nv-resize-handle[data-dir="sw"] { left: 0%; top: 100%; cursor: sw-resize; }
    .nv-canvas-item .nv-rotate-handle {
      position: absolute;
      left: 50%;
      top: -18px;
      width: 12px;
      height: 12px;
      border: 1px solid #2d5eaa;
      border-radius: 50%;
      background: #e9f1ff;
      transform: translate(-50%, -50%);
      cursor: grab;
      z-index: 7;
    }
    .nv-canvas-item .nv-edge-grab {
      position: absolute;
      user-select: none;
      z-index: 5;
      background: transparent;
    }
    .nv-canvas-item .nv-edge-grab[data-edge="n"],
    .nv-canvas-item .nv-edge-grab[data-edge="s"] {
      left: 8px;
      right: 8px;
      height: 8px;
      cursor: move;
    }
    .nv-canvas-item .nv-edge-grab[data-edge="n"] { top: -4px; }
    .nv-canvas-item .nv-edge-grab[data-edge="s"] { bottom: -4px; }
    .nv-canvas-item .nv-edge-grab[data-edge="e"],
    .nv-canvas-item .nv-edge-grab[data-edge="w"] {
      top: 8px;
      bottom: 8px;
      width: 8px;
      cursor: move;
    }
    .nv-canvas-item .nv-edge-grab[data-edge="e"] { right: -4px; }
    .nv-canvas-item .nv-edge-grab[data-edge="w"] { left: -4px; }
    .nv-canvas-item:focus-within,
    .nv-canvas-item:hover {
      border-color: #4b7fd1;
    }
    #wysiwyg img.nv-selected-image {
      outline: 2px solid #2f80ff;
      outline-offset: 2px;
    }
    #wysiwyg .`;

export const HTMLeditorImplStyleSection3 = ` {
      position: relative;
      display: inline-block;
      min-width: 1em;
      min-height: 1em;
      background-image: var(--nodevision-image-text-src);
      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
      color: transparent;
      text-shadow: none;
      user-select: text;
      vertical-align: baseline;
    }
    #wysiwyg .`;

export const HTMLeditorImplStyleSection4 = ` * {
      color: transparent !important;
      text-shadow: none !important;
    }
    #wysiwyg .`;

export const HTMLeditorImplStyleSection5 = `.`;

export const HTMLeditorImplStyleSection6 = ` {
      outline: 2px solid #f59e0b;
      outline-offset: 2px;
      box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.25);
    }
    #wysiwyg audio.nv-selected-audio {
      outline: 2px dashed #2f80ff;
      outline-offset: 2px;
    }
    #wysiwyg .`;
