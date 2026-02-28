// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewAIFF.mjs
// Purpose: Display and play AIFF (.aif, .aiff) audio files with metadata and waveform preview

export async function renderFile(filePath, panel) {
  const serverBase = '/Notebook';
  panel.innerHTML = '';

  if (
    !filePath ||
    (!filePath.toLowerCase().endsWith('.aif') &&
     !filePath.toLowerCase().endsWith('.aiff'))
  ) {
    panel.innerHTML = `<p>No AIFF file selected.</p>`;
    return;
  }

  console.log('[ViewAIFF] loading', filePath);

  try {
    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const info = parseAIFF(buffer);

    renderInfo(info, panel);
    renderPlayer(`${serverBase}/${filePath}`, panel);
    renderWaveform(buffer, panel);

  } catch (err) {
    console.error('[ViewAIFF] Error:', err);
    panel.innerHTML = `<p style="color:red;">Error loading AIFF file: ${err.message}</p>`;
  }
}

/* ------------------------------ AIFF PARSER ------------------------------ */

function parseAIFF(buffer) {
  const view = new DataView(buffer);
  let offset = 0;

  const readFourCC = () =>
    String.fromCharCode(
      view.getUint8(offset++),
      view.getUint8(offset++),
      view.getUint8(offset++),
      view.getUint8(offset++)
    );

  const readUint16 = () => (offset += 2, view.getUint16(offset - 2, false));
  const readUint32 = () => (offset += 4, view.getUint32(offset - 4, false));

  if (readFourCC() !== 'FORM') throw new Error('Not an AIFF file');
  readUint32(); // file size
  const formType = readFourCC();
  if (formType !== 'AIFF') throw new Error('Unsupported AIFF variant');

  let channels = 0;
  let frames = 0;
  let bits = 0;
  let sampleRate = 0;

  while (offset < buffer.byteLength) {
    const chunkID = readFourCC();
    const chunkSize = readUint32();

    if (chunkID === 'COMM') {
      channels = readUint16();
      frames = readUint32();
      bits = readUint16();
      sampleRate = readExtended80(view, offset);
    }

    offset += chunkSize + (chunkSize % 2);
  }

  const duration = frames && sampleRate
    ? (frames / sampleRate).toFixed(2)
    : 'Unknown';

  return {
    channels,
    frames,
    bits,
    sampleRate,
    duration
  };
}

/* ----------- AIFF 80-bit extended float (sample rate) ----------- */

function readExtended80(view, offset) {
  const expon = view.getInt16(offset, false);
  const hiMant = view.getUint32(offset + 2, false);
  const loMant = view.getUint32(offset + 6, false);

  if (expon === 0 && hiMant === 0 && loMant === 0) return 0;

  const exp = expon - 16383;
  const mant = hiMant * Math.pow(2, -31) + loMant * Math.pow(2, -63);
  return Math.round(Math.pow(2, exp) * (1 + mant));
}

/* ------------------------------ RENDERING ------------------------------ */

function renderInfo(info, container) {
  container.insertAdjacentHTML(
    'beforeend',
    `
    <h3>AIFF Audio Information</h3>
    <table style="border-collapse:collapse;">
      <tbody>
        <tr><td style="border:1px solid #ccc;padding:4px;">Channels</td><td style="border:1px solid #ccc;padding:4px;">${info.channels}</td></tr>
        <tr><td style="border:1px solid #ccc;padding:4px;">Sample Rate</td><td style="border:1px solid #ccc;padding:4px;">${info.sampleRate} Hz</td></tr>
        <tr><td style="border:1px solid #ccc;padding:4px;">Bit Depth</td><td style="border:1px solid #ccc;padding:4px;">${info.bits}</td></tr>
        <tr><td style="border:1px solid #ccc;padding:4px;">Frames</td><td style="border:1px solid #ccc;padding:4px;">${info.frames}</td></tr>
        <tr><td style="border:1px solid #ccc;padding:4px;">Duration</td><td style="border:1px solid #ccc;padding:4px;">${info.duration} s</td></tr>
      </tbody>
    </table>
    `
  );
}

function renderPlayer(src, container) {
  const audio = document.createElement('audio');
  audio.src = src;
  audio.controls = true;
  audio.style.display = 'block';
  audio.style.marginTop = '10px';
  container.appendChild(audio);
}

/* --------------------------- WAVEFORM PREVIEW --------------------------- */

function renderWaveform(buffer, container) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 120;
  canvas.style.border = '1px solid #ccc';
  canvas.style.marginTop = '10px';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const view = new DataView(buffer);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();

  let x = 0;
  for (let i = 0; i < buffer.byteLength; i += 4000) {
    const sample = view.getInt16(i, false) || 0;
    const y = canvas.height / 2 - (sample / 32768) * (canvas.height / 2);
    ctx.lineTo(x++, y);
    if (x >= canvas.width) break;
  }

  ctx.strokeStyle = '#0074D9';
  ctx.lineWidth = 1;
  ctx.stroke();
}
