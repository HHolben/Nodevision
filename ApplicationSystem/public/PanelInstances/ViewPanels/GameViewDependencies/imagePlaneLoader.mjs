// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/imagePlaneLoader.mjs
// Loads PNG/SVG notebook assets as textures for "image-plane" meshes.

const NOTEBOOK_PREFIX = "/Notebook/";
const NOTEBOOK_TOKEN = "Notebook/";

function normalizeNotebookPath(rawPath) {
  const candidate = String(rawPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  const markerIndex = candidate.indexOf(NOTEBOOK_TOKEN);
  const stripped = markerIndex !== -1
    ? candidate.slice(markerIndex + NOTEBOOK_TOKEN.length)
    : (candidate.startsWith("./") ? candidate.slice(2) : candidate);

  if (!stripped) return "";
  const parts = stripped.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) return "";
  return parts.join("/");
}

export function resolveNotebookUrl(rawPath) {
  const normalized = normalizeNotebookPath(rawPath);
  if (!normalized) return "";
  const segments = normalized.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment));
  return segments.length === 0 ? NOTEBOOK_PREFIX.slice(0, -1) : `${NOTEBOOK_PREFIX}${segments.join("/")}`;
}

function loadViaTextureLoader(THREE, url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(url, resolve, undefined, reject);
  });
}

function parseSvgSize(svgText) {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = doc.documentElement;
    const widthAttr = svg?.getAttribute?.("width") || "";
    const heightAttr = svg?.getAttribute?.("height") || "";
    const viewBoxAttr = svg?.getAttribute?.("viewBox") || "";

    const toPx = (value) => {
      const trimmed = String(value || "").trim();
      if (!trimmed) return null;
      if (/%$/.test(trimmed)) return null;
      const num = Number.parseFloat(trimmed);
      return Number.isFinite(num) && num > 0 ? num : null;
    };

    const w = toPx(widthAttr);
    const h = toPx(heightAttr);
    if (w && h) return { width: w, height: h };

    if (viewBoxAttr) {
      const parts = viewBoxAttr.split(/[\s,]+/).map((p) => Number.parseFloat(p)).filter((n) => Number.isFinite(n));
      if (parts.length >= 4) {
        const vw = parts[2];
        const vh = parts[3];
        if (vw > 0 && vh > 0) return { width: vw, height: vh };
      }
    }
  } catch (_) {
    // ignore parse errors
  }
  return { width: 512, height: 512 };
}

async function loadSvgAsCanvasTexture(THREE, url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch SVG (${res.status})`);
  const svgText = await res.text();
  const { width, height } = parseSvgSize(svgText);
  const aspect = width > 0 && height > 0 ? (width / height) : 1;

  const maxDim = 1024;
  let canvasW = maxDim;
  let canvasH = maxDim;
  if (aspect >= 1) canvasH = Math.max(1, Math.round(maxDim / aspect));
  else canvasW = Math.max(1, Math.round(maxDim * aspect));

  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("SVG image decode failed."));
    el.src = svgDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.drawImage(img, 0, 0, canvasW, canvasH);

  const texture = new THREE.CanvasTexture(canvas);
  if ("colorSpace" in texture && THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.needsUpdate = true;
  return texture;
}

async function loadNotebookTexture(THREE, rawPath) {
  const url = resolveNotebookUrl(rawPath);
  if (!url) throw new Error("Invalid notebook image path.");

  const ext = String(rawPath || "").split(".").pop()?.toLowerCase() || "";
  try {
    const texture = await loadViaTextureLoader(THREE, url);
    if ("colorSpace" in texture && THREE.SRGBColorSpace) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    return texture;
  } catch (err) {
    if (ext === "svg") {
      return loadSvgAsCanvasTexture(THREE, url);
    }
    throw err;
  }
}

export async function applyImagePlaneTexture(mesh, THREE) {
  const rawPath = mesh?.userData?.imageFilePath;
  if (!mesh?.isMesh || !rawPath || !THREE) return null;
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!mat) return null;

  const requestId = (mesh.userData.imageTextureRequestId || 0) + 1;
  mesh.userData.imageTextureRequestId = requestId;

  let texture;
  try {
    texture = await loadNotebookTexture(THREE, rawPath);
  } catch (err) {
    if (mesh.userData.imageTextureRequestId === requestId) {
      console.warn("[image-plane] texture load failed:", err);
    }
    return null;
  }

  if (mesh.userData.imageTextureRequestId !== requestId) {
    texture.dispose?.();
    return null;
  }

  if (mat.map && mat.map !== texture) {
    mat.map.dispose?.();
  }
  mat.map = texture;
  mat.transparent = true;
  mat.needsUpdate = true;
  return texture;
}
