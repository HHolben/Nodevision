// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MIDIeditor.mjs
// This file defines browser-side MIDIeditor logic for the Nodevision UI. It renders interface components and handles user interactions.
// delete-to-rest, and vertical drag pitch editing.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { VexFlow as VF } from "/lib/vexflow/build/esm/entry/vexflow.js";
import { normalizeNotebookRelativePath, toNotebookAssetUrl } from "/utils/notebookPath.mjs";

let currentMidiBuffer = null;
let currentFilePath = null;
let currentNotesData = []; // [{ midi: number|null, duration: 'q', rest: boolean }]
let selectedNoteIndex = -1;
let midiIsDirty = false;

let playbackTempoBpm = 120;
let playbackState = {
  status: "stopped", // 'stopped' | 'playing' | 'paused'
  index: 0,
  remainingMs: 0,
  noteStartedAt: 0,
  noteDurationMs: 0,
  currentEntry: null,
  timeoutId: null,
  ctx: null,
  osc: null,
  gain: null,
};

let midiRoot = null;
let rendererDiv = null;
let statusDiv = null;
let durationSelectEl = null;

let renderedNotes = [];
let renderedNoteXs = [];
let renderedNoteBoxes = [];
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

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function markDirty() {
  if (midiIsDirty) return;
  midiIsDirty = true;
  updateToolbarState({ fileIsDirty: true });
}

