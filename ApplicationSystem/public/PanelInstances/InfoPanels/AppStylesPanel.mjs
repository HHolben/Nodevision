// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/AppStylesPanel.mjs
// This file defines browser-side App Styles panel logic for selecting and applying UserSettings stylesheet presets.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { getNodevisionNavigationState } from "/NodevisionNavigationState.mjs";

const navigationState = getNodevisionNavigationState();

const TEMPLATE = `
  <div style="display:flex;flex-direction:column;gap:12px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div>
        <h3 style="margin:0;font-size:1.1em;">App Styles</h3>
        <p style="margin:4px 0 0;color:#666;font-size:0.9em;">
          Choose a stylesheet preset for the application UI. Applying a preset updates <code>UserStyles.css</code>.
        </p>
      </div>
      <button type="button" data-refresh style="border:1px solid #bbb;border-radius:6px;background:#fff;padding:6px 10px;font-size:0.85em;cursor:pointer;">
        Refresh
      </button>
    </div>

    <div data-status style="min-height:20px;font-size:0.9em;color:#444;"></div>

    <section style="border:1px solid #ddd;border-radius:8px;padding:10px;background:#fafafa;">
      <label style="display:flex;flex-direction:column;gap:6px;font-size:0.92em;">
        Style preset
        <select data-style-select style="padding:8px;border:1px solid #bbb;border-radius:6px;font-size:0.92em;background:#fff;"></select>
      </label>
      <div data-style-meta style="margin-top:8px;font-size:0.82em;color:#666;"></div>
    </section>

    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button type="button" data-apply style="border:none;border-radius:6px;background:#0a84ff;color:#fff;padding:8px 12px;font-size:0.9em;cursor:pointer;">
        Apply Selected Style
      </button>
      <button type="button" data-reset-default style="border:1px solid #999;border-radius:6px;background:#fff;padding:8px 12px;font-size:0.9em;cursor:pointer;">
        Reset to Default
      </button>
    </div>
  </div>
`;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setStatus(statusEl, message, { error = false } = {}) {
  if (!statusEl) return;
  statusEl.textContent = String(message || "");
  statusEl.style.color = error ? "#b02323" : "#245b10";
}

function refreshUserStylesheetLink() {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  const existing = links.find((link) =>
    /\/?UserSettings\/UserStyles\.css/i.test(link.getAttribute("href") || "")
  );
  const href = `/UserSettings/UserStyles.css?t=${Date.now()}`;

  if (existing) {
    existing.setAttribute("href", href);
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function normalizeStylesResponse(payload) {
  const rawStyles = Array.isArray(payload?.styles) ? payload.styles : [];
  return rawStyles
    .map((entry) => ({
      fileName: String(entry?.fileName || "").trim(),
      label: String(entry?.label || entry?.fileName || "").trim(),
      kind: String(entry?.kind || "preset").trim(),
    }))
    .filter((entry) => entry.fileName);
}

async function fetchStyles() {
  const res = await fetch("/api/app-styles", {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `Failed to load styles (${res.status})`);
  }
  return payload;
}

async function applyStylePreset(sourceFileName) {
  const res = await fetch("/api/app-styles/apply", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ sourceFileName }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `Failed to apply style (${res.status})`);
  }
  return payload;
}

