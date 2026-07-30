// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/UserPreferencesPanel.mjs
// Defines the browser-side User Preferences panel.

import { updateToolbarState } from "/panels/createToolbar.mjs";

const STORAGE_KEY = "nodevision.userPreferences";

const DEFAULT_PREFERENCES = Object.freeze({
  theme: "system",
  interfaceDensity: "comfortable",
  accentColor: "#0a84ff",
  panelChrome: "standard",
  toolbarIconScale: 1,
  showToolbarLabels: true,
  showStatusBar: true,
  reduceMotion: false,
  confirmCloseDirtyEditors: true,
  editorTabSize: 2,
  editorSoftTabs: true,
  editorWordWrap: true,
  editorAutosave: false,
  autosaveIntervalSeconds: 30,
  restoreCursorPosition: true,
  graphicalZoomSensitivity: 0.8,
  graphicalSnapToGrid: false,
  handwritingRecognitionMethod: "ocr",
  handwritingExperimentalStrokeRecognitionEnabled: true,
  handwritingStrokeContextRanking: true,
  navigatorStartPanel: "FileManager",
  fileManagerView: "list",
  fileManagerSort: "name",
  fileManagerShowExtensions: true,
  graphAnimatedLayout: true,
  graphShowEdgeLabels: true,
  graphOpenLinksInView: true,
  worldMovementMode: "walk",
  worldMouseSensitivity: 1,
  worldPlacementGrid: 1,
  worldSpatialAudio: true,
  worldShowColliders: false,
  worldGravityOnByDefault: true,
  accessibilityFocusOutlines: true,
  accessibilityLargeControls: false,
  accessibilityAnnounceStatus: false,
  accessibilityKeyboardFirst: false,
  privacyTelemetry: false,
  privacyOfflineFirst: true,
  syncFrequency: "manual",
});

