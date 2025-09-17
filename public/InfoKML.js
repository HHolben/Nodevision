// Nodevision/public/InfoKML.js
// Purpose: TODO: Add description of module purpose
window.renderKML = async function(filename, infoPanel, serverBase = '') {
  infoPanel.innerHTML = '';

  try {
    const response = await fetch(`${serverBase}/${filename}`);
    if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);

    const kmlText = await response.text();
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, "application/xml");

    const placemarks = [...kmlDoc.getElementsByTagName("Placemark")];
    if (placemarks.length === 0) {
      infoPanel.innerHTML = `<p>No placemarks found.</p>`;
      return;
    }

    const table = document.createElement("table");
    table.style.cssText = "width:100%; border-collapse:collapse; font-family:sans-serif;";
    table.innerHTML = `
      <thead>
        <tr style="background:#eee; text-align:left;">
          <th style="padding:4px; border:1px solid #ccc;">Name</th>
          <th style="padding:4px; border:1px solid #ccc;">Description</th>
          <th style="padding:4px; border:1px solid #ccc;">Coordinates</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    placemarks.forEach(pm => {
      const name = pm.getElementsByTagName("name")[0]?.textContent || "(unnamed)";
      const desc = pm.getElementsByTagName("description")[0]?.textContent || "";
      const coords = pm.getElementsByTagName("coordinates")[0]?.textContent.trim() || "";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="padding:4px; border:1px solid #ccc;">${name}</td>
        <td style="padding:4px; border:1px solid #ccc;">${desc}</td>
        <td style="padding:4px; border:1px solid #ccc; font-family:monospace;">${coords}</td>
      `;
      tbody.appendChild(row);
    });

    infoPanel.appendChild(table);

  } catch (err) {
    console.error("Error rendering KML:", err);
    infoPanel.innerHTML = `<p style="color:red;">Error loading KML file: ${err.message}</p>`;
  }
};