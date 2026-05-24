// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MIDIeditorComponents/MelodyPreviewPanel.mjs
// This file renders the editable melody preview panel for microphone MIDI capture.

import { midiToPitchName, pitchNameToMidi } from "./PitchToMidi.mjs";

const DURATIONS = [
  ["w", "Whole"],
  ["h", "Half"],
  ["q", "Quarter"],
  ["8", "Eighth"],
];

export function createMelodyPreviewPanel(host, { onInsert, onClose } = {}) {
  const state = { notes: [], replace: false };
  host.innerHTML = "";
  host.style.cssText = "border-top:1px solid #ccc;padding:12px;background:#f7f8f6;";

  const title = document.createElement("div");
  title.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;";
  title.innerHTML = "<strong>Melody Sketch Preview</strong><span style='font:12px monospace;color:#555;'>Monophonic humming, singing, or whistling only.</span>";
  host.appendChild(title);

  const tableWrap = document.createElement("div");
  tableWrap.style.cssText = "max-height:260px;overflow:auto;border:1px solid #ddd;background:white;";
  host.appendChild(tableWrap);

  const options = document.createElement("label");
  options.style.cssText = "display:flex;align-items:center;gap:6px;margin:10px 0;font:13px sans-serif;";
  options.innerHTML = "<input type='checkbox' data-replace /> Replace existing MIDI notes";
  options.querySelector("input").addEventListener("change", (event) => {
    state.replace = Boolean(event.target.checked);
  });
  host.appendChild(options);

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;align-items:center;";
  const insert = button("Insert into MIDI");
  const close = button("Close");
  actions.append(insert, close);
  host.appendChild(actions);

  insert.addEventListener("click", () => {
    onInsert?.({ notes: state.notes.slice(), replace: state.replace });
  });
  close.addEventListener("click", () => onClose?.());

  function render(notes) {
    state.notes = Array.isArray(notes) ? notes.map(normalizePreviewNote) : [];
    tableWrap.innerHTML = "";
    if (!state.notes.length) {
      tableWrap.innerHTML = "<div style='padding:10px;color:#7a4b00;'>No clear notes were detected. Try a little louder and keep notes separated.</div>";
      return;
    }
    const table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse;font:13px sans-serif;";
    table.innerHTML = "<thead><tr><th>Pitch</th><th>Start</th><th>Duration</th><th>MIDI</th></tr></thead><tbody></tbody>";
    const body = table.querySelector("tbody");
    state.notes.forEach((note, index) => body.appendChild(rowFor(note, index)));
    tableWrap.appendChild(table);
  }

  function rowFor(note, index) {
    const tr = document.createElement("tr");
    const pitch = input("text", note.pitch);
    const start = input("number", note.startSeconds.toFixed(2));
    const midi = input("number", String(note.midi));
    const duration = document.createElement("select");
    duration.innerHTML = DURATIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    duration.value = note.duration;
    pitch.addEventListener("input", () => {
      state.notes[index].pitch = pitch.value;
      const parsed = pitchNameToMidi(pitch.value);
      if (parsed !== null) {
        state.notes[index].midi = parsed;
        midi.value = String(parsed);
      }
    });
    start.addEventListener("input", () => { state.notes[index].startSeconds = Number(start.value) || 0; });
    midi.addEventListener("input", () => {
      state.notes[index].midi = Math.max(0, Math.min(127, Math.round(Number(midi.value) || 60)));
      state.notes[index].pitch = midiToPitchName(state.notes[index].midi);
      pitch.value = state.notes[index].pitch;
    });
    duration.addEventListener("change", () => { state.notes[index].duration = duration.value; });
    [pitch, start, duration, midi].forEach((el) => {
      const td = document.createElement("td");
      td.style.cssText = "border-top:1px solid #eee;padding:6px;";
      el.style.maxWidth = "110px";
      td.appendChild(el);
      tr.appendChild(td);
    });
    return tr;
  }

  render([]);
  return { render, getNotes: () => state.notes.slice(), destroy: () => { host.innerHTML = ""; } };
}

function normalizePreviewNote(note) {
  const midi = Math.max(0, Math.min(127, Math.round(Number(note.midi) || 60)));
  return { ...note, midi, pitch: note.pitch || midiToPitchName(midi), duration: note.duration || "q" };
}

function input(type, value) {
  const el = document.createElement("input");
  el.type = type;
  el.value = value;
  if (type === "number") el.step = "0.01";
  return el;
}

function button(text) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = text;
  return el;
}
