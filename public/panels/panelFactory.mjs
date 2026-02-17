// Nodevision/public/panels/panelFactory.mjs
// Panel factory: creates DOM containers for panels, lazy-loads per-instance modules,
// and invokes the panel's exported initializer. Uses a module cache to avoid re-imports.

const moduleCache = new Map();

/**
 * Resolve the module path for a given instance and class.
 * instanceName: e.g. "FileManager", "CodeEditor", "GraphPanel"
 * panelClass: e.g. "InfoPanel", "EditorPanel", "ViewPanel", "ControlPanel", "ToolPanel"
 */
function resolveModulePath(instanceName, panelClass) {
  const base = "/PanelInstances";
  switch ((panelClass || "").toLowerCase()) {
    case "infopanel":
      return `${base}/InfoPanels/${instanceName}.mjs`;
    case "editorpanel":
      return `${base}/EditorPanels/${instanceName}.mjs`;
    case "viewpanel":
      // "Viewer" or "ViewerPanels" — we used ViewerPanels earlier, so accept both
      return `${base}/ViewerPanels/${instanceName}.mjs`;
    case "controlpanel":
      return `${base}/ControlPanels/${instanceName}.mjs`;
    case "toolpanel":
      return `${base}/ToolPanels/${instanceName}.mjs`;
    case "compositepanel":
      return `${base}/CompositePanels/${instanceName}.mjs`;
    default:
      // generic fallback (top-level PanelInstances)
      return `${base}/${instanceName}.mjs`;
  }
}

/**
 * Load and cache a module via dynamic import.
 */
async function loadModule(modulePath) {
  if (moduleCache.has(modulePath)) {
    return moduleCache.get(modulePath);
  }
  // dynamic import; we rely on the server to serve the file under /PanelInstances/...
  const mod = await import(modulePath);
  moduleCache.set(modulePath, mod);
  return mod;
}

/**
 * Attempt to find an initializer function on the module and call it.
 * Acceptable names (in order):
 *  - createPanel(content, vars, panel)
 *  - init(content, vars, panel)
 *  - initializePanel(content, vars, panel)
 *  - create<InstanceName>Panel(content, vars, panel)
 *  - default export (if function)
 */
async function callModuleInitializer(mod, instanceName, contentElem, panelVars = {}, panelRoot = null) {
  const candidates = [
    "createPanel",
    "init",
    "initializePanel",
    `create${instanceName}Panel`,
    `create${instanceName.toLowerCase()}panel`
  ];

  for (const name of candidates) {
    if (typeof mod[name] === "function") {
      await mod[name](contentElem, panelVars, panelRoot);
      return true;
    }
  }

  if (typeof mod.default === "function") {
    await mod.default(contentElem, panelVars, panelRoot);
    return true;
  }

  return false;
}

/**
 * Main factory function
 * instanceName: e.g. "FileManager" (module file named FileManager.mjs)
 * instanceId: unique id for the DOM instance (e.g. "panel-3")
 * panelClass: the class/type (InfoPanel, EditorPanel, ViewPanel, etc.)
 * panelVars: object with contextual variables (filePath, currentDirectory, etc.)
 *
 * Returns { panel, header, dockBtn, maxBtn, closeBtn, resizer, content }
 */
