// Nodevision/ApplicationSystem/public/TemplateSystem/TemplateCreateController.mjs
// File -> Create from Template flow.

import { showInputDialog } from "/ui/modals/InputDialog.mjs";
import { showTemplateFormDialog } from "./TemplateFormDialog.mjs";
import { showTemplatePicker } from "./TemplatePicker.mjs";

import {
  createTemplateFile,
  defaultFilenameFor,
  getCurrentNotebookDirectory,
  readTemplate,
  refreshNotebookDirectory,
} from "./TemplateApi.mjs";

export async function createFileFromTemplate() {
  try {
    const selected = await showTemplatePicker({
      title: "Create from Template",
      description: "Choose a template to create in the selected Notebook directory.",
      confirmText: "Continue",
    });
    if (!selected) return;

    const template = await readTemplate(selected.relativePath);
    const destinationDirectory = getCurrentNotebookDirectory();
    let filename = defaultFilenameFor(template);
    let values = {};

    if (template.kind === "form") {
      const formResult = await showTemplateFormDialog(template, {
        title: template.displayName || "Template",
        description: "Fill in the fields and choose the new file name.",
        includeFilename: true,
        defaultFilename: filename,
        confirmText: "Create file",
      });
      if (!formResult) return;
      filename = formResult.filename;
      values = formResult.values || {};
    } else {
      const entered = await showInputDialog({
        title: "Create from Template",
        description: "Enter the destination file name.",
        placeholder: filename,
        defaultValue: filename,
        confirmText: "Create file",
        cancelText: "Cancel",
        emptyMessage: "A file name is required.",
        returnTrimmed: true,
      });
      if (!entered) return;
      filename = entered;
    }

    const result = await createTemplateFile({
      templatePath: template.relativePath,
      destinationDirectory,
      filename,
      values,
    });

    window.selectedFilePath = result.path;
    await refreshNotebookDirectory(destinationDirectory);
  } catch (err) {
    console.error("Create from template failed:", err);
    alert(`Create from template failed: ${err?.message || err}`);
  }
}

export default createFileFromTemplate;

