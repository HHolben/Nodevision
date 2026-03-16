// Nodevision SCAD Editor - editorUI.mjs
// Purpose: DOM-based editor UI (parameters, geometry tree, code panel) + minimal interactions.

import {
  NODE_TYPES,
  createNode,
  DEFAULT_ROOT,
  newNodeId,
  traverse,
  wrapNodeWithParent,
  addChildById,
  removeNodeById,
  updateNodeById,
  ensureBooleanParentForSelection,
  findNodeById,
  normalizeParameters,
} from "./sceneTree.mjs";

import { getPrimitiveDefaults, listPrimitives } from "./plugins.mjs";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "style") node.style.cssText = String(v);
    else if (k === "class") node.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined) node.setAttribute(k, String(v));
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function nodeLabel(node) {
  if (!node) return "";
  const p = node.parameters || {};
  if (node.type === NODE_TYPES.cube) return `cube size=${Array.isArray(p.size) ? `[${p.size.join(",")}]` : String(p.size ?? "")}`;
  if (node.type === NODE_TYPES.sphere) return `sphere r=${String(p.r ?? "")}`;
  if (node.type === NODE_TYPES.cylinder) return `cylinder h=${String(p.h ?? "")} r=${String(p.r ?? "")}`;
  if (node.type === NODE_TYPES.translate) return `translate v=${Array.isArray(p.v) ? `[${p.v.join(",")}]` : String(p.v ?? "")}`;
  if (node.type === NODE_TYPES.rotate) return `rotate a=${Array.isArray(p.a) ? `[${p.a.join(",")}]` : String(p.a ?? "")}`;
  if (node.type === NODE_TYPES.scale) return `scale v=${Array.isArray(p.v) ? `[${p.v.join(",")}]` : String(p.v ?? "")}`;
  if (node.type === NODE_TYPES.mirror) return `mirror v=${Array.isArray(p.v) ? `[${p.v.join(",")}]` : String(p.v ?? "")}`;
  return node.type;
}

function renderTree(node, selectedId, onSelect, depth = 0) {
  const row = el("div", {
    class: "nv-scad-tree-row",
    style: [
      "display:flex",
      "align-items:center",
      "gap:6px",
      "padding:3px 6px",
      "cursor:pointer",
      `margin-left:${depth * 12}px`,
      "border-radius:6px",
      selectedId === node.id ? "background:#e3f2fd" : "",
    ].filter(Boolean).join(";"),
    onclick: () => onSelect(node.id),
  }, [
    el("span", { style: "font:12px/1.3 monospace;color:#222;" }, [nodeLabel(node)]),
  ]);

  const children = (node.children || []).flatMap((c) => renderTree(c, selectedId, onSelect, depth + 1));
  return [row, ...children];
}

function inputRow(label, inputEl) {
  return el("div", { style: "display:flex; gap:8px; align-items:center; margin:6px 0;" }, [
    el("div", { style: "width:82px; font:12px/1.2 monospace; color:#444;" }, [label]),
    inputEl,
  ]);
}

function smallBtn(text, onclick) {
  return el("button", {
    style: [
      "padding:4px 8px",
      "border:1px solid #ccc",
      "border-radius:8px",
      "background:#fff",
      "cursor:pointer",
      "font:12px/1 monospace",
    ].join(";"),
    onclick,
  }, [text]);
}

function parseVec3FromInputs(x, y, z) {
  return [x.value.trim() || "0", y.value.trim() || "0", z.value.trim() || "0"];
}

function vec3Inputs(initial) {
  const arr = Array.isArray(initial) ? initial : [initial?.[0] ?? "0", initial?.[1] ?? "0", initial?.[2] ?? "0"];
  const x = el("input", { value: String(arr[0] ?? "0"), style: "width:70px; font:12px monospace; padding:4px 6px;" });
  const y = el("input", { value: String(arr[1] ?? "0"), style: "width:70px; font:12px monospace; padding:4px 6px;" });
  const z = el("input", { value: String(arr[2] ?? "0"), style: "width:70px; font:12px monospace; padding:4px 6px;" });
  const wrap = el("div", { style: "display:flex; gap:6px; align-items:center;" }, [x, y, z]);
  return { wrap, x, y, z };
}

