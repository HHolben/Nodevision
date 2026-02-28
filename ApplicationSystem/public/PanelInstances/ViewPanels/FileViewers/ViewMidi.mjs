// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewMIDI.mjs
// Purpose: Display MIDI file information and render simplified sheet music with VexFlow

import { VexFlow as VF } from '/lib/vexflow/build/esm/entry/vexflow.js';

export async function renderFile(filePath, panel) {
  const serverBase = '/Notebook';
  panel.innerHTML = '';

  if (
    !filePath ||
    (!filePath.toLowerCase().endsWith('.mid') &&
     !filePath.toLowerCase().endsWith('.midi'))
  ) {
    panel.innerHTML = `<p>No MIDI file selected.</p>`;
    return;
  }

  console.log('ViewMIDI: loading', filePath);

  try {
    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    let header = { format: 0, tracks: 0, division: 480 };
    let tracks = [];

    try {
      const parsed = parseMIDI(buffer);
      header = parsed.header;
      tracks = parsed.tracks;
      renderInfoTable(header, tracks, panel);
    } catch (parseErr) {
      console.warn("ViewMIDI parse fallback:", parseErr);
      panel.insertAdjacentHTML(
        "beforeend",
        `<p style="color:#b36b00;">MIDI header/track parse fallback: ${parseErr.message}</p>`
      );
    }

    renderSheet(buffer, header.division, panel);

  } catch (err) {
    console.error('Error loading MIDI:', err);
    panel.innerHTML = `<p style="color:red;">Error loading MIDI file: ${err.message}</p>`;
  }
}

/* ------------------------------- MIDI PARSER ------------------------------- */

function parseMIDI(buffer) {
  const view = new DataView(buffer);
  let offset = 0;
  const total = view.byteLength;

  const ensure = (n) => {
    if (offset + n > total) {
      throw new Error("Unexpected end of MIDI data.");
    }
  };

  const readFourCC = () => {
    ensure(4);
    return String.fromCharCode(
      view.getUint8(offset++),
      view.getUint8(offset++),
      view.getUint8(offset++),
      view.getUint8(offset++)
    );
  };
  const readUint32 = () => {
    ensure(4);
    const value = view.getUint32(offset, false);
    offset += 4;
    return value;
  };
  const readUint16 = () => {
    ensure(2);
    const value = view.getUint16(offset, false);
    offset += 2;
    return value;
  };

  if (readFourCC() !== 'MThd') throw new Error('Invalid MIDI: missing MThd');
  const hdrLen = readUint32();
  const format = readUint16();
  const numTracks = readUint16();
  const division = readUint16();
  offset += Math.max(0, hdrLen - 6);
  if (offset > total) {
    throw new Error("Invalid MIDI: header length exceeds file size.");
  }

  const tracks = [];
  for (let i = 0; i < numTracks; i++) {
    if (offset + 8 > total) break;
    if (readFourCC() !== 'MTrk')
      throw new Error(`Invalid MIDI: missing MTrk at track ${i}`);
    const length = readUint32();
    if (offset + length > total) {
      tracks.push({ index: i + 1, offset, length: Math.max(0, total - offset) });
      offset = total;
      break;
    }
    tracks.push({ index: i + 1, offset, length });
    offset += length;
  }
  return { header: { format, tracks: numTracks, division }, tracks };
}

/* ------------------------------ INFO TABLE -------------------------------- */

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

  container.insertAdjacentHTML('beforeend', html);
}

/* --------------------------- NOTE EXTRACTION ------------------------------- */

function extractNotes(buffer) {
  const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
  let pos = 14;
  const notes = [];

  try {
    if (bytes.length < 4) return [{ keys: ['c/4'], duration: 'q' }];
    if (pos >= bytes.length) pos = 0;
    while (pos < bytes.length && notes.length < 20) {
      const status = bytes[pos++];
      if (status === undefined) break;

      if ((status & 0xf0) === 0x90) {
        const note = bytes[pos++];
        const vel = bytes[pos++];
        if (note === undefined || vel === undefined) break;
        if (vel > 0) notes.push({ keys: [midiToVexKey(note)], duration: 'q' });
        continue;
      }

      if ((status & 0xf0) === 0x80 || (status & 0xf0) === 0xa0 || (status & 0xf0) === 0xb0 || (status & 0xf0) === 0xe0) {
        pos += 2;
        continue;
      }
      if ((status & 0xf0) === 0xc0 || (status & 0xf0) === 0xd0) {
        pos += 1;
        continue;
      }
      if (status === 0xff) break;
    }
  } catch (err) {
    console.warn('extractNotes error:', err);
  }

  return notes.length ? notes : [{ keys: ['c/4'], duration: 'q' }];
}

function midiToVexKey(n) {
  const names = [
    'c','c#','d','d#','e','f','f#','g','g#','a','a#','b'
  ];
  const oct = Math.floor(n / 12) - 1;
  return `${names[n % 12]}/${oct}`;
}

/* ----------------------------- RENDER SHEET ------------------------------- */

function renderSheet(buffer, division, container) {
  if (!VF || !VF.Renderer) {
    container.insertAdjacentHTML(
      'beforeend',
      `<p style="color:red;">Error: VexFlow not available.</p>`
    );
    return;
  }

  const old = document.getElementById('sheetPanel');
  if (old) old.remove();

  const sheetDiv = document.createElement('div');
  sheetDiv.id = 'sheetPanel';
  sheetDiv.style.marginTop = '1em';
  sheetDiv.style.border = '1px solid #ddd';
  sheetDiv.style.padding = '10px';
  sheetDiv.style.background = '#f7f7f7';
  sheetDiv.innerHTML = '<h3>MIDI Preview</h3>';
  container.appendChild(sheetDiv);

  try {
    const notesData = extractNotes(buffer);

    if (!notesData.length) {
      sheetDiv.insertAdjacentHTML('beforeend', '<p>No renderable notes found.</p>');
      return;
    }

    const width = container.clientWidth || 600;
    const height = 140;

    const rendererDiv = document.createElement('div');
    rendererDiv.id = 'vf-renderer';
    sheetDiv.appendChild(rendererDiv);

    const renderer = new VF.Renderer(rendererDiv, VF.Renderer.Backends.SVG);
    renderer.resize(width - 20, height);
    const ctx = renderer.getContext();
    ctx.setFont('Arial', 10);

    const stave = new VF.Stave(10, 10, width - 40);
    stave.addClef('treble').setContext(ctx).draw();

    const vfNotes = notesData.slice(0, 16).map(n =>
      new VF.StaveNote({
        clef: 'treble',
        keys: n.keys,
        duration: n.duration
      })
    );

    const voice = new VF.Voice({ num_beats: vfNotes.length, beat_value: 4 })
      .setStrict(false)
      .addTickables(vfNotes);

    new VF.Formatter().joinVoices([voice]).format([voice], width - 60);
    voice.draw(ctx, stave);

    sheetDiv.insertAdjacentHTML(
      'beforeend',
      '<p style="font-size:0.8em;color:#666;margin-top:1em;">Note: Simplified preview showing at most 16 notes.</p>'
    );

  } catch (err) {
    console.error('Error rendering sheet music:', err);
    sheetDiv.insertAdjacentHTML(
      'beforeend',
      `<p style="color:red;">Error rendering sheet music: ${err.message}</p>`
    );
  }
}
