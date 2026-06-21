// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/NBTPropertiesPanel.mjs
// Properties panel for NBT block selections and editable NBT tag documents.

import { setStatus } from "/StatusBar.mjs";

const STAIR_FACINGS = ["north", "south", "east", "west"];
const STAIR_HALVES = ["bottom", "top"];
const STAIR_SHAPES = ["straight", "inner_left", "inner_right", "outer_left", "outer_right"];

function isStairBlock(id) {
  return /(^|:)[\w.-]+_stairs$/.test(String(id || "").trim());
}

function parseStateName(stateText = "") {
  const text = String(stateText || "").trim();
  const start = text.indexOf("[");
  return start === -1 ? text : text.slice(0, start);
}

function field(labelText, input) {
  const wrap = document.createElement("label");
  wrap.className = "nv-nbt-property-field";
  const label = document.createElement("span");
  label.textContent = labelText;
  wrap.append(label, input);
  return wrap;
}

function textInput(value = "") {
  const input = document.createElement("input");
  input.type = "text";
  input.value = String(value || "");
  return input;
}

function numberInput(value = 0) {
  const input = document.createElement("input");
  input.type = "number";
  input.step = "1";
  input.value = String(Number.isFinite(Number(value)) ? Number(value) : 0);
  return input;
}

function selectInput(options, value) {
  const select = document.createElement("select");
  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    select.appendChild(option);
  });
  select.value = value || options[0] || "";
  return select;
}

function button(label, onClick) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
}

