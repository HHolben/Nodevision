window.InfoThingDescription = async function(filename, container, serverBase) {
  container.innerHTML = `<h2>Thing Description</h2><p>Loading...</p>`;

  try {
    const response = await fetch(`${serverBase}/${filename}`);
    const fileContent = await response.text();
    const td = JSON.parse(fileContent);
    
    container.innerHTML = ''; // clear "Loading..."

    const title = td.title || 'Unnamed Device';
    container.innerHTML += `<h3>${title}</h3>`;

    const props = td.properties || {};
    const propKeys = Object.keys(props);
    if (propKeys.length === 0) {
      container.innerHTML += `<p>No properties defined.</p>`;
      return;
    }

    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr><th>Data Name</th><th>Description</th><th>GPIO</th><th>Type</th></tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    propKeys.forEach((key) => {
      const prop = props[key];
      const desc = prop.description || '';
      const gpioMatch = desc.match(/GPIO\s*(\d+)/i);
      const gpio = gpioMatch ? gpioMatch[1] : '';
      const type = prop.type || 'analog';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${key}</td>
        <td>${desc}</td>
        <td><input value="${gpio}" data-prop="${key}" class="gpio-input" size="4"></td>
        <td>
          <select data-prop-type="${key}">
            <option value="analog" ${type === 'analog' ? 'selected' : ''}>Analog</option>
            <option value="digital" ${type === 'digital' ? 'selected' : ''}>Digital</option>
          </select>
        </td>
      `;
      tbody.appendChild(row);
    });

    container.appendChild(table);

    const button = document.createElement('button');
    button.textContent = 'Download Arduino Sketch';
    button.onclick = () => downloadSketch(title);
    container.appendChild(button);

  } catch (err) {
    container.innerHTML = `<p style="color:red;">Failed to load Thing Description: ${err.message}</p>`;
  }
};

function downloadSketch(title) {
  const rows = document.querySelectorAll('tr');
  let defines = '', pinModes = '', reads = '';

  rows.forEach((row, i) => {
    if (i === 0) return; // skip header
    const cells = row.querySelectorAll('td');
    const dataName = cells[0].textContent;
    const label = dataName.toUpperCase();
    const gpio = row.querySelector('input').value;
    const type = row.querySelector('select').value;

    defines += `#define ${label} ${gpio}\n`;
    pinModes += `  pinMode(${label}, INPUT);\n`;

    reads += (type === 'digital')
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

  const blob = new Blob([code], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/\W+/g, '_')}.ino`;
  a.click();
}
