// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/playerInventory.mjs
// This file defines browser-side player Inventory logic for the Nodevision UI. It renders interface components and handles user interactions.
import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";

const GRID_COLUMNS = 9;
const ICON_SIZE = 30;
const CELL_MIN_HEIGHT = 62;
const CATEGORY_ORDER = ["tools", "passive-modifiers", "instruments", "resources", "building-blocks"];
const CATEGORY_META = {
  "tools": { label: "Tools", emptyText: "No tools carried." },
  "passive-modifiers": { label: "Passive Modifiers", emptyText: "No passive modifiers equipped." },
  "instruments": { label: "Instruments", emptyText: "No instruments carried." },
  "resources": { label: "Resources", emptyText: "No resources carried." },
  "building-blocks": { label: "Building Blocks", emptyText: "No building blocks carried." }
};
const TOOL_IDS = new Set(["select-object", "select-image", "svg-camera", "tape-measure", "terrain-generator", "temporal-manipulator"]);
const BUILDING_IDS = new Set(["box", "sphere", "cylinder", "math-function", "object-file", "image-plane", "console", "portal"]);
const RESOURCE_IDS = new Set(["ore", "wood", "stone", "energy-cell", "water", "fuel"]);
const PASSIVE_IDS = new Set(["armor", "helmet", "boots", "jetpack", "oxygen-tank"]);
const HOTBAR_INSTRUMENT_ID = "item-hotbar";
const CHRONOMETER_INSTRUMENT_ID = "chronometer";
const INSTRUMENT_IDS = new Set(["coordinates-hud", CHRONOMETER_INSTRUMENT_ID, HOTBAR_INSTRUMENT_ID, "minimap", "scanner"]);

function cleanId(id) {
  return typeof id === "string" ? id.trim() : "";
}

function normalizeNotebookPath(input = "") {
  return String(input || "")
    .trim()
    .split("\\").join("/")
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "");
}

function inferCategory(raw = {}) {
  const id = cleanId(raw.id).toLowerCase();
  const category = String(raw.category || "").toLowerCase();
  if (CATEGORY_META[category]) return category;
  if (raw.instrument === true || INSTRUMENT_IDS.has(id)) return "instruments";
  if (raw.passive === true || raw.equipment === true || PASSIVE_IDS.has(id)) return "passive-modifiers";
  if (raw.resource === true || RESOURCE_IDS.has(id)) return "resources";
  if (raw.tool === true || TOOL_IDS.has(id)) return "tools";
  if (raw.placeable === true || BUILDING_IDS.has(id)) return "building-blocks";
  return "resources";
}

function normalizeItem(raw = {}) {
  const id = cleanId(raw.id);
  const category = inferCategory(raw);
  const count = Number.isFinite(raw.count) ? Math.max(0, Math.floor(raw.count)) : 1;
  return {
    ...raw,
    id,
    label: raw.label || id,
    count,
    category,
    tool: category === "tools" || raw.tool === true,
    instrument: category === "instruments" || raw.instrument === true,
    resource: category === "resources" || raw.resource === true,
    passive: category === "passive-modifiers" || raw.passive === true,
    placeable: category === "building-blocks" || raw.placeable === true
  };
}

