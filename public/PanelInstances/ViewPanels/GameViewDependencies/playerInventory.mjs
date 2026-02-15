// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/playerInventory.mjs
// Lightweight player inventory HUD and selection logic for future world placement actions.
import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";

export function createPlayerInventory({ panel }) {
  const GRID_COLUMNS = 10;
  const state = {
    menuOpen: false,
    selectedMenuIndex: 0,
    equippedId: null,
    items: [
      { id: "box", label: "Box", count: 10 },
      { id: "sphere", label: "Sphere", count: 6 },
      { id: "cylinder", label: "Cylinder", count: 6 },
      { id: "portal", label: "Portal", count: 2 },
      { id: "svg-camera", label: "SVG Camera", count: 1, tool: true }
    ]
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

  const floatingPanel = createFloatingInventoryPanel({
    title: "Player Inventory",
    onRequestClose: () => setMenuOpen(false)
  });
  const menu = floatingPanel.content;
  floatingPanel.setVisible(false);

  function getAvailableChoices() {
    const choices = [{ id: null, label: "Empty Hand", count: null }];
    for (const item of state.items) {
      if (item?.tool || (Number.isFinite(item.count) && item.count > 0)) {
        choices.push(item);
      }
    }
    return choices;
  }

  function normalizeMenuIndex(index) {
    const choices = getAvailableChoices();
    const len = choices.length;
    return ((index % len) + len) % len;
  }

  function getEquippedLabel() {
    if (!state.equippedId) return "Empty Hand";
    const match = state.items.find((item) => item.id === state.equippedId);
    if (!match) return "Empty Hand";
    if (match.tool) return match.label;
    if (!(Number.isFinite(match.count) && match.count > 0)) return "Empty Hand";
    return `${match.label} x${match.count}`;
  }

  function renderStatus() {
    statusHud.textContent = `Equipped: ${getEquippedLabel()}  |  Inventory: 0 / Back`;
  }

  function renderMenu() {
    if (!state.menuOpen) {
      floatingPanel.setVisible(false);
      return;
    }

    const choices = getAvailableChoices();
    state.selectedMenuIndex = normalizeMenuIndex(state.selectedMenuIndex);
    menu.innerHTML = "";

    const help = document.createElement("div");
    help.style.opacity = "0.85";
    help.style.marginBottom = "8px";
    help.textContent = "Arrows / D-Pad to move, Enter / A to equip, 0 / Back to close";
    menu.appendChild(help);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`;
    grid.style.gap = "8px";
    grid.style.maxHeight = "52vh";
    grid.style.overflowY = "auto";
    menu.appendChild(grid);

    function create3DIcon(choice) {
      const icon = document.createElement("div");
      icon.style.width = "34px";
      icon.style.height = "34px";
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
        const body = document.createElement("div");
        body.style.position = "relative";
        body.style.width = "24px";
        body.style.height = "26px";
        body.style.margin = "4px auto 0";
        body.style.borderRadius = "9px / 5px";
        body.style.background = "linear-gradient(90deg, #7e6647 0%, #c8ad84 42%, #8b7150 100%)";
        const top = document.createElement("div");
        top.style.position = "absolute";
        top.style.left = "0";
        top.style.top = "-5px";
        top.style.width = "24px";
        top.style.height = "9px";
        top.style.borderRadius = "50%";
        top.style.background = "radial-gradient(ellipse at 50% 45%, #d8c39f 0%, #9f845d 100%)";
        body.appendChild(top);
        icon.appendChild(body);
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
        const badge = document.createElement("div");
        badge.style.position = "absolute";
        badge.style.left = "4px";
        badge.style.bottom = "2px";
        badge.style.fontSize = "8px";
        badge.style.fontWeight = "700";
        badge.style.color = "#eff5ff";
        badge.textContent = "SVG";
        icon.appendChild(badge);
        return icon;
      }

      icon.style.background = "linear-gradient(135deg, #d8d8d8 0%, #8f8f8f 48%, #666666 100%)";
      icon.style.boxShadow = "-4px 4px 0 rgba(0,0,0,0.25)";
      return icon;
    }

    function createIcon(choice) {
      if (!choice || choice.id === null) {
        const empty = document.createElement("div");
        empty.style.width = "34px";
        empty.style.height = "34px";
        empty.style.margin = "0 auto";
        empty.style.border = "1px dashed rgba(231,247,255,0.7)";
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
        img.style.width = "34px";
        img.style.height = "34px";
        img.style.objectFit = "contain";
        img.style.display = "block";
        img.style.margin = "0 auto";
        return img;
      }

      return create3DIcon(choice);
    }

    choices.forEach((choice, idx) => {
      const cell = document.createElement("div");
      const selected = idx === state.selectedMenuIndex;
      cell.style.border = selected ? "2px solid #74d4ff" : "1px solid rgba(190, 220, 235, 0.4)";
      cell.style.borderRadius = "8px";
      cell.style.padding = "6px 5px";
      cell.style.background = selected ? "rgba(40, 110, 150, 0.42)" : "rgba(255,255,255,0.04)";
      cell.style.minHeight = "72px";
      cell.style.display = "flex";
      cell.style.flexDirection = "column";
      cell.style.justifyContent = "space-between";
      cell.style.gap = "4px";

      const icon = createIcon(choice);
      cell.appendChild(icon);

      const label = document.createElement("div");
      label.style.fontSize = "11px";
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
      count.textContent = choice.id === null ? "" : (choice.tool ? "tool" : `x${choice.count}`);
      cell.appendChild(count);

      grid.appendChild(cell);
    });

    floatingPanel.setVisible(true);
  }

  function render() {
    renderStatus();
    renderMenu();
  }

  function applySelection() {
    const choice = getAvailableChoices()[state.selectedMenuIndex] || null;
    state.equippedId = choice?.id || null;
    render();
  }

  function setMenuOpen(next) {
    state.menuOpen = !!next;
    if (state.menuOpen) {
      const choices = getAvailableChoices();
      const equippedIdx = choices.findIndex((item) => item.id === state.equippedId);
      state.selectedMenuIndex = equippedIdx >= 0 ? equippedIdx : 0;
    }
    render();
  }

  function toggleMenu() {
    setMenuOpen(!state.menuOpen);
  }

  function selectNext() {
    state.selectedMenuIndex = normalizeMenuIndex(state.selectedMenuIndex + 1);
    render();
  }

  function selectPrevious() {
    state.selectedMenuIndex = normalizeMenuIndex(state.selectedMenuIndex - 1);
    render();
  }

  function selectMenuIndex(index) {
    state.selectedMenuIndex = normalizeMenuIndex(index);
    render();
  }

  function moveSelection(deltaCols, deltaRows) {
    const choices = getAvailableChoices();
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
    if (nextIndex >= choices.length) {
      nextIndex = choices.length - 1;
    }
    selectMenuIndex(nextIndex);
  }

  function addItem(id, count = 1, label = null) {
    if (typeof id !== "string" || !id.trim()) return;
    const key = id.trim();
    const qty = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
    const existing = state.items.find((item) => item.id === key);
    if (existing) {
      existing.count += qty;
    } else {
      state.items.push({ id: key, label: label || key, count: qty });
    }
    if (!state.equippedId) state.equippedId = key;
    render();
  }

  function consumeSelected(count = 1) {
    if (!state.equippedId) return false;
    const qty = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
    const item = state.items.find((entry) => entry.id === state.equippedId);
    if (item?.tool) return true;
    if (!item || item.count < qty) return false;
    item.count -= qty;
    if (item.count <= 0) {
      item.count = 0;
      state.equippedId = null;
    }
    render();
    return true;
  }

  function getSelectedItem() {
    if (!state.equippedId) return null;
    const item = state.items.find((entry) => entry.id === state.equippedId);
    if (!item) return null;
    if (item.tool) return item;
    if (item.count <= 0) return null;
    return item;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    const key = (event.key || "").toLowerCase();
    if (!state.menuOpen) return;
    if (key === "escape") {
      setMenuOpen(false);
      return;
    }
    if (key === "arrowup") {
      moveSelection(0, -1);
      return;
    }
    if (key === "arrowdown") {
      moveSelection(0, 1);
      return;
    }
    if (key === "arrowleft") {
      moveSelection(-1, 0);
      return;
    }
    if (key === "arrowright") {
      moveSelection(1, 0);
      return;
    }
    if (key === "enter") {
      applySelection();
      setMenuOpen(false);
      return;
    }
    if (key >= "0" && key <= "9") {
      const idx = Number.parseInt(key, 10);
      selectMenuIndex(idx);
    }
  }

  window.addEventListener("keydown", onKeyDown);
  state.equippedId = state.items[0]?.id || null;
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
    isMenuOpen: () => state.menuOpen,
    get items() { return state.items; },
    get selectedIndex() { return state.selectedMenuIndex; },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      if (statusHud.parentNode) {
        statusHud.parentNode.removeChild(statusHud);
      }
      floatingPanel.dispose();
    }
  };
}
