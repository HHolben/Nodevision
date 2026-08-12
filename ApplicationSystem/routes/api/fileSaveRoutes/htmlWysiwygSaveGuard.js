// Nodevision/ApplicationSystem/routes/api/fileSaveRoutes/htmlWysiwygSaveGuard.js
// This file protects HTML/PHP Notebook files from being overwritten when the graphical HTML editor emits an empty or invalid serialized document.

import fs from "node:fs/promises";
import { validateGraphicalHtmlSave } from "../../../public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSaveSafety.mjs";

function textFromPayload({ content, encoding = "utf8" } = {}) {
  const enc = String(encoding || "utf8").toLowerCase();
  if (enc === "base64") return Buffer.from(String(content || ""), "base64").toString("utf8");
  if (enc === "binary") return Buffer.from(String(content || ""), "binary").toString("utf8");
  return String(content ?? "");
}

export async function validateHtmlWysiwygSavePayload({
  relativePath,
  filePath,
  content,
  encoding = "utf8",
  editorKind = "",
} = {}) {
  if (String(editorKind || "") !== "html-wysiwyg") return { ok: true };

  let originalContent = "";
  try {
    originalContent = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }

  return validateGraphicalHtmlSave({
    path: relativePath,
    content: textFromPayload({ content, encoding }),
    originalContent,
  });
}
