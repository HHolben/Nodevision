// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MIDIeditor.mjs
// This file defines browser-side MIDIeditor logic for the Nodevision UI. It renders interface components and handles user interactions.
// note deletion, and vertical drag pitch editing.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { ensureMidEditorModeLayout } from "/panels/workspace.mjs";
import { VexFlow as VF } from "/lib/vexflow/build/esm/entry/vexflow.js";
import { normalizeNotebookRelativePath, toNotebookAssetUrl } from "/utils/notebookPath.mjs";
import { MelodyRecorder } from "./MIDIeditorComponents/MelodyRecorder.mjs";
import { framesToQuantizedNotes } from "./MIDIeditorComponents/MelodyQuantizer.mjs";
import { createMelodyPreviewPanel } from "./MIDIeditorComponents/MelodyPreviewPanel.mjs";
import { insertMelodyEntries, melodyNotesToEditorEntries } from "./MIDIeditorComponents/MidiInsertHelpers.mjs";

let currentMidiBuffer = null;
let currentFilePath = null;
let currentNotesData = []; // [{ midi: number|null, duration: 'q', rest: boolean }]
let selectedNoteIndex = -1;
let selectedNoteIndices = new Set();
let selectionAnchorIndex = -1;
let midiIsDirty = false;

let playbackTempoBpm = 120;
let playbackState = {
  status: "stopped", // 'stopped' | 'playing' | 'paused'
  index: 0,
  remainingMs: 0,
  noteStartedAt: 0,
  noteDurationMs: 0,
  currentEntry: null,
  activeIndex: -1,
  timeoutId: null,
  ctx: null,
  osc: null,
  gain: null,
};

let notePreviewState = {
  osc: null,
  gain: null,
};

let midiRoot = null;
let rendererDiv = null;
let editorAreaDiv = null;
let statusDiv = null;
let durationSelectEl = null;
let melodyCaptureHost = null;
let melodyPreviewHost = null;
let melodyRecorder = null;
let melodyPreview = null;

let renderedNotes = [];
let renderedNoteXs = [];
let renderedNoteBoxes = [];
let activeStave = null;
let dragState = null;
let marqueeState = null;
let selectedElementType = null; // "note" | "rest" | "cleff" | null
let currentClef = "treble";
let pendingDragMidi = null;
let dragRenderFrame = null;

let keydownHandler = null;
let resizeHandler = null;

const NOTE_NAMES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const DURATION_VALUES = new Set(["w", "h", "q", "8"]);
const SELECTED_NOTE_STYLE = { fillStyle: "#ff8c00", strokeStyle: "#ff8c00" };
const PLAYING_NOTE_STYLE = { fillStyle: "#1976d2", strokeStyle: "#1976d2" };
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