export async function createPanelDOM(instanceName, instanceId, panelClass = "GenericPanel", panelVars = {}) {
  console.log(`createPanelDOM() called: instance="${instanceName}", id="${instanceId}", class="${panelClass}"`);

  // Create DOM shell
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.classList.add("docked");
  panel.dataset.instanceName = instanceName;
  panel.dataset.instanceId = instanceId;
  panel.dataset.panelClass = panelClass;

  // Panel header
  const header = document.createElement("div");
  header.className = "panel-header";

  const title = document.createElement("span");
  title.className = "panel-title";
  title.textContent = panelVars.displayName || instanceName;
  title.style.fontSize = "13px";
  header.appendChild(title);

  // Controls
  const controls = document.createElement("div");
  controls.className = "panel-controls";
  controls.style.display = "none";

  const dockBtn = document.createElement("button");
  dockBtn.className = "panel-dock-btn";
  dockBtn.title = "Dock / Undock";
  dockBtn.textContent = "⇔";

  const maxBtn = document.createElement("button");
  maxBtn.className = "panel-max-btn";
  maxBtn.title = "Maximize / Restore";
  maxBtn.textContent = "⬜";

  const closeBtn = document.createElement("button");
  closeBtn.className = "panel-close-btn";
  closeBtn.title = "Close";
  closeBtn.textContent = "✖";

  controls.appendChild(dockBtn);
  controls.appendChild(maxBtn);
  controls.appendChild(closeBtn);
  header.appendChild(controls);

  // Content area
  const content = document.createElement("div");
  content.className = "panel-content";
  content.innerHTML = `<div class="panel-loading">Loading ${instanceName}...</div>`;

  // Resizer
  const resizer = document.createElement("div");
  resizer.className = "panel-resizer";

  // Assemble
  panel.appendChild(header);
  panel.appendChild(content);
  panel.appendChild(resizer);

  // Try to resolve & load instance module
  const modulePath = resolveModulePath(instanceName, panelClass);

  try {
    const mod = await loadModule(modulePath);

    const initialized = await callModuleInitializer(mod, instanceName, content, panelVars, panel);

    if (!initialized) {
      console.warn(`Module loaded from ${modulePath} but no initializer found. Falling back to default UI.`);
      content.innerHTML = `
        <div class="generic-panel">
          <h3>${panelVars.displayName || instanceName}</h3>
          <pre>${JSON.stringify(panelVars, null, 2)}</pre>
          <p style="color: #999">Module loaded but no init function exported.</p>
        </div>`;
    }
  } catch (err) {
    console.warn(`Could not load module at ${modulePath}:`, err);
    // Fallback UI per panelClass
    switch ((panelClass || "").toLowerCase()) {
      case "infopanel":
        content.innerHTML = `<div class="info-panel"><h3>${panelVars.displayName || instanceName}</h3><pre>${JSON.stringify(panelVars, null, 2)}</pre></div>`;
        break;
      case "editorpanel":
        content.innerHTML = `<textarea class="code-editor" spellcheck="false">// ${panelVars.displayName || instanceName}</textarea>`;
        break;
      case "viewpanel":
        content.innerHTML = `<div class="file-view"><p>Unable to load ${instanceName}. See console for details.</p></div>`;
        break;
      default:
        content.innerHTML = `<div class="generic-panel"><p>Panel type: ${panelClass}</p><pre>${JSON.stringify(panelVars, null, 2)}</pre></div>`;
    }
  }



  // === Panel control behavior ===

  const SNAP_TARGET_CLASS = "undock-snap-target";
  let isMaximized = false;
  let prevStyles = {};
  let isDocked = true;
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let movedWhileDragging = false;
  let activePointerId = null;
  let hasWindowDragListeners = false;
  let dragStartClientX = 0;
  let dragStartClientY = 0;
  let latestPointerX = 0;
  let latestPointerY = 0;
  let snapRafId = 0;
  let currentSnapTarget = null;
  let canSnapToCurrentTarget = false;
  let highlightedSnapTarget = null;
  let lastDockParent = null;
  let lastDockNextSibling = null;
  let lastDockCell = null;

  function openLayoutControlsSubToolbar() {
    setActiveContextFromPanel();
    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: {
        heading: "Layout Controls",
        force: false,
        toggle: false,
      },
    }));
  }

  function setActiveContextFromPanel() {
    const owningCell = panel.closest(".panel-cell") || panel.__nvDefaultDockCell || lastDockCell || null;
    window.__nvActivePanelElement = panel;
    window.activePanel = panel.dataset.instanceName || panel.dataset.instanceId || "Panel";
    window.activePanelClass = panel.dataset.panelClass || "GenericPanel";
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.activePanelType = window.activePanelClass;

    if (owningCell && owningCell.classList?.contains("panel-cell")) {
      window.activeCell = owningCell;
      document.querySelectorAll(".panel-cell").forEach((c) => {
        c.style.outline = "";
      });
      owningCell.style.outline = "2px solid #0078d7";
      window.dispatchEvent(new CustomEvent("activePanelChanged", {
        detail: {
          panel: window.activePanel,
          cell: owningCell,
          panelClass: window.activePanelClass,
        },
      }));
    }
  }

  function clearTargetHighlight() {
    if (highlightedSnapTarget?.classList) {
      highlightedSnapTarget.classList.remove(SNAP_TARGET_CLASS);
    }
    highlightedSnapTarget = null;
  }

  function bringToFront() {
    const maxZ = Array.from(document.querySelectorAll(".panel"))
      .map((el) => Number.parseInt(el.style.zIndex || "0", 10) || 0)
      .reduce((a, b) => Math.max(a, b), 1000);
    panel.style.zIndex = String(maxZ + 1);
  }

  function isOutsideInner80Percent(cell, clientX, clientY) {
    if (!cell) return false;
    const rect = cell.getBoundingClientRect();
    const marginX = rect.width * 0.1;
    const marginY = rect.height * 0.1;
    const innerLeft = rect.left + marginX;
    const innerRight = rect.right - marginX;
    const innerTop = rect.top + marginY;
    const innerBottom = rect.bottom - marginY;
    const insideInnerX = clientX >= innerLeft && clientX <= innerRight;
    const insideInnerY = clientY >= innerTop && clientY <= innerBottom;
    return !(insideInnerX && insideInnerY);
  }

  function setDockedStyles() {
    panel.classList.remove("floating");
    panel.classList.add("docked");
    panel.style.position = "relative";
    panel.style.top = "";
    panel.style.left = "";
    panel.style.zIndex = "";
    panel.style.width = "";
    panel.style.height = "";
  }

  function setFloatingStyles(left, top, width = null, height = null) {
    panel.classList.remove("docked");
    panel.classList.add("floating");
    panel.style.position = "absolute";
    panel.style.left = `${Math.max(8, Math.round(left))}px`;
    panel.style.top = `${Math.max(8, Math.round(top))}px`;
    const currentWidth = String(panel.style.width || "").trim();
    const currentHeight = String(panel.style.height || "").trim();
    if (!currentWidth || currentWidth === "100%") {
      const nextWidth = Math.max(280, Math.round(width || 460));
      panel.style.width = `${nextWidth}px`;
    }
    if (!currentHeight || currentHeight === "100%") {
      const nextHeight = Math.max(200, Math.round(height || 340));
      panel.style.height = `${nextHeight}px`;
    }
    bringToFront();
  }

  function getDefaultDockCell() {
    const override = panel.__nvDefaultDockCell;
    if (override && override.isConnected && override.classList?.contains("panel-cell")) {
      return override;
    }
    if (lastDockCell && lastDockCell.isConnected) return lastDockCell;
    return null;
  }

  function dockPanel(targetCell = null) {
    const resolvedCell = (
      targetCell &&
      targetCell.isConnected &&
      targetCell.classList?.contains("panel-cell")
    ) ? targetCell : getDefaultDockCell();

    if (resolvedCell) {
      resolvedCell.appendChild(panel);
      lastDockCell = resolvedCell;
    } else if (lastDockParent && lastDockParent.isConnected && lastDockParent !== document.body) {
      if (
        lastDockNextSibling &&
        lastDockNextSibling.isConnected &&
        lastDockNextSibling.parentNode === lastDockParent
      ) {
        lastDockParent.insertBefore(panel, lastDockNextSibling);
      } else {
        lastDockParent.appendChild(panel);
      }
    } else {
      return false;
    }

    setDockedStyles();
    isDocked = true;
    return true;
  }

  function undockPanel() {
    if (!isDocked) return;
    const rect = panel.getBoundingClientRect();
    lastDockParent = panel.parentNode || null;
    lastDockNextSibling = panel.nextSibling || null;
    lastDockCell = panel.closest(".panel-cell");
    document.body.appendChild(panel);
    setFloatingStyles(
      rect.left + window.scrollX,
      rect.top + window.scrollY,
      rect.width,
      rect.height
    );
    isDocked = false;
  }

  maxBtn.addEventListener("click", () => {
    if (!isMaximized) {
      prevStyles = {
        width: panel.style.width,
        height: panel.style.height,
        top: panel.style.top,
        left: panel.style.left,
        position: panel.style.position,
        zIndex: panel.style.zIndex
      };
      panel.classList.add("maximized");
      Object.assign(panel.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        zIndex: "9999"
      });
      isMaximized = true;
    } else {
      panel.classList.remove("maximized");
      Object.assign(panel.style, prevStyles);
      isMaximized = false;
    }
  });

  closeBtn.addEventListener("click", () => {
    removeWindowDragListeners();
    clearTargetHighlight();
    if (window.__nvActivePanelElement === panel) {
      window.__nvActivePanelElement = null;
    }
    panel.remove();
  });

  dockBtn.addEventListener("click", () => {
    if (isMaximized) {
      maxBtn.click();
    }
    if (isDocked) {
      undockPanel();
    } else {
      dockPanel();
      clearTargetHighlight();
      currentSnapTarget = null;
      canSnapToCurrentTarget = false;
    }
  });

  header.style.cursor = "move";
  header.style.touchAction = "none";

  function updateSnapTarget(clientX, clientY) {
    const hit = document
      .elementsFromPoint(clientX, clientY)
      .find((el) => el.classList?.contains("panel-cell") && !panel.contains(el));

    currentSnapTarget = hit || null;
    canSnapToCurrentTarget = isOutsideInner80Percent(currentSnapTarget, clientX, clientY);

    const nextHighlighted = (currentSnapTarget && canSnapToCurrentTarget) ? currentSnapTarget : null;
    if (nextHighlighted !== highlightedSnapTarget) {
      clearTargetHighlight();
      if (nextHighlighted) {
        nextHighlighted.classList.add(SNAP_TARGET_CLASS);
        highlightedSnapTarget = nextHighlighted;
      }
    }
  }

  function scheduleSnapUpdate(clientX, clientY) {
    latestPointerX = clientX;
    latestPointerY = clientY;
    if (snapRafId) return;
    snapRafId = window.requestAnimationFrame(() => {
      snapRafId = 0;
      updateSnapTarget(latestPointerX, latestPointerY);
    });
  }

  function finishDrag(clientX, clientY) {
    if (!dragging) return;
    dragging = false;
    panel.style.userSelect = "";
    panel.style.willChange = "";

    if (snapRafId) {
      window.cancelAnimationFrame(snapRafId);
      snapRafId = 0;
    }

    updateSnapTarget(clientX, clientY);
    if (currentSnapTarget && canSnapToCurrentTarget) {
      dockPanel(currentSnapTarget);
    }

    clearTargetHighlight();
    currentSnapTarget = null;
    canSnapToCurrentTarget = false;
  }

  const onPointerMove = (e) => {
    if (!dragging || e.pointerId !== activePointerId || isDocked || isMaximized) return;
    if (!movedWhileDragging) {
      const dx = Math.abs(e.clientX - dragStartClientX);
      const dy = Math.abs(e.clientY - dragStartClientY);
      if (dx > 2 || dy > 2) movedWhileDragging = true;
    }
    panel.style.left = `${e.clientX - offsetX}px`;
    panel.style.top = `${e.clientY - offsetY}px`;
    scheduleSnapUpdate(e.clientX, e.clientY);
  };

  const onPointerEnd = (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    try {
      header.releasePointerCapture?.(e.pointerId);
    } catch (_) {
      // No-op: fallback window listeners keep drag termination reliable.
    }
    activePointerId = null;
    finishDrag(e.clientX, e.clientY);
    removeWindowDragListeners();
  };

  const onWindowBlur = () => {
    if (!dragging) return;
    activePointerId = null;
    finishDrag(latestPointerX, latestPointerY);
    removeWindowDragListeners();
  };

  function addWindowDragListeners() {
    if (hasWindowDragListeners) return;
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerEnd, true);
    window.addEventListener("pointercancel", onPointerEnd, true);
    window.addEventListener("blur", onWindowBlur);
    hasWindowDragListeners = true;
  }

  function removeWindowDragListeners() {
    if (!hasWindowDragListeners) return;
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerEnd, true);
    window.removeEventListener("pointercancel", onPointerEnd, true);
    window.removeEventListener("blur", onWindowBlur);
    hasWindowDragListeners = false;
  }

  header.addEventListener("pointerdown", (e) => {
    if (e.target?.closest?.("button, a, input, select, textarea")) return;
    if (isDocked || isMaximized) return;

    const rect = panel.getBoundingClientRect();
    dragging = true;
    movedWhileDragging = false;
    activePointerId = e.pointerId;
    dragStartClientX = e.clientX;
    dragStartClientY = e.clientY;
    latestPointerX = e.clientX;
    latestPointerY = e.clientY;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    panel.style.userSelect = "none";
    panel.style.willChange = "left, top";
    bringToFront();
    addWindowDragListeners();
    try {
      header.setPointerCapture?.(e.pointerId);
    } catch (_) {
      // No-op: window-level listeners are the primary drag source of truth.
    }
    e.preventDefault();
  });

  header.addEventListener("click", () => {
    if (movedWhileDragging) {
      movedWhileDragging = false;
      return;
    }
    openLayoutControlsSubToolbar();
  });


  return { panel, header, dockBtn, maxBtn, closeBtn, resizer, content };
}
