// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MIDIeditorComponents/MidiInsertHelpers.mjs
// This file converts corrected melody preview notes into MIDI editor entries.

import { durationFromBeats, durationToBeats } from "./MelodyQuantizer.mjs";

export function melodyNotesToEditorEntries(notes = [], { tempoBpm = 120 } = {}) {
  const sorted = notes
    .map((note) => ({
      ...note,
      midi: clampMidi(note.midi),
      duration: normalizeDuration(note.duration),
      startSeconds: Math.max(0, Number(note.startSeconds) || 0),
    }))
    .sort((a, b) => a.startSeconds - b.startSeconds);

  const entries = [];
  let cursorBeats = 0;
  for (const note of sorted) {
    const startBeats = secondsToBeats(note.startSeconds, tempoBpm);
    const gapBeats = Math.max(0, startBeats - cursorBeats);
    pushRests(entries, gapBeats);
    entries.push({ midi: note.midi, duration: note.duration, rest: false });
    cursorBeats = startBeats + durationToBeats(note.duration);
  }
  return entries;
}

export function insertMelodyEntries(currentEntries, melodyEntries, { selectedIndex = -1, replace = false } = {}) {
  const base = Array.isArray(currentEntries) ? currentEntries.slice() : [];
  const incoming = Array.isArray(melodyEntries) ? melodyEntries : [];
  if (replace) return incoming.slice();
  const insertAt = selectedIndex >= 0 ? Math.min(base.length, selectedIndex + 1) : base.length;
  base.splice(insertAt, 0, ...incoming);
  return base;
}

function pushRests(entries, beats) {
  let remaining = beats;
  const values = [4, 2, 1, 0.5];
  while (remaining >= 0.49) {
    const chosen = values.find((value) => remaining >= value - 0.01) || 0.5;
    entries.push({ midi: null, duration: durationFromBeats(chosen), rest: true });
    remaining -= chosen;
  }
}

function secondsToBeats(seconds, tempoBpm) {
  const bpm = Math.max(20, Math.min(400, Number(tempoBpm) || 120));
  return Math.max(0, Number(seconds) || 0) / (60 / bpm);
}

function normalizeDuration(duration) {
  return new Set(["w", "h", "q", "8"]).has(duration) ? duration : "q";
}

function clampMidi(value) {
  const midi = Math.round(Number(value));
  if (!Number.isFinite(midi)) return 60;
  return Math.max(0, Math.min(127, midi));
}
