// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/MIDIeditor.mjs
// Graphical MIDI editor (staff view) with note/rest insertion, selection,
// delete-to-rest, and vertical drag pitch editing.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { VexFlow as VF } from "/lib/vexflow/build/esm/entry/vexflow.js";

let currentMidiBuffer = null;
let currentFilePath = null;
let currentNotesData = []; // [{ midi: number|null, duration: 'q', rest: boolean }]
let selectedNoteIndex = -1;

let midiRoot = null;
let rendererDiv = null;
let statusDiv = null;

let renderedNotes = [];
let renderedNoteXs = [];
let activeStave = null;
let dragState = null;
let selectedElementType = null; // "note" | "rest" | "cleff" | null
let currentClef = "treble";
let pendingDragMidi = null;
let dragRenderFrame = null;

let keydownHandler = null;
let resizeHandler = null;

const NOTE_NAMES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const DURATION_VALUES = new Set(["w", "h", "q", "8"]);
const MIDI_TICKS_PER_QUARTER = 480;
const DURATION_TO_TICKS = {
  w: MIDI_TICKS_PER_QUARTER * 4,
  h: MIDI_TICKS_PER_QUARTER * 2,
  q: MIDI_TICKS_PER_QUARTER,
  "8": Math.floor(MIDI_TICKS_PER_QUARTER / 2),
};

function midiToVexKey(midi) {
  const n = Math.max(0, Math.min(127, Math.round(midi)));
  const name = NOTE_NAMES[n % 12];
  const oct = Math.floor(n / 12) - 1;
  return `${name}/${oct}`;
}

function midiFromY(baseMidi, deltaY) {
  // ~6px per semitone keeps dragging stable while still responsive.
  const deltaSemitones = Math.round((-deltaY) / 6);
  return Math.max(24, Math.min(96, baseMidi + deltaSemitones));
}

