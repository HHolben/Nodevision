export function insertNodeAtCaret(wysiwyg, node) {
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

export function getActiveLayoutCanvas(wysiwyg) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.getRangeAt(0).commonAncestorContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const canvas = el && el.closest ? el.closest(".nv-layout-canvas") : null;
  return canvas && wysiwyg.contains(canvas) ? canvas : null;
}

export function markEditorOnly(el) {
  if (!el) return el;
  el.classList.add("nv-editor-only");
  el.setAttribute("data-editor-only", "true");
  return el;
}

export function appendEditorHandlesToItem(item) {
  if (!item.querySelector(".nv-rotate-handle")) {
    const rotate = document.createElement("div");
    rotate.className = "nv-rotate-handle";
    rotate.title = "Rotate";
    markEditorOnly(rotate);
    item.appendChild(rotate);
  }
  if (item.querySelectorAll(".nv-resize-handle").length === 0) {
    ["n","s","e","w","ne","nw","se","sw"].forEach((dir) => {
      const h = document.createElement("div");
      h.className = "nv-resize-handle";
      h.dataset.dir = dir;
      markEditorOnly(h);
      item.appendChild(h);
    });
  }
  if (item.querySelectorAll(".nv-edge-grab").length === 0) {
    ["n","s","e","w"].forEach((edge) => {
      const edgeGrab = document.createElement("div");
      edgeGrab.className = "nv-edge-grab";
      edgeGrab.dataset.edge = edge;
      markEditorOnly(edgeGrab);
      item.appendChild(edgeGrab);
    });
  }
}

export function getPrevNode(root, node) {
  if (!node) return null;
  if (node.previousSibling) {
    let n = node.previousSibling;
    while (n && n.lastChild) n = n.lastChild;
    return n;
  }
  if (node.parentNode && node.parentNode !== root) return getPrevNode(root, node.parentNode);
  return null;
}

export function getNextNode(root, node) {
  if (!node) return null;
  if (node.firstChild) return node.firstChild;
  let n = node;
  while (n && n !== root) {
    if (n.nextSibling) return n.nextSibling;
    n = n.parentNode;
  }
  return null;
}

export function findAdjacentCanvas(root, range, direction) {
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
