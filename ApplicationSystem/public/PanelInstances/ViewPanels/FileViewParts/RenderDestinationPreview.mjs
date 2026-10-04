// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/RenderDestinationPreview.mjs
// This module implements render Destination Preview behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizeResolvedNotebookPath } from "./RetainFileViewSelectionFollower.mjs";
import { pathExtension, notebookAssetUrl, LINK_IMAGE_PREVIEW_EXTS, LINK_AUDIO_PREVIEW_EXTS, LINK_VIDEO_PREVIEW_EXTS, LINK_TEXT_PREVIEW_EXTS } from "./SelectLinkedPathInFileView.mjs";
import { toPhpDeploymentUrl } from "/utils/notebookPath.mjs";
import { fetchNotebookText } from "/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.mjs";

// Render Destination Preview operations.
export async function renderDestinationPreview(body, record) {
  const targetPath = normalizeResolvedNotebookPath(record?.targetPath || record?.targetRaw || "");
  if (record?.targetKind === "external") {
    body.innerHTML = "";
    const link = document.createElement("a");
    link.href = record.targetRaw || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = record.targetRaw || "External link";
    body.appendChild(link);
    return;
  }
  if (!targetPath) {
    body.textContent = "No destination file recorded.";
    return;
  }
  const ext = pathExtension(targetPath);
  const url = ext === "php" ? toPhpDeploymentUrl(targetPath) : notebookAssetUrl(targetPath);
  body.innerHTML = "";
  if (LINK_IMAGE_PREVIEW_EXTS.has(ext) && ext !== "svg") {
    const img = document.createElement("img");
    img.className = "nv-link-file-media";
    img.src = url;
    img.alt = targetPath;
    body.appendChild(img);
    return;
  }
  if (LINK_AUDIO_PREVIEW_EXTS.has(ext)) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = url;
    body.appendChild(audio);
    return;
  }
  if (LINK_VIDEO_PREVIEW_EXTS.has(ext)) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = url;
    video.className = "nv-link-file-media";
    body.appendChild(video);
    return;
  }
  if (["html", "htm", "xhtml", "php", "pdf", "svg"].includes(ext)) {
    const iframe = document.createElement("iframe");
    iframe.className = "nv-link-file-frame";
    iframe.src = url;
    body.appendChild(iframe);
    return;
  }
  try {
    const loaded = await fetchNotebookText(targetPath);
    if (loaded.isBinary || !LINK_TEXT_PREVIEW_EXTS.has(ext)) {
      const iframe = document.createElement("iframe");
      iframe.className = "nv-link-file-frame";
      iframe.src = url;
      body.appendChild(iframe);
      return;
    }
    const pre = document.createElement("pre");
    pre.className = "nv-link-file-code";
    pre.textContent = loaded.content;
    body.appendChild(pre);
  } catch (err) {
    body.textContent = err?.message || "Failed to load destination file.";
  }
}

export function renderPreviewSection(shell, titleText, pathText, role) {
  const section = document.createElement("section");
  section.className = "nv-link-file-preview";
  const header = document.createElement("div");
  header.className = "nv-link-file-preview-header";
  const title = document.createElement("h3");
  title.textContent = titleText;
  const path = document.createElement("div");
  path.className = "nv-link-file-preview-path";
  path.textContent = pathText || "None";
  header.append(title, path);
  const body = document.createElement("div");
  body.className = "nv-link-file-preview-body";
  body.textContent = "Loading...";
  section.append(header, body);
  shell.appendChild(section);
  return body;
}

export function linkFileViewCss() {
  return `
    .nv-link-file-view{box-sizing:border-box;min-height:100%;padding:14px;color:#172033;background:#f8fafc;font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;flex-direction:column;gap:12px}
    .nv-link-file-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #d8dee9;padding-bottom:10px}
    .nv-link-file-title{font-size:17px;font-weight:750;margin:0;color:#111827;overflow-wrap:anywhere}
    .nv-link-file-subtitle{margin-top:3px;color:#526173;overflow-wrap:anywhere}
    .nv-link-file-section,.nv-link-file-preview{background:#fff;border:1px solid #d8dee9;border-radius:6px;padding:10px;box-shadow:0 1px 2px rgba(15,23,42,.05)}
    .nv-link-file-section h3,.nv-link-file-preview h3{font-size:13px;margin:0 0 8px;font-weight:750;color:#1f2937}
    .nv-link-file-details{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:7px 12px}
    .nv-link-file-detail-row{display:grid;grid-template-columns:minmax(92px,.36fr) minmax(0,1fr);gap:8px;align-items:start;min-width:0}
    .nv-link-file-label,.nv-link-file-field span{font-weight:650;color:#475569}
    .nv-link-file-value{min-width:0;overflow-wrap:anywhere;color:#172033}
    .nv-link-file-select,.nv-link-file-field input,.nv-link-file-btn{font:inherit;border:1px solid #cbd5e1;background:#fff;color:#172033;border-radius:5px;box-sizing:border-box}
    .nv-link-file-select{width:100%;padding:6px 8px}
    .nv-link-file-editor{display:grid;gap:8px}
    .nv-link-file-field{display:grid;grid-template-columns:minmax(95px,.26fr) minmax(0,1fr);gap:8px;align-items:center}
    .nv-link-file-field input{min-width:0;width:100%;padding:6px 8px}
    .nv-link-file-field input:disabled{background:#f1f5f9;color:#64748b}
    .nv-link-file-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
    .nv-link-file-btn{padding:5px 9px;cursor:pointer}
    .nv-link-file-btn:disabled{cursor:not-allowed;opacity:.55}
    .nv-link-file-primary{background:#1f6feb;color:#fff;border-color:#1f6feb}
    .nv-link-file-status{font-size:12px;color:#64748b;min-height:17px}
    .nv-link-file-status[data-kind="ok"]{color:#15803d}.nv-link-file-status[data-kind="warn"]{color:#a16207}.nv-link-file-status[data-kind="error"]{color:#b91c1c}
    .nv-link-file-previews{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;align-items:stretch}
    .nv-link-file-preview{display:flex;flex-direction:column;min-height:360px;min-width:0}
    .nv-link-file-preview-header{border-bottom:1px solid #e2e8f0;margin-bottom:8px;padding-bottom:7px}
    .nv-link-file-preview-path{font-size:12px;color:#64748b;overflow-wrap:anywhere}
    .nv-link-file-preview-body{min-height:0;flex:1;overflow:auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:8px;box-sizing:border-box}
    .nv-link-file-code{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;color:#111827}
    .nv-link-file-highlight{border-radius:3px;padding:0 2px}.nv-link-file-highlight-target{background:#fde68a}.nv-link-file-highlight-text{background:#bfdbfe}
    .nv-link-file-frame{width:100%;height:100%;min-height:320px;border:0;background:#fff}.nv-link-file-media{max-width:100%;max-height:100%;display:block;margin:auto}
  `;
}
