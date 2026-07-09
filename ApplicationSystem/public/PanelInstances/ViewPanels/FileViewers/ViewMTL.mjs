// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewMTL.mjs
// Structured viewer for Wavefront MTL material library files.

import {
  MTL_KEY_LABELS,
  colorToHex,
  escapeHTML,
  formatNumber,
  getColor,
  getNumber,
  getTextValue,
  materialOpacity,
  materialPreviewColor,
  materialTextureEntries,
  materialUnknownEntries,
  parseMtl,
  summarizeMtl,
  textureFileName,
} from "./MTL/mtlFormat.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  viewPanel.innerHTML = "";
  const shell = document.createElement("section");
  shell.className = "nv-mtl-viewer";
  shell.innerHTML = viewerCss();
  viewPanel.appendChild(shell);

  try {
    const response = await fetch(`${serverBase}/${filename}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const text = await response.text();
    const documentModel = parseMtl(text);
    renderMtlDocument(shell, filename, documentModel, text);
    return true;
  } catch (err) {
    shell.appendChild(errorBox(`Failed to load MTL: ${err.message || err}`));
    return false;
  }
}

function renderMtlDocument(shell, filename, documentModel, rawText) {
  const summary = summarizeMtl(documentModel);
  const header = document.createElement("header");
  header.className = "nv-mtl-header";
  header.innerHTML = `
    <div class="nv-mtl-title">
      <h2>${escapeHTML(baseName(filename))}</h2>
      <p>${summary.materialCount} material${summary.materialCount === 1 ? "" : "s"} · ${summary.textureCount} texture map${summary.textureCount === 1 ? "" : "s"}</p>
    </div>
  `;

  const body = document.createElement("div");
  body.className = "nv-mtl-body";

  const list = document.createElement("div");
  list.className = "nv-mtl-grid";
  if (!documentModel.materials.length) {
    list.appendChild(errorBox("No materials found."));
  } else {
    documentModel.materials.forEach((material) => list.appendChild(materialCard(material)));
  }

  const rawDetails = document.createElement("details");
  rawDetails.className = "nv-mtl-raw";
  rawDetails.innerHTML = `<summary>Raw MTL</summary><pre></pre>`;
  rawDetails.querySelector("pre").textContent = rawText;

  body.append(list, rawDetails);
  shell.append(header, body);
}

function materialCard(material) {
  const card = document.createElement("article");
  card.className = "nv-mtl-card";

  const diffuse = materialPreviewColor(material);
  const ambient = getColor(material, "Ka", [0.2, 0.2, 0.2]);
  const specular = getColor(material, "Ks", [0, 0, 0]);
  const emission = getColor(material, "Ke", [0, 0, 0]);
  const opacity = materialOpacity(material);
  const textures = materialTextureEntries(material);
  const unknown = materialUnknownEntries(material);

  const swatch = document.createElement("div");
  swatch.className = "nv-mtl-swatch";
  swatch.style.background = colorToHex(diffuse);
  swatch.style.opacity = String(Math.max(0.16, opacity));

  const title = document.createElement("div");
  title.className = "nv-mtl-material-title";
  title.appendChild(swatch);
  const name = document.createElement("h3");
  name.textContent = material.name || "Unnamed material";
  title.appendChild(name);

  const rows = document.createElement("dl");
  rows.className = "nv-mtl-props";
  rows.append(
    propRow("Diffuse", colorLabel(diffuse)),
    propRow("Ambient", colorLabel(ambient)),
    propRow("Specular", colorLabel(specular)),
    propRow("Emission", colorLabel(emission)),
    propRow("Opacity", formatNumber(opacity, 3)),
    propRow("Shininess", formatNumber(getNumber(material, "Ns", 0), 2)),
    propRow("Illumination", String(getNumber(material, "illum", 0))),
  );

  const maps = document.createElement("div");
  maps.className = "nv-mtl-maps";
  if (textures.length) {
    textures.forEach((entry) => {
      const chip = document.createElement("span");
      chip.className = "nv-mtl-chip";
      const label = MTL_KEY_LABELS[entry.lower] || entry.keyword;
      const file = textureFileName(entry.value) || entry.value;
      chip.textContent = `${label}: ${file}`;
      maps.appendChild(chip);
    });
  } else {
    const chip = document.createElement("span");
    chip.className = "nv-mtl-chip nv-mtl-muted";
    chip.textContent = "No texture maps";
    maps.appendChild(chip);
  }

  if (unknown.length) {
    const chip = document.createElement("span");
    chip.className = "nv-mtl-chip nv-mtl-warning";
    chip.textContent = `${unknown.length} custom directive${unknown.length === 1 ? "" : "s"}`;
    maps.appendChild(chip);
  }

  card.append(title, rows, maps);
  return card;
}

function propRow(label, value) {
  const fragment = document.createDocumentFragment();
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  fragment.append(dt, dd);
  return fragment;
}

function colorLabel(rgb) {
  return `${formatNumber(rgb[0], 3)} ${formatNumber(rgb[1], 3)} ${formatNumber(rgb[2], 3)} (${colorToHex(rgb)})`;
}

function errorBox(message) {
  const box = document.createElement("div");
  box.className = "nv-mtl-error";
  box.textContent = message;
  return box;
}

function baseName(path = "") {
  return String(path || "").replace(/\\/g, "/").split("/").pop() || "material.mtl";
}

function viewerCss() {
  return `
    <style>
      .nv-mtl-viewer,
      .nv-mtl-viewer * { box-sizing: border-box; }
      .nv-mtl-viewer {
        width: 100%;
        height: 100%;
        min-height: 420px;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        background: #f5f7f8;
        color: #172026;
        font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .nv-mtl-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        border-bottom: 1px solid #ced7de;
        background: #ffffff;
      }
      .nv-mtl-title h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        overflow-wrap: anywhere;
      }
      .nv-mtl-title p {
        margin: 3px 0 0;
        color: #5d6872;
        font-size: 12px;
      }
      .nv-mtl-body {
        min-height: 0;
        display: grid;
        grid-template-rows: minmax(0, 1fr) auto;
        overflow: hidden;
      }
      .nv-mtl-grid {
        min-height: 0;
        overflow: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 10px;
        padding: 12px;
        align-content: start;
      }
      .nv-mtl-card {
        min-width: 0;
        border: 1px solid #cbd5dc;
        border-radius: 8px;
        background: #ffffff;
        padding: 10px;
      }
      .nv-mtl-material-title {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .nv-mtl-swatch {
        width: 42px;
        height: 42px;
        border: 1px solid #9aa7b0;
        border-radius: 7px;
        background-image: linear-gradient(45deg, #e0e4e8 25%, transparent 25%), linear-gradient(-45deg, #e0e4e8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e4e8 75%), linear-gradient(-45deg, transparent 75%, #e0e4e8 75%);
        background-size: 12px 12px;
        background-position: 0 0, 0 6px, 6px -6px, -6px 0;
      }
      .nv-mtl-material-title h3 {
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
        font-size: 14px;
      }
      .nv-mtl-props {
        display: grid;
        grid-template-columns: 104px minmax(0, 1fr);
        gap: 5px 8px;
        margin: 0;
      }
      .nv-mtl-props dt {
        color: #65727c;
        font-weight: 650;
      }
      .nv-mtl-props dd {
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .nv-mtl-maps {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }
      .nv-mtl-chip {
        max-width: 100%;
        border: 1px solid #c6d0d8;
        border-radius: 999px;
        padding: 3px 8px;
        background: #eef4f6;
        color: #20323c;
        overflow-wrap: anywhere;
        font-size: 12px;
      }
      .nv-mtl-muted { color: #66727b; background: #f3f5f6; }
      .nv-mtl-warning { color: #6f4b00; background: #fff7df; border-color: #e6cf88; }
      .nv-mtl-raw {
        border-top: 1px solid #ced7de;
        background: #ffffff;
      }
      .nv-mtl-raw summary {
        cursor: pointer;
        padding: 9px 12px;
        font-weight: 650;
      }
      .nv-mtl-raw pre {
        max-height: 220px;
        margin: 0;
        overflow: auto;
        padding: 12px;
        border-top: 1px solid #e0e5e9;
        background: #12171c;
        color: #edf3f7;
        white-space: pre-wrap;
        font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .nv-mtl-error {
        color: #8c1d18;
        padding: 12px;
      }
      @media (max-width: 760px) {
        .nv-mtl-grid { grid-template-columns: minmax(0, 1fr); }
      }
    </style>
  `;
}