const SECTIONS = Object.freeze([
  {
    title: "Interface",
    fields: [
      { key: "theme", label: "Theme", type: "select", options: [["system", "System"], ["light", "Light"], ["dark", "Dark"], ["high-contrast", "High contrast"]] },
      { key: "interfaceDensity", label: "Density", type: "select", options: [["comfortable", "Comfortable"], ["compact", "Compact"], ["spacious", "Spacious"]] },
      { key: "accentColor", label: "Accent color", type: "color" },
      { key: "panelChrome", label: "Panel chrome", type: "select", options: [["standard", "Standard"], ["quiet", "Quiet"], ["outlined", "Outlined"]] },
      { key: "toolbarIconScale", label: "Toolbar icon scale", type: "range", min: 0.75, max: 1.5, step: 0.05, suffix: "x" },
      { key: "showToolbarLabels", label: "Toolbar labels", type: "checkbox" },
      { key: "showStatusBar", label: "Status bar", type: "checkbox" },
      { key: "reduceMotion", label: "Reduce motion", type: "checkbox" },
    ],
  },
  {
    title: "Editors",
    fields: [
      { key: "editorTabSize", label: "Tab size", type: "number", min: 1, max: 12, step: 1 },
      { key: "editorSoftTabs", label: "Use spaces for tabs", type: "checkbox" },
      { key: "editorWordWrap", label: "Word wrap", type: "checkbox" },
      { key: "editorAutosave", label: "Autosave", type: "checkbox" },
      { key: "autosaveIntervalSeconds", label: "Autosave interval", type: "number", min: 5, max: 600, step: 5, suffix: "sec" },
      { key: "restoreCursorPosition", label: "Restore cursor position", type: "checkbox" },
      { key: "confirmCloseDirtyEditors", label: "Confirm dirty editor close", type: "checkbox" },
      { key: "graphicalZoomSensitivity", label: "Graphical zoom sensitivity", type: "range", min: 0.2, max: 2, step: 0.05, suffix: "x" },
      { key: "graphicalSnapToGrid", label: "Snap graphical edits to grid", type: "checkbox" },
      { key: "handwritingRecognitionMethod", label: "Handwriting recognition method", type: "select", options: [["ocr", "OCR / existing recognition"], ["experimental-stroke", "Experimental Stroke Recognition"]] },
      { key: "handwritingExperimentalStrokeRecognitionEnabled", label: "Experimental stroke recognition", type: "checkbox" },
      { key: "handwritingStrokeContextRanking", label: "Stroke context ranking", type: "checkbox" },
    ],
  },
  {
    title: "Files And Graph",
    fields: [
      { key: "navigatorStartPanel", label: "Navigator start panel", type: "select", options: [["FileManager", "File Manager"], ["GraphManager", "Graph Manager"]] },
      { key: "fileManagerView", label: "File manager view", type: "select", options: [["list", "List"], ["details", "Details"], ["icons", "Icons"]] },
      { key: "fileManagerSort", label: "File sort", type: "select", options: [["name", "Name"], ["type", "Type"], ["modified", "Modified"], ["size", "Size"]] },
      { key: "fileManagerShowExtensions", label: "Show file extensions", type: "checkbox" },
      { key: "graphAnimatedLayout", label: "Animated graph layout", type: "checkbox" },
      { key: "graphShowEdgeLabels", label: "Graph edge labels", type: "checkbox" },
      { key: "graphOpenLinksInView", label: "Open graph links in viewer", type: "checkbox" },
    ],
  },
  {
    title: "Virtual World",
    fields: [
      { key: "worldMovementMode", label: "Default movement", type: "select", options: [["walk", "Walk"], ["run", "Run when available"], ["fly", "Fly in editor"]] },
      { key: "worldMouseSensitivity", label: "Mouse sensitivity", type: "range", min: 0.25, max: 2.5, step: 0.05, suffix: "x" },
      { key: "worldPlacementGrid", label: "Placement grid", type: "number", min: 0.05, max: 64, step: 0.05 },
      { key: "worldSpatialAudio", label: "Spatial audio", type: "checkbox" },
      { key: "worldShowColliders", label: "Show collision helpers", type: "checkbox" },
      { key: "worldGravityOnByDefault", label: "Gravity on by default", type: "checkbox" },
    ],
  },
  {
    title: "Accessibility",
    fields: [
      { key: "accessibilityFocusOutlines", label: "Strong focus outlines", type: "checkbox" },
      { key: "accessibilityLargeControls", label: "Large controls", type: "checkbox" },
      { key: "accessibilityAnnounceStatus", label: "Announce status changes", type: "checkbox" },
      { key: "accessibilityKeyboardFirst", label: "Keyboard-first editing", type: "checkbox" },
    ],
  },
  {
    title: "Privacy And Sync",
    fields: [
      { key: "privacyTelemetry", label: "Usage diagnostics", type: "checkbox" },
      { key: "privacyOfflineFirst", label: "Offline-first file access", type: "checkbox" },
      { key: "syncFrequency", label: "Sync frequency", type: "select", options: [["manual", "Manual"], ["startup", "At startup"], ["interval", "Timed interval"], ["continuous", "Continuous"]] },
    ],
  },
]);

const FIELD_BY_KEY = new Map(SECTIONS.flatMap((section) => section.fields.map((field) => [field.key, field])));

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readPreferences() {
  try {
    const stored = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || "{}");
    return {
      ...DEFAULT_PREFERENCES,
      ...(isPlainObject(stored) ? stored : {}),
    };
  } catch (err) {
    console.warn("Unable to read user preferences:", err);
    return { ...DEFAULT_PREFERENCES };
  }
}

function writePreferences(preferences) {
  const normalized = { ...DEFAULT_PREFERENCES, ...(isPlainObject(preferences) ? preferences : {}) };
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalized, null, 2));
  } catch (err) {
    console.warn("Unable to save user preferences:", err);
  }
  applyPreferenceGlobals(normalized);
  window.dispatchEvent(new CustomEvent("nodevision-user-preferences-changed", {
    detail: { preferences: { ...normalized } },
  }));
  return normalized;
}

function applyPreferenceGlobals(preferences) {
  window.NodevisionUserPreferences = { ...preferences };
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.userPreferences = { ...preferences };

  const root = document.documentElement;
  if (root?.dataset) {
    root.dataset.nodevisionTheme = preferences.theme;
    root.dataset.nodevisionDensity = preferences.interfaceDensity;
    root.style.setProperty("--nodevision-user-accent", preferences.accentColor || DEFAULT_PREFERENCES.accentColor);
  }
}