export function createPlayerInventory({ panel }) {
  const state = {
    menuOpen: false,
    activeCategory: "tools",
    selectedMenuIndex: 0,
    categorySelection: {},
    activeHand: "dominant",
    dominantSlot: 0,
    offHandId: null,
    selectedObjectFile: "",
    selectedImageFile: "",
    activeInstruments: new Set([HOTBAR_INSTRUMENT_ID]),
    items: [
      { id: "box", label: "Box", count: 10, category: "building-blocks", placeable: true },
      { id: "sphere", label: "Sphere", count: 6, category: "building-blocks", placeable: true },
      { id: "cylinder", label: "Cylinder", count: 6, category: "building-blocks", placeable: true },
      { id: "math-function", label: "Math Function", count: 4, category: "building-blocks", placeable: true },
      { id: "object-file", label: "Object File", count: 0, category: "building-blocks", placeable: true },
      { id: "image-plane", label: "Image Plane", count: 0, category: "building-blocks", placeable: true },
      { id: "select-object", label: "Select Object", count: 1, category: "tools", tool: true },
      { id: "select-image", label: "Select Image", count: 1, category: "tools", tool: true },
      { id: "svg-camera", label: "SVG Camera", count: 1, category: "tools", tool: true },
      { id: "tape-measure", label: "Tape Measure", count: 1, category: "tools", tool: true },
      { id: "terrain-generator", label: "Terrain Generator", count: 1, category: "tools", tool: true },
      { id: "temporal-manipulator", label: "Temporal Manipulator", count: 1, category: "tools", tool: true },
      { id: "coordinates-hud", label: "Coordinates HUD", count: 1, category: "instruments", instrument: true },
      { id: CHRONOMETER_INSTRUMENT_ID, label: "Chronometer", count: 1, category: "instruments", instrument: true },
      { id: HOTBAR_INSTRUMENT_ID, label: "Item Hotbar", count: 1, category: "instruments", instrument: true }
    ].map(normalizeItem),
    dominantSlots: [null, "select-object", "select-image", "svg-camera", "tape-measure", "terrain-generator", "temporal-manipulator", null, null]
  };

  const statusHud = document.createElement("div");
  statusHud.style.position = "absolute";
  statusHud.style.left = "10px";
  statusHud.style.bottom = "10px";
  statusHud.style.maxWidth = "420px";
  statusHud.style.padding = "6px 10px";
  statusHud.style.background = "rgba(0, 0, 0, 0.55)";
  statusHud.style.border = "1px solid rgba(120, 200, 255, 0.55)";
  statusHud.style.borderRadius = "8px";
  statusHud.style.color = "#e7f7ff";
  statusHud.style.font = "12px/1.35 monospace";
  statusHud.style.pointerEvents = "none";
  statusHud.style.zIndex = "25";
  panel.appendChild(statusHud);

  const hotbarHud = document.createElement("div");
  hotbarHud.style.position = "absolute";
  hotbarHud.style.left = "50%";
  hotbarHud.style.bottom = "12px";
  hotbarHud.style.transform = "translateX(-50%)";
  hotbarHud.style.display = "flex";
  hotbarHud.style.alignItems = "end";
  hotbarHud.style.gap = "8px";
  hotbarHud.style.pointerEvents = "none";
  hotbarHud.style.zIndex = "26";
  panel.appendChild(hotbarHud);

  const instrumentsHud = document.createElement("div");
  instrumentsHud.style.position = "absolute";
  instrumentsHud.style.right = "10px";
  instrumentsHud.style.top = "10px";
  instrumentsHud.style.display = "none";
  instrumentsHud.style.flexDirection = "column";
  instrumentsHud.style.gap = "6px";
  instrumentsHud.style.padding = "8px 10px";
  instrumentsHud.style.background = "rgba(0, 0, 0, 0.52)";
  instrumentsHud.style.border = "1px solid rgba(185, 225, 255, 0.55)";
  instrumentsHud.style.borderRadius = "8px";
  instrumentsHud.style.color = "#e7f7ff";
  instrumentsHud.style.font = "12px/1.35 monospace";
  instrumentsHud.style.pointerEvents = "none";
  instrumentsHud.style.zIndex = "26";
  panel.appendChild(instrumentsHud);

  const floatingPanel = createFloatingInventoryPanel({
    title: "Player Inventory",
    closeBehavior: "hide",
    onRequestClose: () => setMenuOpen(false)
  });
  const menu = floatingPanel.content;
  floatingPanel.setVisible(false);

  function isItemAvailable(item) {
    if (!item) return false;
    if (item.id === "object-file") return Boolean(state.selectedObjectFile) && item.count > 0;
    if (item.id === "image-plane") return Boolean(state.selectedImageFile) && item.count > 0;
    if (item.tool || item.instrument || item.passive) return item.count > 0;
    return item.count > 0;
  }

  function findItem(id) {
    const key = cleanId(id);
    if (!key) return null;
    return state.items.find((item) => item.id === key) || null;
  }

  function getCategoryChoices(category = state.activeCategory) {
    const items = state.items.filter((item) => item.category === category && isItemAvailable(item));
    if (category === "tools") return [{ id: null, label: "Empty Hand", category: "tools", emptyHand: true }, ...items];
    return items;
  }

  function normalizeMenuIndex(index) {
    const choices = getCategoryChoices();
    const len = choices.length || 1;
    return ((index % len) + len) % len;
  }

  function setActiveCategory(category) {
    if (!CATEGORY_META[category]) return;
    state.categorySelection[state.activeCategory] = state.selectedMenuIndex;
    state.activeCategory = category;
    state.selectedMenuIndex = Math.min(state.categorySelection[category] || 0, Math.max(0, getCategoryChoices(category).length - 1));
    render();
  }

  function getEquippedId() {
    return state.activeHand === "off" ? state.offHandId : state.dominantSlots[state.dominantSlot] || null;
  }

  function getEquippedItem() {
    const id = getEquippedId();
    if (!id) return null;
    const item = findItem(id);
    if (!isItemAvailable(item)) return null;
    if (item.category !== "tools" && item.category !== "building-blocks") return null;
    return item;
  }

  function describeItem(item, fallback = "Empty Hand") {
    if (!item) return fallback;
    if (item.id === "object-file") return state.selectedObjectFile ? `${item.label} (${state.selectedObjectFile}) x${item.count}` : fallback;
    if (item.id === "image-plane") return state.selectedImageFile ? `${item.label} (${state.selectedImageFile}) x${item.count}` : fallback;
    if (item.tool) return item.label;
    if (item.instrument) return state.activeInstruments.has(item.id) ? `${item.label} on` : `${item.label} off`;
    if (item.passive) return item.label;
    return `${item.label} x${item.count}`;
  }

  function getEquippedLabel() {
    return describeItem(getEquippedItem());
  }

  function renderStatus() {
    const objectInfo = state.selectedObjectFile ? `  |  Object: ${state.selectedObjectFile}` : "";
    const imageInfo = state.selectedImageFile ? `  |  Image: ${state.selectedImageFile}` : "";
    const handLabel = state.activeHand === "off" ? "Off hand" : `Dominant ${state.dominantSlot + 1}`;
    statusHud.textContent = `${handLabel}: ${getEquippedLabel()}${objectInfo}${imageInfo}`;
  }

  function styleSlot(slot, selected, compact = false) {
    slot.style.width = compact ? "48px" : "56px";
    slot.style.minHeight = compact ? "48px" : "56px";
    slot.style.border = selected ? "2px solid #74d4ff" : "1px solid rgba(190, 220, 235, 0.45)";
    slot.style.borderRadius = "8px";
    slot.style.padding = "4px";
    slot.style.background = selected ? "rgba(40, 110, 150, 0.62)" : "rgba(0, 0, 0, 0.46)";
    slot.style.boxShadow = selected ? "0 0 12px rgba(116, 212, 255, 0.45)" : "none";
    slot.style.color = "#e7f7ff";
    slot.style.font = "10px/1.15 monospace";
    slot.style.display = "flex";
    slot.style.flexDirection = "column";
    slot.style.justifyContent = "space-between";
    slot.style.alignItems = "center";
  }

  function create3DIcon(choice) {
    const icon = document.createElement("div");
    icon.style.width = `${ICON_SIZE}px`;
    icon.style.height = `${ICON_SIZE}px`;
    icon.style.margin = "0 auto";
    icon.style.transformStyle = "preserve-3d";
    icon.style.transform = "rotateX(26deg) rotateY(-28deg)";
    const id = String(choice?.id || "").toLowerCase();

    if (id === "sphere") {
      icon.style.borderRadius = "50%";
      icon.style.background = "radial-gradient(circle at 30% 30%, #d8f1ff 0%, #8ec9ff 45%, #2f4a75 100%)";
      return icon;
    }
    if (id === "cylinder") {
      icon.style.borderRadius = "9px / 5px";
      icon.style.background = "linear-gradient(90deg, #7e6647 0%, #c8ad84 42%, #8b7150 100%)";
      return icon;
    }
    if (id === "portal") {
      icon.style.borderRadius = "50%";
      icon.style.boxSizing = "border-box";
      icon.style.border = "5px solid #6dd5ff";
      icon.style.boxShadow = "0 0 8px rgba(109, 213, 255, 0.75)";
      return icon;
    }
    if (id === "svg-camera") {
      icon.style.position = "relative";
      icon.style.borderRadius = "7px";
      icon.style.background = "linear-gradient(135deg, #6070ff 0%, #3244af 100%)";
      icon.style.border = "1px solid rgba(201, 214, 255, 0.85)";
      const lens = document.createElement("div");
      lens.style.position = "absolute";
      lens.style.left = "11px";
      lens.style.top = "9px";
      lens.style.width = "12px";
      lens.style.height = "12px";
      lens.style.borderRadius = "50%";
      lens.style.background = "radial-gradient(circle at 35% 35%, #eaf8ff 0%, #83d0ff 45%, #2f5a92 100%)";
      icon.appendChild(lens);
      return icon;
    }
    if (id === "tape-measure") {
      icon.style.position = "relative";
      icon.style.borderRadius = "7px";
      icon.style.background = "linear-gradient(135deg, #ffd777 0%, #d28e24 100%)";
      icon.style.border = "1px solid rgba(255, 235, 182, 0.95)";
      const tape = document.createElement("div");
      tape.style.position = "absolute";
      tape.style.left = "4px";
      tape.style.top = "15px";
      tape.style.width = "26px";
      tape.style.height = "3px";
      tape.style.background = "rgba(32, 24, 12, 0.9)";
      icon.appendChild(tape);
      return icon;
    }
    if (id === "terrain-generator") {
      icon.style.position = "relative";
      icon.style.borderRadius = "7px";
      icon.style.background = "linear-gradient(135deg, #6ea96b 0%, #365f33 100%)";
      icon.style.border = "1px solid rgba(205, 232, 188, 0.85)";
      return icon;
    }
    if (id === "temporal-manipulator") {
      icon.style.position = "relative";
      icon.style.borderRadius = "50%";
      icon.style.background = "radial-gradient(circle at 35% 30%, #f8fbff 0%, #7fc9ff 42%, #1f4f79 100%)";
      icon.style.border = "2px solid rgba(226, 244, 255, 0.92)";
      const hand = document.createElement("div");
      hand.style.position = "absolute";
      hand.style.left = "14px";
      hand.style.top = "5px";
      hand.style.width = "2px";
      hand.style.height = "12px";
      hand.style.background = "rgba(7, 30, 48, 0.9)";
      hand.style.transformOrigin = "1px 10px";
      hand.style.transform = "rotate(35deg)";
      icon.appendChild(hand);
      const center = document.createElement("div");
      center.style.position = "absolute";
      center.style.left = "12px";
      center.style.top = "12px";
      center.style.width = "6px";
      center.style.height = "6px";
      center.style.borderRadius = "50%";
      center.style.background = "rgba(7, 30, 48, 0.95)";
      icon.appendChild(center);
      return icon;
    }
    if (id === "math-function") {
      icon.style.position = "relative";
      icon.style.borderRadius = "7px";
      icon.style.background = "linear-gradient(135deg, #f6a85e 0%, #cc5d2f 100%)";
      icon.style.border = "1px solid rgba(255, 226, 194, 0.9)";
      icon.textContent = "f";
      icon.style.color = "#fff7e3";
      icon.style.font = "700 22px/30px monospace";
      icon.style.textAlign = "center";
      return icon;
    }
    if (id === "console") {
      icon.style.position = "relative";
      icon.style.borderRadius = "7px";
      icon.style.background = "linear-gradient(135deg, #57bfa2 0%, #266f6d 100%)";
      icon.style.border = "1px solid rgba(213, 255, 242, 0.85)";
      return icon;
    }
    if (id === "object-file" || id === "select-object") {
      icon.style.position = "relative";
      icon.style.borderRadius = "7px";
      icon.style.background = "linear-gradient(135deg, #7b8ef2 0%, #4356ab 100%)";
      icon.style.border = "1px solid rgba(222, 230, 255, 0.85)";
      return icon;
    }
    if (id === "image-plane" || id === "select-image") {
      icon.style.position = "relative";
      icon.style.borderRadius = "7px";
      icon.style.background = "linear-gradient(135deg, #ff9fd8 0%, #b24aa0 100%)";
      icon.style.border = "1px solid rgba(255, 226, 245, 0.9)";
      return icon;
    }
    if (id === HOTBAR_INSTRUMENT_ID) {
      icon.style.position = "relative";
      icon.style.borderRadius = "7px";
      icon.style.background = "linear-gradient(135deg, #2f405a 0%, #111827 100%)";
      icon.style.border = "1px solid rgba(220, 235, 255, 0.9)";
      icon.style.display = "grid";
      icon.style.gridTemplateColumns = "repeat(3, 1fr)";
      icon.style.gap = "2px";
      icon.style.padding = "4px";
      for (let i = 0; i < 6; i += 1) {
        const pip = document.createElement("div");
        pip.style.border = "1px solid rgba(180, 215, 255, 0.75)";
        pip.style.borderRadius = "2px";
        pip.style.background = i === 0 ? "rgba(116, 212, 255, 0.8)" : "rgba(255, 255, 255, 0.18)";
        icon.appendChild(pip);
      }
      return icon;
    }
    if (id === "coordinates-hud") {
      icon.style.position = "relative";
      icon.style.borderRadius = "7px";
      icon.style.background = "linear-gradient(135deg, #5fc7d6 0%, #23566c 100%)";
      icon.style.border = "1px solid rgba(216, 249, 255, 0.9)";
      icon.textContent = "+";
      icon.style.color = "#f3fdff";
      icon.style.font = "700 23px/30px monospace";
      icon.style.textAlign = "center";
      return icon;
    }
    if (id === CHRONOMETER_INSTRUMENT_ID) {
      icon.style.position = "relative";
      icon.style.borderRadius = "50%";
      icon.style.background = "radial-gradient(circle at 35% 28%, #fff7cf 0%, #f6c96d 44%, #70491f 100%)";
      icon.style.border = "2px solid rgba(255, 240, 190, 0.95)";
      const tick = document.createElement("div");
      tick.style.position = "absolute";
      tick.style.left = "14px";
      tick.style.top = "6px";
      tick.style.width = "2px";
      tick.style.height = "11px";
      tick.style.background = "rgba(48, 30, 8, 0.9)";
      tick.style.transformOrigin = "1px 9px";
      tick.style.transform = "rotate(-35deg)";
      icon.appendChild(tick);
      const center = document.createElement("div");
      center.style.position = "absolute";
      center.style.left = "12px";
      center.style.top = "12px";
      center.style.width = "6px";
      center.style.height = "6px";
      center.style.borderRadius = "50%";
      center.style.background = "rgba(48, 30, 8, 0.95)";
      icon.appendChild(center);
      return icon;
    }
    icon.style.background = "linear-gradient(135deg, #d8d8d8 0%, #8f8f8f 48%, #666666 100%)";
    icon.style.boxShadow = "-4px 4px 0 rgba(0, 0, 0, 0.25)";
    icon.style.borderRadius = "7px";
    return icon;
  }

  function createIcon(choice) {
    if (!choice || choice.id === null) {
      const empty = document.createElement("div");
      empty.style.width = `${ICON_SIZE}px`;
      empty.style.height = `${ICON_SIZE}px`;
      empty.style.margin = "0 auto";
      empty.style.border = "1px dashed rgba(231, 247, 255, 0.7)";
      empty.style.borderRadius = "6px";
      empty.style.position = "relative";
      const slash = document.createElement("div");
      slash.style.position = "absolute";
      slash.style.left = "5px";
      slash.style.top = "16px";
      slash.style.width = "24px";
      slash.style.height = "2px";
      slash.style.background = "#e7f7ff";
      slash.style.transform = "rotate(-35deg)";
      empty.appendChild(slash);
      return empty;
    }
    if (choice.sprite) {
      const img = document.createElement("img");
      img.src = choice.sprite;
      img.alt = choice.label || choice.id;
      img.style.width = `${ICON_SIZE}px`;
      img.style.height = `${ICON_SIZE}px`;
      img.style.objectFit = "contain";
      img.style.display = "block";
      img.style.margin = "0 auto";
      return img;
    }
    return create3DIcon(choice);
  }

  function renderHotbar() {
    hotbarHud.innerHTML = "";
    if (!state.activeInstruments.has(HOTBAR_INSTRUMENT_ID)) {
      hotbarHud.style.display = "none";
      return;
    }
    hotbarHud.style.display = "flex";
    const offSlot = document.createElement("div");
    const offSelected = state.activeHand === "off";
    styleSlot(offSlot, offSelected, true);
    offSlot.appendChild(createIcon(findItem(state.offHandId)));
    const offLabel = document.createElement("div");
    offLabel.textContent = "Off";
    offSlot.appendChild(offLabel);
    hotbarHud.appendChild(offSlot);

    const strip = document.createElement("div");
    strip.style.display = "grid";
    strip.style.gridTemplateColumns = "repeat(9, 56px)";
    strip.style.gap = "4px";
    state.dominantSlots.forEach((id, index) => {
      const item = findItem(id);
      const slot = document.createElement("div");
      styleSlot(slot, state.activeHand === "dominant" && state.dominantSlot === index);
      slot.appendChild(createIcon(index === 0 ? null : item));
      const label = document.createElement("div");
      label.textContent = index === 0 ? "1 Hand" : `${index + 1}`;
      slot.appendChild(label);
      strip.appendChild(slot);
    });
    hotbarHud.appendChild(strip);
  }

  function renderInstrumentsHud() {
    instrumentsHud.innerHTML = "";
    const active = [...state.activeInstruments]
      .filter((id) => id !== HOTBAR_INSTRUMENT_ID)
      .map((id) => findItem(id))
      .filter(Boolean);
    if (active.length === 0) {
      instrumentsHud.style.display = "none";
      return;
    }
    instrumentsHud.style.display = "flex";
    active.forEach((item) => {
      const line = document.createElement("div");
      if (item.id === "coordinates-hud") {
        const pos = window.VRWorldContext?.controls?.getObject?.().position;
        if (pos) line.textContent = `XYZ ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
        else line.textContent = item.label;
      } else if (item.id === CHRONOMETER_INSTRUMENT_ID) {
        const temporal = window.VRWorldContext?.temporalController?.getSettings?.() || {};
        const t = Number.isFinite(temporal.currentTimeSeconds) ? temporal.currentTimeSeconds : 0;
        const hz = Number.isFinite(temporal.samplingRateHz) ? temporal.samplingRateHz : 0;
        line.textContent = "t " + t.toFixed(2) + " s | " + hz.toFixed(1) + " Hz";
      } else {
        line.textContent = item.label;
      }
      instrumentsHud.appendChild(line);
    });
  }

  function renderMenu() {
    if (!state.menuOpen) {
      floatingPanel.setVisible(false);
      return;
    }
    const choices = getCategoryChoices();
    state.selectedMenuIndex = Math.min(normalizeMenuIndex(state.selectedMenuIndex), Math.max(0, choices.length - 1));
    menu.innerHTML = "";

    const tabs = document.createElement("div");
    tabs.style.display = "flex";
    tabs.style.flexWrap = "wrap";
    tabs.style.gap = "6px";
    tabs.style.marginBottom = "10px";
    CATEGORY_ORDER.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = CATEGORY_META[category].label;
      button.style.padding = "5px 8px";
      button.style.borderRadius = "7px";
      button.style.border = category === state.activeCategory ? "2px solid #74d4ff" : "1px solid rgba(190, 220, 235, 0.42)";
      button.style.background = category === state.activeCategory ? "rgba(40, 110, 150, 0.48)" : "rgba(255, 255, 255, 0.05)";
      button.style.color = "inherit";
      button.addEventListener("click", () => setActiveCategory(category));
      tabs.appendChild(button);
    });
    menu.appendChild(tabs);

    const handLine = document.createElement("div");
    handLine.style.marginBottom = "8px";
    handLine.style.opacity = "0.88";
    handLine.textContent = `Active hand: ${state.activeHand === "off" ? "Off hand" : `Dominant slot ${state.dominantSlot + 1}`}`;
    menu.appendChild(handLine);

    if (choices.length === 0) {
      const empty = document.createElement("div");
      empty.style.opacity = "0.78";
      empty.textContent = CATEGORY_META[state.activeCategory].emptyText;
      menu.appendChild(empty);
      floatingPanel.setVisible(true);
      return;
    }

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`;
    grid.style.gap = "6px";
    grid.style.maxHeight = "52vh";
    grid.style.overflowY = "auto";
    menu.appendChild(grid);

    choices.forEach((choice, idx) => {
      const cell = document.createElement("div");
      const selected = idx === state.selectedMenuIndex;
      cell.style.border = selected ? "2px solid #74d4ff" : "1px solid rgba(190, 220, 235, 0.4)";
      cell.style.borderRadius = "8px";
      cell.style.padding = "4px";
      cell.style.background = selected ? "rgba(40, 110, 150, 0.42)" : "rgba(255, 255, 255, 0.04)";
      cell.style.minHeight = `${CELL_MIN_HEIGHT}px`;
      cell.style.display = "flex";
      cell.style.flexDirection = "column";
      cell.style.justifyContent = "space-between";
      cell.style.gap = "3px";
      cell.style.cursor = "pointer";
      cell.title = choice.id === null ? "Empty hand" : choice.label || choice.id;
      cell.appendChild(createIcon(choice));

      const label = document.createElement("div");
      label.style.fontSize = "10px";
      label.style.textAlign = "center";
      label.style.whiteSpace = "nowrap";
      label.style.overflow = "hidden";
      label.style.textOverflow = "ellipsis";
      label.textContent = choice.id === null ? "Empty" : (choice.label || choice.id || "Item");
      cell.appendChild(label);

      const count = document.createElement("div");
      count.style.fontSize = "10px";
      count.style.textAlign = "center";
      count.style.opacity = "0.9";
      if (choice.id === null) count.textContent = "hand";
      else if (choice.instrument) count.textContent = state.activeInstruments.has(choice.id) ? "active" : "inactive";
      else if (choice.tool) count.textContent = "tool";
      else if (choice.passive) count.textContent = "passive";
      else if (choice.resource) count.textContent = `x${choice.count}`;
      else count.textContent = `x${choice.count}`;
      cell.appendChild(count);

      cell.addEventListener("click", () => {
        state.selectedMenuIndex = idx;
        state.categorySelection[state.activeCategory] = idx;
        render();
      });
      cell.addEventListener("dblclick", () => {
        state.selectedMenuIndex = idx;
        applySelection();
      });
      grid.appendChild(cell);
    });

    floatingPanel.setVisible(true);
  }

  function render() {
    renderStatus();
    renderHotbar();
    renderInstrumentsHud();
    renderMenu();
  }

  function pickLocalFile(accept = "") {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      if (accept) input.accept = accept;
      input.style.position = "fixed";
      input.style.left = "-2000px";
      document.body.appendChild(input);
      input.addEventListener("change", () => {
        const file = input.files?.[0] || null;
        input.remove();
        resolve(file);
      }, { once: true });
      input.click();
    });
  }

  async function uploadFileToNotebook(file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/file/upload-binary", { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || `${response.status} ${response.statusText}`);
    }
    return normalizeNotebookPath(payload?.filename || file.name);
  }

  async function selectObjectFile() {
    const file = await pickLocalFile(".glb,.gltf,.obj,.stl,.fbx,.dae,.ply,.usdz,.usd,.usda,.usdc");
    if (!file) return;
    const notebookPath = await uploadFileToNotebook(file);
    const objectItem = findItem("object-file");
    if (objectItem) objectItem.count = Math.max(objectItem.count || 0, 12);
    state.selectedObjectFile = notebookPath;
    equipItemToActiveHand("object-file");
    render();
  }

  async function selectImageFile() {
    const file = await pickLocalFile("image/png,image/svg+xml");
    if (!file) return;
    const notebookPath = await uploadFileToNotebook(file);
    const imageItem = findItem("image-plane");
    if (imageItem) imageItem.count = Math.max(imageItem.count || 0, 12);
    state.selectedImageFile = notebookPath;
    equipItemToActiveHand("image-plane");
    render();
  }

  function clearSlotsForItem(id) {
    state.dominantSlots = state.dominantSlots.map((slot, index) => index === 0 ? null : (slot === id ? null : slot));
    if (state.offHandId === id) state.offHandId = null;
    if (state.dominantSlot === 0) state.activeHand = "dominant";
  }

  function equipItemToActiveHand(id) {
    if (!id) {
      if (state.activeHand === "off") state.offHandId = null;
      else state.dominantSlot = 0;
      render();
      return;
    }
    const item = findItem(id);
    if (!isItemAvailable(item)) return;
    if (item.category !== "tools" && item.category !== "building-blocks") return;
    if (state.activeHand === "off") {
      state.offHandId = id;
    } else {
      if (state.dominantSlot === 0) state.dominantSlot = 1;
      state.dominantSlots[state.dominantSlot] = id;
    }
    render();
  }

  function toggleInstrument(id) {
    const item = findItem(id);
    if (!item?.instrument) return;
    if (state.activeInstruments.has(id)) state.activeInstruments.delete(id);
    else state.activeInstruments.add(id);
    render();
  }

  function applySelection() {
    const choice = getCategoryChoices()[state.selectedMenuIndex] || null;
    if (!choice) return;
    if (choice.id === null) {
      state.activeHand = "dominant";
      state.dominantSlot = 0;
      render();
      return;
    }
    if (choice.id === "select-object") {
      void selectObjectFile().catch((err) => {
        console.warn("Failed to select object file:", err);
        alert(`Failed to select object file: ${err.message}`);
      });
      return;
    }
    if (choice.id === "select-image") {
      void selectImageFile().catch((err) => {
        console.warn("Failed to select image file:", err);
        alert(`Failed to select image file: ${err.message}`);
      });
      return;
    }
    if (choice.instrument) {
      toggleInstrument(choice.id);
      return;
    }
    if (choice.category === "tools" || choice.category === "building-blocks") {
      equipItemToActiveHand(choice.id);
      if (choice.id === "math-function") window.VRWorldContext?.functionPlotterPanel?.open?.();
      return;
    }
    render();
  }

  function setMenuOpen(next) {
    state.menuOpen = !!next;
    if (state.menuOpen) {
      state.selectedMenuIndex = Math.min(state.categorySelection[state.activeCategory] || 0, Math.max(0, getCategoryChoices().length - 1));
    }
    render();
  }

  function toggleMenu() {
    setMenuOpen(!state.menuOpen);
  }

  function selectNext() {
    state.selectedMenuIndex = normalizeMenuIndex(state.selectedMenuIndex + 1);
    state.categorySelection[state.activeCategory] = state.selectedMenuIndex;
    render();
  }

  function selectPrevious() {
    state.selectedMenuIndex = normalizeMenuIndex(state.selectedMenuIndex - 1);
    state.categorySelection[state.activeCategory] = state.selectedMenuIndex;
    render();
  }

  function selectMenuIndex(index) {
    state.selectedMenuIndex = normalizeMenuIndex(index);
    state.categorySelection[state.activeCategory] = state.selectedMenuIndex;
    render();
  }

  function moveSelection(deltaCols, deltaRows) {
    if (deltaRows !== 0 && getCategoryChoices().length === 0) {
      const idx = CATEGORY_ORDER.indexOf(state.activeCategory);
      const next = CATEGORY_ORDER[(idx + deltaRows + CATEGORY_ORDER.length) % CATEGORY_ORDER.length];
      setActiveCategory(next);
      return;
    }
    if (deltaRows !== 0 && Math.abs(deltaRows) === 1 && getCategoryChoices().length <= GRID_COLUMNS) {
      const idx = CATEGORY_ORDER.indexOf(state.activeCategory);
      const next = CATEGORY_ORDER[(idx + deltaRows + CATEGORY_ORDER.length) % CATEGORY_ORDER.length];
      setActiveCategory(next);
      return;
    }
    const choices = getCategoryChoices();
    if (choices.length === 0) return;
    const cols = GRID_COLUMNS;
    const current = normalizeMenuIndex(state.selectedMenuIndex);
    const row = Math.floor(current / cols);
    const col = current % cols;
    const totalRows = Math.ceil(choices.length / cols);
    let nextRow = row + deltaRows;
    while (nextRow < 0) nextRow += totalRows;
    while (nextRow >= totalRows) nextRow -= totalRows;
    let nextCol = col + deltaCols;
    while (nextCol < 0) nextCol += cols;
    while (nextCol >= cols) nextCol -= cols;
    let nextIndex = nextRow * cols + nextCol;
    if (nextIndex >= choices.length) nextIndex = choices.length - 1;
    selectMenuIndex(nextIndex);
  }

  function addItem(id, count = 1, label = null, options = {}) {
    const key = cleanId(id);
    if (!key) return;
    const qty = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
    const existing = findItem(key);
    if (existing) {
      existing.count += qty;
      if (label) existing.label = label;
    } else {
      state.items.push(normalizeItem({ ...options, id: key, label: label || key, count: qty }));
    }
    const item = findItem(key);
    if ((item?.tool || item?.placeable) && !state.dominantSlots.includes(key)) {
      const openSlot = state.dominantSlots.findIndex((slot, index) => index > 0 && !slot);
      if (openSlot >= 0) state.dominantSlots[openSlot] = key;
    }
    render();
  }

  function consumeSelected(count = 1) {
    const item = getEquippedItem();
    if (!item) return false;
    if (item.tool) return true;
    const qty = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
    if (item.count < qty) return false;
    item.count -= qty;
    if (item.count <= 0) {
      item.count = 0;
      clearSlotsForItem(item.id);
    }
    render();
    return true;
  }

  function getSelectedItem() {
    const item = getEquippedItem();
    if (!item) return null;
    if (item.id === "object-file") {
      if (!state.selectedObjectFile || item.count <= 0) return null;
      return { ...item, objectFilePath: state.selectedObjectFile };
    }
    if (item.id === "image-plane") {
      if (!state.selectedImageFile || item.count <= 0) return null;
      return { ...item, imageFilePath: state.selectedImageFile };
    }
    if (item.tool) return item;
    if (item.placeable && item.count > 0) return item;
    return null;
  }

  function setSelectedObjectFile(path) {
    const normalized = normalizeNotebookPath(path || "");
    state.selectedObjectFile = normalized;
    const objectItem = findItem("object-file");
    if (objectItem && normalized) objectItem.count = Math.max(objectItem.count || 0, 1);
    render();
  }

  function setSelectedImageFile(path) {
    const normalized = normalizeNotebookPath(path || "");
    state.selectedImageFile = normalized;
    const imageItem = findItem("image-plane");
    if (imageItem && normalized) imageItem.count = Math.max(imageItem.count || 0, 1);
    render();
  }

  function selectDominantSlot(index) {
    const slot = Math.max(0, Math.min(8, Number.isFinite(index) ? Math.floor(index) : 0));
    state.activeHand = "dominant";
    state.dominantSlot = slot;
    render();
  }

  function switchHand() {
    state.activeHand = state.activeHand === "off" ? "dominant" : "off";
    render();
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    const key = (event.key || "").toLowerCase();
    if (!state.menuOpen) return;
    const deferToGameLoop = !!window.VRWorldContext?.inventory;
    if (key === "escape") {
      setMenuOpen(false);
      return;
    }
    if (deferToGameLoop && (key === "arrowup" || key === "arrowdown" || key === "arrowleft" || key === "arrowright" || key === "enter")) return;
    if (key === "arrowup") moveSelection(0, -1);
    else if (key === "arrowdown") moveSelection(0, 1);
    else if (key === "arrowleft") moveSelection(-1, 0);
    else if (key === "arrowright") moveSelection(1, 0);
    else if (key === "enter") applySelection();
    else if (key >= "1" && key <= "9") selectDominantSlot(Number.parseInt(key, 10) - 1);
  }

  const instrumentTimer = window.setInterval(renderInstrumentsHud, 250);
  window.addEventListener("keydown", onKeyDown);
  render();

  return {
    addItem,
    consumeSelected,
    getSelectedItem,
    selectMenuIndex,
    moveSelection,
    selectNext,
    selectPrevious,
    applySelection,
    toggleMenu,
    setMenuOpen,
    selectDominantSlot,
    switchHand,
    setActiveCategory,
    isMenuOpen: () => state.menuOpen,
    getActiveHand: () => state.activeHand,
    getSelectedObjectFile: () => state.selectedObjectFile || "",
    setSelectedObjectFile,
    getSelectedImageFile: () => state.selectedImageFile || "",
    setSelectedImageFile,
    get items() { return state.items; },
    get dominantSlots() { return state.dominantSlots.slice(); },
    get selectedIndex() { return state.selectedMenuIndex; },
    dispose() {
      window.clearInterval(instrumentTimer);
      window.removeEventListener("keydown", onKeyDown);
      if (statusHud.parentNode) statusHud.parentNode.removeChild(statusHud);
      if (hotbarHud.parentNode) hotbarHud.parentNode.removeChild(hotbarHud);
      if (instrumentsHud.parentNode) instrumentsHud.parentNode.removeChild(instrumentsHud);
      floatingPanel.dispose();
    }
  };
}
