// Nodevision SCAD Editor - mountEditor.mjs
// Purpose: Shared mount logic for SCAD parametric editor (used by FileViewer + GraphicalEditor).

import { createSCADViewer } from "./viewer.mjs";
import { createSCADGraphicalEditorUI } from "./editorUI.mjs";
import { DEFAULT_ROOT, NODE_TYPES, createNode } from "./sceneTree.mjs";
import { generateSCAD, parseParametersFromSCAD, parseProjectFromSCAD } from "./scadGenerator.mjs";

function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeNotebookPath(pathLike = "") {
  let clean = String(pathLike || "").trim();
  if (!clean) return "";
  clean = clean.replace(/[?#].*$/, "");
  clean = clean.replace(/\\/g, "/");
  clean = clean.replace(/^https?:\/\/[^/]+/i, "");
  clean = clean.replace(/^\/+/, "");
  clean = clean.replace(/^Notebook\/+/i, "");
  clean = clean.replace(/\/+/g, "/");
  return clean;
}

function projectPathForScad(filePath) {
  const s = String(filePath || "");
  const base = s.toLowerCase().endsWith(".scad") ? s.slice(0, -5) : s;
  return `${base}.scadproj.json`;
}

function makeExampleProject() {
  const parameters = {
    width: "40",
    height: "10",
    hole_radius: "3",
  };

  const root = createNode(NODE_TYPES.difference, { parameters: {}, children: [] });
  const base = createNode(NODE_TYPES.cube, { parameters: { size: ["width", "height", "10"], center: false } });
  const xlate = createNode(NODE_TYPES.translate, { parameters: { v: ["width/2", "height/2", "0"] }, children: [] });
  const hole = createNode(NODE_TYPES.cylinder, { parameters: { h: "10", r: "hole_radius", center: false } });
  xlate.children.push(hole);
  root.children.push(base, xlate);

  const scadCode = generateSCAD(root, parameters);
  return { parameters, sceneTree: root, scadCode };
}

function makeStarterProjectFromParameters(parameters = {}) {
  const width = parameters.width ?? "40";
  const height = parameters.height ?? "10";
  const hole_radius = parameters.hole_radius ?? "3";
  const merged = {
    width,
    height,
    hole_radius,
    ...parameters,
  };

  const root = createNode(NODE_TYPES.difference, { parameters: {}, children: [] });
  const base = createNode(NODE_TYPES.cube, { parameters: { size: ["width", "height", "10"], center: false } });
  const xlate = createNode(NODE_TYPES.translate, { parameters: { v: ["width/2", "height/2", "0"] }, children: [] });
  const hole = createNode(NODE_TYPES.cylinder, { parameters: { h: "10", r: "hole_radius", center: false } });
  xlate.children.push(hole);
  root.children.push(base, xlate);

  const scadCode = generateSCAD(root, merged);
  return { parameters: merged, sceneTree: root, scadCode };
}

function chooseSCADOpenMode(container, { scadPath, projectPath, reason }) {
  return new Promise((resolve) => {
    container.innerHTML = `
      <div style="padding:16px; font:12px/1.45 monospace; color:#222;">
        <div style="font:600 14px/1.3 monospace; margin-bottom:8px;">OpenSCAD file detected</div>
        <div style="color:#444; margin-bottom:12px;">
          <div><b>${escapeHTML(scadPath)}</b></div>
          <div style="margin-top:6px;">
            No parametric project file found (<b>${escapeHTML(projectPath)}</b>).
          </div>
          <div style="margin-top:6px;">
            Visual (parametric) mode can only import a restricted subset of SCAD (primitives/transforms/booleans).
          </div>
          ${reason ? `<div style="margin-top:6px; color:#8a1c1c;">Import reason: ${escapeHTML(String(reason))}</div>` : ""}
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button id="nvOpenParametric"
            style="padding:8px 10px; border:1px solid #ccc; border-radius:10px; background:#fff; cursor:pointer; font:12px monospace;">
            Start parametric model
          </button>
          <button id="nvOpenCode"
            style="padding:8px 10px; border:1px solid #ccc; border-radius:10px; background:#fff; cursor:pointer; font:12px monospace;">
            Edit raw SCAD code
          </button>
        </div>
        <div style="color:#666; margin-top:12px;">
          Tip: In parametric mode, use <b>Save Project</b> to create the project JSON, and <b>Save .scad</b> to write generated SCAD.
        </div>
      </div>
    `;

    const btnParametric = container.querySelector("#nvOpenParametric");
    const btnCode = container.querySelector("#nvOpenCode");
    btnParametric?.addEventListener("click", () => resolve("parametric"));
    btnCode?.addEventListener("click", () => resolve("code"));
  });
}

export async function mountSCADParametricEditor(container, filePath, opts = {}) {
  const scadPath = normalizeNotebookPath(filePath);
  if (!scadPath.toLowerCase().endsWith(".scad")) throw new Error("Not a .scad file");

  const serverBase = "/Notebook";
  const SAVE_ENDPOINT = "/api/save";
  const RENDER_ENDPOINT = "/api/scad/render";
  const projectPath = projectPathForScad(scadPath);

  container.innerHTML = "";
  container.style.height = "100%";
  container.style.minHeight = "620px";

  let scadText = "";
  let projectJson = null;
  try {
    const res = await fetch(`${serverBase}/${encodeURI(scadPath)}`);
    if (res.ok) scadText = await res.text();
  } catch {
    scadText = "";
  }
  try {
    const projRes = await fetch(`${serverBase}/${encodeURI(projectPath)}`);
    if (projRes.ok) projectJson = await projRes.json();
  } catch {
    projectJson = null;
  }

  const hasProject = !!projectJson;
  const hasSCAD = !!String(scadText || "").trim();

  const parsedProject = hasSCAD ? parseProjectFromSCAD(scadText) : null;
  const canImportGeometry = !!parsedProject?.ok;

  let openMode = opts.initialOpenMode || "parametric";
  if (hasSCAD && !hasProject && !canImportGeometry) {
    openMode = await chooseSCADOpenMode(container, { scadPath, projectPath, reason: parsedProject?.error });
  }

  const initialState = (() => {
    if (hasProject) {
      return {
        filePath: scadPath,
        parameters: projectJson.parameters || {},
        sceneTree: projectJson.sceneTree || structuredClone(DEFAULT_ROOT),
        scadCode: projectJson.scadCode || "",
        manualCode: false,
      };
    }

    if (hasSCAD) {
      if (canImportGeometry) {
        const scadCode = generateSCAD(parsedProject.sceneTree, parsedProject.parameters);
        return {
          filePath: scadPath,
          parameters: parsedProject.parameters,
          sceneTree: parsedProject.sceneTree,
          scadCode,
          manualCode: false,
        };
      }

      if (openMode === "code") {
        return {
          filePath: scadPath,
          parameters: parseParametersFromSCAD(scadText),
          sceneTree: structuredClone(DEFAULT_ROOT),
          scadCode: scadText,
          manualCode: true,
        };
      }

      const params = parseParametersFromSCAD(scadText);
      const starter = makeStarterProjectFromParameters(params);
      return {
        filePath: scadPath,
        parameters: starter.parameters,
        sceneTree: starter.sceneTree,
        scadCode: starter.scadCode,
        manualCode: false,
      };
    }

    const example = makeExampleProject();
    return { filePath: scadPath, ...example, manualCode: false };
  })();

  const ui = createSCADGraphicalEditorUI(container, initialState);
  const viewer = createSCADViewer(ui.viewerMount, {
    initialTree: ui.state.sceneTree,
    initialParameters: ui.state.parameters,
  });
  viewer.setPickHandler?.((id) => ui.selectNode?.(id));
  viewer.setSelectedId?.(ui.state.selectedId);

  let renderTimer = 0;
  let latestRenderToken = 0;

  function scheduleOpenSCADRender(reason) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      requestOpenSCADRender(reason).catch(() => {});
    }, 550);
  }

  function regenFromTreeIfNeeded() {
    if (ui.state.manualCode) return;
    const scad = generateSCAD(ui.state.sceneTree, ui.state.parameters);
    ui.setSCADCode(scad);
  }

  async function postSave({ path, content, encoding = "utf8" }) {
    const res = await fetch(SAVE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content, encoding }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) throw new Error(json?.error || `${res.status} ${res.statusText}`);
  }

  async function requestOpenSCADRender(reason) {
    const token = ++latestRenderToken;
    const scadCode = ui.state.scadCode || "";
    if (!String(scadCode).trim()) {
      ui.setStatus("Nothing to render.");
      return;
    }
    ui.setStatus(`Rendering… (${reason || "update"})`);

    const res = await fetch(RENDER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scadCode, format: "stl" }),
    });

    if (token !== latestRenderToken) return;

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      ui.setStatus(`OpenSCAD render failed: ${err?.error || `${res.status} ${res.statusText}`}`);
      viewer.setApproximateFromTree(ui.state.sceneTree, ui.state.parameters, { fit: false });
      return;
    }

    const buf = await res.arrayBuffer();
    if (token !== latestRenderToken) return;
    await viewer.setSTLArrayBuffer(buf, { fit: true });
    ui.setStatus("Rendered via OpenSCAD.");
  }

  // Initial render
  regenFromTreeIfNeeded();
  viewer.setApproximateFromTree(ui.state.sceneTree, ui.state.parameters, { fit: true });
  scheduleOpenSCADRender(hasProject ? "project" : (hasSCAD ? "file" : "example"));

  // UI events
  ui.events.addEventListener("stateChanged", () => {
    regenFromTreeIfNeeded();
    viewer.setApproximateFromTree(ui.state.sceneTree, ui.state.parameters, { fit: false });
    viewer.setSelectedId?.(ui.state.selectedId);
    scheduleOpenSCADRender("update");
  });

  ui.events.addEventListener("selectionChanged", () => {
    viewer.setSelectedId?.(ui.state.selectedId);
  });

  ui.events.addEventListener("wireframeToggled", (e) => {
    viewer.setWireframeEnabled(!!e.detail?.enabled);
  });

  ui.events.addEventListener("fitRequested", () => {
    if (viewer?.fitToObject && viewer?.scene) {
      const skip = new Set(["GridHelper", "AxesHelper", "AmbientLight", "DirectionalLight", "HemisphereLight", "PointLight", "SpotLight"]);
      const obj = viewer.scene.children.find((c) => !skip.has(c.type));
      if (obj) viewer.fitToObject(obj);
    }
  });

  ui.events.addEventListener("renderRequested", () => {
    requestOpenSCADRender("manual").catch((err) => ui.setStatus(`Render error: ${err?.message || String(err)}`));
  });

  ui.events.addEventListener("manualCodeToggled", () => {
    regenFromTreeIfNeeded();
    scheduleOpenSCADRender("mode");
    ui.setStatus(ui.state.manualCode ? "Manual code mode (scene tree not updated from code)." : "Generated code mode.");
  });

  ui.events.addEventListener("manualCodeChanged", (e) => {
    const code = e.detail?.scadCode ?? ui.state.scadCode;
    const parsed = parseParametersFromSCAD(code);
    ui.setProjectJSON({ parameters: parsed, sceneTree: ui.state.sceneTree, scadCode: code });
    ui.setStatus("Manual code updated. Parameters parsed; scene tree unchanged.");
    viewer.setApproximateFromTree(ui.state.sceneTree, ui.state.parameters, { fit: false });
    scheduleOpenSCADRender("code");
  });

  ui.events.addEventListener("saveSCADRequested", async () => {
    try {
      const scad = ui.state.manualCode ? (ui.state.scadCode || "") : generateSCAD(ui.state.sceneTree, ui.state.parameters);
      ui.setSCADCode(scad);
      await postSave({ path: scadPath, content: scad, encoding: "utf8" });
      ui.setStatus("Saved .scad.");
    } catch (err) {
      ui.setStatus(`Save SCAD failed: ${err?.message || String(err)}`);
    }
  });

  ui.events.addEventListener("saveProjectRequested", async () => {
    try {
      const scad = ui.state.manualCode ? (ui.state.scadCode || "") : generateSCAD(ui.state.sceneTree, ui.state.parameters);
      ui.setSCADCode(scad);
      await postSave({ path: scadPath, content: scad, encoding: "utf8" });

      const proj = ui.getProjectJSON();
      await postSave({ path: projectPath, content: JSON.stringify(proj, null, 2), encoding: "utf8" });
      ui.setStatus(`Saved project + .scad: ${projectPath}`);
    } catch (err) {
      ui.setStatus(`Save Project failed: ${err?.message || String(err)}`);
    }
  });

  if (hasSCAD && !hasProject && canImportGeometry) {
    ui.setStatus("Imported SCAD into parametric model (restricted subset). Save .scad to write canonical output.");
  } else if (hasSCAD && !hasProject && openMode === "parametric") {
    ui.setStatus("Parametric model loaded. Original .scad is unchanged until you click Save .scad.");
  }

  function dispose() {
    window.clearTimeout(renderTimer);
    viewer?.dispose?.();
    ui?.dispose?.();
    container.innerHTML = "";
  }

  return {
    ui,
    viewer,
    scadPath,
    projectPath,
    generateSCAD: () => (ui.state.manualCode ? (ui.state.scadCode || "") : generateSCAD(ui.state.sceneTree, ui.state.parameters)),
    saveSCAD: async (path = scadPath) => {
      const code = ui.state.manualCode ? (ui.state.scadCode || "") : generateSCAD(ui.state.sceneTree, ui.state.parameters);
      ui.setSCADCode(code);
      await postSave({ path, content: code, encoding: "utf8" });
    },
    renderOpenSCAD: () => requestOpenSCADRender("toolbar"),
    fit: () => ui.events.dispatchEvent(new CustomEvent("fitRequested", { detail: {} })),
    dispose,
  };
}