function optionMarkup(options = [], selectedValue = "") {
  return options.map(([value, label]) => {
    const stringValue = String(value);
    const selected = stringValue === String(selectedValue) ? " selected" : "";
    return `<option value="${escapeHtml(stringValue)}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function formatRangeValue(value, suffix = "") {
  const numeric = Number(value);
  const rendered = Number.isFinite(numeric) ? String(Math.round(numeric * 100) / 100) : String(value ?? "");
  return `${rendered}${suffix}`;
}

function renderControl(field, preferences) {
  const value = preferences[field.key];
  const baseAttrs = `data-preference-key="${escapeHtml(field.key)}" data-preference-type="${escapeHtml(field.type)}"`;
  const controlStyle = "width:100%;box-sizing:border-box;border:1px solid #b9b9b9;border-radius:4px;background:#fff;color:#202020;font:inherit;";

  if (field.type === "checkbox") {
    const checked = value === true ? " checked" : "";
    return `
      <label class="nv-user-prefs__check">
        <input ${baseAttrs} type="checkbox"${checked} />
        <span>${escapeHtml(field.label)}</span>
      </label>
    `;
  }

  if (field.type === "select") {
    return `
      <label class="nv-user-prefs__field">
        <span>${escapeHtml(field.label)}</span>
        <select ${baseAttrs} style="${controlStyle}padding:7px 8px;">
          ${optionMarkup(field.options, value)}
        </select>
      </label>
    `;
  }

  if (field.type === "color") {
    return `
      <label class="nv-user-prefs__field nv-user-prefs__color-field">
        <span>${escapeHtml(field.label)}</span>
        <input ${baseAttrs} type="color" value="${escapeHtml(value)}" style="width:44px;height:32px;border:1px solid #aaa;border-radius:4px;background:#fff;padding:2px;" />
      </label>
    `;
  }

  if (field.type === "range") {
    return `
      <label class="nv-user-prefs__field nv-user-prefs__range-field">
        <span>${escapeHtml(field.label)}</span>
        <input ${baseAttrs} type="range" min="${escapeHtml(field.min)}" max="${escapeHtml(field.max)}" step="${escapeHtml(field.step)}" value="${escapeHtml(value)}" />
        <output data-range-output-for="${escapeHtml(field.key)}">${escapeHtml(formatRangeValue(value, field.suffix || ""))}</output>
      </label>
    `;
  }

  return `
    <label class="nv-user-prefs__field">
      <span>${escapeHtml(field.label)}</span>
      <input ${baseAttrs} type="number" min="${escapeHtml(field.min ?? "")}" max="${escapeHtml(field.max ?? "")}" step="${escapeHtml(field.step ?? "1")}" value="${escapeHtml(value)}" style="${controlStyle}padding:7px 8px;" />
      ${field.suffix ? `<small>${escapeHtml(field.suffix)}</small>` : ""}
    </label>
  `;
}

function renderSection(section, preferences) {
  return `
    <section class="nv-user-prefs__section">
      <h4>${escapeHtml(section.title)}</h4>
      <div class="nv-user-prefs__controls">
        ${section.fields.map((field) => renderControl(field, preferences)).join("")}
      </div>
    </section>
  `;
}

function renderPanel(preferences) {
  return `
    <style>
      .nv-user-prefs {
        min-height:100%;
        background:#f5f5f2;
        color:#202124;
        font:14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        display:flex;
        flex-direction:column;
      }
      .nv-user-prefs * { box-sizing:border-box; }
      .nv-user-prefs__topbar {
        position:sticky;
        top:0;
        z-index:2;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:16px;
        padding:14px 18px;
        border-bottom:1px solid #cfcfcf;
        background:#fff;
      }
      .nv-user-prefs__title h3 {
        margin:0;
        font-size:1.15rem;
        line-height:1.25;
        font-weight:650;
      }
      .nv-user-prefs__status {
        min-height:20px;
        margin-top:3px;
        color:#4d5963;
        font-size:0.86rem;
      }
      .nv-user-prefs__actions {
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }
      .nv-user-prefs button {
        border:1px solid #9fa6ad;
        border-radius:4px;
        background:#fff;
        color:#202124;
        padding:7px 10px;
        font:inherit;
        cursor:pointer;
      }
      .nv-user-prefs button[data-primary] {
        border-color:#0b6fcf;
        background:#0b6fcf;
        color:#fff;
      }
      .nv-user-prefs__grid {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
        align-items:stretch;
      }
      .nv-user-prefs__section {
        min-width:0;
        padding:15px 18px 18px;
        border-right:1px solid #d9d9d9;
        border-bottom:1px solid #d9d9d9;
        background:#fff;
      }
      .nv-user-prefs__section:nth-child(3n+2) { background:#f8fbfb; }
      .nv-user-prefs__section:nth-child(3n+3) { background:#fffaf2; }
      .nv-user-prefs__section h4 {
        margin:0 0 12px;
        font-size:0.95rem;
        line-height:1.25;
        font-weight:700;
        color:#24313d;
      }
      .nv-user-prefs__controls {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
        gap:10px 14px;
      }
      .nv-user-prefs__field {
        min-width:0;
        display:grid;
        grid-template-columns:1fr;
        gap:5px;
        color:#333;
        font-size:0.9rem;
      }
      .nv-user-prefs__field > span,
      .nv-user-prefs__check > span {
        overflow-wrap:anywhere;
      }
      .nv-user-prefs__check {
        min-height:34px;
        display:flex;
        align-items:center;
        gap:8px;
        color:#333;
        font-size:0.9rem;
      }
      .nv-user-prefs__check input {
        width:18px;
        height:18px;
        flex:0 0 auto;
      }
      .nv-user-prefs__range-field {
        grid-template-columns:1fr auto;
        align-items:center;
      }
      .nv-user-prefs__range-field span,
      .nv-user-prefs__range-field input {
        grid-column:1 / -1;
      }
      .nv-user-prefs__range-field output {
        min-width:44px;
        text-align:right;
        color:#4d5963;
        font-variant-numeric:tabular-nums;
      }
      .nv-user-prefs__color-field {
        grid-template-columns:1fr auto;
        align-items:center;
      }
      .nv-user-prefs__color-field span { grid-column:auto; }
      .nv-user-prefs__json {
        margin:0;
        padding:14px 18px 18px;
        border-top:1px solid #d0d0d0;
        background:#eef3f7;
      }
      .nv-user-prefs__json textarea {
        width:100%;
        min-height:150px;
        resize:vertical;
        border:1px solid #aeb6bd;
        border-radius:4px;
        padding:8px;
        background:#fff;
        color:#17212b;
        font:12px ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;
      }
      .nv-user-prefs__json-actions {
        display:flex;
        gap:8px;
        margin-top:8px;
        flex-wrap:wrap;
      }
      @media (max-width: 640px) {
        .nv-user-prefs__topbar {
          position:static;
          flex-direction:column;
          align-items:stretch;
        }
        .nv-user-prefs__actions { justify-content:flex-start; }
        .nv-user-prefs__grid { grid-template-columns:1fr; }
        .nv-user-prefs__controls { grid-template-columns:1fr; }
      }
    </style>
    <div class="nv-user-prefs" data-user-preferences-panel>
      <div class="nv-user-prefs__topbar">
        <div class="nv-user-prefs__title">
          <h3>User Preferences</h3>
          <div class="nv-user-prefs__status" data-status>Loaded.</div>
        </div>
        <div class="nv-user-prefs__actions">
          <button type="button" data-export>Export JSON</button>
          <button type="button" data-reset>Reset</button>
        </div>
      </div>
      <form class="nv-user-prefs__grid" data-preferences-form>
        ${SECTIONS.map((section) => renderSection(section, preferences)).join("")}
      </form>
      <section class="nv-user-prefs__json">
        <h4 style="margin:0 0 8px;font-size:0.95rem;line-height:1.25;">Raw JSON</h4>
        <textarea data-json-editor spellcheck="false">${escapeHtml(JSON.stringify(preferences, null, 2))}</textarea>
        <div class="nv-user-prefs__json-actions">
          <button type="button" data-apply-json data-primary>Apply JSON</button>
          <button type="button" data-refresh-json>Refresh JSON</button>
        </div>
      </section>
    </div>
  `;
}

function clampNumber(value, field) {
  const fallback = DEFAULT_PREFERENCES[field.key];
  let numeric = Number(value);
  if (!Number.isFinite(numeric)) numeric = Number(fallback);
  if (Number.isFinite(field.min)) numeric = Math.max(field.min, numeric);
  if (Number.isFinite(field.max)) numeric = Math.min(field.max, numeric);
  return numeric;
}

function readInputValue(input, field) {
  if (field.type === "checkbox") return input.checked === true;
  if (field.type === "number" || field.type === "range") return clampNumber(input.value, field);
  return String(input.value || "");
}

function syncRangeOutput(panelElem, field, value) {
  if (field.type !== "range") return;
  const output = panelElem.querySelector(`[data-range-output-for="${field.key}"]`);
  if (output) output.textContent = formatRangeValue(value, field.suffix || "");
}

function setStatus(statusEl, message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = String(message || "");
  statusEl.style.color = isError ? "#a62a2a" : "#375060";
}

function refreshJsonEditor(panelElem, preferences) {
  const jsonEditor = panelElem.querySelector("[data-json-editor]");
  if (jsonEditor) jsonEditor.value = JSON.stringify(preferences, null, 2);
}

function downloadJson(preferences) {
  const blob = new Blob([JSON.stringify(preferences, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "nodevision-user-preferences.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function setupPanel(panelElem, panelVars = {}) {
  if (!panelElem) return;
  if (typeof panelElem.cleanup === "function") {
    try {
      panelElem.cleanup();
    } catch {}
  }

  window.NodevisionState = window.NodevisionState || {};
  updateToolbarState({ activePanelType: "UserPreferencesPanel" });

  const titleEl = panelElem.querySelector(".panel-title");
  if (titleEl) titleEl.textContent = panelVars.displayName || "User Preferences";

  const state = {
    preferences: readPreferences(),
    statusTimer: null,
  };

  const abortController = new AbortController();
  const listenerOptions = { signal: abortController.signal };

  const render = () => {
    applyPreferenceGlobals(state.preferences);
    panelElem.innerHTML = renderPanel(state.preferences);
  };

  const currentStatusEl = () => panelElem.querySelector("[data-status]");

  const markSaved = (message = "Saved.") => {
    clearTimeout(state.statusTimer);
    setStatus(currentStatusEl(), message);
    state.statusTimer = setTimeout(() => setStatus(currentStatusEl(), "Loaded."), 1600);
  };

  const saveFromInput = (input) => {
    const key = input?.dataset?.preferenceKey;
    const field = FIELD_BY_KEY.get(key);
    if (!field) return;
    const value = readInputValue(input, field);
    state.preferences = writePreferences({ ...state.preferences, [key]: value });
    syncRangeOutput(panelElem, field, value);
    refreshJsonEditor(panelElem, state.preferences);
    markSaved();
  };

  render();

  panelElem.addEventListener("submit", (evt) => {
    evt.preventDefault();
  }, listenerOptions);

  panelElem.addEventListener("change", (evt) => {
    const input = evt.target?.closest?.("[data-preference-key]");
    if (input && panelElem.contains(input)) saveFromInput(input);
  }, listenerOptions);

  panelElem.addEventListener("input", (evt) => {
    const input = evt.target?.closest?.("[data-preference-key]");
    const field = FIELD_BY_KEY.get(input?.dataset?.preferenceKey);
    if (!input || !panelElem.contains(input) || !field || (field.type !== "range" && field.type !== "color")) return;
    saveFromInput(input);
  }, listenerOptions);

  panelElem.addEventListener("click", (evt) => {
    const target = evt.target;
    if (!target || !panelElem.contains(target)) return;

    if (target.closest?.("[data-reset]")) {
      if (!window.confirm("Reset User Preferences to defaults?")) return;
      state.preferences = writePreferences({ ...DEFAULT_PREFERENCES });
      render();
      markSaved("Reset.");
      return;
    }

    if (target.closest?.("[data-export]")) {
      downloadJson(state.preferences);
      markSaved("Exported.");
      return;
    }

    if (target.closest?.("[data-refresh-json]")) {
      refreshJsonEditor(panelElem, state.preferences);
      markSaved("JSON refreshed.");
      return;
    }

    if (target.closest?.("[data-apply-json]")) {
      const jsonEditor = panelElem.querySelector("[data-json-editor]");
      try {
        const parsed = JSON.parse(jsonEditor?.value || "{}");
        if (!isPlainObject(parsed)) throw new Error("Preferences JSON must be an object.");
        state.preferences = writePreferences(parsed);
        render();
        markSaved("JSON applied.");
      } catch (err) {
        setStatus(currentStatusEl(), err.message || "Invalid preferences JSON.", true);
      }
    }
  }, listenerOptions);

  return () => {
    abortController.abort();
    clearTimeout(state.statusTimer);
  };
}
