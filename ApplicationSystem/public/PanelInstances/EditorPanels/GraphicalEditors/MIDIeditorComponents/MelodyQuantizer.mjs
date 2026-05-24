// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MIDIeditorComponents/MelodyQuantizer.mjs
// This file segments pitch frames and quantizes melody notes to the MIDI editor grid.

import { frequencyToMidi, midiToPitchName, summarizePitchFrames } from "./PitchToMidi.mjs";

const DURATIONS = [
  { value: "w", beats: 4 },
  { value: "h", beats: 2 },
  { value: "q", beats: 1 },
  { value: "8", beats: 0.5 },
];

export function durationToBeats(duration) {
  return DURATIONS.find((item) => item.value === duration)?.beats || 1;
}

export function durationFromBeats(beats) {
  let best = DURATIONS[2];
  let dist = Infinity;
  for (const item of DURATIONS) {
    const d = Math.abs(beats - item.beats);
    if (d < dist) {
      best = item;
      dist = d;
    }
  }
  return best.value;
}

export function framesToQuantizedNotes(frames = [], { tempoBpm = 120, gridBeats = 1 } = {}) {
  const bpm = clamp(tempoBpm, 20, 400, 120);
  const beatSeconds = 60 / bpm;
  const gridSeconds = beatSeconds * (Number(gridBeats) || 1);
  const voiced = normalizeStartTime(smoothMidiFrames(frames
    .map((frame) => ({ ...frame, midi: frequencyToMidi(frame.frequency) }))
    .filter((frame) => Number.isFinite(frame.time) && frame.midi !== null)));

  const segments = mergeNearSegments(absorbShortSegments(segmentVoicedFrames(voiced)));
  const notes = segments.map((segment, index) => {
    const start = Math.max(0, Math.round(segment.start / gridSeconds) * gridSeconds);
    const end = Math.max(start + gridSeconds, Math.round(segment.end / gridSeconds) * gridSeconds);
    const beats = Math.max(1, (end - start) / beatSeconds);
    const duration = durationFromBeats(beats);
    const midi = mostCommonMidi(segment.frames);
    const frequency = summarizePitchFrames(segment.frames);
    return {
      id: `detected-${Date.now()}-${index}`,
      midi,
      pitch: midiToPitchName(midi),
      frequency,
      startSeconds: start,
      durationSeconds: end - start,
      duration,
      beats: durationToBeats(duration),
    };
  });
  return dedupeQuantizedNotes(notes, beatSeconds);
}

function normalizeStartTime(frames) {
  const firstTime = frames.find((frame) => Number.isFinite(frame.time))?.time ?? 0;
  return frames.map((frame) => ({
    ...frame,
    time: Math.max(0, frame.time - firstTime),
  }));
}

function smoothMidiFrames(frames) {
  const smoothed = frames.map((frame, index) => {
    const local = frames
      .slice(Math.max(0, index - 3), Math.min(frames.length, index + 4))
      .map((item) => item.midi)
      .sort((a, b) => a - b);
    return { ...frame, midi: local[Math.floor(local.length / 2)] ?? frame.midi };
  });

  let anchor = null;
  let heldFrames = 0;
  return smoothed.map((frame) => {
    if (anchor === null) {
      anchor = frame.midi;
      heldFrames = 1;
      return frame;
    }

    let midi = foldOctaveNear(frame.midi, anchor);
    const jump = Math.abs(midi - anchor);
    if (jump > 4 && heldFrames < 10) {
      heldFrames += 1;
      return { ...frame, midi: anchor };
    }

    if (jump <= 4 || heldFrames >= 10) {
      anchor = midi;
      heldFrames = 1;
    } else {
      heldFrames += 1;
    }
    return { ...frame, midi: anchor };
  });
}

function foldOctaveNear(midi, target) {
  let folded = midi;
  while (folded - target > 6) folded -= 12;
  while (target - folded > 6) folded += 12;
  return Math.max(0, Math.min(127, folded));
}

function segmentVoicedFrames(frames) {
  const out = [];
  let current = null;
  let candidate = null;

  const flushCurrent = () => {
    if (candidate?.frames?.length && current) {
      current.frames.push(...candidate.frames);
      current.end = candidate.frames[candidate.frames.length - 1].time;
    }
    candidate = null;
    if (current && current.frames.length >= 3) out.push(current);
  };

  for (const frame of frames) {
    if (!current) {
      current = { start: frame.time, end: frame.time, frames: [frame] };
      continue;
    }

    const previous = current.frames[current.frames.length - 1];
    if (frame.time - previous.time > 0.34) {
      flushCurrent();
      current = { start: frame.time, end: frame.time, frames: [frame] };
      continue;
    }

    const currentMidi = mostCommonMidi(current.frames.slice(-10));
    const isDifferentPitch = Math.abs(frame.midi - currentMidi) > 1;
    if (!isDifferentPitch) {
      if (candidate?.frames?.length) current.frames.push(...candidate.frames);
      candidate = null;
      current.frames.push(frame);
      current.end = frame.time;
      continue;
    }

    if (!candidate || Math.abs(frame.midi - candidate.midi) > 1) {
      candidate = { midi: frame.midi, start: frame.time, frames: [frame] };
    } else {
      candidate.frames.push(frame);
    }

    if (candidate.frames.length >= 5 && candidate.start - current.start >= 0.22) {
      if (current.frames.length >= 3) out.push(current);
      current = {
        start: candidate.start,
        end: frame.time,
        frames: candidate.frames.slice(),
      };
      candidate = null;
    }
  }

  flushCurrent();
  return out;
}

function absorbShortSegments(segments) {
  const out = [];
  for (const segment of segments) {
    const seconds = segment.end - segment.start;
    if (seconds < 0.22 && out.length) {
      const previous = out[out.length - 1];
      previous.end = segment.end;
      previous.frames.push(...segment.frames);
    } else {
      out.push({ ...segment, frames: segment.frames.slice() });
    }
  }
  return out;
}

function mergeNearSegments(segments) {
  const out = [];
  for (const segment of segments) {
    const previous = out[out.length - 1];
    const previousMidi = previous ? mostCommonMidi(previous.frames) : null;
    const midi = mostCommonMidi(segment.frames);
    const gap = previous ? segment.start - previous.end : Infinity;
    if (previous && gap <= 0.2 && Math.abs(previousMidi - midi) <= 1) {
      previous.end = segment.end;
      previous.frames.push(...segment.frames);
    } else {
      out.push(segment);
    }
  }
  return out;
}

function mostCommonMidi(frames) {
  const counts = new Map();
  for (const frame of frames) {
    counts.set(frame.midi, (counts.get(frame.midi) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 60;
}

function dedupeQuantizedNotes(notes, beatSeconds) {
  const out = [];
  for (const note of notes) {
    const previous = out[out.length - 1];
    const sameGridSlot = previous && Math.abs(previous.startSeconds - note.startSeconds) < beatSeconds * 0.25;
    if (!sameGridSlot) out.push(note);
  }
  return out;
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
