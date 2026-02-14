// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs
// This file populates the panel with the HTML editor.

import { updateToolbarState } from "./../../../panels/createToolbar.mjs";

function ensureHTMLLayoutStyles() {
  if (document.getElementById("nv-html-layout-style")) return;
  const style = document.createElement("style");
  style.id = "nv-html-layout-style";
  style.textContent = `
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
  `;
  document.head.appendChild(style);
}

function insertNodeAtCaret(wysiwyg, node) {
  wysiwyg.focus();
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    wysiwyg.appendChild(node);
  }
}

function getActiveLayoutCanvas(wysiwyg) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.getRangeAt(0).commonAncestorContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const canvas = el && el.closest ? el.closest(".nv-layout-canvas") : null;
  return canvas && wysiwyg.contains(canvas) ? canvas : null;
}

function markEditorOnly(el) {
  if (!el) return el;
  el.classList.add("nv-editor-only");
  el.setAttribute("data-editor-only", "true");
  return el;
}

function appendEditorHandlesToItem(item) {
  if (!item.querySelector(".nv-rotate-handle")) {
    const rotate = document.createElement("div");
    rotate.className = "nv-rotate-handle";
    rotate.title = "Rotate";
    markEditorOnly(rotate);
    item.appendChild(rotate);
  }

  if (item.querySelectorAll(".nv-resize-handle").length === 0) {
    const resizeDirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
    resizeDirs.forEach((dir) => {
      const h = document.createElement("div");
      h.className = "nv-resize-handle";
      h.dataset.dir = dir;
      markEditorOnly(h);
      item.appendChild(h);
    });
  }

  if (item.querySelectorAll(".nv-edge-grab").length === 0) {
    ["n", "s", "e", "w"].forEach((edge) => {
      const edgeGrab = document.createElement("div");
      edgeGrab.className = "nv-edge-grab";
      edgeGrab.dataset.edge = edge;
      markEditorOnly(edgeGrab);
      item.appendChild(edgeGrab);
    });
  }
}

