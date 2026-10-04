// Nodevision/ApplicationSystem/public/panels/panelFactoryParts/CreatePanelDOM.mjs
// This module implements create Panel DOM behavior for the panelFactory feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { installPanelActivationAndGeometry } from "./InstallPanelActivationAndGeometry.mjs";
import { installPanelDockingAndOverlay } from "./InstallPanelDockingAndOverlay.mjs";
import { attachResizeEvents } from "/panels/panelResize.mjs";
import { resolveModulePath, loadModule, callModuleInitializer } from "./ResolveModulePath.mjs";
import { connectPanelDragAndLifecycle } from "./ConnectPanelDragAndLifecycle.mjs";

// Create Panel DOM operations.
export async function createPanelDOM(instanceName, instanceId, panelClass = "GenericPanel", panelVars = {}) {
  const panelState = {};
  installPanelActivationAndGeometry({
    get panelState() {
      return panelState;
    }
  });
  installPanelDockingAndOverlay({
    get panelState() {
      return panelState;
    }
  });
  panelState.addWindowDragListeners = function () {
    if (panelState.hasWindowDragListeners) return;
    window.addEventListener("pointermove", panelState.onPointerMove, true);
    window.addEventListener("pointerup", panelState.onPointerEnd, true);
    window.addEventListener("pointercancel", panelState.onPointerEnd, true);
    window.addEventListener("blur", panelState.onWindowBlur);
    panelState.hasWindowDragListeners = true;
  };
  panelState.removeWindowDragListeners = function () {
    if (!panelState.hasWindowDragListeners) return;
    window.removeEventListener("pointermove", panelState.onPointerMove, true);
    window.removeEventListener("pointerup", panelState.onPointerEnd, true);
    window.removeEventListener("pointercancel", panelState.onPointerEnd, true);
    window.removeEventListener("blur", panelState.onWindowBlur);
    panelState.hasWindowDragListeners = false;
  };
  console.log(`createPanelDOM() called: instance="${instanceName}", id="${instanceId}", class="${panelClass}"`);

  // Create DOM shell
  panelState.panel = document.createElement("div");
  panelState.panel.className = "panel";
  panelState.panel.classList.add("docked");
  panelState.panel.dataset.instanceName = instanceName;
  panelState.panel.dataset.instanceId = instanceId;
  panelState.panel.dataset.panelClass = panelClass;

  // Panel header
  panelState.header = document.createElement("div");
  panelState.header.className = "panel-header";
  panelState.title = document.createElement("span");
  panelState.title.className = "panel-title";
  panelState.title.textContent = panelVars.displayName || instanceName;
  panelState.title.style.fontSize = "13px";
  panelState.header.appendChild(panelState.title);

  // Controls
  panelState.controls = document.createElement("div");
  panelState.controls.className = "panel-controls";
  panelState.controls.style.display = "none";
  panelState.dockBtn = document.createElement("button");
  panelState.dockBtn.className = "panel-dock-btn";
  panelState.dockBtn.title = "Dock / Undock";
  panelState.dockBtn.textContent = "⇔";
  panelState.maxBtn = document.createElement("button");
  panelState.maxBtn.className = "panel-max-btn";
  panelState.maxBtn.title = "Maximize / Restore";
  panelState.maxBtn.textContent = "⬜";
  panelState.closeBtn = document.createElement("button");
  panelState.closeBtn.className = "panel-close-btn";
  panelState.closeBtn.title = "Close";
  panelState.closeBtn.textContent = "✖";
  panelState.confirmBtn = document.createElement("button");
  panelState.confirmBtn.className = "panel-confirm-btn";
  panelState.confirmBtn.title = "Confirm and close overlay";
  panelState.confirmBtn.textContent = "Confirm";
  panelState.confirmBtn.style.display = "none";
  panelState.controls.appendChild(panelState.dockBtn);
  panelState.controls.appendChild(panelState.maxBtn);
  panelState.controls.appendChild(panelState.closeBtn);
  panelState.controls.appendChild(panelState.confirmBtn);
  panelState.header.appendChild(panelState.controls);

  // Content area
  panelState.content = document.createElement("div");
  panelState.content.className = "panel-content";
  panelState.content.innerHTML = `<div class="panel-loading">Loading ${instanceName}...</div>`;

  // Resizer
  panelState.resizer = document.createElement("div");
  panelState.resizer.className = "panel-resizer";

  // Assemble
  panelState.panel.appendChild(panelState.header);
  panelState.panel.appendChild(panelState.content);
  panelState.panel.appendChild(panelState.resizer);
  panelState.cleanupResize = attachResizeEvents(panelState.panel, panelState.resizer); // Try to resolve & load instance module
  panelState.modulePath = resolveModulePath(instanceName, panelClass);
  try {
    panelState.mod = await loadModule(panelState.modulePath);
    panelState.initialized = await callModuleInitializer(panelState.mod, instanceName, panelState.content, panelVars, panelState.panel);
    if (!panelState.initialized) {
      console.warn(`Module loaded from ${panelState.modulePath} but no initializer found. Falling back to default UI.`);
      panelState.content.innerHTML = `
        <div class="generic-panel">
          <h3>${panelVars.displayName || instanceName}</h3>
          <pre>${JSON.stringify(panelVars, null, 2)}</pre>
          <p style="color: #999">Module loaded but no init function exported.</p>
        </div>`;
    }
  } catch (err) {
    console.warn(`Could not load module at ${panelState.modulePath}:`, err);
    // Fallback UI per panelClass
    switch ((panelClass || "").toLowerCase()) {
      case "infopanel":
        panelState.content.innerHTML = `<div class="info-panel"><h3>${panelVars.displayName || instanceName}</h3><pre>${JSON.stringify(panelVars, null, 2)}</pre></div>`;
        break;
      case "editorpanel":
        panelState.content.innerHTML = `<textarea class="code-editor" spellcheck="false">// ${panelVars.displayName || instanceName}</textarea>`;
        break;
      case "viewpanel":
        panelState.content.innerHTML = `<div class="file-view"><p>Unable to load ${instanceName}. See console for details.</p></div>`;
        break;
      default:
        panelState.content.innerHTML = `<div class="generic-panel"><p>Panel type: ${panelClass}</p><pre>${JSON.stringify(panelVars, null, 2)}</pre></div>`;
    }
  }

  // === Panel control behavior ===
  panelState.SNAP_TARGET_CLASS = "undock-snap-target";
  panelState.isMaximized = false;
  panelState.prevStyles = {};
  panelState.isDocked = true;
  panelState.isOverlay = false;
  panelState.overlayKeyHandler = null;
  panelState.overlayDismissHandler = null;
  panelState.offsetX = 0;
  panelState.offsetY = 0;
  panelState.dragging = false;
  panelState.movedWhileDragging = false;
  panelState.activePointerId = null;
  panelState.hasWindowDragListeners = false;
  panelState.dragStartClientX = 0;
  panelState.dragStartClientY = 0;
  panelState.latestPointerX = 0;
  panelState.latestPointerY = 0;
  panelState.snapRafId = 0;
  panelState.currentSnapTarget = null;
  panelState.canSnapToCurrentTarget = false;
  const stageResult7 = connectPanelDragAndLifecycle({
    get panelState() {
      return panelState;
    },
    get panelVars() {
      return panelVars;
    }
  });
  if (stageResult7) return stageResult7.value;
}
