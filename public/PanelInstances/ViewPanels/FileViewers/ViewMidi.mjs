// Nodevision/public/PanelInstances/ViewPanels/ViewMIDI.mjs
// Purpose: Display MIDI file information and render a simplified sheet music preview using VexFlow

export async function setupPanel(panel, instanceVars = {}) {
  const filePath = window.selectedFilePath || instanceVars.filePath || '';
  const serverBase = '/Notebook';
  panel.innerHTML = '';

  if (!filePath.toLowerCase().endsWith('.mid') && !filePath.toLowerCase().endsWith('.midi')) {
    panel.innerHTML = `<p>No MIDI file selected.</p>`;
    return;
  }

  console.log('ViewMIDI: loading', filePath);

  try {
    await ensureVexFlowLoaded();

    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    const { header, tracks } = parseMIDI(buffer);
    renderInfoTable(header, tracks, panel);
    renderSheet(buffer, header.division, panel);

  } catch (err) {
    console.error('Error loading MIDI:', err);
    panel.innerHTML = `<p style="color:red;">Error loading MIDI file: ${err.message}</p>`;
  }
}

/**
 * Ensures VexFlow is loaded before proceeding.
 */
async function ensureVexFlowLoaded() {
  if (window.VF || (window.Vex && window.Vex.Flow) || window.VexFlow) return;
  const existingScript = document.querySelector('script[src*="vexflow"]');
  if (existingScript) {
    await new Promise((resolve, reject) => {
      existingScript.onload = resolve;
      existingScript.onerror = () => reject(new Error('VexFlow script failed to load'));
    });
    return;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/vexflow/releases/vexflow-min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('VexFlow script failed to load'));
    document.head.appendChild(script);
  });
}

/**
 * Parse MIDI ArrayBuffer into header and track summaries.
 */
function parseMIDI(buffer) {
  const view = new DataView(buffer);
  let offset = 0;
  const readFourCC = () => String.fromCharCode(...Array.from({ length: 4 }, () => view.getUint8(offset++)));
  const readUint32 = () => (offset += 4, view.getUint32(offset - 4, false));
  const readUint16 = () => (offset += 2, view.getUint16(offset - 2, false));

  if (readFourCC() !== 'MThd') throw new Error('Invalid MIDI: missing MThd');
  const hdrLen = readUint32();
  const format = readUint16();
  const numTracks = readUint16();
  const division = readUint16();
  offset += (hdrLen - 6);

  const tracks = [];
  for (let i = 0; i < numTracks; i++) {
    if (readFourCC() !== 'MTrk') throw new Error(`Invalid MIDI: missing MTrk at track ${i}`);
    const length = readUint32();
    tracks.push({ index: i + 1, offset, length });
    offset += length;
  }
  return { header: { format, tracks: numTracks, division }, tracks };
}

/**
 * Render header & track summary table.
 */
function renderInfoTable(header, tracks, container) {
  let html = `
    <h3>MIDI File Information</h3>
    <p><strong>Format:</strong> ${header.format}</p>
    <p><strong>Tracks:</strong> ${header.tracks}</p>
    <p><strong>Division:</strong> ${header.division} ticks/quarter</p>
    <table style="border-collapse:collapse;">
      <thead>
        <tr>
          <th style="border:1px solid #ccc;padding:5px">Track #</th>
          <th style="border:1px solid #ccc;padding:5px">Offset</th>
          <th style="border:1px solid #ccc;padding:5px">Length</th>
        </tr>
      </thead>
      <tbody>
  `;
  tracks.forEach(t => {
    html += `
      <tr>
        <td style="border:1px solid #ccc;padding:5px">${t.index}</td>
        <td style="border:1px solid #ccc;padding:5px">${t.offset}</td>
        <td style="border:1px solid #ccc;padding:5px">${t.length}</td>
      </tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

/**
 * Extract simple note-on events.
 */
function extractNotes(buffer, division) {
  const view = new DataView(buffer);
  let pos = 14; // after header + first track header
  const notes = [];

  try {
    while (pos < buffer.byteLength) {
      const status = view.getUint8(pos++);
      if ((status & 0xF0) === 0x90) {
        const noteNum = view.getUint8(pos++);
        const vel = view.getUint8(pos++);
        if (vel > 0) notes.push({ keys: [midiToVexKey(noteNum)], duration: 'q' });
      } else {
        pos++;
      }
      if (status === 0xFF || notes.length >= 20) break;
    }
  } catch (e) {
    console.warn('Error extracting notes:', e);
  }

  return notes.length ? notes : [{ keys: ['c/4'], duration: 'q' }];
}

function midiToVexKey(n) {
  const oct = Math.floor(n / 12) - 1;
  const names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
  return `${names[n % 12]}/${oct}`;
}

/**
 * Render simplified sheet music using VexFlow.
 */
function renderSheet(buffer, division, container) {
  const VF = window.VF || (window.Vex && window.Vex.Flow) || window.VexFlow;
  if (!VF) {
    container.innerHTML += `<p style="color:red;">Error: VexFlow not loaded.</p>`;
    return;
  }

  const old = document.getElementById('sheetPanel');
  if (old) old.remove();

  const sheetDiv = document.createElement('div');
  sheetDiv.id = 'sheetPanel';
  sheetDiv.style.marginTop = '1em';
  sheetDiv.style.border = '1px solid #ddd';
  sheetDiv.style.padding = '10px';
  sheetDiv.style.backgroundColor = '#f7f7f7';
  sheetDiv.innerHTML = '<h3>MIDI Preview</h3>';
  container.appendChild(sheetDiv);

  try {
    const notesData = extractNotes(buffer, division);
    if (!notesData.length) {
      sheetDiv.innerHTML += '<p>No renderable notes found.</p>';
      return;
    }

    const width = Math.min(container.clientWidth - 40, 800);
    const height = Math.min(notesData.length * 25 + 80, 200);

    const rendererDiv = document.createElement('div');
    rendererDiv.id = 'vf-renderer';
    sheetDiv.appendChild(rendererDiv);

    const renderer = new VF.Renderer(rendererDiv, VF.Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();
    ctx.setFont('Arial', 10);

    const stave = new VF.Stave(10, 10, width - 20);
    stave.addClef('treble').setContext(ctx).draw();

    const vfNotes = notesData.slice(0, 16).map(n =>
      new VF.StaveNote({ clef: 'treble', keys: n.keys, duration: n.duration })
    );

    const voice = new VF.Voice({ num_beats: vfNotes.length, beat_value: 4 })
      .setStrict(false)
      .addTickables(vfNotes);

    new VF.Formatter().joinVoices([voice]).format([voice], width - 50);
    voice.draw(ctx, stave);

    sheetDiv.innerHTML +=
      '<p style="font-size:0.8em;color:#666;margin-top:1em;">Note: Simplified preview showing at most 16 notes.</p>';

  } catch (err) {
    console.error('Error rendering sheet music:', err);
    sheetDiv.innerHTML += `<p style="color:red;">Error rendering sheet music: ${err.message}</p>`;
  }
}
