// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaCommon.mjs
// Shared helpers for the Insert → Media subtoolbar widget (ModuleMap parsing, saving files, inserting HTML).
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeNotebookPath(path) {
  const raw = String(path || "").trim().replace(/^\/+/, "");
  if (!raw) return "";
  if (raw.toLowerCase().startsWith("notebook/")) return `Notebook/${raw.slice(9)}`.replace(/\/+/g, "/");
  return `Notebook/${raw}`.replace(/\/+/g, "/");
}

export function notebookHrefFromPath(notebookPath) {
  const p = normalizeNotebookPath(notebookPath);
  return p ? `/${p}` : "";
}

export function dirname(notebookPath) {
  const p = normalizeNotebookPath(notebookPath);
  if (!p) return "Notebook";
  const idx = p.lastIndexOf("/");
  if (idx <= "Notebook".length) return "Notebook";
  return p.slice(0, idx);
}

export function joinNotebookPath(dirPath, fileName) {
  const dir = normalizeNotebookPath(dirPath || "Notebook");
  const name = String(fileName || "").trim().replace(/^\/+/, "");
  if (!name) return dir;
  return `${dir}/${name}`.replace(/\/+/g, "/");
}

export function getActiveEditorNotebookPath() {
  const candidates = [
    window.currentActiveFilePath,
    window.selectedFilePath,
    window.filePath,
    window.NodevisionState?.selectedFile,
  ].filter(Boolean);
  for (const c of candidates) {
    const p = normalizeNotebookPath(c);
    if (p) return p;
  }
  return "";
}

export async function saveNotebookText(notebookPath, content, mimeType = "text/plain") {
  const path = normalizeNotebookPath(notebookPath);
  if (!path) throw new Error("Missing notebook path");
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      content: String(content ?? ""),
      encoding: "utf8",
      mimeType,
    }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  }
  return path;
}

export function insertHtmlAtCaret(html) {
  const tools = window.HTMLWysiwygTools;
  if (tools && typeof tools.insertHTMLAtCaret === "function") {
    tools.insertHTMLAtCaret(html);
    return true;
  }
  try {
    return document.execCommand("insertHTML", false, String(html ?? ""));
  } catch {
    return false;
  }
}

export async function loadModuleMapFamilies() {
  const res = await fetch("/PanelInstances/ModuleMap.csv", { cache: "no-store" });
  if (!res.ok) throw new Error(`ModuleMap.csv load failed (${res.status})`);
  const text = await res.text();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const header = (lines.shift() || "").split(",").map((h) => h.trim());
  const idxExt = header.indexOf("Extension");
  const idxFamily = header.indexOf("Family");
  if (idxExt < 0 || idxFamily < 0) throw new Error("ModuleMap.csv missing Extension/Family columns");

  const order = [];
  const seen = new Set();
  const byFamily = new Map();

  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim());
    const ext = (cols[idxExt] || "").toLowerCase();
    const family = cols[idxFamily] || "";
    if (!family) continue;
    if (!seen.has(family)) {
      seen.add(family);
      order.push(family);
    }
    if (!byFamily.has(family)) byFamily.set(family, new Set());
    if (ext) byFamily.get(family).add(ext);
  }

  return { families: order, extensionsByFamily: byFamily };
}
