// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/graphManagerLayerControlsWidget.mjs
// Compact Graph Manager layer toggles and File/Graph Manager switcher widgets for the sub-toolbar.

function managerPanelTypeFromValue(value = "") {
  return String(value || "").trim() === "FileManager" ? "FileManager" : "GraphManager";
}

function managerPanelHeading(panelType = "GraphManager") {
  return managerPanelTypeFromValue(panelType) === "FileManager" ? "File Manager" : "Graph Manager";
}

function currentManagerPanelType(item = {}) {
  const explicit = managerPanelTypeFromValue(item.selectedPanel || item.panelType || "");
  if (item.selectedPanel || item.panelType) return explicit;

  const state = window.NodevisionState || {};
  if (state.activePanelType === "FileManager" || state.activePanelType === "GraphManager") {
    return state.activePanelType;
  }

  const nav = window.NodevisionNavigationState;
  const remembered = nav?.getLastInfoPanelType?.() || nav?.lastInfoPanelType;
  return managerPanelTypeFromValue(remembered || "GraphManager");
}

function rememberManagerPanelType(panelType = "GraphManager") {
  const clean = managerPanelTypeFromValue(panelType);
  const nav = window.NodevisionNavigationState;
  nav?.setLastInfoPanelType?.(clean);
  nav?.setLastFileSelectionPanelType?.(clean);
  return clean;
}

function requestManagerPanelSwitch(hostElement, panelType = "GraphManager", item = {}) {
  const clean = rememberManagerPanelType(panelType);
  const pickerOverlay = hostElement?.closest?.("[data-nv-link-picker-overlay]") || document.querySelector("[data-nv-link-picker-overlay]");
  const inPicker = Boolean(item.pickerMode || pickerOverlay);

  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: managerPanelHeading(clean), force: true, toggle: false }
  }));

  if (inPicker) {
    (pickerOverlay || hostElement).dispatchEvent(new CustomEvent("nv-manager-panel-switch", {
      bubbles: true,
      detail: { panelType: clean }
    }));
    return;
  }

  window.dispatchEvent(new CustomEvent("toolbarAction", {
    detail: {
      id: clean,
      type: "InfoPanel",
      replaceActive: true
    }
  }));
}

function renderManagerPanelSwitcher(hostElement, item = {}) {
  hostElement.innerHTML = "";
  hostElement.style.display = "flex";
  hostElement.style.alignItems = "center";
  hostElement.style.gap = "8px";
  hostElement.style.flexWrap = "nowrap";

  const activeType = currentManagerPanelType(item);
  const wrapper = document.createElement("label");
  wrapper.dataset.managerPanelSwitcher = "true";
  wrapper.title = "Switch between File Manager and Graph Manager";
  wrapper.style.cssText = "display:flex;align-items:center;gap:7px;font:12px system-ui,sans-serif;color:#1f2937;white-space:nowrap;";

  const fileLabel = document.createElement("span");
  fileLabel.textContent = "File";
  fileLabel.style.fontWeight = activeType === "FileManager" ? "700" : "500";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "1";
  slider.value = activeType === "FileManager" ? "0" : "1";
  slider.setAttribute("aria-label", "Switch file and graph managers");
  slider.style.cssText = "width:54px;accent-color:#2563eb;cursor:pointer;";

  const graphLabel = document.createElement("span");
  graphLabel.textContent = "Graph";
  graphLabel.style.fontWeight = activeType === "GraphManager" ? "700" : "500";

  const refreshLabels = () => {
    const next = slider.value === "0" ? "FileManager" : "GraphManager";
    fileLabel.style.fontWeight = next === "FileManager" ? "700" : "500";
    graphLabel.style.fontWeight = next === "GraphManager" ? "700" : "500";
  };

  slider.addEventListener("input", refreshLabels);
  slider.addEventListener("change", () => {
    const panelType = slider.value === "0" ? "FileManager" : "GraphManager";
    refreshLabels();
    requestManagerPanelSwitch(hostElement, panelType, item);
  });

  wrapper.append(fileLabel, slider, graphLabel);
  hostElement.appendChild(wrapper);
}

function renderGraphManagerLayerControls(hostElement) {
  hostElement.innerHTML = "";
  hostElement.style.display = "flex";
  hostElement.style.alignItems = "center";
  hostElement.style.gap = "10px";
  hostElement.style.flexWrap = "wrap";

  const controls = document.createElement("div");
  controls.dataset.graphManagerLayerControls = "true";
  controls.style.cssText = "display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12px;color:#1f2937;";
  hostElement.appendChild(controls);

  const bindControls = () => {
    const binder = window.bindGraphManagerLayerControls;
    if (typeof binder === "function") {
      binder(controls);
      return true;
    }
    return false;
  };

  if (!bindControls()) {
    const handleReady = () => bindControls();
    window.addEventListener("graphManagerLayersReady", handleReady, { once: true });
    window.setTimeout(bindControls, 50);
  }
}

export function initToolbarWidget(hostElement, item = {}) {
  if (!hostElement) return;
  if (item?.widget === "managerPanelSwitcher") {
    renderManagerPanelSwitcher(hostElement, item);
    return;
  }
  renderGraphManagerLayerControls(hostElement);
}