export async function setupPanel(panelElem, panelVars = {}) {
  if (!panelElem) return;
  if (typeof panelElem.cleanup === "function") {
    try {
      panelElem.cleanup();
    } catch {}
  }

  updateToolbarState({ activePanelType: "AppStylesPanel" });
  navigationState.setLastInfoPanelType("AppStylesPanel");

  panelElem.innerHTML = TEMPLATE;
  const titleEl = panelElem.querySelector(".panel-title");
  if (titleEl) {
    const requestedTitle = String(panelVars.displayName || "").trim();
    titleEl.textContent = requestedTitle && requestedTitle !== "AppStylesPanel"
      ? requestedTitle
      : "App Styles";
  }

  const statusEl = panelElem.querySelector("[data-status]");
  const selectEl = panelElem.querySelector("[data-style-select]");
  const metaEl = panelElem.querySelector("[data-style-meta]");
  const applyBtn = panelElem.querySelector("[data-apply]");
  const resetBtn = panelElem.querySelector("[data-reset-default]");
  const refreshBtn = panelElem.querySelector("[data-refresh]");

  const state = {
    disposed: false,
    styles: [],
    activeFileName: "UserStyles.css",
  };

  const renderSelect = () => {
    if (!selectEl) return;
    const options = state.styles;
    if (!options.length) {
      selectEl.innerHTML = `<option value="">No styles available</option>`;
      selectEl.disabled = true;
      if (metaEl) metaEl.textContent = "";
      return;
    }

    selectEl.disabled = false;
    selectEl.innerHTML = options.map((item) => {
      const suffix = item.kind === "default"
        ? " (default)"
        : (item.kind === "active" ? " (active file)" : "");
      return `<option value="${escapeHtml(item.fileName)}">${
        escapeHtml(item.label || item.fileName)
      }${escapeHtml(suffix)}</option>`;
    }).join("");
    selectEl.value =
      options.some((item) => item.fileName === state.activeFileName)
        ? state.activeFileName
        : options[0].fileName;
    const selected = options.find((item) => item.fileName === selectEl.value);
    if (metaEl) {
      metaEl.innerHTML = selected
        ? `Selected file: <code>${escapeHtml(selected.fileName)}</code>`
        : "";
    }
  };

  const setBusy = (busy) => {
    if (applyBtn) applyBtn.disabled = busy;
    if (resetBtn) resetBtn.disabled = busy;
    if (refreshBtn) refreshBtn.disabled = busy;
    if (selectEl) selectEl.disabled = busy || !state.styles.length;
  };

  const load = async () => {
    setBusy(true);
    setStatus(statusEl, "Loading style presets...");
    try {
      const payload = await fetchStyles();
      if (state.disposed) return;
      state.styles = normalizeStylesResponse(payload);
      state.activeFileName = String(
        payload?.activeFileName || "UserStyles.css",
      );
      renderSelect();
      setStatus(
        statusEl,
        `Loaded ${state.styles.length} style preset${
          state.styles.length === 1 ? "" : "s"
        }.`,
      );
    } catch (err) {
      console.error("App styles load failed:", err);
      if (!state.disposed) {
        setStatus(statusEl, err.message || "Failed to load style presets.", {
          error: true,
        });
      }
    } finally {
      if (!state.disposed) setBusy(false);
    }
  };

  selectEl?.addEventListener("change", () => {
    const selected = state.styles.find((item) =>
      item.fileName === selectEl.value
    );
    if (metaEl) {
      metaEl.innerHTML = selected
        ? `Selected file: <code>${escapeHtml(selected.fileName)}</code>`
        : "";
    }
  });

  applyBtn?.addEventListener("click", async () => {
    const sourceFileName = String(selectEl?.value || "").trim();
    if (!sourceFileName) {
      setStatus(statusEl, "Choose a style preset first.", { error: true });
      return;
    }

    setBusy(true);
    setStatus(statusEl, `Applying ${sourceFileName}...`);
    try {
      await applyStylePreset(sourceFileName);
      if (state.disposed) return;
      refreshUserStylesheetLink();
      setStatus(statusEl, `Applied ${sourceFileName} to UserStyles.css.`);
      await load();
    } catch (err) {
      console.error("Apply app style failed:", err);
      if (!state.disposed) {
        setStatus(statusEl, err.message || "Failed to apply selected style.", {
          error: true,
        });
      }
    } finally {
      if (!state.disposed) setBusy(false);
    }
  });

  resetBtn?.addEventListener("click", async () => {
    setBusy(true);
    setStatus(statusEl, "Resetting to default style...");
    try {
      await applyStylePreset("DefaultUserStyles.css");
      if (state.disposed) return;
      refreshUserStylesheetLink();
      setStatus(statusEl, "Default style applied.");
      await load();
    } catch (err) {
      console.error("Reset app style failed:", err);
      if (!state.disposed) {
        setStatus(
          statusEl,
          err.message || "Failed to reset to default style.",
          { error: true },
        );
      }
    } finally {
      if (!state.disposed) setBusy(false);
    }
  });

  refreshBtn?.addEventListener("click", () => {
    load();
  });

  panelElem.cleanup = () => {
    state.disposed = true;
  };

  await load();
}
