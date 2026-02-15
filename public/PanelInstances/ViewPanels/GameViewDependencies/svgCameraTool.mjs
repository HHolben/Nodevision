// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/svgCameraTool.mjs
// Exports the current 3D viewport frame as SVG using Three.js SVGRenderer.

import { SVGRenderer } from "/lib/three/renderers/SVGRenderer.js";

function safeBaseNameFromWorldPath(worldPath) {
  const fallback = "world-view";
  if (typeof worldPath !== "string" || !worldPath.trim()) return fallback;
  const normalized = worldPath.replace(/\\/g, "/");
  const last = normalized.split("/").pop() || fallback;
  const dot = last.lastIndexOf(".");
  const stem = dot > 0 ? last.slice(0, dot) : last;
  return stem.replace(/[^a-z0-9._-]+/gi, "_") || fallback;
}

function buildSuggestedFileName(worldPath) {
  const base = safeBaseNameFromWorldPath(worldPath);
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
    "-",
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0")
  ].join("");
  return `${base}-frame-${stamp}.svg`;
}

function serializeSvgDocument(svgElement) {
  const serializer = new XMLSerializer();
  let serialized = serializer.serializeToString(svgElement);
  if (!serialized.startsWith("<?xml")) {
    serialized = `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
  }
  return serialized;
}

async function saveSvgString(svgText, suggestedName) {
  // Chromium/Edge secure contexts support a native save dialog.
  if (typeof window.showSaveFilePicker === "function") {
    const pickerOptions = {
      suggestedName,
      types: [
        {
          description: "SVG Image",
          accept: { "image/svg+xml": [".svg"] }
        }
      ]
    };

    const previousHandle = window.__nodevisionSvgLastFileHandle;
    if (previousHandle) pickerOptions.startIn = previousHandle;

    const fileHandle = await window.showSaveFilePicker(pickerOptions);
    const writable = await fileHandle.createWritable();
    await writable.write(svgText);
    await writable.close();
    window.__nodevisionSvgLastFileHandle = fileHandle;
    return { ok: true, method: "file-system-access" };
  }

  // Fallback: browser download flow.
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { ok: true, method: "download" };
}

export async function triggerSvgCameraCapture({ scene, camera, sourceRenderer, worldPath = "" }) {
  if (!scene || !camera) {
    throw new Error("SVG Camera requires a scene and camera.");
  }

  const sourceCanvas = sourceRenderer?.domElement || null;
  const width = Math.max(1, Math.floor(sourceCanvas?.clientWidth || sourceCanvas?.width || 1280));
  const height = Math.max(1, Math.floor(sourceCanvas?.clientHeight || sourceCanvas?.height || 720));

  const svgRenderer = new SVGRenderer();
  svgRenderer.setSize(width, height);
  svgRenderer.setClearColor(0x000000, 0);
  svgRenderer.render(scene, camera);

  const svgText = serializeSvgDocument(svgRenderer.domElement);
  const suggestedName = buildSuggestedFileName(worldPath);
  return saveSvgString(svgText, suggestedName);
}
