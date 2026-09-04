// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/directoryAppearanceWidget.mjs
// Compact sub-toolbar controls for persistent directory fill and line appearance.

import { DIRECTORY_APPEARANCE_CHANGED_EVENT, normalizeAlpha, normalizeDirectoryMetadataPath, normalizeHexColor, readDirectoryAppearance, saveDirectoryAppearance } from "/GraphManagement/DirectoryAppearanceClient.mjs";

const COLOR_SPECS = [{ colorKey: "fillColor", alphaKey: "fillAlpha", label: "Fill", fallback: "#E8D7B5" }, { colorKey: "outlineColor", alphaKey: "outlineAlpha", label: "Line", fallback: "#7A5C32" }];
let currentPath = null, currentAppearance = {}, colorInputs = {}, alphaInputs = {}, activeCleanup = null;

function ensureStyles() {
  if (document.getElementById("nv-directory-appearance-toolbar-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-directory-appearance-toolbar-styles";
  style.textContent = `
    #sub-toolbar .nv-subtoolbar-widget.nv-subtoolbar-widget--compact-script.nv-directory-appearance-toolbar-host{height:30px;min-height:30px;padding:0 4px;box-sizing:border-box;min-width:0;max-width:100%;overflow:hidden}
    #sub-toolbar .nv-directory-appearance-toolbar{display:flex;align-items:center;flex-wrap:nowrap;gap:4px;margin:0;font:10px system-ui,-apple-system,Segoe UI,sans-serif;min-width:0}
    #sub-toolbar .nv-directory-appearance-toolbar strong,#sub-toolbar .nv-directory-appearance-toolbar label{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;font-size:10px;font-weight:500;letter-spacing:0}
    #sub-toolbar .nv-directory-appearance-toolbar input[type="color"]{width:22px;height:20px;padding:0;border:1px solid #8a8f98;border-radius:3px;background:transparent}
    #sub-toolbar .nv-directory-appearance-toolbar input[type="number"]{width:34px;height:20px;box-sizing:border-box;border:1px solid #8a8f98;border-radius:3px;padding:1px 3px;background:#fff;color:#111827;font:10px ui-monospace,SFMono-Regular,Menlo,monospace}
    #sub-toolbar .nv-directory-appearance-toolbar button{height:20px;border:1px solid #6b7280;border-radius:3px;background:#f3f4f6;color:#111827;cursor:pointer;font:10px system-ui,-apple-system,Segoe UI,sans-serif;padding:1px 5px;white-space:nowrap}
    #sub-toolbar .nv-directory-appearance-path{max-width:min(72px,10vw);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #sub-toolbar .nv-directory-appearance-status{max-width:42px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#4b5563;font-size:10px;font-weight:500}
    html[data-nv-theme="dark"] #sub-toolbar .nv-directory-appearance-toolbar input{background:#111827;color:#e5e7eb;border-color:#475569}
    html[data-nv-theme="dark"] #sub-toolbar .nv-directory-appearance-toolbar button{background:#1f2937;color:#e5e7eb;border-color:#64748b}
    html[data-nv-theme="dark"] #sub-toolbar .nv-directory-appearance-status{color:#cbd5e1}`;
  document.head.appendChild(style);
}

function cleanSelectionEntries(entries = []) {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    path: normalizeDirectoryMetadataPath(entry?.path || ""),
    isDirectory: Boolean(entry?.isDirectory),
  })).filter((entry) => entry.isDirectory);
}

function selectedDirectoryPath(owner = "") {
  const state = window.NodevisionState || {};
  const ownerName = String(owner || "").trim();
  const ownerMatches = !ownerName || !state.selectedFilesOwner || state.selectedFilesOwner === ownerName;
  const entries = ownerMatches ? cleanSelectionEntries(state.selectedFiles) : [];
  const primary = entries[entries.length - 1];
  if (primary) return primary.path;
  if (ownerMatches && state.selectedFileIsDirectory === true) {
    return normalizeDirectoryMetadataPath(state.selectedFile || window.selectedFilePath || "");
  }
  return null;
}

function field(mount, name) {
  return mount.querySelector(`[data-field="${name}"]`);
}

function setStatus(mount, message, isError = false) {
  const status = field(mount, "status");
  if (!status) return;
  status.textContent = message || "";
  status.style.color = isError ? "#b91c1c" : "";
}

function setEnabled(mount, enabled) {
  mount.querySelectorAll("input, button").forEach((el) => { el.disabled = !enabled; });
}

function syncForm(mount) {
  field(mount, "path").textContent = currentPath === "" ? "Notebook" : (currentPath || "Dir");
  for (const spec of COLOR_SPECS) {
    colorInputs[spec.colorKey].value = currentAppearance[spec.colorKey] || spec.fallback;
    const alpha = normalizeAlpha(currentAppearance[spec.alphaKey]);
    alphaInputs[spec.alphaKey].value = String(Math.round((alpha ?? 1) * 100));
  }
}

