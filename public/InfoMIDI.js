// === InfoMIDI.js ===
// Purpose: TODO: Add description of module purpose
// Browser version—no fs, uses fetch + DataView + VexFlow

/**
 * Fetches, parses, and renders MIDI info and sheet music in the browser.
 * @param {string} filename - e.g. 'song.mid'
 * @param {HTMLElement} infoPanel
 * @param {string} serverBase - base URL where .mid lives
 */
function renderMIDI(filename, infoPanel, serverBase) {
  // Check if we need to wait for VexFlow to load
  ensureVexFlowLoaded()
    .then(() => {
      return fetch(`${serverBase}/${filename}`);
    })
    .then(response => {
      if (!response.ok) throw new Error('Network response was not OK');
      return response.arrayBuffer();
    })
    .then(buffer => {
      const { header, tracks } = parseMIDI(buffer);
      renderInfoTable(header, tracks, infoPanel);
      renderSheet(buffer, header.division, infoPanel);
    })
    .catch(err => {
      console.error('Error loading MIDI:', err);
      infoPanel.innerHTML = '<p>Error loading MIDI file: ' + err.message + '</p>';
    });
}

/**
 * Ensures VexFlow is loaded before proceeding
 * @returns {Promise} - Resolves when VexFlow is available
 */
function ensureVexFlowLoaded() {
  return new Promise((resolve, reject) => {
    // Check if VexFlow is already loaded
    if (window.VF || (window.Vex && window.Vex.Flow) || window.VexFlow) {
      return resolve();
    }

    // If not loaded but the script tag exists, wait for it to load
    const existingScript = document.querySelector('script[src*="vexflow"]');
    if (existingScript) {
      existingScript.onload = () => resolve();
      existingScript.onerror = () => reject(new Error('VexFlow script failed to load'));
      return;
    }

    // If no script tag exists, add one
    const script = document.createElement('script');

    script.src = 'https://unpkg.com/vexflow/releases/vexflow-min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('VexFlow script failed to load'));
    document.head.appendChild(script);
  });
}

/** Parse MIDI ArrayBuffer into header and track summaries */
function parseMIDI(buffer) {
  const view = new DataView(buffer);
  let offset = 0;
  function readFourCC() { let s=''; for(let i=0;i<4;i++) s+=String.fromCharCode(view.getUint8(offset++)); return s; }
  function readUint32() { const v=view.getUint32(offset,false); offset+=4; return v; }
  function readUint16() { const v=view.getUint16(offset,false); offset+=2; return v; }

  const id = readFourCC(); 
  if(id !== 'MThd') throw new Error('Invalid MIDI: missing MThd');
  
  const hdrLen = readUint32();
  const format = readUint16();
  const numTracks = readUint16();
  const division = readUint16();
  offset += (hdrLen - 6);

  const tracks = [];
  for(let i=0; i<numTracks; i++){
    const tid = readFourCC(); 
    if(tid !== 'MTrk') throw new Error(`Invalid MIDI: missing MTrk at track ${i}`);
    
    const length = readUint32();
    tracks.push({ index: i+1, offset, length });
    offset += length;
  }
  return { header:{ format, tracks: numTracks, division }, tracks };
}

