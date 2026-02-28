// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/functionPlotterPanel.mjs
// Undocked panel for safe math function plot configuration.

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseFloatSafe(value, fallback) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseIntSafe(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function createFunctionPlotterPanel() {
  let visible = false;
  let pendingConfig = null;

  const floatingPanel = createFloatingInventoryPanel({
    title: "Function Plotter",
    onRequestClose: () => {
      visible = false;
      floatingPanel.setVisible(false);
    }
  });
  floatingPanel.setVisible(false);

  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "10px";
  root.style.font = "12px/1.35 monospace";
  floatingPanel.content.appendChild(root);

  function addLabeledField(labelText, input) {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.flexDirection = "column";
    label.style.gap = "4px";
    label.textContent = labelText;
    label.appendChild(input);
    root.appendChild(label);
    return input;
  }

  const equationInput = addLabeledField("Equation y = f(x)", document.createElement("input"));
  equationInput.type = "text";
  equationInput.value = "Math.sin(x)";

  const resolutionInput = addLabeledField("Rendering Resolution (16-192)", document.createElement("input"));
  resolutionInput.type = "number";
  resolutionInput.min = "16";
  resolutionInput.max = "192";
  resolutionInput.step = "1";
  resolutionInput.value = "96";

  const limitsWrap = document.createElement("div");
  limitsWrap.style.display = "grid";
  limitsWrap.style.gridTemplateColumns = "repeat(2, minmax(0,1fr))";
  limitsWrap.style.gap = "8px";
  root.appendChild(limitsWrap);

  function addLimitField(labelText, defaultValue) {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.1";
    input.value = String(defaultValue);
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.flexDirection = "column";
    label.style.gap = "4px";
    label.textContent = labelText;
    label.appendChild(input);
    limitsWrap.appendChild(label);
    return input;
  }

  const xMinInput = addLimitField("x min", -8);
  const xMaxInput = addLimitField("x max", 8);

  const colliderLabel = document.createElement("label");
  colliderLabel.style.display = "flex";
  colliderLabel.style.alignItems = "center";
  colliderLabel.style.gap = "6px";
  const colliderInput = document.createElement("input");
  colliderInput.type = "checkbox";
  colliderInput.checked = true;
  colliderLabel.appendChild(colliderInput);
  const colliderText = document.createElement("span");
  colliderText.textContent = "Enable Collider";
  colliderLabel.appendChild(colliderText);
  root.appendChild(colliderLabel);

  const colorInput = addLabeledField("Color", document.createElement("input"));
  colorInput.type = "color";
  colorInput.value = "#44bbff";

  const statusLine = document.createElement("div");
  statusLine.style.opacity = "0.85";
  statusLine.textContent = "Configure, then click 'Use For Placement'.";
  root.appendChild(statusLine);

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  root.appendChild(buttonRow);

  const useBtn = document.createElement("button");
  useBtn.type = "button";
  useBtn.textContent = "Use For Placement";
  buttonRow.appendChild(useBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => {
    visible = false;
    floatingPanel.setVisible(false);
  });
  buttonRow.appendChild(closeBtn);

  function buildConfigFromInputs() {
    const equation = String(equationInput.value || "").trim() || "Math.sin(x)";
    const rawResolution = parseIntSafe(resolutionInput.value, 96);
    const resolution = clamp(rawResolution, 16, 192);
    const rawXMin = parseFloatSafe(xMinInput.value, -8);
    const rawXMax = parseFloatSafe(xMaxInput.value, 8);
    const xMin = Math.min(rawXMin, rawXMax);
    const xMax = Math.max(rawXMin, rawXMax);
    const safeWidth = clamp(xMax - xMin, 0.5, 80);
    const centeredMin = xMin;
    const centeredMax = xMin + safeWidth;
    return {
      equation,
      resolution,
      limits: [centeredMin, centeredMax],
      collider: colliderInput.checked === true,
      color: colorInput.value || "#44bbff"
    };
  }

  useBtn.addEventListener("click", () => {
    pendingConfig = buildConfigFromInputs();
    statusLine.textContent = "Ready. Press Use/Place in world to place the function.";
  });

  return {
    open() {
      visible = true;
      floatingPanel.setVisible(true);
    },
    close() {
      visible = false;
      floatingPanel.setVisible(false);
    },
    isVisible() {
      return visible;
    },
    consumePendingConfig() {
      const next = pendingConfig;
      pendingConfig = null;
      return next;
    },
    getCurrentConfig() {
      return buildConfigFromInputs();
    },
    dispose() {
      floatingPanel.dispose();
    }
  };
}