async function loadSelection(mount, owner = "") {
  currentPath = selectedDirectoryPath(owner);
  if (currentPath === null) {
    currentAppearance = {};
    syncForm(mount);
    setEnabled(mount, false);
    setStatus(mount, "No dir.");
    return;
  }
  setEnabled(mount, true);
  currentAppearance = await readDirectoryAppearance(currentPath);
  syncForm(mount);
  setStatus(mount, "Ready.");
}

async function commitAppearance(mount, nextAppearance) {
  if (currentPath === null) return;
  try {
    setEnabled(mount, false);
    setStatus(mount, "Saving...");
    currentAppearance = await saveDirectoryAppearance(currentPath, nextAppearance);
    syncForm(mount);
    setStatus(mount, "Saved.");
  } catch (err) {
    setStatus(mount, err?.message || "Save failed.", true);
  } finally {
    setEnabled(mount, true);
  }
}

async function commitColor(mount, key, rawValue) {
  const normalized = normalizeHexColor(rawValue);
  if (!normalized) return setStatus(mount, "Bad hex.", true);
  await commitAppearance(mount, { ...currentAppearance, [key]: normalized });
}

async function commitAlpha(mount, key, rawValue) {
  const percent = Number.parseFloat(String(rawValue ?? ""));
  if (!Number.isFinite(percent)) return setStatus(mount, "Bad alpha.", true);
  const alpha = normalizeAlpha(Math.max(0, Math.min(100, percent)) + "%") ?? 1;
  const next = { ...currentAppearance };
  if (alpha >= 1) delete next[key];
  else next[key] = alpha;
  await commitAppearance(mount, next);
}

function bindEvents(mount) {
  const handleClick = (event) => {
    if (event.target?.dataset?.action === "reset-all") commitAppearance(mount, {});
  };
  mount.addEventListener("click", handleClick);
  return () => mount.removeEventListener("click", handleClick);
}

function makeControl(mount, spec) {
  const label = document.createElement("label");
  const color = document.createElement("input");
  const alphaLabel = document.createElement("label");
  const alpha = document.createElement("input");
  label.textContent = spec.label + " ";
  label.title = `${spec.label} color`;
  color.type = "color";
  color.addEventListener("change", () => commitColor(mount, spec.colorKey, color.value));
  alphaLabel.textContent = "A ";
  alphaLabel.title = `${spec.label} alpha percent`;
  Object.assign(alpha, { type: "number", min: "0", max: "100", step: "5" });
  alpha.setAttribute("aria-label", `${spec.label} alpha percent`);
  alpha.addEventListener("change", () => commitAlpha(mount, spec.alphaKey, alpha.value));
  label.appendChild(color);
  alphaLabel.appendChild(alpha);
  colorInputs[spec.colorKey] = color;
  alphaInputs[spec.alphaKey] = alpha;
  return [label, alphaLabel];
}

function mountAppearanceControls(mount) {
  const form = mount.querySelector("form");
  const resetAll = field(mount, "resetAll");
  colorInputs = {};
  alphaInputs = {};
  for (const spec of COLOR_SPECS) {
    for (const control of makeControl(mount, spec)) form.insertBefore(control, resetAll);
  }
}

export async function initToolbarWidget(mount, item = {}) {
  if (!mount) return;
  ensureStyles();
  activeCleanup?.();
  mount.__nvDirectoryAppearanceCleanup?.();
  mount.classList.add("nv-directory-appearance-toolbar-host");
  mount.innerHTML = `<form class="nv-directory-appearance-toolbar" autocomplete="off">
    <strong class="nv-directory-appearance-path" data-field="path">Dir</strong>
    <button type="button" data-field="resetAll" data-action="reset-all" title="Reset directory fill and line colors" aria-label="Reset directory fill and line colors">All</button>
    <span class="nv-directory-appearance-status" data-field="status" role="status" aria-live="polite"></span>
  </form>`;
  mountAppearanceControls(mount);
  const removeLocalEvents = bindEvents(mount);
  const owner = item.owner || item.selectedPanel || item.panelType || "";
  const reload = () => loadSelection(mount, owner).catch((err) => setStatus(mount, err?.message || "Load failed.", true));
  const appearanceChanged = (event) => {
    if (normalizeDirectoryMetadataPath(event?.detail?.path || "") === currentPath) reload();
  };
  window.addEventListener("nodevision-file-selection-set-changed", reload);
  window.addEventListener(DIRECTORY_APPEARANCE_CHANGED_EVENT, appearanceChanged);
  mount.__nvDirectoryAppearanceCleanup = () => {
    removeLocalEvents();
    window.removeEventListener("nodevision-file-selection-set-changed", reload);
    window.removeEventListener(DIRECTORY_APPEARANCE_CHANGED_EVENT, appearanceChanged);
    activeCleanup = null;
  };
  activeCleanup = mount.__nvDirectoryAppearanceCleanup;
  await loadSelection(mount, owner);
}
