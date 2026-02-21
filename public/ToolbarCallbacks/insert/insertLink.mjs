// Nodevision/public/ToolbarCallbacks/insert/insertLink.mjs
// Inserts hyperlinks into HTML/EPUB editors and persists graph edges.

import { saveFoundEdge } from "../../PanelInstances/InfoPanels/GraphManagerDependencies/SaveFoundEdge.mjs";

function normalizeNotebookPath(input = "") {
  return String(input || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "");
}

function getCurrentEditorSourcePath() {
  const candidates = [
    window.selectedFilePath,
    window.filePath,
    window.NodevisionState?.selectedFile,
  ];

  for (const value of candidates) {
    const normalized = normalizeNotebookPath(value || "");
    if (normalized) return normalized;
  }
  return "";
}

function dirname(notebookPath = "") {
  const clean = normalizeNotebookPath(notebookPath);
  const idx = clean.lastIndexOf("/");
  return idx >= 0 ? clean.slice(0, idx) : "";
}

function toRelativeNotebookHref(sourcePath = "", targetPath = "") {
  const source = normalizeNotebookPath(sourcePath);
  const target = normalizeNotebookPath(targetPath);
  if (!target) return "";
  if (!source || source.startsWith("__epub_virtual__/")) {
    return `/Notebook/${target.split("/").map(encodeURIComponent).join("/")}`;
  }

  const fromParts = dirname(source).split("/").filter(Boolean);
  const toParts = target.split("/").filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i += 1;
  }
  const up = fromParts.length - i;
  const relParts = [
    ...new Array(Math.max(0, up)).fill(".."),
    ...toParts.slice(i),
  ];
  const rel = relParts.join("/") || target.split("/").pop() || target;
  return encodeURI(rel);
}

function ensureSelectionRangeInsideEditor(wysiwyg) {
  const sel = window.getSelection();
  if (!sel) return null;
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (wysiwyg.contains(range.startContainer) && wysiwyg.contains(range.endContainer)) {
      return range;
    }
  }
  const fallback = document.createRange();
  fallback.selectNodeContents(wysiwyg);
  fallback.collapse(false);
  sel.removeAllRanges();
  sel.addRange(fallback);
  return fallback;
}

function showLinkTypeDialog() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:32000;display:flex;align-items:center;justify-content:center;";

    const box = document.createElement("div");
    box.style.cssText = "width:min(420px,92vw);background:#fff;border:1px solid #888;border-radius:8px;padding:14px;font:13px monospace;";
    box.innerHTML = "<div style='font-weight:700;margin-bottom:10px;'>Insert Link</div><div style='margin-bottom:12px;'>Choose link type:</div>";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
    const internalBtn = document.createElement("button");
    internalBtn.textContent = "Internal File";
    const externalBtn = document.createElement("button");
    externalBtn.textContent = "External URL";
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";

    [internalBtn, externalBtn, cancelBtn].forEach((btn) => {
      btn.style.cssText = "padding:6px 10px;border:1px solid #777;background:#f6f6f6;cursor:pointer;";
      actions.appendChild(btn);
    });
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };
    internalBtn.onclick = () => finish("internal");
    externalBtn.onclick = () => finish("external");
    cancelBtn.onclick = () => finish(null);
    overlay.onclick = (evt) => {
      if (evt.target === overlay) finish(null);
    };
  });
}

async function listNotebookFilesRecursively(dirPath = "") {
  const url = `/api/list-directory?path=${encodeURIComponent(dirPath)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to list directory: ${res.status}`);
  const entries = await res.json();
  const files = [];

  for (const entry of entries || []) {
    const name = String(entry?.name || "").trim();
    if (!name) continue;
    const child = dirPath ? `${dirPath}/${name}` : name;
    if (entry.fileType === "directory") {
      const nested = await listNotebookFilesRecursively(child);
      files.push(...nested);
    } else {
      files.push(normalizeNotebookPath(child));
    }
  }
  return files;
}

