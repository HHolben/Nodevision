// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/PickLocalImageFile.mjs
// This module implements pick Local Image File behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizeNotebookPathInput } from "./MakeLayoutCanvasResizable.mjs";

// Pick Local Image File operations.
export async function pickLocalImageFile() {
  return new Promise(resolve => {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.style.display = "none";
    document.body.appendChild(picker);
    const cleanup = () => {
      if (picker.parentNode) picker.parentNode.removeChild(picker);
    };
    picker.addEventListener("change", () => {
      const file = picker.files && picker.files[0];
      cleanup();
      resolve(file || null);
    }, {
      once: true
    });
    picker.click();
  });
}

export async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Image read failed"));
      }
    };
    reader.onerror = () => reject(new Error("Unable to read image file"));
    reader.readAsDataURL(file);
  });
}

export function parseDataUrl(value = "") {
  const match = /^data:([^;,]+)?;base64,(.*)$/i.exec(String(value || ""));
  if (!match) return null;
  return {
    mimeType: match[1] || "application/octet-stream",
    base64: match[2] || ""
  };
}

export async function saveNotebookImageFromDataUrl(notebookPath, dataUrl) {
  const normalizedPath = normalizeNotebookPathInput(notebookPath);
  const parsed = parseDataUrl(dataUrl);
  if (!normalizedPath || !parsed) {
    throw new Error("Invalid image save request");
  }
  const res = await fetch("/api/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      path: normalizedPath,
      content: parsed.base64,
      encoding: "base64",
      mimeType: parsed.mimeType
    })
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  }
  return normalizedPath;
}

export async function saveNotebookText(notebookPath, content, mimeType = "text/plain") {
  const normalizedPath = normalizeNotebookPathInput(notebookPath);
  if (!normalizedPath) {
    throw new Error("Invalid text save request");
  }
  const res = await fetch("/api/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      path: normalizedPath,
      content: String(content || ""),
      encoding: "utf8",
      mimeType
    })
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  }
  return normalizedPath;
}

export function classifyImageChoice(rawChoice = "") {
  const choice = String(rawChoice || "").trim().toLowerCase();
  if (!choice) return "linked-upload";
  if (choice === "1" || choice.startsWith("linked")) return "linked-upload";
  if (choice === "2" || choice.startsWith("inline")) return "inline";
  if (choice === "3" || choice.startsWith("existing")) return "existing-notebook";
  if (choice === "4" || choice.startsWith("external")) return "external-url";
  return "linked-upload";
}
