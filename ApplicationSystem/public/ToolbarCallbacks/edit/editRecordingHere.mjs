// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/editRecordingHere.mjs
// Open the sound editor for the selected audio element (HTML editor) or for the currently selected audio file.

import { createPanelDOM } from "/panels/panelFactory.mjs";

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "opus", "flac", "aiff", "aif", "webm"]);

function getSelectedAudioFilePath() {
  const candidates = [
    window.filePath,
    window.NodevisionState?.activeEditorFilePath,
    window.selectedFilePath,
    window.currentActiveFilePath,
    window.NodevisionState?.selectedFile,
  ].filter(Boolean);
  const path = candidates.find((p) => {
    const clean = String(p || "").split(/[?#]/)[0];
    const ext = (clean.split(".").pop() || "").toLowerCase();
    return AUDIO_EXTENSIONS.has(ext);
  });
  return path || null;
}

function getLinkedAudioPathFromSelection() {
  const sel = window.getSelection();
  const node = sel?.anchorNode || sel?.focusNode;
  const el = (node instanceof Element ? node : node?.parentElement) || null;
  const activeEl = document.activeElement instanceof Element ? document.activeElement : null;
  const link = el?.closest?.("[data-nv-linked-path], a[href]") ||
    activeEl?.closest?.("[data-nv-linked-path], a[href]");
  if (!link) return null;

  const candidate = (link.getAttribute("data-nv-linked-path") || link.getAttribute("href") || "").trim();
  if (!candidate) return null;

  const clean = candidate.split(/[?#]/)[0];
  const ext = (clean.split(".").pop() || "").toLowerCase();
  if (!AUDIO_EXTENSIONS.has(ext)) return null;

  return candidate;
}

function findAnyLinkedAudioInDocument() {
  const scopes = [
    document.querySelector("#wysiwyg"),
    document.body,
  ].filter(Boolean);

  for (const scope of scopes) {
    const links = Array.from(scope.querySelectorAll("[data-nv-linked-path], a[href]"));
    const audioLinks = links.filter((el) => {
      const candidate = (el.getAttribute("data-nv-linked-path") || el.getAttribute("href") || "").trim();
      if (!candidate) return false;
      const clean = candidate.split(/[?#]/)[0];
      const ext = (clean.split(".").pop() || "").toLowerCase();
      return AUDIO_EXTENSIONS.has(ext);
    });
    if (audioLinks.length === 1) {
      const el = audioLinks[0];
      return (el.getAttribute("data-nv-linked-path") || el.getAttribute("href") || "").trim();
    }
  }

  return null;
}

function normalizeAudioPath(path = "") {
  const raw = String(path || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    if (url.origin === window.location.origin && url.pathname.startsWith("/Notebook/")) {
      return url.pathname;
    }
  } catch {
    // Not a URL; fall through.
  }
  if (raw.startsWith("Notebook/")) return `/${raw}`;
  return raw;
}

async function openAudioEditorForPath(filePath) {
  const safeId = btoa(filePath).replace(/[^a-z0-9]/gi, "-");
  const instanceId = `nv-sound-editor-${safeId}`;
  const existing = document.querySelector(`.panel[data-instance-id=\"${instanceId}\"]`);
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  const panelInst = await createPanelDOM(
    "GraphicalEditor",
    instanceId,
    "EditorPanel",
    { filePath, displayName: `Edit Recording: ${filePath}` }
  );

  document.body.appendChild(panelInst.panel);
  panelInst.panel.classList.remove("docked");
  panelInst.panel.classList.add("undocked");
  panelInst.panel.style.width = "min(760px, 94vw)";
  panelInst.panel.style.height = "min(560px, 90vh)";
  panelInst.panel.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.18))}px`;
  panelInst.panel.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.12))}px`;
  panelInst.panel.style.zIndex = "23010";
  panelInst.panel.style.pointerEvents = "auto";

  if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
    try {
      panelInst.dockBtn.dispatchEvent(new MouseEvent("click", { bubbles: false, cancelable: true, view: window }));
    } catch {
      panelInst.dockBtn.click();
    }
  }
}

export default async function editRecordingHere() {
  const tools = window.HTMLWysiwygTools;
  const audioCtx = window.NodevisionState?.activeHtmlAudioContext;
  const linkedHtmlAudioPath = window.NodevisionState?.htmlAudioPath || audioCtx?.linkedNotebookPath || null;

  if (audioCtx?.element && tools && typeof tools.editSelectedAudioRecording === "function") {
    await tools.editSelectedAudioRecording();
    return;
  }

  const linkedFromSelection = getLinkedAudioPathFromSelection();
  if (linkedFromSelection) {
    await openAudioEditorForPath(normalizeAudioPath(linkedFromSelection));
    return;
  }

  if (linkedHtmlAudioPath) {
    await openAudioEditorForPath(normalizeAudioPath(linkedHtmlAudioPath));
    return;
  }

  const linkedFromScan = findAnyLinkedAudioInDocument();
  if (linkedFromScan) {
    await openAudioEditorForPath(normalizeAudioPath(linkedFromScan));
    return;
  }

  const filePath = getSelectedAudioFilePath();
  if (filePath) {
    await openAudioEditorForPath(normalizeAudioPath(filePath));
    return;
  }

  console.warn("editRecordingHere: no audio element or audio file selected.");
  alert("Select an audio element in the HTML editor or choose an audio file (mp3/wav/ogg/opus/flac) first, then try again.");
}
