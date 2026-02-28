// Nodevision/public/PanelInstances/ViewPanels/ViewThingDescription.mjs
// Purpose: Render and interact with Thing Description (TD) JSON files
// Allows viewing device properties and exporting an Arduino sketch

export async function ViewThingDescription(filename, infoPanel, serverBase) {
  console.log("ViewThingDescription: rendering", filename);

  infoPanel.innerHTML = `<h2>Thing Description</h2><p>Loading...</p>`;

  try {
    const response = await fetch(`${serverBase}/${filename}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const fileContent = await response.text();
    const td = JSON.parse(fileContent);

    infoPanel.innerHTML = ""; // clear "Loading..."

    const title = td.title || "Unnamed Device";
    infoPanel.innerHTML += `<h3>${title}</h3>`;

    const props = td.properties || {};
    const propKeys = Object.keys(props);

    if (propKeys.length === 0) {
      infoPanel.innerHTML += `<p>No properties defined.</p>`;
      return;
    }

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr><th>Data Name</th><th>Description</th><th>GPIO</th><th>Type</th></tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    propKeys.forEach(key => {
      const prop = props[key];
      const desc = prop.description || "";
      const gpioMatch = desc.match(/GPIO\s*(\d+)/i);
      const gpio = gpioMatch ? gpioMatch[1] : "";
      const type = prop.type || "analog";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${key}</td>
        <td>${desc}</td>
        <td><input value="${gpio}" data-prop="${key}" class="gpio-input" size="4"></td>
        <td>
          <select data-prop-type="${key}">
            <option value="analog" ${type === "analog" ? "selected" : ""}>Analog</option>
            <option value="digital" ${type === "digital" ? "selected" : ""}>Digital</option>
          </select>
        </td>
      `;
      tbody.appendChild(row);
    });

    infoPanel.appendChild(table);

    const button = document.createElement("button");
    button.textContent = "Download Arduino Sketch";
    button.onclick = () => downloadSketch(title, table);
    infoPanel.appendChild(button);

    // Raw JSON viewer
    const jsonBlock = document.createElement("details");
    jsonBlock.innerHTML = `
      <summary style="margin-top: 1em; cursor: pointer;">Show Thing Description JSON</summary>
      <pre style="background:#f5f5f5; border:1px solid #ccc; padding:0.5em; overflow:auto;">${escapeHTML(
        JSON.stringify(td, null, 2)
      )}</pre>
    `;
    infoPanel.appendChild(jsonBlock);
  } catch (err) {
    console.error("Failed to load Thing Description:", err);
    infoPanel.innerHTML = `<p style="color:red;">Failed to load Thing Description: ${err.message}</p>`;
  }
}

// Helper to escape HTML for JSON display
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Generate Arduino sketch
function downloadSketch(title, table) {
  const rows = table.querySelectorAll("tbody tr");
  let defines = "",
    pinModes = "",
    reads = "";

  rows.forEach(row => {
    const dataName = row.querySelector("td").textContent.trim();
    const label = dataName.toUpperCase();
    const gpio = row.querySelector("input").value.trim();
    const type = row.querySelector("select").value;

    defines += `#define ${label} ${gpio}\n`;
    pinModes += `  pinMode(${label}, INPUT);\n`;

    reads +=
      type === "digital"
        ? `  int ${dataName} = digitalRead(${label});\n`
        : `  int ${dataName} = analogRead(${label});\n`;
  });

  const code = `
// Auto-generated for ${title}
#include <WiFi.h>

${defines}

void setup() {
  Serial.begin(115200);
  WiFi.begin("yourSSID", "yourPassword");

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting...");
  }

  Serial.println("Connected to WiFi");
  Serial.println(WiFi.localIP());

${pinModes}
}

void loop() {
${reads}
  delay(1000);
}
`.trim();

  const blob = new Blob([code], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/\W+/g, "_")}.ino`;
  a.click();
}
