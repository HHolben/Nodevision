// Nodevision/ApplicationSystem/public/utils/midiPreview.mjs
// Minimal MIDI parser for extracting Note On events for preview rendering.

function readFourCC(bytes, offset) {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

function readU32BE(bytes, offset) {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function readU16BE(bytes, offset) {
  return (((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0)) >>> 0;
}

function readVlq(bytes, start, end) {
  let value = 0;
  let pos = start;
  for (let i = 0; i < 4 && pos < end; i += 1) {
    const b = bytes[pos++];
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return { value, pos };
}

function parseTrackNotes(bytes, start, end, { track = 0, maxNotes = 10000 } = {}) {
  const notes = [];
  let pos = start;
  let absTick = 0;
  let runningStatus = null;
  const activeByKey = new Map(); // key -> startTick stack

  const ensure = (need) => pos + need <= end;
  const keyFor = (channel, midi) => ((channel & 0x0f) << 7) | (midi & 0x7f);
  const clearRunningStatusIfNeeded = (status) => {
    // In SMF, running status applies to channel messages.
    // Meta events (0xFF) should not clobber running status; SysEx should.
    if (status === 0xf0 || status === 0xf7) return null;
    if (status === 0xff) return runningStatus;
    if (status >= 0xf0) return null;
    return status;
  };

  const closeNote = (channel, midi) => {
    const key = keyFor(channel, midi);
    const stack = activeByKey.get(key);
    if (!stack || stack.length === 0) return;
    const startTick = stack.pop();
    const durationTicks = Math.max(1, absTick - startTick);
    notes.push({ startTick, durationTicks, midi, channel, track });
    if (stack.length === 0) activeByKey.delete(key);
  };

  while (pos < end && notes.length < maxNotes) {
    const delta = readVlq(bytes, pos, end);
    absTick += delta.value;
    pos = delta.pos;
    if (pos >= end) break;

    let status = bytes[pos];
    if (status < 0x80) {
      if (runningStatus == null) break;
      status = runningStatus;
    } else {
      pos += 1;
      runningStatus = clearRunningStatusIfNeeded(status);
    }

    if (status === 0xff) {
      if (!ensure(1)) break;
      pos += 1; // meta type
      const len = readVlq(bytes, pos, end);
      pos = len.pos + len.value;
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      const len = readVlq(bytes, pos, end);
      pos = len.pos + len.value;
      continue;
    }

    const hi = status & 0xf0;
    const channel = status & 0x0f;

    if (hi === 0xc0 || hi === 0xd0) {
      if (!ensure(1)) break;
      pos += 1;
      continue;
    }

    if (hi === 0x80 || hi === 0x90 || hi === 0xa0 || hi === 0xb0 || hi === 0xe0) {
      if (!ensure(2)) break;
      const midi = bytes[pos++];
      const vel = bytes[pos++];

      if (hi === 0x90) {
        if (vel > 0) {
          const key = keyFor(channel, midi);
          const stack = activeByKey.get(key) || [];
          stack.push(absTick);
          activeByKey.set(key, stack);
        } else {
          closeNote(channel, midi);
        }
      } else if (hi === 0x80) {
        closeNote(channel, midi);
      }

      continue;
    }

    break;
  }

  // Close any remaining active notes at end-of-track tick to keep the roll usable.
  for (const [key, stack] of activeByKey.entries()) {
    const channel = (key >> 7) & 0x0f;
    const midi = key & 0x7f;
    while (stack.length && notes.length < maxNotes) {
      const startTick = stack.pop();
      const durationTicks = Math.max(1, absTick - startTick);
      notes.push({ startTick, durationTicks, midi, channel, track });
    }
  }

  return notes;
}

function parseTrackNoteOns(bytes, start, end, { maxEventsPerTrack = 500, track = 0 } = {}) {
  const events = [];
  let pos = start;
  let absTick = 0;
  let runningStatus = null;
  const clearRunningStatusIfNeeded = (status) => {
    if (status === 0xf0 || status === 0xf7) return null;
    if (status === 0xff) return runningStatus;
    if (status >= 0xf0) return null;
    return status;
  };

  const ensure = (need) => pos + need <= end;

  while (pos < end && events.length < maxEventsPerTrack) {
    const delta = readVlq(bytes, pos, end);
    absTick += delta.value;
    pos = delta.pos;
    if (pos >= end) break;

    let status = bytes[pos];
    if (status < 0x80) {
      if (runningStatus == null) break;
      status = runningStatus;
    } else {
      pos += 1;
      runningStatus = clearRunningStatusIfNeeded(status);
    }

    if (status === 0xff) {
      if (!ensure(1)) break;
      pos += 1; // meta type
      const len = readVlq(bytes, pos, end);
      pos = len.pos + len.value;
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      const len = readVlq(bytes, pos, end);
      pos = len.pos + len.value;
      continue;
    }

    const hi = status & 0xf0;
    const channel = status & 0x0f;

    if (hi === 0xc0 || hi === 0xd0) {
      if (!ensure(1)) break;
      pos += 1;
      continue;
    }

    if (hi === 0x80 || hi === 0x90 || hi === 0xa0 || hi === 0xb0 || hi === 0xe0) {
      if (!ensure(2)) break;
      const note = bytes[pos++];
      const vel = bytes[pos++];
      if (hi === 0x90 && vel > 0) {
        events.push({ tick: absTick, midi: note, channel, track });
      }
      continue;
    }

    // Unknown/unsupported event type: bail out to avoid infinite loops.
    break;
  }

  return events;
}

export function extractNoteOnEventsFromMIDI(
  buffer,
  {
    maxEvents = 20000,
    maxEventsPerTrack = null,
  } = {},
) {
  const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
  if (bytes.length < 14) return { division: 480, events: [] };

  if (readFourCC(bytes, 0) !== "MThd") return { division: 480, events: [] };
  const headerLen = readU32BE(bytes, 4);
  const divisionRaw = readU16BE(bytes, 12);
  const division = divisionRaw && (divisionRaw & 0x8000) === 0 ? divisionRaw : 480;

  let pos = 8 + headerLen;
  if (pos < 14) pos = 14;

  const all = [];
  let trackIndex = 0;

  while (pos + 8 <= bytes.length && all.length < maxEvents) {
    const id = readFourCC(bytes, pos);
    const len = readU32BE(bytes, pos + 4);
    pos += 8;

    if (id !== "MTrk") {
      pos += len;
      continue;
    }

    const trackStart = pos;
    const trackEnd = Math.min(bytes.length, trackStart + len);
    const remainingBudget = Math.max(0, maxEvents - all.length);
    const perTrack =
      maxEventsPerTrack == null
        ? remainingBudget
        : Math.max(0, Math.min(remainingBudget, Math.floor(maxEventsPerTrack)));
    const events = parseTrackNoteOns(bytes, trackStart, trackEnd, {
      maxEventsPerTrack: perTrack,
      track: trackIndex,
    });
    all.push(...events);
    pos = trackEnd;
    trackIndex += 1;
  }

  all.sort((a, b) =>
    (a.tick - b.tick) ||
    (a.track - b.track) ||
    (a.channel - b.channel) ||
    (a.midi - b.midi)
  );
  return { division, events: all.slice(0, maxEvents) };
}

export function extractNoteRangesFromMIDI(
  buffer,
  {
    maxNotes = 20000,
    maxNotesPerTrack = null,
  } = {},
) {
  const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
  if (bytes.length < 14) return { division: 480, notes: [] };

  if (readFourCC(bytes, 0) !== "MThd") return { division: 480, notes: [] };
  const headerLen = readU32BE(bytes, 4);
  const divisionRaw = readU16BE(bytes, 12);
  const division = divisionRaw && (divisionRaw & 0x8000) === 0 ? divisionRaw : 480;

  let pos = 8 + headerLen;
  if (pos < 14) pos = 14;

  const all = [];
  let trackIndex = 0;

  while (pos + 8 <= bytes.length && all.length < maxNotes) {
    const id = readFourCC(bytes, pos);
    const len = readU32BE(bytes, pos + 4);
    pos += 8;

    if (id !== "MTrk") {
      pos += len;
      continue;
    }

    const trackStart = pos;
    const trackEnd = Math.min(bytes.length, trackStart + len);
    const remainingBudget = Math.max(0, maxNotes - all.length);
    const perTrack =
      maxNotesPerTrack == null
        ? remainingBudget
        : Math.max(0, Math.min(remainingBudget, Math.floor(maxNotesPerTrack)));

    const notes = parseTrackNotes(bytes, trackStart, trackEnd, {
      track: trackIndex,
      maxNotes: perTrack,
    });
    all.push(...notes);
    pos = trackEnd;
    trackIndex += 1;
  }

  all.sort((a, b) =>
    (a.startTick - b.startTick) ||
    (a.track - b.track) ||
    (a.channel - b.channel) ||
    (a.midi - b.midi)
  );

  return { division, notes: all.slice(0, maxNotes) };
}