function ensureStyles() {
  if (document.getElementById("nv-nbt-properties-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-nbt-properties-styles";
  style.textContent = `
    .nv-nbt-properties { display:flex; flex-direction:column; gap:10px; min-height:0; height:100%; color:#111827; font:13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .nv-nbt-properties__header { font-weight:800; border-bottom:1px solid #d0d0d0; padding-bottom:6px; }
    .nv-nbt-properties__body { display:flex; flex-direction:column; gap:10px; min-height:0; overflow:auto; }
    .nv-nbt-properties__summary { color:#4b5563; }
    .nv-nbt-property-field { display:grid; gap:4px; font-weight:650; color:#374151; }
    .nv-nbt-property-field input, .nv-nbt-property-field select, .nv-nbt-property-field textarea { width:100%; box-sizing:border-box; min-height:28px; border:1px solid #aeb9c8; border-radius:4px; padding:4px 6px; font:inherit; background:#fff; color:#111827; }
    .nv-nbt-property-field textarea { min-height:130px; resize:vertical; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:12px; }
    .nv-nbt-properties__position { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
    .nv-nbt-properties__actions { display:flex; flex-wrap:wrap; gap:8px; }
    .nv-nbt-properties__actions button { min-height:28px; border:1px solid #aeb9c8; border-radius:4px; padding:4px 8px; background:#fff; color:#111827; cursor:pointer; font:inherit; font-weight:650; }
    .nv-nbt-properties__hint { color:#6b7280; padding:10px 0; }
    .nv-nbt-properties__error { color:#b00020; min-height:1.2em; }
  `;
  document.head.appendChild(style);
}

function getContext() {
  if (window.NBTTagEditorContext && window.NodevisionState?.nbtTagEditorActive) return window.NBTTagEditorContext;
  return window.NBTEditorContext || window.NBTTagEditorContext || null;
}


function textareaInput(value = "") {
  const input = document.createElement("textarea");
  input.spellcheck = false;
  input.value = String(value ?? "");
  return input;
}

function renderTagProperties(panel, context) {
  const state = context?.getState?.() || {};
  panel.innerHTML = "";

  const root = document.createElement("div");
  root.className = "nv-nbt-properties";
  panel.appendChild(root);

  const header = document.createElement("div");
  header.className = "nv-nbt-properties__header";
  header.textContent = state.title || context?.title || "NBT Tag Properties";
  root.appendChild(header);

  const body = document.createElement("div");
  body.className = "nv-nbt-properties__body";
  root.appendChild(body);

  if (state.error) {
    const hint = document.createElement("div");
    hint.className = "nv-nbt-properties__hint";
    hint.textContent = state.error;
    body.appendChild(hint);
    return;
  }

  const rootName = textInput(state.rootName || "");
  body.appendChild(field("Root Name", rootName));

  const littleEndian = document.createElement("input");
  littleEndian.type = "checkbox";
  littleEndian.checked = Boolean(state.littleEndian);
  body.appendChild(field("Little Endian", littleEndian));

  const pathSelect = document.createElement("select");
  (state.paths || []).forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.path;
    option.textContent = `${entry.label} (${entry.type})`;
    pathSelect.appendChild(option);
  });
  pathSelect.value = state.selectedPath || "/";
  body.appendChild(field("Selected Tag", pathSelect));

  const tag = state.selectedTag || {};
  const nameInput = textInput(tag.name || "root");
  nameInput.disabled = tag.canRename === false;
  body.appendChild(field("Tag Name", nameInput));

  const typeInput = selectInput(state.tagTypes || [], tag.type || "String");
  typeInput.disabled = tag.path === "/";
  body.appendChild(field("Tag Type", typeInput));

  const itemTypeInput = selectInput((state.tagTypes || []).filter((type) => type !== "End"), tag.itemType || "String");
  body.appendChild(field("List Item Type", itemTypeInput));

  const valueInput = textareaInput(tag.valueText || "null");
  body.appendChild(field("Value JSON", valueInput));

  const message = document.createElement("div");
  message.className = "nv-nbt-properties__error";
  body.appendChild(message);

  function syncListFields() {
    itemTypeInput.closest("label").style.display = typeInput.value === "List" ? "grid" : "none";
  }

  function apply() {
    const result = context.updateSelectedTag?.({
      rootName: rootName.value,
      littleEndian: littleEndian.checked,
      name: nameInput.value,
      type: typeInput.value,
      itemType: itemTypeInput.value,
      valueText: valueInput.value,
    });
    if (result?.ok === false) {
      message.textContent = result.reason || "Unable to update tag.";
      setStatus("NBT", message.textContent);
    } else {
      message.textContent = "";
      setStatus("NBT", "Tag updated");
    }
  }

  pathSelect.addEventListener("change", () => context.setSelectedTagPath?.(pathSelect.value));
  typeInput.addEventListener("change", syncListFields);
  [rootName, nameInput, typeInput, itemTypeInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") apply();
    });
  });

  const actions = document.createElement("div");
  actions.className = "nv-nbt-properties__actions";
  actions.append(
    button("Apply", apply),
    button("Add Child", () => {
      const result = context.addChild?.();
      if (result?.ok === false) message.textContent = result.reason || "Unable to add tag.";
    }),
    button("Delete", () => {
      const result = context.deleteSelectedTag?.();
      if (result?.ok === false) message.textContent = result.reason || "Unable to delete tag.";
    }),
    button("Format", () => context.formatTags?.()),
  );
  body.appendChild(actions);
  syncListFields();
}

