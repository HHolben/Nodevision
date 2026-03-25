// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaSpreadsheet.mjs
// Insert → Media: Spreadsheet renderer with New/Existing and Referenced/Inline (mirrors Insert Image panel structure).

import { escapeHtml, getActiveEditorNotebookPath, dirname, joinNotebookPath, normalizeNotebookPath, notebookHrefFromPath, saveNotebookText, insertHtmlAtCaret } from "./insertMediaCommon.mjs";
import { dataUrlFromText, fetchUrlAsText, looksLikeUrlOrAbsPath, notebookSourceFromPath, readFileAsText } from "./insertMediaIO.mjs";

function pickDefaultExt(exts) {
  const list = Array.from(new Set(exts || [])).map((e) => String(e).toLowerCase()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  return list.includes("csv") ? "csv" : (list[0] || "csv");
}

export function renderSpreadsheet(root, exts = []) {
  const extensions = Array.from(new Set(exts)).map((e) => String(e).toLowerCase()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const defaultExt = pickDefaultExt(extensions);
  const options = extensions.length ? extensions : [defaultExt];

  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:300px;max-width:660px;">
    <fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Spreadsheet Source</legend>
      <label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-source" value="new" checked> New Spreadsheet</label>
      <label style="display:block;"><input type="radio" name="nv-source" value="existing"> Existing Spreadsheet</label>
    </fieldset>
    <fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Storage Mode</legend>
      <label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-storage" value="referenced" checked> Referenced (load from file path)</label>
      <label style="display:block;"><input type="radio" name="nv-storage" value="inline"> Inline (embed CSV in page)</label>
    </fieldset>
    <fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Render</legend>
      <label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-render" value="table" checked> Table</label>
      <label style="display:block;"><input type="radio" name="nv-render" value="flashcards"> Flashcards</label>
    </fieldset>
    <div data-section="new" style="display:flex;flex-direction:column;gap:8px;">
      <div data-section="new-ref" style="display:flex;flex-direction:column;gap:8px;">
        <label>New Format<select data-field="format" style="display:block;width:100%;margin-top:4px;">${options.map((e) => `<option value="${escapeHtml(e)}"${e === defaultExt ? " selected" : ""}>${escapeHtml(e)}</option>`).join("")}</select></label>
        <label>New File Name<input data-field="fileName" type="text" placeholder="data.${escapeHtml(defaultExt)}" style="display:block;width:100%;margin-top:4px;" /></label>
      </div>
      <label>CSV Content<textarea data-field="csv" rows="6" style="display:block;width:100%;margin-top:4px;white-space:pre;tab-size:2;">front,back\nQuestion?,Answer!\n</textarea></label>
    </div>
    <div data-section="existing" style="display:none;flex-direction:column;gap:8px;">
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label style="flex:1;">Existing Source (Notebook path or URL)<input data-field="existingSource" type="text" placeholder="data/example.csv or https://..." style="display:block;width:100%;margin-top:4px;" /></label>
        <button type="button" data-action="choose-existing" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Choose File...</button>
      </div>
      <div data-field="existingFileStatus" style="font-size:11px;color:#4b4b4b;">No local file selected.</div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;"><button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Insert</button></div>
    <div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div>
  </form>`;

  const form = root.querySelector("form");
  const sourceEls = () => Array.from(root.querySelectorAll('input[name="nv-source"]'));
  const storageEls = () => Array.from(root.querySelectorAll('input[name="nv-storage"]'));
  const renderEls = () => Array.from(root.querySelectorAll('input[name="nv-render"]'));
  const newSection = root.querySelector('[data-section="new"]');
  const existingSection = root.querySelector('[data-section="existing"]');
  const newRefSection = root.querySelector('[data-section="new-ref"]');
  const formatEl = root.querySelector('[data-field="format"]');
  const fileEl = root.querySelector('[data-field="fileName"]');
  const csvEl = root.querySelector('[data-field="csv"]');
  const existingSourceEl = root.querySelector('[data-field="existingSource"]');
  const existingFileStatus = root.querySelector('[data-field="existingFileStatus"]');
  const statusEl = root.querySelector('[data-field="status"]');

  const hiddenExisting = document.createElement("input");
  hiddenExisting.type = "file";
  hiddenExisting.accept = ".csv,text/csv,application/vnd.ms-excel,text/plain";
  hiddenExisting.style.display = "none";
  form.appendChild(hiddenExisting);

  let existingFile = { text: "", name: "" };
  const setStatus = (t) => { statusEl.textContent = String(t || ""); };
  const valueOf = (radios) => radios.find((r) => r.checked)?.value || "";

  const sync = () => {
    const src = valueOf(sourceEls());
    const storage = valueOf(storageEls());
    newSection.style.display = src === "new" ? "flex" : "none";
    existingSection.style.display = src === "existing" ? "flex" : "none";
    newRefSection.style.display = (src === "new" && storage === "referenced") ? "flex" : "none";
  };
  sourceEls().forEach((r) => r.addEventListener("change", sync));
  storageEls().forEach((r) => r.addEventListener("change", sync));
  sync();

  const updateExistingLabel = () => {
    existingFileStatus.textContent = existingFile.text ? `Selected: ${existingFile.name}` : "No local file selected.";
  };
  updateExistingLabel();
  root.querySelector('[data-action="choose-existing"]').addEventListener("click", () => hiddenExisting.click());

  hiddenExisting.addEventListener("change", async () => {
    const file = hiddenExisting.files?.[0];
    hiddenExisting.value = "";
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      existingFile = { text, name: file.name };
      existingSourceEl.value = file.name;
      existingSourceEl.dataset.localFile = "true";
    } catch (e) {
      existingFile = { text: "", name: "" };
      delete existingSourceEl.dataset.localFile;
      setStatus(e?.message || String(e));
    }
    updateExistingLabel();
  });

  existingSourceEl.addEventListener("input", () => {
    if (existingSourceEl.dataset.localFile === "true" && existingSourceEl.value !== existingFile.name) {
      existingFile = { text: "", name: "" };
      delete existingSourceEl.dataset.localFile;
      updateExistingLabel();
    }
  });

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    setStatus("");
    try {
      const sourceMode = valueOf(sourceEls());
      const storageMode = valueOf(storageEls());
      const renderMode = valueOf(renderEls()) || "table";
      const editorPath = getActiveEditorNotebookPath();
      const baseDir = dirname(editorPath);
      const defaultDir = joinNotebookPath(baseDir, "data");
      let src = "", linked = "";

      if (sourceMode === "new") {
        const csvText = String(csvEl.value || "");
        if (storageMode === "inline") {
          src = dataUrlFromText(csvText, "text/csv");
        } else {
          const fmt = String(formatEl.value || defaultExt).trim().toLowerCase() || defaultExt;
          const name = String(fileEl.value || "data").trim();
          const fileName = name.includes(".") ? name : `${name}.${fmt}`;
          const notebookPath = normalizeNotebookPath(joinNotebookPath(defaultDir, fileName));
          await saveNotebookText(notebookPath, csvText, "text/csv");
          src = notebookSourceFromPath(notebookPath, editorPath);
          linked = notebookPath;
        }
      } else {
        const entered = String(existingSourceEl.value || "").trim();
        const localSelected = Boolean(existingFile.text && existingSourceEl.dataset.localFile === "true");
        if (!entered && !localSelected) throw new Error("Enter an existing source or choose a local file.");

        if (storageMode === "inline") {
          if (localSelected) {
            src = dataUrlFromText(existingFile.text, "text/csv");
          } else {
            const url = looksLikeUrlOrAbsPath(entered) ? entered : notebookHrefFromPath(normalizeNotebookPath(entered));
            const text = await fetchUrlAsText(url);
            src = dataUrlFromText(text, "text/csv");
          }
        } else if (localSelected) {
          const notebookPath = normalizeNotebookPath(entered) || normalizeNotebookPath(joinNotebookPath(defaultDir, existingFile.name || `data-${Date.now()}.csv`));
          await saveNotebookText(notebookPath, existingFile.text, "text/csv");
          src = notebookSourceFromPath(notebookPath, editorPath);
          linked = notebookPath;
        } else {
          if (looksLikeUrlOrAbsPath(entered)) {
            src = entered;
          } else {
            const notebookPath = normalizeNotebookPath(entered);
            src = notebookSourceFromPath(notebookPath, editorPath);
            linked = notebookPath;
          }
        }
      }

      const id = `nv-sheet-${Date.now()}`;
      const linkedAttr = linked ? ` data-nv-linked-path="${escapeHtml(linked)}"` : "";
      const escapedSrc = escapeHtml(src);

      if (renderMode === "flashcards") {
        insertHtmlAtCaret(`<div id="${id}"${linkedAttr} style="border:1px solid #ccc;padding:10px;max-width:520px;"></div><script>(function(){const el=document.getElementById(${JSON.stringify(id)});if(!el)return;fetch(${JSON.stringify(escapedSrc)}).then(r=>r.text()).then(t=>{const lines=t.split(/\\r?\\n/).filter(Boolean);const rows=lines.slice(1).map(l=>l.split(','));const cards=rows.map(r=>({front:(r[0]||'').trim(),back:(r[1]||'').trim()})).filter(c=>c.front&&c.back);if(!cards.length){el.textContent='No cards';return;}let i=0,side='front';const card=document.createElement('div');card.style.cursor='pointer';card.style.textAlign='center';card.style.padding='12px';card.style.userSelect='none';const nav=document.createElement('div');nav.style.display='flex';nav.style.justifyContent='space-between';nav.style.marginTop='8px';const prev=document.createElement('button');prev.textContent='Prev';const next=document.createElement('button');next.textContent='Next';nav.append(prev,next);el.append(card,nav);const render=()=>{card.textContent=cards[i][side];};card.onclick=()=>{side=side==='front'?'back':'front';render();};prev.onclick=()=>{i=(i-1+cards.length)%cards.length;side='front';render();};next.onclick=()=>{i=(i+1)%cards.length;side='front';render();};render();});})();</script>`);
      } else {
        insertHtmlAtCaret(`<table id="${id}"${linkedAttr} style="border-collapse:collapse;width:100%;max-width:700px;"></table><script>(function(){const t=document.getElementById(${JSON.stringify(id)});if(!t)return;fetch(${JSON.stringify(escapedSrc)}).then(r=>r.text()).then(txt=>{const lines=txt.split(/\\r?\\n/).filter(l=>l.trim().length);const rows=lines.map(l=>l.split(','));if(!rows.length)return;const thead=document.createElement('thead');const trh=document.createElement('tr');rows[0].forEach(h=>{const th=document.createElement('th');th.textContent=h.trim();th.style.border='1px solid #ccc';th.style.padding='4px 6px';trh.appendChild(th);});thead.appendChild(trh);const tbody=document.createElement('tbody');rows.slice(1).forEach(r=>{const tr=document.createElement('tr');r.forEach(c=>{const td=document.createElement('td');td.textContent=c.trim();td.style.border='1px solid #ccc';td.style.padding='4px 6px';tr.appendChild(td);});tbody.appendChild(tr);});t.append(thead,tbody);});})();</script>`);
      }
      setStatus("Inserted.");
    } catch (err) {
      console.warn("[insertMediaSpreadsheet]", err);
      setStatus(err?.message || String(err));
    }
  });
}