function closestRenderedIndexFromPoint(x, y) {
  if (!renderedNoteBoxes.length) return -1;
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < renderedNoteBoxes.length; i += 1) {
    const box = renderedNoteBoxes[i];
    if (!box) continue;
    const centerX = box.x + box.w / 2;
    const centerY = box.y + box.h / 2;
    const dy = Math.abs(centerY - y);
    if (dy > 48) continue;
    const d = Math.abs(centerX - x) + dy * 0.5;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestDist <= 32 ? bestIdx : -1;
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

function isIndexSelected(index) {
  return selectedNoteIndices.has(index);
}

function isIndexPlaying(index) {
  return playbackState.status === "playing" && playbackState.activeIndex === index;
}

function applyNoteStyle(vexNote, style) {
  if (!style || !vexNote) return;
  vexNote.setStyle(style);
}

function setPlaybackActiveIndex(index, { rerender = true } = {}) {
  const next = Number.isInteger(index) && index >= 0 ? index : -1;
  if (playbackState.activeIndex === next) return;
  playbackState.activeIndex = next;
  if (rerender && rendererDiv?.isConnected) renderSheetMusic();
}

function getSelectedIndices() {
  return [...selectedNoteIndices]
    .filter((idx) => idx >= 0 && idx < currentNotesData.length)
    .sort((a, b) => a - b);
}

function updateSelectionType() {
  const indices = getSelectedIndices();
  if (!indices.length) {
    selectedNoteIndex = -1;
    selectedElementType = null;
    return;
  }
  if (!indices.includes(selectedNoteIndex)) selectedNoteIndex = indices[indices.length - 1];
  const selected = currentNotesData[selectedNoteIndex];
  selectedElementType = selected ? (selected.rest ? "rest" : "note") : null;
}

function clearNoteSelection() {
  selectedNoteIndices.clear();
  selectedNoteIndex = -1;
  selectionAnchorIndex = -1;
  selectedElementType = null;
}

function selectSingleIndex(index) {
  selectedNoteIndices = new Set([index]);
  selectedNoteIndex = index;
  selectionAnchorIndex = index;
  updateSelectionType();
}

function selectRangeToIndex(index) {
  const anchor = selectionAnchorIndex >= 0 ? selectionAnchorIndex : selectedNoteIndex;
  if (anchor < 0) {
    selectSingleIndex(index);
    return;
  }
  const start = Math.min(anchor, index);
  const end = Math.max(anchor, index);
  selectedNoteIndices = new Set();
  for (let i = start; i <= end; i += 1) selectedNoteIndices.add(i);
  selectedNoteIndex = index;
  updateSelectionType();
}

function setSelectionFromIndices(indices) {
  selectedNoteIndices = new Set(indices.filter((idx) => idx >= 0 && idx < currentNotesData.length));
  selectedNoteIndex = indices.length ? indices[indices.length - 1] : -1;
  if (selectedNoteIndex >= 0) selectionAnchorIndex = selectedNoteIndex;
  updateSelectionType();
}

function rectangleIntersects(a, b) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function indicesInsideRect(rect) {
  const selected = [];
  for (let i = 0; i < renderedNoteBoxes.length && i < currentNotesData.length; i += 1) {
    const box = renderedNoteBoxes[i];
    if (box && rectangleIntersects(rect, box)) selected.push(i);
  }
  return selected;
}

function makeMarqueeElement() {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;border:1px solid #2b6cb0;background:rgba(43,108,176,0.14);pointer-events:none;z-index:5;";
  return el;
}

function updateMarqueeElement(state, localX, localY) {
  const x = Math.min(state.startX, localX);
  const y = Math.min(state.startY, localY);
  const w = Math.abs(localX - state.startX);
  const h = Math.abs(localY - state.startY);
  Object.assign(state.el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  return { x, y, w, h };
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

function estimatedNotationWidth(entry) {
  const duration = entry?.duration || "q";
  if (duration === "w") return 112;
  if (duration === "h") return 76;
  if (duration === "8") return 38;
  return 52;
}

function chunkNotesForStaves(notes, formatWidth) {
  const rows = [];
  const usableWidth = Math.max(160, Number(formatWidth) || 160);
  let row = [];
  let rowWidth = 0;

  for (let index = 0; index < notes.length; index += 1) {
    const noteWidth = estimatedNotationWidth(notes[index]);
    if (row.length && rowWidth + noteWidth > usableWidth) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    row.push(index);
    rowWidth += noteWidth;
  }

  if (row.length) rows.push(row);
  return rows.length ? rows : [[]];
}

function scrollNoteIntoView(index, { behavior = "smooth" } = {}) {
  if (!editorAreaDiv || !rendererDiv || index < 0) return;
  const box = renderedNoteBoxes[index];
  if (!box) return;

  window.requestAnimationFrame(() => {
    const latestBox = renderedNoteBoxes[index];
    if (!latestBox || !editorAreaDiv || !rendererDiv) return;

    const margin = 36;
    const targetTop = rendererDiv.offsetTop + latestBox.y - margin;
    const targetBottom = rendererDiv.offsetTop + latestBox.y + latestBox.h + margin;
    const viewTop = editorAreaDiv.scrollTop;
    const viewBottom = viewTop + editorAreaDiv.clientHeight;

    if (targetTop < viewTop) {
      editorAreaDiv.scrollTo({ top: Math.max(0, targetTop), behavior });
    } else if (targetBottom > viewBottom) {
      editorAreaDiv.scrollTo({ top: Math.max(0, targetBottom - editorAreaDiv.clientHeight), behavior });
    }
  });
}

function makeVexNote(entry, index) {
  if (entry?.rest) {
    const restNote = new VF.StaveNote({
      clef: currentClef || "treble",
      keys: ["b/4"],
      duration: String(entry.duration || "q") + "r",
    });
    if (isIndexSelected(index)) {
      applyNoteStyle(restNote, SELECTED_NOTE_STYLE);
    }
    return restNote;
  }

  const key = midiToVexKey(Number.isFinite(entry?.midi) ? entry.midi : 60);
  const style = isIndexPlaying(index)
    ? PLAYING_NOTE_STYLE
    : (isIndexSelected(index) ? SELECTED_NOTE_STYLE : null);
  const staveNote = new VF.StaveNote({
    clef: currentClef || "treble",
    keys: [key],
    duration: entry?.duration || "q",
  });

  if (key.includes("#")) {
    const accidental = new VF.Accidental("#");
    if (style && typeof accidental.setStyle === "function") accidental.setStyle(style);
    staveNote.addModifier(accidental, 0);
  }
  applyNoteStyle(staveNote, style);
  return staveNote;
}


function renderSheetMusic() {
  if (!rendererDiv || !midiRoot) return;

  try {
    rendererDiv.innerHTML = "";
    rendererDiv.style.position = "relative";
    rendererDiv.style.width = "100%";
    renderedNotes = [];
    renderedNoteXs = [];
    renderedNoteBoxes = [];
    activeStave = null;

    const hostWidth = rendererDiv.parentElement?.clientWidth || midiRoot.clientWidth || 800;
    const width = Math.max(360, hostWidth - 24);
    const staveX = 10;
    const staveWidth = Math.max(320, width - 30);
    const formatWidth = Math.max(180, staveWidth - 78);
    const staffGap = 132;
    const topOffset = 20;
    const rows = chunkNotesForStaves(currentNotesData, formatWidth);
    const height = Math.max(220, topOffset + rows.length * staffGap + 30);

    const renderer = new VF.Renderer(rendererDiv, VF.Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();
    ctx.setFont("Arial", 10);

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const indices = rows[rowIndex];
      const staveY = topOffset + rowIndex * staffGap;
      const stave = new VF.Stave(staveX, staveY, staveWidth);
      stave.addClef(currentClef || "treble").setContext(ctx).draw();
      if (!activeStave) activeStave = stave;

      const notesForRow = indices.map((noteIndex) => {
        const vexNote = makeVexNote(currentNotesData[noteIndex], noteIndex);
        renderedNotes[noteIndex] = vexNote;
        return vexNote;
      });

      if (!notesForRow.length) continue;
      const voice = new VF.Voice({ num_beats: 4, beat_value: 4 })
        .setStrict(false)
        .addTickables(notesForRow);

      new VF.Formatter().joinVoices([voice]).format([voice], formatWidth);
      voice.draw(ctx, stave);

      for (let rowNoteIndex = 0; rowNoteIndex < notesForRow.length; rowNoteIndex += 1) {
        const noteIndex = indices[rowNoteIndex];
        const vexNote = notesForRow[rowNoteIndex];
        renderedNoteXs[noteIndex] = Number(vexNote.getAbsoluteX?.() || 0);
        renderedNoteBoxes[noteIndex] = vexBoundingBoxToObject(vexNote.getBoundingBox?.());
      }
    }

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

      if (idx < 0) idx = closestRenderedIndexFromPoint(localX, localY);

      // Note hit-testing has priority so dragging notes near the clef still works.
      if (idx < 0 && localX <= 72) {
        clearNoteSelection();
        selectedElementType = "cleff";
        dragState = null;
        marqueeState = null;
        renderSheetMusic();
        syncMIDIToolbarState();
        return;
      }

      if (idx < 0) {
        clearNoteSelection();
        marqueeState = {
          startX: localX,
          startY: localY,
          el: makeMarqueeElement(),
        };
        rendererDiv.appendChild(marqueeState.el);
        if (rendererDiv.setPointerCapture && Number.isFinite(event.pointerId)) rendererDiv.setPointerCapture(event.pointerId);
        return;
      }

      if (event.shiftKey) {
        selectRangeToIndex(idx);
      } else if (!isIndexSelected(idx)) {
        selectSingleIndex(idx);
      } else {
        selectedNoteIndex = idx;
        updateSelectionType();
      }

      const selected = currentNotesData[idx];
      previewNoteEntry(selected);
      if (!event.shiftKey && selected && !selected.rest && Number.isFinite(selected.midi)) {
        const dragIndices = getSelectedIndices().filter((noteIndex) => {
          const note = currentNotesData[noteIndex];
          return note && !note.rest && Number.isFinite(note.midi);
        });
        const indices = dragIndices.length ? dragIndices : [idx];
        dragState = {
          indices,
          startY: event.clientY,
          startMidis: new Map(indices.map((noteIndex) => [noteIndex, currentNotesData[noteIndex].midi])),
        };
        if (rendererDiv.setPointerCapture && Number.isFinite(event.pointerId)) rendererDiv.setPointerCapture(event.pointerId);
      } else {
        dragState = null;
      }

      renderSheetMusic();
      syncMIDIToolbarState();
    };

    rendererDiv.onpointermove = (event) => {
      const svgRect = rendererDiv.getBoundingClientRect();
      const localX = event.clientX - svgRect.left;
      const localY = event.clientY - svgRect.top;

      if (marqueeState) {
        const rect = updateMarqueeElement(marqueeState, localX, localY);
        setSelectionFromIndices(indicesInsideRect(rect));
        syncMIDIToolbarState();
        return;
      }

      if (!dragState) return;
      let changed = false;
      let lastMidi = null;
      for (const noteIndex of dragState.indices || []) {
        const note = currentNotesData[noteIndex];
        const startMidi = dragState.startMidis?.get(noteIndex);
        if (!note || note.rest || !Number.isFinite(startMidi)) continue;
        const newMidi = midiFromY(startMidi, event.clientY - dragState.startY);
        if (newMidi !== note.midi) {
          note.midi = newMidi;
          lastMidi = newMidi;
          changed = true;
        }
      }
      if (changed) {
        pendingDragMidi = lastMidi;
        markDirty();
        scheduleDragRender();
      }
    };

    const finishDragOrMarquee = () => {
      if (marqueeState) {
        marqueeState.el?.remove?.();
        marqueeState = null;
        renderSheetMusic();
        syncMIDIToolbarState();
        return;
      }
      if (dragRenderFrame !== null) {
        window.cancelAnimationFrame(dragRenderFrame);
        dragRenderFrame = null;
        renderSheetMusic();
        if (pendingDragMidi !== null && statusDiv) {
          const count = getSelectedIndices().length;
          statusDiv.innerHTML = `<p style=\"color:#333;\">Moved ${count > 1 ? `${count} notes` : `selected note to ${midiToVexKey(pendingDragMidi)}`}.</p>`;
        }
        pendingDragMidi = null;
      }
      dragState = null;
    };

    rendererDiv.onpointerup = finishDragOrMarquee;
    rendererDiv.onpointerleave = finishDragOrMarquee;
  } catch (err) {
    console.warn("Failed to render MIDI sheet music:", err);
    if (statusDiv) {
      statusDiv.innerHTML = `<p style='color:#b00020;'>Render error: ${err?.message || err}</p>`;
    }
  }
}

function insertNote(midi = null, duration = "q") {
  const baseMidi = selectedNoteIndex >= 0 && currentNotesData[selectedNoteIndex] && !currentNotesData[selectedNoteIndex].rest
    ? currentNotesData[selectedNoteIndex].midi
    : 60;
  const nextMidi = Number.isFinite(Number(midi)) ? Number(midi) : baseMidi;
  const nextDuration = DURATION_VALUES.has(duration) ? duration : "q";

  const entry = { midi: Number.isFinite(nextMidi) ? nextMidi : 60, duration: nextDuration, rest: false };

  if (selectedNoteIndex >= 0) {
    currentNotesData.splice(selectedNoteIndex + 1, 0, entry);
    selectedNoteIndex += 1;
  } else {
    currentNotesData.push(entry);
    selectedNoteIndex = currentNotesData.length - 1;
  }
  selectedNoteIndices = new Set([selectedNoteIndex]);
  selectionAnchorIndex = selectedNoteIndex;
  selectedElementType = "note";

  renderSheetMusic();
  scrollNoteIntoView(selectedNoteIndex);
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
  selectedNoteIndices = new Set([selectedNoteIndex]);
  selectionAnchorIndex = selectedNoteIndex;
  selectedElementType = "rest";

  renderSheetMusic();
  scrollNoteIntoView(selectedNoteIndex);
  markDirty();
  syncMIDIToolbarState();
}

function deleteSelectedNotes() {
  const indices = getSelectedIndices();
  if (!indices.length) return;

  if (playbackState.status !== "stopped") {
    stopPlayback({ resetIndex: false, rerender: false });
  }

  const deleteSet = new Set(indices);
  const firstDeleted = indices[0];
  currentNotesData = currentNotesData.filter((_, index) => !deleteSet.has(index));

  const nextIndex = currentNotesData.length ? Math.min(firstDeleted, currentNotesData.length - 1) : -1;
  if (nextIndex >= 0) {
    selectSingleIndex(nextIndex);
  } else {
    clearNoteSelection();
  }

  renderSheetMusic();
  if (nextIndex >= 0) scrollNoteIntoView(nextIndex);
  markDirty();
  syncMIDIToolbarState();
  if (statusDiv) {
    const count = indices.length;
    statusDiv.textContent = "Deleted " + (count > 1 ? count + " notes" : "selected note") + ".";
  }
}

function setSelectedDuration(duration) {
  if (!DURATION_VALUES.has(duration)) return;
  const indices = getSelectedIndices();
  if (!indices.length) return;
  for (const index of indices) {
    const existing = currentNotesData[index];
    if (existing) existing.duration = duration;
  }
  renderSheetMusic();
  markDirty();
  syncMIDIToolbarState();
}

function setClef(nextClef) {
  const allowed = new Set(["treble", "bass", "alto", "tenor"]);
  if (!allowed.has(nextClef)) return;
  currentClef = nextClef;
  clearNoteSelection();
  selectedElementType = "cleff";
  renderSheetMusic();
  syncMIDIToolbarState();
}

function openMelodyRecorder() {
  if (!melodyCaptureHost || !melodyPreviewHost) return;
  melodyCaptureHost.innerHTML = "";
  melodyCaptureHost.style.cssText = "border-top:1px solid #ddd;padding:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#fbfbfb;";

  const status = document.createElement("span");
  status.style.cssText = "font:13px monospace;color:#555;";
  status.textContent = "Melody sketch: record one note at a time, then correct the preview before inserting.";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.textContent = "Start Recording";

  const stopBtn = document.createElement("button");
  stopBtn.type = "button";
  stopBtn.textContent = "Stop and Preview";
  stopBtn.disabled = true;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";

  melodyCaptureHost.append(startBtn, stopBtn, closeBtn, status);

  startBtn.addEventListener("click", async () => {
    try {
      melodyPreviewHost.innerHTML = "";
      melodyRecorder?.stop?.();
      melodyRecorder = new MelodyRecorder({
        onFrame: (frame) => {
          if (frame.frequency) {
            status.textContent = `Recording. Detected ${Math.round(frame.frequency)} Hz.`;
          }
        },
        onStatus: (message) => { status.textContent = message; },
      });
      await melodyRecorder.start();
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      status.textContent = err?.message || String(err);
      status.style.color = "#b00020";
    }
  });

  stopBtn.addEventListener("click", () => {
    const frames = melodyRecorder?.stop?.() || [];
    startBtn.disabled = false;
    stopBtn.disabled = true;
    showMelodyPreview(frames);
  });

  closeBtn.addEventListener("click", () => {
    melodyRecorder?.stop?.();
    melodyRecorder = null;
    melodyPreview?.destroy?.();
    melodyCaptureHost.innerHTML = "";
    melodyPreviewHost.innerHTML = "";
  });
}

function showMelodyPreview(frames) {
  const notes = framesToQuantizedNotes(frames, { tempoBpm: playbackTempoBpm, gridBeats: 1 });
  melodyPreview = createMelodyPreviewPanel(melodyPreviewHost, {
    onInsert: ({ notes: editedNotes, replace }) => insertRecordedMelody(editedNotes, { replace }),
    onClose: () => { melodyPreviewHost.innerHTML = ""; },
  });
  melodyPreview.render(notes);
  if (statusDiv) {
    statusDiv.innerHTML = notes.length
      ? "<p style='color:#2e7d32;'>Detected melody notes are ready to review.</p>"
      : "<p style='color:#7a4b00;'>No clear monophonic notes were detected. Try a steadier hummed or whistled line.</p>";
  }
}

function insertRecordedMelody(notes, { replace = false } = {}) {
  const entries = melodyNotesToEditorEntries(notes, { tempoBpm: playbackTempoBpm });
  if (!entries.length) return;
  const insertAt = selectedNoteIndex >= 0 ? Math.min(currentNotesData.length, selectedNoteIndex + 1) : currentNotesData.length;
  currentNotesData = insertMelodyEntries(currentNotesData, entries, { selectedIndex: selectedNoteIndex, replace });
  const selectedStart = replace ? 0 : insertAt;
  selectedNoteIndices = new Set(entries.map((_, offset) => selectedStart + offset));
  selectedNoteIndex = selectedStart;
  selectionAnchorIndex = selectedStart;
  selectedElementType = "note";
  renderSheetMusic();
  scrollNoteIntoView(selectedStart);
  markDirty();
  syncMIDIToolbarState();
  if (statusDiv) {
    statusDiv.innerHTML = `<p style='color:#2e7d32;'>Inserted ${entries.length} melody sketch entries. Existing notes ${replace ? "were replaced" : "were preserved"}.</p>`;
  }
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
  if (callbackKey === "midiRecordMelody") {
    openMelodyRecorder();
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
  if (callbackKey === "midiRestartScore") {
    window.NodevisionMIDITools?.restart?.();
    return;
  }
}

function syncMIDIToolbarState() {
  updateSelectionType();
  const selected = selectedNoteIndex >= 0 ? currentNotesData[selectedNoteIndex] : null;
  const selectedType = selectedElementType || (selected ? (selected.rest ? "rest" : "note") : null);
  updateToolbarState({
    currentMode: "MIDIediting",
    activeActionHandler: handleMIDIAction,
    midiHasSelection: Boolean(selectedType),
    midiSelectedType: selectedType,
    midiSelectionCount: getSelectedIndices().length,
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
    const target = e.target;
    if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;

    const key = String(e.key || "").toLowerCase();

    if ((e.ctrlKey || e.metaKey) && key === "s") {
      e.preventDefault();
      if (window.saveMIDIFile) {
        window.saveMIDIFile(normalizedPath);
      }
      return;
    }

    if (key === "delete" || key === "backspace") {
      if (getSelectedIndices().length) {
        e.preventDefault();
        deleteSelectedNotes();
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

function stopNotePreview() {
  try {
    if (notePreviewState.osc) notePreviewState.osc.stop();
  } catch {}
  try {
    notePreviewState.gain?.disconnect?.();
  } catch {}
  notePreviewState.osc = null;
  notePreviewState.gain = null;
}

function previewNoteEntry(entry, { durationMs = 240 } = {}) {
  if (entry?.rest || !Number.isFinite(entry?.midi)) return;

  try {
    const ctx = ensureAudio();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    stopNotePreview();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const end = now + Math.max(0.04, durationMs / 1000);

    osc.type = "sine";
    osc.frequency.value = midiToFrequency(entry.midi);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, Math.max(now + 0.03, end - 0.02));
    osc.connect(gain).connect(ctx.destination);
    notePreviewState.osc = osc;
    notePreviewState.gain = gain;
    osc.onended = () => {
      if (notePreviewState.osc === osc) {
        notePreviewState.osc = null;
        notePreviewState.gain = null;
      }
      try { gain.disconnect(); } catch {}
    };
    osc.start(now);
    osc.stop(end);
  } catch (err) {
    console.warn("MIDI note preview failed:", err);
  }
}

function stopPlayback({ resetIndex = false, rerender = true } = {}) {
  const hadActiveIndex = playbackState.activeIndex >= 0;
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
  playbackState.activeIndex = -1;
  playbackState.status = "stopped";
  if (hadActiveIndex && rerender && rendererDiv?.isConnected) renderSheetMusic();
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
    if (statusDiv) statusDiv.textContent = "Playback finished.";
    syncMIDIToolbarState();
    return;
  }

  const entry = notes[playbackState.index];
  setPlaybackActiveIndex(entry?.rest || !Number.isFinite(entry?.midi) ? -1 : playbackState.index);
  scrollNoteIntoView(playbackState.index, { behavior: "auto" });
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

function getSelectedPlaybackStartIndex() {
  const indices = getSelectedIndices();
  return indices.length ? indices[0] : -1;
}

function startPlaybackFromIndex(index) {
  const notes = Array.isArray(currentNotesData) ? currentNotesData : [];
  if (!notes.length) {
    stopPlayback({ resetIndex: true });
    syncMIDIToolbarState();
    return;
  }

  const startIndex = Math.max(0, Math.min(notes.length - 1, Math.floor(Number(index) || 0)));
  stopPlayback({ resetIndex: false, rerender: false });
  playbackState.index = startIndex;
  playbackState.status = "playing";
  scheduleNextNote();
  syncMIDIToolbarState();
}

function playScore() {
  const selectedStart = getSelectedPlaybackStartIndex();
  if (selectedStart >= 0) {
    startPlaybackFromIndex(selectedStart);
    return;
  }

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

function restartScore() {
  startPlaybackFromIndex(0);
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
  setPlaybackActiveIndex(-1);
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
  clearNoteSelection();
  dragState = null;
  marqueeState = null;
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
    restart: restartScore,
    stop: () => stopPlayback({ resetIndex: true }),
    setTempo,
    getTempo: () => playbackTempoBpm,
    insertMidiNote: (midi, duration = durationSelectEl?.value || "q") => insertNote(midi, duration),
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

  const recordMelodyBtn = document.createElement("button");
  recordMelodyBtn.type = "button";
  recordMelodyBtn.textContent = "Record Melody";
  recordMelodyBtn.addEventListener("click", openMelodyRecorder);
  controls.appendChild(recordMelodyBtn);

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
  controlsHint.textContent = "Click note to select, Delete/Backspace to delete selected notes, drag selected note up/down to change pitch.";
  controls.appendChild(controlsHint);

  const editorArea = document.createElement("div");
  editorArea.id = "midi-editing-area";
  editorAreaDiv = editorArea;
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

  melodyCaptureHost = document.createElement("div");
  melodyCaptureHost.id = "midi-melody-capture";
  editorArea.appendChild(melodyCaptureHost);

  melodyPreviewHost = document.createElement("div");
  melodyPreviewHost.id = "midi-melody-preview";
  editorArea.appendChild(melodyPreviewHost);

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
      statusDiv.innerHTML = "<p style='color:green;'>MIDI loaded. Insert notes/rests, click to select, delete notes, drag notes vertically.</p>";
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

  try {
    const editorCell = container?.closest?.(".panel-cell");
    if (editorCell) {
      await ensureMidEditorModeLayout({ editorCell });
    }
  } catch (err) {
    console.warn("MIDI editor: failed to apply MIDI editor mode layout:", err);
  }

  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
  }
  resizeHandler = () => renderSheetMusic();
  window.addEventListener("resize", resizeHandler);
}
