// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/SaveAsTemplate.mjs
// Toolbar callback for File -> Save As Template.

import { showInputDialog } from "/ui/modals/InputDialog.mjs";
import { basename, saveFileAsTemplate } from "/TemplateSystem/TemplateApi.mjs";

function normalizeNotebookPath(value = "") {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";

  try {
    const parsed = new URL(cleaned, window.location.origin);
    cleaned = parsed.pathname || cleaned;
  } catch {
    // Keep path-like values that are not valid URLs.
  }

  cleaned = cleaned
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "");

  return cleaned.replace(/^Notebook\/?/i, "").replace(/\/+$/, "");
}

function resolveSelectedFilePath() {
  const candidates = [
    window.selectedFilePath,
    window.NodevisionState?.selectedFile,
    window.currentActiveFilePath,
    window.NodevisionState?.activeEditorFilePath,
    window.filePath,
    window.ActiveNode,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeNotebookPath(candidate);
    if (normalized) return normalized;
  }

  return "";
}

export async function saveSelectedFileAsTemplate() {
  try {
    const sourcePath = resolveSelectedFilePath();
    if (!sourcePath) {
      alert("Select a file before saving it as a template.");
      return;
    }

    const defaultName = basename(sourcePath) || "Template.txt";
    const filename = await showInputDialog({
      title: "Save As Template",
      description: "Enter the template file name.",
      placeholder: defaultName,
      defaultValue: defaultName,
      confirmText: "Save template",
      cancelText: "Cancel",
      emptyMessage: "A template file name is required.",
      returnTrimmed: true,
    });
    if (!filename) return;

    const result = await saveFileAsTemplate({ sourcePath, filename });
    document.dispatchEvent(new CustomEvent("refreshTemplates", {
      detail: { templatePath: result.templatePath },
    }));
    alert(`Saved template: ${result.templatePath || filename}`);
  } catch (err) {
    console.error("Save as template failed:", err);
    alert(`Save as template failed: ${err?.message || err}`);
  }
}

export default saveSelectedFileAsTemplate;