function markSaved() {
  midiIsDirty = false;
  updateToolbarState({ fileIsDirty: false });
}

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
  const fallback = [{ midi: 60, duration: "q", rest: false }];
  const MAX_ENTRIES = 128;

  const readU16BE = (offset) => ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0;
  const readU32BE = (offset) =>
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  const readStr = (offset, len) => String.fromCharCode(...bytes.subarray(offset, offset + len));

  const readVlq = (offset) => {
    let value = 0;
    let pos = offset;
    for (let i = 0; i < 4 && pos < bytes.length; i += 1) {
      const b = bytes[pos++];
      value = (value << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
    return { value, pos };
  };

  const nearestDuration = (ticks, division) => {
    const candidates = [
      ["w", division * 4],
      ["h", division * 2],
      ["q", division],
      ["8", Math.max(1, Math.floor(division / 2))],
    ];
    let best = "q";
    let bestDist = Infinity;
    for (const [dur, val] of candidates) {
      const dist = Math.abs(Number(ticks) - val);
      if (dist < bestDist) {
        bestDist = dist;
        best = dur;
      }
    }
    return best;
  };

  const pushRestTicks = (ticks, division, out) => {
    let remaining = Math.max(0, Math.floor(ticks));
    const values = [
      ["w", division * 4],
      ["h", division * 2],
      ["q", division],
      ["8", Math.max(1, Math.floor(division / 2))],
    ];
    for (const [dur, val] of values) {
      while (remaining >= val && out.length < MAX_ENTRIES) {
        out.push({ midi: null, duration: dur, rest: true });
        remaining -= val;
      }
    }
    // Ignore very short leftovers; otherwise round to nearest.
    if (remaining >= Math.floor(division / 3) && out.length < MAX_ENTRIES) {
      out.push({ midi: null, duration: nearestDuration(remaining, division), rest: true });
    }
  };

  try {
    if (bytes.length < 18) return fallback;
    if (readStr(0, 4) !== "MThd") return fallback;
    const headerLen = readU32BE(4);
    const division = readU16BE(12) || MIDI_TICKS_PER_QUARTER;

    // Prefer a track that actually contains note events.
    let pos = 8 + headerLen;
    if (pos < 14) pos = 14;
    const tracks = [];
    while (pos + 8 <= bytes.length) {
      const id = readStr(pos, 4);
      const len = readU32BE(pos + 4);
      pos += 8;
      if (id === "MTrk") {
        tracks.push({ start: pos, len });
      }
      pos += len;
    }
    if (!tracks.length) return fallback;

    const countNoteOns = (start, end) => {
      let p = start;
      let runningStatus = null;
      let count = 0;
      while (p < end && count < 256) {
        const delta = readVlq(p);
        p = delta.pos;
        if (p >= end) break;

        let status = bytes[p];
        if (status < 0x80) {
          if (runningStatus == null) break;
          status = runningStatus;
        } else {
          p += 1;
          if (status < 0xf0) runningStatus = status;
          else runningStatus = null;
        }

        if (status === 0xff) {
          if (p >= end) break;
          p += 1; // meta type
          const lenInfo = readVlq(p);
          p = lenInfo.pos + lenInfo.value;
          continue;
        }
        if (status === 0xf0 || status === 0xf7) {
          const lenInfo = readVlq(p);
          p = lenInfo.pos + lenInfo.value;
          continue;
        }

        const hi = status & 0xf0;
        if (hi === 0xc0 || hi === 0xd0) {
          p += 1;
          continue;
        }
        if (hi === 0x80 || hi === 0x90 || hi === 0xa0 || hi === 0xb0 || hi === 0xe0) {
          const note = bytes[p++];
          const vel = bytes[p++];
          if (hi === 0x90 && vel > 0) count += 1;
          continue;
        }
        break;
      }
      return count;
    };

    let best = tracks[0];
    let bestCount = -1;
    for (const t of tracks) {
      const end = Math.min(bytes.length, t.start + t.len);
      const n = countNoteOns(t.start, end);
      if (n > bestCount) {
        bestCount = n;
        best = t;
      }
    }

    const trackStart = best.start;
    const trackLen = best.len;

    const end = Math.min(bytes.length, trackStart + trackLen);
    const out = [];
    let absTick = 0;
    let runningStatus = null;
    let active = null; // { midi, startTick }
    let lastEndTick = 0;
    let foundTempoBpm = null;

    pos = trackStart;
    while (pos < end && out.length < MAX_ENTRIES) {
      const delta = readVlq(pos);
      absTick += delta.value;
      pos = delta.pos;
      if (pos >= end) break;

      let status = bytes[pos];
      if (status < 0x80) {
        if (runningStatus == null) break;
        status = runningStatus;
      } else {
        pos += 1;
        if (status < 0xf0) runningStatus = status;
      }

      if (status === 0xff) {
        const type = bytes[pos++];
        const lenInfo = readVlq(pos);
        const metaLen = lenInfo.value;
        pos = lenInfo.pos;
        if (type === 0x51 && metaLen === 3 && pos + 3 <= end) {
          const mpqn = (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
          if (mpqn > 0) {
            foundTempoBpm = clampNumber(60000000 / mpqn, 20, 400, null);
          }
        }
        pos += metaLen;
        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        const lenInfo = readVlq(pos);
        pos = lenInfo.pos + lenInfo.value;
        continue;
      }

      const hi = status & 0xf0;
      if (hi === 0x90) {
        const midi = bytes[pos++];
        const vel = bytes[pos++];
        if (vel > 0) {
          if (active) {
            const durTicks = Math.max(1, absTick - active.startTick);
            out.push({ midi: active.midi, duration: nearestDuration(durTicks, division), rest: false });
            lastEndTick = absTick;
            active = null;
          }
          if (absTick > lastEndTick) {
            pushRestTicks(absTick - lastEndTick, division, out);
            lastEndTick = absTick;
          }
          active = { midi, startTick: absTick };
        } else if (active && active.midi === midi) {
          const durTicks = Math.max(1, absTick - active.startTick);
          out.push({ midi: active.midi, duration: nearestDuration(durTicks, division), rest: false });
          lastEndTick = absTick;
          active = null;
        }
        continue;
      }

      if (hi === 0x80) {
        const midi = bytes[pos++];
        pos += 1; // velocity
        if (active && active.midi === midi) {
          const durTicks = Math.max(1, absTick - active.startTick);
          out.push({ midi: active.midi, duration: nearestDuration(durTicks, division), rest: false });
          lastEndTick = absTick;
          active = null;
        }
        continue;
      }

      if (hi === 0xa0 || hi === 0xb0 || hi === 0xe0) {
        pos += 2;
        continue;
      }
      if (hi === 0xc0 || hi === 0xd0) {
        pos += 1;
        continue;
      }

      // Unknown event; bail out safely.
      break;
    }

    if (foundTempoBpm) {
      setTempo(foundTempoBpm);
    }

    return out.length ? out : fallback;
  } catch (err) {
    console.warn("extractNotesForEditor error:", err);
    return fallback;
  }
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

function vexBoundingBoxToObject(bb) {
  if (!bb) return null;
  const x = typeof bb.getX === "function" ? bb.getX() : bb.x;
  const y = typeof bb.getY === "function" ? bb.getY() : bb.y;
  const w = typeof bb.getW === "function" ? bb.getW() : bb.w;
  const h = typeof bb.getH === "function" ? bb.getH() : bb.h;
  if (![x, y, w, h].every((v) => Number.isFinite(Number(v)))) return null;
  return { x: Number(x), y: Number(y), w: Number(w), h: Number(h) };
}

function renderSheetMusic() {
  if (!rendererDiv || !midiRoot || !currentNotesData.length) return;

  try {
    rendererDiv.innerHTML = "";
    renderedNotes = [];
    renderedNoteXs = [];
    renderedNoteBoxes = [];
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
          clef: currentClef || "treble",
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
        clef: currentClef || "treble",
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

    const voice = new VF.Voice({ num_beats: 4, beat_value: 4 })
      .setStrict(false)
      .addTickables(notesForRender);

    new VF.Formatter().joinVoices([voice]).format([voice], width - 60);
    voice.draw(ctx, stave);

    renderedNotes = notesForRender;
    renderedNoteXs = notesForRender.map((n) => Number(n.getAbsoluteX?.() || 0));
    renderedNoteBoxes = notesForRender.map((n) => vexBoundingBoxToObject(n.getBoundingBox?.()));

    clearRenderEventHandlers();

    rendererDiv.onpointerdown = (event) => {
      const svgRect = rendererDiv.getBoundingClientRect();
      const localX = event.clientX - svgRect.left;
      const localY = event.clientY - svgRect.top;
      let idx = -1;

      for (let i = 0; i < renderedNoteBoxes.length; i += 1) {
        const bb = renderedNoteBoxes[i];
        if (!bb) continue;
        if (localX >= bb.x - 6 && localX <= bb.x + bb.w + 6 && localY >= bb.y - 6 && localY <= bb.y + bb.h + 6) {
          idx = i;
          break;
        }
      }

      if (idx < 0) {
        idx = closestRenderedIndexFromX(localX);
      }

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
        markDirty();
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
  } catch (err) {
    console.warn("Failed to render MIDI sheet music:", err);
    if (statusDiv) {
      statusDiv.innerHTML = `<p style='color:#b00020;'>Render error: ${err?.message || err}</p>`;
    }
  }
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
  markDirty();
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
  markDirty();
  syncMIDIToolbarState();
}

function replaceSelectedWithRest() {
  if (selectedNoteIndex < 0 || selectedNoteIndex >= currentNotesData.length) return;
  const existing = currentNotesData[selectedNoteIndex];
  const duration = DURATION_VALUES.has(existing?.duration) ? existing.duration : "q";
  currentNotesData[selectedNoteIndex] = { midi: null, duration, rest: true };
  selectedElementType = "rest";
  renderSheetMusic();
  markDirty();
  syncMIDIToolbarState();
}

function setSelectedDuration(duration) {
  if (!DURATION_VALUES.has(duration)) return;
  if (selectedNoteIndex < 0 || selectedNoteIndex >= currentNotesData.length) return;
  const existing = currentNotesData[selectedNoteIndex];
  if (!existing) return;
  existing.duration = duration;
  renderSheetMusic();
  markDirty();
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
    return;
  }
  if (callbackKey === "midiPlayScore") {
    window.NodevisionMIDITools?.play?.();
    return;
  }
  if (callbackKey === "midiPauseScore") {
    window.NodevisionMIDITools?.pause?.();
    return;
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
    midiTempoBpm: playbackTempoBpm,
  });

  if (durationSelectEl && selected && DURATION_VALUES.has(selected.duration)) {
    durationSelectEl.value = selected.duration;
  }
}

function registerMIDIHotkeys(filePath) {
  const normalizedPath = normalizeNotebookRelativePath(filePath);
  if (keydownHandler) {
    document.removeEventListener("keydown", keydownHandler);
  }

  keydownHandler = (e) => {
    const key = String(e.key || "").toLowerCase();

    if ((e.ctrlKey || e.metaKey) && key === "s") {
      e.preventDefault();
      if (window.saveMIDIFile) {
        window.saveMIDIFile(normalizedPath);
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

  // Meta: tempo, time signature (4/4), program change (acoustic grand).
  const bpm = clampNumber(playbackTempoBpm, 20, 400, 120);
  const mpqn = Math.max(1, Math.round(60000000 / bpm));
  pushVlq(0);
  push(0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff);
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
  const chunkSize = 0x1000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, slice);
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

  const text = await res.text().catch(() => "");
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!res.ok || !payload?.success) {
    const msg = payload?.error || (typeof payload === "string" && payload.trim() ? payload : null) || `Save failed (${res.status})`;
    throw new Error(msg);
  }
  console.log("Saved MIDI file:", targetPath);
  markSaved();
};

function midiToFrequency(midi) {
  const m = clampNumber(midi, 0, 127, 60);
  return 440 * Math.pow(2, (m - 69) / 12);
}

function durationToBeats(duration) {
  if (!duration) return 1;
  if (duration === "w") return 4;
  if (duration === "h") return 2;
  if (duration === "q") return 1;
  if (duration === "8") return 0.5;
  return 1;
}

function stopPlayback({ resetIndex = false } = {}) {
  if (playbackState.timeoutId) {
    clearTimeout(playbackState.timeoutId);
    playbackState.timeoutId = null;
  }
  try {
    if (playbackState.osc) playbackState.osc.stop();
  } catch {}
  playbackState.osc = null;
  if (resetIndex) playbackState.index = 0;
  playbackState.remainingMs = 0;
  playbackState.currentEntry = null;
  playbackState.noteStartedAt = 0;
  playbackState.noteDurationMs = 0;
  playbackState.status = "stopped";
}

function ensureAudio() {
  if (playbackState.ctx) return playbackState.ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error("Web Audio is not supported in this environment.");
  playbackState.ctx = new Ctx();
  playbackState.gain = playbackState.ctx.createGain();
  playbackState.gain.gain.value = 0.15;
  playbackState.gain.connect(playbackState.ctx.destination);
  return playbackState.ctx;
}

function scheduleNextNote({ resumeCurrent = false } = {}) {
  const notes = Array.isArray(currentNotesData) ? currentNotesData : [];
  if (playbackState.index < 0) playbackState.index = 0;
  if (playbackState.index >= notes.length) {
    stopPlayback({ resetIndex: true });
    if (statusDiv) statusDiv.innerHTML = "<p style='color:#2e7d32;'>Playback finished.</p>";
    syncMIDIToolbarState();
    return;
  }

  const entry = notes[playbackState.index];
  const bpm = clampNumber(playbackTempoBpm, 20, 400, 120);
  const beatSeconds = 60 / bpm;
  const beats = durationToBeats(entry?.duration);
  const durationMs = Math.max(50, Math.round(beatSeconds * beats * 1000));

  playbackState.currentEntry = entry;
  playbackState.noteStartedAt = performance.now();
  const playMs = Math.max(0, resumeCurrent ? playbackState.remainingMs : durationMs);
  playbackState.noteDurationMs = playMs;

  if (!resumeCurrent) {
    playbackState.remainingMs = durationMs;
  }

  if (entry?.rest || !Number.isFinite(entry?.midi)) {
    playbackState.timeoutId = setTimeout(() => {
      playbackState.index += 1;
      scheduleNextNote();
    }, playMs);
    return;
  }

  const ctx = ensureAudio();
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = midiToFrequency(entry.midi);
  osc.connect(playbackState.gain);
  playbackState.osc = osc;
  const now = ctx.currentTime;
  osc.start(now);
  osc.stop(now + playMs / 1000);

  playbackState.timeoutId = setTimeout(() => {
    playbackState.index += 1;
    scheduleNextNote();
  }, playMs);
}

function playScore() {
  if (playbackState.status === "playing") return;
  const wasPaused = playbackState.status === "paused";
  playbackState.status = "playing";
  if (wasPaused) scheduleNextNote({ resumeCurrent: true });
  else {
    if (playbackState.index < 0) playbackState.index = 0;
    scheduleNextNote();
  }
  syncMIDIToolbarState();
}

function pauseScore() {
  if (playbackState.status !== "playing") return;
  if (playbackState.timeoutId) {
    clearTimeout(playbackState.timeoutId);
    playbackState.timeoutId = null;
  }
  try {
    if (playbackState.osc) playbackState.osc.stop();
  } catch {}
  playbackState.osc = null;

  const elapsed = performance.now() - (playbackState.noteStartedAt || 0);
  playbackState.remainingMs = Math.max(0, (playbackState.noteDurationMs || 0) - elapsed);
  playbackState.status = "paused";
  syncMIDIToolbarState();
}

function setTempo(bpm) {
  playbackTempoBpm = clampNumber(bpm, 20, 400, 120);
  updateToolbarState({ midiTempoBpm: playbackTempoBpm });
}

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";
  const normalizedPath = normalizeNotebookRelativePath(filePath);
  currentFilePath = normalizedPath;
  selectedNoteIndex = -1;
  dragState = null;
  selectedElementType = null;
  currentClef = "treble";
  midiIsDirty = false;
  setTempo(playbackTempoBpm);
  stopPlayback({ resetIndex: true });
  updateToolbarState({ fileIsDirty: false });

  window.NodevisionState.currentMode = "MIDIediting";
  window.NodevisionState.activeActionHandler = handleMIDIAction;
  window.NodevisionMIDITools = {
    play: playScore,
    pause: pauseScore,
    stop: () => stopPlayback({ resetIndex: true }),
    setTempo,
    getTempo: () => playbackTempoBpm,
    status: () => ({ ...playbackState, tempoBpm: playbackTempoBpm }),
  };
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

  const durationSelect = document.createElement("select");
  durationSelect.title = "Selected duration";
  durationSelect.innerHTML = `
    <option value="w">Whole</option>
    <option value="h">Half</option>
    <option value="q" selected>Quarter</option>
    <option value="8">Eighth</option>
  `;
  durationSelect.addEventListener("change", () => {
    setSelectedDuration(durationSelect.value);
  });
  controls.appendChild(durationSelect);
  durationSelectEl = durationSelect;

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", async () => {
    try {
      await window.saveMIDIFile(normalizedPath);
      if (statusDiv) statusDiv.innerHTML = "<p style='color:green;'>Saved.</p>";
    } catch (err) {
      console.error(err);
      alert(`Failed to save: ${err?.message || err}`);
    }
  });
  controls.appendChild(saveBtn);

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
    const res = await fetch(toNotebookAssetUrl(normalizedPath), { cache: "no-store" });
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

  registerMIDIHotkeys(normalizedPath);

  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
  }
  resizeHandler = () => renderSheetMusic();
  window.addEventListener("resize", resizeHandler);
}
