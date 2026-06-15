// Nodevision/ApplicationSystem/public/TemplateSystem/NewDocumentController.mjs
// File -> New File creation flow.

import { showTemplateFormDialog } from "./TemplateFormDialog.mjs";
import { openNodevisionOverlayPanel } from "./NodevisionOverlayPanel.mjs";
import {
  createBlankFile,
  createTemplateFile,
  getCurrentNotebookDirectory,
  readTemplate,
  refreshNotebookDirectory,
} from "./TemplateApi.mjs";

export function showNewFileOverlay(options = {}) {
  return openNodevisionOverlayPanel("NewDocumentOverlay", {
    displayName: options.title || "New File",
    defaultFilename: options.defaultFilename || "",
    startFromTemplate: Boolean(options.startFromTemplate),
  });
}

export const showNewDocumentOverlay = showNewFileOverlay;

export function showTemplatePanel(options = {}) {
  return openNodevisionOverlayPanel("TemplatePanel", {
    displayName: options.title || "Template Panel",
    filename: options.filename || "",
  });
}

export async function createNewFile() {
  const destinationDirectory = getCurrentNotebookDirectory();

  try {
    const documentRequest = await showNewFileOverlay({
      title: "New File",
      defaultFilename: "",
    });
    if (!documentRequest) return;

    const { filename, useTemplate } = documentRequest;
    let result = null;

    if (!useTemplate) {
      result = await createBlankFile(destinationDirectory, filename);
    } else {
      const selectedTemplate = await showTemplatePanel({ filename });
      if (!selectedTemplate) return;

      let values = {};
      if (selectedTemplate.kind === "form") {
        const template = await readTemplate(selectedTemplate.relativePath);
        const formResult = await showTemplateFormDialog(template, {
          title: template.displayName || "Template",
          description: filename,
          includeFilename: false,
          confirmText: "Create File",
        });
        if (!formResult) return;
        values = formResult.values || {};
      }

      result = await createTemplateFile({
        templatePath: selectedTemplate.relativePath,
        destinationDirectory,
        filename,
        values,
      });
    }

    window.selectedFilePath = result?.path || (destinationDirectory ? `${destinationDirectory}/${filename}` : filename);
    await refreshNotebookDirectory(destinationDirectory);
  } catch (err) {
    console.error("Failed to create file:", err);
    alert(`Failed to create file: ${err?.message || err}`);
  }
}

export const createNewDocument = createNewFile;

export default createNewFile;
