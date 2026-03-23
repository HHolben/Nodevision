// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewMidi.mjs
// This file defines browser-side View Midi logic for the Nodevision UI. It renders interface components and handles user interactions.

import { VexFlow as VF } from '/lib/vexflow/build/esm/entry/vexflow.js';
import { normalizeNotebookRelativePath, toNotebookAssetUrl } from '/utils/notebookPath.mjs';
import { extractNoteOnEventsFromMIDI, extractNoteRangesFromMIDI } from '/utils/midiPreview.mjs';
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { buildStaffEventsFromNoteRanges, buildPolyphonicStaffPlan } from "/utils/midiStaffPreview.mjs";

export async function renderFile(filePath, panel) {
  panel.innerHTML = '';

  const normalizedPath = normalizeNotebookRelativePath(filePath);

  if (
    !normalizedPath ||
    (!normalizedPath.toLowerCase().endsWith('.mid') &&
     !normalizedPath.toLowerCase().endsWith('.midi'))
  ) {
    panel.innerHTML = `<p>No MIDI file selected.</p>`;
    return;
  }

  console.log('ViewMIDI: loading', normalizedPath);

  try {
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.currentMode = "MIDIviewing";
    updateToolbarState({ currentMode: "MIDIviewing" });

    const response = await fetch(toNotebookAssetUrl(normalizedPath), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    let header = { format: 0, tracks: 0, division: 480 };
    let tracks = [];
    let noteRanges = { division: 480, notes: [] };

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

    try {
      noteRanges = extractNoteRangesFromMIDI(buffer, { maxNotes: 200000 });
    } catch (err) {
      console.warn("ViewMIDI note range parse fallback:", err);
      noteRanges = { division: header.division || 480, notes: [] };
    }

    const viewState = renderPianoRoll(noteRanges, panel);
    installPlaybackTools(viewState, noteRanges);
    const renderStaff = () => renderSheet({ buffer, division: header.division, noteRanges, viewState }, panel);
    renderStaff();
    viewState?.onSelectionChanged?.(() => renderStaff());

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
  try {
    const parsed = extractNoteOnEventsFromMIDI(buffer, { maxEvents: 100000 });
    const events = parsed?.events || [];
    if (!events.length) return [{ keys: ['c/4'], duration: 'q' }];

    const chords = [];
    let currentTick = null;
    let current = [];

    const flush = () => {
      if (!current.length) return;
      const uniq = Array.from(new Set(current)).sort((a, b) => a - b);
      chords.push({
        keys: uniq.map(midiToVexKey),
        duration: "8",
      });
      current = [];
    };

    for (const e of events) {
      if (currentTick === null) {
        currentTick = e.tick;
      }
      if (e.tick !== currentTick) {
        flush();
        currentTick = e.tick;
      }
      current.push(e.midi);
    }
    flush();

    return chords.length ? chords : [{ keys: ['c/4'], duration: 'q' }];
  } catch (err) {
    console.warn('extractNotes error:', err);
    return [{ keys: ['c/4'], duration: 'q' }];
  }
}

function midiToVexKey(n) {
  const names = [
    'c','c#','d','d#','e','f','f#','g','g#','a','a#','b'
  ];
  const oct = Math.floor(n / 12) - 1;
  return `${names[n % 12]}/${oct}`;
}

function midiToName(n) {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const oct = Math.floor(n / 12) - 1;
  return `${names[n % 12]}${oct}`;
}

function renderPianoRoll(noteRanges, container) {
  const notes = Array.isArray(noteRanges?.notes) ? noteRanges.notes : [];
  const division = Number(noteRanges?.division) || 480;

  const wrapper = document.createElement("div");
  wrapper.style.marginTop = "1em";
  wrapper.style.border = "1px solid #ddd";
  wrapper.style.padding = "10px";
  wrapper.style.background = "#fff";
  wrapper.innerHTML = "<h3>Piano Roll (accurate)</h3>";
  container.appendChild(wrapper);

  if (!notes.length) {
    wrapper.insertAdjacentHTML("beforeend", "<p>No note events found.</p>");
    return;
  }

  const countsByTrack = new Map();
  for (const n of notes) {
    const t = Number(n.track) || 0;
    countsByTrack.set(t, (countsByTrack.get(t) || 0) + 1);
  }

  const trackIds = Array.from(countsByTrack.keys()).sort((a, b) => a - b);
  const defaultTrack = trackIds.reduce((best, t) => {
    const count = countsByTrack.get(t) || 0;
    return count > (countsByTrack.get(best) || 0) ? t : best;
  }, trackIds[0]);

  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:6px 0 10px 0;";
  wrapper.appendChild(controls);

  const trackLabel = document.createElement("label");
  trackLabel.textContent = "Track:";
  trackLabel.style.cssText = "font:12px monospace;color:#333;";
  controls.appendChild(trackLabel);

  const trackSelect = document.createElement("select");
  trackSelect.style.cssText = "font:12px monospace;";
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = `All (${notes.length})`;
  trackSelect.appendChild(allOpt);
  for (const t of trackIds) {
    const opt = document.createElement("option");
    opt.value = String(t);
    opt.textContent = `Track ${t} (${countsByTrack.get(t)})`;
    trackSelect.appendChild(opt);
  }
  trackSelect.value = String(defaultTrack);
  controls.appendChild(trackSelect);

  const zoomLabel = document.createElement("label");
  zoomLabel.textContent = "Zoom:";
  zoomLabel.style.cssText = "font:12px monospace;color:#333;margin-left:6px;";
  controls.appendChild(zoomLabel);

  const zoom = document.createElement("input");
  zoom.type = "range";
  zoom.min = "5";
  zoom.max = "200";
  zoom.value = "40";
  zoom.style.width = "200px";
  controls.appendChild(zoom);

  const stats = document.createElement("div");
  stats.style.cssText = "font:12px monospace;color:#666;";
  controls.appendChild(stats);

  const scroller = document.createElement("div");
  scroller.style.cssText = "border:1px solid #eee;max-height:520px;overflow:auto;background:#fafafa;";
  wrapper.appendChild(scroller);

  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  scroller.appendChild(canvas);

  const tooltip = document.createElement("div");
  tooltip.style.cssText = "position:absolute;pointer-events:none;display:none;padding:6px 8px;background:rgba(0,0,0,0.85);color:#fff;border-radius:6px;font:12px monospace;z-index:5;";
  wrapper.style.position = "relative";
  wrapper.appendChild(tooltip);

  const colors = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
  ];

  const draw = () => {
    const selection = trackSelect.value;
    const selectedNotes = selection === "all"
      ? notes
      : notes.filter((n) => String(n.track) === selection);

    if (!selectedNotes.length) {
      stats.textContent = "No notes for selection.";
      canvas.width = 1;
      canvas.height = 1;
      return;
    }

    let minMidi = 127;
    let maxMidi = 0;
    let maxTick = 0;
    for (const n of selectedNotes) {
      const midi = Number(n.midi);
      const start = Number(n.startTick) || 0;
      const dur = Number(n.durationTicks) || 1;
      if (Number.isFinite(midi)) {
        minMidi = Math.min(minMidi, midi);
        maxMidi = Math.max(maxMidi, midi);
      }
      maxTick = Math.max(maxTick, start + dur);
    }

    const pxPerBeat = Number(zoom.value) || 40;
    const pxPerTick = pxPerBeat / division;
    const noteHeight = 6;
    const padding = 20;

    const pitchSpan = Math.max(1, (maxMidi - minMidi + 1));
    const width = Math.max(600, Math.ceil(maxTick * pxPerTick) + padding * 2);
    const height = Math.max(160, pitchSpan * noteHeight + padding * 2);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    // Grid: beats + octaves.
    ctx.save();
    ctx.translate(padding, padding);
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, innerW, innerH);

    // Beat lines.
    const beatTicks = division;
    ctx.strokeStyle = "#e6e6e6";
    ctx.lineWidth = 1;
    for (let t = 0; t <= maxTick; t += beatTicks) {
      const x = t * pxPerTick;
      if (x > innerW) break;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, innerH);
      ctx.stroke();
    }

    // Octave lines.
    ctx.strokeStyle = "#f0f0f0";
    for (let midi = minMidi; midi <= maxMidi; midi += 12) {
      const y = (maxMidi - midi) * noteHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(innerW, y);
      ctx.stroke();
    }

    // Notes.
    for (const n of selectedNotes) {
      const midi = Number(n.midi);
      if (!Number.isFinite(midi)) continue;
      const start = Number(n.startTick) || 0;
      const dur = Math.max(1, Number(n.durationTicks) || 1);
      const x = start * pxPerTick;
      const w = Math.max(1, dur * pxPerTick);
      const y = (maxMidi - midi) * noteHeight;
      const track = Number(n.track) || 0;

      ctx.fillStyle = colors[track % colors.length];
      ctx.fillRect(x, y, w, noteHeight - 1);
    }

    // Axis labels.
    ctx.fillStyle = "#666";
    ctx.font = "11px monospace";
    for (let midi = minMidi; midi <= maxMidi; midi += 12) {
      const y = (maxMidi - midi) * noteHeight;
      ctx.fillText(midiToName(midi), 4, y + 10);
    }

    ctx.restore();
    stats.textContent = `Rendering ${selectedNotes.length} notes.`;
  };

  const hitTest = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const selection = trackSelect.value;
    const selectedNotes = selection === "all"
      ? notes
      : notes.filter((n) => String(n.track) === selection);
    if (!selectedNotes.length) return null;

    const pxPerBeat = Number(zoom.value) || 40;
    const pxPerTick = pxPerBeat / division;
    const noteHeight = 6;
    const padding = 20;

    // Recompute bounds for current selection (cheap enough for hover).
    let minMidi = 127;
    let maxMidi = 0;
    for (const n of selectedNotes) {
      const midi = Number(n.midi);
      if (!Number.isFinite(midi)) continue;
      minMidi = Math.min(minMidi, midi);
      maxMidi = Math.max(maxMidi, midi);
    }

    const localX = x - padding;
    const localY = y - padding;
    if (localX < 0 || localY < 0) return null;

    const tick = localX / pxPerTick;
    const midiAtY = maxMidi - Math.floor(localY / noteHeight);

    // Find a note rectangle under cursor (linear scan; OK for hover with early exit).
    for (let i = 0; i < selectedNotes.length; i += 1) {
      const n = selectedNotes[i];
      const midi = Number(n.midi);
      const start = Number(n.startTick) || 0;
      const dur = Math.max(1, Number(n.durationTicks) || 1);
      if (midi !== midiAtY) continue;
      if (tick >= start && tick <= start + dur) return n;
    }
    return null;
  };

  canvas.addEventListener("mousemove", (evt) => {
    const hit = hitTest(evt);
    if (!hit) {
      tooltip.style.display = "none";
      return;
    }

    const rect = canvas.getBoundingClientRect();
    tooltip.style.left = `${evt.clientX - rect.left + 12}px`;
    tooltip.style.top = `${evt.clientY - rect.top + 12}px`;
    tooltip.style.display = "block";
    tooltip.textContent = `Track ${hit.track} ch${hit.channel} ${midiToName(hit.midi)} start=${hit.startTick} dur=${hit.durationTicks}`;
  });
  canvas.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
  });

  trackSelect.addEventListener("change", draw);
  zoom.addEventListener("input", draw);

  // Initial draw.
  // Default selection tries to match common "main" track behavior (avoid meta-only tracks).
  draw();

  return {
    getSelectedTrack: () => trackSelect.value,
    getTempo: () => {
      const bpm = Number(window.NodevisionState?.midiTempoBpm) || 120;
      return Math.max(20, Math.min(400, bpm));
    },
    setTempo: (bpm) => {
      const next = Math.max(20, Math.min(400, Number(bpm) || 120));
      window.NodevisionState = window.NodevisionState || {};
      window.NodevisionState.midiTempoBpm = next;
      updateToolbarState({ midiTempoBpm: next });
    },
    onSelectionChanged: (fn) => {
      trackSelect.addEventListener("change", () => fn?.(trackSelect.value));
    },
  };
}

