//Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewIPYNB.mjs
// Renders Jupyter notebook markdown, code, and basic cell outputs.

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  console.log("📘 Rendering IPYNB:", filename);

  const url = `${serverBase}/${filename}`;
  console.log("📡 Fetching notebook:", url);

  let response;
  try {
    response = await fetch(url);
  } catch (netErr) {
    console.error("❌ Network error fetching .ipynb:", netErr);
    viewPanel.innerHTML = `<pre>Network error fetching: ${url}\n${netErr}</pre>`;
    return;
  }

  if (!response.ok) {
    const text = await response.text();
    console.error(
      `❌ Server responded ${response.status} for ${url}\nBody:\n`,
      text
    );
    viewPanel.innerHTML = `<pre>Error ${response.status} fetching notebook.\n${text}</pre>`;
    return;
  }

  // ---- SAFE JSON PARSE ---- //
  let notebook;
  try {
    const raw = await response.text();
    notebook = JSON.parse(raw);
  } catch (jsonErr) {
    console.error("❌ JSON parse failed for notebook:", jsonErr);

    const preview = await response.text().catch(() => "");
    viewPanel.innerHTML = `
      <pre>
Failed to parse .ipynb JSON.
Error: ${jsonErr}

Response body preview:
${preview.slice(0, 500)}
      </pre>
    `;
    return;
  }

  console.log("📗 Notebook loaded OK:", notebook);

  // ---- Render notebook ---- //
  const html = convertNotebookToHTML(notebook);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  console.log("📘 Notebook rendered.");
}

function convertNotebookToHTML(nb) {
  let html = `
    <style>
      body {
        font-family: sans-serif;
        margin: 20px;
      }
      .cell {
        padding: 10px;
        margin-bottom: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
      }
      pre {
        background: #f6f6f6;
        padding: 8px;
        border-radius: 4px;
        overflow-x: auto;
      }
      img { max-width: 100%; }
    </style>
  `;

  for (const cell of nb.cells || []) {
    html += `<div class="cell">`;

    if (cell.cell_type === "markdown") {
      html += markdownToHTML(cell.source.join(""));
    }

    if (cell.cell_type === "code") {
      html += `<pre><code>${escapeHTML(cell.source.join(""))}</code></pre>`;
      if (cell.outputs) {
        for (const out of cell.outputs) {
          if (out.data?.["text/plain"]) {
            html += `<pre>${escapeHTML(out.data["text/plain"].join(""))}</pre>`;
          }
          if (out.data?.["image/png"]) {
            html += `<img src="data:image/png;base64,${out.data["image/png"]}"/>`;
          }
        }
      }
    }

    html += `</div>`;
  }

  return html;
}

function escapeHTML(str) {
  return str.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
}

function markdownToHTML(md) {
  return md
    .replace(/^# (.*)/gm, "<h1>$1</h1>")
    .replace(/^## (.*)/gm, "<h2>$1</h2>")
    .replace(/^### (.*)/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}
