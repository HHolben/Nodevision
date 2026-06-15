// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/NewFile.mjs
// This file defines browser-side New File logic for the Nodevision UI. It renders interface components and handles user interactions.
import createNewDocument from "/TemplateSystem/NewDocumentController.mjs";

export default async function NewFile() {
  await createNewDocument();
}