/* ----------------------------- RENDER SHEET ------------------------------- */

function buildStaffNotesFromRanges(noteRanges, { track = "all", maxEvents = 4000 } = {}) {
  const events = buildStaffEventsFromNoteRanges(noteRanges, { track, maxEvents });
  return events.map((evt) => {
    if (evt.type === "rest") {
      return { keys: ["b/4"], duration: `${evt.duration}r` };
    }
    const keys = (evt.midis || []).map(midiToVexKey);
    return { keys: keys.length ? keys : ["c/4"], duration: evt.duration };
  });
}

function renderSheet({ buffer, division, noteRanges, viewState }, container) {
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
  sheetDiv.innerHTML = '<h3>Staff Preview (polyphonic + ties)</h3>';
  container.appendChild(sheetDiv);

  try {
    const selectedTrack = viewState?.getSelectedTrack?.() ?? "all";
    const hasRanges = Boolean(noteRanges?.notes?.length);

    if (!hasRanges) {
      sheetDiv.insertAdjacentHTML('beforeend', '<p>No note ranges found; falling back to simplified preview.</p>');
    }

    const plan = hasRanges
      ? buildPolyphonicStaffPlan(noteRanges, { track: selectedTrack, maxVoices: 6, maxItemsPerVoice: 5000 })
      : null;

    const notesData = plan?.voices?.length
      ? null
      : extractNotes(buffer);

    if (!plan?.voices?.length && !notesData?.length) {
      sheetDiv.insertAdjacentHTML('beforeend', '<p>No renderable notes found.</p>');
      return;
    }

    const beats = hasRanges ? (Number(plan?.totalTicks || 0) / (Number(plan?.division) || 480)) : 0;
    const pxPerBeat = 60;
    const minWidth = container.clientWidth || 700;
    const targetWidth = Math.max(minWidth, Math.min(24000, Math.ceil(beats * pxPerBeat) + 200));
    const height = 220;

    const rendererDiv = document.createElement('div');
    rendererDiv.id = 'vf-renderer';
    rendererDiv.style.overflowX = "auto";
    rendererDiv.style.overflowY = "hidden";
    sheetDiv.appendChild(rendererDiv);

    const renderer = new VF.Renderer(rendererDiv, VF.Renderer.Backends.SVG);
    renderer.resize(targetWidth - 20, height);
    const ctx = renderer.getContext();
    ctx.setFont('Arial', 10);

    const stave = new VF.Stave(10, 20, targetWidth - 40);
    stave.addClef('treble').setContext(ctx).draw();

    if (plan?.voices?.length) {
      const vfVoices = [];
      const allTies = [];

      for (let voiceIndex = 0; voiceIndex < plan.voices.length; voiceIndex += 1) {
        const voicePlan = plan.voices[voiceIndex];
        const stemDir = (voiceIndex % 2 === 0) ? VF.Stem.UP : VF.Stem.DOWN;

        const tickables = [];
        const noteByItemIndex = [];

        for (const item of voicePlan.items || []) {
          if (item.type === "rest") {
            const n = new VF.StaveNote({
              clef: "treble",
              keys: ["b/4"],
              duration: `${item.duration}r`,
            }).setStemDirection(stemDir);
            tickables.push(n);
            noteByItemIndex.push(null);
            continue;
          }

          const keys = (item.midis || []).map(midiToVexKey);
          const note = new VF.StaveNote({
            clef: "treble",
            keys: keys.length ? keys : ["c/4"],
            duration: item.duration,
          }).setStemDirection(stemDir);

          (keys.length ? keys : ["c/4"]).forEach((k, idx) => {
            if (String(k).includes("#")) {
              note.addModifier(new VF.Accidental("#"), idx);
            }
          });

          tickables.push(note);
          noteByItemIndex.push(note);
        }

        for (const t of voicePlan.ties || []) {
          const first = noteByItemIndex[t.from];
          const last = noteByItemIndex[t.to];
          if (!first || !last) continue;
          const keyCount = Math.max(1, Math.floor(Number(t.keyCount) || 1));
          const indices = Array.from({ length: keyCount }, (_, i) => i);
          allTies.push(new VF.StaveTie({
            first_note: first,
            last_note: last,
            first_indices: indices,
            last_indices: indices,
          }));
        }

        const vfVoice = new VF.Voice({ num_beats: Math.max(1, tickables.length), beat_value: 4 })
          .setStrict(false)
          .addTickables(tickables);
        vfVoices.push(vfVoice);
      }

      new VF.Formatter().joinVoices(vfVoices).formatToStave(vfVoices, stave);
      vfVoices.forEach((v) => v.draw(ctx, stave));
      allTies.forEach((t) => t.setContext(ctx).draw());

      sheetDiv.insertAdjacentHTML(
        'beforeend',
        `<p style="font-size:0.8em;color:#666;margin-top:1em;">Track: ${selectedTrack}. Voices: ${plan.voices.length}. (Quantized + tied)</p>`
      );
    } else {
      // Fallback to simplified (non-polyphonic) preview.
      const vfNotes = notesData.map((n) => {
        const note = new VF.StaveNote({
          clef: 'treble',
          keys: n.keys,
          duration: n.duration,
        });

        const keys = Array.isArray(n.keys) ? n.keys : [];
        keys.forEach((k, idx) => {
          if (String(k).includes("#")) {
            note.addModifier(new VF.Accidental("#"), idx);
          }
        });

        return note;
      });

      const voice = new VF.Voice({ num_beats: Math.max(1, vfNotes.length), beat_value: 4 })
        .setStrict(false)
        .addTickables(vfNotes);

      new VF.Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(ctx, stave);
      sheetDiv.insertAdjacentHTML(
        'beforeend',
        `<p style="font-size:0.8em;color:#666;margin-top:1em;">Fallback preview (no ties/voices).</p>`
      );
    }

  } catch (err) {
    console.error('Error rendering sheet music:', err);
    sheetDiv.insertAdjacentHTML(
      'beforeend',
      `<p style="color:red;">Error rendering sheet music: ${err.message}</p>`
    );
  }
}

