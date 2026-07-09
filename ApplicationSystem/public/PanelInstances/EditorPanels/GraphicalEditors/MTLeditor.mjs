// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MTLeditor.mjs
// Graphical editor for Wavefront MTL material library files.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import {
  colorToHex,
  createMaterial,
  escapeHTML,
  formatNumber,
  getColor,
  getNumber,
  getTextValue,
  hexToColor,
  materialOpacity,
  materialPreviewColor,
  materialTextureEntries,
  materialUnknownEntries,
  parseMtl,
  serializeMtl,
  setColor,
  setMaterialName,
  setNumber,
  setTextValue,
  summarizeMtl,
  uniqueMaterialName,
} from "/PanelInstances/ViewPanels/FileViewers/MTL/mtlFormat.mjs";
import { setWordCount } from "/StatusBar.mjs";

const NOTEBOOK_BASE = "/Notebook";
const SAVE_ENDPOINT = "/api/save";

function normalizeNotebookPath(pathLike = "") {
  return String(pathLike || "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/, "");
}

function notebookUrl(filePath = "") {
  return `${NOTEBOOK_BASE}/${normalizeNotebookPath(filePath).split("/").filter(Boolean).map(encodeURIComponent).join("/")}`;
}

async function fetchText(filePath) {
  const response = await fetch(notebookUrl(filePath), { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function saveText({ targetPath, sourcePath, content }) {
  const response = await fetch(SAVE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: normalizeNotebookPath(targetPath),
      sourcePath: normalizeNotebookPath(sourcePath),
      content,
      encoding: "utf8",
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `${response.status} ${response.statusText}`);
  }
  return data;
}

export async function renderEditor(filePath, container) {
  const sourcePath = normalizeNotebookPath(filePath);
  const state = {
    filePath: sourcePath,
    document: parseMtl(""),
    rawText: "",
    rawDirty: false,
    selectedIndex: 0,
    dirty: false,
  };

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "MTLEditing";
  window.NodevisionState.selectedFile = sourcePath;
  window.NodevisionState.activeEditorFilePath = sourcePath;
  window.currentActiveFilePath = sourcePath;
  window.filePath = sourcePath;
  window.__nvMarkdownActivePath = sourcePath;
  updateToolbarState({ currentMode: "MTLEditing", selectedFile: sourcePath, activeEditorFilePath: sourcePath });

  container.innerHTML = "";
  const root = document.createElement("section");
  root.className = "nv-mtl-editor";
  root.innerHTML = editorCss();
  container.appendChild(root);

  const toolbar = document.createElement("header");
  toolbar.className = "nv-mtl-editor-toolbar";
  toolbar.innerHTML = `
    <div class="nv-mtl-editor-title">
      <h2>${escapeHTML(baseName(sourcePath))}</h2>
      <p data-mtl-status>Loading...</p>
    </div>
    <div class="nv-mtl-editor-actions">
      <button type="button" data-action="add" title="Add material">+</button>
      <button type="button" data-action="apply-raw">Apply Raw</button>
      <button type="button" data-action="save">Save</button>
    </div>
  `;

  const body = document.createElement("div");
  body.className = "nv-mtl-editor-body";
  body.innerHTML = `
    <nav class="nv-mtl-material-list" aria-label="MTL materials"></nav>
    <main class="nv-mtl-material-editor"></main>
    <aside class="nv-mtl-raw-pane">
      <div class="nv-mtl-pane-title">Raw MTL</div>
      <textarea spellcheck="false"></textarea>
    </aside>
  `;

  root.append(toolbar, body);

  const statusEl = toolbar.querySelector("[data-mtl-status]");
  const listEl = body.querySelector(".nv-mtl-material-list");
  const detailEl = body.querySelector(".nv-mtl-material-editor");
  const rawEl = body.querySelector("textarea");

  const setStatusText = (text) => {
    statusEl.textContent = text;
  };

  const markDirty = () => {
    state.dirty = true;
    updateToolbarState({ fileIsDirty: true });
  };

  const currentText = () => state.rawDirty ? rawEl.value : serializeMtl(state.document);

  const syncRawFromDocument = () => {
    state.rawText = serializeMtl(state.document);
    state.rawDirty = false;
    rawEl.value = state.rawText;
    updateStats();
    setWordCount(state.rawText.trim() ? state.rawText.trim().split(/\s+/).length : 0);
  };

  const applyRaw = () => {
    state.rawText = rawEl.value;
    state.document = parseMtl(state.rawText);
    state.rawDirty = false;
    if (state.selectedIndex >= state.document.materials.length) {
      state.selectedIndex = Math.max(0, state.document.materials.length - 1);
    }
    renderMaterialList();
    renderMaterialEditor();
    updateStats();
  };

  const saveCurrent = async (target = sourcePath) => {
    if (state.rawDirty) applyRaw();
    const content = currentText();
    await saveText({ targetPath: target || sourcePath, sourcePath, content });
    state.dirty = false;
    updateToolbarState({ fileIsDirty: false });
    window.dispatchEvent(new CustomEvent("nodevision-file-saved", { detail: { filePath: target || sourcePath } }));
    setStatusText(`Saved ${baseName(target || sourcePath)}`);
    return true;
  };

  window.getEditorMarkdown = () => currentText();
  window.saveMDFile = saveCurrent;
  window.saveWYSIWYGFile = undefined;
  container.__nvActiveEditorCleanup = () => {
    if (window.saveMDFile === saveCurrent) window.saveMDFile = undefined;
    if (window.getEditorMarkdown) window.getEditorMarkdown = undefined;
    if (window.__nvMarkdownActivePath === sourcePath) window.__nvMarkdownActivePath = null;
  };

  toolbar.querySelector('[data-action="add"]').addEventListener("click", () => {
    if (state.rawDirty) applyRaw();
    const name = uniqueMaterialName(state.document, "Material");
    state.document.materials.push(createMaterial(name));
    state.selectedIndex = state.document.materials.length - 1;
    syncRawFromDocument();
    renderMaterialList();
    renderMaterialEditor();
    markDirty();
  });

  toolbar.querySelector('[data-action="apply-raw"]').addEventListener("click", () => {
    applyRaw();
    markDirty();
    setStatusText("Raw applied");
  });

  toolbar.querySelector('[data-action="save"]').addEventListener("click", () => {
    saveCurrent().catch((err) => {
      console.error("Failed to save MTL:", err);
      setStatusText(`Save failed: ${err.message || err}`);
    });
  });

  rawEl.addEventListener("input", () => {
    state.rawDirty = true;
    markDirty();
    setStatusText("Raw edited");
  });

  function updateStats() {
    const summary = summarizeMtl(state.document);
    setStatusText(`${summary.materialCount} material${summary.materialCount === 1 ? "" : "s"}, ${summary.textureCount} map${summary.textureCount === 1 ? "" : "s"}`);
  }

  function renderMaterialList() {
    listEl.innerHTML = "";
    const materials = state.document.materials;
    if (!materials.length) {
      const empty = document.createElement("div");
      empty.className = "nv-mtl-empty";
      empty.textContent = "No materials";
      listEl.appendChild(empty);
      return;
    }

    materials.forEach((material, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `nv-mtl-material-button${index === state.selectedIndex ? " is-active" : ""}`;
      button.title = material.name || "Unnamed material";
      const color = materialPreviewColor(material);
      button.innerHTML = `
        <span class="nv-mtl-list-swatch"></span>
        <span class="nv-mtl-list-name"></span>
      `;
      button.querySelector(".nv-mtl-list-swatch").style.background = colorToHex(color);
      button.querySelector(".nv-mtl-list-name").textContent = material.name || "Unnamed material";
      button.addEventListener("click", () => {
        if (state.rawDirty) applyRaw();
        state.selectedIndex = index;
        renderMaterialList();
        renderMaterialEditor();
      });
      listEl.appendChild(button);
    });
  }

  function selectedMaterial() {
    return state.document.materials[state.selectedIndex] || null;
  }

  function renderMaterialEditor() {
    detailEl.innerHTML = "";
    const material = selectedMaterial();
    if (!material) {
      const empty = document.createElement("div");
      empty.className = "nv-mtl-empty";
      empty.textContent = "No material selected";
      detailEl.appendChild(empty);
      return;
    }

    const form = document.createElement("form");
    form.className = "nv-mtl-form";
    form.addEventListener("submit", (event) => event.preventDefault());

    const nameRow = document.createElement("label");
    nameRow.className = "nv-mtl-field nv-mtl-field-full";
    nameRow.innerHTML = `<span>Name</span><input type="text" data-name value="${escapeHTML(material.name || "")}">`;
    nameRow.querySelector("input").addEventListener("input", (event) => {
      setMaterialName(material, event.target.value);
      syncRawFromDocument();
      renderMaterialList();
      markDirty();
    });
    form.appendChild(nameRow);

    form.append(
      colorField(material, "Ka", "Ambient"),
      colorField(material, "Kd", "Diffuse"),
      colorField(material, "Ks", "Specular"),
      colorField(material, "Ke", "Emission"),
      numberField(material, "Ns", "Shininess", { min: 0, max: 1000, step: 1, fallback: 10 }),
      numberField(material, "Ni", "Optical density", { min: 0, max: 10, step: 0.01, fallback: 1 }),
      numberField(material, "d", "Opacity", { min: 0, max: 1, step: 0.01, fallback: materialOpacity(material) }),
      illumField(material),
      textField(material, "map_Kd", "Diffuse map"),
      textField(material, "map_Ks", "Specular map"),
      textField(material, "map_Bump", "Bump map"),
      textField(material, "norm", "Normal map"),
    );

    const custom = materialUnknownEntries(material);
    const customBox = document.createElement("div");
    customBox.className = "nv-mtl-custom-lines";
    const customTitle = document.createElement("div");
    customTitle.className = "nv-mtl-pane-title";
    customTitle.textContent = "Custom directives";
    const customPre = document.createElement("pre");
    customPre.textContent = custom.map((entry) => entry.raw).join("\n") || "None";
    customBox.append(customTitle, customPre);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "nv-mtl-delete";
    deleteButton.textContent = "Delete Material";
    deleteButton.addEventListener("click", () => {
      state.document.materials.splice(state.selectedIndex, 1);
      state.selectedIndex = Math.min(state.selectedIndex, Math.max(0, state.document.materials.length - 1));
      syncRawFromDocument();
      renderMaterialList();
      renderMaterialEditor();
      markDirty();
    });

    detailEl.append(form, customBox, deleteButton);
  }

  function colorField(material, key, label) {
    const value = getColor(material, key, key === "Kd" ? [0.8, 0.8, 0.8] : [0, 0, 0]);
    const field = document.createElement("div");
    field.className = "nv-mtl-field nv-mtl-color-field";
    field.innerHTML = `
      <span>${label}</span>
      <input type="color" value="${colorToHex(value)}" title="${label}">
      <input type="number" min="0" max="1" step="0.01" value="${formatNumber(value[0], 3)}" aria-label="${label} red">
      <input type="number" min="0" max="1" step="0.01" value="${formatNumber(value[1], 3)}" aria-label="${label} green">
      <input type="number" min="0" max="1" step="0.01" value="${formatNumber(value[2], 3)}" aria-label="${label} blue">
    `;
    const [colorInput, rInput, gInput, bInput] = field.querySelectorAll("input");
    const applyValues = (values) => {
      setColor(material, key, values);
      syncRawFromDocument();
      renderMaterialList();
      markDirty();
    };
    colorInput.addEventListener("input", () => {
      const rgb = hexToColor(colorInput.value);
      rInput.value = formatNumber(rgb[0], 3);
      gInput.value = formatNumber(rgb[1], 3);
      bInput.value = formatNumber(rgb[2], 3);
      applyValues(rgb);
    });
    [rInput, gInput, bInput].forEach((input) => {
      input.addEventListener("input", () => {
        const rgb = [rInput.value, gInput.value, bInput.value].map((item) => Number(item));
        colorInput.value = colorToHex(rgb);
        applyValues(rgb);
      });
    });
    return field;
  }

  function numberField(material, key, label, options = {}) {
    const value = getNumber(material, key, options.fallback ?? 0);
    const field = document.createElement("label");
    field.className = "nv-mtl-field";
    field.innerHTML = `
      <span>${label}</span>
      <input type="number" min="${options.min ?? ""}" max="${options.max ?? ""}" step="${options.step ?? 0.01}" value="${formatNumber(value, 3)}">
    `;
    field.querySelector("input").addEventListener("input", (event) => {
      setNumber(material, key, event.target.value, { precision: key === "illum" ? 0 : 3 });
      syncRawFromDocument();
      markDirty();
    });
    return field;
  }

  function illumField(material) {
    const value = String(Math.round(getNumber(material, "illum", 2)));
    const field = document.createElement("label");
    field.className = "nv-mtl-field";
    field.innerHTML = `
      <span>Illumination</span>
      <select>
        ${Array.from({ length: 11 }, (_, index) => `<option value="${index}"${String(index) === value ? " selected" : ""}>${index}</option>`).join("")}
      </select>
    `;
    field.querySelector("select").addEventListener("change", (event) => {
      setNumber(material, "illum", event.target.value, { precision: 0 });
      syncRawFromDocument();
      markDirty();
    });
    return field;
  }

  function textField(material, key, label) {
    const value = getTextValue(material, key, "");
    const field = document.createElement("label");
    field.className = "nv-mtl-field nv-mtl-field-full";
    field.innerHTML = `<span>${label}</span><input type="text" value="${escapeHTML(value)}">`;
    field.querySelector("input").addEventListener("input", (event) => {
      setTextValue(material, key, event.target.value, { removeEmpty: true });
      syncRawFromDocument();
      markDirty();
    });
    return field;
  }

  try {
    const text = await fetchText(sourcePath);
    state.document = parseMtl(text);
    state.rawText = serializeMtl(state.document);
    state.selectedIndex = state.document.materials.length ? 0 : -1;
    rawEl.value = state.rawText;
    renderMaterialList();
    renderMaterialEditor();
    updateStats();
    setWordCount(state.rawText.trim() ? state.rawText.trim().split(/\s+/).length : 0);
    updateToolbarState({ fileIsDirty: false });
  } catch (err) {
    detailEl.innerHTML = `<div class="nv-mtl-error">Failed to load MTL: ${escapeHTML(err.message || err)}</div>`;
    setStatusText("Load failed");
    setWordCount(0);
  }
}

function baseName(path = "") {
  return String(path || "").replace(/\\/g, "/").split("/").pop() || "material.mtl";
}

function editorCss() {
  return `
    <style>
      .nv-mtl-editor,
      .nv-mtl-editor * { box-sizing: border-box; }
      .nv-mtl-editor {
        width: 100%;
        height: 100%;
        min-height: 480px;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        background: #f5f7f8;
        color: #172026;
        font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .nv-mtl-editor-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-bottom: 1px solid #ced7de;
        background: #ffffff;
      }
      .nv-mtl-editor-title { min-width: 0; }
      .nv-mtl-editor-title h2 {
        margin: 0;
        font-size: 16px;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }
      .nv-mtl-editor-title p {
        margin: 3px 0 0;
        color: #5f6c76;
        font-size: 12px;
      }
      .nv-mtl-editor-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .nv-mtl-editor-actions button,
      .nv-mtl-delete {
        border: 1px solid #aebbc4;
        border-radius: 6px;
        background: #f7fafb;
        color: #1d2e38;
        min-height: 30px;
        padding: 5px 10px;
        font: inherit;
        cursor: pointer;
      }
      .nv-mtl-editor-actions button:hover,
      .nv-mtl-delete:hover { background: #eef4f6; border-color: #6f8796; }
      .nv-mtl-editor-body {
        min-height: 0;
        display: grid;
        grid-template-columns: 230px minmax(340px, 1fr) minmax(280px, 36%);
        overflow: hidden;
      }
      .nv-mtl-material-list,
      .nv-mtl-material-editor,
      .nv-mtl-raw-pane {
        min-height: 0;
        overflow: auto;
      }
      .nv-mtl-material-list {
        border-right: 1px solid #ced7de;
        background: #ffffff;
        padding: 8px;
      }
      .nv-mtl-material-button {
        width: 100%;
        min-width: 0;
        display: grid;
        grid-template-columns: 24px minmax(0, 1fr);
        align-items: center;
        gap: 8px;
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        color: #172026;
        min-height: 36px;
        padding: 5px 7px;
        text-align: left;
        font: inherit;
        cursor: pointer;
      }
      .nv-mtl-material-button:hover { background: #f0f4f6; }
      .nv-mtl-material-button.is-active { border-color: #7890a0; background: #e9f1f4; }
      .nv-mtl-list-swatch {
        width: 22px;
        height: 22px;
        border: 1px solid #9aa7b0;
        border-radius: 5px;
      }
      .nv-mtl-list-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nv-mtl-material-editor {
        padding: 12px;
      }
      .nv-mtl-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(180px, 1fr));
        gap: 10px;
      }
      .nv-mtl-field {
        min-width: 0;
        display: grid;
        gap: 5px;
        color: #44515a;
        font-weight: 650;
      }
      .nv-mtl-field-full { grid-column: 1 / -1; }
      .nv-mtl-field input,
      .nv-mtl-field select,
      .nv-mtl-raw-pane textarea {
        width: 100%;
        min-width: 0;
        border: 1px solid #b9c5cc;
        border-radius: 6px;
        background: #ffffff;
        color: #111820;
        padding: 7px 8px;
        font: 13px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .nv-mtl-color-field {
        grid-template-columns: 1fr 44px repeat(3, minmax(54px, 1fr));
        align-items: end;
      }
      .nv-mtl-color-field span { grid-column: 1 / -1; }
      .nv-mtl-color-field input[type="color"] {
        height: 34px;
        padding: 2px;
      }
      .nv-mtl-custom-lines {
        margin-top: 12px;
        border: 1px solid #ced7de;
        border-radius: 8px;
        background: #ffffff;
      }
      .nv-mtl-custom-lines pre {
        margin: 0;
        max-height: 140px;
        overflow: auto;
        padding: 8px;
        background: #111820;
        color: #edf3f7;
        border-radius: 0 0 8px 8px;
        white-space: pre-wrap;
        font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .nv-mtl-pane-title {
        padding: 8px 10px;
        border-bottom: 1px solid #d7e0e5;
        color: #44515a;
        font-weight: 700;
      }
      .nv-mtl-delete {
        margin-top: 12px;
        color: #8c1d18;
        border-color: #d1aaa6;
        background: #fff8f7;
      }
      .nv-mtl-raw-pane {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        border-left: 1px solid #ced7de;
        background: #ffffff;
      }
      .nv-mtl-raw-pane textarea {
        height: 100%;
        resize: none;
        border: 0;
        border-radius: 0;
        background: #111820;
        color: #edf3f7;
        padding: 12px;
        white-space: pre;
        overflow: auto;
      }
      .nv-mtl-empty,
      .nv-mtl-error {
        padding: 12px;
        color: #6a747c;
      }
      .nv-mtl-error { color: #8c1d18; }
      @media (max-width: 980px) {
        .nv-mtl-editor-body { grid-template-columns: 190px minmax(0, 1fr); }
        .nv-mtl-raw-pane { grid-column: 1 / -1; min-height: 240px; border-left: 0; border-top: 1px solid #ced7de; }
      }
      @media (max-width: 660px) {
        .nv-mtl-editor-body { grid-template-columns: minmax(0, 1fr); }
        .nv-mtl-material-list { border-right: 0; border-bottom: 1px solid #ced7de; max-height: 180px; }
        .nv-mtl-form { grid-template-columns: minmax(0, 1fr); }
        .nv-mtl-color-field { grid-template-columns: 44px repeat(3, minmax(54px, 1fr)); }
      }
    </style>
  `;
}
