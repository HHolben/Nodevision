// Apache Avro Viewer
// Supports:
//  - .avsc  → Avro schema (JSON)
//  - .avro  → Avro Object Container (binary, informational view)

export const wantsIframe = false;

export async function renderFile(filePath, panel) {
  panel.innerHTML = '';

  if (!filePath) {
    panel.innerHTML = `<em>No Avro file selected.</em>`;
    return;
  }

  const lower = filePath.toLowerCase();

  // -----------------------------
  // Avro Schema (.avsc)
  // -----------------------------
  if (lower.endsWith('.avsc')) {
    try {
      const res = await fetch(filePath);
      const text = await res.text();
      const json = JSON.parse(text);

      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(json, null, 2);
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.fontFamily = 'monospace';

      panel.appendChild(pre);
    } catch (err) {
      console.error('Failed to load Avro schema:', err);
      panel.innerHTML = `<em>Error loading Avro schema.</em>`;
    }
    return;
  }

  // -----------------------------
  // Avro Data File (.avro)
  // -----------------------------
  if (lower.endsWith('.avro')) {
    let size = 'unknown';

    try {
      const res = await fetch(filePath, { method: 'HEAD' });
      size = res.headers.get('content-length') || size;
    } catch {
      /* ignore */
    }

    panel.innerHTML = `
      <h3>Apache Avro Data File</h3>
      <p>
        This is a <strong>binary Avro Object Container File</strong>.
      </p>
      <ul>
        <li><strong>Path:</strong> ${filePath}</li>
        <li><strong>Size:</strong> ${size} bytes</li>
      </ul>
      <p>
        Avro data files require a schema-aware decoder.
        Browser-native rendering is not practical without large dependencies.
      </p>
      <p>
        Recommended tools:
      </p>
      <ul>
        <li><code>avro-tools tojson</code></li>
        <li>Apache Spark / Hadoop</li>
        <li>Python (<code>fastavro</code>)</li>
        <li>Node.js (<code>avsc</code>)</li>
      </ul>
      <p>
        <a href="${filePath}" download>⬇ Download .avro file</a>
      </p>
    `;
    return;
  }

  panel.innerHTML = `<em>Not an Avro file.</em>`;
}