function extractNotesForEditor(buffer) {
  const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
  let pos = 14;
  const notes = [];

  try {
    if (bytes.length < 4) return [{ midi: 60, duration: "q", rest: false }];
    if (pos >= bytes.length) pos = 0;

    while (pos < bytes.length && notes.length < 48) {
      const status = bytes[pos++];
      if (status === undefined) break;

      if ((status & 0xf0) === 0x90) {
        const midi = bytes[pos++];
        const vel = bytes[pos++];
        if (midi === undefined || vel === undefined) break;
        if (vel > 0) notes.push({ midi, duration: "q", rest: false });
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
    console.warn("extractNotesForEditor error:", err);
  }

  return notes.length ? notes : [{ midi: 60, duration: "q", rest: false }];
}

function clearRenderEventHandlers() {
  if (!rendererDiv) return;
  rendererDiv.onpointerdown = null;
  rendererDiv.onpointermove = null;
  rendererDiv.onpointerup = null;
  rendererDiv.onpointerleave = null;
}

function closestRenderedIndexFromX(x) {
  if (!renderedNoteXs.length) return -1;
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < renderedNoteXs.length; i += 1) {
    const d = Math.abs(renderedNoteXs[i] - x);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestDist <= 24 ? bestIdx : -1;
}

function scheduleDragRender() {
  if (dragRenderFrame !== null) return;
  dragRenderFrame = window.requestAnimationFrame(() => {
    dragRenderFrame = null;
    renderSheetMusic();
    if (pendingDragMidi !== null && statusDiv) {
      statusDiv.innerHTML = `<p style=\"color:#333;\">Selected note moved to ${midiToVexKey(pendingDragMidi)}.</p>`;
      pendingDragMidi = null;
    }
  });
}

function renderSheetMusic() {
  if (!rendererDiv || !midiRoot || !currentNotesData.length) return;

  rendererDiv.innerHTML = "";
  renderedNotes = [];
  renderedNoteXs = [];
  activeStave = null;

  const width = Math.max(640, midiRoot.clientWidth || 800);
  const height = 220;

  const renderer = new VF.Renderer(rendererDiv, VF.Renderer.Backends.SVG);
  renderer.resize(width - 20, height);
  const ctx = renderer.getContext();
  ctx.setFont("Arial", 10);

  const stave = new VF.Stave(10, 20, width - 40);
  stave.addClef(currentClef || "treble").setContext(ctx).draw();
  activeStave = stave;

  const maxRenderable = Math.min(40, currentNotesData.length);
  const notesForRender = currentNotesData.slice(0, maxRenderable).map((n, idx) => {
    if (n.rest) {
      const restNote = new VF.StaveNote({
        clef: "treble",
        keys: ["b/4"],
        duration: `${n.duration}r`,
      });
      if (idx === selectedNoteIndex) {
        restNote.setStyle({ fillStyle: "#ff8c00", strokeStyle: "#ff8c00" });
      }
      return restNote;
    }

    const key = midiToVexKey(Number.isFinite(n.midi) ? n.midi : 60);
    const staveNote = new VF.StaveNote({
      clef: "treble",
      keys: [key],
      duration: n.duration,
    });

    if (key.includes("#")) {
      staveNote.addModifier(new VF.Accidental("#"), 0);
    }
    if (idx === selectedNoteIndex) {
      staveNote.setStyle({ fillStyle: "#ff8c00", strokeStyle: "#ff8c00" });
    }
    return staveNote;
  });

  const voice = new VF.Voice({ num_beats: notesForRender.length, beat_value: 4 })
    .setStrict(false)
    .addTickables(notesForRender);

  new VF.Formatter().joinVoices([voice]).format([voice], width - 60);
  voice.draw(ctx, stave);

  renderedNotes = notesForRender;
  renderedNoteXs = notesForRender.map((n) => Number(n.getAbsoluteX?.() || 0));

  clearRenderEventHandlers();

  rendererDiv.onpointerdown = (event) => {
    const svgRect = rendererDiv.getBoundingClientRect();
    const localX = event.clientX - svgRect.left;
    const idx = closestRenderedIndexFromX(localX);

    // Note hit-testing has priority so dragging notes near the clef still works.
    if (idx < 0 && localX <= 72) {
      selectedNoteIndex = -1;
      selectedElementType = "cleff";
      dragState = null;
      renderSheetMusic();
      syncMIDIToolbarState();
      return;
    }
    if (idx < 0) return;

    selectedNoteIndex = idx;
    const selected = currentNotesData[idx];
    selectedElementType = selected ? (selected.rest ? "rest" : "note") : null;

    if (selected && !selected.rest && Number.isFinite(selected.midi)) {
      dragState = {
        index: idx,
        startY: event.clientY,
        startMidi: selected.midi,
      };
      if (rendererDiv.setPointerCapture && Number.isFinite(event.pointerId)) {
        rendererDiv.setPointerCapture(event.pointerId);
      }
    } else {
      dragState = null;
    }

    renderSheetMusic();
    syncMIDIToolbarState();
  };

  rendererDiv.onpointermove = (event) => {
    if (!dragState) return;
    const note = currentNotesData[dragState.index];
    if (!note || note.rest) return;

    const newMidi = midiFromY(dragState.startMidi, event.clientY - dragState.startY);
    if (newMidi !== note.midi) {
      note.midi = newMidi;
      pendingDragMidi = newMidi;
      scheduleDragRender();
    }
  };

  rendererDiv.onpointerup = () => {
    if (dragRenderFrame !== null) {
      window.cancelAnimationFrame(dragRenderFrame);
      dragRenderFrame = null;
      renderSheetMusic();
      if (pendingDragMidi !== null && statusDiv) {
        statusDiv.innerHTML = `<p style=\"color:#333;\">Selected note moved to ${midiToVexKey(pendingDragMidi)}.</p>`;
      }
      pendingDragMidi = null;
    }
    dragState = null;
  };

  rendererDiv.onpointerleave = () => {
    if (dragRenderFrame !== null) {
      window.cancelAnimationFrame(dragRenderFrame);
      dragRenderFrame = null;
      renderSheetMusic();
      if (pendingDragMidi !== null && statusDiv) {
        statusDiv.innerHTML = `<p style=\"color:#333;\">Selected note moved to ${midiToVexKey(pendingDragMidi)}.</p>`;
      }
      pendingDragMidi = null;
    }
    dragState = null;
  };
}

function insertNote() {
  const baseMidi = selectedNoteIndex >= 0 && currentNotesData[selectedNoteIndex] && !currentNotesData[selectedNoteIndex].rest
    ? currentNotesData[selectedNoteIndex].midi
    : 60;

  const entry = { midi: Number.isFinite(baseMidi) ? baseMidi : 60, duration: "q", rest: false };

  if (selectedNoteIndex >= 0) {
    currentNotesData.splice(selectedNoteIndex + 1, 0, entry);
    selectedNoteIndex += 1;
  } else {
    currentNotesData.push(entry);
    selectedNoteIndex = currentNotesData.length - 1;
  }
  selectedElementType = "note";

  renderSheetMusic();
  syncMIDIToolbarState();
}

function insertRest() {
  const baseDuration = selectedNoteIndex >= 0 && currentNotesData[selectedNoteIndex]
    ? currentNotesData[selectedNoteIndex].duration
    : "q";
  const entry = { midi: null, duration: DURATION_VALUES.has(baseDuration) ? baseDuration : "q", rest: true };

  if (selectedNoteIndex >= 0) {
    currentNotesData.splice(selectedNoteIndex + 1, 0, entry);
    selectedNoteIndex += 1;
  } else {
    currentNotesData.push(entry);
    selectedNoteIndex = currentNotesData.length - 1;
  }
  selectedElementType = "rest";

  renderSheetMusic();
  syncMIDIToolbarState();
}

function replaceSelectedWithRest() {
  if (selectedNoteIndex < 0 || selectedNoteIndex >= currentNotesData.length) return;
  const existing = currentNotesData[selectedNoteIndex];
  const duration = DURATION_VALUES.has(existing?.duration) ? existing.duration : "q";
  currentNotesData[selectedNoteIndex] = { midi: null, duration, rest: true };
  selectedElementType = "rest";
  renderSheetMusic();
  syncMIDIToolbarState();
}

function setSelectedDuration(duration) {
  if (!DURATION_VALUES.has(duration)) return;
  if (selectedNoteIndex < 0 || selectedNoteIndex >= currentNotesData.length) return;
  const existing = currentNotesData[selectedNoteIndex];
  if (!existing) return;
  existing.duration = duration;
  renderSheetMusic();
  syncMIDIToolbarState();
}

function setClef(nextClef) {
  const allowed = new Set(["treble", "bass", "alto", "tenor"]);
  if (!allowed.has(nextClef)) return;
  currentClef = nextClef;
  selectedElementType = "cleff";
  selectedNoteIndex = -1;
  renderSheetMusic();
  syncMIDIToolbarState();
}

function handleMIDIAction(callbackKey) {
  if (!callbackKey) return;
  if (callbackKey === "midiInsertNote") {
    insertNote();
    return;
  }
  if (callbackKey === "midiInsertRest") {
    insertRest();
    return;
  }
  if (callbackKey === "midiDurationWhole") {
    setSelectedDuration("w");
    return;
  }
  if (callbackKey === "midiDurationHalf") {
    setSelectedDuration("h");
    return;
  }
  if (callbackKey === "midiDurationQuarter") {
    setSelectedDuration("q");
    return;
  }
  if (callbackKey === "midiDurationEighth") {
    setSelectedDuration("8");
    return;
  }
  if (callbackKey === "midiCleffTreble") {
    setClef("treble");
    return;
  }
  if (callbackKey === "midiCleffBass") {
    setClef("bass");
    return;
  }
  if (callbackKey === "midiCleffAlto") {
    setClef("alto");
    return;
  }
  if (callbackKey === "midiCleffTenor") {
    setClef("tenor");
  }
}

function syncMIDIToolbarState() {
  const selected = selectedNoteIndex >= 0 ? currentNotesData[selectedNoteIndex] : null;
  const selectedType = selectedElementType || (selected ? (selected.rest ? "rest" : "note") : null);
  updateToolbarState({
    currentMode: "MIDIediting",
    activeActionHandler: handleMIDIAction,
    midiHasSelection: Boolean(selectedType),
    midiSelectedType: selectedType,
  });
}

function registerMIDIHotkeys(filePath) {
  if (keydownHandler) {
    document.removeEventListener("keydown", keydownHandler);
  }

  keydownHandler = (e) => {
    const key = String(e.key || "").toLowerCase();

    if ((e.ctrlKey || e.metaKey) && key === "s") {
      e.preventDefault();
      if (window.saveMIDIFile) {
        window.saveMIDIFile(filePath);
      }
      return;
    }

    if (key === "delete" || key === "backspace") {
      if (selectedNoteIndex >= 0) {
        e.preventDefault();
        replaceSelectedWithRest();
      }
    }
  };

  document.addEventListener("keydown", keydownHandler);
}

window.getEditorMIDI = () => {
  const track = [];

  const push = (...bytes) => {
    for (const b of bytes) track.push(b & 0xff);
  };

  const pushVlq = (value) => {
    let v = Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
    const bytes = [v & 0x7f];
    v >>= 7;
    while (v > 0) {
      bytes.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    push(...bytes);
  };

  const durationToTicks = (duration) => {
    if (!duration) return DURATION_TO_TICKS.q;
    return DURATION_TO_TICKS[duration] || DURATION_TO_TICKS.q;
  };

  // Meta: tempo (120 BPM), time signature (4/4), program change (acoustic grand).
  pushVlq(0); push(0xff, 0x51, 0x03, 0x07, 0xa1, 0x20);
  pushVlq(0); push(0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);
  pushVlq(0); push(0xc0, 0x00);

  let pendingDelta = 0;
  const notes = Array.isArray(currentNotesData) ? currentNotesData : [];
  for (const entry of notes) {
    const ticks = Math.max(1, durationToTicks(entry?.duration));
    if (entry?.rest || !Number.isFinite(entry?.midi)) {
      pendingDelta += ticks;
      continue;
    }

    const midi = Math.max(0, Math.min(127, Math.round(entry.midi)));
    pushVlq(pendingDelta);
    push(0x90, midi, 0x64);
    pushVlq(ticks);
    push(0x80, midi, 0x40);
    pendingDelta = 0;
  }

  // Apply trailing rest before End Of Track.
  pushVlq(pendingDelta);
  push(0xff, 0x2f, 0x00);

  const trackLength = track.length;
  const totalLength = 14 + 8 + trackLength;
  const out = new Uint8Array(totalLength);
  let pos = 0;

  // Header chunk: MThd, len=6, format=0, ntrks=1, division=480.
  out.set([0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01], pos); pos += 12;
  out[pos++] = (MIDI_TICKS_PER_QUARTER >> 8) & 0xff;
  out[pos++] = MIDI_TICKS_PER_QUARTER & 0xff;

  // Track chunk: MTrk + length + event bytes.
  out.set([0x4d, 0x54, 0x72, 0x6b], pos); pos += 4;
  out[pos++] = (trackLength >>> 24) & 0xff;
  out[pos++] = (trackLength >>> 16) & 0xff;
  out[pos++] = (trackLength >>> 8) & 0xff;
  out[pos++] = trackLength & 0xff;
  out.set(track, pos);

  return out.buffer;
};

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

window.saveMIDIFile = async (path) => {
  const targetPath = path || currentFilePath || window.currentActiveFilePath || window.selectedFilePath;
  if (!targetPath) throw new Error("Failed to save MIDI file: no target path.");

  const midiContent = window.getEditorMIDI();
  if (!(midiContent instanceof ArrayBuffer)) {
    throw new Error("Failed to save MIDI file: editor content is missing.");
  }

  const base64 = arrayBufferToBase64(midiContent);
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: targetPath,
      content: base64,
      encoding: "base64",
      mimeType: "audio/midi",
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || "Failed to save MIDI file.");
  }
  console.log("Saved MIDI file:", targetPath);
};

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";
  currentFilePath = filePath;
  selectedNoteIndex = -1;
  dragState = null;
  selectedElementType = null;
  currentClef = "treble";

  window.NodevisionState.currentMode = "MIDIediting";
  window.NodevisionState.activeActionHandler = handleMIDIAction;
  syncMIDIToolbarState();

  const wrapper = document.createElement("div");
  wrapper.id = "midi-editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  container.appendChild(wrapper);
  midiRoot = wrapper;

  const controls = document.createElement("div");
  controls.style.cssText = "height:56px;border-bottom:1px solid #ccc;padding:8px;display:flex;gap:8px;align-items:center;";
  wrapper.appendChild(controls);

  const insertNoteBtn = document.createElement("button");
  insertNoteBtn.type = "button";
  insertNoteBtn.textContent = "Insert Note";
  insertNoteBtn.addEventListener("click", insertNote);
  controls.appendChild(insertNoteBtn);

  const insertRestBtn = document.createElement("button");
  insertRestBtn.type = "button";
  insertRestBtn.textContent = "Insert Rest";
  insertRestBtn.addEventListener("click", insertRest);
  controls.appendChild(insertRestBtn);

  const controlsHint = document.createElement("div");
  controlsHint.style.cssText = "font:12px monospace;color:#555;";
  controlsHint.textContent = "Click note to select, Delete/Backspace to turn selected note into a rest, drag selected note up/down to change pitch.";
  controls.appendChild(controlsHint);

  const editorArea = document.createElement("div");
  editorArea.id = "midi-editing-area";
  editorArea.style.flex = "1";
  editorArea.style.overflow = "auto";
  editorArea.style.padding = "12px";
  wrapper.appendChild(editorArea);

  rendererDiv = document.createElement("div");
  rendererDiv.id = "vf-renderer";
  editorArea.appendChild(rendererDiv);

  statusDiv = document.createElement("div");
  statusDiv.id = "midi-status";
  statusDiv.style.marginTop = "1em";
  editorArea.appendChild(statusDiv);

  try {
    const serverBase = "/Notebook";
    const res = await fetch(`${serverBase}/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);

    currentMidiBuffer = await res.arrayBuffer();
    try {
      currentNotesData = extractNotesForEditor(currentMidiBuffer);
      if (!Array.isArray(currentNotesData) || currentNotesData.length === 0) {
        currentNotesData = [{ midi: 60, duration: "q", rest: false }];
      }
      renderSheetMusic();
      syncMIDIToolbarState();
      statusDiv.innerHTML = "<p style='color:green;'>MIDI loaded. Insert notes/rests, click to select, delete to rest, drag notes vertically.</p>";
    } catch (parseErr) {
      console.warn("MIDI parse/render fallback:", parseErr);
      currentNotesData = [{ midi: 60, duration: "q", rest: false }];
      renderSheetMusic();
      syncMIDIToolbarState();
      statusDiv.innerHTML = `<p style='color:#b36b00;'>MIDI loaded with fallback preview (${parseErr?.message || parseErr}). Editing is still available.</p>`;
    }
  } catch (err) {
    wrapper.innerHTML = `<div style=\"color:red;padding:12px\">Failed to load MIDI file: ${err.message}</div>`;
    console.error(err);
    return;
  }

  registerMIDIHotkeys(filePath);

  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
  }
  resizeHandler = () => renderSheetMusic();
  window.addEventListener("resize", resizeHandler);
}
