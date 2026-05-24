// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MIDIeditorComponents/PitchToMidi.mjs
// This file converts detected melody frequencies into MIDI note metadata.

export const MIDI_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function frequencyToMidi(frequency) {
  const f = Number(frequency);
  if (!Number.isFinite(f) || f <= 0) return null;
  const midi = Math.round(69 + 12 * Math.log2(f / 440));
  return Math.max(0, Math.min(127, midi));
}

export function midiToFrequency(midi) {
  const note = Math.max(0, Math.min(127, Math.round(Number(midi) || 60)));
  return 440 * Math.pow(2, (note - 69) / 12);
}

export function midiToPitchName(midi) {
  const note = Math.max(0, Math.min(127, Math.round(Number(midi) || 60)));
  const name = MIDI_NOTE_NAMES[note % 12];
  const octave = Math.floor(note / 12) - 1;
  return `${name}${octave}`;
}

export function pitchNameToMidi(name) {
  const match = String(name || "").trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase()];
  const accidental = match[2] === "#" ? 1 : (match[2] === "b" ? -1 : 0);
  const octave = Number(match[3]);
  const midi = (octave + 1) * 12 + base + accidental;
  if (!Number.isFinite(midi)) return null;
  return Math.max(0, Math.min(127, midi));
}

export function summarizePitchFrames(frames = []) {
  const usable = frames
    .map((frame) => Number(frame.frequency))
    .filter((frequency) => Number.isFinite(frequency) && frequency > 0);
  if (!usable.length) return null;
  usable.sort((a, b) => a - b);
  return usable[Math.floor(usable.length / 2)];
}
