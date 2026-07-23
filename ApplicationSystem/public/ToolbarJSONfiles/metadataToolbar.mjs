const FIELD_DEFS = [
  { key: "title", label: "Title", type: "text", placeholder: "Document title" },
  { key: "description", label: "Description", type: "text", placeholder: "Short description" },
  { key: "author", label: "Author", type: "text", placeholder: "Author" },
  { key: "tags", label: "Tags", type: "text", placeholder: "tag, tag" },
];

function ensureMetadataStyles() {
  if (document.getElementById("nv-metadata-toolbar-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-metadata-toolbar-styles";
  style.textContent = `
    #sub-toolbar .nv-subtoolbar-widget.nv-metadata-toolbar-host {
      height: auto;
      min-height: 30px;
      align-items: center;
      padding: 4px 6px;
    }
    #sub-toolbar .nv-metadata-toolbar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
    }
    #sub-toolbar .nv-metadata-toolbar strong,
    #sub-toolbar .nv-metadata-toolbar label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      font-weight: 600;
    }
    #sub-toolbar .nv-metadata-toolbar input {
      height: 24px;
      width: 150px;
      box-sizing: border-box;
      border: 1px solid #888;
      border-radius: 4px;
      padding: 2px 6px;
      background: #fff;
      color: #111827;
      font: inherit;
      font-size: 12px;
    }
    #sub-toolbar .nv-metadata-toolbar input[name="description"] {
      width: min(260px, 28vw);
      min-width: 170px;
    }
    #sub-toolbar .nv-metadata-status,
    #sub-toolbar .nv-metadata-format {
      color: #4b5563;
      font-weight: 500;
      min-width: 92px;
    }
    html[data-nv-theme="dark"] #sub-toolbar .nv-metadata-toolbar input {
      background: #111827;
      color: #e5e7eb;
      border-color: #475569;
    }
    html[data-nv-theme="dark"] #sub-toolbar .nv-metadata-status,
    html[data-nv-theme="dark"] #sub-toolbar .nv-metadata-format {
      color: #cbd5e1;
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }
  return String(value ?? "")
    .split(/[;,]/)
    .map(normalizeText)
    .filter(Boolean);
}

function tagsToInput(value) {
  return normalizeTags(value).join(", ");
}

function metadataProvider() {
  const provider = window.NodevisionMetadataTools;
  if (!provider || typeof provider !== "object") return null;
  if (typeof provider.readMetadata !== "function" && typeof provider.read !== "function") return null;
  if (typeof provider.applyMetadata !== "function" && typeof provider.write !== "function") return null;
  return provider;
}

async function readFromProvider(provider) {
  const reader = provider.readMetadata || provider.read;
  const metadata = await Promise.resolve(reader.call(provider));
  return metadata && typeof metadata === "object" ? metadata : {};
}

async function applyToProvider(provider, patch) {
  const writer = provider.applyMetadata || provider.write;
  const metadata = await Promise.resolve(writer.call(provider, patch));
  return metadata && typeof metadata === "object" ? metadata : patch;
}

function renderFields() {
  return FIELD_DEFS.map((field) => `
    <label data-field-wrap="${escapeHtml(field.key)}">
      ${escapeHtml(field.label)}
      <input name="${escapeHtml(field.key)}" type="${escapeHtml(field.type)}" placeholder="${escapeHtml(field.placeholder)}">
    </label>
  `).join("");
}

function setStatus(status, message) {
  if (status) status.textContent = String(message || "");
}

function setFormEnabled(form, enabled) {
  form.querySelectorAll("input, button").forEach((el) => {
    el.disabled = !enabled;
  });
}

function fillForm(form, metadata, provider) {
  const supported = new Set(metadata.fields || provider.fields || FIELD_DEFS.map((field) => field.key));
  FIELD_DEFS.forEach((field) => {
    const input = form.elements[field.key];
    const wrapper = form.querySelector(`[data-field-wrap="${field.key}"]`);
    if (!input) return;
    const isSupported = supported.has(field.key);
    input.disabled = !isSupported;
    if (wrapper) wrapper.hidden = !isSupported;
    input.value = field.key === "tags" ? tagsToInput(metadata[field.key]) : String(metadata[field.key] ?? "");
  });
}

function collectPatch(form) {
  return {
    title: normalizeText(form.elements.title?.value),
    description: normalizeText(form.elements.description?.value),
    author: normalizeText(form.elements.author?.value),
    tags: normalizeTags(form.elements.tags?.value),
  };
}

export async function initToolbarWidget(mount) {
  if (!mount) return;
  ensureMetadataStyles();
  mount.classList.add("nv-metadata-toolbar-host");
  mount.innerHTML = `
    <form class="nv-metadata-toolbar" autocomplete="off">
      <strong>Metadata</strong>
      <span class="nv-metadata-format" data-metadata-format></span>
      ${renderFields()}
      <button type="submit">Apply</button>
      <button type="button" data-action="reload">Reload</button>
      <span class="nv-metadata-status" role="status" aria-live="polite"></span>
    </form>
  `;

  const form = mount.querySelector("form");
  const status = mount.querySelector(".nv-metadata-status");
  const format = mount.querySelector("[data-metadata-format]");

  async function load() {
    const provider = metadataProvider();
    if (!provider) {
      setFormEnabled(form, false);
      setStatus(status, "Metadata is not available here.");
      if (format) format.textContent = "";
      return null;
    }
    setFormEnabled(form, true);
    const metadata = await readFromProvider(provider);
    fillForm(form, metadata, provider);
    if (format) format.textContent = metadata.formatLabel || provider.formatLabel || "Document";
    setStatus(status, "Ready.");
    return provider;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const provider = metadataProvider();
    if (!provider) {
      setStatus(status, "Metadata is not available here.");
      return;
    }
    try {
      setStatus(status, "Applying...");
      const metadata = await applyToProvider(provider, collectPatch(form));
      fillForm(form, metadata, provider);
      if (format) format.textContent = metadata.formatLabel || provider.formatLabel || "Document";
      setStatus(status, "Metadata updated.");
    } catch (err) {
      setStatus(status, `Failed: ${err?.message || err}`);
    }
  });

  form.querySelector('[data-action="reload"]')?.addEventListener("click", () => {
    load().catch((err) => setStatus(status, `Failed: ${err?.message || err}`));
  });

  load().catch((err) => setStatus(status, `Failed: ${err?.message || err}`));
}