function showNotebookFilePicker(files = []) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:32000;display:flex;align-items:center;justify-content:center;";

    const box = document.createElement("div");
    box.style.cssText = "width:min(760px,95vw);height:min(520px,90vh);display:flex;flex-direction:column;background:#fff;border:1px solid #888;border-radius:8px;padding:12px;font:13px monospace;";

    const title = document.createElement("div");
    title.textContent = "Select Internal Link Target";
    title.style.cssText = "font-weight:700;margin-bottom:8px;";

    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "Filter files...";
    search.style.cssText = "margin-bottom:8px;padding:6px;border:1px solid #bbb;";

    const list = document.createElement("select");
    list.size = 18;
    list.style.cssText = "flex:1;min-height:160px;border:1px solid #bbb;padding:4px;font:12px monospace;";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:10px;";
    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Select";
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    [selectBtn, cancelBtn].forEach((btn) => {
      btn.style.cssText = "padding:6px 10px;border:1px solid #777;background:#f6f6f6;cursor:pointer;";
      actions.appendChild(btn);
    });

    const renderOptions = () => {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = "";
      files
        .filter((f) => !q || f.toLowerCase().includes(q))
        .slice(0, 5000)
        .forEach((file) => {
          const option = document.createElement("option");
          option.value = file;
          option.textContent = file;
          list.appendChild(option);
        });
      if (list.options.length > 0) {
        list.selectedIndex = 0;
      }
    };

    box.appendChild(title);
    box.appendChild(search);
    box.appendChild(list);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    renderOptions();
    search.focus();

    const finish = (value) => {
      overlay.remove();
      resolve(value || null);
    };
    search.oninput = renderOptions;
    selectBtn.onclick = () => finish(list.value || null);
    cancelBtn.onclick = () => finish(null);
    list.ondblclick = () => finish(list.value || null);
    overlay.onclick = (evt) => {
      if (evt.target === overlay) finish(null);
    };
  });
}

async function chooseInternalNotebookTarget() {
  const files = await listNotebookFilesRecursively("");
  if (!files.length) return null;
  return showNotebookFilePicker(files);
}

function insertAnchorAtSelection(wysiwyg, href, linkText, linkType = "external") {
  const sel = window.getSelection();
  if (!sel) return null;
  const range = ensureSelectionRangeInsideEditor(wysiwyg);
  if (!range) return null;

  const selectedText = range.toString();
  const resolvedText = linkText || selectedText || href;

  const a = document.createElement("a");
  a.href = href;
  a.textContent = resolvedText;
  a.dataset.nvLinkType = linkType;
  if (linkType === "external") {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }

  range.deleteContents();
  range.insertNode(a);

  const spacer = document.createTextNode("\u00A0");
  a.after(spacer);
  sel.removeAllRanges();
  const caret = document.createRange();
  caret.setStart(spacer, 1);
  caret.collapse(true);
  sel.addRange(caret);
  return a;
}

export default async function insertLink() {
  const wysiwyg = document.querySelector("#wysiwyg[contenteditable='true']");
  if (!wysiwyg) {
    console.warn("insertLink: No active HTML WYSIWYG editor found.");
    return;
  }

  wysiwyg.focus();
  const linkType = await showLinkTypeDialog();
  if (!linkType) return;

  const sourcePath = getCurrentEditorSourcePath();
  let href = "";
  let edgeTarget = "";

  if (linkType === "internal") {
    let targetPath = null;
    try {
      targetPath = await chooseInternalNotebookTarget();
    } catch (err) {
      console.error("insertLink: Failed to open internal file dialog:", err);
      alert("Failed to load Notebook files for internal link.");
      return;
    }
    if (!targetPath) return;
    edgeTarget = normalizeNotebookPath(targetPath);
    href = toRelativeNotebookHref(sourcePath, edgeTarget);
  } else {
    const entered = prompt("Enter the hyperlink URL:");
    const trimmed = String(entered || "").trim();
    if (!trimmed) return;
    edgeTarget = trimmed;
    href = trimmed;
  }

  const linkText = prompt(
    "Enter link text (leave blank to use selected text or URL):"
  ) || "";

  const inserted = insertAnchorAtSelection(wysiwyg, href, linkText, linkType);
  if (!inserted) {
    console.warn("insertLink: Could not insert link at current selection.");
    return;
  }

  if (sourcePath && edgeTarget) {
    try {
      await saveFoundEdge({ source: sourcePath, target: edgeTarget });
    } catch (err) {
      console.error("insertLink: Failed to persist graph edge:", err);
    }
  }
}
