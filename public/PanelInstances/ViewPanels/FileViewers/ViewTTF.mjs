// Nodevision/public/PanelInstances/ViewPanels/ViewTTF.mjs
// Purpose: Render metadata about a TrueType Font (TTF) file inside a Nodevision panel.
// Fetches font metadata from the server and displays it in a clean table.

export async function ViewTTF(filename, infoPanel, serverBase) {
  console.log("ViewTTF: rendering", filename);

  infoPanel.innerHTML = `<h3>Font Metadata</h3><p>Loading...</p>`;

  try {
    const url = `${serverBase}/font-info?file=${encodeURIComponent(filename)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const info = await response.json();

    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.innerHTML = `
      <thead>
        <tr>
          <th style="border:1px solid #ccc;padding:6px;text-align:left;">Property</th>
          <th style="border:1px solid #ccc;padding:6px;text-align:left;">Value</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");
    for (const [key, value] of Object.entries(info)) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="border:1px solid #ccc;padding:6px;">${key}</td>
        <td style="border:1px solid #ccc;padding:6px;">${escapeHTML(value)}</td>
      `;
      tbody.appendChild(row);
    }

    infoPanel.innerHTML = "";
    infoPanel.appendChild(table);

    // Optional: add a preview area for the font if the TTF is accessible directly
    const preview = document.createElement("div");
    preview.innerHTML = `
      <h4 style="margin-top:1em;">Preview:</h4>
      <p style="font-size:1.5em;">The quick brown fox jumps over the lazy dog.</p>
    `;
    infoPanel.appendChild(preview);

    // Try dynamically loading the font for live preview
    try {
      const fontFace = new FontFace("PreviewFont", `url(${serverBase}/${filename})`);
      await fontFace.load();
      document.fonts.add(fontFace);
      preview.querySelector("p").style.fontFamily = "PreviewFont";
    } catch (fontErr) {
      console.warn("Could not load font preview:", fontErr);
    }
  } catch (err) {
    console.error("Error loading font info:", err);
    infoPanel.innerHTML = `<p style="color:red;">Error loading font metadata: ${err.message}</p>`;
  }
}

// --- Helpers ---
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
