// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/DetectLanguage.mjs
// This module implements detect language operations for CodeEditor, preserving the existing document and instance ownership contracts.

import { moduleState } from "./ModuleState.mjs";

export function detectLanguage(filePath) {
  const ext = filePath.split(".").pop().toLowerCase();
  return (
    {
      js: "javascript",
      mjs: "javascript",
      nodevisionsession: "javascript",
      ts: "typescript",
      html: "html",
      css: "css",
      json: "json",
      nbt: "json",
      py: "python",
      cpp: "cpp",
      cc: "cpp",
      h: "cpp",
      hpp: "cpp",
    }[ext] || "plaintext"
  );
}

export function configureFoldingMarkers() {
  const markers = {
    start: /^\s*#region\b/i,
    end: /^\s*#endregion\b/i,
  };
  ["javascript", "typescript", "html", "css", "python", "cpp", "json", "plaintext"].forEach((lang) => {
    try {
      monaco.languages.setLanguageConfiguration(lang, { folding: { markers } });
    } catch (err) {
      console.warn("Folding marker config failed for", lang, err);
    }
  });
}

export function collectCommonIdentifiers(model, max = 8) {
  if (!model) return [];
  const text = model.getValue();
  const re = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
  const counts = new Map();
  const keywords = new Set([
    "function","return","const","let","var","if","else","for","while","switch","case","break","continue",
    "class","extends","import","from","export","default","try","catch","finally","throw","new","this",
    "true","false","null","undefined","async","await","def","lambda","pass","None","in","and","or","not",
    "int","float","double","char","void","public","private","protected","static","final","enum","struct"
  ]);
  let m;
  while ((m = re.exec(text)) !== null) {
    const word = m[0];
    if (keywords.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name, count]) => ({ name, count }));
}

export function ensureCommonVarOverlay() {
  if (moduleState.commonVarOverlay) return moduleState.commonVarOverlay;
  const div = document.createElement("div");
  moduleState.commonVarOverlay = div;
  Object.assign(div.style, {
    position: "absolute",
    top: "8px",
    right: "8px",
    background: "rgba(20,20,20,0.9)",
    color: "#fff",
    padding: "8px",
    borderRadius: "6px",
    boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
    fontSize: "12px",
    display: "none",
    maxWidth: "260px",
    zIndex: 50,
  });
  const title = document.createElement("div");
  title.textContent = "Common identifiers (click to jump)";
  title.style.fontWeight = "700";
  title.style.marginBottom = "6px";
  div.appendChild(title);

  const list = document.createElement("div");
  list.id = "nv-common-var-list";
  list.style.display = "grid";
  list.style.gridTemplateColumns = "repeat(auto-fit, minmax(90px, 1fr))";
  list.style.gap = "6px";
  div.appendChild(list);

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  Object.assign(close.style, {
    position: "absolute",
    top: "4px",
    right: "6px",
    background: "transparent",
    color: "#fff",
    border: "none",
    fontSize: "14px",
    cursor: "pointer",
  });
  close.addEventListener("click", () => {
    moduleState.commonVarOverlay.style.display = "none";
  });
  div.appendChild(close);

  moduleState.editorContainer.appendChild(div);
  return div;
}

export function refreshCommonVarOverlay() {
  if (!moduleState.editorInstance || !moduleState.commonVarOverlay) return;
  const list = moduleState.commonVarOverlay.querySelector("#nv-common-var-list");
  if (!list) return;
  moduleState.commonVarData = collectCommonIdentifiers(moduleState.editorInstance.getModel());
  list.innerHTML = "";
  if (!moduleState.commonVarData.length) {
    const empty = document.createElement("div");
    empty.textContent = "No identifiers yet.";
    empty.style.opacity = "0.8";
    list.appendChild(empty);
    return;
  }
  moduleState.commonVarData.forEach(({ name, count }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${name} (${count})`;
    Object.assign(btn.style, {
      padding: "4px 6px",
      border: "1px solid #444",
      background: "#1e1e1e",
      color: "#fff",
      borderRadius: "4px",
      cursor: "pointer",
      textAlign: "left",
    });
    btn.addEventListener("click", () => jumpToIdentifier(name));
    list.appendChild(btn);
  });
}

export function jumpToIdentifier(name) {
  if (!moduleState.editorInstance || !name) return;
  const model = moduleState.editorInstance.getModel();
  if (!model) return;
  const matches = model.findMatches(name, true, false, false, null, true);
  if (!matches.length) return;
  const pos = matches[0].range;
  moduleState.editorInstance.setSelection(pos);
  moduleState.editorInstance.revealRangeInCenter(pos);
  moduleState.commonVarOverlay.style.display = "none";
}