/** Render header & track summary table */
function renderInfoTable(header, tracks, container) {
  let html = `<h3>MIDI File Information</h3>`;
  html += `<p><strong>Format:</strong> ${header.format}</p>`;
  html += `<p><strong>Tracks:</strong> ${header.tracks}</p>`;
  html += `<p><strong>Division:</strong> ${header.division} ticks/quarter</p>`;
  html += `<table style="border-collapse:collapse;"><thead><tr>`+
          `<th style="border:1px solid #ccc;padding:5px">Track #</th>`+
          `<th style="border:1px solid #ccc;padding:5px">Offset</th>`+
          `<th style="border:1px solid #ccc;padding:5px">Length</th>`+
          `</tr></thead><tbody>`;
  tracks.forEach(t=>{
    html += `<tr><td style="border:1px solid #ccc;padding:5px">${t.index}</td>`+
            `<td style="border:1px solid #ccc;padding:5px">${t.offset}</td>`+
            `<td style="border:1px solid #ccc;padding:5px">${t.length}</td></tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

/** Extract simple quarter-note events (Note On/Off) */
function extractNotes(buffer, division) {
  const view = new DataView(buffer);
  let pos = 14; // after header + first track header
  const notes = [];
  
  try {
    while(pos < buffer.byteLength) {
      // skip delta-time parsing for simplicity (assume fixed division)
      // read status
      const status = view.getUint8(pos++);
      if((status & 0xF0) === 0x90) {
        const noteNum = view.getUint8(pos++);
        const vel = view.getUint8(pos++);
        if (vel > 0) { // Only add notes with velocity > 0 (actual note-on)
          notes.push({ keys:[midiToVexKey(noteNum)], duration:'q' });
        }
      } else {
        // skip unknown event: advance one byte
        pos++;
      }
      if(status === 0xFF || notes.length >= 20) break; // Limit notes or break on meta event
    }
  } catch (e) {
    console.warn('Error extracting notes, displaying partial results:', e);
  }
  
  return notes.length > 0 ? notes : [{ keys:['c/4'], duration:'q' }]; // Fallback if no notes found
}

function midiToVexKey(n) { 
  const oct = Math.floor(n/12)-1; 
  const names=['c','c#','d','d#','e','f','f#','g','g#','a','a#','b']; 
  return `${names[n%12]}/${oct}`; 
}

/** Render or update VexFlow sheet music inside container */
function renderSheet(buffer, division, container) {
  // Get the VexFlow object - try different ways it might be available
  const VF = window.VF || (window.Vex && window.Vex.Flow) || window.VexFlow;
  if (!VF) {
    console.error("VexFlow not found in global scope");
    container.innerHTML += 
      '<p style="color:red;">Error: VexFlow library not loaded. ' +
      'Please ensure VexFlow is properly included in your HTML.</p>';
    return;
  }

  // Remove old sheetPanel if present
  const old = document.getElementById('sheetPanel');
  if (old) old.remove();

  // Create new container
  const sheetDiv = document.createElement('div');
  sheetDiv.id = 'sheetPanel';
  sheetDiv.style.marginTop = '1em';
  sheetDiv.style.border = '1px solid #ddd';
  sheetDiv.style.padding = '10px';
  sheetDiv.style.backgroundColor = '#f7f7f7';
  sheetDiv.innerHTML = '<h3>MIDI Preview</h3>';
  container.appendChild(sheetDiv);

  try {
    // Extract note data
    const notesData = extractNotes(buffer, division);
    
    // Only proceed if we have notes
    if (notesData.length === 0) {
      sheetDiv.innerHTML += '<p>No renderable notes found in this MIDI file.</p>';
      return;
    }

    // Size canvas responsively
    const width = Math.min(container.clientWidth - 40, 800);
    const height = Math.min(notesData.length * 25 + 80, 200);

    // Create renderer container
    const rendererDiv = document.createElement('div');
    rendererDiv.id = 'vf-renderer';
    sheetDiv.appendChild(rendererDiv);

    // Initialize VexFlow renderer
    const renderer = new VF.Renderer(rendererDiv, VF.Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();
    ctx.setFont('Arial', 10);
    
    // Create stave
    const stave = new VF.Stave(10, 10, width - 20);
    stave.addClef('treble').setContext(ctx).draw();

    // Build and draw notes (max 16 notes to avoid crowding)
    const vfNotes = notesData.slice(0, 16).map(n => 
      new VF.StaveNote({ clef: 'treble', keys: n.keys, duration: n.duration })
    );
    
    // Create voice and formatter
    const voice = new VF.Voice({ num_beats: vfNotes.length, beat_value: 4 })
                  .setStrict(false)
                  .addTickables(vfNotes);
    
    new VF.Formatter().joinVoices([voice]).format([voice], width - 50);
    voice.draw(ctx, stave);
    
    // Add note about simplification
    sheetDiv.innerHTML += '<p style="font-size: 0.8em; color: #666; margin-top: 1em;">Note: This is a simplified preview showing at most 16 notes.</p>';
    
  } catch (err) {
    console.error('Error rendering sheet music:', err);
    sheetDiv.innerHTML += '<p style="color:red;">Error rendering sheet music: ' + err.message + '</p>';
  }
}

// Expose globally
window.renderMIDI = renderMIDI;