// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewABC.mjs
// Purpose: Render a simplified preview of ABC notation using VexFlow (no abcjs)

import { VexFlow as VF } from '/lib/vexflow/build/esm/entry/vexflow.js';

export async function renderFile(filePath, panel) {
  const serverBase = '/Notebook';
  panel.innerHTML = '';

  if (!filePath || !filePath.toLowerCase().endsWith('.abc')) {
    panel.innerHTML = `<p>No ABC notation file selected.</p>`;
    return;
  }

  try {
    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok)
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);

    const abcText = await response.text();

    panel.insertAdjacentHTML(
      'beforeend',
      `<h3>ABC Preview (Simplified)</h3>
       <p style="font-size:0.8em;color:#666;">
         Note: This is a simplified preview rendered with VexFlow.
         Complex ABC features are not supported.
       </p>`
    );

    const notes = parseSimpleABC(abcText);
    renderWithVexFlow(notes, panel);

  } catch (err) {
    console.error('ViewABC error:', err);
    panel.innerHTML = `<p style="color:red;">Error loading ABC file: ${err.message}</p>`;
  }
}

/* -------------------------- SIMPLE ABC PARSER -------------------------- */

function parseSimpleABC(abcText) {
  // Remove comments and header lines
  const body = abcText
    .replace(/%.*/g, '')
    .replace(/^[A-Z]:.*$/gm, '')
    .trim();

  const notes = [];
  let octave = 4;

  for (const ch of body) {
    if (ch === "'") octave++;
    else if (ch === ",") octave--;
    else if (/[A-Ga-g]/.test(ch)) {
      const isUpper = ch === ch.toUpperCase();
      const pitch = ch.toLowerCase();
      const noteOctave = isUpper ? octave : octave + 1;

      notes.push({
        keys: [`${pitch}/${noteOctave}`],
        duration: 'q'
      });
    }

    if (notes.length >= 32) break; // preview limit
  }

  return notes.length
    ? notes
    : [{ keys: ['c/4'], duration: 'q' }];
}

/* ---------------------------- RENDERING ---------------------------- */

function renderWithVexFlow(notes, container) {
  if (!VF || !VF.Renderer) {
    container.insertAdjacentHTML(
      'beforeend',
      `<p style="color:red;">VexFlow not available.</p>`
    );
    return;
  }

  const old = document.getElementById('abcSheet');
  if (old) old.remove();

  const sheetDiv = document.createElement('div');
  sheetDiv.id = 'abcSheet';
  sheetDiv.style.marginTop = '1em';
  sheetDiv.style.border = '1px solid #ddd';
  sheetDiv.style.padding = '10px';
  sheetDiv.style.background = '#f7f7f7';
  container.appendChild(sheetDiv);

  const width = container.clientWidth || 600;
  const height = 160;

  const renderer = new VF.Renderer(sheetDiv, VF.Renderer.Backends.SVG);
  renderer.resize(width - 20, height);
  const ctx = renderer.getContext();

  const stave = new VF.Stave(10, 10, width - 40);
  stave.addClef('treble').setContext(ctx).draw();

  const vfNotes = notes.map(n =>
    new VF.StaveNote({
      clef: 'treble',
      keys: n.keys,
      duration: n.duration
    })
  );

  const voice = new VF.Voice({
    num_beats: vfNotes.length,
    beat_value: 4
  })
    .setStrict(false)
    .addTickables(vfNotes);

  new VF.Formatter()
    .joinVoices([voice])
    .format([voice], width - 60);

  voice.draw(ctx, stave);

  sheetDiv.insertAdjacentHTML(
    'beforeend',
    `<p style="font-size:0.75em;color:#666;margin-top:0.5em;">
      Preview shows up to 32 notes.
     </p>`
  );
}
