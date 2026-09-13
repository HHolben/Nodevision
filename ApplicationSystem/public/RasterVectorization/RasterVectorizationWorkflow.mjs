// Nodevision/ApplicationSystem/public/RasterVectorization/RasterVectorizationWorkflow.mjs
// This module handles notebook-path workflow around derived SVG vectorization output. It uses Nodevision create and save APIs, refreshes existing navigation surfaces, and opens generated SVG files through the established GraphicalEditor route.


export function normalizeNotebookPath(value = "") {
  let cleaned = String(value || "").trim().replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/^\/+/, "");
  if (cleaned.toLowerCase().startsWith("notebook/")) cleaned = cleaned.slice("Notebook/".length);
  return cleaned.replace(/\/+$/, "");
}

export function derivedSvgPath(sourcePath = "") {
  const clean = normalizeNotebookPath(sourcePath);
  const dot = clean.lastIndexOf(".");
  return (dot > 0 ? clean.slice(0, dot) : clean || "vectorized-raster") + ".svg";
}

function suffixPath(pathValue, index) {
  const dot = pathValue.lastIndexOf(".");
  return dot > 0 ? pathValue.slice(0, dot) + "-" + index + pathValue.slice(dot) : pathValue + "-" + index;
}

async function createEmptyNotebookFile(pathValue) {
  return fetch("/api/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathValue }),
  });
}

export async function reserveDerivedSvgPath(preferredPath) {
  const clean = normalizeNotebookPath(preferredPath);
  for (let i = 1; i < 200; i += 1) {
    const candidate = i === 1 ? clean : suffixPath(clean, i);
    const response = await createEmptyNotebookFile(candidate);
    if (response.ok) return candidate;
    if (response.status !== 409) throw new Error(await response.text().catch(() => "Could not create SVG file."));
  }
  throw new Error("Could not find an available SVG filename.");
}

export async function saveDerivedSvg({ sourcePath, preferredPath, svg }) {
  const targetPath = await reserveDerivedSvgPath(preferredPath || derivedSvgPath(sourcePath));
  const { notifyFileSaved, saveViaApi } = await import("../ToolbarCallbacks/file/saveFile/utils.mjs");
  await saveViaApi({ path: targetPath, sourcePath: targetPath, content: svg, encoding: "utf8", mimeType: "image/svg+xml" });
  notifyFileSaved(targetPath);
  const dir = targetPath.includes("/") ? targetPath.slice(0, targetPath.lastIndexOf("/")) : "";
  if (typeof window.refreshFileManager === "function") await window.refreshFileManager(dir || window.currentDirectoryPath || "");
  document.dispatchEvent?.(new CustomEvent("refreshFileManager", { detail: { path: dir } }));
  return targetPath;
}

export function openSvgInGraphicalEditor(svgPath) {
  window.selectedFilePath = normalizeNotebookPath(svgPath);
  window.dispatchEvent(new CustomEvent("toolbarAction", {
    detail: { id: "GraphicalEditor", type: "EditorPanel", replaceActive: false, panelVars: { filePath: window.selectedFilePath } },
  }));
}