function installPlaybackTools(viewState, noteRanges) {
  const notes = Array.isArray(noteRanges?.notes) ? noteRanges.notes : [];
  const division = Number(noteRanges?.division) || 480;

  const toHz = (midi) => 440 * Math.pow(2, (Number(midi) - 69) / 12);

  let audioCtx = null;
  let scheduled = [];
  let playing = false;

  const stopAll = () => {
    for (const entry of scheduled) {
      try {
        entry.gain.gain.cancelScheduledValues(0);
        entry.osc.stop();
      } catch {}
    }
    scheduled = [];
    playing = false;
  };

  const schedule = () => {
    stopAll();
    if (!notes.length) return;

    const selection = viewState?.getSelectedTrack?.() ?? "all";
    const selectedNotes = selection === "all"
      ? notes
      : notes.filter((n) => String(n.track) === String(selection));
    if (!selectedNotes.length) return;

    const bpm = viewState?.getTempo?.() ?? 120;
    const secPerTick = 60 / (bpm * division);

    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime + 0.02;

    const MAX_SCHEDULE_NOTES = 2000;
    const windowSeconds = 45;

    let scheduledCount = 0;
    for (const n of selectedNotes) {
      if (scheduledCount >= MAX_SCHEDULE_NOTES) break;
      const start = Number(n.startTick) || 0;
      const dur = Math.max(1, Number(n.durationTicks) || 1);
      const startSec = start * secPerTick;
      const endSec = (start + dur) * secPerTick;
      if (startSec > windowSeconds) break;

      const osc = audioCtx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = toHz(n.midi);
      const gain = audioCtx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(audioCtx.destination);

      const t0 = now + startSec;
      const t1 = now + endSec;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.06, t0 + 0.01);
      gain.gain.linearRampToValueAtTime(0.0, Math.max(t0 + 0.02, t1 - 0.01));

      osc.start(t0);
      osc.stop(t1 + 0.02);

      scheduled.push({ osc, gain });
      scheduledCount += 1;
    }

    playing = true;
  };

  window.NodevisionMIDITools = {
    play: () => {
      try {
        schedule();
      } catch (err) {
        console.warn("[ViewMIDI] play failed:", err);
      }
    },
    pause: () => {
      stopAll();
    },
    stop: () => {
      stopAll();
    },
    setTempo: (bpm) => viewState?.setTempo?.(bpm),
    getTempo: () => viewState?.getTempo?.() ?? 120,
    status: () => ({ playing }),
  };

  // Keep toolbar tempo input in sync with global state if other panels update it.
  window.NodevisionState = window.NodevisionState || {};
  if (!Number.isFinite(Number(window.NodevisionState.midiTempoBpm))) {
    window.NodevisionState.midiTempoBpm = 120;
  }
  updateToolbarState({ midiTempoBpm: window.NodevisionState.midiTempoBpm });

  // Changing track selection while playing should restart (simple behavior).
  viewState?.onSelectionChanged?.(() => {
    if (playing) schedule();
  });
}
