// Nodevision/ApplicationSystem/public/TemplateSystem/TemplateApi.mjs
// Shared browser-side helpers for the Nodevision template and document creation flows.

export function getCurrentNotebookDirectory() {
  const raw = String(window.currentDirectoryPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  return raw.replace(/^Notebook\/?/i, "").replace(/\/+$/, "");
}

export function basename(pathValue) {
  return String(pathValue || "").split(/[\\/]/).pop() || "";
}

export function defaultFilenameFor(template) {
  if (template?.kind === "form") {
    const ext = template.outputExtension || template.form?.outputExtension || "html";
    const name = String(template.displayName || "Generated Page").split(" / ").pop();
    return `${name}.${ext}`;
  }
  return basename(template?.relativePath || "Untitled.txt");
}

export async function listTemplates() {
  const response = await fetch("/api/templates");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Failed to list templates (${response.status}).`);
  }
  return Array.isArray(data.templates) ? data.templates : [];
}

export async function readTemplate(relativePath) {
  const response = await fetch(`/api/templates/read?path=${encodeURIComponent(relativePath)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Failed to read template (${response.status}).`);
  }
  return data.template;
}

export async function createTemplateFile(payload) {
  const response = await fetch("/api/templates/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Failed to create file (${response.status}).`);
  }
  return data;
}

export async function saveFileAsTemplate(payload) {
  const response = await fetch("/api/templates/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Failed to save template (" + response.status + ").");
  }
  return data;
}

export async function createBlankFile(destinationDirectory, filename) {
  const cleanDirectory = String(destinationDirectory || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const relativePath = cleanDirectory ? `${cleanDirectory}/${filename}` : filename;

  const response = await fetch("/api/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: relativePath }),
  });

  const textOrJson = await response.text();
  const payload = (() => {
    try { return JSON.parse(textOrJson); }
    catch { return textOrJson; }
  })();

  if (!response.ok) {
    throw new Error(`(${response.status}) ${payload?.error || payload}`);
  }

  return {
    path: relativePath,
    payload,
  };
}

export async function refreshNotebookDirectory(directory) {
  if (typeof window.refreshFileManager === "function") {
    await window.refreshFileManager(directory || "");
  } else if (typeof window.fetchDirectoryContents === "function") {
    window.fetchDirectoryContents(directory || "");
  }
  document.dispatchEvent(new CustomEvent("refreshFileManager"));
}
