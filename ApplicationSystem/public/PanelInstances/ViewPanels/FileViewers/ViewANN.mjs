// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewANN.mjs
// Viewer for .ann annotation files (brat-style standoff annotations)

export async function renderFile(filePath, panel, iframe, serverBase) {
  panel.innerHTML = '';

  if (!filePath || !filePath.toLowerCase().endsWith('.ann')) {
    panel.innerHTML = `<p>No ANN file selected.</p>`;
    return;
  }

  try {
    const res = await fetch(`${serverBase}/${filePath}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    const annotations = parseANN(text);

    renderAnnotations(panel, annotations);

  } catch (err) {
    console.error('[ViewANN]', err);
    panel.innerHTML = `<p style="color:red;">Error loading ANN file</p>`;
  }
}

/* ============================== PARSER ================================= */

function parseANN(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);

  const data = {
    text: [],
    relations: [],
    events: [],
    attributes: [],
    comments: []
  };

  for (const line of lines) {
    const id = line[0];

    if (id === 'T') {
      // Text-bound annotation
      // T1  Entity 0 4    text
      const [head, value] = line.split('\t');
      const [_, type, start, end] = head.split(/\s+/);

      data.text.push({
        id: head.split(' ')[0],
        type,
        start: Number(start),
        end: Number(end),
        text: value
      });

    } else if (id === 'R') {
      // Relation
      data.relations.push({ raw: line });

    } else if (id === 'E') {
      // Event
      data.events.push({ raw: line });

    } else if (id === 'A') {
      // Attribute
      data.attributes.push({ raw: line });

    } else if (id === '#') {
      // Comment / note
      data.comments.push({ raw: line });

    } else {
      // Unknown / extension
      data.comments.push({ raw: line });
    }
  }

  return data;
}

/* ============================== RENDER ================================= */

function renderAnnotations(container, ann) {
  container.insertAdjacentHTML('beforeend', `<h3>Annotations (.ann)</h3>`);

  if (ann.text.length) {
    container.appendChild(renderTable(
      ['ID', 'Type', 'Start', 'End', 'Text'],
      ann.text.map(t => [t.id, t.type, t.start, t.end, t.text])
    ));
  }

  renderRawSection(container, 'Relations', ann.relations);
  renderRawSection(container, 'Events', ann.events);
  renderRawSection(container, 'Attributes', ann.attributes);
  renderRawSection(container, 'Comments / Notes', ann.comments);
}

/* ============================ HELPERS ================================== */

function renderRawSection(container, title, items) {
  if (!items.length) return;

  const pre = document.createElement('pre');
  pre.style.background = '#f8f8f8';
  pre.style.border = '1px solid #ccc';
  pre.style.padding = '8px';
  pre.textContent = items.map(i => i.raw).join('\n');

  container.insertAdjacentHTML('beforeend', `<h4>${title}</h4>`);
  container.appendChild(pre);
}

function renderTable(headers, rows) {
  const table = document.createElement('table');
  table.style.borderCollapse = 'collapse';
  table.style.width = '100%';

  const thead = document.createElement('thead');
  const tr = document.createElement('tr');

  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    th.style.border = '1px solid #ccc';
    th.style.padding = '4px';
    th.style.background = '#eee';
    tr.appendChild(th);
  });

  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  rows.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      td.style.border = '1px solid #ccc';
      td.style.padding = '4px';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}
