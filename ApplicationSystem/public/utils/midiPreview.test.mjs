import { extractNoteOnEventsFromMIDI, extractNoteRangesFromMIDI } from "./midiPreview.mjs";

function assertEquals(actual, expected, message = "Values differ") {
  if (actual !== expected) {
    throw new Error(`${message}\nactual:   ${actual}\nexpected: ${expected}`);
  }
}

function buildMinimalMidi({ format = 0, tracks = [] } = {}) {
  const division = 480;

  const header = new Uint8Array(14);
  header.set([0x4d, 0x54, 0x68, 0x64], 0); // MThd
  header.set([0x00, 0x00, 0x00, 0x06], 4); // len
  header[8] = 0x00; header[9] = format & 0xff;
  header[10] = 0x00; header[11] = tracks.length & 0xff;
  header[12] = (division >> 8) & 0xff;
  header[13] = division & 0xff;

  const chunks = [];
  for (const trackBytes of tracks) {
    const trkHeader = new Uint8Array(8);
    trkHeader.set([0x4d, 0x54, 0x72, 0x6b], 0); // MTrk
    const len = trackBytes.length >>> 0;
    trkHeader[4] = (len >>> 24) & 0xff;
    trkHeader[5] = (len >>> 16) & 0xff;
    trkHeader[6] = (len >>> 8) & 0xff;
    trkHeader[7] = len & 0xff;
    chunks.push(trkHeader, trackBytes);
  }

  const totalLen = header.length + chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  out.set(header, pos); pos += header.length;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out.buffer;
}

function vlq(value) {
  let v = Math.max(0, Math.floor(value));
  const bytes = [v & 0x7f];
  v >>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return new Uint8Array(bytes);
}

Deno.test("extractNoteOnEventsFromMIDI finds Note On in single-track format 0", () => {
  // delta 0, NoteOn ch0, note 60, vel 64
  // delta 480, NoteOff ch0, note 60, vel 64
  // delta 0, EndOfTrack
  const track = new Uint8Array([
    ...vlq(0),
    0x90, 60, 64,
    ...vlq(480),
    0x80, 60, 64,
    ...vlq(0),
    0xff, 0x2f, 0x00,
  ]);
  const midi = buildMinimalMidi({ format: 0, tracks: [track] });
  const parsed = extractNoteOnEventsFromMIDI(midi);
  assertEquals(parsed.events.length, 1, "Expected one Note On event");
  assertEquals(parsed.events[0].midi, 60);
  assertEquals(parsed.events[0].tick, 0);
});

Deno.test("extractNoteOnEventsFromMIDI skips meta-only track and finds notes later", () => {
  const metaOnly = new Uint8Array([
    ...vlq(0),
    0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, // tempo
    ...vlq(0),
    0xff, 0x2f, 0x00,
  ]);
  const notes = new Uint8Array([
    ...vlq(0),
    0x90, 64, 64,
    ...vlq(240),
    0x80, 64, 64,
    ...vlq(0),
    0xff, 0x2f, 0x00,
  ]);
  const midi = buildMinimalMidi({ format: 1, tracks: [metaOnly, notes] });
  const parsed = extractNoteOnEventsFromMIDI(midi);
  assertEquals(parsed.events.length, 1, "Expected one Note On event");
  assertEquals(parsed.events[0].midi, 64);
});

Deno.test("extractNoteRangesFromMIDI pairs Note On/Off into ranges", () => {
  const track = new Uint8Array([
    ...vlq(0),
    0x90, 60, 64,
    ...vlq(240),
    0x80, 60, 64,
    ...vlq(0),
    0xff, 0x2f, 0x00,
  ]);
  const midi = buildMinimalMidi({ format: 0, tracks: [track] });
  const parsed = extractNoteRangesFromMIDI(midi);
  assertEquals(parsed.notes.length, 1, "Expected one note range");
  assertEquals(parsed.notes[0].midi, 60);
  assertEquals(parsed.notes[0].startTick, 0);
  assertEquals(parsed.notes[0].durationTicks, 240);
});

Deno.test("extractNoteRangesFromMIDI preserves running status across meta events", () => {
  // Note On 60, then a meta event, then another Note On 62 using running status (no 0x90).
  const track = new Uint8Array([
    ...vlq(0),
    0x90, 60, 64,
    ...vlq(0),
    0xff, 0x01, 0x01, 0x00, // meta text event, length 1
    ...vlq(0),
    62, 64, // running status: Note On
    ...vlq(120),
    0x80, 60, 64,
    ...vlq(0),
    0x80, 62, 64,
    ...vlq(0),
    0xff, 0x2f, 0x00,
  ]);
  const midi = buildMinimalMidi({ format: 0, tracks: [track] });
  const parsed = extractNoteRangesFromMIDI(midi);
  assertEquals(parsed.notes.length, 2, "Expected two note ranges");
  const midis = parsed.notes.map((n) => n.midi).sort((a, b) => a - b);
  assertEquals(midis[0], 60);
  assertEquals(midis[1], 62);
});
