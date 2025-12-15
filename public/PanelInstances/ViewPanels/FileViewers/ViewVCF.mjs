// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewVCF.mjs
// Renders standard vCard fields and optionally Nodevision-specific extensions.

let lastRenderedPath = null;

/**
 * Parse a vCard file into standard fields and X-NODEVISION extensions.
 */
function parseVCF(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const card = {};
  const xProps = {};

  for (let rawLine of lines) {
    if (!rawLine) continue;
    if (
      rawLine.startsWith('BEGIN') ||
      rawLine.startsWith('END') ||
      rawLine.startsWith('VERSION')
    ) continue;

    const line = rawLine.trim();
    const idx = line.indexOf(':');
    if (idx === -1) continue;

    const keyPart = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const key = keyPart.split(';')[0].toUpperCase();

    if (key.startsWith('X-NODEVISION-')) {
      if (!xProps[key]) xProps[key] = [];
      xProps[key].push(value);
    } else {
      if (!card[key]) card[key] = [];
      card[key].push(value);
    }
  }

  return { card, xProps };
}

function field(label, value) {
  const div = document.createElement('div');
  div.className = 'vcf-field';

  const strong = document.createElement('strong');
  strong.textContent = `${label}: `;

  const span = document.createElement('span');
  span.textContent = value;

  div.appendChild(strong);
  div.appendChild(span);
  return div;
}

/**
 * Render a VCF file into the view panel.
 */
export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    if (!filename || filename === lastRenderedPath) return;
    lastRenderedPath = filename;

    const url = `${serverBase}/${filename}`;

    viewPanel.innerHTML = '';
    viewPanel.style.background = '';

    const response = await fetch(`${url}?t=${Date.now()}`);
    if (!response.ok) {
      viewPanel.innerHTML = '<p style="color:red;">VCF file not found.</p>';
      return;
    }

    const text = await response.text();
    const { card, xProps } = parseVCF(text);

    const container = document.createElement('div');
    container.id = 'vcf-view';
    container.style.padding = '12px';
    container.style.overflowY = 'auto';

    // --- Header ---
    if (card.FN && card.FN[0]) {
      const h2 = document.createElement('h2');
      h2.textContent = card.FN[0];
      container.appendChild(h2);
      container.appendChild(document.createElement('hr'));
    }

    // --- Standard Fields ---
    if (card.EMAIL) card.EMAIL.forEach(v => container.appendChild(field('Email', v)));
    if (card.TEL) card.TEL.forEach(v => container.appendChild(field('Phone', v)));

    if (card.URL) {
      card.URL.forEach(v => {
        const div = document.createElement('div');
        const a = document.createElement('a');
        a.href = v;
        a.textContent = v;
        a.target = '_blank';
        div.appendChild(a);
        container.appendChild(div);
      });
    }

    if (card.ADR) {
      card.ADR.forEach(v =>
        container.appendChild(field('Address', v.replace(/;/g, ' ')))
      );
    }

    if (card.NOTE) {
      card.NOTE.forEach(v => container.appendChild(field('Notes', v)));
    }

    if (card.PHOTO && card.PHOTO[0]) {
      const img = document.createElement('img');
      img.src = card.PHOTO[0];
      img.alt = 'Contact photo';
      img.style.maxWidth = '200px';
      img.style.display = 'block';
      img.style.marginTop = '12px';
      container.appendChild(img);
    }

    // =========================================================
    // Nodevision Extensions (clearly separated)
    // =========================================================
    const hasNodevisionData = Object.keys(xProps).length > 0;
    if (hasNodevisionData) {
      container.appendChild(document.createElement('hr'));

      const h3 = document.createElement('h3');
      h3.textContent = 'Nodevision Data';
      h3.style.opacity = '0.7';
      container.appendChild(h3);

      // External profile link
      if (xProps['X-NODEVISION-PROFILE']) {
        xProps['X-NODEVISION-PROFILE'].forEach(path => {
          container.appendChild(field('Profile', path));
        });
      }

      // Embedded JSON data
      if (xProps['X-NODEVISION-DATA']) {
        xProps['X-NODEVISION-DATA'].forEach(raw => {
          const pre = document.createElement('pre');
          pre.style.whiteSpace = 'pre-wrap';
          pre.style.background = '#111';
          pre.style.color = '#ddd';
          pre.style.padding = '8px';
          pre.style.borderRadius = '4px';

          try {
            pre.textContent = JSON.stringify(JSON.parse(raw), null, 2);
          } catch {
            pre.textContent = raw; // fallback if malformed
          }

          container.appendChild(pre);
        });
      }
    }

    viewPanel.appendChild(container);
  } catch (err) {
    console.error('Error loading VCF:', err);
    viewPanel.innerHTML = '<p style="color:red;">Error loading VCF file.</p>';
  }
}