function renderPanel(panel, context) {
  const state = context?.getState?.() || {};
  if (context?.id === "nbt-tags" || state.id === "nbt-tags") {
    renderTagProperties(panel, context);
    return;
  }
  const block = state.selectedBlock || null;
  panel.innerHTML = "";

  const root = document.createElement("div");
  root.className = "nv-nbt-properties";
  panel.appendChild(root);

  const header = document.createElement("div");
  header.className = "nv-nbt-properties__header";
  header.textContent = context?.title || "NBT Block Properties";
  root.appendChild(header);

  const body = document.createElement("div");
  body.className = "nv-nbt-properties__body";
  root.appendChild(body);

  if (!context) {
    const hint = document.createElement("div");
    hint.className = "nv-nbt-properties__hint";
    hint.textContent = "Open an NBT file in the graphical editor to edit block properties.";
    body.appendChild(hint);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "nv-nbt-properties__summary";
  summary.textContent = block
    ? `${block.x}, ${block.y}, ${block.z}`
    : `${state.blockCount || 0} blocks`;
  body.appendChild(summary);

  if (!block) {
    const hint = document.createElement("div");
    hint.className = "nv-nbt-properties__hint";
    hint.textContent = "Select a block in the NBT editor to edit its properties.";
    body.appendChild(hint);
    return;
  }

  const identity = textInput(block.stateText || block.id);
  const datalistId = "nv-nbt-properties-blocks";
  identity.setAttribute("list", datalistId);
  body.appendChild(field("Identity", identity));

  const datalist = document.createElement("datalist");
  datalist.id = datalistId;
  (context.commonBlocks || []).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    datalist.appendChild(option);
  });
  body.appendChild(datalist);

  const position = document.createElement("div");
  position.className = "nv-nbt-properties__position";
  const xInput = numberInput(block.x);
  const yInput = numberInput(block.y);
  const zInput = numberInput(block.z);
  position.append(field("X", xInput), field("Y", yInput), field("Z", zInput));
  body.appendChild(position);

  const stairFields = document.createElement("div");
  stairFields.style.display = "grid";
  stairFields.style.gap = "10px";
  const facing = selectInput(STAIR_FACINGS, block.properties?.facing || "north");
  const half = selectInput(STAIR_HALVES, block.properties?.half || "bottom");
  const shape = selectInput(STAIR_SHAPES, block.properties?.shape || "straight");
  stairFields.append(field("Facing", facing), field("Half", half), field("Shape", shape));
  body.appendChild(stairFields);

  const message = document.createElement("div");
  message.className = "nv-nbt-properties__error";
  body.appendChild(message);

  function syncStairVisibility() {
    const name = parseStateName(identity.value || block.id);
    stairFields.style.display = isStairBlock(name) ? "grid" : "none";
  }

  function apply() {
    const properties = {};
    if (stairFields.style.display !== "none") {
      properties.facing = facing.value;
      properties.half = half.value;
      properties.shape = shape.value;
    }
    const result = context.updateSelectedBlock?.({
      stateText: identity.value,
      x: xInput.value,
      y: yInput.value,
      z: zInput.value,
      properties,
    });
    if (result?.ok === false) {
      message.textContent = result.reason || "Unable to update block.";
      setStatus("NBT", message.textContent);
    } else {
      message.textContent = "";
      setStatus("NBT", "Block updated");
    }
  }

  identity.addEventListener("input", syncStairVisibility);
  [identity, xInput, yInput, zInput, facing, half, shape].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") apply();
    });
  });

  const actions = document.createElement("div");
  actions.className = "nv-nbt-properties__actions";
  actions.append(
    button("Apply", apply),
    button("Add Above", () => context.addNearSelection?.()),
    button("Delete", () => context.deleteSelectedBlock?.()),
  );
  body.appendChild(actions);
  syncStairVisibility();
}

export async function setupPanel(panel) {
  if (!panel) throw new Error("Panel container required.");
  ensureStyles();
  Object.assign(panel.style, {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  });

  let unsubscribe = null;
  const attach = () => {
    if (typeof unsubscribe === "function") unsubscribe();
    const context = getContext();
    renderPanel(panel, context);
    unsubscribe = context?.subscribe?.(() => renderPanel(panel, context)) || null;
  };

  attach();
  const ready = () => attach();
  const cleared = () => attach();
  window.addEventListener("nv-nbt-context-ready", ready);
  window.addEventListener("nv-nbt-context-cleared", cleared);

  const cleanup = () => {
    if (typeof unsubscribe === "function") unsubscribe();
    window.removeEventListener("nv-nbt-context-ready", ready);
    window.removeEventListener("nv-nbt-context-cleared", cleared);
  };
  panel.__nvCleanupPropertiesPanel = cleanup;
  panel.cleanup = cleanup;
}
