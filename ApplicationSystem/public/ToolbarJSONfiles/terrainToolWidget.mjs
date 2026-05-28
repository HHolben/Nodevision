// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/terrainToolWidget.mjs
// Renders the Insert > Terrain sub-toolbar for Meta World terrain insertion.

import { setStatus } from "/StatusBar.mjs";
import {
  TERRAIN_GEOMETRY_MODES,
  TERRAIN_KINDS,
  TERRAIN_TEXTURES
} from "/PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainPresets.mjs";

function getTerrainTool() {
  return window.VRWorldContext?.terrainToolController || null;
}

function makeSelect(label, options, value, onChange) {
  const wrap = document.createElement("label");
  wrap.className = "nv-terrain-toolbar-field";
  wrap.textContent = label;

  const select = document.createElement("select");
  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.id;
    opt.textContent = option.label;
    select.appendChild(opt);
  });
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  wrap.appendChild(select);
  return { wrap, input: select };
}

function makeNumber(label, value, { min = null, step = "any" } = {}, onChange) {
  const wrap = document.createElement("label");
  wrap.className = "nv-terrain-toolbar-field";
  wrap.textContent = label;

  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value);
  input.step = step;
  if (min !== null) input.min = String(min);
  input.addEventListener("input", () => onChange(input.value));
  wrap.appendChild(input);
  return { wrap, input };
}

function makeRadioGroup(label, options, value, onChange) {
  const wrap = document.createElement("fieldset");
  wrap.className = "nv-terrain-toolbar-field nv-terrain-toolbar-radio-field";

  const legend = document.createElement("legend");
  legend.textContent = label;
  wrap.appendChild(legend);

  const groupName = "terrain-brush-shape-" + Math.random().toString(36).slice(2);

  const input = {
    get value() {
      return wrap.querySelector("input:checked")?.value || value;
    },
    set value(nextValue) {
      const next = String(nextValue || value);
      wrap.querySelectorAll("input").forEach((radio) => {
        radio.checked = radio.value === next;
      });
    }
  };

  options.forEach((option) => {
    const item = document.createElement("label");
    item.className = "nv-terrain-toolbar-radio-option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = groupName;
    radio.value = option.id;
    radio.checked = option.id === value;
    radio.addEventListener("change", () => {
      if (radio.checked) onChange(radio.value);
    });

    item.appendChild(radio);
    item.appendChild(document.createTextNode(option.label));
    wrap.appendChild(item);
  });

  return { wrap, input };
}

function makeColor(label, value, onChange) {
  const wrap = document.createElement("label");
  wrap.className = "nv-terrain-toolbar-field nv-terrain-toolbar-field--color";
  wrap.textContent = label;

  const input = document.createElement("input");
  input.type = "color";
  input.value = value;
  input.addEventListener("input", () => onChange(input.value));
  wrap.appendChild(input);
  return { wrap, input };
}

function makeButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(button);
  });
  return button;
}

function syncToolbarFromTool(fields, paintButton) {
  const terrainTool = getTerrainTool();
  const settings = terrainTool?.getBrushSettings?.();
  if (!settings) return;
  Object.entries(fields).forEach(([key, input]) => {
    if (settings[key] !== undefined && input.value !== String(settings[key])) {
      input.value = String(settings[key]);
    }
  });

  const depthDisabled = settings.kind !== "water";
  if (fields.depth) {
    fields.depth.disabled = depthDisabled;
    fields.depth.closest("label")?.classList.toggle("nv-disabled", depthDisabled);
  }

  if (paintButton) {
    const active = terrainTool?.isPaintModeActive?.() === true;
    paintButton.classList.toggle("nv-active", active);
    paintButton.textContent = active ? "Paint On" : "Paint Off";
    paintButton.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

export function openTerrainToolPanel({ activatePaint = true } = {}) {
  const terrainTool = getTerrainTool();
  if (!terrainTool?.openPanel) {
    setStatus("Open a Meta World editor before using Terrain.");
    return false;
  }
  terrainTool.openPanel({ activatePaint });
  setStatus(activatePaint ? "Terrain paint mode active." : "Terrain toolbar ready.");
  return true;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  hostElement.innerHTML = "";
  hostElement.classList.add("nv-terrain-insert-toolbar");

  const terrainTool = getTerrainTool();
  if (!terrainTool?.updateBrushSettings) {
    hostElement.appendChild(document.createTextNode("Open a Meta World editor to insert terrain."));
    setStatus("Open a Meta World editor before using Terrain.");
    return;
  }

  const settings = terrainTool.getBrushSettings?.() || {};
  const fields = {};
  const update = (partial) => {
    const next = terrainTool.updateBrushSettings(partial);
    if (next) syncToolbarFromTool(fields, paintButton);
  };

  const kind = makeSelect("Terrain", TERRAIN_KINDS, settings.kind || "grass", (value) => update({ kind: value }));
  const brushSize = makeNumber("Brush Size", settings.tileSize || 1, { min: "0.1", step: "0.1" }, (value) => update({ tileSize: value }));
  const radius = makeNumber("Radius", settings.radius || 0, { min: "0", step: "0.1" }, (value) => update({ radius: value }));
  const brushShape = makeRadioGroup("Brush", [
    { id: "square", label: "Square" },
    { id: "round", label: "Round" }
  ], settings.brushShape || "square", (value) => update({ brushShape: value }));
  const elevation = makeNumber("Elevation", settings.elevation || 0.6, { min: "0.05", step: "0.1" }, (value) => update({ elevation: value }));
  const geometry = makeSelect("Voxel/Polygonal", TERRAIN_GEOMETRY_MODES, settings.geometryMode || "voxel", (value) => update({ geometryMode: value }));
  const depth = makeNumber("Depth", settings.depth || 1.5, { min: "0.05", step: "0.1" }, (value) => update({ depth: value }));
  const texture = makeSelect("Texture", TERRAIN_TEXTURES, settings.texture || "solid", (value) => update({ texture: value }));
  const color = makeColor("Color", settings.color || "#3f8f46", (value) => update({ color: value }));

  fields.kind = kind.input;
  fields.tileSize = brushSize.input;
  fields.radius = radius.input;
  fields.brushShape = brushShape.input;
  fields.elevation = elevation.input;
  fields.geometryMode = geometry.input;
  fields.depth = depth.input;
  fields.texture = texture.input;
  fields.color = color.input;

  const paintButton = makeButton("Paint On", (button) => {
    const active = !terrainTool.isPaintModeActive?.();
    terrainTool.setPaintModeActive?.(active);
    button.classList.toggle("nv-active", active);
    button.textContent = active ? "Paint On" : "Paint Off";
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  paintButton.setAttribute("aria-pressed", "true");

  [
    kind.wrap,
    brushSize.wrap,
    radius.wrap,
    brushShape.wrap,
    elevation.wrap,
    geometry.wrap,
    depth.wrap,
    texture.wrap,
    color.wrap,
    paintButton
  ].forEach((element) => hostElement.appendChild(element));

  openTerrainToolPanel({ activatePaint: true });
  syncToolbarFromTool(fields, paintButton);
}
