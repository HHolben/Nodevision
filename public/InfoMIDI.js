// === InfoMIDI.js ===
// Browser version—no fs, uses fetch + DataView

/**
 * Fetches and parses a MIDI file, then renders summary info into an HTML panel.
 *
 * @param {string} filename    - e.g. 'song.mid'
 * @param {HTMLElement} infoPanel
 * @param {string} serverBase  - base URL where .mid lives
 */
function renderMIDI(filename, infoPanel, serverBase) {
    fetch(serverBase + '/' + filename)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not OK');
        }
        return response.arrayBuffer();  // get ArrayBuffer of the file :contentReference[oaicite:2]{index=2}
      })
      .then(buffer => {
        const view = new DataView(buffer);  // big-endian safe reads :contentReference[oaicite:3]{index=3}
        let offset = 0;
  
        // Read four‐character code
        function readFourCC() {
          let s = '';
          for (let i = 0; i < 4; i++) {
            s += String.fromCharCode(view.getUint8(offset++));
          }
          return s;
        }
  
        // Read 32‐bit BE int
        function readUint32() {
          const v = view.getUint32(offset, false); // false = big-endian
          offset += 4;
          return v;
        }
  
        // Read 16‐bit BE int
        function readUint16() {
          const v = view.getUint16(offset, false);
          offset += 2;
          return v;
        }
  
        // --- Parse Header Chunk ---
        const hdrId = readFourCC();
        if (hdrId !== 'MThd') {
          throw new Error('Invalid MIDI: missing MThd');
        }
        const hdrLen   = readUint32();
        const format   = readUint16();
        const numTracks= readUint16();
        const division = readUint16();
        // skip any extra header bytes
        offset += (hdrLen - 6);
  
        // --- Parse Tracks ---
        const tracks = [];
        for (let i = 0; i < numTracks; i++) {
          const id = readFourCC();
          if (id !== 'MTrk') {
            throw new Error(`Invalid MIDI: missing MTrk at track ${i}`);
          }
          const length = readUint32();
          const trackOffset = offset;
          tracks.push({ index: i+1, offset: trackOffset, length });
          offset += length;
        }
  
        // --- Render HTML ---
        let html = `<p><strong>Format:</strong> ${format}</p>`;
        html += `<p><strong>Tracks:</strong> ${numTracks}</p>`;
        html += `<p><strong>Division:</strong> ${division} ticks/quarter</p>`;
        html += `<table style="border-collapse:collapse;"><thead>
                   <tr><th style="border:1px solid #ccc;padding:2px">#</th>
                       <th style="border:1px solid #ccc;padding:2px">Offset</th>
                       <th style="border:1px solid #ccc;padding:2px">Length</th></tr>
                 </thead><tbody>`;
        tracks.forEach(t => {
          html += `<tr><td style="border:1px solid #ccc;padding:2px">${t.index}</td>
                       <td style="border:1px solid #ccc;padding:2px">${t.offset}</td>
                       <td style="border:1px solid #ccc;padding:2px">${t.length}</td></tr>`;
        });
        html += `</tbody></table>`;
  
        infoPanel.innerHTML = html;
      })
      .catch(err => {
        console.error('Error loading MIDI:', err);
        infoPanel.innerHTML = '<p>Error loading MIDI file.</p>';
      });
  }
  
  // Expose globally if you like
  window.renderMIDI = renderMIDI;
  