function makeCanvasItemInteractive(item, canvas) {
  if (item.dataset.nvInteractive === "true") return;
  item.dataset.nvInteractive = "true";
  const minWidth = 80;
  const minHeight = 50;

  const getRotation = () => Number(item.dataset.rotation || 0);
  const applyRotation = (deg) => {
    item.dataset.rotation = String(deg);
    item.style.transform = `rotate(${deg}deg)`;
  };

  const startDrag = (startEvt) => {
    startEvt.preventDefault();
    const canvasRect = canvas.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const startX = startEvt.clientX;
    const startY = startEvt.clientY;
    const initialLeft = itemRect.left - canvasRect.left;
    const initialTop = itemRect.top - canvasRect.top;

    const onMove = (moveEvt) => {
      const nextLeft = Math.max(0, initialLeft + (moveEvt.clientX - startX));
      const nextTop = Math.max(0, initialTop + (moveEvt.clientY - startY));
      item.style.left = `${nextLeft}px`;
      item.style.top = `${nextTop}px`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  item.querySelectorAll(".nv-edge-grab").forEach((edge) => {
    edge.addEventListener("pointerdown", startDrag);
  });

  item.querySelectorAll(".nv-resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const dir = handle.dataset.dir || "se";
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = parseFloat(item.style.left) || 0;
      const startTop = parseFloat(item.style.top) || 0;
      const startWidth = item.offsetWidth;
      const startHeight = item.offsetHeight;

      const onMove = (moveEvt) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;

        let nextLeft = startLeft;
        let nextTop = startTop;
        let nextWidth = startWidth;
        let nextHeight = startHeight;

        if (dir.includes("e")) nextWidth = Math.max(minWidth, startWidth + dx);
        if (dir.includes("s")) nextHeight = Math.max(minHeight, startHeight + dy);
        if (dir.includes("w")) {
          nextWidth = Math.max(minWidth, startWidth - dx);
          nextLeft = startLeft + (startWidth - nextWidth);
        }
        if (dir.includes("n")) {
          nextHeight = Math.max(minHeight, startHeight - dy);
          nextTop = startTop + (startHeight - nextHeight);
        }

        item.style.left = `${nextLeft}px`;
        item.style.top = `${nextTop}px`;
        item.style.width = `${nextWidth}px`;
        item.style.height = `${nextHeight}px`;
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  });

  const rotateHandle = item.querySelector(".nv-rotate-handle");
  if (rotateHandle) {
    rotateHandle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const itemRect = item.getBoundingClientRect();
      const cx = itemRect.left + itemRect.width / 2;
      const cy = itemRect.top + itemRect.height / 2;
      const startRotation = getRotation();
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);

      const onMove = (moveEvt) => {
        const angle = Math.atan2(moveEvt.clientY - cy, moveEvt.clientX - cx);
        const deg = startRotation + ((angle - startAngle) * 180 / Math.PI);
        applyRotation(Math.round(deg));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  applyRotation(getRotation());
}

function ensureCanvasResizeHandles(canvas) {
  if (canvas.querySelectorAll(".nv-canvas-resize-handle").length > 0) return;
  const resizeDirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  resizeDirs.forEach((dir) => {
    const h = document.createElement("div");
    h.className = "nv-resize-handle nv-canvas-resize-handle";
    h.dataset.dir = dir;
    markEditorOnly(h);
    canvas.appendChild(h);
  });
}

function makeLayoutCanvasResizable(canvas) {
  if (canvas.dataset.nvResizable === "true") return;
  canvas.dataset.nvResizable = "true";
  const minWidth = 200;
  const minHeight = 160;

  const onResizeStart = (handle, startEvt) => {
    startEvt.preventDefault();
    const dir = handle.dataset.dir || "se";
    const startX = startEvt.clientX;
    const startY = startEvt.clientY;
    const startWidth = canvas.offsetWidth;
    const startHeight = canvas.offsetHeight;
    const styles = window.getComputedStyle(canvas);
    const startMarginLeft = parseFloat(styles.marginLeft) || 0;
    const startMarginTop = parseFloat(styles.marginTop) || 0;

    canvas.style.width = `${startWidth}px`;
    canvas.style.height = `${startHeight}px`;

    const onMove = (moveEvt) => {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;

      let nextWidth = startWidth;
      let nextHeight = startHeight;
      let nextMarginLeft = startMarginLeft;
      let nextMarginTop = startMarginTop;

      if (dir.includes("e")) nextWidth = Math.max(minWidth, startWidth + dx);
      if (dir.includes("s")) nextHeight = Math.max(minHeight, startHeight + dy);
      if (dir.includes("w")) {
        nextWidth = Math.max(minWidth, startWidth - dx);
        nextMarginLeft = startMarginLeft + (startWidth - nextWidth);
      }
      if (dir.includes("n")) {
        nextHeight = Math.max(minHeight, startHeight - dy);
        nextMarginTop = startMarginTop + (startHeight - nextHeight);
      }

      canvas.style.width = `${nextWidth}px`;
      canvas.style.height = `${nextHeight}px`;
      canvas.style.marginLeft = `${nextMarginLeft}px`;
      canvas.style.marginTop = `${nextMarginTop}px`;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  canvas.querySelectorAll(".nv-canvas-resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => onResizeStart(handle, e));
  });
}

function createCanvasItem({
  typeLabel,
  x = 24,
  y = 24,
  width = 220,
  height = 120,
  contentNode,
  editable = false,
}) {
  const item = document.createElement("div");
  item.className = "nv-canvas-item";
  item.style.left = `${x}px`;
  item.style.top = `${y}px`;
  item.style.width = `${width}px`;
  item.style.height = `${height}px`;
  item.dataset.rotation = "0";

  const content = document.createElement("div");
  content.className = "nv-item-content";
  if (editable) {
    content.setAttribute("contenteditable", "true");
  } else {
    content.setAttribute("contenteditable", "false");
  }
  content.appendChild(contentNode);
  item.appendChild(content);
  appendEditorHandlesToItem(item);
  return item;
}

async function chooseImageSource() {
  const typed = prompt(
    "Enter image URL/path (or leave blank to pick a local PNG/SVG file):",
    ""
  );
  if (typed && typed.trim()) return typed.trim();

  return new Promise((resolve) => {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/png,image/svg+xml,image/*";
    picker.style.display = "none";
    document.body.appendChild(picker);

    const cleanup = () => {
      if (picker.parentNode) picker.parentNode.removeChild(picker);
    };

    picker.addEventListener("change", () => {
      const file = picker.files && picker.files[0];
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        cleanup();
        resolve(typeof reader.result === "string" ? reader.result : null);
      };
      reader.onerror = () => {
        cleanup();
        resolve(null);
      };
      reader.readAsDataURL(file);
    }, { once: true });

    picker.click();
  });
}

function attachCanvasTools(canvas) {
  let tools = canvas.querySelector(".nv-canvas-tools");
  if (!tools) {
    tools = document.createElement("div");
    tools.className = "nv-canvas-tools";
    canvas.appendChild(tools);
  }
  markEditorOnly(tools);

  let addTextBtn = tools.querySelector('button[data-action="add-text"]');
  if (!addTextBtn) {
    addTextBtn = document.createElement("button");
    addTextBtn.type = "button";
    addTextBtn.dataset.action = "add-text";
    addTextBtn.textContent = "+ Text";
    tools.appendChild(addTextBtn);
  }

  let addImageBtn = tools.querySelector('button[data-action="add-image"]');
  if (!addImageBtn) {
    addImageBtn = document.createElement("button");
    addImageBtn.type = "button";
    addImageBtn.dataset.action = "add-image";
    addImageBtn.textContent = "+ Image";
    tools.appendChild(addImageBtn);
  }

  let hint = canvas.querySelector(".nv-canvas-hint");
  if (!hint) {
    hint = document.createElement("div");
    hint.className = "nv-canvas-hint";
    hint.textContent = "Layout canvas: add text/images and drag them to position.";
    hint.style.fontSize = "12px";
    hint.style.color = "#666";
    hint.style.marginTop = "2px";
    canvas.appendChild(hint);
  }
  markEditorOnly(hint);

  if (tools.dataset.nvBound !== "true") {
    const addTextBlock = () => {
      const content = document.createElement("div");
      content.textContent = "Edit this text";
      const item = createCanvasItem({
        typeLabel: "Text",
        x: 24 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        y: 36 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        width: 240,
        height: 120,
        contentNode: content,
        editable: true,
      });
      canvas.appendChild(item);
      makeCanvasItemInteractive(item, canvas);
      const editable = item.querySelector('.nv-item-content[contenteditable="true"]');
      if (editable) editable.focus();
    };

    const addImageBlock = async () => {
      const src = await chooseImageSource();
      if (!src) return;

      const img = document.createElement("img");
      img.src = src;
      img.alt = "Inserted media";
      const item = createCanvasItem({
        typeLabel: "Media",
        x: 40 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        y: 48 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
        width: 280,
        height: 200,
        contentNode: img,
        editable: false,
      });
      canvas.appendChild(item);
      makeCanvasItemInteractive(item, canvas);
    };

    addTextBtn.addEventListener("click", addTextBlock);
    addImageBtn.addEventListener("click", addImageBlock);
    tools.dataset.nvBound = "true";
  }
}

function registerHTMLLayoutTools(wysiwyg) {
  const createLayoutCanvas = () => {
    const canvas = document.createElement("div");
    canvas.className = "nv-layout-canvas";
    canvas.setAttribute("contenteditable", "false");

    attachCanvasTools(canvas);
    ensureCanvasResizeHandles(canvas);
    makeLayoutCanvasResizable(canvas);

    return canvas;
  };

  const insertLayoutCanvas = () => {
    const canvas = createLayoutCanvas();
    insertNodeAtCaret(wysiwyg, canvas);
    return canvas;
  };

  const insertPositionableImage = async () => {
    let canvas = getActiveLayoutCanvas(wysiwyg);
    if (!canvas) {
      canvas = insertLayoutCanvas();
    }

    const src = await chooseImageSource();
    if (!src) return;

    const img = document.createElement("img");
    img.src = src;
    img.alt = "Inserted media";
    const item = createCanvasItem({
      typeLabel: "Media",
      x: 32 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
      y: 44 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
      width: 280,
      height: 200,
      contentNode: img,
      editable: false,
    });
    canvas.appendChild(item);
    makeCanvasItemInteractive(item, canvas);
  };

  window.HTMLWysiwygTools = {
    insertLayoutCanvas,
    insertPositionableImage,
  };
}

function rehydrateLayoutCanvases(wysiwyg) {
  const canvases = wysiwyg.querySelectorAll(".nv-layout-canvas");
  canvases.forEach((canvas) => {
    canvas.setAttribute("contenteditable", "false");
    attachCanvasTools(canvas);
    ensureCanvasResizeHandles(canvas);
    makeLayoutCanvasResizable(canvas);
    canvas.querySelectorAll(".nv-canvas-item").forEach((item) => {
      appendEditorHandlesToItem(item);
      makeCanvasItemInteractive(item, canvas);
    });
  });
}

function getPrevNode(root, node) {
  if (!node) return null;
  if (node.previousSibling) {
    let n = node.previousSibling;
    while (n && n.lastChild) n = n.lastChild;
    return n;
  }
  if (node.parentNode && node.parentNode !== root) {
    return getPrevNode(root, node.parentNode);
  }
  return null;
}

function getNextNode(root, node) {
  if (!node) return null;
  if (node.firstChild) return node.firstChild;
  let n = node;
  while (n && n !== root) {
    if (n.nextSibling) return n.nextSibling;
    n = n.parentNode;
  }
  return null;
}

function findAdjacentCanvas(root, range, direction) {
  let node = null;
  if (direction === "backward") {
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      if (range.startOffset > 0) return null;
      node = getPrevNode(root, range.startContainer);
    } else {
      const container = range.startContainer;
      if (container.childNodes && range.startOffset > 0) {
        node = container.childNodes[range.startOffset - 1];
        while (node && node.lastChild) node = node.lastChild;
      } else {
        node = getPrevNode(root, container);
      }
    }
  } else {
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const text = range.startContainer;
      if (range.startOffset < (text.nodeValue || "").length) return null;
      node = getNextNode(root, text);
    } else {
      const container = range.startContainer;
      if (container.childNodes && range.startOffset < container.childNodes.length) {
        node = container.childNodes[range.startOffset];
      } else {
        node = getNextNode(root, container);
      }
    }
  }

  const skipEmptyText = (n) => {
    let current = n;
    while (current && current.nodeType === Node.TEXT_NODE && !(current.nodeValue || "").trim()) {
      current = direction === "backward" ? getPrevNode(root, current) : getNextNode(root, current);
    }
    return current;
  };

  const candidate = skipEmptyText(node);
  if (!candidate) return null;
  const element = candidate.nodeType === Node.ELEMENT_NODE ? candidate : candidate.parentElement;
  const canvas = element && element.closest ? element.closest(".nv-layout-canvas") : null;
  return canvas && root.contains(canvas) ? canvas : null;
}

function registerCanvasDeletionHotkeys(wysiwyg) {
  const onKeyDown = (e) => {
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed) return;
    const anchor = sel.anchorNode;
    if (!anchor) return;
    const anchorEl = anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement;
    if (anchorEl && anchorEl.closest && anchorEl.closest(".nv-layout-canvas")) return;

    const range = sel.getRangeAt(0);
    const direction = e.key === "Backspace" ? "backward" : "forward";
    const target = findAdjacentCanvas(wysiwyg, range, direction);
    if (target) {
      e.preventDefault();
      target.remove();
    }
  };
  wysiwyg.addEventListener("keydown", onKeyDown);
  return () => wysiwyg.removeEventListener("keydown", onKeyDown);
}


// --------------------------------------------------
// Fallback Hotkeys (self-contained)
// --------------------------------------------------
function registerHTMLFallbackHotkeys(wysiwyg, filePath, rootElem) {
  const handlers = {
    "Control+s": (e) => {
      e.preventDefault();
      if (window.saveWYSIWYGFile) {
        window.saveWYSIWYGFile(filePath);
      }
      console.log("🔧 Fallback hotkey: Save");
    },

    "Control+b": (e) => {
      e.preventDefault();
      document.execCommand("bold");
      console.log("🔧 Fallback hotkey: Bold");
    },

    "Control+i": (e) => {
      e.preventDefault();
      document.execCommand("italic");
      console.log("🔧 Fallback hotkey: Italic");
    },

    "Control+u": (e) => {
      e.preventDefault();
      document.execCommand("underline");
      console.log("🔧 Fallback hotkey: Underline");
    },

    "Control+z": (e) => {
      e.preventDefault();
      document.execCommand("undo");
      console.log("🔧 Fallback hotkey: Undo");
    },

    "Control+Shift+z": (e) => {
      e.preventDefault();
      document.execCommand("redo");
      console.log("🔧 Fallback hotkey: Redo");
    }
  };

  const onKeyDown = (e) => {
    const key =
      (e.ctrlKey ? "Control+" : "") +
      (e.shiftKey ? "Shift+" : "") +
      e.key.toLowerCase();

    if (handlers[key]) {
      handlers[key](e);
    }
  };

  rootElem.addEventListener("keydown", onKeyDown);

  console.log("🔧 HTML Fallback Hotkeys Loaded");

  return () => rootElem.removeEventListener("keydown", onKeyDown);
}

// --------------------------------------------------
// Main HTML Editor
// --------------------------------------------------

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  if (typeof container.__cleanupHTMLHotkeys === "function") {
    container.__cleanupHTMLHotkeys();
    container.__cleanupHTMLHotkeys = null;
  }
  container.innerHTML = "";
  ensureHTMLLayoutStyles();

  // Set mode
  window.NodevisionState.currentMode = "HTMLediting";
  updateToolbarState({ currentMode: "HTMLediting" });


  // Root container
  const wrapper = document.createElement("div");
  wrapper.id = "editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  container.appendChild(wrapper);

  // WYSIWYG editable area
  const wysiwyg = document.createElement("div");
  wysiwyg.id = "wysiwyg";
  wysiwyg.contentEditable = "true";
  wysiwyg.style.flex = "1";
  wysiwyg.style.overflow = "auto";
  wysiwyg.style.padding = "12px";
  wrapper.appendChild(wysiwyg);

  // Hidden script container
  const hidden = document.createElement("div");
  hidden.id = "hidden-elements";
  hidden.style.display = "none";
  wrapper.appendChild(hidden);
  registerHTMLLayoutTools(wysiwyg);

  try {
    const res = await fetch(`/Notebook/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);
    const htmlText = await res.text();

    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    // Clone <head>
    const headClone = document.createElement("div");
    for (const el of doc.head.children) {
      if (el.tagName === "SCRIPT") {
        const placeholder = document.createElement("div");
        placeholder.dataset.script = el.textContent;
        hidden.appendChild(placeholder);
      } else {
        headClone.appendChild(el.cloneNode(true));
      }
    }
    wrapper.prepend(headClone);

    // Clone <body>
    for (const child of doc.body.children) {
      if (child.tagName === "SCRIPT") {
        const placeholder = document.createElement("div");
        placeholder.dataset.script = child.textContent;
        hidden.appendChild(placeholder);
      } else {
        wysiwyg.appendChild(child.cloneNode(true));
      }
    }

    // Saving function
    window.getEditorHTML = () => {
      const headContent = Array.from(headClone.children)
        .map(el => el.outerHTML)
        .join("\n");

      const bodyClone = wysiwyg.cloneNode(true);
      bodyClone.querySelectorAll(".nv-editor-only").forEach((el) => el.remove());
      bodyClone.querySelectorAll("[data-nv-interactive]").forEach((el) => {
        el.removeAttribute("data-nv-interactive");
      });
      bodyClone.querySelectorAll("[data-nv-resizable]").forEach((el) => {
        el.removeAttribute("data-nv-resizable");
      });
      const bodyContent = bodyClone.innerHTML;

      const scripts = Array.from(hidden.children)
        .map(el => `<script>${el.dataset.script}</script>`)
        .join("\n");

      return `<!DOCTYPE html><html><head>${headContent}</head><body>${bodyContent}${scripts}</body></html>`;
    };

    window.setEditorHTML = (html) => {
      const doc = parser.parseFromString(html, "text/html");
      wysiwyg.innerHTML = "";
      hidden.innerHTML = "";

      for (const el of doc.body.children) {
        if (el.tagName === "SCRIPT") {
          const placeholder = document.createElement("div");
          placeholder.dataset.script = el.textContent;
          hidden.appendChild(placeholder);
        } else {
          wysiwyg.appendChild(el.cloneNode(true));
        }
      }
    };

    window.saveWYSIWYGFile = async (path) => {
      const content = window.getEditorHTML();
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path || filePath, content }),
      });
      console.log("Saved WYSIWYG file:", path || filePath);
    };

  } catch (err) {
    wrapper.innerHTML =
      `<div style="color:red;padding:12px">Failed to load file: ${err.message}</div>`;
    console.error(err);
  }

  rehydrateLayoutCanvases(wysiwyg);

  // --------------------------------------------------
  // Enable fallback hotkeys
  // --------------------------------------------------
  container.__cleanupHTMLHotkeys = registerHTMLFallbackHotkeys(wysiwyg, filePath, wrapper);
  if (typeof container.__cleanupHTMLCanvasDeletion === "function") {
    container.__cleanupHTMLCanvasDeletion();
  }
  container.__cleanupHTMLCanvasDeletion = registerCanvasDeletionHotkeys(wysiwyg);
}