function scalarInput(initial) {
  return el("input", { value: String(initial ?? "0"), style: "flex:1; font:12px monospace; padding:4px 6px;" });
}

function selectNodeTypeOptions(types) {
  const s = el("select", { style: "font:12px monospace; padding:4px 6px; border-radius:8px; border:1px solid #ccc;" });
  for (const t of types) s.appendChild(el("option", { value: t }, [t]));
  return s;
}

export function createSCADGraphicalEditorUI(container, initialState) {
  container.innerHTML = "";

  /** @type {{
   *  filePath: string,
   *  parameters: Record<string,string|number>,
   *  sceneTree: any,
   *  scadCode: string,
   *  manualCode: boolean,
   *  selectedId: string|null,
   * }} */
  const state = {
    filePath: initialState.filePath,
    parameters: normalizeParameters(initialState.parameters || {}),
    sceneTree: initialState.sceneTree || structuredClone(DEFAULT_ROOT),
    scadCode: initialState.scadCode || "",
    manualCode: !!initialState.manualCode,
    selectedId: initialState.selectedId || (initialState.sceneTree?.id ?? null),
  };

  // Ensure every node has a stable id (needed for selection/editing).
  if (!state.sceneTree?.id) state.sceneTree.id = newNodeId();
  traverse(state.sceneTree, (node) => {
    if (!node.id) node.id = newNodeId();
    if (!node.parameters) node.parameters = {};
    if (!Array.isArray(node.children)) node.children = [];
  });
  if (!state.selectedId) state.selectedId = state.sceneTree.id;

  const events = new EventTarget();
  const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));

  // Layout
  const root = el("div", {
    class: "nv-scad-root",
    style: [
      "display:grid",
      "grid-template-columns: 320px 1fr 360px",
      "grid-template-rows: auto 1fr",
      "gap:10px",
      "width:100%",
      "height:100%",
      "min-height:520px",
      "box-sizing:border-box",
      "padding:10px",
      "overflow:hidden",
    ].join(";"),
  });
  container.appendChild(root);

  // Overlay container (used for "Add Node" and "Code" dialogs)
  const overlay = el("div", {
    style: [
      "position:absolute",
      "inset:0",
      "display:none",
      "align-items:center",
      "justify-content:center",
      "background:rgba(0,0,0,0.25)",
      "z-index:10",
      "padding:16px",
      "box-sizing:border-box",
    ].join(";"),
  });
  container.style.position = "relative";
  container.appendChild(overlay);

  function closeOverlay() {
    overlay.style.display = "none";
    overlay.innerHTML = "";
  }

  function openOverlay(cardEl) {
    overlay.innerHTML = "";
    overlay.appendChild(cardEl);
    overlay.style.display = "flex";
  }

  const header = el("div", {
    style: "grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; gap:10px;",
  }, [
    el("div", { style: "font:600 13px/1.3 monospace; color:#111;" }, [`SCAD Editor — ${state.filePath}`]),
    el("div", { style: "display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end;" }, [
      smallBtn("Render (OpenSCAD)", () => emit("renderRequested", {})),
      smallBtn("Save .scad", () => emit("saveSCADRequested", {})),
      smallBtn("Save Project", () => emit("saveProjectRequested", {})),
      smallBtn("Code", () => emit("codeDialogRequested", {})),
    ]),
  ]);
  root.appendChild(header);

  const left = el("div", { style: "grid-column:1; grid-row:2; display:flex; flex-direction:column; min-height:0; overflow:hidden; border:1px solid #ddd; border-radius:10px; background:#fff;" });
  const mid = el("div", { style: "grid-column:2; grid-row:2; display:flex; flex-direction:column; min-height:0; overflow:hidden; border:1px solid #ddd; border-radius:10px; background:#fff;" });
  const right = el("div", { style: "grid-column:3; grid-row:2; display:flex; flex-direction:column; min-height:0; overflow:hidden; border:1px solid #ddd; border-radius:10px; background:#fff;" });
  root.appendChild(left);
  root.appendChild(mid);
  root.appendChild(right);

  // Parameter panel
  const paramHeader = el("div", { style: "padding:10px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content:space-between;" }, [
    el("div", { style: "font:600 12px/1.2 monospace; color:#111;" }, ["Parameters"]),
    smallBtn("+", () => {
      let i = 1;
      while (state.parameters[`p${i}`] !== undefined) i += 1;
      state.parameters[`p${i}`] = "0";
      emit("stateChanged", { reason: "paramAdd" });
      redraw();
    }),
  ]);
  left.appendChild(paramHeader);

  const paramBody = el("div", { style: "padding:10px; overflow:auto; min-height:0;" });
  left.appendChild(paramBody);

  // Viewer panel (mid)
  const viewerHeader = el("div", { style: "padding:10px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content:space-between;" }, [
    el("div", { style: "font:600 12px/1.2 monospace; color:#111;" }, ["Preview"]),
    el("div", { style: "display:flex; gap:8px; align-items:center;" }, [
      el("label", { style: "display:flex; gap:6px; align-items:center; font:12px/1 monospace; color:#333; user-select:none;" }, [
        (() => {
          const cb = el("input", { type: "checkbox" });
          cb.addEventListener("change", () => emit("wireframeToggled", { enabled: cb.checked }));
          return cb;
        })(),
        el("span", {}, ["Wireframe"]),
      ]),
      smallBtn("Fit", () => emit("fitRequested", {})),
    ]),
  ]);
  mid.appendChild(viewerHeader);

  const viewerMount = el("div", { style: "flex:1; min-height:0; position:relative;" });
  mid.appendChild(viewerMount);

  const statusBar = el("div", { style: "padding:8px 10px; border-top:1px solid #eee; font:12px/1.2 monospace; color:#555;" }, ["Ready."]);
  mid.appendChild(statusBar);

  // Right side: tree + node props + code
  const treeHeader = el("div", { style: "padding:10px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content:space-between; gap:10px;" }, [
    el("div", { style: "font:600 12px/1.2 monospace; color:#111;" }, ["Geometry Tree"]),
    el("div", { style: "display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end;" }, [
      smallBtn("Add", () => emit("addNodeRequested", {})),
      smallBtn("Delete", () => {
        if (!state.selectedId || state.selectedId === state.sceneTree?.id) return;
        state.sceneTree = removeNodeById(state.sceneTree, state.selectedId);
        state.selectedId = state.sceneTree?.id ?? null;
        emit("stateChanged", { reason: "nodeDelete" });
        redraw();
      }),
    ]),
  ]);
  right.appendChild(treeHeader);

  const treeBody = el("div", { style: "padding:10px; overflow:auto; min-height:0; border-bottom:1px solid #eee;" });
  right.appendChild(treeBody);

  const propsHeader = el("div", { style: "padding:10px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content:space-between;" }, [
    el("div", { style: "font:600 12px/1.2 monospace; color:#111;" }, ["Node Properties"]),
    el("div", { style: "font:12px/1.2 monospace; color:#666;" }, ["(expressions allowed)"]),
  ]);
  right.appendChild(propsHeader);

  const propsBody = el("div", { style: "padding:10px; overflow:auto; max-height:220px; border-bottom:1px solid #eee;" });
  right.appendChild(propsBody);

  // Code editor (shown in overlay; model-first UI keeps code out of the main layout)
  const codeArea = el("textarea", {
    style: [
      "width:100%",
      "min-height:55vh",
      "max-height:75vh",
      "box-sizing:border-box",
      "padding:10px",
      "border:1px solid #ddd",
      "border-radius:10px",
      "outline:none",
      "resize:vertical",
      "font:12px/1.35 monospace",
      "background:#fafafa",
    ].join(";"),
  });

  codeArea.addEventListener("input", () => {
    if (!state.manualCode) return;
    state.scadCode = codeArea.value;
    emit("manualCodeChanged", { scadCode: state.scadCode });
  });

  function openAddDialog() {
    const card = el("div", { style: "width:520px; max-width:90vw; background:#fff; border-radius:12px; border:1px solid #ddd; padding:12px;" });

    const title = el("div", { style: "font:600 12px/1.3 monospace; color:#111; margin-bottom:10px;" }, ["Add Node"]);
    card.appendChild(title);

    const builtin = [
      NODE_TYPES.cube,
      NODE_TYPES.sphere,
      NODE_TYPES.cylinder,
      NODE_TYPES.translate,
      NODE_TYPES.rotate,
      NODE_TYPES.scale,
      NODE_TYPES.mirror,
      NODE_TYPES.union,
      NODE_TYPES.difference,
      NODE_TYPES.intersection,
    ];
    const pluginTypes = listPrimitives().map((p) => p.type).filter((t) => !builtin.includes(t));
    const typeSel = selectNodeTypeOptions([...builtin, ...pluginTypes]);
    card.appendChild(inputRow("type", typeSel));

    const hint = el("div", { style: "font:12px/1.35 monospace; color:#555; margin:6px 0 10px 0;" }, [
      "Adds to selected node. If selected is a primitive, it is wrapped in a union().",
    ]);
    card.appendChild(hint);

    const footer = el("div", { style: "display:flex; justify-content:flex-end; gap:8px; margin-top:12px;" }, [
      smallBtn("Cancel", closeOverlay),
      smallBtn("Add", () => {
        closeOverlay();
        addNode(typeSel.value);
      }),
    ]);
    card.appendChild(footer);
    openOverlay(card);
  }

  function openCodeDialog() {
    redrawCode();
    const card = el("div", { style: "width:860px; max-width:95vw; background:#fff; border-radius:12px; border:1px solid #ddd; padding:12px; box-sizing:border-box;" });

    const titleBar = el("div", { style: "display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;" }, [
      el("div", { style: "font:600 12px/1.3 monospace; color:#111;" }, ["OpenSCAD Code"]),
      smallBtn("Close", closeOverlay),
    ]);
    card.appendChild(titleBar);

    const manualRow = el("div", { style: "display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;" }, [
      el("div", { style: "font:12px/1.35 monospace; color:#555;" }, [
        state.manualCode ? "Manual mode: editing code updates parameters (best effort)." : "Generated mode: code is read-only output from the model tree.",
      ]),
      el("label", { style: "display:flex; gap:6px; align-items:center; font:12px/1 monospace; color:#333; user-select:none;" }, [
        (() => {
          const cb = el("input", { type: "checkbox" });
          cb.checked = state.manualCode;
          cb.addEventListener("change", () => {
            state.manualCode = cb.checked;
            emit("manualCodeToggled", { enabled: state.manualCode });
            redrawCode();
            manualRow.firstChild.textContent = state.manualCode
              ? "Manual mode: editing code updates parameters (best effort)."
              : "Generated mode: code is read-only output from the model tree.";
          });
          return cb;
        })(),
        el("span", {}, ["Manual edit"]),
      ]),
    ]);
    card.appendChild(manualRow);

    card.appendChild(codeArea);
    openOverlay(card);
  }

  function addNode(type) {
    const selectedId = state.selectedId || state.sceneTree?.id;
    if (!selectedId) return;

    // If adding a child to a primitive, wrap it first.
    const selected = findNodeById(state.sceneTree, selectedId);
    let attachId = selectedId;
    if (selected && !selected.children?.length && (selected.type === NODE_TYPES.cube || selected.type === NODE_TYPES.sphere || selected.type === NODE_TYPES.cylinder || selected.type === NODE_TYPES.polyhedron)) {
      const wrapped = ensureBooleanParentForSelection(state.sceneTree, selectedId, NODE_TYPES.union);
      state.sceneTree = wrapped.tree;
      attachId = wrapped.booleanId || selectedId;
      state.selectedId = attachId;
    }

    const defaultsFromPlugin = getPrimitiveDefaults(type);
    const defaults = defaultsFromPlugin ?? (() => {
      switch (type) {
        case NODE_TYPES.cube:
          return { size: ["width", "height", "10"], center: false };
        case NODE_TYPES.sphere:
          return { r: "10" };
        case NODE_TYPES.cylinder:
          return { h: "10", r: "hole_radius", center: false };
        case NODE_TYPES.translate:
          return { v: ["0", "0", "0"] };
        case NODE_TYPES.rotate:
          return { a: ["0", "0", "0"] };
        case NODE_TYPES.scale:
          return { v: ["1", "1", "1"] };
        case NODE_TYPES.mirror:
          return { v: ["1", "0", "0"] };
        default:
          return {};
      }
    })();

    const child = createNode(type, { parameters: defaults, children: [] });
    state.sceneTree = addChildById(state.sceneTree, attachId, child);
    state.selectedId = child.id;
    emit("stateChanged", { reason: "nodeAdd" });
    redraw();
  }

  function addNodeOfType(type) {
    addNode(type);
  }

  function deleteSelected() {
    if (!state.selectedId || state.selectedId === state.sceneTree?.id) return false;
    state.sceneTree = removeNodeById(state.sceneTree, state.selectedId);
    state.selectedId = state.sceneTree?.id ?? null;
    emit("stateChanged", { reason: "nodeDelete" });
    redraw();
    return true;
  }

  function wrapSelectedWith(wrapperType, wrapperParams = {}) {
    if (!state.selectedId) return false;
    const { tree, wrapperId } = wrapNodeWithParent(state.sceneTree, state.selectedId, wrapperType, wrapperParams);
    if (!wrapperId) return false;
    state.sceneTree = tree;
    state.selectedId = wrapperId;
    emit("stateChanged", { reason: "nodeWrap" });
    redraw();
    return true;
  }

  function redrawParameters() {
    paramBody.innerHTML = "";
    const entries = Object.entries(state.parameters || {});
    if (!entries.length) {
      paramBody.appendChild(el("div", { style: "font:12px/1.35 monospace; color:#666;" }, ["No parameters. Click + to add."]));
      return;
    }

    for (const [name, value] of entries) {
      const nameInput = el("input", { value: name, style: "width:120px; font:12px monospace; padding:4px 6px;" });
      const valueInput = el("input", { value: String(value), style: "flex:1; font:12px monospace; padding:4px 6px;" });
      const del = smallBtn("×", () => {
        delete state.parameters[name];
        emit("stateChanged", { reason: "paramDelete" });
        redraw();
      });
      del.style.padding = "4px 8px";
      del.style.color = "#b71c1c";

      nameInput.addEventListener("change", () => {
        const nextName = nameInput.value.trim();
        if (!nextName || nextName === name) return;
        if (state.parameters[nextName] !== undefined) return;
        const v = state.parameters[name];
        delete state.parameters[name];
        state.parameters[nextName] = v;
        emit("stateChanged", { reason: "paramRename" });
        redraw();
      });
      valueInput.addEventListener("input", () => {
        state.parameters[nameInput.value.trim() || name] = valueInput.value.trim();
        emit("stateChanged", { reason: "paramEdit" });
      });

      const row = el("div", { style: "display:flex; gap:6px; align-items:center; margin:6px 0;" }, [
        nameInput,
        valueInput,
        del,
      ]);
      paramBody.appendChild(row);
    }
  }

  function redrawTree() {
    treeBody.innerHTML = "";
    const rows = renderTree(state.sceneTree, state.selectedId, (id) => {
      state.selectedId = id;
      emit("selectionChanged", { id });
      redraw();
    });
    for (const r of rows) treeBody.appendChild(r);
  }

  function redrawProps() {
    propsBody.innerHTML = "";
    const node = state.selectedId ? findNodeById(state.sceneTree, state.selectedId) : null;
    if (!node) {
      propsBody.appendChild(el("div", { style: "font:12px/1.35 monospace; color:#666;" }, ["No node selected."]));
      return;
    }

    propsBody.appendChild(el("div", { style: "font:12px/1.35 monospace; color:#444; margin-bottom:10px;" }, [
      el("div", {}, [`id: ${escapeHTML(node.id || "")}`]),
      el("div", {}, [`type: ${escapeHTML(node.type || "")}`]),
    ]));

    const p = node.parameters || {};

    function commit(nextParams) {
      state.sceneTree = updateNodeById(state.sceneTree, node.id, (n) => ({ ...n, parameters: nextParams }));
      emit("stateChanged", { reason: "nodeParams" });
      redraw();
    }

    if (node.type === NODE_TYPES.cube) {
      const size = vec3Inputs(Array.isArray(p.size) ? p.size : ["10", "10", "10"]);
      propsBody.appendChild(inputRow("size", size.wrap));
      const center = el("input", { type: "checkbox" });
      center.checked = String(p.center).toLowerCase() === "true" || p.center === true;
      propsBody.appendChild(inputRow("center", center));
      const apply = smallBtn("Apply", () => commit({ ...p, size: parseVec3FromInputs(size.x, size.y, size.z), center: center.checked }));
      propsBody.appendChild(el("div", { style: "margin-top:8px; display:flex; justify-content:flex-end;" }, [apply]));
      return;
    }

    if (node.type === NODE_TYPES.sphere) {
      const r = scalarInput(p.r ?? "10");
      propsBody.appendChild(inputRow("r", r));
      const apply = smallBtn("Apply", () => commit({ ...p, r: r.value.trim() || "0" }));
      propsBody.appendChild(el("div", { style: "margin-top:8px; display:flex; justify-content:flex-end;" }, [apply]));
      return;
    }

    if (node.type === NODE_TYPES.cylinder) {
      const h = scalarInput(p.h ?? "10");
      const r = scalarInput(p.r ?? "5");
      propsBody.appendChild(inputRow("h", h));
      propsBody.appendChild(inputRow("r", r));
      const center = el("input", { type: "checkbox" });
      center.checked = String(p.center).toLowerCase() === "true" || p.center === true;
      propsBody.appendChild(inputRow("center", center));
      const apply = smallBtn("Apply", () => commit({ ...p, h: h.value.trim() || "0", r: r.value.trim() || "0", center: center.checked }));
      propsBody.appendChild(el("div", { style: "margin-top:8px; display:flex; justify-content:flex-end;" }, [apply]));
      return;
    }

    if (node.type === NODE_TYPES.translate || node.type === NODE_TYPES.rotate || node.type === NODE_TYPES.scale || node.type === NODE_TYPES.mirror) {
      const key = node.type === NODE_TYPES.rotate ? "a" : "v";
      const vec = vec3Inputs(Array.isArray(p[key]) ? p[key] : ["0", "0", "0"]);
      propsBody.appendChild(inputRow(key, vec.wrap));
      const apply = smallBtn("Apply", () => commit({ ...p, [key]: parseVec3FromInputs(vec.x, vec.y, vec.z) }));
      propsBody.appendChild(el("div", { style: "margin-top:8px; display:flex; justify-content:flex-end;" }, [apply]));
      return;
    }

    // Fallback: JSON parameters editor
    const json = el("textarea", {
      style: "width:100%; min-height:140px; font:12px/1.35 monospace; padding:8px; border:1px solid #ddd; border-radius:10px; background:#fff;",
    });
    json.value = JSON.stringify(p, null, 2);
    const apply = smallBtn("Apply", () => {
      try {
        const next = JSON.parse(json.value);
        if (typeof next !== "object" || next === null || Array.isArray(next)) throw new Error("Expected object");
        commit(next);
      } catch (err) {
        statusBar.textContent = `Invalid JSON: ${err?.message || String(err)}`;
      }
    });
    propsBody.appendChild(json);
    propsBody.appendChild(el("div", { style: "margin-top:8px; display:flex; justify-content:flex-end;" }, [apply]));
  }

  function redrawCode() {
    codeArea.readOnly = !state.manualCode;
    codeArea.style.background = state.manualCode ? "#fff" : "#fafafa";
    codeArea.value = state.scadCode || "";
  }

  function redraw() {
    redrawParameters();
    redrawTree();
    redrawProps();
  }

  function selectNode(id) {
    if (!id) return;
    state.selectedId = id;
    emit("selectionChanged", { id });
    redrawTree();
    redrawProps();
  }

  // Public API
  function setSCADCode(scadCode) {
    state.scadCode = scadCode || "";
    redrawCode();
  }

  function setStatus(text) {
    statusBar.textContent = String(text || "");
  }

  function getProjectJSON() {
    return {
      parameters: normalizeParameters(state.parameters),
      sceneTree: state.sceneTree,
      scadCode: state.scadCode,
    };
  }

  function setProjectJSON(project) {
    if (project?.parameters) state.parameters = normalizeParameters(project.parameters);
    if (project?.sceneTree) state.sceneTree = project.sceneTree;
    if (typeof project?.scadCode === "string") state.scadCode = project.scadCode;
    emit("stateChanged", { reason: "projectLoad" });
    redraw();
  }

  // Wire add dialog
  events.addEventListener("addNodeRequested", openAddDialog);
  events.addEventListener("codeDialogRequested", openCodeDialog);

  redraw();

  return {
    events,
    state,
    viewerMount,
    setSCADCode,
    setStatus,
    getProjectJSON,
    setProjectJSON,
    openAddDialog,
    openCodeDialog,
    selectNode,
    addNodeOfType,
    deleteSelected,
    wrapSelectedWith,
    dispose() {
      container.innerHTML = "";
    },
  };
}
