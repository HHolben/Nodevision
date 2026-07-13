// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewTerrainRegion.mjs
// Viewer for exported Nodevision terrain-region manifests.

import { ensureLeafletLoaded } from "./KML/KMLFlatMapRenderer.mjs";
import { formatArea, formatBounds } from "./KML/ClosedRegionSelection.mjs";

function normalizeNotebookPath(path = "") {
  return String(path || "").trim().replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/^\/+/, "").replace(/^Notebook\//i, "");
}

function notebookUrl(path = "") {
  return "/Notebook/" + normalizeNotebookPath(path).split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

function directory(path = "") {
  const clean = normalizeNotebookPath(path);
  const slash = clean.lastIndexOf("/");
  return slash >= 0 ? clean.slice(0, slash) : "";
}

function joinRelative(base, rel) {
  const raw = String(rel || "").replace(/\\/g, "/");
  if (!raw || raw.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.split("/").includes("..")) return "";
  return [base, raw].filter(Boolean).join("/");
}

export async function renderFile(filename, viewPanel) {
  viewPanel.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:grid;grid-template-rows:auto 1fr;height:100%;min-height:320px;background:#f8fafc;color:#1f2937;font:13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;";
  const header = document.createElement("div");
  header.style.cssText = "padding:10px;border-bottom:1px solid #c8d0da;display:grid;gap:4px;";
  const mapNode = document.createElement("div");
  mapNode.style.cssText = "min-height:320px;";
  wrapper.append(header, mapNode);
  viewPanel.appendChild(wrapper);

  const manifestPath = normalizeNotebookPath(filename);
  const response = await fetch(notebookUrl(manifestPath), { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const manifest = await response.json();
  if (manifest?.format !== "nodevision-terrain-region") throw new Error("This is not a Nodevision terrain-region manifest.");

  header.innerHTML = "";
  const title = document.createElement("strong");
  title.textContent = manifest.name || "Terrain Region";
  const details = document.createElement("div");
  details.textContent = `${formatArea(manifest.region?.areaSquareMeters)} | ${formatBounds(manifest.region?.bounds)} | Offline: ${manifest.offline?.complete ? "complete" : "incomplete"}`;
  const warning = document.createElement("div");
  warning.textContent = manifest.aviation?.containsExpiredMaterial ? "Aviation material may be expired. Not for navigation." : "Terrain packages are planning/reference products, not certified navigation data.";
  warning.style.color = manifest.aviation?.containsExpiredMaterial ? "#92400e" : "#52606d";
  header.append(title, details, warning);

  const L = await ensureLeafletLoaded({ requireDraw: false });
  const map = L.map(mapNode, { zoomControl: true, preferCanvas: true }).setView([0, 0], 2);
  const geometry = manifest.region?.geometry;
  if (geometry?.type === "Polygon" && Array.isArray(geometry.coordinates?.[0])) {
    const rings = geometry.coordinates.map((ring) => ring.map((pt) => [pt[1], pt[0]]));
    const layer = L.polygon(rings, { color: "#f59e0b", weight: 3, fillColor: "#fef3c7", fillOpacity: 0.34 }).addTo(map);
    map.fitBounds(layer.getBounds().pad(0.2));
  }

  const baseDir = directory(manifestPath);
  const contourFile = manifest.contours?.file || "contours/contours.geojson";
  const contourPath = joinRelative(baseDir, contourFile);
  if (contourPath) {
    try {
      const contourResponse = await fetch(notebookUrl(contourPath), { cache: "no-store" });
      if (contourResponse.ok) {
        const contours = await contourResponse.json();
        L.geoJSON(contours, {
          style(feature) {
            return feature?.properties?.contourRole === "index"
              ? { color: "#493829", weight: 1.4, opacity: 0.85 }
              : { color: "#705a43", weight: 0.7, opacity: 0.65 };
          },
        }).addTo(map);
      }
    } catch {
      // Offline packages may omit contours when export was incomplete.
    }
  }
}

export async function setupPanel(panel, instanceVars = {}) {
  const filePath = window.selectedFilePath || instanceVars.filePath || "";
  await renderFile(filePath, panel);
}
